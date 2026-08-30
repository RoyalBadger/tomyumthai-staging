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
| `STRIPE_SECRET_KEY` | 3 | test key first (`sk_test_…`), live at launch |
| `STRIPE_WEBHOOK_SECRET` | 3 | from the Stripe webhook endpoint config |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_VERIFY_SID` | 5 | phone OTP |

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

- Prices seeded from **To-Go Menu Rev. 09-2025**. Review line by line before launch.
- **Hours conflict:** the menu PDF says Fri dinner 5–10pm and Sat–Sun 12–10pm; the website
  says 9:30pm close every day. Which is right? (Affects the ordering-hours logic AND the
  WordPress site.)
- Whole-fish specials are display-only online ("Market Price — call us").
- Glass Noodle Salad shrimp/seafood substitution is described in text; modeled as a plain
  item for now.
