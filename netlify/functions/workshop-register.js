// Netlify Function: registers someone for the free workshop.
// Sends a confirmation email via Postmark + saves them to storage.
// Also syncs to Kit (ConvertKit) if KIT_API_KEY is set in Netlify env vars.
//
// >>> EDIT THESE 3 LINES with your real workshop details, then redeploy <<<
const WORKSHOP_TITLE = "Reconnect: An Evening for Empty Nest Couples";
const WORKSHOP_WHEN  = "Saturday, July 18 at 1:00 PM (Arizona Time)";
const WORKSHOP_LINK  = "https://us06web.zoom.us/j/84272976582?pwd=uqbGwbDOdmZhBBYucmxpCoDTxIOQOb.1";

// "Workshop Registrant - July 18" tag, created in Kit — applied to everyone who registers.
const KIT_WORKSHOP_TAG_ID = 20671007;

export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    let rawBody = event.body || "";
    if (event.isBase64Encoded) rawBody = Buffer.from(rawBody, "base64").toString("utf8");

    let name = "", email = "";
    const ct = (event.headers["content-type"] || "").toLowerCase();
    if (ct.includes("application/json")) {
      const j = JSON.parse(rawBody || "{}");
      name = (j.name || "").trim(); email = (j.email || "").trim();
    } else {
      const p = new URLSearchParams(rawBody);
      name = (p.get("name") || "").trim(); email = (p.get("email") || "").trim();
    }
    if (!email) return { statusCode: 400, body: "Email is required" };

    const token = process.env.POSTMARK_TOKEN;
    const from = process.env.FROM_EMAIL || "hello@emptynestmarriage.com";
    if (!token) return { statusCode: 500, body: "Missing POSTMARK_TOKEN" };
    const first = name ? name.replace(/[<>]/g, "").slice(0, 40) : "friend";

    const html = `
<div style="font-family:Arial,Helvetica,sans-serif;color:#0F2A1E;max-width:560px;margin:0 auto;line-height:1.6;">
  <div style="background:#0F2A1E;padding:22px;text-align:center;border-bottom:4px solid #C8A24A;">
    <span style="color:#C8A24A;font-size:13px;letter-spacing:3px;text-transform:uppercase;">Empty Nest Marriage</span>
  </div>
  <div style="padding:26px 24px;">
    <p>You're registered, ${first}! 🎉</p>
    <p>We're so glad you're joining us for:</p>
    <p style="font-size:18px;font-weight:bold;">${WORKSHOP_TITLE}</p>
    <p><strong>When:</strong> ${WORKSHOP_WHEN}</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${WORKSHOP_LINK}" style="background:#C8A24A;color:#0F2A1E;text-decoration:none;font-weight:bold;text-transform:uppercase;letter-spacing:1px;padding:14px 28px;border-radius:4px;display:inline-block;">Save Your Spot / Join Link →</a>
    </p>
    <p>Come as you are — both of you if you can. It'll be real, a little funny, and you'll walk away with something you can use that very night.</p>
    <p>Can't wait to see you there.<br>— Billy &amp; Maryruth</p>
  </div>
  <div style="background:#0F2A1E;padding:14px;text-align:center;">
    <span style="color:#C8A24A;font-size:12px;letter-spacing:2px;text-transform:uppercase;">EmptyNestMarriage.com</span>
  </div>
</div>`.trim();

    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json", "X-Postmark-Server-Token": token },
      body: JSON.stringify({
        From: from, To: email,
        Subject: "You're registered! " + WORKSHOP_TITLE,
        HtmlBody: html, MessageStream: "outbound"
      })
    });
    if (!res.ok) return { statusCode: 502, body: "Postmark error: " + (await res.text()) };

    // Save the registrant
    let saveStatus = "saved";
    try {
      const { getStore } = await import("@netlify/blobs");
      const store = getStore({
        name: "workshop",
        siteID: process.env.BLOBS_SITE_ID || process.env.NETLIFY_SITE_ID,
        token: process.env.BLOBS_TOKEN
      });
      await store.setJSON(email.toLowerCase(), { email, name: first, registeredAt: new Date().toISOString() });
    } catch (e) {
      saveStatus = "save-failed: " + (e && e.message ? e.message : String(e));
    }

    // Sync to Kit (ConvertKit) so registrants also land in Billy & Maryruth's list manager.
    // Wrapped so a Kit API hiccup can NEVER block the confirmation email or the response above.
    let kitStatus = "skipped (no KIT_API_KEY)";
    const kitKey = process.env.KIT_API_KEY;
    if (kitKey) {
      try {
        const kitRes = await fetch("https://api.kit.com/v4/subscribers", {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Kit-Api-Key": kitKey
          },
          body: JSON.stringify({ email_address: email, first_name: first })
        });
        if (kitRes.ok) {
          await fetch(`https://api.kit.com/v4/tags/${KIT_WORKSHOP_TAG_ID}/subscribers`, {
            method: "POST",
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/json",
              "X-Kit-Api-Key": kitKey
            },
            body: JSON.stringify({ email_address: email })
          });
          kitStatus = "synced";
        } else {
          kitStatus = "kit-failed: " + (await kitRes.text());
        }
      } catch (e) {
        kitStatus = "kit-failed: " + (e && e.message ? e.message : String(e));
      }
      console.log("Kit sync:", kitStatus);
    }

    return { statusCode: 200, body: "OK | " + saveStatus };
  } catch (e) {
    return { statusCode: 500, body: "Error: " + (e && e.message ? e.message : String(e)) };
  }
}
