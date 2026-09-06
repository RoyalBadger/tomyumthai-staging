-- Per-dish "choose one" variants for dishes whose menu name/description names a
-- choice but the customer had no way to pick it (e.g. Thai Crispy Rolls: Chicken,
-- Pork, or Vegetable; Red or Green Curry Duck; Potstickers fried or steamed).
-- Distinct from the global protein_choice list (which carries beef/shrimp upcharges
-- and tofu/vegetable options that don't apply to these dishes).
CREATE TABLE item_variants (
  id          serial PRIMARY KEY,
  item_id     text NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  label       text NOT NULL,
  delta_cents int  NOT NULL DEFAULT 0,
  sort        int  NOT NULL DEFAULT 0,
  UNIQUE (item_id, label)
);

ALTER TABLE order_items ADD COLUMN variant text;   -- snapshot of the chosen label

INSERT INTO item_variants (item_id, label, delta_cents, sort) VALUES
  ('crispy-rolls',          'Chicken',            0, 0),
  ('crispy-rolls',          'Pork',               0, 1),
  ('crispy-rolls',          'Vegetable',          0, 2),
  ('thai-satay',            'Chicken',            0, 0),
  ('thai-satay',            'Pork',               0, 1),
  ('potstickers',           'Fried',              0, 0),
  ('potstickers',           'Steamed',            0, 1),
  ('grilled-meat-salad',    'Pork',               0, 0),
  ('grilled-meat-salad',    'Beef',               0, 1),
  ('glass-noodle-salad',    'Chicken',            0, 0),
  ('glass-noodle-salad',    'Beef',               0, 1),
  ('glass-noodle-salad',    'Pork',               0, 2),
  ('glass-noodle-salad',    'Shrimp',           300, 3),
  ('glass-noodle-salad',    'Seafood',          400, 4),
  ('larb',                  'Chicken',            0, 0),
  ('larb',                  'Beef',               0, 1),
  ('larb',                  'Pork',               0, 2),
  ('curry-salmon',          'Red Curry',          0, 0),
  ('curry-salmon',          'Green Curry',        0, 1),
  ('curry-duck',            'Red Curry',          0, 0),
  ('curry-duck',            'Green Curry',        0, 1),
  ('curry-noodles',         'Red Curry',          0, 0),
  ('curry-noodles',         'Green Curry',        0, 1),
  ('sticky-brown-rice',     'Sticky Rice',        0, 0),
  ('sticky-brown-rice',     'Brown Rice',         0, 1),
  ('sweet-sticky-rice',     'Coconut Ice Cream',  0, 0),
  ('sweet-sticky-rice',     'Fresh Mango',        0, 1),
  ('ice-cream',             'Vanilla',            0, 0),
  ('ice-cream',             'Coconut',            0, 1),
  ('ice-cream',             'Green Tea',          0, 2),
  ('thai-iced-tea',         'Thai Iced Tea',      0, 0),
  ('thai-iced-tea',         'Thai Iced Coffee',   0, 1),
  ('thai-iced-tea-no-ice',  'Thai Iced Tea',      0, 0),
  ('thai-iced-tea-no-ice',  'Thai Iced Coffee',   0, 1),
  ('hot-iced-tea',          'Hot Tea',            0, 0),
  ('hot-iced-tea',          'Iced Tea',           0, 1);
