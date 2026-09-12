# Tom Yum Thai — Direct Online Ordering Platform: Complete Product Specification

Version 1.0 · 2026-09-12 · Derived from the shipped codebase (`tomyumthai-staging`, commit a3bc50f)

This document specifies the ordering platform for **Tom Yum Thai**, a family-run Thai restaurant at
3313 Belt Line Rd, Garland, TX 75044, phone (214) 703-0391. It is written so that an engineer or an
AI coding model can build a functionally equivalent system from scratch without access to the
original code. Everything below describes required behaviour; implementation hints are marked as such.

---

## 1. Goals, scope, and non-goals

**Goal.** Replace third-party checkout (Masa+, Grubhub) with a native, prepaid, direct-ordering site
that the family can run from a browser: customers order and pay online; the kitchen sees a live
queue and gets printed tickets automatically; managers control the menu, hours, and store state.

**In scope**

1. Public customer site: menu browsing, dish customization, cart, pickup or delivery, promo code,
   Stripe payment, order confirmation with live status, optional phone-verified account with
   order history and reorder.
2. Manager/kitchen portal: MFA login, live order queue with status lifecycle, ticket printing,
   menu editor (86, prices, photos, sizes, variants, modifiers, chef station), modifier catalog,
   hours, holidays, emergency pause, test mode, delivery pause, store settings, change-request inbox.
3. Server API: the only place money is computed; Stripe PaymentIntents + webhook; Twilio Verify
   OTP; driving-distance delivery-zone gate; rate limiting; audit log; PII retention.
4. Restaurant-PC print agent: prints receipt + kitchen tickets to two network thermal printers.

**Out of scope.** POS integration (Aldelo), driver dispatch, loyalty, gift cards, tips, refunds UI
(refunds are done in the Stripe dashboard), the marketing website (separate WordPress site).

**Non-negotiable principles**

- Server holds all truth. Front-ends never compute prices or hold secrets.
- Prepaid only. No order reaches the kitchen until Stripe confirms payment.
- Security over features. Rate limits, MFA, httpOnly cookies, audit trail, minimal dependencies.
- Boring, few vendors: Vercel (hosting + serverless), Neon Postgres, Stripe, Twilio Verify,
  Google Routes API (optional), Photon geocoder (free). No frameworks on the front-end.

---

## 2. System architecture

```
Customer browser ──► index.html (single static file: HTML+CSS+JS)
                        │ fetch JSON
                        ▼
                 /api/* Vercel serverless functions (Node 20+, ES modules)
                        │
      ┌─────────────────┼──────────────────┬──────────────────┐
      ▼                 ▼                  ▼                  ▼
 Neon Postgres       Stripe            Twilio Verify     Google Routes / Photon
 (menu, orders,   (PaymentIntents,    (customer OTP)    (delivery distance,
  users, settings)  webhook)                             geocoding)

Manager browser ──► manager.html (single static file) ──► /api/admin/* (session cookie + TOTP)
Restaurant PC   ──► print-agent (Node script) ──► polls /api/admin/orders?printer=1 ──► TCP 9100 ──► 2× Star TSP143 printers
```

- **Hosting:** Vercel. `vercel.json` = `{ "cleanUrls": true, "trailingSlash": false }`. Static files at
  repo root; each file in `api/` (and `api/admin/`) is one serverless function.
- **Function budget:** the Vercel Hobby plan allows **12 functions per deployment**; the build is
  exactly 12 (see §6). Related operations are folded into one function (e.g. login/me/logout are
  one file with GET/POST/DELETE). Pro plan removes the cap.
- **Realtime:** polling only. Kitchen queue polls every 7 s; customer status page polls; print agent
  polls every 4 s. No websockets.
- **Time zone:** all business logic in `America/Chicago`. Money is integer cents everywhere.
- **Dependencies:** only `pg`. Stripe, Twilio, Google are called with plain `fetch`. Password
  hashing (scrypt) and TOTP (RFC 6238) use `node:crypto`.
- **Caching:** `GET /api/menu` is edge-cached 60 s (`s-maxage=60, stale-while-revalidate=120`);
  dish photos cached 1 h browser / 1 day edge; everything else `no-store`.

---

## 3. Data model (Postgres)

All tables below are required. `text` ids are slugs. Timestamps are `timestamptz`.

### 3.1 Menu

| Table | Columns | Notes |
|---|---|---|
| `menu_categories` | `id text PK`, `name`, `sort int` | 11 seeded categories (Appendix A) |
| `menu_items` | `id text PK`, `category_id FK`, `name`, `thai_name`, `description`, `base_price_cents int NULL`, `price_note` (e.g. "Market Price — call us"), `protein_choice bool`, `extra_protein bool`, `spice_selectable bool`, `is_orderable bool`, `is_86ed bool`, `is_hidden bool`, `sort`, `station text CHECK IN ('main','second') DEFAULT 'main'`, `is_vegetarian bool`, `image_url text`, `removals_hidden text[]`, `removals_custom text[]` (legacy, unused) | `base_price_cents NULL` and no sizes ⇒ display-only item |
| `item_sizes` | `id serial`, `item_id FK cascade`, `label`, `price_cents`, `sort`, UNIQUE(item_id,label) | e.g. Small/Large soups, 16 oz/32 oz teas. Items with rows are multi-size; the size price replaces base price |
| `item_variants` | `id serial`, `item_id FK cascade`, `label`, `delta_cents DEFAULT 0`, `sort`, UNIQUE(item_id,label) | "Your Choice" pick-one options (Chicken/Pork/Vegetable rolls; Red/Green curry; Fried/Steamed). Required when present; may carry an upcharge |
| `protein_options` | `id text PK`, `label`, `delta_cents`, `sort`, `active` | Global list: Chicken 0, Pork 0, Tofu 0, Vegetable 0, Beef +300, Shrimp +300, Seafood +400, No Protein 0 |
| `extra_protein_options` | `id text PK`, `label`, `delta_cents`, `sort`, `active`, `option_group CHECK IN ('protein','vegetable')` | Extra Chicken/Pork/Tofu +200, Extra Mixed Veggies +200 (group vegetable), Extra Beef/Shrimp +300, Extra Seafood +400 |
| `modifiers` | `id serial`, `label UNIQUE`, `emoji`, `pattern` (JS regex used to auto-suggest), `extra_cents DEFAULT 100`, `active`, `sort` | Ingredient catalog: Peanuts, Egg, Onions, Bean Sprouts, Scallions, Tomatoes, Bell Peppers, Jalapeños, Basil, Broccoli, Carrots, Mushrooms, Cilantro, Cucumber, Cashews, Raisins, Pineapple, Potatoes, Bamboo Shoots, Zucchini, Cabbage, Celery, Garlic, Ginger |
| `item_modifiers` | `item_id FK`, `modifier_id FK`, `can_remove bool`, `can_extra bool`, `extra_cents int NULL` (per-dish override), `sort`, PK(item_id, modifier_id) | Per dish: customer may pick "No X" (free) and/or "Extra X" (+extra_cents, default from catalog) |
| `menu_item_images` | `item_id PK FK`, `data bytea`, `mime`, `updated_at` | Manager-uploaded photos stored in the DB, served by `/api/menu-image?id=` |

### 3.2 Orders

| Table | Columns |
|---|---|
| `orders` | `id uuid PK`, `public_code text UNIQUE` (`TYT-YYYY-NNNN`), `order_type CHECK IN ('pickup','delivery')`, `status CHECK IN ('pending_payment','received','cooking','ready','completed','canceled') DEFAULT 'pending_payment'`, `customer_id uuid NULL FK customers`, `customer_name NULL`, `customer_phone NULL`, `customer_email`, `sms_opt_in bool DEFAULT false`, `delivery_address`, `delivery_notes`, `subtotal_cents`, `discount_cents`, `tax_cents`, `delivery_fee_cents`, `total_cents`, `promo_code FK`, `stripe_payment_intent UNIQUE`, `paid_at`, `pii_scrubbed_at`, `printed_at`, `print_requested_at`, `created_at`, `updated_at` |
| `order_items` | `id serial`, `order_id FK cascade`, `item_id text` (reference only), `name`, `size_label`, `variant`, `protein`, `extras text[]` (labels), `spice_level int CHECK 1..5`, `exclusions text` (upper-cased, e.g. `NO PEANUTS, NO EGG`), `notes`, `unit_price_cents`, `qty CHECK 1..20`, `station CHECK IN ('main','second') NULL` |
| `promo_codes` | `code text PK` (uppercase), `percent_off 1..100`, `active`, `valid_from`, `valid_until` — seeded `DIRECT15` = 15 % |
| sequence `order_code_seq` | order number; code = `TYT-<Chicago year>-<seq padded to 4>` |

Order lines are **snapshots**: menu edits and deletions never rewrite history.

Indexes: `orders(status, created_at)`; partial `orders(created_at) WHERE status IN ('received','cooking','ready')`;
partial unprinted index `WHERE status IN (...) AND printed_at IS NULL`; `orders(customer_phone)`.

### 3.3 Customers (passwordless accounts)

| Table | Columns |
|---|---|
| `customers` | `id uuid PK`, `phone_e164 UNIQUE`, `verified_at`, `name`, `email`, `default_address`, `created_at`, `last_seen` |
| `customer_sessions` | `token_hash PK` (sha256 of cookie), `customer_id FK cascade`, `created_at`, `expires_at` (180-day sliding) |

### 3.4 Admin

| Table | Columns |
|---|---|
| `admin_users` | `id uuid`, `email UNIQUE`, `password_hash` (scrypt, format `scrypt$N$r$p$salt$hash`), `totp_secret` (base32), `recovery_codes text[]` (sha256 of 10-hex codes), `role CHECK IN ('owner','manager')`, `created_at`, `disabled` |
| `sessions` | `token_hash PK`, `admin_id FK cascade`, `created_at`, `expires_at` (12 h) |
| `admin_audit_log` | `id`, `admin_id NULL`, `action`, `target`, `detail jsonb`, `created_at` |
| `change_requests` | `id`, `admin_id`, `subject`, `details`, `status CHECK IN ('open','done','declined')`, `created_at`, `resolved_at` |
| `rate_limits` | `key PK`, `window_start`, `count` — fixed-window counters |

