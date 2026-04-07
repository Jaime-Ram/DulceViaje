import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Theme } from '../../constants/theme';
import { UpcomingBus } from '../../types/index';
import { LineBadge } from '../ui/LineBadge';

interface DepartureRowProps {
  departure: UpcomingBus;
}

function getEtaStyle(minutes: number): { label: string; color: string } {
  if (minutes < 2) {
    return { label: 'Nu', color: Colors.error };
  }
  if (minutes < 5) {
    return { label: `${minutes} min`, color: Colors.warning };
  }
  return { label: `${minutes} min`, color: Colors.primary };
}

export const DepartureRow: React.FC<DepartureRowProps> = ({ departure }) => {
  const eta = getEtaStyle(departure.etaMinutes);

  return (
    <View style={styles.row}>
      <LineBadge line={departure.lineName} size="md" />

      <View style={styles.destinationWrapper}>
        <Text style={styles.headsign} numberOfLines={1}>
          {departure.headsign}
        </Text>
        {!departure.isRealtime && (
          <Text style={styles.scheduledLabel}>Horario</Text>
        )}
      </View>

      <View style={styles.etaWrapper}>
        <Text style={[styles.etaText, { color: eta.color }]}>{eta.label}</Text>
        {departure.isRealtime && (
          <View style={styles.realtimeDot} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  destinationWrapper: {
    flex: 1,
    paddingHorizontal: Theme.spacing.md,
  },
  headsign: {
    fontSize: Theme.fontSize.base,
    fontWeight: Theme.fontWeight.medium,
    color: Colors.textPrimary,
  },
  scheduledLabel: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  etaWrapper: {
    alignItems: 'flex-end',
    minWidth: 52,
  },
  etaText: {
    fontSize: Theme.fontSize.base,
    fontWeight: Theme.fontWeight.bold,
    letterSpacing: -0.2,
  },
  realtimeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.success,
    marginTop: 3,
  },
});

export default DepartureRow;
