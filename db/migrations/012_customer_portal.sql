-- Phase 5: customer portal (phone-OTP login, saved info, order history).
-- Identity = verified phone number; passwordless by design.
ALTER TABLE customers ADD COLUMN email text;
ALTER TABLE customers ADD COLUMN default_address text;

-- Long-lived (180d sliding) customer sessions, separate from admin sessions.
CREATE TABLE customer_sessions (
  token_hash  text PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX customer_sessions_customer_idx ON customer_sessions(customer_id);

-- Order history is keyed by verified phone (past guest orders included).
CREATE INDEX orders_customer_phone_idx ON orders(customer_phone);
