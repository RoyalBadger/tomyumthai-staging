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

/** Geocode a full delivery address via Photon (free). Falls back to the street
 *  portion if the full string finds nothing (Photon chokes on some suffixes).
 *  Returns {lat, lon} of the nearest plausible Texas match, or null. */
export async function geocodeAddress(text) {
  const attempt = async q => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3500);
    try {
      const url = 'https://photon.komoot.io/api/?limit=5&lat=' + RESTAURANT.lat + '&lon=' + RESTAURANT.lon
        + '&q=' + encodeURIComponent(q);
      const res = await fetch(url, { signal: ctl.signal });
      const j = await res.json();
      return (j.features || [])
        .map(f => ({
          lat: f.geometry?.coordinates?.[1], lon: f.geometry?.coordinates?.[0],
          state: f.properties?.state || '',
        }))
        .filter(f => Number.isFinite(f.lat) && Number.isFinite(f.lon))
        .filter(f => f.state === 'Texas' || haversineMiles(RESTAURANT.lat, RESTAURANT.lon, f.lat, f.lon) < 60)
        .sort((a, b) => haversineMiles(RESTAURANT.lat, RESTAURANT.lon, a.lat, a.lon)
                      - haversineMiles(RESTAURANT.lat, RESTAURANT.lon, b.lat, b.lon))[0] || null;
    } catch (e) {
      console.error('geocode error', e.message);
      return null;
    } finally { clearTimeout(t); }
  };
  const full = await attempt(text);
  if (full) return full;
  const street = String(text).split(',')[0].trim();
  return street && street !== text ? attempt(street) : null;
}

/** Server-side delivery-zone gate, run BEFORE any order or payment is created.
 *  Coordinates come from our own geocode of the submitted address; the client's
 *  verified-suggestion coords are only a fallback when geocoding fails. If the
 *  distance simply cannot be determined, we fail OPEN (the kitchen still sees
 *  the address on the ticket) rather than reject a real customer. */
export async function checkDeliveryZone(address, clientLat, clientLon, radiusMiles) {
  let coords = await geocodeAddress(address);
  let method = 'geocode';
  const saneClient = Number.isFinite(clientLat) && Number.isFinite(clientLon)
    && clientLat > 25 && clientLat < 40 && clientLon > -110 && clientLon < -90;
  if (!coords && saneClient) { coords = { lat: clientLat, lon: clientLon }; method = 'client'; }
  if (!coords) return { blocked: false, checked: false, method: 'unresolved' };
  const d = await drivingMilesFromRestaurant(coords.lat, coords.lon);
  return {
    blocked: d.miles > Number(radiusMiles) + 0.2,
    miles: Math.round(d.miles * 10) / 10,
    source: d.source, checked: true, method,
  };
}
