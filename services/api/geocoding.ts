import { Location } from '../../types';

// Montevideo bounding box for better results
const MVD_VIEWBOX = '-58.5,-34.4,-55.8,-35.1';

interface NominatimResult {
  place_id: number;
  display_name: string;
  name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
  };
}

export async function searchAddress(query: string): Promise<Location[]> {
  if (!query.trim()) return [];
  try {
    const params = new URLSearchParams({
      q: `${query}, Montevideo, Uruguay`,
      format: 'json',
      limit: '8',
      countrycodes: 'uy',
      viewbox: MVD_VIEWBOX,
      bounded: '0',
      addressdetails: '1',
    });
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      { headers: { 'Accept-Language': 'es', 'User-Agent': 'DulceViaje/1.0' } }
    );
    if (!res.ok) return [];
    const data: NominatimResult[] = await res.json();
    return data.map((r) => ({
      name: formatDisplayName(r),
      address: r.display_name,
      latitude: parseFloat(r.lat),
      longitude: parseFloat(r.lon),
    }));
  } catch {
    return [];
  }
}

function formatDisplayName(r: NominatimResult): string {
  const addr = r.address;
  if (!addr) return r.display_name.split(',').slice(0, 2).join(',').trim();
  const parts: string[] = [];
  if (addr.road) {
    parts.push(addr.house_number ? `${addr.road} ${addr.house_number}` : addr.road);
  }
  if (addr.suburb) parts.push(addr.suburb);
  return parts.length > 0 ? parts.join(', ') : r.display_name.split(',')[0];
}
