-- Owner (2026-09-06): non-meat ingredient extras default to $1.00. Every catalog entry today
-- is a vegetable/herb/nut/egg, so all get $1.00; new modifiers start at $1.00 too.
UPDATE modifiers SET extra_cents = 100 WHERE extra_cents = 0;
ALTER TABLE modifiers ALTER COLUMN extra_cents SET DEFAULT 100;