### 3.5 Settings (single row, `id boolean PK DEFAULT true CHECK (id)`)

| Column | Default | Meaning |
|---|---|---|
| `store_open_override` | `'auto'` | `auto` = follow hours; `closed` = emergency pause; `open` = test mode (ignore hours/holidays) |
| `closed_message` | NULL | custom text shown while paused/holiday |
| `holiday_dates date[]` | `{}` | closed all day |
| `business_hours jsonb` | see §5.1 | `{ "0".."6": [["HH:MM","HH:MM"],...] }`, 0 = Sunday |
| `last_order_buffer_minutes` | 20 | stop new orders this long before each close |
| `delivery_radius_miles numeric` | 5 | driving miles |
| `delivery_fee_cents` | 399 | |
| `delivery_minimum_cents` | 2000 | applies to subtotal − discount |
| `tax_rate_bps` | 825 | 8.25 % (Garland, TX) |
| `pickup_eta_minutes text` | `'15-20'` | |
| `delivery_eta_minutes text` | `'35-45'` | |
| `delivery_paused bool` | false | our drivers off-duty ⇒ site routes delivery to Grubhub |
| `print_agent_seen_at` | NULL | heartbeat from the print agent |

Every read of `settings` is `SELECT *` so a column and its migration can deploy in either order
(missing column ⇒ feature off).

---

## 4. Server API

All responses are JSON. Errors are `{ "error": "<customer-safe message>" }`. All `/api/admin/*`
routes set `Cache-Control: no-store` and return `401 {"error":"unauthorized"}` without a valid
admin session cookie. Bodies are JSON.

### 4.1 Public

**`GET /api/menu`** — the entire customer menu + store state. Edge-cached 60 s.
```
{
  accepting_orders: bool,
  closed_message: string|null,         // why not accepting
  next_open: {day_offset, weekday, time:"17:00", label:"today at 5:00 PM"}|null,
  hours: { "0":[["12:00","22:00"]], ... },
  etas: { pickup:"15-20", delivery:"35-45" },
  delivery: { radius_miles, fee_cents, minimum_cents, paused },
  options: {
    protein_choice: [{id,label,delta_cents}],
    extra_protein:  [{id,label,delta_cents,option_group}],
    spice_levels: [{level:1,label:"Mild Spicy"},{2,"Spicy"},{3,"Medium Spicy"},{4,"Very Spicy"},{5,"Extremely Spicy"}]
  },
  categories: [{ id, name, items:[{
      id, name, thai, description, price_cents|null, price_note,
      sizes:[{label,price_cents}], variants:[{label,delta_cents}],
      modifiers:[{id,label,emoji,can_remove,can_extra,extra_cents}],
      protein_choice, extra_protein, spice_selectable, image, orderable, sold_out }]}],
  allergy_note: "Menu items may contain egg, peanuts, tree nuts, wheat and seafood. Please note any food allergies on your order."
}
```
Hidden items are excluded; categories with no visible items are omitted. `orderable = is_orderable && !is_86ed`.
Store-state precedence: override `open` ⇒ accepting; override `closed` ⇒ not accepting with
`closed_message` or default "Online ordering is paused right now — please call us at (214) 703-0391.";
holiday today ⇒ not accepting, "We are closed today for a holiday. See you soon!" (+ `next_open`);
outside hours/buffer ⇒ not accepting with the reason message (§5.1) (+ `next_open`).

**`POST /api/orders`** — create a prepaid order. Rate limit 10 per IP per 10 min (429).
Request:
```
{ order_type:"pickup"|"delivery", promo_code?,
  customer:{ name, phone, email?, sms_opt_in?:bool },
  delivery?:{ address, notes?, lat?, lon? },
  items:[{ id, size_label?, variant?, protein?, extras?:[extraId], modifiers?:[{id, kind:"remove"|"extra"}],
           spice_level?, exclusions?, notes?, qty }] }
```
Server steps, in order (each failure returns the listed status):
1. Store must be accepting orders (same rules as `/api/menu`) else **409** with the closed message.
2. Validate contact: name 1–80 chars; phone normalised to E.164 US (`+1` + 10 digits, area code
   not starting 0/1) else **400** "Please enter a valid 10-digit US phone number."; email optional
   but if present must be valid.
3. Delivery: if `delivery_paused` ⇒ **409** "Our own delivery is paused for this shift. We can have your
   order ready for pickup in 15–20 minutes, or you can get delivery through Grubhub."; address required;
   run the **delivery-zone gate** (§5.3) ⇒ **409** "That address looks to be about N driving miles away —
   outside our R-mile delivery zone. We'd love to have your order ready for pickup instead!"
4. Price the cart (§5.2) ⇒ **400** with the CartError message on any invalid line. Total must be ≥ 50 ¢.
5. Insert `orders` (status `pending_payment`, code from the sequence) + `order_items` in one
   transaction; link `customer_id` only when a customer session cookie is present.
6. Create a Stripe PaymentIntent: `amount=total_cents, currency=usd, automatic_payment_methods.enabled=true,
   description="Tom Yum Thai <code> (<type>)", metadata={order_id, order_code}, receipt_email` if given;
   `Idempotency-Key: pi-<order id>`. On Stripe failure mark the order `canceled` and return **502**
   "Card processing is unavailable right now — please call us at (214) 703-0391."
7. Fire-and-forget maintenance (§5.6).
Response **200**:
```
{ order_code, client_secret, publishable_key, eta_minutes,
  totals:{ subtotal_cents, discount_cents, delivery_fee_cents, tax_cents, total_cents, promo_code } }
```

**`POST /api/stripe-webhook`** — Stripe `payment_intent.succeeded`. The payload is **not trusted**:
take only the `payment_intent` id, re-fetch it from `api.stripe.com` with the secret key, require
`status == "succeeded"`, then `UPDATE orders SET status='received', paid_at=now() WHERE id=metadata.order_id
AND stripe_payment_intent=pi.id AND total_cents=pi.amount AND status='pending_payment'`. Idempotent.
Return 200 for anything ignorable, 500 to make Stripe retry on transient errors. No signing secret needed.

**`GET /api/order-status?code=TYT-2026-0001`** — public, no PII (codes are sequential and guessable).
Returns `{order_code, order_type, status, created_at, total_cents, eta_minutes, items:[{name (with size), qty}]}`.
404 for unknown, canceled, or unpaid orders. Code must match `/^TYT-\d{4}-\d{4,}$/`.

**`GET /api/distance?lat=&lon=`** — driving miles from the restaurant + `in_zone`. Rejects points
> 100 mi away (400); 30 req / IP / 10 min. `{miles, source:"google"|"estimate", radius_miles, in_zone}`.

**`GET /api/menu-image?id=<item>`** — serves the uploaded photo bytes with its mime; 404 if none.

**`GET /api/health`** — `{ok:true, db:true, menu_items:N}`.

**`/api/me`** — customer portal, one function:
| Method | Body / query | Behaviour |
|---|---|---|
| POST | `{action:"start", phone}` | Twilio Verify SMS code. Limits: 3 / phone / 10 min, 6 / IP / 10 min, global `OTP_DAILY_CAP` (default 150) / day ⇒ 429 "Text sign-in is busy right now — you can still order as a guest, or try again later." |
| POST | `{action:"verify", phone, code}` | 6 attempts / phone / 10 min; on approval upsert `customers`, create a 180-day session, set cookie `tyt_csess` (HttpOnly; Secure; **SameSite=Lax** so the session survives a 3-D Secure redirect); return `{ok, customer:{name, phone, email, address}}` |
| GET | — | `{customer}` or 401 |
| GET | `?orders=1` | last 20 paid orders where `customer_id = me OR customer_phone = my phone` (guest orders included), each with item lines |
| PATCH | `{name?, email?, address?}` | update saved info |
| DELETE | — | log out |

### 4.2 Admin (session cookie `tyt_admin`, HttpOnly; Secure; SameSite=Strict; 12 h)

**`/api/admin/login`**
- `POST {email, password, totp}` — all three required. Rate limit 10 / IP / 15 min and 10 / email / 15 min
  (429 "too many attempts — try again in 15 minutes"). Verify scrypt password, then TOTP (6-digit,
  30 s step, ±1 window) **or** a one-time 10-hex recovery code (consumed on use). Every failure mode
  returns the identical 401 "invalid credentials". Audit `login_success` / `login_failed` / `login_rate_limited` / `recovery_code_used`.
- `GET` — `{email, role}` or 401. `DELETE` — logout.

**`/api/admin/orders`**
- `GET ?since=<iso>` — active orders (`received|cooking|ready`) plus `completed` in the last 2 h,
  oldest first, each with `items[]` (incl. `station`, default `main`). Returns
  `{now, new_since:<count of received orders paid after since>, print_agent_seen_at, orders}`.
- `PATCH {id, status}` — advance through the lifecycle (§5.4); 409 on illegal transition or if the row
  changed underneath (optimistic `WHERE status = <expected>`). Audit `status_change`.
- `PATCH {id, reprint:true}` — sets `print_requested_at = now()` (only for received/cooking/ready). Audit `reprint`.
- **Print-agent mode** (header `X-Print-Token: <PRINT_AGENT_TOKEN>`, compared in constant time; 401
  "bad print token" on mismatch): `GET ?printer=1` updates `settings.print_agent_seen_at` and returns
  up to 20 paid active orders where `printed_at IS NULL OR print_requested_at > printed_at`;
  `PATCH {id, printed:true}` sets `printed_at = now()`.

