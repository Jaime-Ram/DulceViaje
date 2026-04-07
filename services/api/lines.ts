import { fetchWithAuth } from './client';
import { LiveBus, LineVariant } from '../../types';

// All line variants from /linevariants, cached in memory
let variantsCache: LineVariant[] | null = null;

async function getAllVariants(): Promise<LineVariant[]> {
  if (variantsCache) return variantsCache;
  try {
    const res = await fetchWithAuth('/buses/linevariants');
    if (!res.ok) return [];
    const raw: any[] = await res.json();
    variantsCache = raw.map((item) => ({
      id: String(item.lineVariantId),
      lineId: String(item.lineId ?? ''),
      lineName: String(item.line ?? ''),
      headsign: item.destination ?? item.subline ?? '',
      direction: item.special ? 1 : 0,
    }));
    return variantsCache;
  } catch {
    return [];
  }
}

export async function searchLines(query: string): Promise<LineVariant[]> {
  if (!query.trim()) return [];
  const all = await getAllVariants();
  const q = query.trim().toUpperCase();
  // Deduplicate by lineName+headsign
  const seen = new Set<string>();
  return all
    .filter((v) => v.lineName.toUpperCase().startsWith(q) || v.lineName.toUpperCase().includes(q))
    .filter((v) => {
      const key = `${v.lineName}-${v.headsign}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

export async function getLiveBusesForLine(lineName: string): Promise<LiveBus[]> {
  try {
    const res = await fetchWithAuth(`/buses?lines=${encodeURIComponent(lineName)}`);
    if (!res.ok) return [];
    const raw: any[] = await res.json();
    return raw.map((item) => ({
      busId: String(item.busId ?? ''),
      lineId: String(item.lineId ?? item.line ?? ''),
      lineName: String(item.line ?? ''),
      lineVariantId: String(item.lineVariantId ?? ''),
      latitude: item.location?.coordinates?.[1] ?? 0,
      longitude: item.location?.coordinates?.[0] ?? 0,
      speed: item.speed,
      lastUpdate: item.timestamp ?? new Date().toISOString(),
      destination: item.destination,
      origin: item.origin,
    } as LiveBus & { destination?: string; origin?: string }));
  } catch {
    return [];
  }
}

export async function getVariantsForLine(lineName: string): Promise<LineVariant[]> {
  const all = await getAllVariants();
  return all.filter((v) => v.lineName === lineName);
}
