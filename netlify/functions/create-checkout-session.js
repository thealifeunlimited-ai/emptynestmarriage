// Netlify Function: creates a Stripe Checkout Session for "The Spark" ($197 one-time)
// and returns the hosted checkout URL for the browser to redirect to.
//
// Requires env var (Netlify → Site configuration → Environment variables):
//   STRIPE_SECRET_KEY = your Stripe Secret Key (sk_test_... while testing, sk_live_... for real charges)

const SITE_URL = "https://emptynestmarriage.com";

export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { statusCode: 500, body: "Missing STRIPE_SECRET_KEY" };

  try {
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", `${SITE_URL}/spark-thank-you.html?session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${SITE_URL}/my-coaching-page.html#pricing`);
    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", "usd");
    params.append("line_items[0][price_data][unit_amount]", "19700");
    params.append("line_items[0][price_data][product_data][name]", "The Spark");
    params.append(
      "line_items[0][price_data][product_data][description]",
      "A self-paced digital course for empty-nest couples ready to reconnect. Includes the full Reignite course, 5 guided video sessions, date night & conversation toolkits, and lifetime access."
    );

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    const data = await res.json();
    if (!res.ok) {
      console.log("Stripe error:", data);
      return { statusCode: 502, body: "Stripe error: " + (data.error ? data.error.message : JSON.stringify(data)) };
    }

    return { statusCode: 200, body: JSON.stringify({ url: data.url }) };
  } catch (e) {
    return { statusCode: 500, body: "Error: " + (e && e.message ? e.message : String(e)) };
  }
}
