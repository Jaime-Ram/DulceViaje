import AsyncStorage from '@react-native-async-storage/async-storage';
import { FavoriteStop, FavoriteRoute } from '../../types';

const STOPS_KEY = '@dulceviaje/favorite_stops';
const ROUTES_KEY = '@dulceviaje/favorite_routes';

export async function loadFavoriteStops(): Promise<FavoriteStop[]> {
  try {
    const json = await AsyncStorage.getItem(STOPS_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function saveFavoriteStops(stops: FavoriteStop[]): Promise<void> {
  await AsyncStorage.setItem(STOPS_KEY, JSON.stringify(stops));
}

export async function loadFavoriteRoutes(): Promise<FavoriteRoute[]> {
  try {
    const json = await AsyncStorage.getItem(ROUTES_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function saveFavoriteRoutes(routes: FavoriteRoute[]): Promise<void> {
  await AsyncStorage.setItem(ROUTES_KEY, JSON.stringify(routes));
}
