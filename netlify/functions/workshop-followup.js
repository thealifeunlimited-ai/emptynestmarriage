// Scheduled Netlify Function — runs once a day, sends workshop registrants:
//   1) a same-day reminder on July 18
//   2) a replay/thank-you email a couple days after
// State (reminderSent/followupSent) is stored per-registrant in the same
// "workshop" Netlify Blobs store that workshop-register.js writes to.
//
// Sends through Postmark's BROADCAST stream so the {{{ pm:unsubscribe }}} token
// becomes a real unsubscribe link and opt-outs are suppressed automatically.
//
// Requires env vars (Netlify → Site configuration → Environment variables):
//   POSTMARK_TOKEN  = your Postmark Server API Token
//   FROM_EMAIL      = hello@emptynestmarriage.com  (optional; default below)

import { getStore } from "@netlify/blobs";

const WORKSHOP_TITLE = "Reconnect: An Evening for Empty Nest Couples";
const WORKSHOP_LINK  = "https://us06web.zoom.us/j/84272976582?pwd=uqbGwbDOdmZhBBYucmxpCoDTxIOQOb.1";
const COMMUNITY       = "https://www.skool.com/empty-nesters-7478";
const PROGRAM         = "https://emptynestmarriage.com/sales-page.html";

// Send the reminder on this date (workshop day, Arizona time), and the
// replay/follow-up starting on this date (2 days later). Compared against
// UTC calendar date, so precision is "the day," not the hour.
const REMINDER_DATE = "2026-07-18";
const FOLLOWUP_FROM = "2026-07-20";

// >>> PASTE YOUR ZOOM RECORDING / REPLAY LINK HERE AFTER THE WORKSHOP <<<
// (Must be set before FOLLOWUP_FROM or the replay email will go out with a broken link.)
const REPLAY_LINK = "PASTE_YOUR_REPLAY_LINK_HERE";

const FOOTER = `
  <p style="font-size:12px;color:#7a8a80;border-top:1px solid #e0d8c8;padding-top:12px;margin-top:20px;">
    You're getting this because you registered for our free workshop at EmptyNestMarriage.com.
    Not your thing anymore? <a href="{{{ pm:unsubscribe }}}" style="color:#C8A24A;">Unsubscribe here</a> — no hard feelings.<br>
    Billy &amp; Maryruth Mitchell · PO Box 1107, Seligman, AZ 86337
  </p>`;

function wrap(inner) {
  return `
<div style="font-family:Arial,Helvetica,sans-serif;color:#0F2A1E;max-width:560px;margin:0 auto;line-height:1.6;">
  <div style="background:#0F2A1E;padding:18px;text-align:center;border-bottom:4px solid #C8A24A;">
    <span style="color:#C8A24A;font-size:13px;letter-spacing:3px;text-transform:uppercase;">Empty Nest Marriage</span>
  </div>
  <div style="padding:26px 24px;">${inner}${FOOTER}</div>
</div>`.trim();
}

function reminderHtml(first) {
  return wrap(`
    <p>${first},</p>
    <p>Tonight's the night! <strong>${WORKSHOP_TITLE}</strong> goes live in just a few hours.</p>
    <p><strong>When:</strong> Today, Saturday, July 18 at 1:00 PM Arizona Time (1 PM Pacific / 2 PM Mountain / 3 PM Central / 4 PM Eastern)</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${WORKSHOP_LINK}" style="background:#C8A24A;color:#0F2A1E;text-decoration:none;font-weight:bold;text-transform:uppercase;letter-spacing:1px;padding:14px 28px;border-radius:4px;display:inline-block;">Join the Zoom →</a>
    </p>
    <p>Grab your spouse, grab a comfy seat, and we'll see you both soon.</p>
    <p>— Billy &amp; Maryruth</p>`);
}

function followupHtml(first) {
  return wrap(`
    <p>${first},</p>
    <p>Thanks so much for being part of <strong>${WORKSHOP_TITLE}</strong> — whether you caught it live or are watching after the fact, here's your replay:</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${REPLAY_LINK}" style="background:#C8A24A;color:#0F2A1E;text-decoration:none;font-weight:bold;text-transform:uppercase;letter-spacing:1px;padding:14px 28px;border-radius:4px;display:inline-block;">Watch the Replay →</a>
    </p>
    <p>If even one thing from that hour gives you something to try tonight, that's exactly what we hoped for.</p>
    <p>Want to keep the momentum going? Come join our free community of empty-nest couples walking this same road: <a href="${COMMUNITY}" style="color:#C8A24A;font-weight:bold;">join us here</a>.</p>
    <p>And if you're ready to go deeper, our Reignite program walks you and your spouse through all five shifts together, with us beside you the whole way: <a href="${PROGRAM}" style="color:#C8A24A;font-weight:bold;">see how it works</a>.</p>
    <p>— Billy &amp; Maryruth</p>
    <p>P.S. — Hit reply anytime. We read every message.</p>`);
}

async function sendEmail(token, from, to, subject, html) {
  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token
    },
    body: JSON.stringify({
      From: from,
      To: to,
      Subject: subject,
      HtmlBody: html,
      MessageStream: "broadcast"
    })
  });
  if (!res.ok) {
    const t = await res.text();
    console.log("Postmark send failed for", to, ":", t);
    return { ok: false };
  }
  return { ok: true };
}

export default async () => {
  const token = process.env.POSTMARK_TOKEN;
  const from = process.env.FROM_EMAIL || "hello@emptynestmarriage.com";
  if (!token) {
    console.log("Missing POSTMARK_TOKEN");
    return new Response("Missing token", { status: 500 });
  }

  const store = getStore({
    name: "workshop",
    siteID: process.env.BLOBS_SITE_ID || process.env.NETLIFY_SITE_ID,
    token: process.env.BLOBS_TOKEN
  });
  const { blobs } = await store.list();
  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  let reminders = 0, followups = 0;

  for (const b of blobs) {
    const sub = await store.get(b.key, { type: "json" });
    if (!sub || !sub.email) continue;
    const first = sub.name || "friend";

    // Replay/follow-up takes priority once its window opens, so late
    // registrants (who missed the reminder window) still get the replay.
    if (!sub.followupSent && todayStr >= FOLLOWUP_FROM) {
      const r = await sendEmail(token, from, sub.email, "Here's your replay 🎬", followupHtml(first));
      if (r.ok) {
        sub.followupSent = new Date().toISOString();
        await store.setJSON(b.key, sub);
        followups++;
      }
      continue;
    }

    if (!sub.reminderSent && todayStr === REMINDER_DATE) {
      const r = await sendEmail(token, from, sub.email, "Tonight's the night! 🎉", reminderHtml(first));
      if (r.ok) {
        sub.reminderSent = new Date().toISOString();
        await store.setJSON(b.key, sub);
        reminders++;
      }
    }
  }

  console.log(`Workshop follow-up run complete. Reminders: ${reminders}, Replays: ${followups}.`);
  return new Response(`Done. Reminders: ${reminders}, Replays: ${followups}.`);
};

// Run once a day (UTC midnight).
export const config = { schedule: "@daily" };
