// Netlify Function: sends the Reignite guide via Postmark when someone signs up,
// and saves the subscriber so the daily drip function can follow up.
// The Postmark token is read from a SECURE environment variable (never in code).
// Set these in Netlify: Site settings → Environment variables
//   POSTMARK_TOKEN  = your Postmark Server API Token
//   FROM_EMAIL      = hello@emptynestmarriage.com   (optional; defaults below)

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // Netlify sometimes base64-encodes the request body — decode it first.
    let rawBody = event.body || "";
    if (event.isBase64Encoded) {
      rawBody = Buffer.from(rawBody, "base64").toString("utf8");
    }

    // Form data can arrive URL-encoded or as JSON
    let name = "", email = "";
    const ct = (event.headers["content-type"] || "").toLowerCase();
    if (ct.includes("application/json")) {
      const j = JSON.parse(rawBody || "{}");
      name = (j.name || "").trim();
      email = (j.email || "").trim();
    } else {
      const p = new URLSearchParams(rawBody);
      name = (p.get("name") || "").trim();
      email = (p.get("email") || "").trim();
    }

    if (!email) return { statusCode: 400, body: "Email is required" };

    const token = process.env.POSTMARK_TOKEN;
    const from = process.env.FROM_EMAIL || "hello@emptynestmarriage.com";
    if (!token) return { statusCode: 500, body: "Missing POSTMARK_TOKEN" };

    const first = name ? name.replace(/[<>]/g, "").slice(0, 40) : "friend";

    const html = `
<div style="font-family:Arial,Helvetica,sans-serif;color:#0F2A1E;max-width:560px;margin:0 auto;line-height:1.6;">
  <div style="background:#0F2A1E;padding:24px;text-align:center;border-bottom:4px solid #C8A24A;">
    <span style="color:#C8A24A;font-size:14px;letter-spacing:3px;text-transform:uppercase;">Empty Nest Marriage</span>
  </div>
  <div style="padding:28px 24px;">
    <p>Hey ${first},</p>
    <p>Billy and Maryruth here. Your copy of <em>Reignite: 5 Shifts for Empty Nesters</em> is ready 👇</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="https://emptynestmarriage.com/reignite-guide.pdf"
         style="background:#C8A24A;color:#0F2A1E;text-decoration:none;font-weight:bold;
                text-transform:uppercase;letter-spacing:1px;padding:14px 28px;border-radius:4px;display:inline-block;">
        Download Your Guide (PDF) →
      </a>
    </p>
    <p>Here's our one ask: don't just read it — start with <strong>Shift One tonight</strong>. At dinner, ask your spouse the question on that page, then just listen. That one conversation has restarted more marriages than any fancy program ever could.</p>
    <p>And come meet your people — we've got a free community of empty-nest couples walking this exact road together:
      <a href="https://www.skool.com/empty-nesters-7478" style="color:#C8A24A;font-weight:bold;">join us here</a>.</p>
    <p>We'll be in touch over the next couple weeks with the real stuff. Keep an eye out.</p>
    <p>You've got this.<br>— Billy &amp; Maryruth</p>
  </div>
  <div style="background:#0F2A1E;padding:16px;text-align:center;">
    <span style="color:#C8A24A;font-size:12px;letter-spacing:2px;text-transform:uppercase;">EmptyNestMarriage.com</span>
  </div>
  <p style="font-size:11px;color:#9aa89e;text-align:center;padding:14px 24px 0;line-height:1.5;">
    You received this because you requested our free guide at EmptyNestMarriage.com.<br>
    Billy &amp; Maryruth Mitchell · Prefer not to hear from us? Just reply with "unsubscribe."
  </p>
</div>`.trim();

    const text =
`Hey ${first},

Your copy of "Reignite: 5 Shifts for Empty Nesters" is ready:
https://emptynestmarriage.com/reignite-guide.pdf

Our one ask: don't just read it — start with Shift One tonight.

Come join our free community of empty-nest couples:
https://www.skool.com/empty-nesters-7478

You've got this.
— Billy & Maryruth
EmptyNestMarriage.com`;

    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": token
      },
      body: JSON.stringify({
        From: from,
        To: email,
        Subject: "Your Reignite guide is inside",
        HtmlBody: html,
        TextBody: text,
        MessageStream: "outbound"
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return { statusCode: 502, body: "Postmark error: " + errText };
    }

    // Save the subscriber so the daily drip can send the follow-up emails.
    // (step 0 = guide sent; the drip sends emails 2–5 on days 2/4/7/10.)
    // Loaded dynamically so a storage hiccup can NEVER block the guide email.
    let saveStatus = "saved";
    try {
      const { getStore } = await import("@netlify/blobs");
      const store = getStore("subscribers");
      await store.setJSON(email.toLowerCase(), {
        email: email,
        name: first,
        startDate: new Date().toISOString(),
        step: 0
      });
    } catch (e) {
      // Don't fail the signup if storage hiccups — they still got the guide.
      saveStatus = "save-failed: " + (e && e.message ? e.message : String(e));
      console.log("Could not save subscriber:", saveStatus);
    }

    return { statusCode: 200, body: "OK | " + saveStatus };
  } catch (e) {
    return { statusCode: 500, body: "Error: " + (e && e.message ? e.message : String(e)) };
  }
}
