import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Colors } from '../constants/colors';
import { Theme } from '../constants/theme';
import { useJourneyStore } from '../store/useJourneyStore';
import { getLiveBusesForLine } from '../services/api/lines';
import { getWalkingRoute, getBusRoute, RouteCoord } from '../services/api/routing';
import { formatTime, formatDuration } from '../utils/time';
import { Journey, JourneyLeg, LiveBus } from '../types';

// ── Color helpers ─────────────────────────────────────────────────────────────

const PALETTE = ['#E53E3E', '#38A169', '#D69E2E', '#0055B3', '#805AD5', '#DD6B20', '#00897B', '#C2185B'];
function lineColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % PALETTE.length;
  return PALETTE[h];
}

// ── Haversine distance (meters) ───────────────────────────────────────────────

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Find closest live bus to a set of stop coords ────────────────────────────

function closestBus(
  buses: LiveBus[],
  legFrom: { latitude: number; longitude: number },
  legTo: { latitude: number; longitude: number }
): LiveBus | null {
  if (buses.length === 0) return null;
  // Midpoint of the bus leg
  const midLat = (legFrom.latitude + legTo.latitude) / 2;
  const midLon = (legFrom.longitude + legTo.longitude) / 2;
  let best: LiveBus | null = null;
  let bestDist = Infinity;
  for (const b of buses) {
    if (!b.latitude || !b.longitude) continue;
    const d = haversineM(b.latitude, b.longitude, midLat, midLon);
    if (d < bestDist) { bestDist = d; best = b; }
  }
  return best;
}

// ── ETA string ────────────────────────────────────────────────────────────────

