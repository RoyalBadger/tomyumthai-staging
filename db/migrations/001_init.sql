-- Tom Yum Thai ordering platform: initial schema.
-- Money is integer cents everywhere. Times are timestamptz (store runs America/Chicago).

CREATE TABLE menu_categories (
  id          text PRIMARY KEY,          -- slug, e.g. 'appetizers'
  name        text NOT NULL,
  sort        int  NOT NULL DEFAULT 0
);

CREATE TABLE menu_items (
  id               text PRIMARY KEY,     -- slug, e.g. 'pad-kee-mow'
  category_id      text NOT NULL REFERENCES menu_categories(id),
  name             text NOT NULL,
  thai_name        text,
  description      text,
  base_price_cents int,                  -- NULL => not directly priced (market price)
  price_note       text,                 -- e.g. 'Market Price — call us'
  protein_choice   boolean NOT NULL DEFAULT false,  -- chicken/pork/tofu incl.; beef/shrimp/seafood upcharge
  extra_protein    boolean NOT NULL DEFAULT false,  -- add-on protein checkboxes
  spice_selectable boolean NOT NULL DEFAULT false,  -- spice 1-5
  is_orderable     boolean NOT NULL DEFAULT true,   -- false => display only (market price / call)
  is_86ed          boolean NOT NULL DEFAULT false,  -- sold out today (manager toggle)
  is_hidden        boolean NOT NULL DEFAULT false,  -- removed from menu without deleting history
  sort             int NOT NULL DEFAULT 0
);

-- Size variants (soups S/L, teas 16/32oz, veggies S/L). Items without rows are single-size.
CREATE TABLE item_sizes (
  id          serial PRIMARY KEY,
  item_id     text NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  label       text NOT NULL,             -- 'Small', 'Large', '16 oz', '32 oz'
  price_cents int  NOT NULL,
  sort        int  NOT NULL DEFAULT 0,
  UNIQUE (item_id, label)
);

-- Global option catalogs (referenced by flags on menu_items, priced here so a
-- price change is one row update).
CREATE TABLE protein_options (
  id          text PRIMARY KEY,          -- 'chicken','pork','tofu','beef','shrimp','seafood'
  label       text NOT NULL,
  delta_cents int  NOT NULL DEFAULT 0,
  sort        int  NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true
);

CREATE TABLE extra_protein_options (
  id          text PRIMARY KEY,          -- 'extra-chicken', 'extra-beef', ...
  label       text NOT NULL,
  delta_cents int  NOT NULL,
  sort        int  NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true
);

CREATE TABLE promo_codes (
  code         text PRIMARY KEY,         -- stored uppercase
  percent_off  int  NOT NULL CHECK (percent_off BETWEEN 1 AND 100),
  active       boolean NOT NULL DEFAULT true,
  valid_from   timestamptz,
  valid_until  timestamptz
);

CREATE TABLE customers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164  text NOT NULL UNIQUE,
  verified_at timestamptz,
  name        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz
);

CREATE TABLE orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_code     text NOT NULL UNIQUE,               -- 'TYT-2026-0001'
  order_type      text NOT NULL CHECK (order_type IN ('pickup','delivery')),
  status          text NOT NULL DEFAULT 'pending_payment'
                  CHECK (status IN ('pending_payment','received','cooking','ready','completed','canceled')),
  customer_id     uuid REFERENCES customers(id),      -- NULL for guests
  customer_name   text NOT NULL,
  customer_phone  text NOT NULL,
  delivery_address text,
  delivery_notes  text,
  subtotal_cents  int NOT NULL,
  discount_cents  int NOT NULL DEFAULT 0,
  tax_cents       int NOT NULL,
  delivery_fee_cents int NOT NULL DEFAULT 0,
  total_cents     int NOT NULL,
  promo_code      text REFERENCES promo_codes(code),
  stripe_payment_intent text UNIQUE,
  paid_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_status_idx  ON orders (status, created_at);
CREATE INDEX orders_kitchen_idx ON orders (created_at) WHERE status IN ('received','cooking','ready');

-- Item snapshot: menu edits never rewrite history.
CREATE TABLE order_items (
  id          serial PRIMARY KEY,
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id     text,                       -- reference only; snapshot below is authoritative
  name        text NOT NULL,
  size_label  text,
  protein     text,
  extras      text[],                     -- labels of extra proteins/add-ons
  spice_level int CHECK (spice_level BETWEEN 1 AND 5),
  exclusions  text,                       -- 'NO PEANUTS, NO EGG'
  notes       text,
  unit_price_cents int NOT NULL,
  qty         int NOT NULL CHECK (qty BETWEEN 1 AND 20)
);

CREATE TABLE admin_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  totp_secret   text,                     -- NULL until MFA enrollment completes
  recovery_codes text[],                  -- hashed
  role          text NOT NULL DEFAULT 'manager' CHECK (role IN ('owner','manager')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  disabled      boolean NOT NULL DEFAULT false
);

CREATE TABLE sessions (
  token_hash  text PRIMARY KEY,           -- sha256 of the cookie value
  admin_id    uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE TABLE admin_audit_log (
  id         serial PRIMARY KEY,
  admin_id   uuid REFERENCES admin_users(id),
  action     text NOT NULL,               -- '86_on', '86_off', 'price_change', 'status_change', ...
  target     text,
  detail     jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Store-wide settings as a single row.
CREATE TABLE settings (
  id                  boolean PRIMARY KEY DEFAULT true CHECK (id), -- singleton
  store_open_override text NOT NULL DEFAULT 'auto' CHECK (store_open_override IN ('auto','closed')),
  closed_message      text,
  holiday_dates       date[] NOT NULL DEFAULT '{}',
  delivery_radius_miles numeric NOT NULL DEFAULT 5,
  delivery_fee_cents  int NOT NULL DEFAULT 399,
  delivery_minimum_cents int NOT NULL DEFAULT 2000,
  tax_rate_bps        int NOT NULL DEFAULT 825,     -- 8.25% Garland, TX
  pickup_eta_minutes  text NOT NULL DEFAULT '15-20',
  delivery_eta_minutes text NOT NULL DEFAULT '35-45'
);
INSERT INTO settings DEFAULT VALUES;

-- Order code sequence, reset yearly by convention (year embedded in code).
CREATE SEQUENCE order_code_seq;
