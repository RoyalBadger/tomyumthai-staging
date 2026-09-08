// Unit tests for lib/hours.js against the confirmed schedule (menu PDF Rev. 09-2025).
// Run: node tests/hours.test.mjs
import { orderingWindow, nextOpening } from '../lib/hours.js';

const H = {
  '0': [['12:00', '22:00']],
  '1': [['17:00', '21:30']],
  '2': [['11:00', '14:30'], ['17:00', '21:30']],
  '3': [['11:00', '14:30'], ['17:00', '21:30']],
  '4': [['11:00', '14:30'], ['17:00', '21:30']],
  '5': [['11:00', '14:30'], ['17:00', '22:00']],
  '6': [['12:00', '22:00']],
};

// Dates below are CDT (UTC-5). If adding winter cases, use -06:00 offsets (CST).
const at = iso => new Date(iso + '-05:00');

const cases = [
  ['Tue 12:00 lunch open',     at('2026-09-01T12:00:00'), true,  'open'],
  ['Tue 14:15 within buffer',  at('2026-09-01T14:15:00'), false, 'closing_soon'],
  ['Tue 15:00 between shifts', at('2026-09-01T15:00:00'), false, 'before_open'],
  ['Mon 12:00 no lunch',       at('2026-08-31T12:00:00'), false, 'before_open'],
  ['Mon 18:00 dinner open',    at('2026-08-31T18:00:00'), true,  'open'],
  ['Mon 21:20 within buffer',  at('2026-08-31T21:20:00'), false, 'closing_soon'],
  ['Fri 21:35 still open',     at('2026-09-04T21:35:00'), true,  'open'],
  ['Fri 21:45 within buffer',  at('2026-09-04T21:45:00'), false, 'closing_soon'],
  ['Sat 12:30 open',           at('2026-09-05T12:30:00'), true,  'open'],
  ['Sat 22:30 closed',         at('2026-09-05T22:30:00'), false, 'closed_now'],
  ['Sun 11:00 before open',    at('2026-09-06T11:00:00'), false, 'before_open'],
  ['Empty day config',         at('2026-09-01T12:00:00'), false, 'closed_today', {}],
];

let fail = 0;
for (const [name, d, expOpen, expReason, hours] of cases) {
  const r = orderingWindow(hours ?? H, 20, d);
  const ok = r.open === expOpen && r.reason === expReason;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  -> ${JSON.stringify(r)}`);
}
// nextOpening: what the cart tells a customer who is shopping while closed
const nextCases = [
  ['Mon 12:00 → today 5:00 PM',            at('2026-08-31T12:00:00'), [], 'today at 5:00 PM'],
  ['Tue 15:00 between shifts → today 5 PM', at('2026-09-01T15:00:00'), [], 'today at 5:00 PM'],
  ['Mon 21:20 in buffer → tomorrow 11 AM',  at('2026-08-31T21:20:00'), [], 'tomorrow at 11:00 AM'],
  ['Sat 23:00 → tomorrow 12:00 PM',         at('2026-09-05T23:00:00'), [], 'tomorrow at 12:00 PM'],
  ['Tue 15:00 with Wed holiday → today',    at('2026-09-01T15:00:00'), ['2026-09-02'], 'today at 5:00 PM'],
  ['Tue 23:00 with Wed holiday → Thursday', at('2026-09-01T23:00:00'), ['2026-09-02'], 'Thursday at 11:00 AM'],
];
for (const [name, date, holidays, expected] of nextCases) {
  const r = nextOpening(H, holidays, date);
  const ok = r && r.label === expected;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  -> ${JSON.stringify(r)}`);
}
{
  const r = nextOpening({}, [], at('2026-09-01T12:00:00'));
  const ok = r === null; if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  no hours at all -> null`);
}

if (fail) { console.error(`${fail} failing`); process.exit(1); }
console.log('all hours tests pass');
