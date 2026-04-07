import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Theme } from '../../constants/theme';
import useDepartures from '../../hooks/useDepartures';
import { useFavoritesStore } from '../../store/useFavoritesStore';
import useStops from '../../hooks/useStops';
import { UpcomingBus } from '../../types';

function DepartureRow({ departure }: { departure: UpcomingBus }) {
  const min = departure.etaMinutes;
  const etaColor = min < 2 ? Colors.error : min < 5 ? Colors.warning : Colors.textPrimary;
  const etaText = min < 1 ? 'Ahora' : `${Math.round(min)} min`;

  return (
    <View style={styles.row}>
      <View style={styles.badgeWrap}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{departure.lineName}</Text>
        </View>
      </View>
      <Text style={styles.headsign} numberOfLines={2}>
        {departure.headsign}
      </Text>
      <View style={styles.etaBlock}>
        {departure.isRealtime && <View style={styles.dot} />}
        <Text style={[styles.eta, { color: etaColor }]}>{etaText}</Text>
      </View>
    </View>
  );
}

export default function StopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stopId = parseInt(id, 10);
  const navigation = useNavigation();
  const { stops } = useStops();
  const stop = stops.find((s) => s.id === stopId);
  const { departures, loading, error, refresh } = useDepartures(stopId, stop?.latitude, stop?.longitude);
  const { isFavoriteStop, addFavoriteStop, removeFavoriteStop } = useFavoritesStore();
  const isFav = isFavoriteStop(stopId);

  useEffect(() => {
    if (stop) {
      navigation.setOptions({ title: stop.name });
    }
  }, [stop, navigation]);

  const toggleFav = () => {
    if (!stop) return;
    if (isFav) {
      removeFavoriteStop(stopId);
    } else {
      addFavoriteStop({
        id: stop.id,
        name: stop.name,
        latitude: stop.latitude,
        longitude: stop.longitude,
      });
    }
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={toggleFav} style={{ marginRight: 8 }}>
          <Ionicons
            name={isFav ? 'star' : 'star-outline'}
            size={24}
            color={Colors.white}
          />
        </TouchableOpacity>
      ),
    });
  }, [isFav, stop]);

  return (
    <View style={styles.container}>
      {/* Stop header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="bus" size={20} color={Colors.primary} />
        </View>
        <View>
          <Text style={styles.headerName}>{stop?.name ?? `Parada #${stopId}`}</Text>
          <Text style={styles.headerId}>Parada #{stopId}</Text>
        </View>
      </View>

      {/* Departure board */}
      <View style={styles.boardHeader}>
        <Text style={styles.boardTitle}>Próximas salidas</Text>
        {!loading && (
          <View style={styles.liveTag}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>En vivo</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Cargando horarios...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.errorText}>No se pudieron cargar los horarios</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : departures.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="time-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>No hay próximas salidas</Text>
          <Text style={styles.emptySubText}>No hay buses programados para esta parada</Text>
        </View>
      ) : (
        <FlatList
          data={departures}
          keyExtractor={(d, i) => `${d.lineId}-${i}`}
          renderItem={({ item }) => <DepartureRow departure={item} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.primary} />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Theme.spacing.base,
    gap: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: Theme.radius.full,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: { fontSize: Theme.fontSize.md, fontWeight: '700', color: Colors.textPrimary },
  headerId: { fontSize: Theme.fontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  boardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  boardTitle: { fontSize: Theme.fontSize.sm, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  liveText: { fontSize: Theme.fontSize.xs, color: Colors.success, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  badgeWrap: { width: 60, alignItems: 'flex-start' },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 44,
    alignItems: 'center',
  },
  badgeText: { color: Colors.white, fontSize: Theme.fontSize.sm, fontWeight: '800' },
  headsign: { flex: 1, fontSize: Theme.fontSize.base, color: Colors.textPrimary },
  etaBlock: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 56, justifyContent: 'flex-end' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  eta: { fontSize: Theme.fontSize.md, fontWeight: '800', textAlign: 'right' },
  sep: { height: 1, backgroundColor: Colors.divider },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: Theme.fontSize.base },
  errorText: { fontSize: Theme.fontSize.md, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radius.full,
  },
  retryText: { color: Colors.white, fontWeight: '600' },
  emptyText: { fontSize: Theme.fontSize.md, fontWeight: '600', color: Colors.textPrimary },
  emptySubText: { fontSize: Theme.fontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