**`/api/admin/menu`**
- `GET` — every item incl. hidden (`{items, categories, modifiers}`), items carrying `sizes`, `variants`, `modifiers` assignments.
- `PATCH {id, is_86ed?, base_price_cents? (0..50000), is_hidden?, station?}` — quick toggles. Audit `menu_update` with before/after.
- `PUT` dish editor (create when `id` omitted; id = slug of name, de-duplicated with `-2`, `-3`…):
  `{id?, category_id, name (≤80), thai_name, description (≤400), base_price_cents|null, price_note, sizes:[{label,price_cents}] ≤6,
  variants:[{label,delta_cents}] ≤12 (0 or ≥2), modifiers:[{modifier_id,can_remove,can_extra,extra_cents|null}] ≤40,
  protein_choice, extra_protein, spice_selectable, is_orderable?, station, sort}`. Validation messages:
  "Dish name is required.", "Pick a category.", "Each size needs a label and a price.", "Duplicate size "X".",
  "A "Your Choice" list needs at least two options (or none).", "Enter a price, add sizes, or give a price note (e.g. "Market Price").",
  "Price must be between $0 and $500.", "Extra upcharge must be between $0 and $50.". Sizes/variants/modifiers are replaced wholesale in a transaction. Audit `item_create`/`item_update` with before/after.
- `PUT {kind:"category", id?, name}` — create (slug id, appended sort) or rename.
- `PUT {kind:"modifier", id?, label (≤40, unique case-insensitive), emoji, pattern (must compile as a regex), extra_cents 0..5000, active}`.
- `POST {id, mime, data_base64}` — dish photo: mime ∈ jpeg/png/webp, 1 KB < size ≤ 900 KB, magic bytes must
  match; stored in `menu_item_images`; sets `image_url = /api/menu-image?id=<id>&v=<timestamp>`.
- `DELETE ?id=<id>` photo; `?id=<id>&what=item` delete dish (transaction; history untouched); `?id=<n>&what=modifier`.

**`/api/admin/settings`**
- `GET` — the settings row. `GET ?requests=1` — change requests, open first, ≤200.
- `PATCH {store_open_override? ('auto'|'closed'|'open'), delivery_paused?, closed_message? (≤300), holiday_dates? (YYYY-MM-DD[]),
  last_order_buffer_minutes? (0..120), pickup_eta_minutes?/delivery_eta_minutes? (/^\d{1,3}(-\d{1,3})?$/),
  delivery_fee_cents?/delivery_minimum_cents? (0..20000)}`. Audit `settings_update`.
- `POST {subject (≤120), details (≤2000)}` — file a change request; optional outbound webhook
  `CHANGE_REQUEST_WEBHOOK` receives `{id, subject, details, by, site}` (best-effort, 4 s timeout).
- `PATCH {request_id, status:'open'|'done'|'declined'}` — resolve.

### 4.3 Environment variables

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres (SSL, verify-full) |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` | Stripe; publishable is returned to the browser |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SID` | Twilio Verify (OTP) |
| `GOOGLE_MAPS_API_KEY` | Routes API `computeRouteMatrix`; optional (fallback = estimate) |
| `GOOGLE_DAILY_CAP` (500), `GOOGLE_MONTHLY_CAP` (9000) | hard spend guards on Google calls |
| `OTP_DAILY_CAP` (150) | site-wide OTP send cap per day |
| `CHANGE_REQUEST_WEBHOOK` | optional notification URL |
| `PRINT_AGENT_TOKEN` | ≥ 32 random chars; shared with the restaurant PC |

No secret ever appears in HTML/JS or the repo.

---

## 5. Business rules

### 5.1 Hours and store state

Default hours (America/Chicago), `business_hours` JSON keyed by JS weekday:

| Day | Ranges |
|---|---|
| Sunday (0) | 12:00–22:00 |
| Monday (1) | 17:00–21:30 |
| Tue–Thu (2–4) | 11:00–14:30 and 17:00–21:30 |
| Friday (5) | 11:00–14:30 and 17:00–22:00 |
| Saturday (6) | 12:00–22:00 |

`orderingWindow(hours, buffer)` returns `{open, reason}` with reason ∈ `open | before_open | closed_now |
closing_soon | closed_today`; `open` is false during the last `last_order_buffer_minutes` (20) of each range.
Messages: closing_soon → "The kitchen is closing soon — online ordering has stopped for today. Please call (214) 703-0391.";
before_open → "We're not open yet — online ordering starts when the kitchen opens."; otherwise
"We're closed right now. See our hours below — come back soon!".
`nextOpening(hours, holidays)` searches ≤ 14 days ahead, skipping holidays, and returns the next range start
with a label "today at 5:00 PM" / "tomorrow at 11:00 AM" / "Tuesday at 5:00 PM". Customers may build a cart
while closed; checkout is blocked until `next_open`, and the page re-checks store status every 60 s and on tab focus.

### 5.2 Pricing engine (server, pure function)

Inputs: cart + DB context (items, sizes, variants, modifiers, protein/extra options, settings, promo).
Limits: ≤ 30 lines, qty 1–20 per line, notes/exclusions ≤ 200 chars, ≤ 5 extras, ≤ 20 modifiers, ≤ 8 add-on labels per line, subtotal ≤ $2,000.

Per line, in order:
1. Item must exist, not hidden ("An item in your cart is no longer on the menu."), orderable
   ("X can't be ordered online — please call us."), not 86'd ("X is sold out today.").
2. **Base price**: if the item has sizes, `size_label` is required and its price is the base ("Please pick a size for X.");
   otherwise `base_price_cents` (a size on a sizeless item is an error).
3. **Variant**: required if the item defines any ("Please make a selection for X."); adds `delta_cents`.
4. **Protein**: required if `protein_choice` ("Please pick a protein for X."); adds its delta; forbidden otherwise.
5. **Extras** (`extra_protein_options` ids): only if `extra_protein`; no duplicates; add deltas; record labels.
6. **Modifiers**: each must be assigned to the dish; `remove` requires `can_remove` and appends
   "<emoji> No <Label>" to the exclusions; `extra` requires `can_extra`, adds the per-dish override or catalog
   `extra_cents`, and appends "Extra <Label>" to the extras labels.
7. **Spice** 1–5 only if `spice_selectable`.
8. `exclusions` = removals + free-text exclusions, joined by ", ", upper-cased.
9. `unit_price = base + variant + protein + extras + extra-modifiers`; `subtotal += unit_price × qty`.

Order level: `discount = round(subtotal × percent_off / 100)` if the promo exists, is active and within
its window ("That promo code is not valid." otherwise); delivery requires `subtotal − discount ≥ delivery_minimum`
("Delivery orders have a $20.00 minimum.") and adds `delivery_fee`; **tax base = subtotal − discount + delivery fee**
(Texas taxes seller delivery charges); `tax = round(base × tax_rate_bps / 10000)`; `total = subtotal − discount + fee + tax`.
Worked example: $35.98 − 15 % ($5.40) = $30.58; tax 8.25 % = $2.52; total $33.10.

### 5.3 Delivery zone gate

1. Geocode the typed address with Photon (`photon.komoot.io`, biased to the restaurant, 3.5 s timeout),
   keeping only Texas results or anything within 60 mi; retry with the street portion (before the first comma) if nothing matched.
2. If geocoding fails, fall back to client-supplied `lat/lon` only if they are inside a sane box (lat 25–40, lon −110…−90).
3. If still unresolved, **fail open** (the kitchen sees the address on the ticket).
4. Driving miles = Google Routes `computeRouteMatrix` (`travelMode: DRIVE`) when the key is set **and** the daily/monthly spend
   counters allow; otherwise haversine × 1.3 labelled `estimate`.
5. Blocked when `miles > radius + 0.2`.
Restaurant coordinates: 32.94554, −96.67871.

### 5.4 Order lifecycle

`pending_payment → received` (webhook only) `→ cooking → ready → completed`; `received` and `cooking` may go to
`canceled`. No skipping, no backwards moves, kitchen can never touch `pending_payment`. Unpaid orders older than
24 h are auto-canceled; canceled never-paid orders older than 30 days are deleted.

### 5.5 Customer identity, sessions, and rate limits

- Guests: name + phone only; nothing stored beyond the order.
- Accounts: phone number is the identity; OTP via Twilio Verify; no passwords. 180-day sliding session.
- Admin: scrypt (N=16384, r=8, p=1, 64-byte key) password + mandatory TOTP; sessions stored server-side as sha256 hashes; 12 h.
- Rate limiting is a DB fixed window keyed by string (`login:ip:…`, `orders:ip:…`, `otp:phone:…`, `dist:ip:…`, `maintenance:daily`, `google-distance:daily:global`…).
- Client IP = `x-real-ip` (set by Vercel), never a client-supplied `X-Forwarded-For` prefix.

### 5.6 Maintenance and PII retention (opportunistic, ≤ 4 runs/day, triggered from `POST /api/orders`)

1. Cancel `pending_payment` orders older than 24 h.
2. Delete canceled, never-paid orders older than 30 days.
3. For completed/canceled orders older than **90 days**: null `customer_name`, `customer_phone`, `customer_email`,
   `delivery_address`, `delivery_notes`; set `pii_scrubbed_at`. Signed-in history survives via `customer_id`.
4. Delete rate-limit rows older than 45 days.

### 5.7 Audit log

Every admin mutation writes `admin_audit_log(admin_id, action, target, detail)`: `86_on/86_off` (via `menu_update`),
`price_change`, `status_change`, `reprint`, `item_create/update/delete`, `category_create/rename`,
`modifier_create/update/delete`, `image_upload/delete`, `settings_update`, `change_request`, `change_request_status`,
`login_*`, `recovery_code_used`.

---

## 6. Deployment layout

