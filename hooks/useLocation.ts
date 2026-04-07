import { useState, useEffect } from 'react';
import * as ExpoLocation from 'expo-location';

interface Coords {
  latitude: number;
  longitude: number;
}

interface UseLocationResult {
  location: Coords | null;
  loading: boolean;
  error: string | null;
  permissionGranted: boolean;
  getCurrentLocation(): Promise<Coords>;
  watchLocation(callback: (coords: Coords) => void): () => void;
}

export default function useLocation(): UseLocationResult {
  const [location, setLocation] = useState<Coords | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    async function requestPermission() {
      try {
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (cancelled) return;

        if (status !== 'granted') {
          setPermissionGranted(false);
          setError('Location permission was not granted.');
          setLoading(false);
          return;
        }

        setPermissionGranted(true);

        const position = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.Balanced,
        });

        if (!cancelled) {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to get location.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    requestPermission();

    return () => {
      cancelled = true;
    };
  }, []);

  async function getCurrentLocation(): Promise<Coords> {
    const { status } = await ExpoLocation.getForegroundPermissionsAsync();

    if (status !== 'granted') {
      const { status: newStatus } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (newStatus !== 'granted') {
        throw new Error('Location permission not granted.');
      }
      setPermissionGranted(true);
    }

    const position = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.High,
    });

    const coords: Coords = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };

    setLocation(coords);
    return coords;
  }

  function watchLocation(callback: (coords: Coords) => void): () => void {
    let subscription: ExpoLocation.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await ExpoLocation.getForegroundPermissionsAsync();
        if (status !== 'granted') return;

        subscription = await ExpoLocation.watchPositionAsync(
          {
            accuracy: ExpoLocation.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          (pos) => {
            const coords: Coords = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            };
            setLocation(coords);
            callback(coords);
          }
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to watch location.');
      }
    })();

    return () => {
      subscription?.remove();
    };
  }

  return { location, loading, error, permissionGranted, getCurrentLocation, watchLocation };
}
