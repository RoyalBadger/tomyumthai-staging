-- Reusable modifier catalog (owner request 2026-09-06). Instead of typing "No X" labels per
-- dish, the portal picks ingredients from one table; each dish says whether the customer may
-- REMOVE it (free) and/or add EXTRA (upcharge from the catalog, overridable per dish).
CREATE TABLE modifiers (
  id          serial PRIMARY KEY,
  label       text NOT NULL UNIQUE,            -- 'Peanuts' → customer sees "No Peanuts" / "Extra Peanuts"
  emoji       text,                            -- optional prefix on the customer site
  pattern     text,                            -- JS-style regex used to auto-suggest the modifier from a dish's text
  extra_cents int  NOT NULL DEFAULT 0,         -- default upcharge for "Extra X"
  active      boolean NOT NULL DEFAULT true,
  sort        int  NOT NULL DEFAULT 0
);

CREATE TABLE item_modifiers (
  item_id     text NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  modifier_id int  NOT NULL REFERENCES modifiers(id) ON DELETE CASCADE,
  can_remove  boolean NOT NULL DEFAULT true,
  can_extra   boolean NOT NULL DEFAULT false,
  extra_cents int,                             -- per-dish override; NULL = catalog default
  sort        int NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, modifier_id)
);

INSERT INTO modifiers (label, emoji, pattern, sort) VALUES
  ('Peanuts',       '🥜',  '\bpeanut',              0),
  ('Egg',           '🥚',  '\begg(?!\s*roll)',      1),
  ('Onions',        '🧅',  '\bonion',               2),
  ('Bean Sprouts',  NULL,  '\bbean sprout',         3),
  ('Scallions',     NULL,  '\bscallion',            4),
  ('Tomatoes',      '🍅',  '\btomato',              5),
  ('Bell Peppers',  NULL,  '\bbell pepper',         6),
  ('Jalapeños',     '🌶️', '\bjalapeno',            7),
  ('Basil',         '🌿',  '\bbasil',               8),
  ('Broccoli',      '🥦',  '\bbroccoli',            9),
  ('Carrots',       '🥕',  '\bcarrot',             10),
  ('Mushrooms',     '🍄',  '\bmushroom',           11),
  ('Cilantro',      NULL,  '\bcilantro',           12),
  ('Cucumber',      '🥒',  '\bcucumber',           13),
  ('Cashews',       NULL,  '\bcashew',             14),
  ('Raisins',       NULL,  '\braisin',             15),
  ('Pineapple',     '🍍',  '\bpineapple',          16),
  ('Potatoes',      '🥔',  '\bpotato',             17),
  ('Bamboo Shoots', NULL,  '\bbamboo',             18),
  ('Zucchini',      NULL,  '\bzucchini',           19),
  ('Cabbage',       NULL,  '\bcabbage',            20),
  ('Celery',        NULL,  '\bcelery',             21),
  ('Garlic',        '🧄',  '\bgarlic',             22),
  ('Ginger',        NULL,  '\bginger(?!\s*rice)',  23);

-- Seed each dish's modifiers exactly as the old auto-derivation produced them
-- (Postgres ARE regex: \b → \m word-start; lookahead is supported). The old
-- removals_hidden / removals_custom columns stay in place but are no longer read.
INSERT INTO item_modifiers (item_id, modifier_id, can_remove, can_extra, sort)
SELECT i.id, m.id, true, false, m.sort
FROM menu_items i
JOIN modifiers m
  ON (i.name || ' ' || COALESCE(i.description, '')) ~* replace(m.pattern, E'\\b', E'\\m')
WHERE NOT (('No ' || m.label) = ANY (i.removals_hidden));

-- Any custom "No X" labels typed in the portal become catalog entries assigned to that dish.
INSERT INTO modifiers (label, sort)
SELECT DISTINCT regexp_replace(c, '^No\s+', '', 'i'), 100
FROM menu_items i, unnest(i.removals_custom) AS c
WHERE c <> ''
ON CONFLICT (label) DO NOTHING;

INSERT INTO item_modifiers (item_id, modifier_id, can_remove, can_extra, sort)
SELECT i.id, m.id, true, false, 100
FROM menu_items i, unnest(i.removals_custom) AS c
JOIN modifiers m ON m.label = regexp_replace(c, '^No\s+', '', 'i')
ON CONFLICT DO NOTHING;
