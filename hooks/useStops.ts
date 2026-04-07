import { useCallback } from 'react';
import { BusStop } from '../types/index';

// Load stop data from local GTFS JSON — no API call needed
const rawStops = require('../assets/stop_data.json') as Record<
  string,
  { lines: string[]; lat: number; lon: number; name: string }
>;

// Build a flat list once at module level (instant, no network)
const allStops: BusStop[] = Object.entries(rawStops).map(([id, d]) => ({
  id: Number(id),
  name: d.name,
  latitude: d.lat,
  longitude: d.lon,
  lines: d.lines,
}));

interface UseStopsResult {
  stops: BusStop[];
  loading: boolean;
  error: string | null;
  searchStops(query: string): BusStop[];
}

export default function useStops(): UseStopsResult {
  const searchStops = useCallback((query: string): BusStop[] => {
    if (!query.trim()) return [];
    const lower = query.toLowerCase();
    return allStops
      .filter((stop) => stop.name.toLowerCase().includes(lower))
      .slice(0, 12);
  }, []);

  return { stops: allStops, loading: false, error: null, searchStops };
}
