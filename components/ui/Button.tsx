import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Theme } from '../../constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, { container: ViewStyle; label: TextStyle; loaderColor: string }> = {
  primary: {
    container: {
      backgroundColor: Colors.primary,
      borderWidth: 0,
    },
    label: { color: Colors.textOnPrimary },
    loaderColor: Colors.textOnPrimary,
  },
  secondary: {
    container: {
      backgroundColor: Colors.background,
      borderWidth: 1.5,
      borderColor: Colors.primary,
    },
    label: { color: Colors.primary },
    loaderColor: Colors.primary,
  },
  ghost: {
    container: {
      backgroundColor: Colors.transparent,
      borderWidth: 0,
    },
    label: { color: Colors.primary },
    loaderColor: Colors.primary,
  },
  danger: {
    container: {
      backgroundColor: Colors.error,
      borderWidth: 0,
    },
    label: { color: Colors.textOnPrimary },
    loaderColor: Colors.textOnPrimary,
  },
};

const sizeStyles: Record<Size, { container: ViewStyle; label: TextStyle; iconSize: number }> = {
  sm: {
    container: { paddingVertical: Theme.spacing.xs, paddingHorizontal: Theme.spacing.md },
    label: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
    iconSize: 14,
  },
  md: {
    container: { paddingVertical: Theme.spacing.sm + 2, paddingHorizontal: Theme.spacing.base },
    label: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.semibold },
    iconSize: 16,
  },
  lg: {
    container: { paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.xl },
    label: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.bold },
    iconSize: 18,
  },
};

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
}) => {
  const animValue = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(animValue, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(animValue, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  const isDisabled = disabled || loading;
  const vs = variantStyles[variant];
  const ss = sizeStyles[size];

  return (
    <Animated.View style={{ transform: [{ scale: animValue }], alignSelf: fullWidth ? 'stretch' : 'auto' }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={0.85}
        style={[
          styles.base,
          vs.container,
          ss.container,
          fullWidth && styles.fullWidth,
          isDisabled && styles.disabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={vs.loaderColor} />
        ) : (
          <View style={styles.content}>
            {icon && (
              <Ionicons
                name={icon}
                size={ss.iconSize}
                color={(vs.label as { color: string }).color}
                style={styles.icon}
              />
            )}
            <Text style={[styles.label, vs.label, ss.label]}>{label}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Theme.radius.full,
    minWidth: 64,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.45,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: Theme.spacing.xs,
  },
  label: {
    letterSpacing: 0.2,
  },
});

export default Button;
