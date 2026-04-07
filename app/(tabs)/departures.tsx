import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Theme } from '../../constants/theme';
import useStops from '../../hooks/useStops';
import useDepartures from '../../hooks/useDepartures';
import { useFavoritesStore } from '../../store/useFavoritesStore';
import { BusStop, UpcomingBus, LiveBus, LineVariant } from '../../types';
import { searchLines, getLiveBusesForLine } from '../../services/api/lines';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return 'hace un momento';
  const mins = Math.floor(diff / 60);
  if (mins === 1) return 'hace 1 min';
  return `hace ${mins} min`;
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function DepartureRow({ departure }: { departure: UpcomingBus }) {
  const min = departure.etaMinutes;
  const etaColor = min < 2 ? Colors.error : min < 5 ? Colors.warning : Colors.primary;
  const etaText = min < 1 ? 'Ahora' : `${Math.round(min)} min`;

  return (
    <View style={styles.depRow}>
      <View style={styles.lineBadge}>
        <Text style={styles.lineBadgeText}>{departure.lineName}</Text>
      </View>
      <Text style={styles.depHeadsign} numberOfLines={1}>
        {departure.headsign}
      </Text>
      <View style={styles.etaWrap}>
        {departure.isRealtime && <View style={styles.realtimeDot} />}
        <Text style={[styles.eta, { color: etaColor }]}>{etaText}</Text>
      </View>
    </View>
  );
}

function StopSearchResult({
  stop,
  onSelect,
}: {
  stop: BusStop;
  onSelect: (stop: BusStop) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.searchResult}
      onPress={() => onSelect(stop)}
      activeOpacity={0.7}
    >
      <View style={styles.stopIcon}>
        <Ionicons name="bus" size={16} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stopName}>{stop.name}</Text>
        <Text style={styles.stopId}>Parada #{stop.id}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

// ─── Paradas tab ─────────────────────────────────────────────────────────────

