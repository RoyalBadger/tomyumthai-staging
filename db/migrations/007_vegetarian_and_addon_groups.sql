-- Vegetarian menu flag + add-on grouping.

-- Dishes shown on the customer site's Vegetarian Menu view. Seeded below with a
-- best guess (owner can flip any dish with the manager-portal Veg toggle):
--   TRUE  = has a tofu/vegetable protein choice, or is inherently meatless
--   FALSE = meat/seafood-only dishes
ALTER TABLE menu_items ADD COLUMN is_vegetarian boolean NOT NULL DEFAULT false;

-- Anything with a protein choice can be made with Tofu or Vegetable.
UPDATE menu_items SET is_vegetarian = true WHERE protein_choice;

-- Inherently vegetarian items (apps/sides/desserts/beverages) — matched by name.
UPDATE menu_items SET is_vegetarian = true WHERE name IN (
  'Fried Tofu',
  'Corn Patties',
  'Thai Crispy Rolls (Chicken, Pork, or Vegetable)',
  'Thai House Salad w/ Peanut Dressing',
  'Steamed Rice',
  'Steamed Sticky Rice / Brown Rice',
  'Vermicelli Noodles',
  'Steamed Mix Vegetables',
  'Peanut Sauce / Peanut Dressing (2 oz)',
  'Cool Cucumber Sauce (2 oz)',
  'Black Rice Pudding',
  'Fried Ice Cream',
  'Sweet Sticky Rice',
  'Banana Pastry Delight',
  'Ice Cream',
  'Thai Iced Tea or Thai Iced Coffee',
  'Thai Iced Tea or Coffee (No Ice)',
  'Hot Tea (per person) / Iced Tea',
  'Coconut Water',
  'Can Soda',
  'Bottled Water'
);

-- Vegetable Soup has no protein choice but is vegetarian by description.
UPDATE menu_items SET is_vegetarian = true WHERE name = 'Vegetable Soup';

-- Add-on grouping: the dish modal shows additions under two sub-sections.
ALTER TABLE extra_protein_options ADD COLUMN option_group text NOT NULL DEFAULT 'protein'
  CHECK (option_group IN ('protein','vegetable'));

UPDATE extra_protein_options SET option_group = 'vegetable'
  WHERE label ILIKE '%vegg%' OR label ILIKE '%vegetable%';
