import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Theme } from '../../constants/theme';
import { useFavoritesStore } from '../../store/useFavoritesStore';
import { FavoriteStop } from '../../types';

function FavoriteStopItem({ stop, onPress, onEdit, onDelete }: {
  stop: FavoriteStop;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.itemIcon}>
        <Ionicons name="bus" size={18} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemName}>{stop.customName ?? stop.name}</Text>
        {stop.customName && (
          <Text style={styles.itemSub}>{stop.name}</Text>
        )}
      </View>
      <TouchableOpacity onPress={onEdit} style={styles.itemAction}>
        <Ionicons name="pencil-outline" size={18} color={Colors.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} style={styles.itemAction}>
        <Ionicons name="trash-outline" size={18} color={Colors.error} />
      </TouchableOpacity>
      <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

function EditNameModal({
  visible,
  stop,
  onSave,
  onClose,
}: {
  visible: boolean;
  stop: FavoriteStop | null;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(stop?.customName ?? stop?.name ?? '');

  React.useEffect(() => {
    setName(stop?.customName ?? stop?.name ?? '');
  }, [stop]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Renombrar parada</Text>
          <TextInput
            style={styles.modalInput}
            value={name}
            onChangeText={setName}
            placeholder={stop?.name}
            placeholderTextColor={Colors.textTertiary}
            autoFocus
            selectTextOnFocus
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSave}
              onPress={() => { onSave(name); onClose(); }}
            >
              <Text style={styles.modalSaveText}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function FavoritesScreen() {
  const router = useRouter();
  const { favoriteStops, favoriteRoutes, removeFavoriteStop, updateFavoriteStopName } = useFavoritesStore();
  const [editingStop, setEditingStop] = useState<FavoriteStop | null>(null);

  const handleDelete = (stop: FavoriteStop) => {
    Alert.alert(
      'Eliminar favorito',
      `¿Eliminar "${stop.customName ?? stop.name}" de favoritos?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => removeFavoriteStop(stop.id) },
      ]
    );
  };

  const sections = [
    { title: 'Paradas favoritas', data: favoriteStops },
  ];

  if (favoriteStops.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="star-outline" size={72} color={Colors.textTertiary} />
        <Text style={styles.emptyTitle}>Sin favoritos</Text>
        <Text style={styles.emptySub}>
          Guarda tus paradas habituales para acceder rápidamente a sus horarios
        </Text>
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => router.push('/departures')}
        >
          <Ionicons name="search" size={16} color={Colors.white} />
          <Text style={styles.emptyBtnText}>Buscar paradas</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <FavoriteStopItem
            stop={item}
            onPress={() => router.push(`/stop/${item.id}`)}
            onEdit={() => setEditingStop(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        stickySectionHeadersEnabled={false}
      />
      <EditNameModal
        visible={!!editingStop}
        stop={editingStop}
        onSave={(name) => {
          if (editingStop) updateFavoriteStopName(editingStop.id, name);
        }}
        onClose={() => setEditingStop(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: Theme.spacing.sm,
    paddingTop: Theme.spacing.lg,
  },
  sectionTitle: { fontSize: Theme.fontSize.sm, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCount: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textTertiary,
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Theme.radius.full,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Theme.spacing.base,
    paddingVertical: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: Theme.radius.full,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: { fontSize: Theme.fontSize.base, fontWeight: '600', color: Colors.textPrimary },
  itemSub: { fontSize: Theme.fontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  itemAction: { padding: Theme.spacing.sm },
  sep: { height: 1, backgroundColor: Colors.divider, marginLeft: 68 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Theme.spacing.xxxl, gap: Theme.spacing.md },
  emptyTitle: { fontSize: Theme.fontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  emptySub: { fontSize: Theme.fontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.full,
    marginTop: Theme.spacing.sm,
  },
  emptyBtnText: { color: Colors.white, fontWeight: '700', fontSize: Theme.fontSize.base },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
  },
  modalBox: {
    backgroundColor: Colors.white,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.xl,
    width: '100%',
    ...Theme.shadow.lg,
  },
  modalTitle: { fontSize: Theme.fontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Theme.spacing.base },
  modalInput: {
    backgroundColor: Colors.surface,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.base,
    fontSize: Theme.fontSize.base,
    color: Colors.textPrimary,
    marginBottom: Theme.spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalActions: { flexDirection: 'row', gap: Theme.spacing.sm },
  modalCancel: {
    flex: 1,
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: { color: Colors.textSecondary, fontWeight: '600' },
  modalSave: {
    flex: 1,
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  modalSaveText: { color: Colors.white, fontWeight: '700' },
});
