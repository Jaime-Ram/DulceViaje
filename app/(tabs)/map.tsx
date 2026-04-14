import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  FlatList,
  Modal,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Theme } from '../../constants/theme';
import useLocation from '../../hooks/useLocation';
import useStops from '../../hooks/useStops';
import { getLiveBuses } from '../../services/api/buses';
import { searchLines } from '../../services/api/lines';
import { getUpcomingBuses } from '../../services/api/stops';
import { BusStop, LiveBus, UpcomingBus, LineVariant } from '../../types';

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTEVIDEO_CENTER = {
  latitude: -34.9011,
  longitude: -56.1645,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_COLLAPSED_HEIGHT = 220;
const SHEET_EXPANDED_HEIGHT = Math.round(SCREEN_HEIGHT * 0.6);
const STOP_RENDER_THRESHOLD = 0.025; // latitudeDelta below which stops are shown
const MAX_VISIBLE_STOPS = 80;

// ─── Line badge color palette ─────────────────────────────────────────────────

const LINE_COLORS = [
  '#0055B3', '#D97706', '#16A34A', '#DC2626',
  '#7C3AED', '#0891B2', '#DB2777', '#65A30D',
];

function lineColor(lineName: string): string {
  let hash = 0;
  for (let i = 0; i < lineName.length; i++) {
    hash = lineName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return LINE_COLORS[Math.abs(hash) % LINE_COLORS.length];
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function StopMarker({
  stop,
  selected,
  onPress,
}: {
  stop: BusStop;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Marker
      coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
    >
      <View style={[styles.stopMarker, selected && styles.stopMarkerSelected]}>
        <Ionicons name="bus" size={selected ? 11 : 7} color={Colors.white} />
      </View>
    </Marker>
  );
}

function BusMarker({ bus }: { bus: LiveBus }) {
  return (
    <Marker
      coordinate={{ latitude: bus.latitude, longitude: bus.longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      tracksInfoWindowChanges={false}
    >
      <View style={[styles.busMarker, { backgroundColor: lineColor(bus.lineName) }]}>
        <Text style={styles.busMarkerText}>{bus.lineName}</Text>
      </View>
    </Marker>
  );
}

function LineBadge({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const bg = lineColor(name);
  const small = size === 'sm';
  return (
    <View style={[styles.lineBadge, { backgroundColor: bg, paddingHorizontal: small ? 6 : 8, paddingVertical: small ? 2 : 4 }]}>
      <Text style={[styles.lineBadgeText, { fontSize: small ? 10 : Theme.fontSize.xs }]}>{name}</Text>
    </View>
  );
}

function DepartureRow({ dep }: { dep: UpcomingBus }) {
  const eta = Math.round(dep.etaMinutes);
  const etaColor =
    eta <= 2 ? Colors.error : eta <= 5 ? Colors.warning : Colors.success;
  const etaLabel = eta <= 0 ? 'Ahora' : `${eta} min`;

  return (
    <View style={styles.departureRow}>
      <LineBadge name={dep.lineName} />
      <Text style={styles.departureHeadsign} numberOfLines={1}>
        {dep.headsign || '—'}
      </Text>
      <Text style={[styles.departureEta, { color: etaColor }]}>{etaLabel}</Text>
    </View>
  );
}

// ─── Search Modal ─────────────────────────────────────────────────────────────

type SearchResult =
  | { type: 'stop'; stop: BusStop }
  | { type: 'line'; variant: LineVariant };

function SearchModal({
  visible,
  onClose,
  onSelectStop,
  onSelectLine,
  searchStops,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectStop: (stop: BusStop) => void;
  onSelectLine: (lineName: string) => void;
  searchStops: (q: string) => BusStop[];
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [visible]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const stopHits = searchStops(query).slice(0, 15);
      const lineHits = await searchLines(query).catch(() => []);
      const combined: SearchResult[] = [
        ...stopHits.map((s) => ({ type: 'stop' as const, stop: s })),
        ...lineHits.map((v) => ({ type: 'line' as const, variant: v })),
      ];
      setResults(combined);
      setLoading(false);
    }, 280);
  }, [query, searchStops]);

  const renderItem = useCallback(
    ({ item }: { item: SearchResult }) => {
      if (item.type === 'stop') {
        return (
          <TouchableOpacity
            style={styles.searchResultRow}
            onPress={() => {
              onSelectStop(item.stop);
              onClose();
            }}
            activeOpacity={0.7}
          >
            <View style={styles.searchResultIcon}>
              <Ionicons name="bus" size={16} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.searchResultName} numberOfLines={1}>
                {item.stop.name}
              </Text>
              <Text style={styles.searchResultSub}>Parada #{item.stop.id}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
        );
      }
      // line
      return (
        <TouchableOpacity
          style={styles.searchResultRow}
          onPress={() => {
            onSelectLine(item.variant.lineName);
            onClose();
          }}
          activeOpacity={0.7}
        >
          <LineBadge name={item.variant.lineName} size="sm" />
          <Text style={styles.searchResultName} numberOfLines={1}>
            {item.variant.headsign || item.variant.lineName}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
      );
    },
    [onSelectStop, onSelectLine, onClose]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.searchModal, { paddingTop: insets.top + Theme.spacing.sm }]}>
        {/* Header */}
        <View style={styles.searchHeader}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Buscar parada o línea..."
              placeholderTextColor={Colors.textTertiary}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.searchCancelBtn}>
            <Text style={styles.searchCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>

        {/* Results */}
        {loading ? (
          <ActivityIndicator
            size="small"
            color={Colors.primary}
            style={{ marginTop: Theme.spacing.xl }}
          />
        ) : results.length === 0 && query.trim() ? (
          <View style={styles.searchEmptyWrap}>
            <Ionicons name="search-outline" size={40} color={Colors.textTertiary} />
            <Text style={styles.searchEmptyText}>Sin resultados para "{query}"</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item, i) =>
              item.type === 'stop'
                ? `stop-${item.stop.id}`
                : `line-${item.variant.id}-${i}`
            }
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + Theme.spacing.xl }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>
    </Modal>
  );
}

