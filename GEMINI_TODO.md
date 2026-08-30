# Gemini Work Order — Design & Marketing Lane

**Ground rules (read first):**
- You own **look, layout, copy, and marketing assets**. Claude owns everything in `/api`,
  all `<script>` business logic, auth, payments, and data.
- Never hard-code prices, menu items, credentials, or totals — the API supplies them.
  Style the containers; leave the IDs and `data-*` hooks exactly as specified below.
- Never add external JS libraries or payment/auth code. If a design needs behavior,
  describe it in a comment (`<!-- GEMINI: needs X on click -->`) and Claude wires it.
- Brand tokens (match the WordPress site): primary `#ec5a30`, foreground `#000`,
  background `#fff`, tertiary `#f2f7f8`. Keep fonts consistent between both HTML files.
- Deliver full files back; Claude integrates and re-adds logic. Don't rename files.

## A. Customer site — `index.html`
1. **Checkout drawer redesign** (replaces the Masa+ handoff): slide-out panel with
   order summary, name/phone/address fields, and these exact containers Claude will fill:
   - `<div id="payment-element"></div>` (Stripe renders Apple Pay/Google Pay/card here)
   - `<button id="place-order-btn">` (label shows live total — leave amount as
     `<span data-total></span>`)
   - `<div id="checkout-errors" role="alert"></div>`
2. **Order confirmation screen**: order code (`<span data-order-code>`), prep-time estimate
   (`<span data-eta>`), itemized list container (`<ul data-receipt>`), dietary exclusions
   styled bold red, tel: link to the restaurant.
3. **Order status page section** (`#order-status`): the four states received / cooking /
   ready / completed as a visual stepper.
4. **Menu rendering polish**: menu comes from the API into `<div data-menu-root>`; design
   the item card template (`<template id="menu-item-tpl">`) — spice selector 1–5, meat
   options, exclusions notes, 86'd style (grayed, "Sold out today").
5. Closed/holiday banner design (`#store-closed-banner`) and delivery-radius error state.
6. **"My orders" section**: phone sign-in (tel input + 6-digit code field `#otp-code`),
   order-history list (`<ul data-order-history>`), one-tap "Reorder" button per past order.
   Frame it as "See your past orders — verify your phone"; never the word "password".

## B. Manager portal — `manager.html`
1. **Login screen**: email + password + 6-digit TOTP code field (`#totp-code`), plus an
   enrollment view with a QR container (`<div id="totp-qr">`) and recovery-codes display.
   No "default PIN" hints anywhere.
2. **Kitchen queue tab**: order card design — big order code, items with spice level and
   bold red exclusions, elapsed-time badge, status buttons (Received → Cooking → Ready →
   Completed), unobtrusive "new order" visual pulse (audio is Claude's). All orders shown
   are already paid — no payment-status badge needed.
3. **80 mm thermal receipt template** (`<template id="receipt-tpl">` + `@media print` CSS):
   fits 80 mm width, large item text, huge spice/exclusion callouts, order code + phone,
   pickup vs delivery block. This is what the kitchen reads — clarity over beauty.
4. Keep/refresh the existing 86 toggles, price editor, and holiday calendar designs
   (they'll be re-wired to the API unchanged in structure).

## C. Marketing assets (independent of code)
1. Finalize the 4×6 bag insert (`insert.html`) with the DIRECT15 offer and
   `order.mytomyumthai.com` — no Masa+/GrubHub references.
2. DIRECT15 launch graphics: table tent, counter sign, IG story/post templates
   (1080×1920, 1080×1350) consistent with the bag insert.
3. Hero food-photography shot list for the WordPress site + ordering site (Khao Man Gai
   lead, Tom Yum hot pot steam shot, Pad Kee Mow wok shot, mango sticky rice) — natural
   window light, 9:16 and 3:2 crops.
4. "As seen on" / press strip design for the WordPress homepage (for the September
   influencer campaign results).
5. One consistent ordering story across every asset: **Order direct at
   order.mytomyumthai.com — save 15% with DIRECT15.** (No third-party app logos.)

## Sequencing
- Now: A1, A2, B1 (Claude needs these shells for Phases 2–3), C1.
- Next: B2, B3, A3–A5.
- Anytime: C2–C5.
