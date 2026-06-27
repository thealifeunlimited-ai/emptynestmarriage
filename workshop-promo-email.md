# Workshop Promo Email — to Existing Subscribers

**Send to:** everyone currently in the drip sequence (subscribers store)
**Suggested send stream:** Postmark `broadcast` (so `{{{ pm:unsubscribe }}}` works, same as the drip follow-ups)
**Suggested timing:** ~3 weeks out, with a reminder email ~3-4 days before (see note at bottom)

---

## Subject Line Options

- We're hosting something — and we want you two there
- One evening. Just for you two. (Free, July 18)
- Save the date — Reconnect, July 18

## Preview Text

No pitch, no sales pressure. Just a real hour together, live on Zoom.

## Body

Hey {{first_name}},

We've got something for you — and it's not another email full of advice. It's an invitation.

On **Saturday, July 18 at 1:00 PM (Arizona Time)**, we're hosting a free live workshop called **"Reconnect: An Evening for Empty Nest Couples"** — over Zoom, just us and a group of couples in the exact season you're in.

Here's the honest pitch: it's one hour. We'll walk through 3 of the 5 "Reignite" shifts from your guide — live, out loud, with real talk instead of theory — and give you one conversation to try with your spouse that very night. No homework. No therapy-couch vibes. Just us, being real, like always.

**You'll walk away with:**
- A real conversation starter you can use at dinner that night
- The Reconnect Framework — the practical core of what we teach
- A little hope that this chapter can be your best one yet

It's free. It's live. And honestly? We'd just love to see you both there.

<p style="text-align:center;margin:24px 0;">
  <a href="https://emptynestmarriage.com/workshop.html#register" style="background:#C8A24A;color:#0F2A1E;text-decoration:none;font-weight:bold;text-transform:uppercase;letter-spacing:1px;padding:14px 28px;border-radius:4px;display:inline-block;">Save Our Spot — Free →</a>
</p>

Bring your spouse, bring a cup of coffee (or a glass of wine, no judgment), and give us one hour. We think you'll be glad you did.

— Billy & Maryruth

P.S. Can't make it live on the 18th but still want in? Register anyway — we'll make sure you're not left out.

---

### Footer (match drip.js compliance footer)

> You're getting this because you're part of our Empty Nest Marriage community. Not your thing anymore? [Unsubscribe here]({{{ pm:unsubscribe }}}) — no hard feelings.
> Billy & Maryruth Mitchell · PO Box 1107, Seligman, AZ 86337

---

## Implementation Note

This is a one-off broadcast, not part of the `SCHEDULE`/`FOLLOWUPS` drip in `drip.js` — it should be sent as a separate Postmark broadcast to everyone in the `subscribers` Blobs store (regardless of their current drip `step`), since it's a time-sensitive announcement rather than a sequence step. Consider a short follow-up reminder ("one week left!") sent the same way ~3-4 days before July 18 to the segment who haven't yet registered in the `workshop` store.