// ─── Bottom Sheet ─────────────────────────────────────────────────────────────

type SheetState = 'collapsed' | 'expanded';

function BottomSheet({
  stop,
  onClose,
  onExpand,
  onCollapse,
  sheetState,
  animY,
  insets,
}: {
  stop: BusStop;
  onClose: () => void;
  onExpand: () => void;
  onCollapse: () => void;
  sheetState: SheetState;
  animY: Animated.Value;
  insets: { bottom: number };
}) {
  const [departures, setDepartures] = useState<UpcomingBus[]>([]);
  const [depsLoading, setDepsLoading] = useState(true);
  const router = useRouter();

  // Keep callback refs stable so PanResponder doesn't capture stale closures
  const onExpandRef = useRef(onExpand);
  const onCollapseRef = useRef(onCollapse);
  useEffect(() => { onExpandRef.current = onExpand; }, [onExpand]);
  useEffect(() => { onCollapseRef.current = onCollapse; }, [onCollapse]);

  const loadDepartures = useCallback(async () => {
    setDepsLoading(true);
    try {
      const deps = await getUpcomingBuses(stop.id, undefined, 5, stop.latitude, stop.longitude);
      setDepartures(deps ?? []);
    } catch {
      setDepartures([]);
    } finally {
      setDepsLoading(false);
    }
  }, [stop.id, stop.latitude, stop.longitude]);

  // Load on mount and auto-refresh every 30s
  useEffect(() => {
    loadDepartures();
    const interval = setInterval(loadDepartures, 30000);
    return () => clearInterval(interval);
  }, [loadDepartures]);

  // PanResponder for swipe gesture on handle — uses refs to avoid stale closures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderRelease: (_, gs) => {
        try {
          if (gs.dy < -30) {
            onExpandRef.current();
          } else if (gs.dy > 30) {
            onCollapseRef.current();
          }
        } catch {}
      },
    })
  ).current;

  const isExpanded = sheetState === 'expanded';
  const previewDeps = departures.slice(0, 3);

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          height: isExpanded ? SHEET_EXPANDED_HEIGHT : SHEET_COLLAPSED_HEIGHT,
          paddingBottom: insets.bottom + Theme.spacing.sm,
          transform: [{ translateY: animY }],
        },
      ]}
    >
      {/* Drag handle */}
      <View {...panResponder.panHandlers} style={styles.sheetHandleArea}>
        <View style={styles.sheetHandle} />
      </View>

      {/* Header */}
      <View style={styles.sheetHeader}>
        <View style={styles.sheetIconWrap}>
          <Ionicons name="bus" size={18} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sheetStopName} numberOfLines={2}>
            {stop.name}
          </Text>
          <Text style={styles.sheetStopId}>Parada #{stop.id}</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={26} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Departures */}
      {depsLoading ? (
        <ActivityIndicator
          size="small"
          color={Colors.primary}
          style={{ marginVertical: Theme.spacing.md }}
        />
      ) : departures.length === 0 ? (
        <Text style={styles.sheetNoDeps}>Sin salidas disponibles en este momento.</Text>
      ) : isExpanded ? (
        <FlatList
          data={departures}
          keyExtractor={(d, i) => `${d.lineName}-${d.lineVariantId}-${i}`}
          renderItem={({ item }) => <DepartureRow dep={item} />}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: Theme.spacing.base }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : (
        <View>
          {previewDeps.map((dep, i) => (
            <React.Fragment key={`${dep.lineName}-${dep.lineVariantId}-${i}`}>
              <DepartureRow dep={dep} />
              {i < previewDeps.length - 1 && <View style={styles.separator} />}
            </React.Fragment>
          ))}
          {departures.length > 3 && (
            <TouchableOpacity onPress={onExpand} style={styles.sheetMoreBtn}>
              <Text style={styles.sheetMoreText}>
                Ver todas ({departures.length}) salidas
              </Text>
              <Ionicons name="chevron-up" size={14} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Action buttons (expanded state) */}
      {isExpanded && (
        <View style={styles.sheetActions}>
          <TouchableOpacity
            style={styles.sheetDetailBtn}
            onPress={() => router.push(`/stop/${stop.id}`)}
          >
            <Ionicons name="time" size={16} color={Colors.white} />
            <Text style={styles.sheetDetailBtnText}>Ver detalles</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const { getCurrentLocation } = useLocation();
  const { stops, loading: stopsLoading, searchStops } = useStops();

  const [region, setRegion] = useState(MONTEVIDEO_CENTER);
  const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
  const [sheetState, setSheetState] = useState<SheetState>('collapsed');
  const [showBuses, setShowBuses] = useState(false);
  const [liveBuses, setLiveBuses] = useState<LiveBus[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  // Sheet animation
  const sheetAnimY = useRef(new Animated.Value(0)).current;

  // Location button bottom position animation
  const locBtnBottom = useRef(new Animated.Value(insets.bottom + 16)).current;

  // ── Visible stops (only when zoomed in enough) ───────────────────────────
  const visibleStops = useMemo<BusStop[]>(() => {
    if (region.latitudeDelta >= STOP_RENDER_THRESHOLD || !stops.length) return [];
    const lat = region.latitude;
    const lon = region.longitude;
    const dLat = region.latitudeDelta * 0.6;
    const dLon = region.longitudeDelta * 0.6;
    const filtered = stops.filter(
      (s) => Math.abs(s.latitude - lat) < dLat && Math.abs(s.longitude - lon) < dLon
    );
    // Sort by distance to center, take nearest MAX_VISIBLE_STOPS
    return filtered
      .map((s) => ({
        stop: s,
        d: (s.latitude - lat) ** 2 + (s.longitude - lon) ** 2,
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_VISIBLE_STOPS)
      .map((x) => x.stop);
  }, [region, stops]);

  // ── Live buses fetch ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!showBuses) {
      setLiveBuses([]);
      return;
    }
    const fetch = () => getLiveBuses().then(setLiveBuses).catch(() => {});
    fetch();
    const interval = setInterval(fetch, 15000);
    return () => clearInterval(interval);
  }, [showBuses]);

  // ── Sheet open/collapse/expand ────────────────────────────────────────────
  const openSheet = useCallback((stop: BusStop) => {
    setSelectedStop(stop);
    setSheetState('collapsed');
    Animated.spring(sheetAnimY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 60,
      friction: 12,
    }).start();
  }, [sheetAnimY]);

  const expandSheet = useCallback(() => {
    setSheetState('expanded');
  }, []);

  const collapseSheet = useCallback(() => {
    setSheetState('collapsed');
  }, []);

  const closeSheet = useCallback(() => {
    Animated.spring(sheetAnimY, {
      toValue: SHEET_COLLAPSED_HEIGHT + 80,
      useNativeDriver: true,
      tension: 60,
      friction: 12,
    }).start(() => {
      setSelectedStop(null);
      setSheetState('collapsed');
      sheetAnimY.setValue(0);
    });
  }, [sheetAnimY]);

  // Reset anim when sheet closes
  useEffect(() => {
    if (!selectedStop) {
      sheetAnimY.setValue(0);
    }
  }, [selectedStop, sheetAnimY]);

  // ── Location button position ──────────────────────────────────────────────
  useEffect(() => {
    const targetBottom =
      selectedStop && sheetState === 'collapsed'
        ? SHEET_COLLAPSED_HEIGHT + 16
        : selectedStop && sheetState === 'expanded'
        ? -100 // hide behind sheet
        : insets.bottom + 16;

    Animated.spring(locBtnBottom, {
      toValue: targetBottom,
      useNativeDriver: false,
      tension: 60,
      friction: 12,
    }).start();
  }, [selectedStop, sheetState, insets.bottom, locBtnBottom]);

  // ── Center on user ────────────────────────────────────────────────────────
  const centerOnUser = useCallback(async () => {
    try {
      const loc = await getCurrentLocation();
      if (loc && mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: loc.latitude,
          longitude: loc.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    } catch {}
  }, [getCurrentLocation]);

  // ── Map tap → nearest stop selection ──────────────────────────────────────
  const handleMapPress = useCallback(
    (event: any) => {
      if (!visibleStops.length) return;
      const { latitude, longitude } = event.nativeEvent.coordinate;
      const threshold = region.latitudeDelta * 0.05;
      let nearest: BusStop | null = null;
      let minDist = Infinity;
      for (const stop of visibleStops) {
        const d = Math.sqrt(
          (stop.latitude - latitude) ** 2 + (stop.longitude - longitude) ** 2
        );
        if (d < minDist) {
          minDist = d;
          nearest = stop;
        }
      }
      if (nearest && minDist <= threshold) {
        openSheet(nearest);
      }
    },
    [visibleStops, region.latitudeDelta, openSheet]
  );

  // ── Search handlers ────────────────────────────────────────────────────────
  const handleSelectStop = useCallback(
    (stop: BusStop) => {
      openSheet(stop);
      mapRef.current?.animateToRegion(
        {
          latitude: stop.latitude,
          longitude: stop.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        400
      );
    },
    [openSheet]
  );

  const handleSelectLine = useCallback(
    (lineName: string) => {
      router.push(`/line/${lineName}`);
    },
    [router]
  );

  // ── Zoom hint visibility ───────────────────────────────────────────────────
  const showZoomHint = region.latitudeDelta >= STOP_RENDER_THRESHOLD;

  return (
    <View style={styles.container}>
      {/* ── Full-screen map ───────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_DEFAULT}
        initialRegion={MONTEVIDEO_CENTER}
        onRegionChangeComplete={setRegion}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        moveOnMarkerPress={false}
        minZoomLevel={3}
        maxZoomLevel={20}
      >
        {visibleStops.map((stop) => (
          <StopMarker
            key={stop.id}
            stop={stop}
            selected={selectedStop?.id === stop.id}
            onPress={() => openSheet(stop)}
          />
        ))}
        {showBuses &&
          liveBuses.map((bus, i) => (
            <BusMarker key={`${bus.busId}-${bus.lineVariantId}-${i}`} bus={bus} />
          ))}
      </MapView>

      {/* ── Top controls row ──────────────────────────────────────────────── */}
      <View style={[styles.topRow, { top: insets.top + Theme.spacing.sm }]}>
        {/* Search bar pill */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => setShowSearch(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="search" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
          <Text style={styles.searchBarPlaceholder}>Buscar parada o línea...</Text>
        </TouchableOpacity>

        {/* Live buses toggle */}
        <TouchableOpacity
          style={[styles.iconBtn, showBuses && styles.iconBtnActive]}
          onPress={() => setShowBuses((v) => !v)}
        >
          <Ionicons
            name="bus"
            size={20}
            color={showBuses ? Colors.white : Colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* ── Zoom hint ─────────────────────────────────────────────────────── */}
      {showZoomHint && !selectedStop && (
        <View style={[styles.zoomHint, { top: insets.top + 70 }]}>
          <Ionicons name="search-outline" size={13} color={Colors.textSecondary} style={{ marginRight: 4 }} />
          <Text style={styles.zoomHintText}>Acercate para ver paradas</Text>
        </View>
      )}

      {/* ── Stops loading badge ────────────────────────────────────────────── */}
      {stopsLoading && (
        <View style={[styles.loadingBadge, { top: insets.top + 68 }]}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Cargando paradas...</Text>
        </View>
      )}

      {/* ── Location button ────────────────────────────────────────────────── */}
      <Animated.View style={[styles.locationBtn, { bottom: locBtnBottom }]}>
        <TouchableOpacity onPress={centerOnUser} style={styles.locationBtnInner}>
          <Ionicons name="locate" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Bottom sheet ──────────────────────────────────────────────────── */}
      {selectedStop && (
        <BottomSheet
          stop={selectedStop}
          onClose={closeSheet}
          onExpand={expandSheet}
          onCollapse={collapseSheet}
          sheetState={sheetState}
          animY={sheetAnimY}
          insets={{ bottom: insets.bottom }}
        />
      )}

      {/* ── Search modal ──────────────────────────────────────────────────── */}
      <SearchModal
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectStop={handleSelectStop}
        onSelectLine={handleSelectLine}
        searchStops={searchStops}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },

  // ── Top row ──────────────────────────────────────────────────────────────
  topRow: {
    position: 'absolute',
    left: Theme.spacing.base,
    right: Theme.spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },

  // ── Search bar (floating pill) ────────────────────────────────────────────
  searchBar: {
    flex: 1,
    height: 48,
    backgroundColor: Colors.white,
    borderRadius: Theme.radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.base,
    ...Theme.shadow.md,
  },
  searchBarPlaceholder: {
    flex: 1,
    fontSize: Theme.fontSize.base,
    color: Colors.textTertiary,
  },

  // ── Icon button (live buses toggle) ──────────────────────────────────────
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: Theme.radius.full,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadow.md,
  },
  iconBtnActive: {
    backgroundColor: Colors.primary,
  },

  // ── Zoom hint ─────────────────────────────────────────────────────────────
  zoomHint: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: Theme.radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: 6,
    ...Theme.shadow.sm,
  },
  zoomHintText: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textSecondary,
  },

  // ── Loading badge ─────────────────────────────────────────────────────────
  loadingBadge: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: Colors.white,
    borderRadius: Theme.radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: 8,
    gap: 8,
    ...Theme.shadow.sm,
  },
  loadingText: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textSecondary,
  },

  // ── Location button ───────────────────────────────────────────────────────
  locationBtn: {
    position: 'absolute',
    right: Theme.spacing.base,
  },
  locationBtnInner: {
    width: 50,
    height: 50,
    borderRadius: Theme.radius.full,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadow.md,
  },

  // ── Stop markers ──────────────────────────────────────────────────────────
  stopMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  stopMarkerSelected: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primaryDark,
    borderWidth: 2.5,
  },

  // ── Bus markers ───────────────────────────────────────────────────────────
  busMarker: {
    borderRadius: Theme.radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  busMarkerText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: Theme.fontWeight.extrabold,
  },

  // ── Line badge ────────────────────────────────────────────────────────────
  lineBadge: {
    borderRadius: Theme.radius.sm,
    minWidth: 36,
    alignItems: 'center',
  },
  lineBadgeText: {
    color: Colors.white,
    fontWeight: Theme.fontWeight.bold,
  },

  // ── Bottom sheet ──────────────────────────────────────────────────────────
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: Theme.radius.xxl,
    borderTopRightRadius: Theme.radius.xxl,
    paddingHorizontal: Theme.spacing.base,
    ...Theme.shadow.lg,
  },
  sheetHandleArea: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  sheetIconWrap: {
    width: 42,
    height: 42,
    borderRadius: Theme.radius.full,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetStopName: {
    fontSize: Theme.fontSize.md,
    fontWeight: Theme.fontWeight.bold,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  sheetStopId: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  sheetNoDeps: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginVertical: Theme.spacing.md,
  },
  sheetMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
  },
  sheetMoreText: {
    fontSize: Theme.fontSize.sm,
    color: Colors.primary,
    fontWeight: Theme.fontWeight.semibold,
  },
  sheetActions: {
    marginTop: Theme.spacing.sm,
    paddingTop: Theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sheetDetailBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Theme.radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  sheetDetailBtnText: {
    color: Colors.white,
    fontWeight: Theme.fontWeight.bold,
    fontSize: Theme.fontSize.base,
  },

  // ── Departure row ─────────────────────────────────────────────────────────
  departureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.sm,
  },
  departureHeadsign: {
    flex: 1,
    fontSize: Theme.fontSize.sm,
    color: Colors.textPrimary,
  },
  departureEta: {
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.bold,
    minWidth: 48,
    textAlign: 'right',
  },

  // ── Separator ─────────────────────────────────────────────────────────────
  separator: {
    height: 1,
    backgroundColor: Colors.border,
  },

  // ── Search modal ──────────────────────────────────────────────────────────
  searchModal: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.base,
    paddingBottom: Theme.spacing.sm,
    gap: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInputWrap: {
    flex: 1,
    height: 44,
    backgroundColor: Colors.surface,
    borderRadius: Theme.radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.base,
  },
  searchInput: {
    flex: 1,
    fontSize: Theme.fontSize.base,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  searchCancelBtn: {
    paddingVertical: Theme.spacing.sm,
  },
  searchCancelText: {
    fontSize: Theme.fontSize.base,
    color: Colors.primary,
    fontWeight: Theme.fontWeight.semibold,
  },
  searchEmptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    paddingBottom: 80,
  },
  searchEmptyText: {
    fontSize: Theme.fontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  searchResultIcon: {
    width: 32,
    height: 32,
    borderRadius: Theme.radius.full,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultName: {
    flex: 1,
    fontSize: Theme.fontSize.base,
    color: Colors.textPrimary,
    fontWeight: Theme.fontWeight.medium,
  },
  searchResultSub: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
});
