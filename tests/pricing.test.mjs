// Pricing engine tests with a fixture context (no DB). Hand-computed expectations.
// Run: node tests/pricing.test.mjs
import { priceCart, CartError } from '../lib/pricing.js';

const ctx = {
  itemsById: {
    'pad-thai':  { id: 'pad-thai', name: 'Pad Thai', base_price_cents: 1399, protein_choice: true,  extra_protein: true,  spice_selectable: true,  is_orderable: true, is_86ed: false, is_hidden: false },
    'tom-yum':   { id: 'tom-yum',  name: 'Tom Yum',  base_price_cents: null, protein_choice: true,  extra_protein: true,  spice_selectable: true,  is_orderable: true, is_86ed: false, is_hidden: false },
    'crab-rangoon': { id: 'crab-rangoon', name: 'Crab Rangoon', base_price_cents: 599, protein_choice: false, extra_protein: false, spice_selectable: false, is_orderable: true, is_86ed: false, is_hidden: false },
    'whole-fish': { id: 'whole-fish', name: 'Whole Fish', base_price_cents: null, protein_choice: false, extra_protein: false, spice_selectable: false, is_orderable: false, is_86ed: false, is_hidden: false },
    'sold-out':  { id: 'sold-out', name: 'Sold Out Dish', base_price_cents: 1399, protein_choice: false, extra_protein: false, spice_selectable: false, is_orderable: true, is_86ed: true, is_hidden: false },
  },
  sizesByItem: { 'tom-yum': [{ item_id: 'tom-yum', label: 'Small', price_cents: 699 }, { item_id: 'tom-yum', label: 'Large', price_cents: 1099 }] },
  proteinById: { chicken: { id: 'chicken', label: 'Chicken', delta_cents: 0 }, shrimp: { id: 'shrimp', label: 'Shrimp', delta_cents: 300 } },
  extraById: { 'extra-beef': { id: 'extra-beef', label: 'Extra Beef', delta_cents: 300 } },
  settings: { delivery_fee_cents: 399, delivery_minimum_cents: 2000, tax_rate_bps: 825 },
  promo: { code: 'DIRECT15', percent_off: 15 },
};

let fail = 0;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) fail++; };
const throws = (name, cart, msgPart) => {
  try { priceCart(cart, ctx); check(name, false); }
  catch (e) { check(name + ` [${e.message}]`, e instanceof CartError && (!msgPart || e.message.includes(msgPart))); }
};

// Happy path: 2x Pad Thai shrimp + extra beef, spice 4, pickup, DIRECT15
// unit = 1399 + 300 + 300 = 1999; subtotal = 3998; discount = round(3998*.15)=600
// taxBase = 3398; tax = round(3398*.0825) = 280; total = 3678
{
  const r = priceCart({
    order_type: 'pickup', promo_code: 'DIRECT15',
    items: [{ id: 'pad-thai', protein: 'shrimp', extras: ['extra-beef'], spice_level: 4, qty: 2, exclusions: 'no peanuts', notes: 'extra sauce' }],
  }, ctx);
  check('subtotal 3998', r.subtotal_cents === 3998);
  check('discount 600', r.discount_cents === 600);
  check('tax 280', r.tax_cents === 280);
  check('total 3678', r.total_cents === 3678);
  check('exclusions uppercased', r.lines[0].exclusions === 'NO PEANUTS');
  check('snapshot labels', r.lines[0].protein === 'Shrimp' && r.lines[0].extras[0] === 'Extra Beef');
}

// Delivery: Large tom-yum chicken x2 = 2198 subtotal, no promo
// >= 2000 minimum ok; fee 399; taxBase 2597; tax = round(214.2525)=214; total 2811
{
  const r = priceCart({
    order_type: 'delivery',
    items: [{ id: 'tom-yum', size_label: 'Large', protein: 'chicken', qty: 2, spice_level: 5 }],
  }, ctx);
  check('delivery fee applied', r.delivery_fee_cents === 399);
  check('delivery total 2811', r.total_cents === 2811);
}

// Tamper & validation cases
throws('rejects unknown item', { order_type: 'pickup', items: [{ id: 'hax', qty: 1 }] });
throws('rejects 86ed item', { order_type: 'pickup', items: [{ id: 'sold-out', qty: 1 }] }, 'sold out');
throws('rejects market-price item', { order_type: 'pickup', items: [{ id: 'whole-fish', qty: 1 }] }, 'call us');
throws('requires size when sized', { order_type: 'pickup', items: [{ id: 'tom-yum', protein: 'chicken', qty: 1 }] }, 'size');
throws('rejects bogus size', { order_type: 'pickup', items: [{ id: 'tom-yum', size_label: 'Mega', protein: 'chicken', qty: 1 }] }, 'size');
throws('requires protein when choosable', { order_type: 'pickup', items: [{ id: 'pad-thai', qty: 1 }] }, 'protein');
throws('rejects protein on plain item', { order_type: 'pickup', items: [{ id: 'crab-rangoon', protein: 'shrimp', qty: 1 }] }, 'protein');
throws('rejects add-on on plain item', { order_type: 'pickup', items: [{ id: 'crab-rangoon', extras: ['extra-beef'], qty: 1 }] }, 'add-on');
throws('rejects duplicate add-on', { order_type: 'pickup', items: [{ id: 'pad-thai', protein: 'chicken', extras: ['extra-beef', 'extra-beef'], qty: 1 }] }, 'Duplicate');
throws('rejects spice on non-spice item', { order_type: 'pickup', items: [{ id: 'crab-rangoon', spice_level: 3, qty: 1 }] }, 'spice');
throws('rejects spice 6', { order_type: 'pickup', items: [{ id: 'pad-thai', protein: 'chicken', spice_level: 6, qty: 1 }] }, '1–5');
throws('rejects qty 0', { order_type: 'pickup', items: [{ id: 'crab-rangoon', qty: 0 }] }, 'quantity');
throws('rejects qty 21', { order_type: 'pickup', items: [{ id: 'crab-rangoon', qty: 21 }] }, 'quantity');
throws('rejects empty cart', { order_type: 'pickup', items: [] }, 'empty');
throws('rejects bad order type', { order_type: 'dine-in', items: [{ id: 'crab-rangoon', qty: 1 }] }, 'pickup or delivery');
throws('rejects delivery under minimum', { order_type: 'delivery', items: [{ id: 'crab-rangoon', qty: 1 }] }, 'minimum');

// Bad promo: context without matching promo row
{
  const noPromoCtx = { ...ctx, promo: null };
  try { priceCart({ order_type: 'pickup', promo_code: 'FAKE50', items: [{ id: 'crab-rangoon', qty: 1 }] }, noPromoCtx); check('rejects invalid promo', false); }
  catch (e) { check('rejects invalid promo', e instanceof CartError && e.message.includes('promo')); }
}

// Client-supplied prices are ignored (tamper test): sending price fields changes nothing
{
  const r = priceCart({
    order_type: 'pickup',
    items: [{ id: 'crab-rangoon', qty: 1, unit_price_cents: 1, price: 0.01, total: 0.01 }],
  }, ctx);
  check('client price fields ignored', r.total_cents === Math.round(599 * 1.0825));
}

if (fail) { console.error(`${fail} failing`); process.exit(1); }
console.log('all pricing tests pass');
