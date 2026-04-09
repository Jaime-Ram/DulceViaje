import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Linking, ActionSheetIOS, Platform, Alert,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Theme } from '../../constants/theme';
import { useJourneyStore } from '../../store/useJourneyStore';
import { formatTime, formatDuration } from '../../utils/time';
import { Journey, JourneyLeg } from '../../types';
import { getWalkingRoute, getBusRoute, RouteCoord } from '../../services/api/routing';

// ── Line color hash ──────────────────────────────────────────────────────────
const PALETTE = ['#E53E3E','#38A169','#D69E2E','#0055B3','#805AD5','#DD6B20','#00897B','#C2185B'];
function lineColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % PALETTE.length;
  return PALETTE[h];
}

// ── Leg icon ─────────────────────────────────────────────────────────────────
function LegIcon({ leg }: { leg: JourneyLeg }) {
  if (leg.type === 'walk') {
    return (
      <View style={[styles.legIcon, { backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1.5 }]}>
        <Ionicons name="walk" size={16} color={Colors.textSecondary} />
      </View>
    );
  }
  const color = leg.line?.color ?? lineColor(leg.line?.shortName ?? '');
  return (
    <View style={[styles.legIcon, { backgroundColor: color }]}>
      <Text style={styles.legIconText}>{leg.line?.shortName ?? '?'}</Text>
    </View>
  );
}

