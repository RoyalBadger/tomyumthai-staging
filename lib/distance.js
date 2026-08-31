// Distance logic. The restaurant origin is the exact address (3313 Belt Line Rd), never a zip.
// Driving distance comes from Google's Distance Matrix API when GOOGLE_MAPS_API_KEY is set;
// otherwise we estimate as straight-line (Haversine) x ROAD_FACTOR, clearly labeled an estimate.
export const RESTAURANT = { lat: 32.94554, lon: -96.67871 }; // 3313 Belt Line Rd, Garland TX 75044
export const ROAD_FACTOR = 1.3; // typical suburban road-distance vs straight-line ratio

export function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** @returns {{miles:number, source:'google'|'estimate'}} driving miles from the restaurant */
export async function drivingMilesFromRestaurant(lat, lon) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (key) {
    try {
      const url = 'https://maps.googleapis.com/maps/api/distancematrix/json'
        + `?origins=${RESTAURANT.lat},${RESTAURANT.lon}`
        + `&destinations=${lat},${lon}&units=imperial&key=${key}`;
      const res = await fetch(url);
      const data = await res.json();
      const el = data?.rows?.[0]?.elements?.[0];
      if (el?.status === 'OK' && el.distance?.value >= 0) {
        return { miles: el.distance.value / 1609.344, source: 'google' };
      }
      console.error('distance matrix non-OK', data?.status, el?.status);
    } catch (e) {
      console.error('distance matrix error', e.message);
    }
  }
  return { miles: haversineMiles(RESTAURANT.lat, RESTAURANT.lon, lat, lon) * ROAD_FACTOR, source: 'estimate' };
}
