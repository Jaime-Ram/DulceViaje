import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FavoriteStop, FavoriteRoute } from '../types/index';

interface FavoritesState {
  favoriteStops: FavoriteStop[];
  favoriteRoutes: FavoriteRoute[];

  addFavoriteStop(stop: FavoriteStop): void;
  removeFavoriteStop(id: number): void;
  isFavoriteStop(id: number): boolean;
  addFavoriteRoute(route: FavoriteRoute): void;
  removeFavoriteRoute(id: string): void;
  updateFavoriteStopName(id: number, name: string): void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favoriteStops: [],
      favoriteRoutes: [],

      addFavoriteStop(stop: FavoriteStop): void {
        const already = get().favoriteStops.some((s) => s.id === stop.id);
        if (!already) {
          set((state) => ({ favoriteStops: [...state.favoriteStops, stop] }));
        }
      },

      removeFavoriteStop(id: number): void {
        set((state) => ({
          favoriteStops: state.favoriteStops.filter((s) => s.id !== id),
        }));
      },

      isFavoriteStop(id: number): boolean {
        return get().favoriteStops.some((s) => s.id === id);
      },

      addFavoriteRoute(route: FavoriteRoute): void {
        const already = get().favoriteRoutes.some((r) => r.id === route.id);
        if (!already) {
          set((state) => ({ favoriteRoutes: [...state.favoriteRoutes, route] }));
        }
      },

      removeFavoriteRoute(id: string): void {
        set((state) => ({
          favoriteRoutes: state.favoriteRoutes.filter((r) => r.id !== id),
        }));
      },

      updateFavoriteStopName(id: number, name: string): void {
        set((state) => ({
          favoriteStops: state.favoriteStops.map((s) =>
            s.id === id ? { ...s, customName: name } : s
          ),
        }));
      },
    }),
    {
      name: 'bondivideo-favorites',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
