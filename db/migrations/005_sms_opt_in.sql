-- Express SMS opt-in (TCPA / A2P compliance). Default false; set true only when the
-- customer ticks the checkout checkbox. The order's created_at doubles as the consent
-- timestamp for audit purposes.
ALTER TABLE orders ADD COLUMN sms_opt_in boolean NOT NULL DEFAULT false;
