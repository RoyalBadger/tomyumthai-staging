# Tom Yum Thai — Direct Ordering Platform: Revised Implementation Plan

**Decision record (2026-08-30):** Marketing site stays on WordPress.com at `mytomyumthai.com`.
The ordering system is a separate product at **`order.mytomyumthai.com`** (Vercel). The owner
accepts losing Aldelo/Masa+ POS integration in exchange for a native checkout, and may leave
Aldelo entirely later. Microsoft 365 SSO is dropped; manager access uses **password + TOTP MFA**
(authenticator app). Claude owns backend/coding; Gemini owns design/marketing (see `GEMINI_TODO.md`).

---

## Architecture

**Principle: boring, few vendors, server holds all truth.**

```
Customer browser ──> index.html (static, Gemini-styled)
                        │  fetch
                        ▼
                  /api/* (Vercel serverless functions, Node — Claude)
                        │
          ┌─────────────┼───────────────┐
          ▼             ▼               ▼
     Neon Postgres   Stripe        (Phase 4+) Twilio SMS
     (menu, orders,  (PaymentIntents,
      users, promos)  webhooks)

Manager browser ──> manager.html (static, Gemini-styled)
                        │  authenticated fetch (httpOnly session cookie)
                        ▼
                  /api/admin/* — server-enforced auth + TOTP
Kitchen station  ──> Chrome kiosk on tablet/PC → thermal printer
```

