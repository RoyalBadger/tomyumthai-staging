-- Optional customer email for Stripe payment receipts (and later branded confirmations).
-- Covered by the same PII retention policy as name/phone.
ALTER TABLE orders ADD COLUMN customer_email text;
