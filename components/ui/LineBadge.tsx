import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Theme } from '../../constants/theme';

type LineBadgeSize = 'sm' | 'md' | 'lg';

interface LineBadgeProps {
  line: string;
  size?: LineBadgeSize;
}

const LINE_PALETTE = [
  '#0055B3',
  '#E53E3E',
  '#38A169',
  '#D69E2E',
  '#805AD5',
  '#DD6B20',
  '#00897B',
  '#C2185B',
];

function hashLine(line: string): number {
  let hash = 0;
  for (let i = 0; i < line.length; i++) {
    hash = (hash * 31 + line.charCodeAt(i)) >>> 0;
  }
  return hash % LINE_PALETTE.length;
}

function getLineColor(line: string): string {
  return LINE_PALETTE[hashLine(line)];
}

const sizeStyles: Record<LineBadgeSize, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: {
      minWidth: 28,
      height: 22,
      paddingHorizontal: Theme.spacing.xs,
      borderRadius: Theme.radius.xs,
    },
    text: {
      fontSize: Theme.fontSize.xs,
      fontWeight: Theme.fontWeight.bold,
    },
  },
  md: {
    container: {
      minWidth: 36,
      height: 28,
      paddingHorizontal: Theme.spacing.sm,
      borderRadius: Theme.radius.sm,
    },
    text: {
      fontSize: Theme.fontSize.sm,
      fontWeight: Theme.fontWeight.bold,
    },
  },
  lg: {
    container: {
      minWidth: 46,
      height: 36,
      paddingHorizontal: Theme.spacing.md,
      borderRadius: Theme.radius.sm,
    },
    text: {
      fontSize: Theme.fontSize.base,
      fontWeight: Theme.fontWeight.bold,
    },
  },
};

export const LineBadge: React.FC<LineBadgeProps> = ({ line, size = 'md' }) => {
  const color = getLineColor(line);
  const ss = sizeStyles[size];

  return (
    <View style={[styles.base, ss.container, { backgroundColor: color }]}>
      <Text style={[styles.text, ss.text]} numberOfLines={1}>
        {line}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  text: {
    color: '#FFFFFF',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});

export default LineBadge;
