import assert from 'node:assert/strict';
import { createCashPayoutService, payoutCents } from '../lib/cash-payout.js';

assert.equal(payoutCents(1200, 25), 300);
assert.equal(payoutCents(999, 100), 999);
assert.throws(() => payoutCents(-1, 50), RangeError);
assert.throws(() => payoutCents(1200, 101), RangeError);
assert.throws(() => payoutCents(12.5, 50), RangeError);

const records = [];
const service = createCashPayoutService({ recordPayout: async record => records.push(record) });
const owner = { id: 'owner-1', role: 'owner' };
const request = { receipt_cents: 1200, percent: 25, reason: '  Kitchen supplies  ' };
const approved = await service.approve(owner, request);
assert.deepEqual(approved, {
  approved_by: 'owner-1', receipt_cents: 1200, percent: 25,
  amount_cents: 300, reason: 'Kitchen supplies',
});
assert.deepEqual(records, [approved]);
assert.ok(Object.isFrozen(approved));
await assert.rejects(service.approve(null, request), { status: 401 });
await assert.rejects(service.approve(owner, { ...request, reason: ' ' }), TypeError);
assert.equal(records.length, 1);
const unavailable = createCashPayoutService({ recordPayout: async () => { throw new Error('unavailable'); } });
await assert.rejects(unavailable.approve(owner, request), /unavailable/);
console.log('all cash-payout tests pass');
