import { fetchWithAuth } from './client';
import type { LiveBus, LineVariant } from '../../types/index';

interface LiveBusParams {
  lines?: string[];
  lineVariantIds?: string[];
  busstopId?: number;
}

export async function getLiveBuses(params?: LiveBusParams): Promise<LiveBus[]> {
  try {
    const query = new URLSearchParams();

    if (params?.lines && params.lines.length > 0) {
      query.set('lines', params.lines.join(','));
    }

    if (params?.lineVariantIds && params.lineVariantIds.length > 0) {
      query.set('lineVariantIds', params.lineVariantIds.join(','));
    }

    if (params?.busstopId !== undefined) {
      query.set('busstopId', String(params.busstopId));
    }

    const qs = query.toString();
    const path = `/buses${qs ? `?${qs}` : ''}`;

    const response = await fetchWithAuth(path);

    if (!response.ok) {
      console.error(`getLiveBuses failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const raw: any[] = Array.isArray(data) ? data : [];
    return raw.map((item) => ({
      busId: String(item.busId ?? ''),
      lineId: String(item.lineId ?? item.line ?? ''),
      lineName: String(item.line ?? ''),
      lineVariantId: String(item.lineVariantId ?? ''),
      latitude: item.location?.coordinates?.[1] ?? 0,
      longitude: item.location?.coordinates?.[0] ?? 0,
      speed: item.speed,
      lastUpdate: item.timestamp ?? new Date().toISOString(),
    }));
  } catch (error) {
    console.error('getLiveBuses error:', error);
    return [];
  }
}

export async function getLineVariants(): Promise<LineVariant[]> {
  try {
    const response = await fetchWithAuth('/buses/linevariants');

    if (!response.ok) {
      console.error(`getLineVariants failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const raw: any[] = Array.isArray(data) ? data : [];
    return raw.map((item) => ({
      id: String(item.lineVariantId ?? ''),
      lineId: String(item.lineId ?? ''),
      lineName: String(item.line ?? ''),
      headsign: item.destination ?? item.subline ?? '',
      direction: item.special ? 1 : 0,
    }));
  } catch (error) {
    console.error('getLineVariants error:', error);
    return [];
  }
}

export async function getLineVariant(id: string): Promise<LineVariant | null> {
  try {
    const response = await fetchWithAuth(`/buses/linevariants/${encodeURIComponent(id)}`);

    if (!response.ok) {
      console.error(`getLineVariant failed: ${response.status} ${response.statusText}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`getLineVariant error (id=${id}):`, error);
    return null;
  }
}
