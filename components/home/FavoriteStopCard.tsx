import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Theme } from '../../constants/theme';
import { FavoriteStop, UpcomingBus } from '../../types/index';
import { LineBadge } from '../ui/LineBadge';

interface FavoriteStopCardProps {
  stop: FavoriteStop;
  onPress: () => void;
  departures?: UpcomingBus[];
}

function formatEta(minutes: number): string {
  if (minutes < 2) return 'Nu';
  return `${minutes} min`;
}

function getEtaColor(minutes: number): string {
  if (minutes < 2) return Colors.error;
  if (minutes < 5) return Colors.warning;
  return Colors.primary;
}

export const FavoriteStopCard: React.FC<FavoriteStopCardProps> = ({
  stop,
  onPress,
  departures,
}) => {
  const displayName = stop.customName ?? stop.name;
  const nextDepartures = departures?.slice(0, 2) ?? [];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={styles.card}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.stopIconWrapper}>
          <Ionicons name="star" size={14} color={Colors.primary} />
        </View>
        <Text style={styles.stopName} numberOfLines={1}>
          {displayName}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </View>

      {/* Departures */}
      {nextDepartures.length > 0 ? (
        <View style={styles.departuresWrapper}>
          {nextDepartures.map((dep, index) => (
            <View
              key={`${dep.lineVariantId}-${index}`}
              style={[
                styles.departureItem,
                index < nextDepartures.length - 1 && styles.departureItemBorder,
              ]}
            >
              <LineBadge line={dep.lineName} size="sm" />
              <Text style={styles.departureHeadsign} numberOfLines={1}>
                {dep.headsign}
              </Text>
              <Text style={[styles.departureEta, { color: getEtaColor(dep.etaMinutes) }]}>
                {formatEta(dep.etaMinutes)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.noDeparturesWrapper}>
          <Text style={styles.noDeparturesText}>Sin salidas próximas</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  stopIconWrapper: {
    width: 26,
    height: 26,
    borderRadius: Theme.radius.xs + 2,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.sm,
  },
  stopName: {
    flex: 1,
    fontSize: Theme.fontSize.base,
    fontWeight: Theme.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  departuresWrapper: {
    paddingHorizontal: Theme.spacing.base,
  },
  departureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm + 2,
  },
  departureItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  departureHeadsign: {
    flex: 1,
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.medium,
    color: Colors.textSecondary,
    marginHorizontal: Theme.spacing.sm,
  },
  departureEta: {
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.bold,
    minWidth: 40,
    textAlign: 'right',
  },
  noDeparturesWrapper: {
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: Theme.spacing.md,
  },
  noDeparturesText: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
});

export default FavoriteStopCard;
