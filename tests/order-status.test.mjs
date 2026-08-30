// Status lifecycle rules. Run: node tests/order-status.test.mjs
import { canTransition } from '../lib/order-status.js';

let fail = 0;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) fail++; };

check('received -> cooking', canTransition('received', 'cooking'));
check('received -> canceled', canTransition('received', 'canceled'));
check('cooking -> ready', canTransition('cooking', 'ready'));
check('cooking -> canceled', canTransition('cooking', 'canceled'));
check('ready -> completed', canTransition('ready', 'completed'));
check('no skip received -> ready', !canTransition('received', 'ready'));
check('no skip received -> completed', !canTransition('received', 'completed'));
check('no backwards cooking -> received', !canTransition('cooking', 'received'));
check('no reopening completed', !canTransition('completed', 'cooking'));
check('no resurrecting canceled', !canTransition('canceled', 'received'));
check('kitchen cannot touch pending_payment', !canTransition('pending_payment', 'received'));
check('unknown status rejected', !canTransition('bogus', 'cooking'));

if (fail) { console.error(`${fail} failing`); process.exit(1); }
console.log('all order-status tests pass');
