import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { Theme } from '../constants/theme';
import useStops from '../hooks/useStops';
import { BusStop } from '../types';

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { searchStops, loading } = useStops();

  const results: BusStop[] = query.length >= 2 ? searchStops(query).slice(0, 40) : [];

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar parada o línea..."
          placeholderTextColor={Colors.textTertiary}
          autoFocus
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {loading && <ActivityIndicator size="small" color={Colors.primary} />}
      </View>

      {query.length < 2 && (
        <View style={styles.hint}>
          <Ionicons name="search-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.hintText}>Escribe el nombre de la parada</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(s) => String(s.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.result}
            onPress={() => {
              router.back();
              router.push(`/stop/${item.id}`);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.resultIcon}>
              <Ionicons name="bus" size={16} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultName}>{item.name}</Text>
              <Text style={styles.resultId}>Parada #{item.id}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          query.length >= 2 ? (
            <Text style={styles.noResults}>No se encontraron paradas para "{query}"</Text>
          ) : null
        }
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    margin: Theme.spacing.base,
    borderRadius: Theme.radius.full,
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: Theme.spacing.sm,
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  input: {
    flex: 1,
    fontSize: Theme.fontSize.base,
    color: Colors.textPrimary,
    paddingVertical: 4,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: Theme.radius.full,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultName: { fontSize: Theme.fontSize.base, color: Colors.textPrimary, fontWeight: '500' },
  resultId: { fontSize: Theme.fontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  sep: { height: 1, backgroundColor: Colors.divider },
  hint: { alignItems: 'center', marginTop: 60, gap: 12 },
  hintText: { fontSize: Theme.fontSize.base, color: Colors.textTertiary },
  noResults: {
    textAlign: 'center',
    color: Colors.textSecondary,
    padding: Theme.spacing.xl,
    fontSize: Theme.fontSize.base,
  },
});
