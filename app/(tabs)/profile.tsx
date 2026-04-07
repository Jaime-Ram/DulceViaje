import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, Linking, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Theme } from '../../constants/theme';
import { useJourneyStore } from '../../store/useJourneyStore';
import { useFavoritesStore } from '../../store/useFavoritesStore';
import { formatTime, formatDuration } from '../../utils/time';
import { Journey } from '../../types';

const APP_VERSION = '1.0.0';

// ── Walking speed preference stored in memory (simple, no extra store needed)
type WalkSpeed = 'slow' | 'normal' | 'fast';
const WALK_LABELS: Record<WalkSpeed, string> = { slow: 'Lento', normal: 'Normal', fast: 'Rápido' };

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title.toUpperCase()}</Text>;
}

function SettingRow({
  icon, label, value, onPress, danger,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[styles.settingIcon, danger && { backgroundColor: Colors.errorLight }]}>
        <Ionicons name={icon} size={18} color={danger ? Colors.error : Colors.primary} />
      </View>
      <Text style={[styles.settingLabel, danger && { color: Colors.error }]}>{label}</Text>
      {value ? <Text style={styles.settingValue}>{value}</Text> : null}
      {onPress && !danger && <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />}
    </TouchableOpacity>
  );
}

function ToggleRow({
  icon, label, value, onChange,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
      </View>
      <Text style={[styles.settingLabel, { flex: 1 }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.primaryLight }}
        thumbColor={value ? Colors.primary : Colors.white}
      />
    </View>
  );
}

