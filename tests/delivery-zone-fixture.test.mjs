// Fixture contract only; no geocoding, routing service, or database calls.
// Run: node tests/delivery-zone-fixture.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const entries = JSON.parse(await readFile(
  new URL('./fixtures/delivery-zone-edge-cases.json', import.meta.url), 'utf8',
));

assert.ok(Array.isArray(entries), 'delivery-zone fixture must be an array');
assert.ok(entries.length >= 3, 'delivery-zone fixture needs at least three entries');

for (const [index, entry] of entries.entries()) {
  const context = `delivery-zone fixture entry ${index + 1}`;
  assert.ok(entry && typeof entry === 'object' && !Array.isArray(entry), `${context}: must be an object`);
  for (const field of ['label', 'address', 'expected', 'note']) {
    assert.ok(Object.hasOwn(entry, field), `${context}: missing ${field}`);
    assert.equal(typeof entry[field], 'string', `${context}: ${field} must be a string`);
    assert.ok(entry[field].trim(), `${context}: ${field} must not be blank`);
  }
  assert.ok(['inside', 'outside'].includes(entry.expected), `${context}: expected must be inside or outside`);
  console.log(`PASS  delivery-zone fixture: ${entry.label}`);
}

console.log('all delivery-zone fixture tests pass');
