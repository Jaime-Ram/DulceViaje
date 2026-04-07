import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View } from 'react-native';
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { Colors } from '../constants/colors';
import Onboarding from '../components/Onboarding';

const ONBOARDING_KEY = 'bondivideo_onboarding_done';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      setShowOnboarding(val !== 'true');
      setReady(true);
    });
  }, []);

  const finishOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
  };

  // Show blank blue screen while loading (never hangs on null)
  if (!ready || !fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: Colors.primary }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={showOnboarding ? 'dark' : 'light'} backgroundColor={showOnboarding ? '#EBF4FF' : Colors.primary} />

        {showOnboarding ? (
          <Onboarding onDone={finishOnboarding} />
        ) : (
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="stop/[id]"
              options={{
                headerStyle: { backgroundColor: Colors.primary },
                headerTintColor: Colors.white,
                headerTitleStyle: { fontWeight: '700', fontFamily: 'Nunito_700Bold' },
                headerBackTitle: '',
                presentation: 'card',
              }}
            />
            <Stack.Screen
              name="search"
              options={{
                headerStyle: { backgroundColor: Colors.primary },
                headerTintColor: Colors.white,
                headerTitleStyle: { fontWeight: '700', fontFamily: 'Nunito_700Bold' },
                headerBackTitle: '',
                presentation: 'modal',
                title: 'Buscar parada',
              }}
            />
            <Stack.Screen
              name="line/[lineName]"
              options={{
                headerStyle: { backgroundColor: Colors.primary },
                headerTintColor: Colors.white,
                headerTitleStyle: { fontWeight: '700', fontFamily: 'Nunito_700Bold' },
                headerBackTitle: '',
                presentation: 'card',
              }}
            />
            <Stack.Screen
              name="trip/[id]"
              options={{
                headerStyle: { backgroundColor: Colors.primary },
                headerTintColor: Colors.white,
                headerTitleStyle: { fontWeight: '700', fontFamily: 'Nunito_700Bold' },
                headerBackTitle: '',
                presentation: 'card',
              }}
            />
          </Stack>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