```
index.html        customer site          manager.html   manager/kitchen portal
insert.html       printable bag insert   privacy.html   privacy policy
sms-optin-proof.html  SMS consent proof page (for carrier review)
logo.svg, logo-header.png, favicon.png, apple-touch-icon.jpg, img/dishes/<id>.jpg
api/menu.js  api/orders.js  api/order-status.js  api/stripe-webhook.js  api/me.js
api/distance.js  api/health.js  api/menu-image.js
api/admin/login.js  api/admin/orders.js  api/admin/menu.js  api/admin/settings.js   (12 functions total)
lib/  db.js auth.js totp.js customer-auth.js pricing.js hours.js validate.js modifiers.js
      maintenance.js stripe.js distance.js order-status.js
db/migrations/NNN_*.sql (append-only, tracked in _migrations)  db/seed.mjs  db/create-admin.mjs
print-agent/  agent.mjs tickets.mjs config.example.json README.md
tests/  *.test.mjs (plain node scripts, PASS/FAIL lines; ~120 checks)
```

---

## 7. Customer site (`index.html`)

One static file (HTML + CSS + JS, no framework, no build step). It ships with **no menu data**; everything
orderable is fetched from `GET /api/menu` on load and rendered from a `<template>`. All prices shown before
checkout are estimates from the same data; the server recomputes at order time.

### 7.1 Head and brand
- Title "Tom Yum Thai Restaurant | Authentic Thai & Neighborhood Gem in Garland, TX Since 2005"; meta description
  mentions "since 2005", "famous Thai Chicken Rice (Khao Man Gai)", "5 spice levels", "Direct pickup & 5-mile delivery";
  canonical `https://mytomyumthai.com`; Open Graph title/description/type=restaurant/url.
- Assets: `/logo-header.png` (56 px tall wordmark, alt "Tom Yum Thai — Authentic Thai Cuisine"), `/favicon.png`, `/apple-touch-icon.jpg`.
- Fonts (Google): **Cinzel** 700/800 for hero/section/category titles, **Playfair Display** italic for Thai/secondary dish names,
  **Plus Jakarta Sans** 400–800 for everything else. Stripe.js v3 loaded from js.stripe.com.

### 7.2 Layout, top to bottom
1. **Sticky header** (75 px, blurred dark): logo + "Since 2005" sub-label; nav Menu / About Us / Hours & Location (hidden < 768 px);
   phone button "📞 (214) 703-0391" (`tel:`); "👤 Sign In" (becomes "👤 {FirstName}" when signed in); "🛒 Cart" with count badge.
2. **Hero**: h1 "Authentic Thai Flavors." and the **order dispatch card** "Choose Order Mode:" with two pill tabs
   "🛍️ Pickup (15–20m • Free)" (default) and "🛵 Delivery (5-Mile Zone)".
   - **Delivery-paused banner** (hidden unless `delivery.paused`): "🛵 Our Own Delivery is Off for this Shift — Grubhub Has You Covered"
     with link "Order Delivery on Grubhub ↗" (grubhub.com/restaurant/223816). While paused the Delivery tab reads
     "🛵 Delivery by Grubhub ↗", opens Grubhub in a new tab, and the mode stays pickup.
   - **Delivery box** (shown on the Delivery tab): timing select (ASAP (35–45 mins) + fixed evening slots; currently informational only),
     address input (placeholder "Type street name (e.g. Belt Line, Campbell, Jupiter, Shiloh, 75044…)") with autocomplete dropdown,
     **Verify** button, "Quick Pick:" chips (📍 Belt Line & Jupiter, 📍 Campbell & Shiloh, 📍 Firewheel Center, 📍 Zip 75044, 📍 Zip 75082),
     and a zone-status box.
3. **Trust bar** (four linked tiles, new tab): ⭐ 4.9 "900+ Ratings on Uber Eats"; ⭐ 4.8 "2,500+ Ratings on Grubhub";
   ⭐ 4.7 "1,000+ Ratings on DoorDash"; ⭐ 4.6 "750+ Google Reviews" (links to the respective listings / Google Maps).
4. **Menu section** `#menu`: line "Click below to explore, customize spice levels, and order direct."; a collapsible "Browse Our Menu"
   bar ("📖 Browse Our Menu ▼" / "🔼 Collapse Menu View ▲"); **category chips** (one per category from the API, the only category
   navigation: click expands the menu, filters, and smooth-scrolls to the category); **store-closed banner** (dark red, "⚠️" + message);
   **search input** (placeholder "Search dishes (e.g. Khao Man Gai, Pad Thai, Tom Yum, Curry, Tofu)…", substring match on card text,
   auto-expands categories, hides empty categories); then one collapsible section per category (gold Cinzel header "▼ {name}", "N dishes")
   holding a grid (`minmax(320px,1fr)`) of dish cards.
   - **Dish card**: title (parenthetical stripped and shown as an orange italic sub-line together with the Thai name, e.g. "Thai Chicken Rice"
     over "Khao Man Gai • ข้าวมันไก่"), price (first size price or flat price), optional price note, description, "Sold Out Today" badge,
     **Customize** button. The whole card is clickable when `orderable`; sold-out cards are 55 % opacity, grayscale, non-interactive.
   - A floating "▲ Categories" button appears while the chip bar is scrolled off-screen and the menu is on-screen.
5. **Story** `#story`: two tiles "Real Thai Heat / 5 Custom Spice Levels" and "Local History / Serving Garland Since 2005".
6. **Hours & Location** `#location`: tag "Dine In • Takeout • Delivery", title "Visit Us in Garland, TX", hours table
   (Mon 5:00–9:30 PM (Dinner); Tue–Thu 11:00 AM–2:30 PM | 5:00–9:30 PM; Fri 11:00 AM–2:30 PM | 5:00–10:00 PM; Sat & Sun 12:00 PM–10:00 PM (All Day)),
   address card with "📞 Call (214) 703-0391" and "🗺️ Get Directions in Google Maps".
7. **Footer**: Menu / About Us / Hours & Location / Privacy & SMS Policy (`/privacy`); "© 2026 Tom Yum Thai Restaurant. Garland's neighborhood Thai staple since 2005."
8. **Floating cart button** (fixed bottom): "🛒 Your Order (N)" + running total pill.

### 7.3 Dish customization modal (max-width 560 px, closes on scrim click, ×, or Escape)
Header: name + orange italic sub-line; optional photo (max-height 220 px, click opens a full-screen lightbox "Tap anywhere to close"); description.
Groups, each shown only when applicable, every radio group pre-selected:

| Group | Label | Rendering |
|---|---|---|
| Sizes | "Choose Size:" | radio pills "{label} — $X.XX", first selected |
| Variants | "Your Choice:" | radio pills, "(+$X.XX)" when delta ≠ 0, first selected |
| Protein | "Choice of Protein:" | radio pills from `options.protein_choice`, "(+$X.XX)" for Beef/Shrimp/Seafood, first selected |
| Spice | "Spice Level (1 Mild – 5 Extremely Spicy):" | pills "🌶️×n  n — {label}", **level 2 pre-checked** |
| Add-ons | "Optional Add-ons:" | checkboxes split under sub-headings **Proteins** and **Vegetables** (by `option_group`), "(+$X.XX)" |
| Extras | "Add Extra:" | checkbox per modifier with `can_extra`: "Extra {label} (+$X.XX)" |
| Removals + notes | "Dietary Exclusions & Kitchen Notes:" | checkbox per modifier with `can_remove`: "{emoji} No {label}"; text input placeholder "Special kitchen instructions (e.g. sauce on side)..." |
| Quantity | footer | − / + clamped 1–20 |
| Submit | footer | "Add to Order · $X.XX" or "Update Item · $X.XX" when editing a cart line |

Live price = size (or flat) price + variant delta + protein delta + checked add-ons + checked extras, × qty. Removals are free.
Cart line shape: `{id, name, size_label, variant, protein (option id), extras[ids], modifiers[{id, kind}], spice_level, exclusions "No X, No Y", notes, qty, unit_cents, display}`.

### 7.4 Cart drawer (right slide-out; opens automatically after adding)
Header "Your Order (Pickup)". Empty state "🛒 Your cart is currently empty. Click any dish above to customize and add!".
Line rows: name, extended price, and a modifier stack (📏 size, ✔️ variant, 🥩 protein, 🌶️ Spice N, ➕ extras, 🚫 EXCLUSIONS in red bold, 📝 "notes");
controls − / + (max 20; 0 removes), "✏️ Edit" (re-opens the modal pre-filled; submit replaces the line), "🗑️ Remove".
Promo input + **Apply**: the client only knows `DIRECT15` = 15 % for the estimate; the server validates. Totals table: Subtotal,
Promo Discount (only when > 0), Delivery Fee (5-Mile Zone) (delivery only, from `delivery.fee_cents`), Estimated Sales Tax (8.25%),
Estimated Total. Footer "🔒 Proceed to Secure Checkout" + "✓ Auto-prints modifiers & exclusions directly to kitchen printer".
While closed: yellow notice "⏰ We're closed right now. Your cart is saved — you can finish placing your order {next_open.label}." and the
button is disabled and reads "🔒 Checkout opens {label}" (or "🔒 Checkout paused").

### 7.5 Delivery address autocomplete and zone check
- Typing (≥ 3 chars, 300 ms debounce) queries Photon `https://photon.komoot.io/api/?q=<street>&limit=8&lat=32.94554&lon=-96.67871`
  (house number stripped before the query and re-attached), keeps Texas results, formats "{num} {street}, {city|Garland}, TX {zip}",
  sorts by straight-line distance, tags "≈ N.N mi", marks in-zone when ≤ 5.5 mi straight-line, and shows "· outside zone" in red otherwise.
  A local list of ~15 landmarks/zips also matches. No match ⇒ "📍 Use custom address: {query} / Click to verify".
- Picking a suggestion shows "⏳ Checking driving distance…" and calls `GET /api/distance` (driving miles; " est." when `source == 'estimate'`).
- Success: "✓ You are within our 5-Mile Delivery Zone! ({dist}) Estimated delivery: {etas.delivery} mins • Hot & fresh to your door."
  Failure: "⚠️ Outside our 5-Mile Local Delivery Radius ({dist}) We would love to prepare this for 🛍️ Pickup (Ready in {etas.pickup}m)!"