// ── Open walking leg in Maps ──────────────────────────────────────────────────
function openWalkInMaps(leg: JourneyLeg) {
  const { latitude: lat1, longitude: lon1 } = leg.from;
  const { latitude: lat2, longitude: lon2 } = leg.to;
  const appleMapsUrl = `maps://maps.apple.com/?saddr=${lat1},${lon1}&daddr=${lat2},${lon2}&dirflg=w`;
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${lat1},${lon1}&destination=${lat2},${lon2}&travelmode=walking`;

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancelar', 'Apple Maps', 'Google Maps'],
        cancelButtonIndex: 0,
      },
      (buttonIndex) => {
        if (buttonIndex === 1) {
          Linking.openURL(appleMapsUrl).catch(() => Linking.openURL(googleMapsUrl));
        } else if (buttonIndex === 2) {
          Linking.openURL(googleMapsUrl);
        }
      }
    );
  } else {
    Alert.alert(
      'Abrir en Maps',
      'Selecciona una aplicación',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Google Maps',
          onPress: () => Linking.openURL(googleMapsUrl),
        },
        {
          text: 'Apple Maps',
          onPress: () => Linking.openURL(appleMapsUrl).catch(() => Linking.openURL(googleMapsUrl)),
        },
      ]
    );
  }
}

// ── Timeline leg ─────────────────────────────────────────────────────────────
function LegRow({ leg, isLast }: { leg: JourneyLeg; isLast: boolean }) {
  const isBus = leg.type === 'bus';
  const color = isBus ? (leg.line?.color ?? lineColor(leg.line?.shortName ?? '')) : Colors.border;

  return (
    <View style={styles.legRow}>
      {/* Left timeline */}
      <View style={styles.timeline}>
        <LegIcon leg={leg} />
        {!isLast && <View style={[styles.timelineLine, { backgroundColor: color, borderStyle: isBus ? 'solid' : 'dashed' }]} />}
      </View>

      {/* Content */}
      <View style={styles.legContent}>
        <View style={styles.legHeader}>
          <Text style={styles.legTime}>{formatTime(new Date(leg.departureTime))}</Text>
          <Text style={styles.legFrom} numberOfLines={1}>{leg.from.name}</Text>
        </View>

        {isBus ? (
          <View style={styles.busDetail}>
            <View style={[styles.busBadge, { backgroundColor: color }]}>
              <Text style={styles.busBadgeText}>{leg.line?.shortName}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.legHeadsign}>{leg.headsign}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Text style={styles.legDur}>{formatDuration(leg.duration)}</Text>
                {leg.wheelchairAccessible === true && (
                  <View style={styles.wheelchairBadge}>
                    <Ionicons name="accessibility" size={11} color="#38A169" />
                    <Text style={styles.wheelchairText}>Accesible</Text>
                  </View>
                )}
                {leg.wheelchairAccessible === false && (
                  <View style={[styles.wheelchairBadge, styles.wheelchairBadgeNo]}>
                    <Ionicons name="accessibility" size={11} color={Colors.error} />
                    <Text style={[styles.wheelchairText, { color: Colors.error }]}>No accesible</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.walkDetail}>
            <Ionicons name="footsteps" size={13} color={Colors.textTertiary} />
            <Text style={styles.legDur}>
              {leg.distance ? `${leg.distance}m · ` : ''}{formatDuration(leg.duration)} caminando
            </Text>
            {leg.from.latitude !== 0 && leg.to.latitude !== 0 && (
              <TouchableOpacity
                style={styles.openMapsBtn}
                onPress={() => openWalkInMaps(leg)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="navigate-outline" size={13} color={Colors.primary} />
                <Text style={styles.openMapsBtnText}>Abrir en Maps</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function TripDetailScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const selectedJourney = useJourneyStore((s) => s.selectedJourney);
  const saveJourney = useJourneyStore((s) => s.saveJourney);
  const unsaveJourney = useJourneyStore((s) => s.unsaveJourney);
  const isJourneySaved = useJourneyStore((s) => s.isJourneySaved);
  const setActiveJourney = useJourneyStore((s) => s.setActiveJourney);
  const activeJourney = useJourneyStore((s) => s.activeJourney);
  const mapRef = useRef<MapView>(null);

  // Real street-following routes per leg (fetched from OSRM)
  const [legRoutes, setLegRoutes] = useState<RouteCoord[][]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);

  const journey = selectedJourney;
  const saved = journey ? isJourneySaved(journey.id) : false;

  useEffect(() => {
    if (!journey) return;
    navigation.setOptions({
      title: `${journey.from.name.split(' ')[0]} → ${journey.to.name.split(' ')[0]}`,
      headerRight: () => (
        <TouchableOpacity
          onPress={() => saved ? unsaveJourney(journey.id) : saveJourney(journey)}
          style={{ marginRight: 4 }}
        >
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={24} color={Colors.white} />
        </TouchableOpacity>
      ),
    });
  }, [journey, saved]);

  // Fetch real routes from OSRM for each leg
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
    }).catch(() => setRoutesLoading(false));
  }, [journey?.id]);

  if (!journey) {
    return (
      <View style={styles.empty}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textTertiary} />
        <Text style={styles.emptyText}>Viaje no encontrado</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Build map data
  const coords = journey.legs.map((l) => [
    { latitude: l.from.latitude, longitude: l.from.longitude },
    { latitude: l.to.latitude, longitude: l.to.longitude },
  ]);

  const allCoords = journey.legs.flatMap((l) => [
    { latitude: l.from.latitude, longitude: l.from.longitude },
    { latitude: l.to.latitude, longitude: l.to.longitude },
  ]);

  // Bounding region for the map
  const lats = allCoords.map((c) => c.latitude).filter(Boolean);
  const lons = allCoords.map((c) => c.longitude).filter(Boolean);
  const hasCoords = lats.length > 0 && lons.every((l) => l !== 0);
  const mapRegion = hasCoords
    ? {
        latitude: (Math.max(...lats) + Math.min(...lats)) / 2,
        longitude: (Math.max(...lons) + Math.min(...lons)) / 2,
        latitudeDelta: Math.max(Math.max(...lats) - Math.min(...lats), 0.01) * 1.4,
        longitudeDelta: Math.max(Math.max(...lons) - Math.min(...lons), 0.01) * 1.4,
      }
    : { latitude: -34.9011, longitude: -56.1645, latitudeDelta: 0.08, longitudeDelta: 0.08 };

  return (
    <View style={styles.container}>
      {/* ── MAP ── */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={mapRegion}
          scrollEnabled={true}
          zoomEnabled={true}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {/* Polylines per leg — real street-following routes from OSRM */}
          {journey.legs.map((leg, i) => {
            const from = { latitude: leg.from.latitude, longitude: leg.from.longitude };
            if (from.latitude === 0 && from.longitude === 0) return null;
            // Use real route if available, fall back to straight line
            const coords: RouteCoord[] = legRoutes[i] && legRoutes[i].length > 1
              ? legRoutes[i]
              : [
                  { latitude: leg.from.latitude, longitude: leg.from.longitude },
                  { latitude: leg.to.latitude, longitude: leg.to.longitude },
                ];
            return (
              <Polyline
                key={i}
                coordinates={coords}
                strokeColor={leg.type === 'bus' ? (leg.line?.color ?? lineColor(leg.line?.shortName ?? '?')) : Colors.textTertiary}
                strokeWidth={leg.type === 'bus' ? 5 : 3}
                lineDashPattern={leg.type === 'walk' ? [6, 6] : undefined}
              />
            );
          })}

          {/* Transfer / stop dots between legs */}
          {journey.legs.slice(0, -1).map((leg, i) => {
            const coord = { latitude: leg.to.latitude, longitude: leg.to.longitude };
            if (coord.latitude === 0 && coord.longitude === 0) return null;
            const nextLeg = journey.legs[i + 1];
            const color = nextLeg?.type === 'bus'
              ? (nextLeg.line?.color ?? lineColor(nextLeg.line?.shortName ?? ''))
              : Colors.border;
            return (
              <Marker key={`dot-${i}`} coordinate={coord} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <View style={[styles.markerDot, { borderColor: color }]} />
              </Marker>
            );
          })}

          {/* Start marker */}
          {journey.from.latitude !== 0 && (
            <Marker coordinate={{ latitude: journey.from.latitude, longitude: journey.from.longitude }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={styles.markerStart}><Ionicons name="ellipse" size={10} color={Colors.white} /></View>
            </Marker>
          )}
          {/* End marker */}
          {journey.to.latitude !== 0 && (
            <Marker coordinate={{ latitude: journey.to.latitude, longitude: journey.to.longitude }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={styles.markerEnd}><Ionicons name="location" size={14} color={Colors.white} /></View>
            </Marker>
          )}
        </MapView>

        {/* Route loading indicator */}
        {routesLoading && (
          <View style={styles.routeLoadingBadge}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.routeLoadingText}>Cargando ruta...</Text>
          </View>
        )}

        {/* Expand map button */}
        <TouchableOpacity style={styles.expandMapBtn} onPress={() => mapRef.current?.animateToRegion(mapRegion)}>
          <Ionicons name="expand" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ── JOURNEY SUMMARY ── */}
      <View style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryTimes}>
            {formatTime(new Date(journey.departureTime))} — {formatTime(new Date(journey.arrivalTime))}
          </Text>
          <Text style={styles.summaryRoute} numberOfLines={1}>
            {journey.from.name} → {journey.to.name}
          </Text>
        </View>
        <View style={styles.summaryRight}>
          <Text style={styles.summaryDur}>{formatDuration(journey.duration)}</Text>
          <Text style={styles.summaryTransfers}>
            {journey.transfers === 0 ? 'Directo' : `${journey.transfers} transbordo${journey.transfers > 1 ? 's' : ''}`}
          </Text>
        </View>
      </View>

      {/* ── ACTIVATE JOURNEY BUTTON ── */}
      {activeJourney?.id !== journey.id ? (
        <TouchableOpacity
          style={styles.activateBtn}
          onPress={() => { setActiveJourney(journey); router.back(); }}
          activeOpacity={0.85}
        >
          <Ionicons name="navigate" size={18} color={Colors.secondaryText} />
          <Text style={styles.activateBtnText}>Seguir este viaje</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.activateBtn, styles.deactivateBtn]}
          onPress={() => setActiveJourney(null)}
          activeOpacity={0.85}
        >
          <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
          <Text style={styles.deactivateBtnText}>Dejar de seguir</Text>
        </TouchableOpacity>
      )}

      {/* ── TIMELINE ── */}
      <ScrollView style={styles.timeline_} contentContainerStyle={{ padding: Theme.spacing.base, paddingBottom: 48 }}>
        {journey.legs.map((leg, i) => (
          <LegRow key={i} leg={leg} isLast={i === journey.legs.length - 1} />
        ))}
        {/* Arrival */}
        <View style={styles.arrivalRow}>
          <View style={styles.timeline}>
            <View style={[styles.legIcon, { backgroundColor: Colors.error }]}>
              <Ionicons name="location" size={14} color={Colors.white} />
            </View>
          </View>
          <View style={styles.legContent}>
            <Text style={styles.legTime}>{formatTime(new Date(journey.arrivalTime))}</Text>
            <Text style={styles.arrivalName}>{journey.to.name}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  mapContainer: { height: 220, backgroundColor: Colors.surface },
  map: { flex: 1 },
  routeLoadingBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: Colors.white, borderRadius: Theme.radius.full,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    ...Theme.shadow.sm,
  },
  routeLoadingText: { fontSize: Theme.fontSize.xs, color: Colors.textSecondary },
  expandMapBtn: {
    position: 'absolute', bottom: 10, right: 10,
    backgroundColor: Colors.white, borderRadius: Theme.radius.full,
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    ...Theme.shadow.md,
  },
  markerDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.white, borderWidth: 3,
  },
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
  summary: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Theme.spacing.base,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  summaryTimes: { fontSize: Theme.fontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  summaryRoute: { fontSize: Theme.fontSize.xs, color: Colors.textSecondary, marginTop: 3 },
  summaryRight: { alignItems: 'flex-end' },
  summaryDur: { fontSize: Theme.fontSize.md, fontWeight: '700', color: Colors.primary },
  summaryTransfers: { fontSize: Theme.fontSize.xs, color: Colors.textSecondary },
  timeline_: { flex: 1, backgroundColor: Colors.surface },
  legRow: { flexDirection: 'row', marginBottom: 4 },
  timeline: { alignItems: 'center', width: 48 },
  legIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  legIconText: { color: Colors.white, fontSize: 11, fontWeight: '800' },
  timelineLine: { width: 2, flex: 1, minHeight: 32, marginBottom: 4 },
  legContent: { flex: 1, paddingTop: 8, paddingBottom: 16 },
  legHeader: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm, marginBottom: 6 },
  legTime: { fontSize: Theme.fontSize.sm, fontWeight: '700', color: Colors.textSecondary, minWidth: 40 },
  legFrom: { fontSize: Theme.fontSize.sm, color: Colors.textPrimary, fontWeight: '500', flex: 1 },
  busDetail: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Theme.spacing.sm,
    backgroundColor: Colors.white, borderRadius: Theme.radius.lg, padding: Theme.spacing.sm,
    ...Theme.shadow.sm,
  },
  busBadge: {
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6,
    minWidth: 44, alignItems: 'center',
  },
  busBadgeText: { color: Colors.white, fontSize: Theme.fontSize.sm, fontWeight: '800' },
  legHeadsign: { fontSize: Theme.fontSize.base, fontWeight: '600', color: Colors.textPrimary },
  legDur: { fontSize: Theme.fontSize.xs, color: Colors.textSecondary },
  wheelchairBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#F0FFF4', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  wheelchairBadgeNo: { backgroundColor: Colors.errorLight },
  wheelchairText: { fontSize: 10, fontWeight: '600', color: '#38A169' },
  walkDetail: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: Theme.spacing.sm, flexWrap: 'wrap',
  },
  openMapsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.primarySurface, borderRadius: Theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3, marginLeft: 4,
  },
  openMapsBtnText: {
    fontSize: 11, fontWeight: '600', color: Colors.primary,
  },
  arrivalRow: { flexDirection: 'row' },
  arrivalName: { fontSize: Theme.fontSize.base, fontWeight: '700', color: Colors.textPrimary, marginTop: 4 },
  activateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.secondary, marginHorizontal: Theme.spacing.base,
    marginVertical: Theme.spacing.sm, borderRadius: Theme.radius.full,
    paddingVertical: 12, gap: Theme.spacing.sm,
  },
  activateBtnText: { color: Colors.secondaryText, fontWeight: '700', fontSize: Theme.fontSize.base },
  deactivateBtn: { backgroundColor: Colors.surface },
  deactivateBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: Theme.fontSize.base },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: Theme.fontSize.md, color: Colors.textSecondary },
  backBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: Theme.radius.full },
  backBtnText: { color: Colors.white, fontWeight: '700' },
});
