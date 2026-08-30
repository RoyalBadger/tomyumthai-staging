// TOTP against RFC 6238 Appendix B test vectors (SHA-1) + base32 + verify window.
// Run: node tests/totp.test.mjs
import { base32Encode, base32Decode, verifyTotp } from '../lib/totp.js';

let fail = 0;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) fail++; };

// RFC secret: ASCII "12345678901234567890"
const rfcSecret = base32Encode(Buffer.from('12345678901234567890', 'ascii'));
check('base32 round-trip', base32Decode(rfcSecret).toString('ascii') === '12345678901234567890');

// RFC 6238 SHA-1 vectors: [unix seconds, last 6 digits of expected TOTP]
const vectors = [
  [59, '287082'],
  [1111111109, '081804'],
  [1111111111, '050471'],
  [1234567890, '005924'],
  [2000000000, '279037'],
  [20000000000, '353130'],
];
for (const [t, code] of vectors) {
  check(`RFC vector t=${t}`, verifyTotp(rfcSecret, code, { now: t * 1000, window: 0 }));
}

// Window behavior: previous step accepted with window=1, rejected with window=0
check('window=1 accepts previous step', verifyTotp(rfcSecret, '287082', { now: 89 * 1000, window: 1 }));
check('window=0 rejects previous step', !verifyTotp(rfcSecret, '287082', { now: 91 * 1000, window: 0 }));

// Garbage input
check('rejects non-numeric', !verifyTotp(rfcSecret, 'abcdef', { now: 59 * 1000 }));
check('rejects wrong code', !verifyTotp(rfcSecret, '000000', { now: 59 * 1000, window: 0 }));

if (fail) { console.error(`${fail} failing`); process.exit(1); }
console.log('all totp tests pass');
