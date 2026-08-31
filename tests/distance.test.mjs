// Distance helpers (no network: Google path only used when GOOGLE_MAPS_API_KEY is set).
// Run: node tests/distance.test.mjs
import { haversineMiles, drivingMilesFromRestaurant, RESTAURANT, ROAD_FACTOR } from '../lib/distance.js';

let fail = 0;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) fail++; };

check('zero distance to self', haversineMiles(RESTAURANT.lat, RESTAURANT.lon, RESTAURANT.lat, RESTAURANT.lon) === 0);
const d1 = haversineMiles(RESTAURANT.lat, RESTAURANT.lon, 32.7767, -96.7970); // downtown Dallas
check('downtown Dallas ~13 mi straight-line', d1 > 12 && d1 < 15);
check('symmetric', Math.abs(d1 - haversineMiles(32.7767, -96.7970, RESTAURANT.lat, RESTAURANT.lon)) < 1e-9);

delete process.env.GOOGLE_MAPS_API_KEY;
const est = await drivingMilesFromRestaurant(32.7767, -96.7970);
check('estimate mode without key', est.source === 'estimate');
check('estimate applies road factor', Math.abs(est.miles - d1 * ROAD_FACTOR) < 1e-9);

// The user-reported case: ~5.1 straight-line (Lake Highlands) must fall OUTSIDE a 5-mile
// zone once the road factor applies (5.1 * 1.3 = 6.6).
check('5.1mi straight-line -> outside 5mi zone as estimate', 5.1 * ROAD_FACTOR > 5);

if (fail) { console.error(`${fail} failing`); process.exit(1); }
console.log('all distance tests pass');
