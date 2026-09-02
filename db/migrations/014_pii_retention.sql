-- PII retention: completed/canceled orders older than the retention window lose
-- their direct identifiers (lib/maintenance.js does the scrubbing; pii_scrubbed_at
-- marks done rows). name/phone must become nullable for the scrub to clear them.
ALTER TABLE orders ADD COLUMN pii_scrubbed_at timestamptz;
ALTER TABLE orders ALTER COLUMN customer_name DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN customer_phone DROP NOT NULL;
