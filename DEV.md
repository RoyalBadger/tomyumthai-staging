# Developer setup & operations

## One-time setup (owner, ~10 minutes)

1. **Neon Postgres via Vercel:** Vercel dashboard → this project → Storage → Create Database
   → Neon (Postgres). Accept defaults. This injects `DATABASE_URL` into the project's
   environment variables automatically.
2. Pull the connection string locally for migrations/seeding: Vercel dashboard → project →
   Settings → Environment Variables → copy `DATABASE_URL`, then locally:

   ```powershell
   cd C:\Users\strip\tomyumthai-staging
   npm install
   $env:DATABASE_URL = "<paste connection string>"
   npm run migrate
   npm run seed
   ```

   (Day-to-day, `node db\migrate-with-env.mjs` replaces the manual paste — see
   "Routine operations" below.)

3. Verify: open `https://tomyumthai-staging.vercel.app/api/health` → should return
   `{"ok":true,"db":true,"menu_items":<count>}` and `/api/menu` → the full menu JSON.

## Environment variables (Vercel project settings)

| Var | Phase | Notes |
| --- | --- | --- |
| `DATABASE_URL` | 1 | set automatically by the Neon integration |
| `STRIPE_SECRET_KEY` | 3 | test key first (`sk_test_…`), live at launch. REQUIRED for /api/orders + webhook. |
| `STRIPE_PUBLISHABLE_KEY` | 3 | optional override; the test key is committed in lib/stripe.js (publishable keys are public by design) |

| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_VERIFY_SID` | 5 | phone OTP |
| `GOOGLE_MONTHLY_CAP` | 4 | optional; max Google distance calls per calendar month (default 9000 — below the free allowance, so the Google bill is $0 by construction). |
| `GOOGLE_DAILY_CAP` | 4 | optional; max Google distance calls per day across all visitors (default 500) — past it, labeled estimates serve instead. |
| `GOOGLE_MAPS_API_KEY` | 4 | driving-distance zone checks (/api/distance). Without it, distances are straight-line × 1.3 labeled "est.". Setup: console.cloud.google.com → new project → enable **Routes API** → billing → Credentials → API key → restrict to Routes API. |
| `OTP_DAILY_CAP` | 5 | optional; max Twilio Verify OTP sends per day site-wide (default 150). Past it, sign-in says "try later"; guest checkout is unaffected. Caps worst-case SMS spend under distributed abuse. |

Webhook: registered programmatically at `/api/stripe-webhook` for `payment_intent.succeeded`.
No signing secret needed — the handler re-fetches the PaymentIntent from api.stripe.com by id
and only trusts what Stripe returns (see api/stripe-webhook.js header comment).

Never put any of these in HTML/JS files. The browser only ever sees the Stripe
*publishable* key, which is designed to be public.

## Layout

```
index.html / manager.html / insert.html   ← static front-ends (Gemini's lane)
api/          ← Vercel serverless functions (Claude's lane)
lib/          ← shared server code (db pool, later: auth, pricing)
db/migrations ← numbered SQL migrations (append-only; never edit an applied one)
db/seed.mjs   ← real menu seed, idempotent (safe to re-run after price edits)
```

## Routine operations (CLI runners)

Both runners pull `DATABASE_URL` from Vercel themselves (`npx vercel env pull`), do their
job, and delete the pulled credentials file — no manual paste needed. Run from any cwd:

```powershell
node C:\Users\strip\tomyumthai-staging\db\migrate-with-env.mjs      # apply pending migrations
node C:\Users\strip\tomyumthai-staging\db\set-delivery-pause.mjs on  # pause direct delivery
node C:\Users\strip\tomyumthai-staging\db\set-delivery-pause.mjs off # resume direct delivery
```

- **Migrations before deploys:** run `migrate-with-env.mjs` BEFORE `git push` when a change
  adds a column the new code reads. (Settings reads are `SELECT *` and tolerate a missing
  column as feature-off, but don't rely on that for other tables.)
- **Delivery pause** (= the manager portal's "Pause Direct Delivery" toggle): while paused
  and the store is open, the customer site's Delivery tab becomes an outbound
  "Delivery by Grubhub" link, a banner shows, the checkout delivery radio is hidden, and
  `/api/orders` refuses delivery orders server-side. Pickup is unaffected. The public menu
  API is edge-cached ~60s, so allow a minute for customers to see a flip.
- These exact commands are allowlisted in the owner's Claude Code settings
  (`~/.claude/settings.json`) so Claude can run them without permission friction.

## Abuse guards & data retention (2026-09-02 hardening pass)

- **Google spend:** every path that can trigger a Routes API call (public /api/distance AND
  the order-time zone gate) checks the shared daily/monthly counters in
  `lib/auth.js googleSpendAllowed()`; past a cap, the labeled estimate serves. Console
  quotas + $10 budget alert remain the backstop.
- **Twilio spend:** per-phone 3/10min, per-IP 6/10min, plus the global `OTP_DAILY_CAP`.
  Owner console settings (manual): Verify **Fraud Guard** on, **Geo Permissions** US-only.
- **Client IP:** rate limits key on `x-real-ip` (set by Vercel, unspoofable) with
  x-forwarded-for as fallback.
- **Housekeeping (`lib/maintenance.js`,** fired after order creation, self-throttled ~4/day):
  abandoned checkouts cancel after 24h; never-paid canceled orders delete after 30 days;
  **PII retention scrub** — completed/canceled orders older than 90 days keep items/totals
  but lose name/phone/email/address (`pii_scrubbed_at` marks them). `orders.customer_id`
  is set for signed-in checkouts, so account order history survives the scrub (the history
  query matches customer_id OR phone). Rate-limit rows older than 45 days are purged.

## Menu price changes (until the manager portal ships in Phase 2)

Edit `db/seed.mjs`, re-run `npm run seed` (upserts in place), commit.

## Data notes / open questions for the owner

- Prices seeded from **To-Go Menu Rev. 09-2025**. Owner will review line by line before
  launch (confirmed 2026-08-30 — don't chase inconsistencies until then).
- **Hours resolved (owner, 2026-08-30): the PDF is right.** Lunch Tue–Fri 11–2:30;
  Dinner Mon–Thu 5–9:30, Fri 5–10; Sat–Sun 12–10. Encoded in migration 002 as
  `settings.business_hours`; WordPress site updated to match. Online ordering stops
  `last_order_buffer_minutes` (default 20) before close.
- Whole-fish specials are display-only online ("Market Price — call us").
- Glass Noodle Salad shrimp/seafood substitution is described in text; modeled as a plain
  item for now.
