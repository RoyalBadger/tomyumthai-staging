// GET /api/distance?lat=..&lon=.. — driving distance from the restaurant to a point,
// and whether it falls inside the delivery radius (settings.delivery_radius_miles).
// Uses Google Distance Matrix when GOOGLE_MAPS_API_KEY is set; otherwise a labeled estimate.
import { query } from '../lib/db.js';
import { rateLimit, clientIp } from '../lib/auth.js';
import { drivingMilesFromRestaurant, RESTAURANT, haversineMiles } from '../lib/distance.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  res.setHeader('Cache-Control', 'no-store');

  const lat = Number(req.query?.lat);
  const lon = Number(req.query?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)
    || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: 'lat and lon required' });
  }
  // sanity: only answer for points loosely near DFW (blocks abuse as a free geo proxy)
  if (haversineMiles(RESTAURANT.lat, RESTAURANT.lon, lat, lon) > 100) {
    return res.status(400).json({ error: 'destination too far away' });
  }
  if (!(await rateLimit(`dist:ip:${clientIp(req)}`, 30, 600))) {
    return res.status(429).json({ error: 'too many requests' });
  }

  const radius = Number((await query('SELECT delivery_radius_miles FROM settings', []))
    .rows[0].delivery_radius_miles);
  // Global spend guards enforced by OUR code, independent of Google console settings:
  // a daily cap AND a monthly cap kept below Google's free allowance, so the bill is $0
  // by construction. Past either cap (or on any Google failure) we serve the labeled
  // straight-line estimate instead — customers never see breakage.
  const DAILY_GOOGLE_CAP = Number(process.env.GOOGLE_DAILY_CAP || 500);
  const MONTHLY_GOOGLE_CAP = Number(process.env.GOOGLE_MONTHLY_CAP || 9000);
  const month = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }).slice(0, 7);
  const dailyOk = await rateLimit('google-distance:daily:global', DAILY_GOOGLE_CAP, 86_400);
  const monthlyOk = await rateLimit(`google-distance:month:${month}`, MONTHLY_GOOGLE_CAP, 32 * 86_400);
  const allowGoogle = dailyOk && monthlyOk;
  const { miles, source } = await drivingMilesFromRestaurant(lat, lon, { allowGoogle });

  res.status(200).json({
    miles: Math.round(miles * 10) / 10,
    source, // 'google' = real driving distance; 'estimate' = straight-line x road factor
    radius_miles: radius,
    in_zone: miles <= radius,
  });
}
