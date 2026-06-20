// TEMPORARY test function — fires drip emails 2–5 on demand to ONE safe address.
// Guarded so it can never email anyone but the test address. Delete after testing.

import { FOLLOWUPS, sendEmail } from "./drip.js";

const TEST_ADDRESS = "billymitchell58@gmail.com";

export async function handler() {
  const token = process.env.POSTMARK_TOKEN;
  const from = process.env.FROM_EMAIL || "hello@emptynestmarriage.com";
  if (!token) return { statusCode: 500, body: "Missing POSTMARK_TOKEN" };

  const results = [];
  for (let i = 0; i < FOLLOWUPS.length; i++) {
    const fu = FOLLOWUPS[i];
    const r = await sendEmail(token, from, TEST_ADDRESS, fu.subject, fu.html("Billy"));
    results.push(`Email ${i + 2} ("${fu.subject}"): ${r.ok ? "SENT ✓" : "FAILED — " + r.error}`);
  }
  return { statusCode: 200, body: results.join("\n") };
}
