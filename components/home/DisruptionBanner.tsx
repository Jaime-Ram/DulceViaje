import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Theme } from '../../constants/theme';
import { Disruption } from '../../types/index';

interface DisruptionBannerProps {
  disruptions: Disruption[];
  onPress?: () => void;
}

type SeverityConfig = {
  backgroundColor: string;
  borderColor: string;
  iconColor: string;
  textColor: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const severityConfig: Record<Disruption['severity'], SeverityConfig> = {
  info: {
    backgroundColor: Colors.infoLight,
    borderColor: Colors.primary,
    iconColor: Colors.primary,
    textColor: Colors.primary,
    icon: 'information-circle',
  },
  warning: {
    backgroundColor: Colors.warningLight,
    borderColor: Colors.warning,
    iconColor: Colors.warning,
    textColor: '#92400E',
    icon: 'warning',
  },
  critical: {
    backgroundColor: Colors.errorLight,
    borderColor: Colors.error,
    iconColor: Colors.error,
    textColor: '#991B1B',
    icon: 'alert-circle',
  },
};

export const DisruptionBanner: React.FC<DisruptionBannerProps> = ({
  disruptions,
  onPress,
}) => {
  if (!disruptions || disruptions.length === 0) {
    return null;
  }

  const first = disruptions[0];
  const config = severityConfig[first.severity];
  const hasMore = disruptions.length > 1;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!onPress}
      style={[
        styles.container,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
        },
      ]}
    >
      <View style={styles.iconWrapper}>
        <Ionicons name={config.icon} size={18} color={config.iconColor} />
      </View>

      <View style={styles.textWrapper}>
        <Text style={[styles.title, { color: config.textColor }]} numberOfLines={2}>
          {first.title}
        </Text>
        {hasMore && (
          <Text style={[styles.moreText, { color: config.iconColor }]}>
            +{disruptions.length - 1} más
          </Text>
        )}
      </View>

      {onPress && (
        <Ionicons name="chevron-forward" size={16} color={config.iconColor} style={styles.chevron} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    paddingVertical: Theme.spacing.sm + 2,
    paddingHorizontal: Theme.spacing.md,
    marginHorizontal: Theme.spacing.base,
    marginVertical: Theme.spacing.sm,
  },
  iconWrapper: {
    marginRight: Theme.spacing.sm,
  },
  textWrapper: {
    flex: 1,
  },
  title: {
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.semibold,
    lineHeight: 18,
  },
  moreText: {
    fontSize: Theme.fontSize.xs,
    fontWeight: Theme.fontWeight.medium,
    marginTop: 2,
  },
  chevron: {
    marginLeft: Theme.spacing.sm,
  },
});

export default DisruptionBanner;
