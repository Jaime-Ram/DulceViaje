import { fetchWithAuth } from './client';
import type { BusStop, BusLine, UpcomingBus } from '../../types/index';
import { getLinesForStop, getStopCoords } from '../storage/stopRoutes';

const DEFAULT_RADIUS_METERS = 500;
const DEFAULT_AMOUNT_PER_LINE = 5;

// Haversine distance in metres between two lat/lon points
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function mapStop(raw: any): BusStop {
  const coords = raw.location?.coordinates ?? [0, 0];
  const street1 = raw.street1 ?? '';
  const street2 = raw.street2 ?? '';
  const name = street2 ? `${street1} y ${street2}` : street1;
  return {
    id: raw.busstopId,
    name,
    latitude: coords[1],  // GeoJSON: [lon, lat]
    longitude: coords[0],
  };
}

export async function getAllStops(): Promise<BusStop[]> {
  try {
    const response = await fetchWithAuth('/buses/busstops');
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data.map(mapStop) : [];
  } catch (error) {
    console.error('getAllStops error:', error);
    return [];
  }
}

export function getStopLines(stopId: number): string[] {
  // Uses local GTFS-derived lookup (API endpoint is unreliable)
  return getLinesForStop(stopId);
}

// Average bus speed in Montevideo (km/h) used when bus speed is 0 or unavailable
const AVG_BUS_SPEED_KMH = 18;

function busesToDepartures(
  raw: any[],
  stopLat: number,
  stopLon: number,
  maxDistMeters: number,
  amountPerLine: number
): UpcomingBus[] {
  const byLine: Record<string, any[]> = {};
  for (const bus of raw) {
    const line = String(bus.line ?? '');
    if (!line) continue;
    if (!byLine[line]) byLine[line] = [];
    byLine[line].push(bus);
  }

  const results: UpcomingBus[] = [];
  for (const [line, buses] of Object.entries(byLine)) {
    const sorted = buses
      .map((bus) => {
        const busLat = bus.location?.coordinates?.[1] ?? 0;
        const busLon = bus.location?.coordinates?.[0] ?? 0;
        const distMeters = haversineDistance(stopLat, stopLon, busLat, busLon);
        const speedKmh = (bus.speed ?? 0) > 2 ? bus.speed : AVG_BUS_SPEED_KMH;
        const etaMinutes = (distMeters / 1000 / speedKmh) * 60;
        return { bus, distMeters, etaMinutes };
      })
      .filter((x) => x.distMeters < maxDistMeters)
      .sort((a, b) => a.distMeters - b.distMeters)
      .slice(0, amountPerLine);

    for (const { bus, etaMinutes } of sorted) {
      results.push({
        lineId: String(bus.lineId ?? bus.line ?? ''),
        lineName: String(bus.line ?? ''),
        lineVariantId: String(bus.lineVariantId ?? ''),
        headsign: bus.destination ?? bus.subline ?? '',
        eta: etaMinutes * 60,
        etaMinutes,
        busId: bus.busId != null ? String(bus.busId) : undefined,
        latitude: bus.location?.coordinates?.[1],
        longitude: bus.location?.coordinates?.[0],
        isRealtime: true,
      });
    }
  }
  return results.sort((a, b) => a.etaMinutes - b.etaMinutes);
}

export async function getUpcomingBuses(
  stopId: number,
  lines?: string[],
  amountPerLine: number = DEFAULT_AMOUNT_PER_LINE,
  stopLat?: number,
  stopLon?: number
): Promise<UpcomingBus[]> {
  // Resolve stop coordinates: prefer passed-in values, fall back to GTFS
  const coords = getStopCoords(stopId);
  const lat = stopLat ?? coords?.lat ?? 0;
  const lon = stopLon ?? coords?.lon ?? 0;
  const hasCoords = lat !== 0 && lon !== 0;

  try {
    // ── Strategy 1: query by busstopId directly (most direct API parameter) ──
    const byStopRes = await fetchWithAuth(`/buses?busstopId=${stopId}`);
    if (byStopRes.ok) {
      const byStopRaw: any[] = await byStopRes.json().catch(() => []);
      if (Array.isArray(byStopRaw) && byStopRaw.length > 0) {
        const maxDist = hasCoords ? 15000 : Infinity;
        const departures = busesToDepartures(byStopRaw, lat, lon, maxDist, amountPerLine);
        if (departures.length > 0) return departures;
      }
    }

    // ── Strategy 2: query by GTFS lines ──────────────────────────────────────
    const resolvedLines = lines && lines.length > 0 ? lines : getStopLines(stopId);
    if (resolvedLines.length > 0) {
      const params = new URLSearchParams();
      resolvedLines.slice(0, 20).forEach((l) => params.append('lines', l));
      const byLinesRes = await fetchWithAuth(`/buses?${params.toString()}`);
      if (byLinesRes.ok) {
        const byLinesRaw: any[] = await byLinesRes.json().catch(() => []);
        if (Array.isArray(byLinesRaw) && byLinesRaw.length > 0 && hasCoords) {
          const departures = busesToDepartures(byLinesRaw, lat, lon, 12000, amountPerLine);
          if (departures.length > 0) return departures;
        }
      }
    }

    // ── Strategy 3: all buses, filter by distance ─────────────────────────────
    if (hasCoords) {
      const allRes = await fetchWithAuth('/buses');
      if (allRes.ok) {
        const allRaw: any[] = await allRes.json().catch(() => []);
        if (Array.isArray(allRaw) && allRaw.length > 0) {
          return busesToDepartures(allRaw, lat, lon, 3000, amountPerLine);
        }
      }
    }

    return [];
  } catch (error) {
    console.error(`getUpcomingBuses error (stopId=${stopId}):`, error);
    return [];
  }
}

export async function getNearbyStops(
  lat: number,
  lon: number,
  radiusMeters: number = DEFAULT_RADIUS_METERS
): Promise<BusStop[]> {
  try {
    const allStops = await getAllStops();

    return allStops.filter((stop) => {
      const distance = haversineDistance(lat, lon, stop.latitude, stop.longitude);
      return distance <= radiusMeters;
    });
  } catch (error) {
    console.error('getNearbyStops error:', error);
    return [];
  }
}
