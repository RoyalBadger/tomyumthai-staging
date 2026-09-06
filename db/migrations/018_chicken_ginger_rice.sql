-- Owner (2026-09-06): rename Khao Man Gai to "Chicken Ginger Rice"; no protein choice,
-- no add-ons, no spice level, no removals (ginger is blocked client-side).
UPDATE menu_items
   SET name = 'Chicken Ginger Rice', extra_protein = false, spice_selectable = false, protein_choice = false
 WHERE id = 'chicken-ginger-rice';
