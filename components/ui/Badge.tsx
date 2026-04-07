import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors } from '../../constants/colors';
import { Theme } from '../../constants/theme';

type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  color?: string;
  textColor?: string;
  size?: BadgeSize;
}

const sizeStyles: Record<BadgeSize, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: {
      paddingHorizontal: Theme.spacing.sm,
      paddingVertical: 2,
    },
    text: {
      fontSize: Theme.fontSize.xs,
      fontWeight: Theme.fontWeight.bold,
    },
  },
  md: {
    container: {
      paddingHorizontal: Theme.spacing.md,
      paddingVertical: Theme.spacing.xs,
    },
    text: {
      fontSize: Theme.fontSize.sm,
      fontWeight: Theme.fontWeight.bold,
    },
  },
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  color = Colors.primary,
  textColor = Colors.textOnPrimary,
  size = 'md',
}) => {
  const ss = sizeStyles[size];

  return (
    <View style={[styles.container, ss.container, { backgroundColor: color }]}>
      <Text style={[styles.text, ss.text, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: Theme.radius.full,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    letterSpacing: 0.3,
  },
});

export default Badge;
