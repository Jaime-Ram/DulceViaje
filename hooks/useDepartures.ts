import { useState, useEffect, useCallback, useRef } from 'react';
import { UpcomingBus } from '../types/index';
import { getUpcomingBuses } from '../services/api/stops';

const REFRESH_INTERVAL_MS = 30_000;

interface UseDeparturesResult {
  departures: UpcomingBus[];
  loading: boolean;
  error: string | null;
  refresh(): void;
}

export default function useDepartures(
  stopId: number | null,
  stopLat?: number,
  stopLon?: number
): UseDeparturesResult {
  const [departures, setDepartures] = useState<UpcomingBus[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDepartures = useCallback(async () => {
    if (stopId === null) {
      setDepartures([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getUpcomingBuses(stopId, undefined, 5, stopLat, stopLon);
      setDepartures(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch departures.');
    } finally {
      setLoading(false);
    }
  }, [stopId]);

  useEffect(() => {
    fetchDepartures();

    if (stopId !== null) {
      intervalRef.current = setInterval(fetchDepartures, REFRESH_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchDepartures, stopId]);

  return { departures, loading, error, refresh: fetchDepartures };
}
