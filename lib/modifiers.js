// Modifier catalog helpers. A modifier is an ingredient ("Peanuts") a dish may let the
// customer REMOVE (free → "No Peanuts", printed in the ticket's exclusions line) and/or add
// EXTRA (upcharge → "Extra Peanuts", printed with the add-ons). Assignments live in
// item_modifiers; the catalog (with a regex used only to suggest matches in the portal
// editor) lives in modifiers. Shared by /api/menu, /api/admin/menu and lib/pricing.js.

export const removeLabel = m => `${m.emoji ? m.emoji + ' ' : ''}No ${m.label}`;
export const extraLabel = m => `Extra ${m.label}`;

/** Catalog ids whose pattern matches the dish text — used to pre-fill a new dish in the editor. */
export function suggestModifiers(item, catalog) {
  const text = `${item.name || ''} ${item.description || ''}`;
  return catalog.filter(m => {
    if (!m.pattern) return false;
    try { return new RegExp(m.pattern, 'i').test(text); } catch { return false; }
  }).map(m => m.id);
}

/** Shape one item_modifiers row (joined with its catalog row) for the customer/portal APIs. */
export function publicModifier(row) {
  return {
    id: row.modifier_id,
    label: row.label,
    emoji: row.emoji,
    can_remove: row.can_remove,
    can_extra: row.can_extra,
    extra_cents: row.extra_cents_override ?? row.extra_cents,
  };
}

export const ITEM_MODIFIER_SQL = `
  SELECT im.item_id, im.modifier_id, im.can_remove, im.can_extra, im.extra_cents AS extra_cents_override,
         im.sort, m.label, m.emoji, m.extra_cents
  FROM item_modifiers im JOIN modifiers m ON m.id = im.modifier_id
  WHERE m.active ORDER BY im.sort, m.sort, m.label`;
