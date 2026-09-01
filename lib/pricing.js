// Server-side order pricing. THE ONLY source of truth for money.
// The client sends item ids + choices; every cent is recomputed here from DB data.
// Pure function (priceCart) + a DB context loader (loadPricingContext) for testability.
import { query } from './db.js';

export class CartError extends Error {
  constructor(message) { super(message); this.name = 'CartError'; }
}

const MAX_LINES = 30;
const MAX_QTY = 20;
const MAX_NOTE = 200;

export async function loadPricingContext(promoCode) {
  const [items, sizes, proteins, extras, settings, promo] = await Promise.all([
    query(`SELECT id, name, base_price_cents, protein_choice, extra_protein, spice_selectable,
                  is_orderable, is_86ed, is_hidden, station
           FROM menu_items`, []),
    query('SELECT item_id, label, price_cents FROM item_sizes', []),
    query('SELECT id, label, delta_cents FROM protein_options WHERE active', []),
    query('SELECT id, label, delta_cents FROM extra_protein_options WHERE active', []),
    query('SELECT delivery_fee_cents, delivery_minimum_cents, tax_rate_bps FROM settings', []),
    promoCode
      ? query(`SELECT code, percent_off FROM promo_codes
               WHERE code = upper($1) AND active
                 AND (valid_from  IS NULL OR valid_from  <= now())
                 AND (valid_until IS NULL OR valid_until >= now())`, [promoCode])
      : Promise.resolve({ rows: [] }),
  ]);

  const sizesByItem = {};
  for (const s of sizes.rows) (sizesByItem[s.item_id] ??= []).push(s);
  return {
    itemsById: Object.fromEntries(items.rows.map(i => [i.id, i])),
    sizesByItem,
    proteinById: Object.fromEntries(proteins.rows.map(p => [p.id, p])),
    extraById: Object.fromEntries(extras.rows.map(e => [e.id, e])),
    settings: settings.rows[0],
    promo: promo.rows[0] || null,
  };
}

/**
 * @param cart {{order_type:'pickup'|'delivery', promo_code?:string,
 *              items:[{id, size_label?, protein?, extras?:string[], spice_level?,
 *                      exclusions?, notes?, qty}]}}
 * @param ctx  from loadPricingContext (or a test fixture)
 * @returns {subtotal_cents, discount_cents, delivery_fee_cents, tax_cents, total_cents,
 *           promo_code, lines:[{item_id,name,size_label,protein,extras,spice_level,
 *                               exclusions,notes,unit_price_cents,qty}]}
 * @throws CartError with a customer-safe message on any invalid input.
 */
export function priceCart(cart, ctx) {
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) throw new CartError('Your cart is empty.');
  if (cart.items.length > MAX_LINES) throw new CartError('Too many different items in one order.');
  if (!['pickup', 'delivery'].includes(cart.order_type)) throw new CartError('Choose pickup or delivery.');

  const lines = [];
  let subtotal = 0;

  for (const raw of cart.items) {
    const item = ctx.itemsById[raw?.id];
    if (!item || item.is_hidden) throw new CartError('An item in your cart is no longer on the menu.');
    if (!item.is_orderable) throw new CartError(`${item.name} can't be ordered online — please call us.`);
    if (item.is_86ed) throw new CartError(`${item.name} is sold out today.`);

    const qty = Number(raw.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new CartError('Invalid quantity.');

    // base price: size variant, or flat base price
    const sizes = ctx.sizesByItem[item.id] || [];
    let base;
    let sizeLabel = null;
    if (sizes.length > 0) {
      const size = sizes.find(s => s.label === raw.size_label);
      if (!size) throw new CartError(`Please pick a size for ${item.name}.`);
      base = size.price_cents;
      sizeLabel = size.label;
    } else {
      if (raw.size_label) throw new CartError(`${item.name} has no size options.`);
      if (item.base_price_cents === null) throw new CartError(`${item.name} can't be ordered online — please call us.`);
      base = item.base_price_cents;
    }

    // protein choice
    let proteinLabel = null;
    if (item.protein_choice) {
      const p = ctx.proteinById[raw.protein];
      if (!p) throw new CartError(`Please pick a protein for ${item.name}.`);
      base += p.delta_cents;
      proteinLabel = p.label;
    } else if (raw.protein) {
      throw new CartError(`${item.name} has no protein choice.`);
    }

    // extra proteins / add-ons
    const extraLabels = [];
    if (raw.extras?.length) {
      if (!item.extra_protein) throw new CartError(`${item.name} has no add-ons.`);
      if (raw.extras.length > 5) throw new CartError('Too many add-ons on one item.');
      const seen = new Set();
      for (const exId of raw.extras) {
        if (seen.has(exId)) throw new CartError('Duplicate add-on.');
        seen.add(exId);
        const ex = ctx.extraById[exId];
        if (!ex) throw new CartError('Unknown add-on.');
        base += ex.delta_cents;
        extraLabels.push(ex.label);
      }
    }

    // spice
    let spice = null;
    if (raw.spice_level !== undefined && raw.spice_level !== null) {
      if (!item.spice_selectable) throw new CartError(`${item.name} has no spice level.`);
      spice = Number(raw.spice_level);
      if (!Number.isInteger(spice) || spice < 1 || spice > 5) throw new CartError('Spice level must be 1–5.');
    }

    const exclusions = raw.exclusions ? String(raw.exclusions).slice(0, MAX_NOTE).toUpperCase() : null;
    const notes = raw.notes ? String(raw.notes).slice(0, MAX_NOTE) : null;

    subtotal += base * qty;
    lines.push({
      item_id: item.id, name: item.name, size_label: sizeLabel, protein: proteinLabel,
      extras: extraLabels, spice_level: spice, exclusions, notes,
      station: item.station || 'main',
      unit_price_cents: base, qty,
    });
  }

  if (subtotal <= 0) throw new CartError('Your cart is empty.');
  if (subtotal > 200_000) throw new CartError('For orders over $2,000, please call us directly.');

  // promo
  let discount = 0;
  let promoCode = null;
  if (cart.promo_code) {
    if (!ctx.promo) throw new CartError('That promo code is not valid.');
    discount = Math.round(subtotal * ctx.promo.percent_off / 100);
    promoCode = ctx.promo.code;
  }

  // delivery
  let deliveryFee = 0;
  if (cart.order_type === 'delivery') {
    if (subtotal - discount < ctx.settings.delivery_minimum_cents) {
      throw new CartError(`Delivery orders have a $${(ctx.settings.delivery_minimum_cents / 100).toFixed(2)} minimum.`);
    }
    deliveryFee = ctx.settings.delivery_fee_cents;
  }

  // Texas: delivery charges by the seller on taxable food sales are taxable.
  const taxBase = subtotal - discount + deliveryFee;
  const tax = Math.round(taxBase * ctx.settings.tax_rate_bps / 10_000);

  return {
    subtotal_cents: subtotal,
    discount_cents: discount,
    delivery_fee_cents: deliveryFee,
    tax_cents: tax,
    total_cents: subtotal - discount + deliveryFee + tax,
    promo_code: promoCode,
    lines,
  };
}
