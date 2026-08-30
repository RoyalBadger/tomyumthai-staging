# Design Request: Tom Yum Thai — 4 UI shells (checkout, confirmation, menu cards, kitchen queue)

You are doing the **visual design** for Tom Yum Thai's direct-ordering site in
`C:\Users\strip\tomyumthai-staging`. The backend (database, auth, Stripe payments, kitchen
API) is built, deployed, and tested by Claude. Your job is markup + CSS + copy. Claude
wires all behavior afterward.

## Hard rules — breaking these breaks the integration

1. **Do not write or modify any JavaScript logic.** In `manager.html` the `<script>` block
   is live production logic — leave it byte-for-byte untouched. In `index.html` you may
   remove/replace markup, but leave `<script>` blocks alone; Claude will reconcile.
2. **Keep every element id and `data-*` attribute named below exactly.** They are the
   contract Claude wires to.
3. No external JS libraries. Fonts via Google Fonts are fine.
4. Brand: primary `#ec5a30`, black/white base, tertiary `#f2f7f8`. Keep the existing
   customer-site look (Cinzel/Plus Jakarta Sans mix) consistent across all screens.
5. If a design needs behavior, mark it: `<!-- GEMINI: needs X on click -->`.
6. Deliver complete files back (same filenames). No placeholders like "…".

## Task 1 — Checkout drawer (`index.html`)

Slide-out panel replacing the current Masa+ handoff. Sections top to bottom:
- Order summary list (rendered by Claude) + editable promo row:
  `<input id="promo-code">` + `<button id="promo-apply">`
- Pickup/Delivery toggle: two radio inputs `#order-type-pickup`, `#order-type-delivery`;
  a delivery-only fieldset `#delivery-fields` containing `<input id="checkout-address">`
  and `<input id="checkout-notes">` (suite/apt/gate notes)
- Contact: `<input id="checkout-name">`, `<input id="checkout-phone">` (tel)
- Totals block with slots: `<span data-subtotal>`, `<span data-discount>`,
  `<span data-delivery-fee>`, `<span data-tax>`, `<span data-total>`
- Payment: an empty `<div id="payment-element"></div>` (Stripe injects Apple Pay/Google
  Pay/card UI here — design the frame around it, ~300px min height)
- `<div id="checkout-errors" role="alert"></div>` styled for error text
- `<button id="place-order-btn">Place Order · <span data-total></span></button>`

## Task 2 — Order confirmation view (`index.html`)

Shown after payment succeeds:
- Big order code `<span data-order-code>` (format `TYT-2026-0042`)
- ETA line `<span data-eta>` ("15–20 min")
- Status stepper `#order-status` with 4 steps: Received → Cooking → Ready → Done
  (each step: `<li data-step="received|cooking|ready|completed">`)
- Itemized receipt `<ul data-receipt>` — dietary exclusions styled **bold red**
- tel: link button to (214) 703-0391

## Task 3 — Menu item card template (`index.html`)

The menu now comes from an API (11 categories, 78 items). Provide:
- `<div data-menu-root></div>` where categories render
- `<template id="menu-item-tpl">` — one dish card with slots:
  `[data-name]`, `[data-thai]`, `[data-desc]`, `[data-price]`, `[data-price-note]`
  and a customization modal/area supporting: size pills (Small/Large, 16/32 oz),
  protein choice (Chicken/Pork/Tofu/Vegetable free; Beef +$3, Shrimp +$3, Seafood +$4),
  add-ons checkboxes, spice selector 1–5 (1 = Mild … 5 = Extremely Spicy),
  exclusions checkboxes (No Peanuts / No Egg / No Fish Sauce + free text), quantity.
- Sold-out state: grayed card with a "Sold out today" badge (`[data-sold-out]` element)
- Store-closed banner `#store-closed-banner` with message slot `[data-closed-message]`

## Task 4 — Kitchen queue tab (`manager.html`)

Add a "🔔 Live Orders" tab panel (`#tabOrders`, tab button included) designed for a
kitchen tablet at arm's length — big type, high contrast:
- Container `#queueList`
- `<template id="queue-card-tpl">` — one order card with slots:
  `[data-code]` (huge, e.g. TYT-2026-0001), `[data-type]` (PICKUP / DELIVERY badge),
  `[data-elapsed]` (e.g. "4 min ago"), `[data-customer]`, `[data-phone]`,
  `[data-address]` (delivery only), `[data-items]` (list; per item: qty × name, size,
  protein, add-ons, spice as 🌶×N, **exclusions huge bold red** — this is allergy safety),
  `[data-total]`, and three status buttons `[data-action="cooking"]`,
  `[data-action="ready"]`, `[data-action="completed"]` (show/hide handled by Claude).
- A subtle "new order" pulse style (class `is-new`) — audio is Claude's.
- Remember: every order shown is already paid. No payment badges needed.

## Delivery

Edit the files in place in `C:\Users\strip\tomyumthai-staging` (they're under git — Claude
diffs everything), or return full file contents. When done, note anything you wanted to
build but couldn't within these rules.
