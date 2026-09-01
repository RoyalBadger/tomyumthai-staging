-- Chef station routing: which kitchen ticket each dish prints on.
-- 'main'   → main-entree chef ticket
-- 'second' → second chef ticket
-- Owner assigns stations from the manager portal (menu tab).
ALTER TABLE menu_items ADD COLUMN station text NOT NULL DEFAULT 'main'
  CHECK (station IN ('main','second'));

-- Snapshot the station on each order line at purchase time, so tickets for
-- old orders keep printing correctly even if a dish is later reassigned.
-- NULL (pre-migration rows) is treated as 'main' when reading.
ALTER TABLE order_items ADD COLUMN station text
  CHECK (station IN ('main','second'));
