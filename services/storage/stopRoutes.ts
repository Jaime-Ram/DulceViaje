// Pre-built stop data from GTFS (lines + coordinates + name)
// Generated from google_transit.zip — refresh periodically
interface StopData {
  lines: string[];
  lat: number;
  lon: number;
  name: string;
}

const stopData = require('../../assets/stop_data.json') as Record<string, StopData>;

export function getLinesForStop(stopId: number): string[] {
  return stopData[String(stopId)]?.lines ?? [];
}

export function getStopCoords(stopId: number): { lat: number; lon: number } | null {
  const d = stopData[String(stopId)];
  return d ? { lat: d.lat, lon: d.lon } : null;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface NearbyStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  lines: string[];
  distanceMeters: number;
}

export function findNearbyStops(lat: number, lon: number, maxMeters: number): NearbyStop[] {
  const result: NearbyStop[] = [];
  for (const [id, d] of Object.entries(stopData)) {
    if (!d.lat || !d.lon) continue;
    const dist = haversineMeters(lat, lon, d.lat, d.lon);
    if (dist <= maxMeters) {
      result.push({ id, name: d.name, lat: d.lat, lon: d.lon, lines: d.lines, distanceMeters: dist });
    }
  }
  result.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return result;
}

export { haversineMeters };
