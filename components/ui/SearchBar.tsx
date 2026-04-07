import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Theme } from '../../constants/theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  onFocus?: () => void;
  onClear?: () => void;
  autoFocus?: boolean;
  editable?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Buscar parada o línea…',
  onSubmit,
  onFocus,
  onClear,
  autoFocus = false,
  editable = true,
}) => {
  const [focused, setFocused] = useState(false);
  const bgAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setFocused(true);
    Animated.timing(bgAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: false,
    }).start();
    onFocus?.();
  };

  const handleBlur = () => {
    setFocused(false);
    Animated.timing(bgAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };

  const handleClear = () => {
    onChangeText('');
    onClear?.();
  };

  const backgroundColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.surface, Colors.primarySurface],
  });

  const borderColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.border, Colors.primary],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor, borderColor },
        focused && styles.focusedShadow,
      ]}
    >
      <Ionicons
        name="search"
        size={18}
        color={focused ? Colors.primary : Colors.textSecondary}
        style={styles.searchIcon}
      />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onSubmitEditing={onSubmit}
        autoFocus={autoFocus}
        editable={editable}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="never"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <View style={styles.clearButton}>
            <Ionicons name="close" size={12} color={Colors.textOnPrimary} />
          </View>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Theme.radius.full,
    borderWidth: 1.5,
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: Platform.OS === 'ios' ? Theme.spacing.sm + 2 : Theme.spacing.xs,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },
  focusedShadow: {
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 5,
  },
  searchIcon: {
    marginRight: Theme.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: Theme.fontSize.base,
    color: Colors.textPrimary,
    fontWeight: Theme.fontWeight.regular,
    padding: 0,
    margin: 0,
  },
  clearButton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Theme.spacing.xs,
  },
});

export default SearchBar;