function SavedJourneyRow({ journey, onPress, onUnsave }: {
  journey: Journey;
  onPress: () => void;
  onUnsave: () => void;
}) {
  const busLegs = journey.legs.filter((l) => l.type === 'bus');
  return (
    <TouchableOpacity style={styles.journeyRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.journeyTimes}>
        <Text style={styles.journeyTime}>{formatTime(new Date(journey.departureTime))}</Text>
        <Text style={styles.journeyArrow}>→</Text>
        <Text style={styles.journeyTime}>{formatTime(new Date(journey.arrivalTime))}</Text>
      </View>
      <View style={{ flex: 1, marginHorizontal: Theme.spacing.sm }}>
        <Text style={styles.journeyRoute} numberOfLines={1}>
          {journey.from.name} → {journey.to.name}
        </Text>
        <View style={styles.journeyBadges}>
          {busLegs.map((l, i) => (
            <View key={i} style={styles.lineBadge}>
              <Text style={styles.lineBadgeText}>{l.line?.shortName ?? '?'}</Text>
            </View>
          ))}
          <Text style={styles.journeyDur}>{formatDuration(journey.duration)}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={onUnsave} style={styles.unsaveBtn}>
        <Ionicons name="bookmark" size={20} color={Colors.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const savedJourneys = useJourneyStore((s) => s.savedJourneys);
  const unsaveJourney = useJourneyStore((s) => s.unsaveJourney);
  const setSelectedJourney = useJourneyStore((s) => s.setSelectedJourney);
  const favoriteStops = useFavoritesStore((s) => s.favoriteStops);

  const [userName, setUserName] = useState('Viajero');
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [notifications, setNotifications] = useState(true);
  const [walkSpeed, setWalkSpeed] = useState<WalkSpeed>('normal');
  const [accessibility, setAccessibility] = useState(false);

  const handleJourneyPress = (journey: Journey) => {
    setSelectedJourney(journey);
    router.push(`/trip/${journey.id}`);
  };

  const cycleWalkSpeed = () => {
    const order: WalkSpeed[] = ['slow', 'normal', 'fast'];
    const next = order[(order.indexOf(walkSpeed) + 1) % 3];
    setWalkSpeed(next);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + Theme.spacing.xl }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Profile header ── */}
      <View style={styles.profileHeader}>
        <TouchableOpacity
          style={styles.avatar}
          onPress={() => { setTempName(userName); setEditingName(true); }}
        >
          <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
          <View style={styles.avatarEdit}>
            <Ionicons name="pencil" size={10} color={Colors.white} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setTempName(userName); setEditingName(true); }}>
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.userSub}>Toca para editar</Text>
        </TouchableOpacity>
      </View>

      {/* ── Stats ── */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{savedJourneys.length}</Text>
          <Text style={styles.statLabel}>Viajes guardados</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{favoriteStops.length}</Text>
          <Text style={styles.statLabel}>Paradas favoritas</Text>
        </View>
      </View>

      {/* ── Saved journeys ── */}
      {savedJourneys.length > 0 && (
        <>
          <SectionHeader title="Viajes guardados" />
          <View style={styles.card}>
            {savedJourneys.map((j, i) => (
              <React.Fragment key={j.id}>
                <SavedJourneyRow
                  journey={j}
                  onPress={() => handleJourneyPress(j)}
                  onUnsave={() =>
                    Alert.alert('Eliminar viaje', '¿Eliminar este viaje guardado?', [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Eliminar', style: 'destructive', onPress: () => unsaveJourney(j.id) },
                    ])
                  }
                />
                {i < savedJourneys.length - 1 && <View style={styles.sep} />}
              </React.Fragment>
            ))}
          </View>
        </>
      )}

      {/* ── Preferences ── */}
      <SectionHeader title="Preferencias de viaje" />
      <View style={styles.card}>
        <SettingRow
          icon="walk"
          label="Velocidad al caminar"
          value={WALK_LABELS[walkSpeed]}
          onPress={cycleWalkSpeed}
        />
        <View style={styles.sep} />
        <ToggleRow
          icon="accessibility"
          label="Accesibilidad (silla de ruedas)"
          value={accessibility}
          onChange={setAccessibility}
        />
      </View>

      {/* ── Notifications ── */}
      <SectionHeader title="Notificaciones" />
      <View style={styles.card}>
        <ToggleRow
          icon="notifications"
          label="Avisos de servicio"
          value={notifications}
          onChange={setNotifications}
        />
      </View>

      {/* ── About ── */}
      <SectionHeader title="Acerca de" />
      <View style={styles.card}>
        <SettingRow icon="information-circle" label="Versión" value={APP_VERSION} />
        <View style={styles.sep} />
        <SettingRow
          icon="star"
          label="Valorar la app"
          onPress={() => Alert.alert('¡Gracias!', 'Pronto disponible en la App Store.')}
        />
        <View style={styles.sep} />
        <SettingRow
          icon="share-social"
          label="Compartir Dulce Viaje"
          onPress={() => Alert.alert('Compartir', 'Dulce Viaje — La mejor app de buses de Montevideo')}
        />
        <View style={styles.sep} />
        <SettingRow
          icon="document-text"
          label="Datos: STM Montevideo"
          value="GTFS"
          onPress={() => Linking.openURL('https://datos.gub.uy')}
        />
      </View>

      {/* ── Edit name modal ── */}
      <Modal visible={editingName} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Tu nombre</Text>
            <TextInput
              style={styles.modalInput}
              value={tempName}
              onChangeText={setTempName}
              autoFocus
              selectTextOnFocus
              placeholder="Tu nombre"
              placeholderTextColor={Colors.textTertiary}
              maxLength={30}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setEditingName(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSave}
                onPress={() => { setUserName(tempName.trim() || 'Viajero'); setEditingName(false); }}
              >
                <Text style={styles.modalSaveText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  profileHeader: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.xl,
    paddingTop: Theme.spacing.lg,
    gap: Theme.spacing.base,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: Colors.white },
  avatarEdit: {
    position: 'absolute', bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.white,
  },
  userName: { fontSize: Theme.fontSize.xl, fontWeight: '700', color: Colors.white },
  userSub: { fontSize: Theme.fontSize.xs, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  statsRow: {
    flexDirection: 'row', backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: Theme.spacing.base },
  statNum: { fontSize: Theme.fontSize.xxl, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: Theme.fontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 12 },
  sectionHeader: {
    fontSize: Theme.fontSize.xs, fontWeight: '700', color: Colors.textSecondary,
    letterSpacing: 0.8, paddingHorizontal: Theme.spacing.base,
    paddingTop: Theme.spacing.lg, paddingBottom: Theme.spacing.sm,
  },
  card: {
    backgroundColor: Colors.white, marginHorizontal: Theme.spacing.base,
    borderRadius: Theme.radius.xl, overflow: 'hidden', ...Theme.shadow.sm,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Theme.spacing.base, paddingVertical: 14, gap: Theme.spacing.md,
  },
  settingIcon: {
    width: 34, height: 34, borderRadius: Theme.radius.sm,
    backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center',
  },
  settingLabel: { flex: 1, fontSize: Theme.fontSize.base, color: Colors.textPrimary },
  settingValue: { fontSize: Theme.fontSize.sm, color: Colors.textSecondary, marginRight: 4 },
  sep: { height: 1, backgroundColor: Colors.divider, marginLeft: 62 },
  journeyRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Theme.spacing.base, paddingVertical: Theme.spacing.md,
  },
  journeyTimes: { alignItems: 'center', gap: 2, minWidth: 60 },
  journeyTime: { fontSize: Theme.fontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  journeyArrow: { fontSize: 10, color: Colors.textTertiary },
  journeyRoute: { fontSize: Theme.fontSize.sm, color: Colors.textSecondary },
  journeyBadges: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  lineBadge: {
    backgroundColor: Colors.primary, borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  lineBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  journeyDur: { fontSize: Theme.fontSize.xs, color: Colors.textSecondary },
  unsaveBtn: { padding: Theme.spacing.sm },
  modalOverlay: {
    flex: 1, backgroundColor: Colors.overlay,
    justifyContent: 'center', alignItems: 'center', padding: Theme.spacing.xl,
  },
  modalBox: {
    backgroundColor: Colors.white, borderRadius: Theme.radius.xl,
    padding: Theme.spacing.xl, width: '100%', ...Theme.shadow.lg,
  },
  modalTitle: { fontSize: Theme.fontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Theme.spacing.base },
  modalInput: {
    backgroundColor: Colors.surface, borderRadius: Theme.radius.md,
    padding: Theme.spacing.base, fontSize: Theme.fontSize.base, color: Colors.textPrimary,
    borderWidth: 1.5, borderColor: Colors.primary, marginBottom: Theme.spacing.base,
  },
  modalActions: { flexDirection: 'row', gap: Theme.spacing.sm },
  modalCancel: {
    flex: 1, padding: Theme.spacing.md, borderRadius: Theme.radius.full,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  modalCancelText: { color: Colors.textSecondary, fontWeight: '600' },
  modalSave: {
    flex: 1, padding: Theme.spacing.md, borderRadius: Theme.radius.full,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  modalSaveText: { color: Colors.white, fontWeight: '700' },
});
