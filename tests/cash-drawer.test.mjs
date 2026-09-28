import assert from 'node:assert/strict';
import { cashSaleTotal, createCashDrawer } from '../lib/cash-drawer.js';

assert.deepEqual(cashSaleTotal(2000, 825), {
  subtotal_cents: 2000, tax_cents: 165, total_cents: 2165,
});
assert.throws(() => cashSaleTotal(0, 825), RangeError);
assert.throws(() => cashSaleTotal(2000, -1), RangeError);
assert.throws(() => cashSaleTotal(2000, 10_001), RangeError);

const entries = [];
const drawer = createCashDrawer({ appendEntry: async entry => entries.push(entry) });
const manager = { id: 'manager-1', role: 'manager' };
const server = { id: 'server-1', role: 'server' };
const request = { operation_id: 'sale-1', subtotal_cents: 2000 };
const entry = await drawer.recordSale(server, request);
assert.equal(entry.total_cents, 2165);
assert.equal(entry.recorded_by, 'server-1');
assert.deepEqual(entries, [entry]);
assert.ok(Object.isFrozen(entry));
assert.deepEqual(await drawer.recordSale(server, request), entry);
assert.equal(entries.length, 1);
await assert.rejects(drawer.recordSale(server, { ...request, subtotal_cents: 3000 }), { status: 409 });
await assert.rejects(drawer.recordSale(null, request), { status: 401 });
await assert.rejects(drawer.recordSale({ id: 'kitchen-1', role: 'kitchen' }, request), { status: 403 });
assert.throws(() => drawer.setTaxRate(null, 800), { status: 401 });
assert.deepEqual(drawer.setTaxRate(manager, 800), { tax_rate_bps: 800 });
const next = await drawer.recordSale(server, { operation_id: 'sale-2', subtotal_cents: 2000 });
assert.equal(next.total_cents, 2160);
assert.equal(entry.tax_rate_bps, 825);
assert.throws(() => drawer.setTaxRate(manager, 10_001), RangeError);
assert.equal(entries.length, 2);
console.log('all cash-drawer tests pass');
