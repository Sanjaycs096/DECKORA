import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createDefaultGlobalPreferences } from '@/services/storage/defaults';
import type { GlobalPreferences } from '@/types/workspace';

export interface PreferencesStoreState {
  preferences: GlobalPreferences;
  hydratePreferences: (preferences: GlobalPreferences) => void;
  updatePreferences: (patch: Partial<GlobalPreferences>) => void;
  resetPreferences: () => void;
}

export const usePreferencesStore = create<PreferencesStoreState>()(
  immer((set) => ({
    preferences: createDefaultGlobalPreferences(),
    hydratePreferences: (preferences) =>
      set((draft) => {
        draft.preferences = preferences;
      }),
    updatePreferences: (patch) =>
      set((draft) => {
        Object.assign(draft.preferences, patch);
      }),
    resetPreferences: () =>
      set((draft) => {
        draft.preferences = createDefaultGlobalPreferences();
      }),
  })),
);
