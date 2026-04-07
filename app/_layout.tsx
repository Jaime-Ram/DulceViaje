import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor={Colors.primary} />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="stop/[id]"
            options={{
              headerStyle: { backgroundColor: Colors.primary },
              headerTintColor: Colors.white,
              headerTitleStyle: { fontWeight: '700' },
              headerBackTitle: '',
              presentation: 'card',
            }}
          />
          <Stack.Screen
            name="search"
            options={{
              headerStyle: { backgroundColor: Colors.primary },
              headerTintColor: Colors.white,
              headerTitleStyle: { fontWeight: '700' },
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
              headerTitleStyle: { fontWeight: '700' },
              headerBackTitle: '',
              presentation: 'card',
            }}
          />
          <Stack.Screen
            name="trip/[id]"
            options={{
              headerStyle: { backgroundColor: Colors.primary },
              headerTintColor: Colors.white,
              headerTitleStyle: { fontWeight: '700' },
              headerBackTitle: '',
              presentation: 'card',
            }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
