// Tests for Stripe form encoding and input validation helpers (no network, no DB).
// Run: node tests/stripe.test.mjs
import { formEncode } from '../lib/stripe.js';
import { normalizePhoneUS, cleanName, cleanLine } from '../lib/validate.js';

let fail = 0;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) fail++; };

// form encoding (Stripe's bracket style)
check('flat params', formEncode({ amount: 3678, currency: 'usd' }) === 'amount=3678&currency=usd');
check('nested object', formEncode({ automatic_payment_methods: { enabled: true } })
  === 'automatic_payment_methods%5Benabled%5D=true');
check('metadata keys', formEncode({ metadata: { order_id: 'abc-123', order_code: 'TYT-2026-0001' } })
  === 'metadata%5Border_id%5D=abc-123&metadata%5Border_code%5D=TYT-2026-0001');
check('skips null/undefined', formEncode({ a: 1, b: null, c: undefined }) === 'a=1');
check('encodes special chars', formEncode({ description: 'Tom Yum #1 & more' })
  === 'description=Tom%20Yum%20%231%20%26%20more');
check('array of scalars', formEncode({ expand: ['latest_charge'] }) === 'expand%5B0%5D=latest_charge');

// phone normalization
check('formats (214) 703-0391', normalizePhoneUS('(214) 703-0391') === '+12147030391');
check('accepts 1-prefixed 11 digits', normalizePhoneUS('1 214 703 0391') === '+12147030391');
check('accepts dotted', normalizePhoneUS('214.703.0391') === '+12147030391');
check('rejects 9 digits', normalizePhoneUS('214703039') === null);
check('rejects leading 0 area', normalizePhoneUS('014 703 0391') === null);
check('rejects leading 1 area', normalizePhoneUS('114 703 0391') === null);
check('rejects empty', normalizePhoneUS('') === null);

// names / lines
check('cleans name whitespace', cleanName('  Shawn   T  ') === 'Shawn T');
check('rejects empty name', cleanName('   ') === null);
check('rejects 81-char name', cleanName('x'.repeat(81)) === null);
check('flattens newlines in address', cleanLine('123 Main St\nApt 4') === '123 Main St, Apt 4');

if (fail) { console.error(`${fail} failing`); process.exit(1); }
console.log('all stripe/validate tests pass');
