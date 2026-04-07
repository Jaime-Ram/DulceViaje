import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ExpoLocation from 'expo-location';

import { Colors } from '../../constants/colors';
import { Theme } from '../../constants/theme';
import { useJourneyStore } from '../../store/useJourneyStore';
import { useFavoritesStore } from '../../store/useFavoritesStore';
import useStops from '../../hooks/useStops';
import { searchAddress } from '../../services/api/geocoding';
import { getUpcomingBuses } from '../../services/api/stops';
import { findNearbyStops, haversineMeters } from '../../services/storage/stopRoutes';
import { isLineWheelchairAccessible } from '../../services/storage/lineWheelchair';
import { FavoriteStop, Location, UpcomingBus, Journey, JourneyLeg } from '../../types';
import { formatTime, formatDuration } from '../../utils/time';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const QUICK_CARD_GAP = Theme.spacing.sm;
const QUICK_CARD_WIDTH =
  (SCREEN_WIDTH - Theme.spacing.base * 2 - QUICK_CARD_GAP) / 2;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type SearchResult =
  | { kind: 'myLocation' }
  | { kind: 'stop'; id: number; name: string; latitude: number; longitude: number }
  | { kind: 'address'; name: string; address?: string; latitude: number; longitude: number };

// ─────────────────────────────────────────────────────────────────────────────
// LocationSearchModal
// ─────────────────────────────────────────────────────────────────────────────
interface LocationSearchModalProps {
  visible: boolean;
  placeholder: string;
  onSelect: (location: Location) => void;
  onClose: () => void;
}

