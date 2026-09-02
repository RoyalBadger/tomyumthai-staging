-- Direct-delivery pause: the store stays open for pickup while our own drivers
-- are off-duty; the customer site then routes delivery demand to Grubhub.
ALTER TABLE settings ADD COLUMN delivery_paused boolean NOT NULL DEFAULT false;
