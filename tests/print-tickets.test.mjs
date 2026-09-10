// Ticket formatting for the print agent (no printer or DB needed).
// Run: node tests/print-tickets.test.mjs
import { buildReceipt, buildKitchenTickets, buildTestTicket, ascii, wrap, PROFILES } from '../print-agent/tickets.mjs';

let fail = 0;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) fail++; };
const txt = buf => buf.toString('latin1');
const has = (buf, bytes) => buf.includes(Buffer.from(bytes));

const order = {
  id: '11111111-1111-1111-1111-111111111111',
  public_code: 'TYT-2026-0042',
  order_type: 'delivery',
  status: 'received',
  customer_name: 'José Ñíguez 🌶',
  customer_phone: '(214) 555-0199',
  delivery_address: '123 Main St, Garland, TX 75040',
  delivery_notes: 'gate code 4321',
  subtotal_cents: 3598, discount_cents: 540, tax_cents: 252, delivery_fee_cents: 399, total_cents: 3709,
  promo_code: 'WELCOME15',
  created_at: '2026-09-09T18:05:00Z',
  items: [
    { name: 'Pad Thai', size_label: 'Large', variant: null, protein: 'Chicken', extras: ['Extra Peanuts'],
      spice_level: 3, exclusions: 'NO EGG', notes: 'extra lime please', unit_price_cents: 1499, qty: 2, station: 'main' },
    { name: 'Tom Yum Soup', size_label: null, variant: 'Vegetarian', protein: null, extras: [],
      spice_level: null, exclusions: null, notes: null, unit_price_cents: 600, qty: 1, station: 'second' },
  ],
};

// ascii + wrap helpers
check('ascii strips accents and emoji', ascii('José Ñíguez 🌶') === 'Jose Niguez');
check('wrap keeps words whole', wrap('one two three four', 9).join('|') === 'one two|three|four');
check('wrap hard-breaks overlong tokens', wrap('abcdefghij', 4).join('|') === 'abcd|efgh|ij');

// receipt
const rec = buildReceipt(order);
const rt = txt(rec);
check('receipt starts with init', rec[0] === 0x1b && rec[1] === 0x40);
check('receipt ends with a partial cut', has(rec.subarray(-3), PROFILES.star.cut));
check('receipt has order code', rt.includes('TYT-2026-0042'));
check('receipt shows DELIVERY and address', rt.includes('DELIVERY') && rt.includes('DELIVER TO: 123 Main St'));
check('receipt sanitizes the customer name', rt.includes('Jose Niguez') && !rt.includes('é'));
check('receipt item line', rt.includes('2 x Pad Thai (Large)'));
check('receipt item detail', rt.includes('Chicken - SPICE LV 3 - +Extra Peanuts'));
check('receipt exclusion shouts', rt.includes('*** NO EGG ***'));
check('receipt note', rt.includes('NOTE: extra lime please'));
check('receipt totals', rt.includes('$30.58') && rt.includes('$2.52') && rt.includes('$3.99') && rt.includes('$37.09'));
check('receipt promo line', rt.includes('WELCOME15') && rt.includes('-$5.40'));
check('receipt is ASCII only', [...rec].every(b => b < 0x80));
check('receipt uses double-size for the code', has(rec, PROFILES.star.size(2, 1)));

// kitchen tickets
const kt = buildKitchenTickets(order);
check('two stations -> two tickets', kt.length === 2 && kt[0].station === 'second' && kt[1].station === 'main');
check('CHEF 2 ticket has only its item', txt(kt[0].bytes).includes('Tom Yum Soup') && !txt(kt[0].bytes).includes('Pad Thai'));
check('MAIN ticket has only its item', txt(kt[1].bytes).includes('Pad Thai') && !txt(kt[1].bytes).includes('Tom Yum Soup'));
check('station labels', txt(kt[0].bytes).includes('** CHEF 2 **') && txt(kt[1].bytes).includes('** MAIN KITCHEN **'));
check('kitchen tickets carry code + type + customer', kt.every(t => /TYT-2026-0042/.test(txt(t.bytes)) && /DELIVERY/.test(txt(t.bytes)) && /Jose Niguez/.test(txt(t.bytes))));
check('kitchen tickets do not print prices', kt.every(t => !txt(t.bytes).includes('$')));
check('each kitchen ticket ends in a cut', kt.every(t => has(t.bytes.subarray(-3), PROFILES.star.cut)));

const pickupOnly = { ...order, order_type: 'pickup', items: order.items.filter(i => i.station === 'main') };
const kt2 = buildKitchenTickets(pickupOnly);
check('empty station is skipped', kt2.length === 1 && kt2[0].station === 'main');
check('unknown station counts as main', buildKitchenTickets({ ...order, items: [{ ...order.items[0], station: null }] }).length === 1);

// escpos profile
const esc = buildReceipt(order, { emulation: 'escpos' });
check('escpos cut command', has(esc.subarray(-4), PROFILES.escpos.cut));
check('escpos size command', has(esc, PROFILES.escpos.size(2, 1)));

// test ticket
check('test ticket mentions the label', txt(buildTestTicket('KITCHEN printer 192.168.1.140')).includes('KITCHEN printer 192.168.1.140'));

if (fail) { console.error(`${fail} failing`); process.exit(1); }
console.log('all print-ticket tests pass');