- The verified address is copied into checkout. The client check is advisory; the **server gate is authoritative** and the client passes
  `lat/lon` only as a geocoding fallback.

### 7.6 Checkout drawer and payment (two phases)
Contents: "🛍️ Review & Checkout"; Order Items list; promo input/Apply (synced with the cart); Pickup/Delivery radios (Delivery hidden while paused);
delivery-only fields "Street Address, City, Zip" and "Apt / Suite / Gate Code / Drop-off Notes"; Contact Details: Your Name, Mobile Phone,
"Email (optional — for your receipt)"; SMS opt-in checkbox (unchecked) "Text me updates about this order (confirmation & ready alert).
Msg & data rates may apply. Reply STOP to opt out. SMS & Privacy Policy"; totals; payment area ("Payment form appears after you press
"Continue to Payment"."; "Payment (Apple Pay / Google Pay / Card):"; "🔒 Payments are securely processed by Stripe — your card details never touch our servers.").
Signed-in customers get name/phone/email/address prefilled.
1. **Continue to Payment · $X** → POST `/api/orders`. Errors show the server message. On success: store the order code in
   `sessionStorage.tyt_last_order`, replace the displayed totals with the server's, mount the Stripe **Payment Element**
   (theme night, colorPrimary `#ec5a30`, accordion layout expanded), relabel "🔒 Pay $X.XX".
2. **Pay** → `stripe.confirmPayment({ elements, confirmParams:{ return_url: origin+pathname }, redirect:'if_required' })`.
   On error show the message and relabel "🔒 Try Payment Again". Redirect-based methods return to the page with
   `payment_intent_client_secret` in the URL; the page scrubs the query and shows the confirmation for the saved code.

**Confirmation overlay**: "🎉 Order Confirmed!", "Thank you for ordering direct from Tom Yum Thai.", "Order #{code}",
"Estimated Ready: {eta} min", status stepper 🟡 Received → 🍳 Cooking → 🟢 Ready → ✓ Done (polls `GET /api/order-status` every 10 s until
completed), itemized receipt (exclusions as red tags), "📞 Call Store: (214) 703-0391". The cart is cleared. Signed-in users get their
saved info PATCHed silently.

### 7.7 Store state and freshness
`accepting_orders`, `closed_message`, `next_open`, `delivery.paused` come from `/api/menu`. Closed banner text = closed_message +
" You can add dishes to your cart now and finish placing your order {next_open.label}." The page re-fetches `/api/menu` (no-store)
every 60 s and on tab focus and re-renders only when state changed. Menu load failure: "The menu could not be loaded — please refresh, or call (214) 703-0391."

### 7.8 Customer account modal (520 px)
Step 1 "Sign In / Sign Up": "Enter your mobile number and we'll text you a 6-digit code. No passwords, ever." → **Text Me a Code**.
Step 2 "Enter Your Code": "We texted a 6-digit code to {phone}." numeric input (`autocomplete=one-time-code`) → **Verify & Sign In**;
"Use a different number". Account view: "Hi, {First}!" / "Signed in as {phone}"; **Saved Info (prefilled at checkout)**: Name, Email (for receipts),
Delivery address, **Save Info**; **Log Out**; order history list (code, total, date, type, status, items) each with
"🔄 Reorder — current prices" which rebuilds cart lines at today's prices, skipping unavailable dishes, and toasts
"N items added to your cart (M no longer available)." Toasts: "Signed in! Your info will prefill at checkout.", "Saved.", "Logged out."

### 7.9 Persistence
`localStorage.tyt_cart_v1 = {t, lines}` written on every cart render, ignored after 24 h, re-validated against the live menu on load,
cleared when an order is placed. `sessionStorage.tyt_last_order` holds the order code for redirect recovery. Nothing else is stored.

### 7.10 Design tokens
`--bg-base #1a1d24`, `--bg-surface #222731`, `--bg-card #2a313e`, hover `#323b4b`, `--accent-orange #ff781f` (hover `#e65c00`, light `#ffebd9`),
`--accent-green #22c55e`, `--accent-gold #f5b041`, `--accent-red #ef4444`, text `#ffffff` / muted `#cbd5e1` / dim `#94a3b8`,
borders `rgba(255,120,31,.25)` and `rgba(255,255,255,.12)`; radii 6/12/18 px; shadows `0 4px 12px rgba(0,0,0,.25)` and `0 14px 35px rgba(0,0,0,.45)`;
primary gradient `linear-gradient(135deg,#ff781f,#e65c00)`; container 1200 px; hero title `clamp(28px,4.5vw,48px)`; one breakpoint at 768 px.
Z-index ladder: header 1000, checkout 10000, modals 10500, lightbox 11000, toast 12000.

### 7.11 Companion pages
- **`/privacy`** "Privacy & SMS Policy" (effective August 31, 2026): SMS program "Tom Yum Thai Order Updates", transactional only,
  1–3 messages per order, STOP/HELP, consent recorded with the order and not a condition of purchase; data collected (order, name, phone,
  optional email/address; card handled by Stripe); no sale/sharing of phone or opt-in data; **guest contact details kept up to 90 days**,
  account data kept while active and deletable on request; cart stored locally, expires after 24 h, no tracking cookies.
- **`/insert`** printable 4×6 in takeout-bag postcard (front: brand, "SAVE 15% … Use Promo Code: DIRECT15", order QR placeholder, address/phone;
  back: fan favourites, "Why Order Direct", hours, review QR placeholder). Print CSS forces 4in×6in pages.
- **`/sms-optin-proof`** static screenshot page of the consent checkbox for carrier review.

---

## 8. Manager / kitchen portal (`manager.html`)

Single static file, dark theme, no framework. Title "Store Manager Portal | Tom Yum Thai Restaurant".

### 8.1 Login and session
- Card (max 420 px): 🏮, "Store Manager Portal", "Tom Yum Thai Restaurant • Garland, TX", fields Email, Password,
  Authenticator Code (numeric, placeholder "6-digit code (or a recovery code)"), button "🔒 Sign In" ("Signing in…" while pending).
  Errors: red banner "⚠️ {message}".
- Success → GET login (me) → dashboard header "🏮 Tom Yum Thai — Store Manager Portal", "Signed in as {email (role)} • Garland, TX",
  "🌐 View Customer Site" (opens `/`), "🚪 Log Out". Page load probes GET login; any 401 returns to the login screen. No token in JS.

### 8.2 Tabs: 🔔 Live Orders · 📋 Menu & 1-Click 86 · 🧩 Modifiers · 🕒 Hours & Ordering · 🗓️ Holiday Closures · ⚙️ Store Settings · 📨 Change Requests
On load, GET admin/menu and GET admin/settings run in parallel and populate everything.

### 8.3 Live Orders
- Header "🔔 Kitchen Live Orders Queue" / "Real-time tablet queue for kitchen woks. All orders shown are prepaid."
- **Auto-print pill**: "🖨️ Auto-print online" (green) when `print_agent_seen_at` < 30 s old; "🖨️ Auto-print OFFLINE (last seen N min ago)" (red);
  "🖨️ Auto-print not set up" when null.
- **Polling**: immediately, then every 7 s, GET admin/orders `?since=<previous server now>`; if `new_since > 0` play a two-tone chime
  (Web Audio 880 Hz then 1174 Hz after 250 ms, 0.8 s decay). Errors silent.
- **Cards** (grid min 320 px): active first, completed after at 45 % opacity. A `received` order paid < 2 min ago pulses orange.
  Contents: order code (monospace 20 px) + chip "PICKUP • RECEIVED"; elapsed ("Just now", "N min ago", "Hh Mm ago") in gold; customer name;
  phone as `tel:` link; delivery line "🛵 {address} — {notes}" in amber; item rows "{qty}× {name} ({size})" with meta line
  "variant • protein 🌶🌶 Lv2 • +extras" and "📝 notes"; **allergy callout**: when `exclusions` is set, a large bold red uppercase box
  "⚠ {EXCLUSIONS}"; footer "Paid: $total".
- **Lifecycle**: exactly one of "🍳 Start Cooking" (blue), "✓ Mark Ready" (green), "Archive / Done" (slate) is visible for the next status;
  PATCH `{id,status}`; toast "Order moved to {status}."; completed orders show only the print button.
- **Print button**: agent online and order not completed → "🖨️ Reprint Tickets" (PATCH `{id, reprint:true}`, toast
  "Tickets for {code} sent to the printers."); otherwise "🖨️ Print (browser)" → `window.print()` of the three-ticket template.
- **Browser print template** (`@media print`): only `#print-root` visible, 72 mm wide, Courier New 11 pt. Ticket 1 receipt:
  "TOM YUM THAI", address, phone, `====` rule, boxed order type, code 18 pt, Chicago time, customer name/phone/address, items,
  Subtotal (= subtotal − discount), Tax (8.25%), TOTAL, "*** PAID ONLINE — DIRECT ***". Tickets 2–3: "** CHEF 2 **"
  (items with station `second`) and "** MAIN KITCHEN **" (others): double-ruled banner, code, type, time, items without prices, customer name;
  empty ones skipped; `page-break-after: always` so the cutter separates tickets. Item line "{qty} x {name} ({size})", detail
  "variant - protein - SPICE LV n - +extras", "*** {EXCLUSIONS} ***" bold underlined, "NOTE: {notes}".

### 8.4 Menu & 1-Click 86
- Header "Menu Items (N)", buttons "➕ Category", "➕ Add Dish". Copy: "86 a sold-out dish, change a price, or open ✏️ Edit to change anything a
  customer sees — name, description, sizes, choices, add-ons, removals. The customer site updates within a minute. Every change is logged."
