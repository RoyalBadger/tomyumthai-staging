// Distance logic. The restaurant origin is the exact address (3313 Belt Line Rd), never a zip.
// Driving distance comes from Google's Routes API (computeRouteMatrix) when
// GOOGLE_MAPS_API_KEY is set; otherwise we estimate as straight-line (Haversine)
// x ROAD_FACTOR, clearly labeled an estimate. (The legacy Distance Matrix API cannot be
// enabled on new Google Cloud projects, so we use the modern Routes API.)
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
export async function drivingMilesFromRestaurant(lat, lon, { allowGoogle = true } = {}) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (key && allowGoogle) {
    try {
      const res = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'originIndex,destinationIndex,distanceMeters,condition',
        },
        body: JSON.stringify({
          origins: [{ waypoint: { location: { latLng: { latitude: RESTAURANT.lat, longitude: RESTAURANT.lon } } } }],
          destinations: [{ waypoint: { location: { latLng: { latitude: lat, longitude: lon } } } }],
          travelMode: 'DRIVE',
        }),
      });
      const data = await res.json();
      const el = Array.isArray(data) ? data[0] : null;
      if (el && el.condition === 'ROUTE_EXISTS' && typeof el.distanceMeters === 'number') {
        return { miles: el.distanceMeters / 1609.344, source: 'google' };
      }
      console.error('routes matrix non-OK', JSON.stringify(el || data).slice(0, 300));
    } catch (e) {
      console.error('routes matrix error', e.message);
    }
  }
  return { miles: haversineMiles(RESTAURANT.lat, RESTAURANT.lon, lat, lon) * ROAD_FACTOR, source: 'estimate' };
}
