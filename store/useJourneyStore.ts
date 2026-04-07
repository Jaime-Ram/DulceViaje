import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Location, Journey } from '../types/index';

const MAX_RECENT = 5;
const MAX_SAVED = 20;

interface JourneyState {
  fromLocation: Location | null;
  toLocation: Location | null;
  departureTime: Date;
  isNow: boolean;
  recentJourneys: Journey[];
  savedJourneys: Journey[];
  selectedJourney: Journey | null;

  setFrom(location: Location | null): void;
  setTo(location: Location | null): void;
  swapLocations(): void;
  setDepartureTime(date: Date): void;
  setIsNow(isNow: boolean): void;
  addRecentJourney(journey: Journey): void;
  saveJourney(journey: Journey): void;
  unsaveJourney(id: string): void;
  isJourneySaved(id: string): boolean;
  setSelectedJourney(journey: Journey | null): void;
  clearLocations(): void;
}

export const useJourneyStore = create<JourneyState>()(
  persist(
    (set, get) => ({
      fromLocation: null,
      toLocation: null,
      departureTime: new Date(),
      isNow: true,
      recentJourneys: [],
      savedJourneys: [],
      selectedJourney: null,

      setFrom: (location) => set({ fromLocation: location }),
      setTo: (location) => set({ toLocation: location }),

      swapLocations() {
        const { fromLocation, toLocation } = get();
        set({ fromLocation: toLocation, toLocation: fromLocation });
      },

      setDepartureTime: (date) => set({ departureTime: date }),
      setIsNow: (isNow) => set({ isNow, ...(isNow ? { departureTime: new Date() } : {}) }),

      addRecentJourney(journey) {
        set((state) => {
          const filtered = state.recentJourneys.filter((j) => j.id !== journey.id);
          return { recentJourneys: [journey, ...filtered].slice(0, MAX_RECENT) };
        });
      },

      saveJourney(journey) {
        set((state) => {
          if (state.savedJourneys.some((j) => j.id === journey.id)) return state;
          return { savedJourneys: [journey, ...state.savedJourneys].slice(0, MAX_SAVED) };
        });
      },

      unsaveJourney(id) {
        set((state) => ({ savedJourneys: state.savedJourneys.filter((j) => j.id !== id) }));
      },

      isJourneySaved: (id) => get().savedJourneys.some((j) => j.id === id),

      setSelectedJourney: (journey) => set({ selectedJourney: journey }),

      clearLocations: () => set({ fromLocation: null, toLocation: null }),
    }),
    {
      name: 'dulce-viaje-journeys',
      storage: createJSONStorage(() => AsyncStorage),
      // Don't persist selectedJourney or ephemeral fields
      partialize: (state) => ({
        recentJourneys: state.recentJourneys,
        savedJourneys: state.savedJourneys,
      }),
    }
  )
);