- **Front-ends stay single-file static HTML** (Gemini's lane). All logic that matters moves
  server-side. Front-ends call the API; they never hold secrets or compute prices.
- **Database: Neon Postgres** via the Vercel marketplace integration (one account surface).
  No Supabase/Firebase — fewer vendors, less to inherit.
- **Realtime = polling.** Kitchen queue polls `/api/admin/orders?since=` every 5–10 s with
  audio alert on new rows. Bombproof on a kitchen tablet, no websocket infra. SSE is a later
  upgrade if ever needed.
- **The kill switch (continuity requirement):** the WordPress "Order Now" buttons are the only
  coupling. If the ordering app ever breaks or nobody can maintain it, the family points those
  buttons back to Masa+/GrubHub and the business continues. The marketing site never depends
  on this codebase.

## Security model (non-negotiables)

1. Server recomputes every order total from DB menu prices — client-submitted amounts are
   display-only. Tax 8.25% (Garland) applied server-side. `DIRECT15` validated server-side.
2. Stripe Payment Element with PaymentIntents; card data never touches our code (PCI SAQ-A).
   Apple Pay / Google Pay come free with the Payment Element + domain registration.
3. Webhook (`payment_intent.succeeded`) with signature verification marks orders paid.
   An order is only shown to the kitchen after the webhook confirms payment (or is flagged
   `pay-at-store`).
4. Manager auth: email + password (argon2) + **TOTP** (RFC 6238, any authenticator app),
   httpOnly SameSite cookies, server-side sessions in Postgres, rate limiting on login and
   order creation. Every `/api/admin/*` route checks the session server-side. No client-side
   gates. Recovery codes generated at enrollment; at least two admin accounts (owner + one
   family member) so MFA loss ≠ lockout.
5. No secrets in the repo or HTML. Stripe/DB/Twilio keys live in Vercel env vars.
6. Customer PII (name, phone, address): retained 90 days then scrubbed by cron; never in logs.
7. The current `manager.html` with PIN 2005/"tomyum" in source is retired at Phase 2; until
   then the staging deployment gets an unguessable path or is taken down.

## Data model (Postgres)

- `menu_categories`, `menu_items` (name, description, price_cents, spice_selectable,
  is_86ed, sort), `item_options` (meat choice, add-ons)
- `orders` (id, public_code `TYT-YYYY-NNNN`, type pickup/delivery, status
  `pending_payment → received → cooking → ready → completed | canceled`, customer name/phone,
  address+notes, subtotal/discount/tax/delivery_fee/total cents, promo_code,
  stripe_payment_intent, pay_at_store bool, timestamps)
- `order_items` (order_id, item snapshot: name, price, qty, spice 1–5, exclusions text)
- `promo_codes` (code, percent_off, active, valid window)
- `admin_users` (email, password_hash, totp_secret, recovery_codes, role), `sessions`
- `settings` (store open/closed override, holiday dates, delivery radius miles, prep-time
  estimates) — replaces all localStorage state

## Phases

### Phase 0 — Setup (owner tasks, this week; nothing blocks the influencer campaign)
- [ ] Create Stripe account for the restaurant LLC (business verification + bank account —
      allow a few days). Enable Apple Pay in Stripe dashboard when prompted later.
- [ ] Identify the thermal printer make/model at the register (photo of the label is enough).
      Epson TM-series or Star = direct browser printing possible; anything else = kiosk mode.
- [ ] Confirm Claude can push to the `tomyumthai-staging` GitHub repo (or hand over the repo).
- [ ] Decide the second admin (family member) for the manager portal.
- [ ] Rename/remove the current public `manager.html` on staging.

### Phase 1 — Backend foundation (Claude)
- Restructure repo: `/public/index.html`, `/public/manager.html`, `/api/*`, `/lib/*`,
  `vercel.json` routes. Keep single-file front-ends intact for Gemini.
- Provision Neon Postgres through Vercel; migrations + seed script.
- Seed the real menu from the current To-Go menu PDF (owner reviews prices line-by-line).
- `GET /api/menu` (public, cached 60 s, respects 86/closed state).
- Wire index.html to render the menu from the API instead of hardcoded data.
- **Exit test:** 86 an item via SQL → customer page reflects it within a minute.

### Phase 2 — Auth + manager API (Claude; Gemini styles the screens)
- Login: password + TOTP; enrollment flow with QR code; recovery codes; sessions; rate limits.
- `/api/admin/*`: menu CRUD, 86 toggle, price edit, holiday/closed override, settings.
- Rewire manager.html to the API; delete all localStorage logic and hardcoded credentials.
- **Exit test:** manager 86's an item on a phone → customer site updates. Wrong TOTP blocked;
  API calls without a session return 401 (verified with curl).

### Phase 3 — Payments (Claude; Gemini styles drawer + confirmation)
- `POST /api/orders`: validate cart against menu, recompute totals, apply promo, create
  PaymentIntent, return client_secret. Idempotency keys.
- Payment Element in the checkout drawer (Apple Pay/Google Pay/cards in one component);
  `pay-at-store` path (order goes to kitchen unpaid, flagged).
- Webhook endpoint with signature verification; order state machine.
- Apple Pay domain association file on the ordering domain.
- Order confirmation + `GET /api/orders/:code` status page with prep-time estimate.
- **Exit tests:** Stripe test cards incl. 3DS challenge + decline; totals verified against
  hand-computed values (subtotal, DIRECT15, 8.25% tax, delivery fee); tampered client price
  rejected; webhook replay is idempotent.

### Phase 4 — Kitchen operations (Claude; Gemini designs queue cards + 80 mm receipt CSS)
- Kitchen queue: polling + audio chime, status buttons (received → cooking → ready →
  completed), bold red dietary exclusions.
- Printing, two tiers:
  a. **Universal:** 80 mm print-CSS receipt + Chrome kiosk (`--kiosk-printing`) on the kitchen
     device → silent print to the OS-installed thermal printer. Optional auto-print on arrival.
  b. **Direct (if Epson/Star):** ePOS-Print / WebPRNT — browser POSTs to the printer's LAN IP,
     no drivers, no dialog. Decided by Phase 0 printer answer.
- Optional: Twilio SMS "order ready" (adds a vendor — owner's call; can ship without it).
- **Exit test:** live dry-run during one dinner service, staff-only orders, before launch.

### Phase 5 — Launch
- DNS: add `order` CNAME → Vercel in WP.com DNS (MX/email records untouched).
- Live Stripe keys; small real-card test + refund test.
- WordPress "Order now" buttons → `order.mytomyumthai.com` (one consistent story; retire the
  GrubHub-vs-Masa+ split messaging, keep GrubHub listed only if the owner wants the channel).
- Bag insert + DIRECT15 promo go out (Gemini assets).
- Runbook: daily ops, refunds, "printer not printing," kill switch, Stripe payout schedule.
  Continuity sheet updated with Stripe/Neon/Vercel/GitHub accounts.
- Soft launch ≥1 week before promoting; watch first weekend service live.

## Explicitly deferred / out of scope
- **Email move from GoDaddy-resold M365 to direct Microsoft 365:** optional, unrelated now
  that SSO is dropped. Real migration (tenant defederation or new tenant + mailbox move + MX
  cutover). Do it, if desired, as its own carefully-scheduled project — never mid-launch.
- Delivery driver dispatch/tracking, loyalty accounts, tips pooling, gift cards.
- Refunds stay in the Stripe dashboard initially (runbook documents the 4 clicks).

## Accepted trade-offs (owner sign-off 2026-08-30)
- Orders no longer flow into Aldelo; kitchen works from the queue screen + printed tickets.
- Someone must watch/hear the queue during service; auto-print mitigates.
- This codebase requires a developer (or Claude session) to maintain; mitigated by the kill
  switch, the runbook, and keeping the marketing site fully independent on WordPress.
