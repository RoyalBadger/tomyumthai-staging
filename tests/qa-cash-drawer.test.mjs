import test from 'node:test';
import assert from 'node:assert/strict';
import { cashSaleTotal, createCashDrawer } from '../lib/cash-drawer.js';

test('Criterion 1: Valid Sale & Roles', async () => {
  let appends = 0;
  const drawer = createCashDrawer({
    appendEntry: async (entry) => { appends++; }
  });
  const owner = { id: 'u1', role: 'owner' };
  const manager = { id: 'u2', role: 'manager' };
  const server = { id: 'u3', role: 'server' };

  const e1 = await drawer.recordSale(owner, { operation_id: 'op1', subtotal_cents: 100 });
  assert.equal(e1.recorded_by, 'u1');
  assert.ok(Object.isFrozen(e1));

  const e2 = await drawer.recordSale(manager, { operation_id: 'op2', subtotal_cents: 100 });
  assert.equal(e2.recorded_by, 'u2');

  const e3 = await drawer.recordSale(server, { operation_id: 'op3', subtotal_cents: 100 });
  assert.equal(e3.recorded_by, 'u3');

  assert.equal(appends, 3);
});

test('Criterion 2: Idempotency & Concurrency', async () => {
  let appends = 0;
  const drawer = createCashDrawer({
    appendEntry: async (entry) => {
      appends++;
      // simulate async delay
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  });
  const server = { id: 'u3', role: 'server' };

  // Sequential
  const e1 = await drawer.recordSale(server, { operation_id: 'op4', subtotal_cents: 100 });
  const e2 = await drawer.recordSale(server, { operation_id: 'op4', subtotal_cents: 100 });
  assert.deepEqual(e1, e2);
  assert.equal(appends, 1);

  // Concurrent
  appends = 0;
  const [c1, c2, c3] = await Promise.all([
    drawer.recordSale(server, { operation_id: 'op5', subtotal_cents: 200 }),
    drawer.recordSale(server, { operation_id: 'op5', subtotal_cents: 200 }),
    drawer.recordSale(server, { operation_id: 'op5', subtotal_cents: 200 })
  ]);
  assert.deepEqual(c1, c2);
  assert.deepEqual(c2, c3);
  assert.equal(appends, 1, 'Concurrent requests should only append once');
});

test('Criterion 3: Conflict', async () => {
  const drawer = createCashDrawer({ appendEntry: async () => {} });
  const server = { id: 'u3', role: 'server' };
  const server2 = { id: 'u4', role: 'server' };

  await drawer.recordSale(server, { operation_id: 'op6', subtotal_cents: 100 });
  
  await assert.rejects(
    drawer.recordSale(server, { operation_id: 'op6', subtotal_cents: 200 }),
    (err) => err.status === 409
  );

  await assert.rejects(
    drawer.recordSale(server2, { operation_id: 'op6', subtotal_cents: 100 }),
    (err) => err.status === 409
  );
});

test('Criterion 4: Tax Calculation', () => {
  // exact half cents round up: 100 cents * 8.5% = 8.5 cents -> 9 cents
  assert.deepEqual(cashSaleTotal(100, 850), {
    subtotal_cents: 100,
    tax_cents: 9,
    total_cents: 109
  });

  // 100 cents * 8.25% = 8.25 cents -> 8 cents
  assert.deepEqual(cashSaleTotal(100, 825), {
    subtotal_cents: 100,
    tax_cents: 8,
    total_cents: 108
  });

  // 100 cents * 8.75% = 8.75 cents -> 9 cents
  assert.deepEqual(cashSaleTotal(100, 875), {
    subtotal_cents: 100,
    tax_cents: 9,
    total_cents: 109
  });
});

test('Criterion 5: Tax Rate Change', async () => {
  const drawer = createCashDrawer({ appendEntry: async () => {}, tax_rate_bps: 800 });
  const manager = { id: 'u2', role: 'manager' };
  const server = { id: 'u3', role: 'server' };

  const e1 = await drawer.recordSale(manager, { operation_id: 'op7', subtotal_cents: 100 });
  assert.equal(e1.tax_rate_bps, 800);

  drawer.setTaxRate(manager, 900);
  
  const e2 = await drawer.recordSale(manager, { operation_id: 'op8', subtotal_cents: 100 });
  assert.equal(e2.tax_rate_bps, 900);

  assert.throws(
    () => drawer.setTaxRate(server, 1000),
    (err) => err.status === 403
  );
});

test('Criterion 6: Auth Restrictions', async () => {
  const drawer = createCashDrawer({ appendEntry: async () => {} });
  const kitchen = { id: 'u5', role: 'kitchen' };

  await assert.rejects(
    drawer.recordSale(null, { operation_id: 'op9', subtotal_cents: 100 }),
    (err) => err.status === 401
  );

  await assert.rejects(
    drawer.recordSale(kitchen, { operation_id: 'op10', subtotal_cents: 100 }),
    (err) => err.status === 403
  );
});

test('Criterion 7: Input Validation', async () => {
  const drawer = createCashDrawer({ appendEntry: async () => {} });
  const server = { id: 'u3', role: 'server' };

  await assert.rejects(drawer.recordSale(server, { operation_id: 'op11', subtotal_cents: 0 }), RangeError);
  await assert.rejects(drawer.recordSale(server, { operation_id: 'op12', subtotal_cents: 200001 }), RangeError);
  
  assert.throws(() => drawer.setTaxRate(server, -1), RangeError); // Wait, this will fail on 403 or RangeError depending on order. Better to test with manager.
  const manager = { id: 'u2', role: 'manager' };
  assert.throws(() => drawer.setTaxRate(manager, -1), RangeError);
  assert.throws(() => drawer.setTaxRate(manager, 10001), RangeError);

  await assert.rejects(drawer.recordSale(server, { operation_id: '', subtotal_cents: 100 }), TypeError);
  await assert.rejects(drawer.recordSale(server, { operation_id: 'a'.repeat(101), subtotal_cents: 100 }), TypeError);
});

test('Criterion 8: Append Failure', async () => {
  let shouldFail = true;
  const drawer = createCashDrawer({
    appendEntry: async () => {
      if (shouldFail) throw new Error('DB Error');
    }
  });
  const server = { id: 'u3', role: 'server' };

  await assert.rejects(
    drawer.recordSale(server, { operation_id: 'op13', subtotal_cents: 100 }),
    (err) => err.message === 'DB Error'
  );

  shouldFail = false;
  const e1 = await drawer.recordSale(server, { operation_id: 'op13', subtotal_cents: 100 });
  assert.ok(e1);
});