function LocationSearchModal({
  visible,
  placeholder,
  onSelect,
  onClose,
}: LocationSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);
  const { searchStops } = useStops();
  const recentLocations = useJourneyStore((s) => s.recentLocations);

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setQuery('');
      setResults([]);
      setSearching(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [visible]);

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        const [addresses, matchedStops] = await Promise.all([
          searchAddress(q),
          Promise.resolve(searchStops(q).slice(0, 8)),
        ]);

        const stopResults: SearchResult[] = matchedStops.map((s) => ({
          kind: 'stop',
          id: s.id,
          name: s.name,
          latitude: s.latitude,
          longitude: s.longitude,
        }));
        const addrResults: SearchResult[] = addresses.map((a) => ({
          kind: 'address',
          name: a.name,
          address: a.address,
          latitude: a.latitude,
          longitude: a.longitude,
        }));
        // Addresses (neighborhoods, areas) before stops so "Ciudad Vieja" etc. rank first
        setResults([...addrResults, ...stopResults]);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [searchStops]
  );

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => runSearch(text), 300);
    },
    [runSearch]
  );

  const handleMyLocation = useCallback(async () => {
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });
      onSelect({
        name: 'Mi ubicación',
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch {
      // silently ignore
    }
  }, [onSelect]);

  const handleSelect = useCallback(
    (item: SearchResult) => {
      if (item.kind === 'myLocation') {
        handleMyLocation();
        return;
      }
      if (item.kind === 'stop') {
        onSelect({
          name: item.name,
          latitude: item.latitude,
          longitude: item.longitude,
          stopId: item.id,
        });
      } else {
        onSelect({
          name: item.name,
          address: item.address,
          latitude: item.latitude,
          longitude: item.longitude,
        });
      }
    },
    [handleMyLocation, onSelect]
  );

  const recentItems: SearchResult[] = query.length === 0
    ? recentLocations.map((l) => ({ kind: 'address' as const, name: l.name, address: l.address, latitude: l.latitude, longitude: l.longitude }))
    : [];

  const allItems: SearchResult[] = [{ kind: 'myLocation' }, ...recentItems, ...results];

  const renderItem = ({ item, index }: { item: SearchResult; index: number }) => {
    // Section header for recents
    const isFirstRecent = query.length === 0 && index === 1 && recentItems.length > 0;
    const isFirstResult = results.length > 0 && index === 1 + recentItems.length;
    if (item.kind === 'myLocation') {
      return (
        <TouchableOpacity
          style={styles.resultRow}
          onPress={() => handleSelect(item)}
          activeOpacity={0.7}
        >
          <View style={[styles.resultIcon, { backgroundColor: Colors.primarySurface }]}>
            <Ionicons name="navigate" size={18} color={Colors.primary} />
          </View>
          <View style={styles.resultText}>
            <Text style={styles.resultName}>Mi ubicación</Text>
            <Text style={styles.resultSub}>Usar ubicación actual</Text>
          </View>
        </TouchableOpacity>
      );
    }
    if (item.kind === 'stop') {
      return (
        <TouchableOpacity
          style={styles.resultRow}
          onPress={() => handleSelect(item)}
          activeOpacity={0.7}
        >
          <View style={[styles.resultIcon, { backgroundColor: Colors.primarySurface }]}>
            <Ionicons name="bus" size={18} color={Colors.primary} />
          </View>
          <View style={styles.resultText}>
            <Text style={styles.resultName}>{item.name}</Text>
            <Text style={styles.resultSub}>Parada #{(item as any).id}</Text>
          </View>
        </TouchableOpacity>
      );
    }
    // address / recent
    const isRecent = query.length === 0 && recentItems.some((r) => r.kind === 'address' && r.name === item.name);
    return (
      <>
        {isFirstRecent && index === (allItems.indexOf(item)) && (
          <Text style={styles.resultSectionHeader}>Recientes</Text>
        )}
        {isFirstResult && !isRecent && (
          <Text style={styles.resultSectionHeader}>Resultados</Text>
        )}
        <TouchableOpacity
          style={styles.resultRow}
          onPress={() => handleSelect(item)}
          activeOpacity={0.7}
        >
          <View style={[styles.resultIcon, { backgroundColor: isRecent ? Colors.secondaryLight : '#FEE2E2' }]}>
            <Ionicons name={isRecent ? 'time' : 'location'} size={18} color={isRecent ? Colors.secondaryDark : Colors.error} />
          </View>
          <View style={styles.resultText}>
            <Text style={styles.resultName}>{item.name}</Text>
            {item.address ? (
              <Text style={styles.resultSub} numberOfLines={1}>{item.address}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
      </>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        {/* Modal header */}
        <View style={styles.modalHeader}>
          <View style={styles.modalSearchBar}>
            <Ionicons name="search" size={18} color={Colors.textSecondary} />
            <TextInput
              ref={inputRef}
              style={styles.modalInput}
              placeholder={placeholder}
              placeholderTextColor={Colors.textTertiary}
              value={query}
              onChangeText={handleQueryChange}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => handleQueryChange('')}>
                <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={() => { Keyboard.dismiss(); onClose(); }} style={styles.modalCancel}>
            <Text style={styles.modalCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.modalDivider} />

        {/* Results */}
        {searching ? (
          <ActivityIndicator
            size="small"
            color={Colors.primary}
            style={{ marginTop: Theme.spacing.xl }}
          />
        ) : (
          <FlatList
            data={allItems}
            keyExtractor={(item, index) => {
              if (item.kind === 'myLocation') return 'my-location';
              if (item.kind === 'stop') return `stop-${item.id}`;
              return `addr-${index}`;
            }}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={styles.resultSeparator} />}
            contentContainerStyle={{ paddingBottom: Theme.spacing.xxxl }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FavoriteStopCard (horizontal scroll card)
// ─────────────────────────────────────────────────────────────────────────────
function FavoriteStopCard({
  stop,
  onPress,
}: {
  stop: FavoriteStop;
  onPress: () => void;
}) {
  const [departures, setDepartures] = useState<UpcomingBus[]>([]);

  useEffect(() => {
    getUpcomingBuses(stop.id, undefined, 3, stop.latitude, stop.longitude)
      .then((buses) => setDepartures(buses.slice(0, 2)))
      .catch(() => {});
  }, [stop.id]);

  return (
    <TouchableOpacity style={styles.favCard} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.favCardHeader}>
        <View style={styles.favCardIcon}>
          <Ionicons name="star" size={14} color={Colors.primary} />
        </View>
        <Text style={styles.favCardName} numberOfLines={2}>
          {stop.customName ?? stop.name}
        </Text>
      </View>
      <View style={styles.favCardDeps}>
        {departures.length === 0 ? (
          <Text style={styles.favCardNoDep}>Sin datos</Text>
        ) : (
          departures.map((d, i) => (
            <View key={i} style={styles.favCardDep}>
              <View style={styles.favCardBadge}>
                <Text style={styles.favCardBadgeText}>{d.lineName}</Text>
              </View>
              <Text style={styles.favCardDepMin}>
                {d.etaMinutes < 1 ? 'Ya' : `${Math.round(d.etaMinutes)} min`}
              </Text>
            </View>
          ))
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QuickAccessCard
// ─────────────────────────────────────────────────────────────────────────────
function QuickAccessCard({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.quickIconWrap}>
        <Ionicons name={icon} size={22} color={Colors.primary} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HomeScreen
// ─────────────────────────────────────────────────────────────────────────────
// ── Line color palette ────────────────────────────────────────────────────────
const LINE_PALETTE = ['#E53E3E','#38A169','#D69E2E','#0055B3','#805AD5','#DD6B20','#00897B','#C2185B'];
function lineColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % LINE_PALETTE.length;
  return LINE_PALETTE[h];
}

// ── Journey generation using GTFS stop data ───────────────────────────────────
function generateJourneys(from: Location, to: Location, baseTime: Date = new Date()): Journey[] {
  const now = baseTime;
  const AVG_BUS_SPEED_KMH = 16; // Montevideo average
  const WALK_SPEED_KMH = 4.5;

  // Find nearby stops (within 700m of each end)
  const fromStops = findNearbyStops(from.latitude, from.longitude, 700).slice(0, 6);
  const toStops = findNearbyStops(to.latitude, to.longitude, 700).slice(0, 6);

  // Collect all lines serving from-stops and to-stops
  const fromLines = new Set(fromStops.flatMap((s) => s.lines));
  const toLines = new Set(toStops.flatMap((s) => s.lines));

  // Direct lines (appear in both sets)
  const directLines = [...fromLines].filter((l) => toLines.has(l));

  // Direct route distance estimate
  const directDistKm = haversineMeters(from.latitude, from.longitude, to.latitude, to.longitude) / 1000;
  const busTravelMin = Math.round((directDistKm / AVG_BUS_SPEED_KMH) * 60);

  const makeDirectJourney = (id: string, offsetMin: number, lineName: string, fromStop: typeof fromStops[0] | null, toStop: typeof toStops[0] | null): Journey => {
    const walkToStop = fromStop ? Math.round((fromStop.distanceMeters / 1000 / WALK_SPEED_KMH) * 60) : 3;
    const walkFromStop = toStop ? Math.round((toStop.distanceMeters / 1000 / WALK_SPEED_KMH) * 60) : 3;
    const dep = new Date(now.getTime() + offsetMin * 60000);
    const boardTime = new Date(dep.getTime() + walkToStop * 60000);
    const alightTime = new Date(boardTime.getTime() + busTravelMin * 60000);
    const arr = new Date(alightTime.getTime() + walkFromStop * 60000);
    const totalMin = Math.round((arr.getTime() - dep.getTime()) / 60000);
    const color = lineColor(lineName);
    const boardCoord = fromStop ?? { lat: from.latitude, lon: from.longitude, name: from.name };
    const alightCoord = toStop ?? { lat: to.latitude, lon: to.longitude, name: to.name };
    const legs: JourneyLeg[] = [
      {
        type: 'walk', from, departureTime: dep, arrivalTime: boardTime, duration: walkToStop,
        distance: Math.round(fromStop?.distanceMeters ?? 200),
        to: { name: fromStop?.name ?? from.name, latitude: boardCoord.lat, longitude: boardCoord.lon },
      },
      {
        type: 'bus', departureTime: boardTime, arrivalTime: alightTime, duration: busTravelMin,
        from: { name: fromStop?.name ?? from.name, latitude: boardCoord.lat, longitude: boardCoord.lon },
        to: { name: toStop?.name ?? to.name, latitude: alightCoord.lat, longitude: alightCoord.lon },
        line: { id: lineName, name: `Línea ${lineName}`, shortName: lineName, color },
        headsign: to.name.split(',')[0],
        wheelchairAccessible: isLineWheelchairAccessible(lineName),
      },
      ...(walkFromStop > 1 ? [{
        type: 'walk' as const, departureTime: alightTime, arrivalTime: arr, duration: walkFromStop,
        distance: Math.round(toStop?.distanceMeters ?? 200),
        from: { name: toStop?.name ?? to.name, latitude: alightCoord.lat, longitude: alightCoord.lon },
        to,
      }] : []),
    ];
    return { id, from, to, departureTime: dep, arrivalTime: arr, duration: totalMin, transfers: 0, legs };
  };

  const makeTransferJourney = (id: string, offsetMin: number, line1: string, line2: string): Journey => {
    const dep = new Date(now.getTime() + offsetMin * 60000);
    const walkMin = 4;
    const leg1Min = Math.round(busTravelMin * 0.5);
    const transferWalkMin = 5;
    const leg2Min = Math.round(busTravelMin * 0.55);
    const arr = new Date(dep.getTime() + (walkMin + leg1Min + transferWalkMin + leg2Min) * 60000);
    const totalMin = Math.round((arr.getTime() - dep.getTime()) / 60000);
    const midCoord = {
      latitude: (from.latitude + to.latitude) / 2,
      longitude: (from.longitude + to.longitude) / 2,
    };
    const midLoc = { name: 'Correspondencia', latitude: midCoord.latitude, longitude: midCoord.longitude };
    const t1 = new Date(dep.getTime() + walkMin * 60000);
    const t2 = new Date(t1.getTime() + leg1Min * 60000);
    const t3 = new Date(t2.getTime() + transferWalkMin * 60000);
    const legs: JourneyLeg[] = [
      { type: 'walk', from, to: from, departureTime: dep, arrivalTime: t1, duration: walkMin, distance: 280 },
      { type: 'bus', from, to: midLoc, departureTime: t1, arrivalTime: t2, duration: leg1Min, line: { id: line1, name: `Línea ${line1}`, shortName: line1, color: lineColor(line1) }, headsign: 'Centro', wheelchairAccessible: isLineWheelchairAccessible(line1) },
      { type: 'walk', from: midLoc, to: midLoc, departureTime: t2, arrivalTime: t3, duration: transferWalkMin, distance: 350 },
      { type: 'bus', from: midLoc, to, departureTime: t3, arrivalTime: arr, duration: leg2Min, line: { id: line2, name: `Línea ${line2}`, shortName: line2, color: lineColor(line2) }, headsign: to.name.split(',')[0], wheelchairAccessible: isLineWheelchairAccessible(line2) },
    ];
    return { id, from, to, departureTime: dep, arrivalTime: arr, duration: totalMin, transfers: 1, legs };
  };

  const results: Journey[] = [];

  // Up to 2 direct routes with different lines
  const usedDirectLines = directLines.slice(0, 2);
  usedDirectLines.forEach((lineName, i) => {
    const fromStop = fromStops.find((s) => s.lines.includes(lineName)) ?? null;
    const toStop = toStops.find((s) => s.lines.includes(lineName)) ?? null;
    results.push(makeDirectJourney(`j${i + 1}`, 3 + i * 8, lineName, fromStop, toStop));
  });

  // If fewer than 2 direct, add a transfer route
  if (results.length < 2) {
    const fallbackFrom = fromLines.size > 0 ? [...fromLines][0] : '101';
    const fallbackTo = toLines.size > 0 ? [...toLines][0] : '186';
    if (results.length === 0) {
      // No direct lines found — generic estimated journey
      results.push(makeDirectJourney('j1', 4, fallbackFrom, fromStops[0] ?? null, null));
    }
    results.push(makeTransferJourney(`j${results.length + 1}`, 10, fallbackFrom, fallbackTo));
  }

  // Add a 3rd option (next departure of first line, ~10min later)
  if (results.length < 3 && usedDirectLines.length > 0) {
    const lineName = usedDirectLines[0];
    const fromStop = fromStops.find((s) => s.lines.includes(lineName)) ?? null;
    const toStop = toStops.find((s) => s.lines.includes(lineName)) ?? null;
    results.push(makeDirectJourney('j3', 14, lineName, fromStop, toStop));
  }

  return results.slice(0, 3);
}

// ── NS-style journey row ─────────────────────────────────────────────────────
function JourneyResultCard({
  journey, onPress, onSave, saved, featured,
}: {
  journey: Journey;
  onPress: () => void;
  onSave: () => void;
  saved: boolean;
  featured?: boolean;
}) {
  const busLegs = journey.legs.filter((l) => l.type === 'bus');
  const allAccessible = busLegs.length > 0 && busLegs.every((l) => l.wheelchairAccessible === true);
  const someNotAccessible = busLegs.some((l) => l.wheelchairAccessible === false);
  const wheelchairStatus: boolean | null = someNotAccessible ? false : allAccessible ? true : null;

  return (
    <TouchableOpacity
      style={[styles.nsJourneyRow, featured && styles.nsJourneyRowFeatured]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Left accent bar on featured */}
      {featured && <View style={styles.nsAccentBar} />}

      <View style={styles.nsJourneyContent}>
        {/* Times + bookmark */}
        <View style={styles.nsTimesRow}>
          <Text style={styles.nsTimes}>
            {formatTime(new Date(journey.departureTime))}
            <Text style={styles.nsTimeDash}> – </Text>
            {formatTime(new Date(journey.arrivalTime))}
          </Text>
          <TouchableOpacity onPress={onSave} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={saved ? Colors.secondary : Colors.textTertiary}
            />
          </TouchableOpacity>
        </View>

        {/* Stats row: duration, transfers, wheelchair */}
        <View style={styles.nsStatsRow}>
          <View style={styles.nsStat}>
            <Ionicons name="time-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.nsStatText}>{formatDuration(journey.duration)}</Text>
          </View>
          <View style={styles.nsStat}>
            <Ionicons name="git-branch-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.nsStatText}>
              {journey.transfers}x
            </Text>
          </View>
          {wheelchairStatus === true && (
            <View style={styles.nsStat}>
              <Ionicons name="accessibility" size={13} color="#38A169" />
            </View>
          )}
          {wheelchairStatus === false && (
            <View style={styles.nsStat}>
              <Ionicons name="accessibility" size={13} color={Colors.error} />
              <Text style={[styles.nsStatText, { color: Colors.error }]}>?</Text>
            </View>
          )}
          {wheelchairStatus === null && (
            <View style={styles.nsStat}>
              <Ionicons name="accessibility-outline" size={13} color={Colors.textTertiary} />
              <Text style={[styles.nsStatText, { color: Colors.textTertiary }]}>?</Text>
            </View>
          )}
        </View>

        {/* Bus lines row */}
        <View style={styles.nsBusRow}>
          {busLegs.map((leg, i) => (
            <React.Fragment key={i}>
              {i > 0 && <Ionicons name="chevron-forward" size={12} color={Colors.textTertiary} />}
              <View style={[styles.nsBusBadge, { backgroundColor: leg.line?.color ?? Colors.primary }]}>
                <Text style={styles.nsBusBadgeText}>{leg.line?.shortName}</Text>
              </View>
              <Text style={styles.nsBusHeadsign} numberOfLines={1}>
                {leg.headsign}
              </Text>
            </React.Fragment>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
}

type PickingField = 'from' | 'to' | null;

export default function HomeScreen() {
  const router = useRouter();
  const fromLocation = useJourneyStore((s) => s.fromLocation);
  const toLocation = useJourneyStore((s) => s.toLocation);
  const setFrom = useJourneyStore((s) => s.setFrom);
  const setTo = useJourneyStore((s) => s.setTo);
  const swapLocations = useJourneyStore((s) => s.swapLocations);
  const addRecentJourney = useJourneyStore((s) => s.addRecentJourney);
  const addRecentLocation = useJourneyStore((s) => s.addRecentLocation);
  const saveJourney = useJourneyStore((s) => s.saveJourney);
  const unsaveJourney = useJourneyStore((s) => s.unsaveJourney);
  const isJourneySaved = useJourneyStore((s) => s.isJourneySaved);
  const setSelectedJourney = useJourneyStore((s) => s.setSelectedJourney);
  const activeJourney = useJourneyStore((s) => s.activeJourney);
  const setActiveJourney = useJourneyStore((s) => s.setActiveJourney);
  const recentJourneys = useJourneyStore((s) => s.recentJourneys);
  const savedJourneys = useJourneyStore((s) => s.savedJourneys);
  const favoriteStops = useFavoritesStore((s) => s.favoriteStops);

  const [pickingField, setPickingField] = useState<PickingField>(null);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [searching, setSearching] = useState(false);
  const [timeOffsetMin, setTimeOffsetMin] = useState(0); // for Earlier/Later navigation

  // Departure time state
  const [isNow, setIsNow] = useState(true);
  const [departureTime, setDepartureTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Active journey countdown
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    if (!activeJourney) return;
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, [activeJourney]);

  const handleSelect = useCallback(
    (location: Location) => {
      if (pickingField === 'from') setFrom(location);
      else if (pickingField === 'to') setTo(location);
      addRecentLocation(location);
      setPickingField(null);
      setJourneys([]);
    },
    [pickingField, setFrom, setTo, addRecentLocation]
  );

  const runSearch = useCallback(async (offsetMin: number) => {
    if (!fromLocation || !toLocation) return;
    setSearching(true);
    await new Promise((r) => setTimeout(r, 50));
    const base = isNow ? new Date() : departureTime;
    const shifted = new Date(base.getTime() + offsetMin * 60000);
    const results = generateJourneys(fromLocation, toLocation, shifted);
    results.forEach((j) => addRecentJourney(j));
    setJourneys(results);
    setSearching(false);
  }, [fromLocation, toLocation, addRecentJourney, isNow, departureTime]);

  const handleSearch = useCallback(async () => {
    setTimeOffsetMin(0);
    setJourneys([]);
    await runSearch(0);
  }, [runSearch]);

  const handleEarlier = useCallback(async () => {
    const next = timeOffsetMin - 30;
    setTimeOffsetMin(next);
    await runSearch(next);
  }, [timeOffsetMin, runSearch]);

  const handleLater = useCallback(async () => {
    const next = timeOffsetMin + 30;
    setTimeOffsetMin(next);
    await runSearch(next);
  }, [timeOffsetMin, runSearch]);

  const handleJourneyPress = useCallback((journey: Journey) => {
    setSelectedJourney(journey);
    router.push(`/trip/${journey.id}`);
  }, [setSelectedJourney, router]);

  const canSearch = !!(fromLocation && toLocation);

  return (
    <View style={styles.screen}>
      {/* ── BLUE HEADER ─────────────────────────────────────────────────── */}
      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.headerInner}>
          {/* App title */}
          <Text style={styles.appTitle}>Bondivideo</Text>

          {/* From/To card */}
          <View style={styles.planCard}>
            {/* FROM field */}
            <TouchableOpacity
              style={styles.planField}
              onPress={() => setPickingField('from')}
              activeOpacity={0.8}
            >
              <View style={[styles.planDot, { backgroundColor: Colors.primary }]} />
              <Text
                style={[
                  styles.planFieldText,
                  !fromLocation && styles.planFieldPlaceholder,
                ]}
                numberOfLines={1}
              >
                {fromLocation ? fromLocation.name : '¿Desde dónde?'}
              </Text>
            </TouchableOpacity>

            {/* Divider + swap button */}
            <View style={styles.planDividerRow}>
              <View style={styles.planDividerLine} />
              <TouchableOpacity
                style={styles.swapBtn}
                onPress={swapLocations}
                activeOpacity={0.8}
              >
                <Ionicons name="swap-vertical" size={18} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            {/* TO field */}
            <TouchableOpacity
              style={styles.planField}
              onPress={() => setPickingField('to')}
              activeOpacity={0.8}
            >
              <Ionicons name="location" size={16} color={Colors.error} />
              <Text
                style={[
                  styles.planFieldText,
                  !toLocation && styles.planFieldPlaceholder,
                ]}
                numberOfLines={1}
              >
                {toLocation ? toLocation.name : '¿A dónde vas?'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Departure time toggle */}
          <View style={styles.timeToggleRow}>
            <TouchableOpacity
              style={[styles.timeToggleBtn, isNow && styles.timeToggleBtnActive]}
              onPress={() => { setIsNow(true); setShowTimePicker(false); }}
            >
              <Ionicons name="time" size={14} color={isNow ? Colors.secondaryText : Colors.textSecondary} />
              <Text style={[styles.timeToggleText, isNow && styles.timeToggleTextActive]}>Ahora</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.timeToggleBtn, !isNow && styles.timeToggleBtnActive]}
              onPress={() => { setIsNow(false); setShowTimePicker(true); }}
            >
              <Ionicons name="calendar" size={14} color={!isNow ? Colors.secondaryText : Colors.textSecondary} />
              <Text style={[styles.timeToggleText, !isNow && styles.timeToggleTextActive]}>
                {!isNow ? formatTime(departureTime) : 'Más tarde'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* iOS inline time picker */}
          {showTimePicker && Platform.OS === 'ios' && (
            <View style={styles.timePickerWrap}>
              <DateTimePicker
                value={departureTime}
                mode="time"
                display="spinner"
                textColor={Colors.primary}
                onChange={(_, date) => { if (date) setDepartureTime(date); }}
                style={{ height: 120 }}
              />
              <TouchableOpacity onPress={() => setShowTimePicker(false)} style={styles.timePickerDone}>
                <Text style={styles.timePickerDoneText}>Listo</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Android time picker (modal) */}
          {showTimePicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={departureTime}
              mode="time"
              display="default"
              onChange={(_, date) => { setShowTimePicker(false); if (date) setDepartureTime(date); }}
            />
          )}

          {/* Search button */}
          <TouchableOpacity
            style={[styles.searchBtn, !canSearch && styles.searchBtnDisabled]}
            onPress={handleSearch}
            activeOpacity={0.85}
            disabled={!canSearch || searching}
          >
            {searching
              ? <ActivityIndicator size="small" color={Colors.secondaryText} />
              : <Ionicons name="search" size={18} color={canSearch ? Colors.secondaryText : Colors.textTertiary} />
            }
            <Text style={[styles.searchBtnText, !canSearch && styles.searchBtnTextDisabled]}>
              {searching ? 'Buscando...' : 'Buscar viaje'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── SCROLLABLE BODY ──────────────────────────────────────────────── */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Active journey widget ── */}
        {activeJourney && (() => {
          const dep = new Date(activeJourney.departureTime);
          const arr = new Date(activeJourney.arrivalTime);
          const minsUntilDep = Math.round((dep.getTime() - now.getTime()) / 60000);
          const firstWalk = activeJourney.legs.find((l) => l.type === 'walk');
          const firstBus = activeJourney.legs.find((l) => l.type === 'bus');
          const walkMins = firstWalk?.duration ?? 0;
          const leaveNow = minsUntilDep <= walkMins + 1;
          const urgentColor = minsUntilDep < 3 ? Colors.error : minsUntilDep < 8 ? Colors.warning : Colors.success;
          return (
            <TouchableOpacity
              style={styles.activeWidget}
              onPress={() => { setSelectedJourney(activeJourney); router.push(`/trip/${activeJourney.id}`); }}
              activeOpacity={0.9}
            >
              <View style={styles.activeWidgetTop}>
                <View style={styles.activeWidgetLeft}>
                  <Text style={styles.activeWidgetLabel}>Viaje activo</Text>
                  <Text style={styles.activeWidgetRoute} numberOfLines={1}>
                    {activeJourney.from.name.split(' ')[0]} → {activeJourney.to.name.split(' ')[0]}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setActiveJourney(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={22} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>

              <View style={styles.activeWidgetSteps}>
                {walkMins > 0 && (
                  <View style={styles.activeStep}>
                    <Ionicons name="walk" size={16} color={Colors.white} />
                    <Text style={styles.activeStepText}>{walkMins} min a pie</Text>
                  </View>
                )}
                {firstBus && (
                  <View style={styles.activeStep}>
                    <View style={[styles.activeBusBadge, { backgroundColor: firstBus.line?.color ?? Colors.primaryDark }]}>
                      <Text style={styles.activeBusBadgeText}>{firstBus.line?.shortName}</Text>
                    </View>
                    <Text style={styles.activeStepText}>{formatTime(new Date(firstBus.departureTime))}</Text>
                  </View>
                )}
                <View style={styles.activeStep}>
                  <Ionicons name="location" size={16} color={Colors.white} />
                  <Text style={styles.activeStepText}>{formatTime(arr)}</Text>
                </View>
              </View>

              <View style={[styles.activeWidgetCta, { backgroundColor: leaveNow ? Colors.error : urgentColor }]}>
                <Text style={styles.activeWidgetCtaText}>
                  {minsUntilDep <= 0 ? '¡Ya!' : leaveNow ? '¡Sal ahora!' : `Sale en ${minsUntilDep} min`}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })()}

        {/* NS-style journey results list */}
        {(journeys.length > 0 || searching) && (
          <View style={styles.nsResultsCard}>
            {/* Anteriores button */}
            <TouchableOpacity
              style={styles.nsNavBtn}
              onPress={handleEarlier}
              disabled={searching}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-up" size={16} color={Colors.primary} />
              <Text style={styles.nsNavBtnText}>Anteriores</Text>
            </TouchableOpacity>

            <View style={styles.nsResultsDivider} />

            {searching ? (
              <View style={styles.nsLoadingRow}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.nsLoadingText}>Buscando viajes...</Text>
              </View>
            ) : (
              journeys.map((j, idx) => (
                <React.Fragment key={j.id}>
                  <JourneyResultCard
                    journey={j}
                    onPress={() => handleJourneyPress(j)}
                    onSave={() => isJourneySaved(j.id) ? unsaveJourney(j.id) : saveJourney(j)}
                    saved={isJourneySaved(j.id)}
                    featured={idx === 0}
                  />
                  {idx < journeys.length - 1 && <View style={styles.nsResultsDivider} />}
                </React.Fragment>
              ))
            )}

            <View style={styles.nsResultsDivider} />

            {/* Siguientes button */}
            <TouchableOpacity
              style={styles.nsNavBtn}
              onPress={handleLater}
              disabled={searching}
              activeOpacity={0.7}
            >
              <Text style={styles.nsNavBtnText}>Siguientes</Text>
              <Ionicons name="chevron-down" size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Recent / saved journeys */}
        {journeys.length === 0 && (recentJourneys.length > 0 || savedJourneys.length > 0) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {savedJourneys.length > 0 ? 'Guardados y recientes' : 'Recientes'}
              </Text>
            </View>
            {[...savedJourneys.slice(0, 2), ...recentJourneys.filter(j => !savedJourneys.some(s => s.id === j.id)).slice(0, 3)].map((j) => (
              <JourneyResultCard
                key={j.id}
                journey={j}
                onPress={() => { setSelectedJourney(j); router.push(`/trip/${j.id}`); }}
                onSave={() => isJourneySaved(j.id) ? unsaveJourney(j.id) : saveJourney(j)}
                saved={isJourneySaved(j.id)}
              />
            ))}
          </View>
        )}

        {/* Favorite stops */}
        {favoriteStops.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Paradas favoritas</Text>
              <TouchableOpacity onPress={() => router.push('/favorites')}>
                <Text style={styles.seeAll}>Ver todas →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.favScroll}
            >
              {favoriteStops.map((stop) => (
                <FavoriteStopCard
                  key={stop.id}
                  stop={stop}
                  onPress={() => router.push(`/stop/${stop.id}`)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Quick access */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acceso rápido</Text>
          <View style={styles.quickGrid}>
            <QuickAccessCard
              icon="bus"
              label="Ver salidas"
              onPress={() => router.push('/departures')}
            />
            <QuickAccessCard
              icon="map"
              label="Mapa en vivo"
              onPress={() => router.push('/map')}
            />
            <QuickAccessCard
              icon="star"
              label="Favoritos"
              onPress={() => router.push('/favorites')}
            />
            <QuickAccessCard
              icon="menu"
              label="Mis líneas"
              onPress={() => router.push('/departures')}
            />
          </View>
        </View>

        {/* Info footer */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={18} color={Colors.primary} />
          <Text style={styles.infoText}>
            Horarios en tiempo real del STM — Sistema de Transporte Metropolitano de Montevideo
          </Text>
        </View>
      </ScrollView>

      {/* ── SEARCH MODAL ─────────────────────────────────────────────────── */}
      <LocationSearchModal
        visible={pickingField !== null}
        placeholder={
          pickingField === 'from' ? '¿Desde dónde?' : '¿A dónde vas?'
        }
        onSelect={handleSelect}
        onClose={() => setPickingField(null)}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.surface,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  headerSafe: {
    backgroundColor: Colors.primary,
  },
  headerInner: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Theme.spacing.base,
    paddingBottom: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  appTitle: {
    color: Colors.white,
    fontSize: Theme.fontSize.md,
    fontWeight: Theme.fontWeight.bold,
    marginTop: Theme.spacing.sm,
    letterSpacing: 0.3,
  },

  // From/To card
  planCard: {
    backgroundColor: Colors.white,
    borderRadius: Theme.radius.xl,
    overflow: 'hidden',
    ...Theme.shadow.md,
  },
  planField: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: 10,
    gap: Theme.spacing.sm,
    minHeight: 44,
  },
  planDot: {
    width: 10,
    height: 10,
    borderRadius: Theme.radius.full,
  },
  planFieldText: {
    flex: 1,
    fontSize: Theme.fontSize.base,
    color: Colors.textPrimary,
    fontWeight: Theme.fontWeight.medium,
  },
  planFieldPlaceholder: {
    color: Colors.textTertiary,
    fontWeight: Theme.fontWeight.regular,
  },
  planDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: Theme.spacing.sm,
  },
  planDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Theme.spacing.base + 10 + Theme.spacing.sm, // align after dot
  },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: Theme.radius.full,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Theme.spacing.sm,
  },

  // Departure time toggle
  timeToggleRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  timeToggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, borderRadius: Theme.radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  timeToggleBtnActive: {
    backgroundColor: Colors.secondary,
  },
  timeToggleText: {
    fontSize: Theme.fontSize.sm, fontWeight: '600', color: 'rgba(255,255,255,0.85)',
  },
  timeToggleTextActive: {
    color: Colors.secondaryText,
  },
  timePickerWrap: {
    backgroundColor: Colors.white, borderRadius: Theme.radius.xl,
    overflow: 'hidden', alignItems: 'center',
  },
  timePickerDone: {
    paddingVertical: 10, paddingHorizontal: 24,
    backgroundColor: Colors.secondary, borderRadius: Theme.radius.full,
    marginBottom: 10,
  },
  timePickerDoneText: { color: Colors.secondaryText, fontWeight: '700' },

  // Search button
  searchBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: Theme.radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.md,
    gap: Theme.spacing.sm,
    ...Theme.shadow.sm,
  },
  searchBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  searchBtnText: {
    color: Colors.secondaryText,
    fontSize: Theme.fontSize.base,
    fontWeight: Theme.fontWeight.bold,
  },
  searchBtnTextDisabled: {
    color: 'rgba(255,255,255,0.5)',
  },

  // ── Body ────────────────────────────────────────────────────────────────
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xxxl,
  },

  // ── Sections ────────────────────────────────────────────────────────────
  section: {
    marginBottom: Theme.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.base,
    marginBottom: Theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: Theme.fontSize.md,
    fontWeight: Theme.fontWeight.bold,
    color: Colors.textPrimary,
    paddingHorizontal: Theme.spacing.base,
    marginBottom: Theme.spacing.sm,
  },
  seeAll: {
    color: Colors.primary,
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.semibold,
  },

  // ── Favorite stop cards (horizontal) ────────────────────────────────────
  favScroll: {
    paddingHorizontal: Theme.spacing.base,
    gap: Theme.spacing.sm,
  },
  favCard: {
    backgroundColor: Colors.white,
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.base,
    width: 160,
    justifyContent: 'space-between',
    ...Theme.shadow.sm,
  },
  favCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.xs,
    marginBottom: Theme.spacing.sm,
  },
  favCardIcon: {
    width: 24,
    height: 24,
    borderRadius: Theme.radius.full,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  favCardName: {
    flex: 1,
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.semibold,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  favCardDeps: {
    gap: 4,
  },
  favCardDep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  favCardBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  favCardBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: Theme.fontWeight.bold,
  },
  favCardDepMin: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textSecondary,
  },
  favCardNoDep: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textTertiary,
  },

  // ── Quick access grid ────────────────────────────────────────────────────
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Theme.spacing.base,
    rowGap: QUICK_CARD_GAP,
    columnGap: QUICK_CARD_GAP,
  },
  quickCard: {
    width: QUICK_CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.base,
    alignItems: 'center',
    ...Theme.shadow.sm,
  },
  quickIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Theme.radius.md,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
  },
  quickLabel: {
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.semibold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },

  // ── Info card ────────────────────────────────────────────────────────────
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.primarySurface,
    borderRadius: Theme.radius.lg,
    marginHorizontal: Theme.spacing.base,
    marginTop: Theme.spacing.sm,
    padding: Theme.spacing.base,
    gap: Theme.spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: Theme.fontSize.xs,
    color: Colors.primary,
    lineHeight: 18,
    fontWeight: Theme.fontWeight.medium,
  },

  // ── Active journey widget ────────────────────────────────────────────────
  activeWidget: {
    backgroundColor: Colors.primary, marginHorizontal: Theme.spacing.base,
    marginBottom: Theme.spacing.base, borderRadius: Theme.radius.xl,
    padding: Theme.spacing.base, ...Theme.shadow.md,
  },
  activeWidgetTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: Theme.spacing.sm,
  },
  activeWidgetLeft: { flex: 1 },
  activeWidgetLabel: { fontSize: Theme.fontSize.xs, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  activeWidgetRoute: { fontSize: Theme.fontSize.md, fontWeight: '800', color: Colors.white, marginTop: 2 },
  activeWidgetSteps: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm, marginBottom: Theme.spacing.sm, flexWrap: 'wrap' },
  activeStep: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activeStepText: { color: 'rgba(255,255,255,0.9)', fontSize: Theme.fontSize.sm, fontWeight: '600' },
  activeBusBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  activeBusBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '800' },
  activeWidgetCta: {
    borderRadius: Theme.radius.full, paddingVertical: 8,
    alignItems: 'center', marginTop: 4,
  },
  activeWidgetCtaText: { color: Colors.white, fontWeight: '800', fontSize: Theme.fontSize.base },

  // ── Result section header ────────────────────────────────────────────────
  resultSectionHeader: {
    fontSize: Theme.fontSize.xs, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
    paddingHorizontal: Theme.spacing.base, paddingTop: Theme.spacing.base, paddingBottom: 4,
  },

  // ── NS-style journey results ─────────────────────────────────────────────
  nsResultsCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Theme.spacing.base,
    marginBottom: Theme.spacing.base,
    borderRadius: Theme.radius.xl,
    overflow: 'hidden',
    ...Theme.shadow.md,
  },
  nsNavBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
  },
  nsNavBtnText: {
    fontSize: Theme.fontSize.sm, fontWeight: '600', color: Colors.primary,
  },
  nsResultsDivider: { height: 1, backgroundColor: Colors.border },
  nsLoadingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 28,
  },
  nsLoadingText: { fontSize: Theme.fontSize.sm, color: Colors.textSecondary },
  nsJourneyRow: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
  },
  nsJourneyRowFeatured: {
    backgroundColor: Colors.primarySurface,
  },
  nsAccentBar: {
    width: 4, backgroundColor: Colors.primary,
  },
  nsJourneyContent: {
    flex: 1, paddingHorizontal: Theme.spacing.base, paddingVertical: 14, gap: 6,
  },
  nsTimesRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  nsTimes: {
    fontSize: 20, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3,
  },
  nsTimeDash: {
    fontSize: 18, fontWeight: '400', color: Colors.textSecondary,
  },
  nsStatsRow: {
    flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.base,
  },
  nsStat: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  nsStatText: {
    fontSize: Theme.fontSize.sm, color: Colors.textSecondary, fontWeight: '500',
  },
  nsBusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap',
  },
  nsBusBadge: {
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  nsBusBadgeText: {
    color: Colors.white, fontSize: Theme.fontSize.sm, fontWeight: '800',
  },
  nsBusHeadsign: {
    fontSize: Theme.fontSize.sm, color: Colors.textSecondary, flex: 1,
  },

  // ── Modal ────────────────────────────────────────────────────────────────
  modalSafe: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.base,
    paddingTop: Theme.spacing.base,
    paddingBottom: Theme.spacing.sm,
    gap: Theme.spacing.sm,
  },
  modalSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Theme.radius.full,
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: Theme.spacing.sm,
    gap: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalInput: {
    flex: 1,
    fontSize: Theme.fontSize.base,
    color: Colors.textPrimary,
    padding: 0,
  },
  modalCancel: {
    paddingVertical: Theme.spacing.sm,
    paddingLeft: Theme.spacing.xs,
  },
  modalCancelText: {
    color: Colors.primary,
    fontSize: Theme.fontSize.base,
    fontWeight: Theme.fontWeight.semibold,
  },
  modalDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: Theme.spacing.md,
    gap: Theme.spacing.base,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resultText: {
    flex: 1,
  },
  resultName: {
    fontSize: Theme.fontSize.base,
    fontWeight: Theme.fontWeight.medium,
    color: Colors.textPrimary,
  },
  resultSub: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  resultSeparator: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: Theme.spacing.base + 36 + Theme.spacing.base,
  },
});
