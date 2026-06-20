// Scheduled Netlify Function — runs once a day, sends the next drip email to
// anyone who's due. State is stored in Netlify Blobs (no external database).
//
// Sends through Postmark's BROADCAST stream so the {{{ pm:unsubscribe }}} token
// becomes a real unsubscribe link and opt-outs are suppressed automatically.
//
// Requires env vars (Netlify → Site configuration → Environment variables):
//   POSTMARK_TOKEN  = your Postmark Server API Token
//   FROM_EMAIL      = hello@emptynestmarriage.com  (optional; default below)

import { getStore } from "@netlify/blobs";

// Days after signup that each follow-up should send.
// (Email 1 — the guide — is sent immediately at signup by subscribe.js.)
export const SCHEDULE = [2, 4, 7, 10];

const FOOTER = `
  <p style="font-size:12px;color:#7a8a80;border-top:1px solid #e0d8c8;padding-top:12px;margin-top:20px;">
    You're getting this because you grabbed our free guide at EmptyNestMarriage.com.
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

const COMMUNITY = `https://www.skool.com/empty-nesters-7478`;
const PROGRAM = `https://emptynestmarriage.com/sales-page.html`;

// Follow-up emails 2–5 (Email 1/the guide is handled at signup).
export const FOLLOWUPS = [
  {
    subject: "We almost didn't make it",
    html: (first) => wrap(`
      <p>${first},</p>
      <p>We don't talk about this part much, but you should know it.</p>
      <p>A few years back, our youngest moved out, and within about a month we realized we'd become strangers who shared a mortgage. We were polite. We were "fine." And we were quietly miserable.</p>
      <p>One night Billy said it out loud: <em>"I don't know who we are anymore without the kids."</em> And Maryruth burst into tears — she'd been thinking the exact same thing and was too scared to say it.</p>
      <p>That was the bottom. But it was also the beginning. We did the work — and today we genuinely have more fun and connection than we did in our 30s.</p>
      <p>If you're in that quiet, "who are we now?" place — you're not broken. You're right on time.</p>
      <p>You're not alone in this, either. Hundreds of couples in our free community are in the same season: <a href="${COMMUNITY}" style="color:#C8A24A;font-weight:bold;">come join us</a>.</p>
      <p>— Billy &amp; Maryruth</p>`)
  },
  {
    subject: "The #1 mistake empty nesters make",
    html: (first) => wrap(`
      <p>${first},</p>
      <p>Here's the mistake we see more than any other: <strong>couples wait.</strong></p>
      <p>"Once we adjust to the empty house, things will feel normal again." So they give it time. Months pass. Years pass. And the quiet doesn't fill back in — it just becomes the new normal.</p>
      <p>The truth nobody tells you: the empty nest doesn't fix itself. A marriage is a garden, not a rock. But the good news — it responds <em>fast</em> when you actually tend to it. We've seen couples reconnect in weeks just by being intentional.</p>
      <p>Don't give it time. Give it attention. That's the whole secret.</p>
      <p>Want a little accountability? That's what our free community is for: <a href="${COMMUNITY}" style="color:#C8A24A;font-weight:bold;">join here</a>.</p>
      <p>— Billy &amp; Maryruth</p>`)
  },
  {
    subject: "\"We didn't have a bad marriage. Just a quiet one.\"",
    html: (first) => wrap(`
      <p>${first},</p>
      <p>Let us tell you about a couple — we'll call them Carol and Jim.</p>
      <p>Twenty-seven years married, kids all moved out. In Carol's words: <em>"We didn't have a bad marriage. That was the problem — it was just quiet."</em> Jim was the skeptic.</p>
      <p>But they started small. One real conversation. A little affection. An actual date. Three months in, Carol emailed us: <em>"We stayed up talking until midnight. I forgot what it felt like to actually like him."</em> And Jim? He's the one planning the dates now.</p>
      <p>Carol and Jim aren't special. They were just two good people who decided to stop waiting. That's available to you too — starting this week.</p>
      <p>Our community is full of couples just like them: <a href="${COMMUNITY}" style="color:#C8A24A;font-weight:bold;">come meet them</a>.</p>
      <p>— Billy &amp; Maryruth</p>`)
  },
  {
    subject: "If you're ready, here's the next step",
    html: (first) => wrap(`
      <p>${first},</p>
      <p>Over the last week and a half, we've shared our story, the biggest mistake to avoid, and what reconnection actually looks like.</p>
      <p>The five shifts in your guide work. But reading about them and <em>living</em> them are two different things — and most couples do better with support and a clear path.</p>
      <p>That's exactly what our <strong>Reignite program</strong> is. We walk you and your spouse through all five shifts, together, with us beside you the whole way.</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${PROGRAM}" style="background:#C8A24A;color:#0F2A1E;text-decoration:none;font-weight:bold;text-transform:uppercase;letter-spacing:1px;padding:14px 28px;border-radius:4px;display:inline-block;">See How It Works →</a>
      </p>
      <p>No countdown timers. No fake scarcity. Just an honest invitation from one couple to another. And if now's not your time, that's okay — you keep everything, and we're still cheering for you.</p>
      <p>This chapter can be the best one of your marriage. We mean that.</p>
      <p>— Billy &amp; Maryruth</p>`)
  }
];

export async function sendEmail(token, from, to, subject, html) {
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
      MessageStream: "broadcast"   // marketing stream → unsubscribe token works
    })
  });
  if (!res.ok) {
    const t = await res.text();
    console.log("Postmark send failed for", to, ":", t);
    return { ok: false, error: t };
  }
  return { ok: true, error: "" };
}

export default async () => {
  const token = process.env.POSTMARK_TOKEN;
  const from = process.env.FROM_EMAIL || "hello@emptynestmarriage.com";
  if (!token) {
    console.log("Missing POSTMARK_TOKEN");
    return new Response("Missing token", { status: 500 });
  }

  const store = getStore({
    name: "subscribers",
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_API_TOKEN
  });
  const { blobs } = await store.list();
  const now = Date.now();
  let sent = 0;

  for (const b of blobs) {
    const sub = await store.get(b.key, { type: "json" });
    if (!sub || typeof sub.step !== "number") continue;
    if (sub.step >= SCHEDULE.length) continue; // finished the sequence

    const daysSince = (now - new Date(sub.startDate).getTime()) / 86400000;
    if (daysSince >= SCHEDULE[sub.step]) {
      const fu = FOLLOWUPS[sub.step];
      const r = await sendEmail(token, from, sub.email, fu.subject, fu.html(sub.name || "friend"));
      if (r.ok) {
        sub.step += 1;
        sub.lastSent = new Date().toISOString();
        await store.setJSON(b.key, sub);
        sent++;
      } else {
        console.log("Send failed for", sub.email, ":", r.error);
      }
    }
  }

  console.log(`Drip run complete. Emails sent: ${sent}`);
  return new Response(`Drip complete. Sent ${sent} emails.`);
};

// Run once a day (UTC midnight).
export const config = { schedule: "@daily" };
