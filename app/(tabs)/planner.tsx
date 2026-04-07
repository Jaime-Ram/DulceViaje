import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Theme } from '../../constants/theme';
import { useJourneyStore } from '../../store/useJourneyStore';
import useStops from '../../hooks/useStops';
import { Location, BusStop, Journey, JourneyLeg } from '../../types';
import { formatTime, formatDuration } from '../../utils/time';
import { formatDistance } from '../../utils/distance';

// Simple journey planner using GTFS data
// Real routing would need a trip planner backend (e.g. OpenTripPlanner)
// For now we show direct bus connections between stops

function LocationInput({
  value,
  placeholder,
  icon,
  onPress,
}: {
  value: string;
  placeholder: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.locationInput} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={18} color={Colors.primary} />
      <Text
        style={[styles.locationText, !value && styles.locationPlaceholder]}
        numberOfLines={1}
      >
        {value || placeholder}
      </Text>
      {value ? (
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      ) : null}
    </TouchableOpacity>
  );
}

function StopPicker({
  visible,
  onClose,
  onSelect,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (location: Location) => void;
  title: string;
}) {
  const [query, setQuery] = useState('');
  const { searchStops, loading } = useStops();
  const results = query.length >= 2 ? searchStops(query).slice(0, 30) : [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.pickerContainer}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.pickerTitle}>{title}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.pickerSearch}>
          <Ionicons name="search" size={18} color={Colors.textSecondary} />
          <TextInput
            style={styles.pickerInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar parada..."
            placeholderTextColor={Colors.textTertiary}
            autoFocus
          />
        </View>
        {loading && <ActivityIndicator color={Colors.primary} style={{ padding: 20 }} />}
        <FlatList
          data={results}
          keyExtractor={(s) => String(s.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.pickerItem}
              onPress={() => {
                onSelect({
                  name: item.name,
                  latitude: item.latitude,
                  longitude: item.longitude,
                  stopId: item.id,
                });
                onClose();
                setQuery('');
              }}
              activeOpacity={0.7}
            >
              <View style={styles.pickerStopIcon}>
                <Ionicons name="bus" size={14} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.pickerItemName}>{item.name}</Text>
                <Text style={styles.pickerItemId}>Parada #{item.id}</Text>
              </View>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            query.length >= 2 ? (
              <Text style={styles.noResults}>No se encontraron paradas</Text>
            ) : (
              <Text style={styles.hint}>Escribe al menos 2 letras para buscar</Text>
            )
          }
        />
      </View>
    </Modal>
  );
}

