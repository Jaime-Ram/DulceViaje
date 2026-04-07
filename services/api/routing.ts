// OSRM public routing API — no key required
// Docs: http://project-osrm.org/docs/v5.24.0/api/
const OSRM_BASE = 'https://router.project-osrm.org/route/v1';

export interface RouteCoord {
  latitude: number;
  longitude: number;
}

async function fetchOSRMRoute(
  profile: 'foot' | 'driving',
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): Promise<RouteCoord[]> {
  // Skip if coordinates are missing / at origin
  if (!from.latitude || !from.longitude || !to.latitude || !to.longitude) return [];
  if (from.latitude === 0 || to.latitude === 0) return [];

  const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const url = `${OSRM_BASE}/${profile}/${coords}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DulceViaje/1.0' },
    });
    if (!res.ok) return fallback(from, to);

    const data = await res.json();
    const coords2d: [number, number][] = data?.routes?.[0]?.geometry?.coordinates ?? [];
    if (coords2d.length === 0) return fallback(from, to);

    // GeoJSON coords are [lon, lat] — flip for react-native-maps
    return coords2d.map(([lon, lat]) => ({ latitude: lat, longitude: lon }));
  } catch {
    return fallback(from, to);
  }
}

// Fallback: straight line between two points
function fallback(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): RouteCoord[] {
  return [
    { latitude: from.latitude, longitude: from.longitude },
    { latitude: to.latitude, longitude: to.longitude },
  ];
}

// Walking follows streets but ignores one-way restrictions (foot profile)
export function getWalkingRoute(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): Promise<RouteCoord[]> {
  return fetchOSRMRoute('foot', from, to);
}

// Buses must follow street direction — use OSRM driving profile
export async function getBusRoute(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): Promise<RouteCoord[]> {
  return fetchOSRMRoute('driving', from, to);
}