- Table grouped by gold category rows. Columns: Dish (name + price note); Category; Price ($) inline number input (blur ⇒ PATCH `base_price_cents`;
  "market" when null); Stock pill "🟢 In Stock" ⇄ "🔴 86 — Sold Out" (one click, no confirm); Chef Station pill "👨‍🍳 Chef 1" ⇄ "👨‍🍳 Chef 2";
  Photo "⬆ Upload" / "📷 Replace" + "✕"; Actions "✏️ Edit", "Hide"/"Show" (hidden rows at 45 % opacity).
- **Photo upload**: canvas downscale to ≤ 900 px, JPEG q 0.82, POST base64; toast "{dish} photo saved — customers see it within a minute."
  Delete uses the app's only native confirm: "Remove the photo for {name}? The Photo button disappears from the customer site."
- **Dish editor modal** ("Edit Dish" / "Add a New Dish"): Dish name*, Category*, Thai name, Description, Price ($, ≤ 500), Price note
  ("Market Price — call us"; note without price ⇒ display-only), Chef station, Position 0–999; checkboxes Protein choice
  ("Chicken / Pork / Tofu / Vegetable / No Protein, Beef +$3, Shrimp +$3, Seafood +$4"), Add-ons ("Extra Chicken / Pork / Tofu / Mixed Veggies +$2,
  Extra Beef / Shrimp +$3, Extra Seafood +$4"), Spice level ("1 Mild to 5 Extremely Spicy"); Sizes rows (label + price, ≤ 6);
  "Your Choice" rows (label + upcharge, ≤ 12, 0 or ≥ 2); Ingredient modifiers from the catalog: attach checkbox, "No {label}" and
  "Extra {label}" checkboxes, per-dish extra price (enabled only with Extra; blank = catalog default), "✨ Add ingredients found in the description"
  (regex per modifier over name + description), hint "{n} ingredient(s) mentioned in the description not offered yet.", gold "in description" chips;
  **live preview** "Customer sees: {name} — {price | priced by size | note (display only) | no price yet}" with Size / Your Choice / Protein / Add-ons /
  Spice / "Leave out: …" / "Add extra: … +$n" lines or "Nothing to pick — the dish adds straight to the cart (kitchen notes are always available)."
  Footer: "🗑 Delete dish" (two-click within 5 s: "⚠️ Click again to delete permanently"), Cancel, "💾 Save dish".
  Toasts "Saved {name}." / "Added {name}." / "Deleted {name}. Past orders keep their own copy of it."
- **New Category modal**: one field; toast "Category "{name}" added — it shows on the customer site once it has a dish."

### 8.5 Modifiers
Header "🧩 Modifiers (N)"; copy "One shared list of ingredients. On each dish you pick which of these the customer may leave out (free) or add extra
(charged). Set the default 'Extra' price here; a dish can override it."; "➕ New modifier" inserts an unsaved top row ($1.00, active).
Inline-editable columns: Emoji (≤ 8), Ingredient (≤ 40), Extra price ($), Auto-detect regex (≤ 120, monospace), Used by "N dishes" (client-computed),
Active, "💾 Save", "🗑 delete" (two-click: "⚠️ Remove from N dish(es)? Click again"). Footnote: customers see "No Peanuts" / "Extra Peanuts (+$1.00)".

### 8.6 Hours & Ordering
- Read-only hours table (Sunday first): "11 AM – 2:30 PM and 5 PM – 9:30 PM" or "Closed" (hours change via Change Requests).
- "Stop new orders this many minutes before close:" number 0–120 + Save → toast "Last-order buffer saved: N minutes before close."
- **⚠️ Emergency: Pause ALL Online Ordering** (red): "Instantly stops new online orders (kitchen slammed, out of rice, no driver). Phone and walk-in
  service are unaffected." Buttons "🔴 Pause Online Ordering" / "🟢 Resume Online Ordering" (override closed ⇄ auto).
- **🛵 Pause Direct Delivery (Grubhub takes over)** (blue): "Use when no driver is on shift. Pickup ordering stays open; the Delivery button on the
  site becomes a 'Delivery by Grubhub' link." Buttons "🛵 Pause Direct Delivery" / "🟢 Resume Direct Delivery".
- **🧪 Test Mode: Ignore Business Hours** (yellow): "Lets you place test orders at any hour — the site behaves as if the store is open. Remember to
  turn this OFF before real service." (override open ⇄ auto). Toast "TEST MODE ON — the site now accepts orders at any hour. Turn this off before real service!"

### 8.7 Holiday Closures
Date input + "+ Add Closure" ("Pick a date first."), sorted YYYY-MM-DD table with Remove; whole array PATCHed each time.
Copy: "Online ordering is refused all day on these dates, and customers see the closed message from Store Settings."

### 8.8 Store Settings
Delivery Fee ($) "Charged on 5-mile local delivery orders."; Delivery Minimum ($) "Smallest order we deliver."; Pickup ETA (minutes) "15-20";
Delivery ETA (minutes) "35-45"; Closed Message (≤ 300) "(shown when ordering is paused or on holidays)"; read-only "Direct-Order Promo:
DIRECT15 — 15% off — Validated at checkout on the server. Printed on the takeout bag insert." "💾 Save Settings" → "Store settings saved."

### 8.9 Change Requests
Copy: "Anything beyond the menu — site design, wording, photos, new features, hours on the website — send it here. The web admin reviews every
request before anything changes." Form: subject* (≤ 120, placeholder "e.g. Add a photo of the new patio to the home page"), details (≤ 2000),
"📨 Send request" → "Request sent to the web admin." Table: Date "Mon D, YYYY", Request (subject + details), By (email), Status chip open/done/declined
(gold/green/grey), actions "✓ Done" + "Decline" (open) or "Reopen".

### 8.10 Toasts and tokens
Toast bottom-right 3.5 s: success "✓ " (#14532d / #22c55e / #86efac), error "✗ " (#7f1d1d / #ef4444 / #fca5a5). Destructive actions use two-click
arming, never browser dialogs (except photo delete). Tokens: `--bg-dark #0f1218`, `--bg-panel #181c26`, `--bg-card #222735`, orange `#ff781f`
(hover `#e65c00`, gradient buttons), green `#22c55e`, red `#ef4444`, gold `#f5b041`, text `#fff` / muted `#94a3b8`; font Plus Jakarta Sans;
content max-width 1100 px; Chef 2 pill indigo `#312e81/#c7d2fe`; Start Cooking `#3b82f6`; Archive `#64748b`; new-order pulse `#ec5a30`.

---

## 9. Print agent (restaurant PC)

Node 20+ script, no dependencies, installed as a Windows scheduled task (runs at startup as SYSTEM, restarts on failure).
Config `config.json`: `server`, `token`, `printers: {counter, kitchen}` (IPs), `port 9100`, `pollSeconds 4`, `receipt: all|pickup|delivery|none`,
`kitchenCopies 1`, `emulation: star|escpos`, `columns 48`, `storeName`.

Loop every 4 s (exponential backoff 5→60 s on server errors): GET `/api/admin/orders?printer=1` with `X-Print-Token`; for each order build
raw **Star Line Mode** bytes (ESC @ init; ESC GS a n align; ESC i h w size; ESC E/F bold; ESC 4/5 inverse; ESC d 3 feed + partial cut; ESC/POS
profile: ESC a, GS !, ESC E n, GS B, GS V 42 0) and send over TCP 9100:
- **Receipt → counter**: store name 2×, order code at 3× height / 2× width, order type 2×, time, `====`, customer name (bold), phone,
  "DELIVER TO: …" + notes for delivery, items (name 2× height bold; detail line; "*** EXCLUSIONS ***" 2×2 bold; "NOTE: …"), `----`,
  Subtotal / promo line / Delivery fee / Tax / TOTAL (bold, 2× height, right-aligned), "PAID ONLINE", "Thank you!", cut.
- **Kitchen tickets → kitchen** (one connection, concatenated): inverse banner "** CHEF 2 **" then "** MAIN KITCHEN **" (skip empty), code 3×2,
  type, time, `====`, items (no prices), `====`, customer name, cut each.
- Text is ASCII-sanitised (accents stripped, emoji removed), word-wrapped to 48 columns (24 at double width).
- On success PATCH `{id, printed:true}`. Partial success is persisted in `state.json` keyed by `orderId:print_requested_at` so a retry prints
  only the failed half; log lines to `agent.log` (rotated at 5 MB). `node agent.mjs test` prints a TEST ticket to each printer and checks the server.

---

## 10. Non-functional requirements and security checklist

1. All money computed server-side from DB rows; client totals are labelled "Estimated".
2. Stripe: PaymentIntent per order, idempotency key `pi-<order id>`, automatic payment methods (cards, Apple Pay, Google Pay, Link, Cash App…),
   card data only inside Stripe's iframe (PCI SAQ-A). Webhook re-fetches the PaymentIntent; matches order id, intent id, amount, and status.
3. Admin auth: scrypt + mandatory TOTP or recovery code; identical error for every failure; 10 attempts / 15 min per IP and per email; httpOnly
   Secure SameSite=Strict cookie; server-side session hashes; 12 h expiry; every mutation audited.
4. Customer auth: Twilio Verify OTP; per-phone, per-IP and global daily caps; 180-day httpOnly SameSite=Lax cookie; a customer can only read
   orders tied to their verified phone.
5. Public order status exposes no PII (codes are guessable).
6. Rate limits: orders 10 / IP / 10 min; distance 30 / IP / 10 min; OTP 3 / phone and 6 / IP / 10 min; login 10 / 15 min.
7. Google spend guards: daily 500 and monthly 9,000 calls; beyond that use estimates. Distance endpoint rejects points > 100 mi away.
8. PII retention 90 days for completed/canceled orders; canceled unpaid purge 30 days; unpaid auto-cancel 24 h.
9. Uploads: ≤ 900 KB, jpeg/png/webp only, magic-byte check, client downscale.
10. Migrations append-only and tracked; settings reads tolerate missing columns; deploys must be safe in either order.
11. Front-ends are single files with no build step so a non-developer can edit copy; no secrets or prices in them.
12. Zero third-party npm packages beyond `pg`.
13. Kill switch: the marketing site's "Order" buttons can point back to Grubhub/Masa+ at any time.

---

## 11. Acceptance tests (must pass)

- **Menu**: 86 a dish in the portal → it shows "Sold Out Today" and is unorderable on the customer site within 60 s; hidden dishes vanish;
  a category with no dishes is not listed.
- **Pricing**: $35.98 cart with DIRECT15 and 8.25 % tax totals $33.10 (discount $5.40, tax $2.52); delivery adds $3.99 and is taxed; delivery under
  $20 after discount is refused; tampered client prices are ignored; unknown modifier/extra/protein/size are rejected with the listed messages.
- **Hours**: outside hours or within 20 min of close → 409 with the correct message and `next_open` label; holiday → closed all day; override
  `closed` and `open` behave as specified; the customer can still build a cart while closed.
- **Payment**: order created as `pending_payment`; webhook with a forged intent id is ignored; a succeeded intent flips exactly once to `received`
  (replay is idempotent); mismatched amount does not flip.
- **Kitchen**: new paid order appears within one poll with a chime; lifecycle refuses skips and backwards moves; concurrent taps lose cleanly with 409.
- **Delivery zone**: an address 6.6 driving miles away is refused even though it is 5.1 straight-line miles; an unresolvable address is allowed.
- **Accounts**: OTP brute force blocked; customer A cannot read customer B's orders; history includes past guest orders on the same phone;
  reorder skips unavailable dishes and uses current prices.
- **Printing**: with the agent online each paid order prints one receipt at the counter and CHEF 2 + MAIN KITCHEN tickets in the kitchen exactly
  once; Reprint prints again; agent offline → pill turns red within 30 s and the portal button falls back to browser print.
- **Security**: every `/api/admin/*` call without a cookie → 401; wrong TOTP → 401 "invalid credentials"; 11th login attempt → 429;
  `X-Forwarded-For` spoofing does not bypass IP limits.

---

## Appendix A. Seed data (live menu snapshot, 2026-09-12)

Delivery: radius 5 mi, fee $3.99, minimum $20.00. ETAs: pickup 15–20 min, delivery 35–45 min. Promo: DIRECT15 = 15 %.
Categories in order: Signatures & Chef's Specials, Appetizers, Thai Salads, Thai Soups, Noodles, Stir Fried, Fried Rice, Thai Coconut Curries,
Side Orders, Desserts, Beverages. Chef stations: Noodles, Stir Fried and Fried Rice print on MAIN KITCHEN (Chef 1); every other category on CHEF 2.
Flags per item below: `protein` = protein choice; `addons` = extra proteins; `spice` = spice level 1–5; `choice:` = required "Your Choice" variant;
`mods:` = removable/extra ingredients; `photo` = has a dish photo.



### Signatures & Chef's Specials (5)
- Chicken Ginger Rice (Khao Man Gai • ข้าวมันไก่) — $14.99 — Boiled chicken over special ginger rice, served with spicy ginger sauce. — [photo]
- Red or Green Curry Salmon (Kaeng Pla Salmon • แกงปลาแซลมอน) — $16.99 — Grilled salmon topped with Thai style coconut curry sauce. — [spice; choice: Red Curry|Green Curry]
- Teriyaki Salmon (Pla Salmon Teriyaki • ปลาแซลมอนเทอริยากิ) — $16.99 — Grilled salmon over a mix of steamed vegetables, topped with Teriyaki sauce. — [photo]
- Spicy Basil Duck (Ped Pad Kaprao • เป็ดผัดกะเพรา) — $16.99 — Lightly battered duck topped with spicy basil sauce. — [spice; mods: Basil]
- Red or Green Curry Duck (Kaeng Ped Yang • แกงเป็ดย่าง) — $16.99 — Roasted duck topped with Thai style coconut red curry sauce. — [spice; choice: Red Curry|Green Curry]

### Appetizers (14)
- Crab Rangoon — $5.99 — Crab cream cheese seasoned in a wonton wrap.
- Thai Crispy Rolls (Chicken, Pork, or Vegetable) (Por Pia Tod • ปอเปี๊ยะทอด) — $5.99 — Crispy Thai egg rolls served with sweet & sour sauce. — [choice: Chicken|Pork|Vegetable]
- Summer Rolls w/ Spicy Peanut Sauce (Por Pia Sod • ปอเปี๊ยะสด) — $5.99 — An assortment of vegetables wrapped in rice paper. — [choice: Shrimp|Chicken|Tofu; mods: Peanuts]
- Corn Patties (Tod Mun Khao Pod • ทอดมันข้าวโพด) — $5.99 — Deep fried corn kernels battered with Thai seasonings.
- Fried Tofu (Tao Hoo Tod • เต้าหู้ทอด) — $5.99 — Deep fried tofu served with sweet & sour peanut sauce. — [mods: Peanuts]
- Chicken & Vegetable Potstickers (Kiao Sa • เกี๊ยวซ่า) — $5.99 — Your choice of fried or steamed, served with sweet & sour sauce. — [choice: Fried|Steamed]
- Shrimp Blankets (Goong Hom Pha • กุ้งห่มผ้า) — $7.99 — Shrimp seasoned and wrapped, served with sweet & sour sauce.
- Fish Patties (Tod Mun Pla • ทอดมันปลา) — $9.99 — A combination of spicy red curry with fish paste.
- Herbal Chicken (Gai Tod Samunprai • ไก่ทอดสมุนไพร) — $9.99 — Crispy chicken infused with Thai herbs and seasonings.
- Thai Satay (Chicken or Pork) w/ Cucumber & Peanut Sauce (สะเต๊ะ) — $9.99 — Marinated in Thai seasonings and curry, served with sweet & sour. — [choice: Chicken|Pork; mods: Peanuts,Cucumber; photo]
- Fried Calamari (Pla Muek Tod • ปลาหมึกทอด) — $9.99 — Lightly battered calamari served with sweet & sour peanut sauce. — [mods: Peanuts]
- Curry Puffs (Kari Pap • กะหรี่ปั๊บ) — $9.99 — Minced chicken marinated and stuffed with Thai herbs and deep fried.
- Thai Crispy Wings (Peek Gai Tod • ปีกไก่ทอด) — $9.99 — Chicken wings marinated with Thai herbs and deep fried.
- Lemon Grass Sausage (Sai Ua • ไส้อั่ว) — $9.99 — Ground pork mixed with Thai herbs and grilled.

### Thai Salads (8)
- Thai House Salad w/ Peanut Dressing (Salad Khaek • สลัดแขก) — $7.99 — Fresh lettuce, tomatoes, and carrots served with peanut dressing. — [mods: Peanuts,Tomatoes,Carrots]
- Papaya Salad Laos Style (Som Tum Lao • ส้มตำลาว) — $11.99 — Fresh green papaya salad mixed with crab, tomatoes, chili, and lime juice. — [spice; mods: Tomatoes; photo]
- Papaya Salad Thai Style (Som Tum Thai • ส้มตำไทย) — $11.99 — Fresh green papaya salad mixed with peanuts, dry shrimp, tomatoes, chili, and lime juice. — [spice; mods: Peanuts,Tomatoes; photo]
- Shrimp Salad (Yum Goong • ยำกุ้ง) — $13.99 — Shrimp salad mixed with tomatoes, onions, lemongrass and cilantro with spicy lime dressing. — [spice; mods: Onions,Tomatoes,Cilantro]
- Grilled Pork or Beef Salad (Nam Tok • น้ำตก) — $13.99 — Sliced grilled meat mixed with chili, onions, cilantro, and lemongrass with spicy lime dressing. — [spice; choice: Pork|Beef; mods: Onions,Cilantro]
- Glass Noodle Salad (Chicken, Beef or Pork) (Yum Woon Sen • ยำวุ้นเส้น) — $13.99 — Glass noodles mixed with minced meat, tomatoes, onions, cilantro with spicy lime dressing. Substitute shrimp +$3 or seafood +$4. — [spice; choice: Chicken|Beef|Pork|Shrimp +$3.00|Seafood +$4.00; mods: Onions,Tomatoes,Cilantro]
- Larb (Chicken, Beef or Pork) (ลาบ) — $13.99 — Minced meat with ground rice, onions, cilantro with spicy lime dressing. — [spice; choice: Chicken|Beef|Pork; mods: Onions,Cilantro]
- Seafood Salad (Yum Talay • ยำทะเล) — $14.99 — Seafood salad mixed with tomatoes, onions, lemongrass, and cilantro with spicy lime dressing. — [spice; mods: Onions,Tomatoes,Cilantro]

### Thai Soups (6)
- Tom Yum (ต้มยำ) — Small $6.99 / Large $10.99 — An exotic spicy soup with mushrooms, onions, tomatoes, and chili. — [protein; addons; spice; mods: Onions,Tomatoes,Mushrooms]
- Tom Kha (ต้มข่า) — Small $6.99 / Large $10.99 — An exotic spicy soup with coconut milk, mushrooms, onions, tomatoes and chili. — [protein; addons; spice; mods: Onions,Tomatoes,Mushrooms; photo]
- Onion Basil — Small $6.99 / Large $10.99 — Traditional Thai spicy & sour soup with kaffir lime leaves, lemongrass, basil and chili. — [protein; addons; spice; mods: Onions,Basil]
- Shrimp Wonton Soup (Kiao Goong Nam • เกี๊ยวกุ้งน้ำ) — Small $7.99 / Large $11.99 — Shrimp marinated and wrapped in wonton patty.
- Thai Noodle Soup (Guay Teow Nam • ก๋วยเตี๋ยวน้ำ) — $11.99 — Thai style rice noodle soup with peanuts, bean sprouts, onions, cilantro and chili. — [protein; addons; spice; mods: Peanuts,Onions,Bean Sprouts,Cilantro]
- Vegetable Soup (Kaeng Jued Pak • แกงจืดผัก) — Small $6.99 / Large $10.99 — Traditional Thai vegetable soup (protein choice not included). — [spice]

### Noodles (7)
- Pad Thai (ผัดไทย) — $13.99 — Traditional Thai rice noodle dish with peanuts, egg, red onions, bean sprouts, and scallions in a sweet & tangy sauce. — [protein; addons; spice; mods: Peanuts,Egg,Onions,Bean Sprouts,Scallions; photo]
- Pad Kee Mow (Spicy Basil Noodles) (ผัดขี้เมา) — $13.99 — Big flat noodles with egg, tomatoes, onions, bell peppers and fresh basil. — [protein; addons; spice; mods: Egg,Onions,Tomatoes,Bell Peppers,Basil; photo]
- Pad See Iew (Sweet Broccoli Noodles) (ผัดซีอิ๊ว) — $13.99 — Big flat noodles with egg, broccoli, and Thai seasonings. — [protein; addons; mods: Egg,Broccoli; photo]
- Tung Tac (Spicy Peanut Noodles) — $13.99 — Big flat noodles with peanuts, egg, napa cabbage, bean sprouts, green onions, and spicy Thai seasonings. — [protein; addons; spice; mods: Peanuts,Egg,Onions,Bean Sprouts,Cabbage]
- Raad Naa (Gravy Noodles) (ราดหน้า) — $13.99 — Pan seared big flat noodles with broccoli in a black bean gravy. — [protein; addons; mods: Broccoli]
- Sukiyaki (สุกี้) — $13.99 — Glass noodles with egg, carrots, celery, napa cabbage, scallions, and cilantro in a spicy sukiyaki sauce. — [protein; addons; spice; mods: Egg,Scallions,Carrots,Cilantro,Cabbage,Celery]
- Red or Green Curry Noodles — $13.99 — An exotic spicy curry with bamboo shoots, zucchini, bell peppers and sweet basil, served with vermicelli noodles. — [protein; addons; spice; choice: Red Curry|Green Curry; mods: Bell Peppers,Basil,Bamboo Shoots,Zucchini]

### Stir Fried (7)
- Spicy Basil (Pad Kaprao • ผัดกะเพรา) — $13.99 — Thai spicy basil sauce with bell peppers, bamboo shoots, and fresh basil. — [protein; addons; spice; mods: Bell Peppers,Basil,Bamboo Shoots]
- Pepper Garlic (Pad Kratiem Prik Thai • ผัดกระเทียมพริกไทย) — $13.99 — Sliced meat with zucchini, broccoli and carrots. — [protein; addons; mods: Broccoli,Carrots,Zucchini,Garlic]
- Rama Peanut (Phra Ram Long Song • พระรามลงสรง) — $13.99 — Sliced meat in homemade peanut sauce over a bed of steamed vegetables. — [protein; addons; mods: Peanuts]
- Ginger (Pad Khing • ผัดขิง) — $13.99 — Sliced meat sautéed with fresh ginger, bell peppers, onions, garlic and carrots in a light ginger sauce. — [protein; addons; mods: Onions,Bell Peppers,Carrots,Garlic,Ginger]
- Cashew Nut (Pad Med Mamuang • ผัดเม็ดมะม่วงหิมพานต์) — $13.99 — A spicy sweet chili paste with cashew nuts, sweet onions, bell peppers and carrots. — [protein; addons; spice; mods: Onions,Bell Peppers,Carrots,Cashews]
- Curry Basil (Pad Prik Gaeng • ผัดพริกแกง) — $13.99 — A blend of Thai chili paste, stir fried with bell peppers, zucchini and basil. — [protein; addons; spice; mods: Bell Peppers,Basil,Zucchini]
- Sesame Chicken — $13.99 — Lightly battered chicken stir fried in sweet and sour sauce with sesame seeds, onions, bell peppers and carrots. — [addons; mods: Onions,Bell Peppers,Carrots]

### Fried Rice (6)
- Thai Fried Rice (Khao Pad • ข้าวผัด) — $13.99 — Thai style fried rice with egg, onions, tomatoes and garlic. — [protein; addons; mods: Egg,Onions,Tomatoes,Garlic; photo]
- Spicy Basil Fried Rice (Khao Pad Kaprao • ข้าวผัดกะเพรา) — $13.99 — A spicy basil fried rice with egg, bell peppers, and garlic. — [protein; addons; spice; mods: Egg,Bell Peppers,Basil,Garlic; photo]
- Curry Fried Rice (Khao Pad Pong Karee • ข้าวผัดผงกะหรี่) — $13.99 — A spicy yellow curry fried rice with egg, bell peppers, onions and garlic. — [protein; addons; spice; mods: Egg,Onions,Bell Peppers,Garlic; photo]
- Fish Patty Fried Rice (Khao Pad Tod Mun Pla • ข้าวผัดทอดมันปลา) — $14.99 — A spicy red curry fried rice with egg, onions, bell peppers and basil. — [spice; mods: Egg,Onions,Bell Peppers,Basil]
- Tom Yum Fried Rice (Khao Pad Tom Yum • ข้าวผัดต้มยำ) — $14.99 — A blend of lemongrass and chili paste with mushrooms, tomatoes, and onions. — [protein; addons; spice; mods: Onions,Tomatoes,Mushrooms]
- Pineapple Fried Rice (Khao Pad Sapparod • ข้าวผัดสับปะรด) — $14.99 — Thai style fried rice with cashews, egg, onions, tomatoes, raisins and pineapple. — [protein; addons; mods: Egg,Onions,Tomatoes,Cashews,Raisins,Pineapple; photo]

### Thai Coconut Curries (6)
- Panang Curry (แกงพะแนง) — $13.99 — A thick sweet red curry with bell peppers, carrots and basil. — [protein; addons; spice; mods: Bell Peppers,Basil,Carrots; photo]
- Red Curry (Kaeng Phet • แกงเผ็ด) — $13.99 — A spicy red curry simmered with bell peppers, bamboo shoots, zucchini and basil. — [protein; addons; spice; mods: Bell Peppers,Basil,Bamboo Shoots,Zucchini]
- Green Curry (Kaeng Kiew Wan • แกงเขียวหวาน) — $13.99 — A spicy green curry simmered with bell peppers, bamboo shoots, zucchini and basil. — [protein; addons; spice; mods: Bell Peppers,Basil,Bamboo Shoots,Zucchini]
- Yellow Curry (Kaeng Karee • แกงกะหรี่) — $13.99 — A yellow curry dish with potatoes, onions and carrots. — [protein; addons; spice; mods: Onions,Carrots,Potatoes]
- Pineapple Curry (Kaeng Sapparod • แกงสับปะรด) — $13.99 — A spicy red curry simmered with pineapple, bell peppers, zucchini and basil. — [protein; addons; spice; mods: Bell Peppers,Basil,Pineapple,Zucchini]
- Massaman Curry (แกงมัสมั่น) — $13.99 — A massaman curry paste simmered with peanuts, potatoes, onions and carrots. — [protein; addons; spice; mods: Peanuts,Onions,Carrots,Potatoes]

### Side Orders (6)
- Steamed Rice (Khao Suay • ข้าวสวย) — $3.00
- Steamed Sticky Rice / Brown Rice (Khao Niao / Khao Klong • ข้าวเหนียว / ข้าวกล้อง) — $4.00 — [choice: Sticky Rice|Brown Rice]
- Vermicelli Noodles (Sen Mee • เส้นหมี่) — $3.00
- Steamed Mix Vegetables (Pak Nueng • ผักนึ่ง) — Small $4.00 / Large $6.00
- Peanut Sauce / Peanut Dressing (2 oz) (Nam Jim Tua • น้ำจิ้มถั่ว) — $1.00 — [choice: Peanut Sauce|Peanut Dressing; mods: Peanuts]
- Cool Cucumber Sauce (2 oz) (Ajad • อาจาด) — $1.00 — [mods: Cucumber]

### Desserts (5)
- Black Rice Pudding (Khao Niao Dam • ข้าวเหนียวดำ) — $7.99
- Fried Ice Cream (Aitim Tod • ไอศกรีมทอด) — $7.99
- Sweet Sticky Rice (Khao Niao Moon • ข้าวเหนียวมูน) — $8.99 — Served with coconut ice cream or fresh mango. — [choice: Coconut Ice Cream|Fresh Mango]
- Banana Pastry Delight (Kluay Tod • กล้วยทอด) — $9.99 — Banana wrapped in pastry with two scoops of ice cream.
- Ice Cream (Aitim • ไอศกรีม) — $4.99 — Vanilla, Coconut, or Green Tea. — [choice: Vanilla|Coconut|Green Tea]

### Beverages (6)
- Thai Iced Tea or Thai Iced Coffee (Cha Yen / Kafae Yen • ชาเย็น / กาแฟเย็น) — 16 oz $3.50 / 32 oz $7.00 — No refill. — [choice: Thai Iced Tea|Thai Iced Coffee]
- Thai Iced Tea or Coffee (No Ice) (Cha / Kafae Mai Sai Nam Khaeng • ชา / กาแฟ ไม่ใส่น้ำแข็ง) — 16 oz $4.00 / 32 oz $8.00 — No refill, no ice. — [choice: Thai Iced Tea|Thai Iced Coffee]
- Hot Tea (per person) / Iced Tea (Cha Ron / Cha Dam Yen • ชาร้อน / ชาดำเย็น) — $2.50 — [choice: Hot Tea|Iced Tea]
- Coconut Water (Nam Maprao • น้ำมะพร้าว) — $4.00
- Can Soda (Nam Adlom • น้ำอัดลม) — $2.00
- Bottled Water (Nam Plao • น้ำเปล่า) — $2.00