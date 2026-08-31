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

3. Verify: open `https://tomyumthai-staging.vercel.app/api/health` → should return
   `{"ok":true,"db":true,"menu_items":<count>}` and `/api/menu` → the full menu JSON.

## Environment variables (Vercel project settings)

| Var | Phase | Notes |
| --- | --- | --- |
| `DATABASE_URL` | 1 | set automatically by the Neon integration |
| `STRIPE_SECRET_KEY` | 3 | test key first (`sk_test_…`), live at launch. REQUIRED for /api/orders + webhook. |
| `STRIPE_PUBLISHABLE_KEY` | 3 | optional override; the test key is committed in lib/stripe.js (publishable keys are public by design) |

| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_VERIFY_SID` | 5 | phone OTP |
| `GOOGLE_DAILY_CAP` | 4 | optional; max Google distance calls per day across all visitors (default 500) — past it, labeled estimates serve instead. |
| `GOOGLE_MAPS_API_KEY` | 4 | driving-distance zone checks (/api/distance). Without it, distances are straight-line × 1.3 labeled "est.". Setup: console.cloud.google.com → new project → enable **Routes API** → billing → Credentials → API key → restrict to Routes API. |

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
