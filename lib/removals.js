// "No X" removal checkboxes a customer sees in the dish customizer.
// Auto-derived from the dish's own name + description (so a dish only offers
// "No Peanuts" if it actually contains peanuts), then adjusted per dish by the
// manager portal: removals_hidden suppresses auto entries the kitchen can't honor
// (Khao Man Gai without ginger), removals_custom adds dish-specific ones.
// Shared by /api/menu (customer) and /api/admin/menu (portal editor preview).

export const REMOVAL_VOCAB = [
  ['\\bpeanut', '🥜 No Peanuts (Allergy)'],
  ['\\begg(?!\\s*roll)', '🥚 No Egg'],
  ['\\bonion', '🧅 No Onions'],
  ['\\bbean sprout', 'No Bean Sprouts'],
  ['\\bscallion', 'No Scallions'],
  ['\\btomato', '🍅 No Tomatoes'],
  ['\\bbell pepper', 'No Bell Peppers'],
  ['\\bjalapeno', '🌶️ No Jalapeños'],
  ['\\bbasil', '🌿 No Basil'],
  ['\\bbroccoli', '🥦 No Broccoli'],
  ['\\bcarrot', '🥕 No Carrots'],
  ['\\bmushroom', '🍄 No Mushrooms'],
  ['\\bcilantro', 'No Cilantro'],
  ['\\bcucumber', '🥒 No Cucumber'],
  ['\\bcashew', 'No Cashews'],
  ['\\braisin', 'No Raisins'],
  ['\\bpineapple', '🍍 No Pineapple'],
  ['\\bpotato', '🥔 No Potatoes'],
  ['\\bbamboo', 'No Bamboo Shoots'],
  ['\\bzucchini', 'No Zucchini'],
  ['\\bcabbage', 'No Cabbage'],
  ['\\bcelery', 'No Celery'],
  ['\\bgarlic', '🧄 No Garlic'],
  ['\\bginger(?!\\s*rice)', 'No Ginger'],
];

const COMPILED = REMOVAL_VOCAB.map(([src, label]) => [new RegExp(src, 'i'), label]);

/** Labels derived purely from the dish text. */
export function autoRemovals(item) {
  const text = `${item.name || ''} ${item.description || ''}`;
  return COMPILED.filter(([re]) => re.test(text)).map(([, label]) => label);
}

/** What the customer actually sees: auto − hidden + custom (deduped, order kept). */
export function finalRemovals(item) {
  const hidden = new Set(item.removals_hidden || []);
  const out = autoRemovals(item).filter(l => !hidden.has(l));
  for (const c of item.removals_custom || []) if (c && !out.includes(c)) out.push(c);
  return out;
}
