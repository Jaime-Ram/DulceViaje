import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ExpoLocation from 'expo-location';
import { Colors } from '../constants/colors';
import { Theme } from '../constants/theme';

const { width: W } = Dimensions.get('window');

// ── Slide definitions ─────────────────────────────────────────────────────────
interface Slide {
  key: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
  skipLabel?: string;
  nextLabel: string;
}

const SLIDES: Slide[] = [
  {
    key: 'welcome',
    icon: 'bus',
    iconColor: Colors.white,
    iconBg: Colors.primary,
    title: 'Bienvenido a\nDulce Viaje',
    body: 'Tu compañero de transporte en Montevideo. Horarios en tiempo real, planificación de rutas y mucho más — gratis, sin cuenta.',
    nextLabel: 'Comenzar',
  },
  {
    key: 'privacy',
    icon: 'shield-checkmark',
    iconColor: '#38A169',
    iconBg: '#F0FFF4',
    title: 'Tu privacidad,\nnuestra prioridad',
    body: 'No creamos cuentas, no vendemos tus datos y no guardamos tu historial en servidores. Todo queda en tu dispositivo.\n\nUsamos datos abiertos del STM — Sistema de Transporte Metropolitano de Montevideo.',
    nextLabel: 'Entendido',
  },
  {
    key: 'location',
    icon: 'location',
    iconColor: Colors.primary,
    iconBg: '#EBF4FF',
    title: 'Planifica desde\ntu ubicación',
    body: 'Comparte tu ubicación para planificar de puerta a puerta, ver paradas cercanas y obtener información en tiempo real.',
    skipLabel: 'Ahora no',
    nextLabel: 'Continuar',
  },
];

// ── Dot indicator ─────────────────────────────────────────────────────────────
function Dots({ current }: { current: number }) {
  return (
    <View style={styles.dots}>
      {SLIDES.map((s, i) => (
        <View
          key={s.key}
          style={[styles.dot, i === current && styles.dotActive]}
        />
      ))}
    </View>
  );
}

// ── Single slide ──────────────────────────────────────────────────────────────
function SlideView({ slide }: { slide: Slide }) {
  return (
    <View style={styles.slide}>
      <View style={[styles.iconWrap, { backgroundColor: slide.iconBg }]}>
        <Ionicons name={slide.icon} size={72} color={slide.iconColor} />
      </View>
      <Text style={styles.title}>{slide.title}</Text>
      <Text style={styles.body}>{slide.body}</Text>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface OnboardingProps {
  onDone: () => void;
}

export default function Onboarding({ onDone }: OnboardingProps) {
  const [current, setCurrent] = useState(0);
  const listRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index != null) {
        setCurrent(viewableItems[0].index);
      }
    }
  ).current;

  const goNext = async () => {
    const isLast = current === SLIDES.length - 1;
    if (isLast) {
      // Request location permission then finish
      await ExpoLocation.requestForegroundPermissionsAsync().catch(() => {});
      onDone();
    } else {
      listRef.current?.scrollToIndex({ index: current + 1, animated: true });
    }
  };

  const skip = () => onDone();

  const slide = SLIDES[current];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* App name top bar */}
      <View style={styles.topBar}>
        <Text style={styles.appName}>Dulce Viaje</Text>
      </View>

      {/* Slides */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        renderItem={({ item }) => <SlideView slide={item} />}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        style={styles.list}
      />

      {/* Bottom controls */}
      <View style={styles.bottom}>
        <Dots current={current} />

        {slide.skipLabel ? (
          <TouchableOpacity style={styles.skipBtn} onPress={skip} activeOpacity={0.7}>
            <Text style={styles.skipText}>{slide.skipLabel}</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.85}>
          <Text style={styles.nextText}>{slide.nextLabel}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EBF4FF',
  },
  topBar: {
    alignItems: 'center',
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.sm,
  },
  appName: {
    fontSize: Theme.fontSize.lg,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  list: {
    flex: 1,
  },
  slide: {
    width: W,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.xl,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.xl,
  },
  iconWrap: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.base,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.primary,
    textAlign: 'center',
    lineHeight: 36,
  },
  body: {
    fontSize: Theme.fontSize.base,
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 24,
  },
  bottom: {
    paddingHorizontal: Theme.spacing.xl,
    paddingBottom: Theme.spacing.lg,
    gap: Theme.spacing.md,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Theme.spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#BEE3F8',
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 24,
  },
  skipBtn: {
    paddingVertical: Theme.spacing.sm,
  },
  skipText: {
    color: Colors.primary,
    fontSize: Theme.fontSize.base,
    fontWeight: '600',
  },
  nextBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Theme.radius.full,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextText: {
    color: Colors.white,
    fontSize: Theme.fontSize.md,
    fontWeight: '700',
  },
});
