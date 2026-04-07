import { useState, useEffect, useCallback } from 'react';
import { BusStop } from '../types/index';
import { getAllStops } from '../services/api/stops';

// Module-level cache shared across all hook instances
let stopsCache: BusStop[] | null = null;
let fetchPromise: Promise<BusStop[]> | null = null;

interface UseStopsResult {
  stops: BusStop[];
  loading: boolean;
  error: string | null;
  searchStops(query: string): BusStop[];
}

export default function useStops(): UseStopsResult {
  const [stops, setStops] = useState<BusStop[]>(stopsCache ?? []);
  const [loading, setLoading] = useState<boolean>(stopsCache === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Already cached — nothing to do
    if (stopsCache !== null) {
      setStops(stopsCache);
      setLoading(false);
      return;
    }

    // Reuse an in-flight request if one exists
    if (fetchPromise === null) {
      fetchPromise = getAllStops();
    }

    let cancelled = false;

    fetchPromise
      .then((data) => {
        stopsCache = data;
        fetchPromise = null;
        if (!cancelled) {
          setStops(data);
        }
      })
      .catch((err) => {
        fetchPromise = null;
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch stops.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const searchStops = useCallback(
    (query: string): BusStop[] => {
      if (!query.trim()) return stops;
      const lower = query.toLowerCase();
      return stops.filter((stop) => stop.name.toLowerCase().includes(lower));
    },
    [stops]
  );

  return { stops, loading, error, searchStops };
}
