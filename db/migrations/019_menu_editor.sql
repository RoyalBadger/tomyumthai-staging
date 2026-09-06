-- Manager-portal menu editor (2026-09-06): per-dish control over the "No X" removal
-- checkboxes customers see, plus a change-request inbox for the web admin.
ALTER TABLE menu_items
  ADD COLUMN removals_hidden text[] NOT NULL DEFAULT '{}',   -- auto-derived labels to suppress
  ADD COLUMN removals_custom text[] NOT NULL DEFAULT '{}';   -- extra dish-specific "No X" labels

-- Was a hard-coded client-side block list; now data.
UPDATE menu_items SET removals_hidden = ARRAY['No Ginger'] WHERE id = 'chicken-ginger-rice';

-- Design / site change requests from the family, routed to the web admin for approval.
CREATE TABLE change_requests (
  id          serial PRIMARY KEY,
  admin_id    uuid REFERENCES admin_users(id),
  subject     text NOT NULL,
  details     text,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'declined')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
