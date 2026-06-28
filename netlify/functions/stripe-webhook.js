// Netlify Function: Stripe webhook listener. On checkout.session.completed for
// The Spark, emails the buyer their course access link, tags them in Kit, and
// records the purchase — all automatic, no manual follow-up needed.
//
// Requires env vars (Netlify → Site configuration → Environment variables):
//   STRIPE_WEBHOOK_SECRET = the signing secret for this endpoint (from Stripe
//                            Dashboard → Developers → Webhooks → this endpoint)
//   POSTMARK_TOKEN, FROM_EMAIL, KIT_API_KEY — same as the rest of the site

import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

const SITE_URL = "https://emptynestmarriage.com";

// "Spark Customer" tag, created in Kit — applied to everyone who buys The Spark.
const KIT_SPARK_TAG_ID = 20710595;

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const parts = {};
  signatureHeader.split(",").forEach((p) => {
    const [k, v] = p.split("=");
    parts[k] = v;
  });
  if (!parts.t || !parts.v1) return false;

  const signedPayload = `${parts.t}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(parts.v1, "hex"));
  } catch {
    return false;
  }
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return { statusCode: 500, body: "Missing STRIPE_WEBHOOK_SECRET" };

  let rawBody = event.body || "";
  if (event.isBase64Encoded) rawBody = Buffer.from(rawBody, "base64").toString("utf8");

  const sigHeader = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
  if (!verifyStripeSignature(rawBody, sigHeader, webhookSecret)) {
    return { statusCode: 400, body: "Invalid signature" };
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  if (stripeEvent.type !== "checkout.session.completed") {
    return { statusCode: 200, body: "Ignored" };
  }

  const session = stripeEvent.data.object;
  const email = (session.customer_details && session.customer_details.email) || session.customer_email;
  const fullName = (session.customer_details && session.customer_details.name) || "";
  if (!email) return { statusCode: 200, body: "No email on session" };

  const first = fullName ? fullName.split(" ")[0].replace(/[<>]/g, "").slice(0, 40) : "friend";

  // 1) Email the course access link via Postmark.
  const postmarkToken = process.env.POSTMARK_TOKEN;
  const from = process.env.FROM_EMAIL || "hello@emptynestmarriage.com";
  if (postmarkToken) {
    const html = `
<div style="font-family:Arial,Helvetica,sans-serif;color:#0F2A1E;max-width:560px;margin:0 auto;line-height:1.6;">
  <div style="background:#0F2A1E;padding:22px;text-align:center;border-bottom:4px solid #C8A24A;">
    <span style="color:#C8A24A;font-size:13px;letter-spacing:3px;text-transform:uppercase;">Empty Nest Marriage</span>
  </div>
  <div style="padding:26px 24px;">
    <p>Hey ${first},</p>
    <p>You're in! Your copy of <strong>The Spark</strong> is ready right now 👇</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${SITE_URL}/spark-course.html" style="background:#C8A24A;color:#0F2A1E;text-decoration:none;font-weight:bold;text-transform:uppercase;letter-spacing:1px;padding:14px 28px;border-radius:4px;display:inline-block;">Start The Spark →</a>
    </p>
    <p>Bookmark that link — it's yours for good. Work through the five shifts one at a time, together, and don't skip the toolkit exercises. That's where the real change happens.</p>
    <p>Questions along the way? Just reply to this email — you'll get us, not a bot.</p>
    <p>— Billy &amp; Maryruth</p>
  </div>
  <div style="background:#0F2A1E;padding:14px;text-align:center;">
    <span style="color:#C8A24A;font-size:12px;letter-spacing:2px;text-transform:uppercase;">EmptyNestMarriage.com</span>
  </div>
</div>`.trim();

    try {
      await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": postmarkToken
        },
        body: JSON.stringify({
          From: from,
          To: email,
          Subject: "You're in! Your Spark course access",
          HtmlBody: html,
          MessageStream: "outbound"
        })
      });
    } catch (e) {
      console.log("Postmark send failed:", e.message);
    }
  }

  // 2) Tag the buyer in Kit. Wrapped so a Kit hiccup never blocks delivery above.
  const kitKey = process.env.KIT_API_KEY;
  if (kitKey) {
    try {
      await fetch("https://api.kit.com/v4/subscribers", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json", "X-Kit-Api-Key": kitKey },
        body: JSON.stringify({ email_address: email, first_name: first })
      });
      await fetch(`https://api.kit.com/v4/tags/${KIT_SPARK_TAG_ID}/subscribers`, {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json", "X-Kit-Api-Key": kitKey },
        body: JSON.stringify({ email_address: email })
      });
    } catch (e) {
      console.log("Kit sync failed:", e.message);
    }
  }

  // 3) Record the purchase for Billy's own records.
  try {
    const store = getStore({
      name: "purchases",
      siteID: process.env.BLOBS_SITE_ID || process.env.NETLIFY_SITE_ID,
      token: process.env.BLOBS_TOKEN
    });
    await store.setJSON(`${email.toLowerCase()}-${session.id}`, {
      email,
      name: first,
      product: "The Spark",
      amountTotal: session.amount_total,
      sessionId: session.id,
      purchasedAt: new Date().toISOString()
    });
  } catch (e) {
    console.log("Could not record purchase:", e.message);
  }

  return { statusCode: 200, body: "OK" };
}