function etaString(bus: LiveBus | null, leg: JourneyLeg): string {
  if (!bus) return '—';
  const dist = haversineM(bus.latitude, bus.longitude, leg.from.latitude, leg.from.longitude);
  const speed = (bus.speed && bus.speed > 2) ? bus.speed : 18; // km/h
  const mins = Math.round((dist / 1000 / speed) * 60);
  if (mins <= 1) return 'Llegando';
  return `${mins} min`;
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function LiveTripScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const journey = useJourneyStore((s) => s.activeJourney ?? s.selectedJourney);
  const setActiveJourney = useJourneyStore((s) => s.setActiveJourney);

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [trackedBus, setTrackedBus] = useState<LiveBus | null>(null);
  const [legRoutes, setLegRoutes] = useState<RouteCoord[][]>([]);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [busLoading, setBusLoading] = useState(false);
  const [followUser, setFollowUser] = useState(true);

  // Find the first bus leg in the journey
  const busLeg = journey?.legs.find((l) => l.type === 'bus') ?? null;
  const walkLeg = journey?.legs[0]?.type === 'walk' ? journey.legs[0] : null;

  // ── Navigation header ──────────────────────────────────────────────────────
  useEffect(() => {
    navigation.setOptions({
      title: 'Volg je reis',
      headerStyle: { backgroundColor: Colors.primary },
      headerTintColor: Colors.white,
    });
  }, [navigation]);

  // ── GPS location subscription ──────────────────────────────────────────────
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 3000 },
        (loc) => {
          const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setUserLocation(coord);
          if (followUser && mapRef.current) {
            mapRef.current.animateToRegion(
              { ...coord, latitudeDelta: 0.01, longitudeDelta: 0.01 },
              300
            );
          }
        }
      );
    })();
    return () => { sub?.remove(); };
  }, [followUser]);

  // ── Fetch OSRM routes for all legs ─────────────────────────────────────────
  useEffect(() => {
    if (!journey) return;
    setRoutesLoading(true);
    Promise.all(
      journey.legs.map((leg) => {
        const from = { latitude: leg.from.latitude, longitude: leg.from.longitude };
        const to = { latitude: leg.to.latitude, longitude: leg.to.longitude };
        return leg.type === 'walk' ? getWalkingRoute(from, to) : getBusRoute(from, to);
      })
    ).then((routes) => {
      setLegRoutes(routes);
      setRoutesLoading(false);

      // Fit map to full journey
      const allCoords = journey.legs.flatMap((l) => [
        { latitude: l.from.latitude, longitude: l.from.longitude },
        { latitude: l.to.latitude, longitude: l.to.longitude },
      ]).filter((c) => c.latitude !== 0);
      if (allCoords.length > 0) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(allCoords, {
            edgePadding: { top: 80, right: 40, bottom: 220, left: 40 },
            animated: true,
          });
        }, 600);
      }
    }).catch(() => setRoutesLoading(false));
  }, [journey?.id]);

  // ── Poll live bus position every 10 s ──────────────────────────────────────
  const fetchBus = useCallback(async () => {
    if (!busLeg?.line?.shortName) return;
    setBusLoading(true);
    try {
      const buses = await getLiveBusesForLine(busLeg.line.shortName);
      setTrackedBus(closestBus(buses, busLeg.from, busLeg.to));
    } catch {
      // ignore
    } finally {
      setBusLoading(false);
    }
  }, [busLeg?.line?.shortName]);

  useEffect(() => {
    fetchBus();
    const interval = setInterval(fetchBus, 10000);
    return () => clearInterval(interval);
  }, [fetchBus]);

  if (!journey) {
    return (
      <View style={styles.empty}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textTertiary} />
        <Text style={styles.emptyText}>Geen actieve reis</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Terug</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const color = busLeg?.line?.color ?? lineColor(busLeg?.line?.shortName ?? '');

  return (
    <View style={styles.container}>
      {/* ── Full-screen map ─────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_DEFAULT}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        minZoomLevel={3}
        maxZoomLevel={20}
        onPanDrag={() => setFollowUser(false)}
      >
        {/* Polylines per leg */}
        {journey.legs.map((leg, i) => {
          if (leg.from.latitude === 0) return null;
          const coords: RouteCoord[] = legRoutes[i]?.length > 1
            ? legRoutes[i]
            : [
                { latitude: leg.from.latitude, longitude: leg.from.longitude },
                { latitude: leg.to.latitude, longitude: leg.to.longitude },
              ];
          return (
            <Polyline
              key={`leg-${i}`}
              coordinates={coords}
              strokeColor={leg.type === 'bus' ? color : Colors.textTertiary}
              strokeWidth={leg.type === 'bus' ? 5 : 3}
              lineDashPattern={leg.type === 'walk' ? [8, 6] : undefined}
            />
          );
        })}

        {/* Start marker */}
        {journey.from.latitude !== 0 && (
          <Marker
            coordinate={{ latitude: journey.from.latitude, longitude: journey.from.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.markerStart}>
              <Ionicons name="ellipse" size={10} color={Colors.white} />
            </View>
          </Marker>
        )}

        {/* End marker */}
        {journey.to.latitude !== 0 && (
          <Marker
            coordinate={{ latitude: journey.to.latitude, longitude: journey.to.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.markerEnd}>
              <Ionicons name="location" size={14} color={Colors.white} />
            </View>
          </Marker>
        )}

        {/* Bus stop (boarding point) */}
        {busLeg && busLeg.from.latitude !== 0 && (
          <Marker
            coordinate={{ latitude: busLeg.from.latitude, longitude: busLeg.from.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={[styles.boardingMarker, { borderColor: color }]}>
              <Ionicons name="bus" size={12} color={color} />
            </View>
          </Marker>
        )}

        {/* Live bus position */}
        {trackedBus && trackedBus.latitude !== 0 && (
          <Marker
            coordinate={{ latitude: trackedBus.latitude, longitude: trackedBus.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={[styles.busMarker, { backgroundColor: color }]}>
              <Ionicons name="bus" size={14} color={Colors.white} />
              <Text style={styles.busMarkerText}>{busLeg?.line?.shortName ?? ''}</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {/* ── Loading indicator ────────────────────────────────────────────────── */}
      {routesLoading && (
        <View style={[styles.loadingBadge, { top: insets.top + 10 }]}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Ruta laden...</Text>
        </View>
      )}

      {/* ── Follow-user button ───────────────────────────────────────────────── */}
      {!followUser && (
        <TouchableOpacity
          style={[styles.followBtn, { bottom: 260 + insets.bottom }]}
          onPress={() => {
            setFollowUser(true);
            if (userLocation && mapRef.current) {
              mapRef.current.animateToRegion(
                { ...userLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 },
                300
              );
            }
          }}
        >
          <Ionicons name="locate" size={20} color={Colors.primary} />
        </TouchableOpacity>
      )}

      {/* ── Bottom info card ─────────────────────────────────────────────────── */}
      <View style={[styles.card, { paddingBottom: insets.bottom + Theme.spacing.sm }]}>
        {/* Route summary */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardRoute} numberOfLines={1}>
              {journey.from.name} → {journey.to.name}
            </Text>
            <Text style={styles.cardTime}>
              {formatTime(new Date(journey.departureTime))} — {formatTime(new Date(journey.arrivalTime))}
              {'  ·  '}{formatDuration(journey.duration)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => { setActiveJourney(null); router.back(); }}
            style={styles.stopBtn}
          >
            <Ionicons name="close-circle" size={18} color={Colors.error} />
            <Text style={styles.stopBtnText}>Stop</Text>
          </TouchableOpacity>
        </View>

        {/* Walk to bus */}
        {walkLeg && (
          <View style={styles.legRow}>
            <View style={[styles.legIcon, { backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1.5 }]}>
              <Ionicons name="walk" size={14} color={Colors.textSecondary} />
            </View>
            <Text style={styles.legText} numberOfLines={1}>
              Loop {walkLeg.distance ? `${walkLeg.distance}m ` : ''}naar halte {busLeg?.from.name ?? ''}
            </Text>
            <Text style={styles.legDur}>{formatDuration(walkLeg.duration)}</Text>
          </View>
        )}

        {/* Bus leg with live ETA */}
        {busLeg && (
          <View style={styles.legRow}>
            <View style={[styles.legIcon, { backgroundColor: color }]}>
              <Text style={styles.legIconText}>{busLeg.line?.shortName ?? '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.legText} numberOfLines={1}>
                {busLeg.headsign ?? busLeg.to.name}
              </Text>
              {trackedBus ? (
                <Text style={[styles.etaText, { color: color }]}>
                  Bus {etaString(trackedBus, busLeg)} weg
                  {busLoading ? ' · ↻' : ''}
                </Text>
              ) : (
                <Text style={styles.etaNoData}>
                  {busLoading ? 'Buslocatie laden...' : 'Geen live busdata'}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={fetchBus}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="refresh" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: Theme.fontSize.md, color: Colors.textSecondary },
  backBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: Theme.radius.full,
  },
  backBtnText: { color: Colors.white, fontWeight: '700' },

  loadingBadge: {
    position: 'absolute', left: Theme.spacing.base,
    backgroundColor: Colors.white, borderRadius: Theme.radius.full,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    ...Theme.shadow.sm,
  },
  loadingText: { fontSize: Theme.fontSize.xs, color: Colors.textSecondary },

  followBtn: {
    position: 'absolute', right: Theme.spacing.base,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
    ...Theme.shadow.md,
  },

  // Map markers
  markerStart: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  markerEnd: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  boardingMarker: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5,
    ...Theme.shadow.sm,
  },
  busMarker: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: Theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 5,
    borderWidth: 2, borderColor: Colors.white,
    ...Theme.shadow.md,
  },
  busMarkerText: {
    color: Colors.white, fontSize: 12, fontWeight: '800',
  },

  // Bottom card
  card: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: Theme.radius.xl, borderTopRightRadius: Theme.radius.xl,
    paddingTop: Theme.spacing.md, paddingHorizontal: Theme.spacing.base,
    gap: Theme.spacing.sm,
    ...Theme.shadow.lg,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Theme.spacing.sm,
    paddingBottom: Theme.spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  cardRoute: { fontSize: Theme.fontSize.base, fontWeight: '700', color: Colors.textPrimary },
  cardTime: { fontSize: Theme.fontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  stopBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.errorLight, borderRadius: Theme.radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  stopBtnText: { fontSize: Theme.fontSize.xs, color: Colors.error, fontWeight: '700' },

  legRow: {
    flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm,
    paddingVertical: 4,
  },
  legIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  legIconText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  legText: { flex: 1, fontSize: Theme.fontSize.sm, color: Colors.textPrimary, fontWeight: '500' },
  legDur: { fontSize: Theme.fontSize.xs, color: Colors.textTertiary },
  etaText: { fontSize: Theme.fontSize.xs, fontWeight: '700', marginTop: 1 },
  etaNoData: { fontSize: Theme.fontSize.xs, color: Colors.textTertiary, marginTop: 1 },
});
