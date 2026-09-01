-- Allow the force-open override value: 'open' ignores business hours entirely
-- (owner test mode; the manager portal has a Test Mode toggle for it).
ALTER TABLE settings DROP CONSTRAINT settings_store_open_override_check;
ALTER TABLE settings ADD CONSTRAINT settings_store_open_override_check
  CHECK (store_open_override IN ('auto', 'closed', 'open'));
