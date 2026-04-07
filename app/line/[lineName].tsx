import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getLiveBusesForLine, getVariantsForLine } from '../../services/api/lines';
import { Colors } from '../../constants/colors';
import { Theme } from '../../constants/theme';
import { LiveBus, LineVariant } from '../../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTEVIDEO = {
  latitude: -34.9011,
  longitude: -56.1645,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const LINE_COLORS = [
  '#E53E3E', '#38A169', '#D69E2E', '#805AD5',
  '#DD6B20', '#0055B3', '#00897B',
];

function lineColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % LINE_COLORS.length;
  return LINE_COLORS[h];
}

function relativeTime(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return 'hace un momento';
  const mins = Math.floor(diff / 60);
  if (mins === 1) return 'hace 1 min';
  return `hace ${mins} min`;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function LineDetailScreen() {
  const { lineName: rawParam } = useLocalSearchParams<{ lineName: string }>();
  const lineName = decodeURIComponent(rawParam ?? '');
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [buses, setBuses] = useState<(LiveBus & { destination?: string; origin?: string })[]>([]);
  const [variants, setVariants] = useState<LineVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [filterVariant, setFilterVariant] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const color = lineColor(lineName);

  // Set navigation title
  useEffect(() => {
    navigation.setOptions({ title: `Línea ${lineName}` });
  }, [navigation, lineName]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [busData, variantData] = await Promise.all([
        getLiveBusesForLine(lineName),
        getVariantsForLine(lineName),
      ]);
      setBuses(busData as (LiveBus & { destination?: string; origin?: string })[]);
      setVariants(variantData);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, [lineName]);

  useEffect(() => {
    loadData();
    intervalRef.current = setInterval(loadData, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadData]);

  // Filter buses by selected variant headsign
  const displayBuses = filterVariant
    ? buses.filter((b) => (b as any).destination === filterVariant)
    : buses;

  // Unique destinations for chip filter
  const destinations = Array.from(
    new Set(variants.map((v) => v.headsign).filter(Boolean))
  );

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_DEFAULT}
        initialRegion={MONTEVIDEO}
        showsUserLocation={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {displayBuses.map((bus) =>
          bus.latitude && bus.longitude ? (
            <Marker
              key={bus.busId}
              coordinate={{ latitude: bus.latitude, longitude: bus.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.busMarker, { backgroundColor: color }]}>
                <Text style={styles.busMarkerText}>{bus.busId.slice(-4)}</Text>
              </View>
            </Marker>
          ) : null
        )}
      </MapView>

      {/* Top info bar */}
      <View
        style={[
          styles.infoBar,
          { top: insets.top + Theme.spacing.sm },
        ]}
      >
        <View style={[styles.infoLineBadge, { backgroundColor: color }]}>
          <Text style={styles.infoLineBadgeText}>{lineName}</Text>
        </View>
        <View style={styles.infoCenter}>
          <Text style={styles.infoBusCount}>
            {loading ? '...' : `${buses.length} bus${buses.length !== 1 ? 'es' : ''} activo${buses.length !== 1 ? 's' : ''}`}
          </Text>
          <Text style={styles.infoRefresh}>
            Actualizado {relativeTime(lastRefresh.toISOString())}
          </Text>
        </View>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <TouchableOpacity onPress={loadData} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={18} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom sheet */}
      <View
        style={[
          styles.bottomSheet,
          { paddingBottom: insets.bottom + Theme.spacing.sm },
        ]}
      >
        <Text style={styles.bottomTitle}>
          {buses.length} bus{buses.length !== 1 ? 'es' : ''} activo{buses.length !== 1 ? 's' : ''} en línea {lineName}
        </Text>

        {destinations.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipList}
          >
            <TouchableOpacity
              style={[
                styles.chip,
                filterVariant === null && { backgroundColor: color, borderColor: color },
              ]}
              onPress={() => setFilterVariant(null)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.chipText,
                  filterVariant === null && { color: Colors.white },
                ]}
              >
                Todos
              </Text>
            </TouchableOpacity>
            {destinations.map((dest) => (
              <TouchableOpacity
                key={dest}
                style={[
                  styles.chip,
                  filterVariant === dest && { backgroundColor: color, borderColor: color },
                ]}
                onPress={() => setFilterVariant(filterVariant === dest ? null : dest)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.chipText,
                    filterVariant === dest && { color: Colors.white },
                  ]}
                >
                  {dest}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Bus marker on map
  busMarker: {
    borderRadius: Theme.radius.full,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1.5,
    borderColor: Colors.white,
    ...Theme.shadow.md,
  },
  busMarkerText: {
    color: Colors.white,
    fontSize: Theme.fontSize.xs,
    fontWeight: Theme.fontWeight.bold,
  },

  // Top info bar
  infoBar: {
    position: 'absolute',
    left: Theme.spacing.base,
    right: Theme.spacing.base,
    backgroundColor: Colors.white,
    borderRadius: Theme.radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.sm,
    gap: Theme.spacing.sm,
    ...Theme.shadow.lg,
  },
  infoLineBadge: {
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    minWidth: 52,
    alignItems: 'center',
  },
  infoLineBadgeText: {
    color: Colors.white,
    fontSize: Theme.fontSize.lg,
    fontWeight: Theme.fontWeight.bold,
  },
  infoCenter: { flex: 1 },
  infoBusCount: {
    fontSize: Theme.fontSize.base,
    fontWeight: Theme.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  infoRefresh: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  refreshBtn: { padding: 4 },

  // Bottom sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: Theme.radius.xl,
    borderTopRightRadius: Theme.radius.xl,
    paddingTop: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.base,
    minHeight: 140,
    ...Theme.shadow.lg,
  },
  bottomTitle: {
    fontSize: Theme.fontSize.base,
    fontWeight: Theme.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Theme.spacing.sm,
  },
  chipList: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Theme.radius.full,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    backgroundColor: Colors.surface,
  },
  chipText: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textSecondary,
    fontWeight: Theme.fontWeight.medium,
  },
});