function JourneyCard({ journey, onPress }: { journey: Journey; onPress: () => void }) {
  const busDep = journey.departureTime;
  const busArr = journey.arrivalTime;
  const busDuration = journey.duration;
  const transfers = journey.transfers;

  return (
    <TouchableOpacity style={styles.journeyCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.journeyTimes}>
        <Text style={styles.journeyTime}>{formatTime(busDep)}</Text>
        <View style={styles.journeyDurationLine}>
          <View style={styles.durationDot} />
          <View style={styles.durationBar} />
          <View style={styles.durationDot} />
        </View>
        <Text style={styles.journeyTime}>{formatTime(busArr)}</Text>
      </View>
      <View style={styles.journeyInfo}>
        <Text style={styles.journeyDuration}>{formatDuration(busDuration)}</Text>
        <Text style={styles.journeyTransfers}>
          {transfers === 0 ? 'Sin transbordos' : `${transfers} transbordo${transfers > 1 ? 's' : ''}`}
        </Text>
        <View style={styles.journeyLegs}>
          {journey.legs.filter((l) => l.type === 'bus').map((leg, i) => (
            <View key={i} style={styles.legBadge}>
              <Text style={styles.legBadgeText}>{leg.line?.shortName ?? '?'}</Text>
            </View>
          ))}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

export default function PlannerScreen() {
  const { fromLocation, toLocation, setFrom, setTo, swapLocations } = useJourneyStore();
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [searched, setSearched] = useState(false);
  const router = useRouter();

  const canSearch = fromLocation && toLocation;

  const handleSearch = async () => {
    if (!canSearch) return;
    setLoading(true);
    setSearched(true);
    // Simulate journey results (real implementation needs OpenTripPlanner or similar)
    await new Promise((r) => setTimeout(r, 1200));
    const now = new Date();
    const mockJourneys: Journey[] = [
      {
        id: '1',
        from: fromLocation,
        to: toLocation,
        departureTime: new Date(now.getTime() + 5 * 60000),
        arrivalTime: new Date(now.getTime() + 35 * 60000),
        duration: 30,
        transfers: 0,
        legs: [
          {
            type: 'walk',
            from: fromLocation,
            to: fromLocation,
            departureTime: now,
            arrivalTime: new Date(now.getTime() + 5 * 60000),
            duration: 5,
            distance: 300,
          },
          {
            type: 'bus',
            from: fromLocation,
            to: toLocation,
            departureTime: new Date(now.getTime() + 5 * 60000),
            arrivalTime: new Date(now.getTime() + 30 * 60000),
            duration: 25,
            line: { id: '101', name: 'Línea 101', shortName: '101' },
            headsign: toLocation.name,
          },
        ],
      },
      {
        id: '2',
        from: fromLocation,
        to: toLocation,
        departureTime: new Date(now.getTime() + 12 * 60000),
        arrivalTime: new Date(now.getTime() + 50 * 60000),
        duration: 38,
        transfers: 1,
        legs: [
          {
            type: 'bus',
            from: fromLocation,
            to: fromLocation,
            departureTime: new Date(now.getTime() + 12 * 60000),
            arrivalTime: new Date(now.getTime() + 30 * 60000),
            duration: 18,
            line: { id: '64', name: 'Línea 64', shortName: '64' },
            headsign: 'Centro',
          },
          {
            type: 'bus',
            from: fromLocation,
            to: toLocation,
            departureTime: new Date(now.getTime() + 35 * 60000),
            arrivalTime: new Date(now.getTime() + 50 * 60000),
            duration: 15,
            line: { id: '186', name: 'Línea 186', shortName: '186' },
            headsign: toLocation.name,
          },
        ],
      },
    ];
    setJourneys(mockJourneys);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      {/* Route input */}
      <View style={styles.inputCard}>
        <View style={styles.inputsWrap}>
          <View style={styles.routeLine}>
            <View style={styles.routeDotFrom} />
            <View style={styles.routeLineBar} />
            <View style={styles.routeDotTo} />
          </View>
          <View style={styles.inputs}>
            <LocationInput
              value={fromLocation?.name ?? ''}
              placeholder="Origen"
              icon="ellipse-outline"
              onPress={() => setShowFromPicker(true)}
            />
            <View style={styles.inputDivider} />
            <LocationInput
              value={toLocation?.name ?? ''}
              placeholder="Destino"
              icon="location"
              onPress={() => setShowToPicker(true)}
            />
          </View>
          <TouchableOpacity style={styles.swapBtn} onPress={swapLocations}>
            <Ionicons name="swap-vertical" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.searchBtn, !canSearch && styles.searchBtnDisabled]}
          onPress={handleSearch}
          disabled={!canSearch}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="search" size={18} color={Colors.white} />
              <Text style={styles.searchBtnText}>Buscar viaje</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Results */}
      <ScrollView style={styles.results} contentContainerStyle={{ paddingBottom: 40 }}>
        {searched && !loading && journeys.length > 0 && (
          <>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>
                {fromLocation?.name} → {toLocation?.name}
              </Text>
            </View>
            {journeys.map((j) => (
              <JourneyCard key={j.id} journey={j} onPress={() => {}} />
            ))}
            <View style={styles.mockNote}>
              <Ionicons name="information-circle-outline" size={14} color={Colors.textTertiary} />
              <Text style={styles.mockNoteText}>
                Planificador completo disponible al integrar OpenTripPlanner
              </Text>
            </View>
          </>
        )}

        {!searched && !fromLocation && !toLocation && (
          <View style={styles.emptyState}>
            <Ionicons name="navigate-outline" size={64} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>Planifica tu viaje</Text>
            <Text style={styles.emptySubtitle}>
              Selecciona origen y destino para ver las opciones de viaje en bus
            </Text>
          </View>
        )}
      </ScrollView>

      <StopPicker
        visible={showFromPicker}
        onClose={() => setShowFromPicker(false)}
        onSelect={setFrom}
        title="Seleccionar origen"
      />
      <StopPicker
        visible={showToPicker}
        onClose={() => setShowToPicker(false)}
        onSelect={setTo}
        title="Seleccionar destino"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  inputCard: {
    backgroundColor: Colors.white,
    padding: Theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Theme.shadow.sm,
  },
  inputsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  routeLine: { alignItems: 'center', paddingVertical: 8, width: 20 },
  routeDotFrom: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.white,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  routeLineBar: { width: 2, flex: 1, backgroundColor: Colors.border, marginVertical: 4 },
  routeDotTo: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.error,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  inputs: { flex: 1 },
  locationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.sm,
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: Theme.radius.md,
  },
  locationText: { flex: 1, fontSize: Theme.fontSize.base, color: Colors.textPrimary, fontWeight: '500' },
  locationPlaceholder: { color: Colors.textTertiary, fontWeight: '400' },
  inputDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 2, marginLeft: 30 },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: Theme.radius.full,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Theme.radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  searchBtnDisabled: { backgroundColor: Colors.textTertiary },
  searchBtnText: { color: Colors.white, fontWeight: '700', fontSize: Theme.fontSize.base },
  results: { flex: 1 },
  resultsHeader: {
    padding: Theme.spacing.base,
    paddingBottom: Theme.spacing.sm,
  },
  resultsTitle: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  journeyCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Theme.spacing.base,
    marginBottom: Theme.spacing.sm,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    ...Theme.shadow.sm,
  },
  journeyTimes: { alignItems: 'center', gap: 4 },
  journeyTime: { fontSize: Theme.fontSize.md, fontWeight: '700', color: Colors.textPrimary },
  journeyDurationLine: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  durationDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  durationBar: { width: 24, height: 1, backgroundColor: Colors.border },
  journeyInfo: { flex: 1 },
  journeyDuration: { fontSize: Theme.fontSize.md, fontWeight: '700', color: Colors.primary },
  journeyTransfers: { fontSize: Theme.fontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  journeyLegs: { flexDirection: 'row', gap: 4, marginTop: 6, flexWrap: 'wrap' },
  legBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  legBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 60 },
  emptyTitle: { fontSize: Theme.fontSize.xl, fontWeight: '700', color: Colors.textPrimary, marginTop: 16 },
  emptySubtitle: { fontSize: Theme.fontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  mockNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: Theme.spacing.base,
    paddingTop: Theme.spacing.sm,
  },
  mockNoteText: { fontSize: Theme.fontSize.xs, color: Colors.textTertiary, flex: 1 },
  pickerContainer: { flex: 1, backgroundColor: Colors.white },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerTitle: { fontSize: Theme.fontSize.md, fontWeight: '700', color: Colors.textPrimary },
  pickerSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Theme.spacing.base,
    backgroundColor: Colors.surface,
    borderRadius: Theme.radius.full,
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: Theme.spacing.sm,
    gap: 8,
  },
  pickerInput: { flex: 1, fontSize: Theme.fontSize.base, color: Colors.textPrimary },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.base,
    gap: Theme.spacing.sm,
  },
  pickerStopIcon: {
    width: 32,
    height: 32,
    borderRadius: Theme.radius.full,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItemName: { fontSize: Theme.fontSize.base, color: Colors.textPrimary, fontWeight: '500' },
  pickerItemId: { fontSize: Theme.fontSize.xs, color: Colors.textSecondary },
  sep: { height: 1, backgroundColor: Colors.divider },
  noResults: { textAlign: 'center', color: Colors.textSecondary, padding: 20 },
  hint: { textAlign: 'center', color: Colors.textTertiary, padding: 20, fontSize: Theme.fontSize.sm },
});
