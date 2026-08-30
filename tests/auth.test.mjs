// Password hashing round-trip and negative cases (no DB needed).
// Run: node tests/auth.test.mjs
import { hashPassword, verifyPassword } from '../lib/auth.js';

let fail = 0;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) fail++; };

const pw = 'correct horse battery staple 47';
const stored = await hashPassword(pw);
check('stored format', stored.startsWith('scrypt$16384$8$1$'));
check('verify correct password', await verifyPassword(pw, stored));
check('reject wrong password', !(await verifyPassword('wrong password 47', stored)));
check('reject tampered hash', !(await verifyPassword(pw, stored.slice(0, -4) + 'AAAA')));
check('reject malformed stored value', !(await verifyPassword(pw, 'not-a-hash')));
const stored2 = await hashPassword(pw);
check('unique salts', stored !== stored2 && (await verifyPassword(pw, stored2)));

if (fail) { console.error(`${fail} failing`); process.exit(1); }
console.log('all auth tests pass');