function ParadasTab() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
  const { loading: stopsLoading, searchStops } = useStops();
  const { departures, loading: depsLoading, error, refresh } = useDepartures(
    selectedStop?.id ?? null,
    selectedStop?.latitude,
    selectedStop?.longitude
  );
  const { isFavoriteStop, addFavoriteStop, removeFavoriteStop } = useFavoritesStore();

  const results = query.length >= 2 ? searchStops(query) : [];
  const isFav = selectedStop ? isFavoriteStop(selectedStop.id) : false;

  const toggleFavorite = () => {
    if (!selectedStop) return;
    if (isFav) {
      removeFavoriteStop(selectedStop.id);
    } else {
      addFavoriteStop({
        id: selectedStop.id,
        name: selectedStop.name,
        latitude: selectedStop.latitude,
        longitude: selectedStop.longitude,
      });
    }
  };

  const handleSelectStop = (stop: BusStop) => {
    setSelectedStop(stop);
    setQuery('');
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Blue header with search bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar parada..."
            placeholderTextColor={Colors.textTertiary}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Search results */}
      {query.length >= 2 && (
        <View style={styles.resultsWrap}>
          {stopsLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ padding: 20 }} />
          ) : results.length === 0 ? (
            <Text style={styles.noResults}>No se encontraron paradas</Text>
          ) : (
            <FlatList
              data={results.slice(0, 20)}
              keyExtractor={(s) => String(s.id)}
              renderItem={({ item }) => (
                <StopSearchResult stop={item} onSelect={handleSelectStop} />
              )}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      )}

      {/* Selected stop departures */}
      {!query && selectedStop && (
        <View style={{ flex: 1 }}>
          <View style={styles.stopHeader}>
            <TouchableOpacity onPress={() => setSelectedStop(null)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.stopHeaderName}>{selectedStop.name}</Text>
              <Text style={styles.stopHeaderId}>Parada #{selectedStop.id}</Text>
            </View>
            <TouchableOpacity onPress={toggleFavorite} style={styles.favBtn}>
              <Ionicons
                name={isFav ? 'star' : 'star-outline'}
                size={22}
                color={isFav ? Colors.warning : Colors.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push(`/stop/${selectedStop.id}`)}
              style={styles.detailBtn}
            >
              <Ionicons name="information-circle-outline" size={22} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {depsLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Cargando salidas...</Text>
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
              <Text style={styles.errorText}>Error al cargar salidas</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
                <Text style={styles.retryText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : departures.length === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="bus-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No hay salidas próximas</Text>
            </View>
          ) : (
            <FlatList
              data={departures}
              keyExtractor={(d, i) => `${d.lineId}-${i}`}
              renderItem={({ item }) => <DepartureRow departure={item} />}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              refreshControl={
                <RefreshControl
                  refreshing={depsLoading}
                  onRefresh={refresh}
                  tintColor={Colors.primary}
                />
              }
              contentContainerStyle={{ paddingBottom: 40 }}
              ListHeaderComponent={
                <View style={styles.depHeader}>
                  <View style={styles.realtimeDot} />
                  <Text style={styles.depHeaderText}>Tiempo real</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* Empty state */}
      {!query && !selectedStop && (
        <View style={styles.centered}>
          <Ionicons name="bus-outline" size={64} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>Busca una parada</Text>
          <Text style={styles.emptySubtitle}>
            Escribe el nombre de la parada para ver las próximas salidas
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Líneas tab ───────────────────────────────────────────────────────────────

type GroupedLine = {
  lineName: string;
  variants: LineVariant[];
};

function LiveBusView({
  lineName,
  onBack,
}: {
  lineName: string;
  onBack: () => void;
}) {
  const router = useRouter();
  const [buses, setBuses] = useState<(LiveBus & { destination?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLiveBusesForLine(lineName);
      setBuses(data as (LiveBus & { destination?: string })[]);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, [lineName]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  const LINE_COLORS = [
    '#E53E3E', '#38A169', '#D69E2E', '#805AD5',
    '#DD6B20', '#0055B3', '#00897B',
  ];
  function lineColor(name: string): string {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) % LINE_COLORS.length;
    return LINE_COLORS[h];
  }
  const color = lineColor(lineName);

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.liveBusHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.primary} />
        </TouchableOpacity>
        <View style={[styles.bigLineBadge, { backgroundColor: color }]}>
          <Text style={styles.bigLineBadgeText}>{lineName}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: Theme.spacing.sm }}>
          <Text style={styles.liveTitle}>Línea {lineName} en vivo</Text>
          <Text style={styles.liveSubtitle}>
            {loading ? 'Actualizando...' : `${buses.length} bus${buses.length !== 1 ? 'es' : ''} activo${buses.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
        {loading && <ActivityIndicator size="small" color={Colors.primary} />}
      </View>

      {buses.length === 0 && !loading ? (
        <View style={styles.centered}>
          <Ionicons name="bus-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>No hay buses activos</Text>
        </View>
      ) : (
        <FlatList
          data={buses}
          keyExtractor={(b, i) => `${b.busId}-${b.lineVariantId}-${i}`}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 4 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => {
            const hasSpeed = typeof item.speed === 'number' && item.speed > 0;
            return (
              <View style={styles.liveBusRow}>
                <View style={styles.liveBusLeft}>
                  <Text style={styles.liveBusId}>{item.busId}</Text>
                  {(item as any).destination ? (
                    <Text style={styles.liveBusDest} numberOfLines={1}>
                      {(item as any).destination}
                    </Text>
                  ) : null}
                  <View style={styles.liveBusMeta}>
                    {hasSpeed && (
                      <Text style={styles.liveBusSpeed}>{Math.round(item.speed!)} km/h</Text>
                    )}
                    <Text style={styles.liveBusTime}>{relativeTime(item.lastUpdate)}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.mapBtn, { borderColor: color }]}
                  onPress={() => router.push(`/line/${encodeURIComponent(lineName)}`)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="map-outline" size={14} color={color} />
                  <Text style={[styles.mapBtnText, { color }]}>Ver en mapa</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function LineasTab() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LineVariant[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 1) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchLines(query);
        setResults(data);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Group variants by lineName
  const grouped: GroupedLine[] = React.useMemo(() => {
    const map = new Map<string, LineVariant[]>();
    for (const v of results) {
      const arr = map.get(v.lineName) ?? [];
      arr.push(v);
      map.set(v.lineName, arr);
    }
    return Array.from(map.entries()).map(([lineName, variants]) => ({ lineName, variants }));
  }, [results]);

  const LINE_COLORS = [
    '#E53E3E', '#38A169', '#D69E2E', '#805AD5',
    '#DD6B20', '#0055B3', '#00897B',
  ];
  function lineColor(name: string): string {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) % LINE_COLORS.length;
    return LINE_COLORS[h];
  }

  if (selectedLine) {
    return (
      <LiveBusView
        lineName={selectedLine}
        onBack={() => setSelectedLine(null)}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Blue header with search bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar línea (ej: 104, C1, D1)..."
            placeholderTextColor={Colors.textTertiary}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCapitalize="characters"
          />
        </View>
      </View>

      {/* Results */}
      {query.length >= 1 && (
        <View style={styles.resultsWrap}>
          {searching ? (
            <ActivityIndicator color={Colors.primary} style={{ padding: 20 }} />
          ) : grouped.length === 0 ? (
            <Text style={styles.noResults}>No se encontraron líneas</Text>
          ) : (
            <FlatList
              data={grouped}
              keyExtractor={(g) => g.lineName}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={[styles.sep, { marginLeft: 0 }]} />}
              renderItem={({ item: group }) => {
                const color = lineColor(group.lineName);
                return (
                  <View style={styles.lineGroup}>
                    <View style={styles.lineGroupHeader}>
                      <View style={[styles.lineGroupBadge, { backgroundColor: color }]}>
                        <Text style={styles.lineGroupBadgeText}>{group.lineName}</Text>
                      </View>
                    </View>
                    {group.variants.map((variant) => (
                      <TouchableOpacity
                        key={variant.id}
                        style={styles.variantRow}
                        onPress={() => setSelectedLine(group.lineName)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="arrow-forward-circle-outline"
                          size={16}
                          color={color}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.variantHeadsign} numberOfLines={1}>
                          {variant.headsign || 'Sin destino'}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              }}
            />
          )}
        </View>
      )}

      {/* Empty state */}
      {query.length < 1 && (
        <View style={styles.centered}>
          <Ionicons name="git-branch-outline" size={64} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>Busca una línea</Text>
          <Text style={styles.emptySubtitle}>
            Escribe el número de línea para ver sus recorridos en vivo
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

type Tab = 'paradas' | 'lineas';

export default function DeparturesScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('paradas');

  return (
    <View style={styles.container}>
      {/* Tab switcher */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'paradas' && styles.tabBtnActive]}
          onPress={() => setActiveTab('paradas')}
          activeOpacity={0.8}
        >
          <Text
            style={[styles.tabBtnText, activeTab === 'paradas' && styles.tabBtnTextActive]}
          >
            Paradas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'lineas' && styles.tabBtnActive]}
          onPress={() => setActiveTab('lineas')}
          activeOpacity={0.8}
        >
          <Text
            style={[styles.tabBtnText, activeTab === 'lineas' && styles.tabBtnTextActive]}
          >
            Líneas
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab content */}
      {activeTab === 'paradas' ? <ParadasTab /> : <LineasTab />}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },

  // Tab switcher
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingHorizontal: Theme.spacing.base,
    paddingTop: Theme.spacing.xs,
    paddingBottom: 0,
    gap: Theme.spacing.xs,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: Colors.white,
  },
  tabBtnText: {
    fontSize: Theme.fontSize.base,
    fontWeight: Theme.fontWeight.medium,
    color: 'rgba(255,255,255,0.65)',
  },
  tabBtnTextActive: {
    color: Colors.white,
    fontWeight: Theme.fontWeight.bold,
  },

  // Search
  searchWrap: {
    backgroundColor: Colors.primary,
    padding: Theme.spacing.base,
    paddingTop: Theme.spacing.sm,
  },
  searchBar: {
    backgroundColor: Colors.white,
    borderRadius: Theme.radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: Theme.spacing.sm,
    ...Theme.shadow.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Theme.fontSize.base,
    color: Colors.textPrimary,
    paddingVertical: 4,
  },

  // Results
  resultsWrap: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.base,
    gap: Theme.spacing.sm,
    backgroundColor: Colors.white,
  },
  stopIcon: {
    width: 36,
    height: 36,
    borderRadius: Theme.radius.full,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopName: { fontSize: Theme.fontSize.base, color: Colors.textPrimary, fontWeight: '500' },
  stopId: { fontSize: Theme.fontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  noResults: {
    textAlign: 'center',
    color: Colors.textSecondary,
    padding: Theme.spacing.xl,
    fontSize: Theme.fontSize.base,
  },

  // Stop header
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Theme.spacing.sm,
  },
  backBtn: { padding: 4 },
  stopHeaderName: {
    fontSize: Theme.fontSize.md,
    fontWeight: Theme.fontWeight.bold,
    color: Colors.textPrimary,
  },
  stopHeaderId: { fontSize: Theme.fontSize.xs, color: Colors.textSecondary },
  favBtn: { padding: 4 },
  detailBtn: { padding: 4 },

  // Departures
  depHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.base,
    gap: 6,
  },
  depHeaderText: { fontSize: Theme.fontSize.xs, color: Colors.textSecondary, fontWeight: '500' },
  depRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  lineBadge: {
    backgroundColor: Colors.primary,
    borderRadius: Theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 48,
    alignItems: 'center',
  },
  lineBadgeText: { color: Colors.white, fontSize: Theme.fontSize.sm, fontWeight: '700' },
  depHeadsign: { flex: 1, fontSize: Theme.fontSize.base, color: Colors.textPrimary },
  etaWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  realtimeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  eta: {
    fontSize: Theme.fontSize.md,
    fontWeight: Theme.fontWeight.bold,
    minWidth: 50,
    textAlign: 'right',
  },

  // Lines tab
  lineGroup: {
    backgroundColor: Colors.white,
  },
  lineGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.base,
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
  },
  lineGroupBadge: {
    borderRadius: Theme.radius.sm,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 4,
    minWidth: 44,
    alignItems: 'center',
  },
  lineGroupBadgeText: {
    color: Colors.white,
    fontSize: Theme.fontSize.md,
    fontWeight: Theme.fontWeight.bold,
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: Theme.spacing.sm,
    paddingLeft: Theme.spacing.xl + Theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  variantHeadsign: {
    flex: 1,
    fontSize: Theme.fontSize.base,
    color: Colors.textPrimary,
  },

  // Live bus view
  liveBusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Theme.spacing.sm,
  },
  bigLineBadge: {
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    minWidth: 52,
    alignItems: 'center',
  },
  bigLineBadgeText: {
    color: Colors.white,
    fontSize: Theme.fontSize.lg,
    fontWeight: Theme.fontWeight.bold,
  },
  liveTitle: {
    fontSize: Theme.fontSize.md,
    fontWeight: Theme.fontWeight.bold,
    color: Colors.textPrimary,
  },
  liveSubtitle: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  liveBusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  liveBusLeft: {
    flex: 1,
    gap: 2,
  },
  liveBusId: {
    fontSize: Theme.fontSize.md,
    fontWeight: Theme.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  liveBusDest: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textSecondary,
  },
  liveBusMeta: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    marginTop: 2,
  },
  liveBusSpeed: {
    fontSize: Theme.fontSize.xs,
    color: Colors.success,
    fontWeight: Theme.fontWeight.medium,
  },
  liveBusTime: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textTertiary,
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: Theme.radius.full,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
  },
  mapBtnText: {
    fontSize: Theme.fontSize.xs,
    fontWeight: Theme.fontWeight.medium,
  },

  // Shared
  sep: { height: 1, backgroundColor: Colors.border, marginLeft: Theme.spacing.base },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Theme.spacing.xl,
    gap: Theme.spacing.md,
  },
  loadingText: { color: Colors.textSecondary, fontSize: Theme.fontSize.base },
  errorText: { color: Colors.textPrimary, fontSize: Theme.fontSize.md, fontWeight: '600' },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radius.full,
  },
  retryText: { color: Colors.white, fontWeight: '600' },
  emptyText: { color: Colors.textSecondary, fontSize: Theme.fontSize.base },
  emptyTitle: { fontSize: Theme.fontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  emptySubtitle: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
