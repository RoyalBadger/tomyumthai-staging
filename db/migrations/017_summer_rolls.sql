-- Summer Rolls: no longer shrimp-only (owner, 2026-09-06). Rename + filling choice.
UPDATE menu_items SET name = 'Summer Rolls w/ Spicy Peanut Sauce' WHERE id = 'summer-rolls';
INSERT INTO item_variants (item_id, label, delta_cents, sort) VALUES
  ('summer-rolls', 'Shrimp',  0, 0),
  ('summer-rolls', 'Chicken', 0, 1),
  ('summer-rolls', 'Tofu',    0, 2);
