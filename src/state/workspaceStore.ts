import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { reconcileSpeedAlarm } from '@/background/speedScheduler';
import {
  cloneProfileWithFreshIds,
  createProfileFromPreset,
} from '@/features/profiles/profilePresets';
import { assetDb, type AssetDatabaseService } from '@/services/assets/assetDb';
import {
  cleanupUnreferencedAssets,
  collectProfileAssetIds,
  collectReferencedAssetIds,
} from '@/services/assets/assetLifecycle';
import {
  chromeStorageService,
  type ChromeStorageService,
} from '@/services/storage/chromeStorageService';
import { createDefaultWorkspaceState } from '@/services/storage/defaults';
import { validateAndMigrateWorkspace } from '@/services/storage/schemas';
import type {
  AssetMetadata,
  CanvasLayout,
  CustomFontRecord,
  PersistedWorkspaceState,
  ProfilePresetType,
  SpeedCacheState,
  ThemeConfig,
  WallpaperConfig,
  WorkspaceProfile,
} from '@/types/workspace';
import { cloneLayout, validateLayoutIntegrity } from '@/features/editor/layoutOps';
import { usePreferencesStore } from './preferencesStore';
import { useThemeStore } from './themeStore';

export type WorkspaceLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface CommitDraftPayload {
  layout: CanvasLayout;
  theme?: ThemeConfig;
  addedAssetMetadata?: Record<string, AssetMetadata>;
  addedCustomFonts?: CustomFontRecord[];
  candidateOrphanIds?: string[];
}

export interface WorkspaceStoreState {
  workspace: PersistedWorkspaceState;
  status: WorkspaceLoadStatus;
  errorMessage: string | null;
  recoveryNotice: string | null;
  hydrate: (service?: ChromeStorageService) => Promise<void>;
  saveActiveProfileTheme: (theme: ThemeConfig, service?: ChromeStorageService) => Promise<void>;
  saveActiveProfileWallpaper: (
    wallpaper: WallpaperConfig,
    newAssetMetadata?: AssetMetadata | null,
    service?: ChromeStorageService,
    themePatch?: Partial<Omit<ThemeConfig, 'wallpaper'>>,
  ) => Promise<void>;
  updateActiveProfileElementProps: (
    elementId: string,
    propsPatch: Record<string, unknown>,
    service?: ChromeStorageService,
  ) => Promise<void>;
  commitActiveProfileLayout: (
    layout: CanvasLayout,
    service?: ChromeStorageService,
  ) => Promise<PersistedWorkspaceState>;
  commitActiveProfileDraft: (
    payload: CommitDraftPayload,
    service?: ChromeStorageService,
  ) => Promise<PersistedWorkspaceState>;
  createProfile: (
    input: { name: string; presetType: ProfilePresetType; switchTo?: boolean },
    service?: ChromeStorageService,
  ) => Promise<WorkspaceProfile>;
  renameProfile: (
    profileId: string,
    newName: string,
    service?: ChromeStorageService,
  ) => Promise<WorkspaceProfile>;
  duplicateProfile: (
    profileId: string,
    newName?: string,
    service?: ChromeStorageService,
  ) => Promise<WorkspaceProfile>;
  switchProfile: (profileId: string, service?: ChromeStorageService) => Promise<WorkspaceProfile>;
  deleteProfile: (
    profileId: string,
    options?: { service?: ChromeStorageService; db?: AssetDatabaseService },
  ) => Promise<{
    deletedProfileId: string;
    nextActiveProfileId: string;
    purgedAssetIds: string[];
  }>;
  replaceWorkspaceState: (
    nextState: PersistedWorkspaceState,
    options?: { service?: ChromeStorageService; db?: AssetDatabaseService },
  ) => Promise<PersistedWorkspaceState>;
  setSyncChromeBookmarks: (enabled: boolean, service?: ChromeStorageService) => Promise<void>;
  setSpeedCache: (cache: SpeedCacheState | null) => void;
  syncFromExternalStorage: (rawValue: unknown, isEditing: boolean) => void;
  resetWorkspace: (service?: ChromeStorageService) => Promise<void>;
  getActiveProfile: () => WorkspaceProfile | undefined;
}

export const useWorkspaceStore = create<WorkspaceStoreState>()(
  immer((set, get) => ({
    workspace: createDefaultWorkspaceState(),
    status: 'idle',
    errorMessage: null,
    recoveryNotice: null,

    hydrate: async (service = chromeStorageService) => {
      set((draft) => {
        draft.status = 'loading';
        draft.errorMessage = null;
      });
      try {
        const result = await service.readWorkspace();
        set((draft) => {
          draft.workspace = result.state;
          draft.status = 'ready';
          draft.recoveryNotice = result.recoveredFromInvalid
            ? (result.recoveryReason ?? 'Recovered from invalid storage payload.')
            : null;
        });

        const activeProfile = result.state.profiles[result.state.activeProfileId];
        if (activeProfile) {
          useThemeStore.getState().syncFromThemeConfig(activeProfile.theme);
        }
        usePreferencesStore.getState().hydratePreferences(result.state.globalSettings);
      } catch (error) {
        set((draft) => {
          draft.status = 'error';
          draft.errorMessage =
            error instanceof Error ? error.message : 'Unable to load workspace storage.';
        });
      }
    },

    saveActiveProfileTheme: async (theme, service = chromeStorageService) => {
      const current = get().workspace;
      const activeProfile = current.profiles[current.activeProfileId];
      if (!activeProfile) return;

      const oldWallpaperAssetId =
        activeProfile.theme.wallpaper.type === 'image'
          ? activeProfile.theme.wallpaper.assetId
          : null;

      const nowIso = new Date().toISOString();
      const nextState: PersistedWorkspaceState = {
        ...current,
        revision: current.revision + 1,
        updatedAt: nowIso,
        profiles: {
          ...current.profiles,
          [activeProfile.id]: {
            ...activeProfile,
            updatedAt: nowIso,
            theme,
          },
        },
      };

      const saved = await service.writeWorkspace(nextState);
      set((draft) => {
        draft.workspace = saved;
      });
      useThemeStore.getState().syncFromThemeConfig(theme);

      if (oldWallpaperAssetId && oldWallpaperAssetId !== theme.wallpaper.assetId) {
        void cleanupUnreferencedAssets([oldWallpaperAssetId], saved);
      }
    },

    saveActiveProfileWallpaper: async (
      wallpaper,
      newAssetMetadata = null,
      service = chromeStorageService,
      themePatch,
    ) => {
      const current = get().workspace;
      const activeProfile = current.profiles[current.activeProfileId];
      if (!activeProfile) return;

      const oldAssetId =
        activeProfile.theme.wallpaper.type === 'image'
          ? activeProfile.theme.wallpaper.assetId
          : null;

      const nextTheme: ThemeConfig = {
        ...activeProfile.theme,
        ...(themePatch ? structuredClone(themePatch) : {}),
        wallpaper: structuredClone(wallpaper),
      };

      const nextRegistry: Record<string, AssetMetadata> = {
        ...current.assetRegistry,
      };
      if (newAssetMetadata) {
        nextRegistry[newAssetMetadata.id] = newAssetMetadata;
      }

      const nowIso = new Date().toISOString();
      const draftState: PersistedWorkspaceState = {
        ...current,
        revision: current.revision + 1,
        updatedAt: nowIso,
        assetRegistry: nextRegistry,
        profiles: {
          ...current.profiles,
          [activeProfile.id]: {
            ...activeProfile,
            updatedAt: nowIso,
            theme: nextTheme,
          },
        },
      };

      const stillReferenced = collectReferencedAssetIds(draftState);
      const prunedRegistry = Object.fromEntries(
        Object.entries(draftState.assetRegistry).filter(([id]) => stillReferenced.has(id)),
      );

      const saved = await service.writeWorkspace({
        ...draftState,
        assetRegistry: prunedRegistry,
      });

      set((draft) => {
        draft.workspace = saved;
      });
      useThemeStore.getState().syncFromThemeConfig(nextTheme);

      if (oldAssetId && oldAssetId !== wallpaper.assetId) {
        void cleanupUnreferencedAssets([oldAssetId], saved);
      }
    },

    updateActiveProfileElementProps: async (
      elementId,
      propsPatch,
      service = chromeStorageService,
    ) => {
      const current = get().workspace;
      const activeProfile = current.profiles[current.activeProfileId];
      if (!activeProfile) return;

      const existingElement = activeProfile.layout.elements[elementId];
      if (!existingElement) return;

      const nowIso = new Date().toISOString();
      const nextState: PersistedWorkspaceState = {
        ...current,
        revision: current.revision + 1,
        updatedAt: nowIso,
        profiles: {
          ...current.profiles,
          [activeProfile.id]: {
            ...activeProfile,
            updatedAt: nowIso,
            layout: {
              ...activeProfile.layout,
              elements: {
                ...activeProfile.layout.elements,
                [elementId]: {
                  ...existingElement,
                  props: {
                    ...existingElement.props,
                    ...propsPatch,
                  },
                },
              },
            },
          },
        },
      };

      const saved = await service.writeWorkspace(nextState);
      set((draft) => {
        draft.workspace = saved;
      });
    },

    commitActiveProfileLayout: async (layout, service = chromeStorageService) => {
      return get().commitActiveProfileDraft({ layout }, service);
    },

    commitActiveProfileDraft: async (payload, service = chromeStorageService) => {
      const current = get().workspace;
      const activeProfile = current.profiles[current.activeProfileId];
      if (!activeProfile) {
        throw new Error('No active workspace profile available to save.');
      }

      const integrity = validateLayoutIntegrity(payload.layout);
      if (!integrity.valid) {
        throw new Error(`Invalid canvas layout: ${integrity.errors[0] ?? 'integrity error'}`);
      }

      const nowIso = new Date().toISOString();
      const nextTheme = payload.theme ? structuredClone(payload.theme) : activeProfile.theme;

      const mergedFontsMap = new Map<string, CustomFontRecord>();
      for (const f of current.globalSettings.customFonts) {
        mergedFontsMap.set(f.assetId, f);
      }
      if (payload.addedCustomFonts) {
        for (const f of payload.addedCustomFonts) {
          mergedFontsMap.set(f.assetId, f);
        }
      }

      const candidateState: PersistedWorkspaceState = {
        ...current,
        revision: current.revision + 1,
        updatedAt: nowIso,
        assetRegistry: {
          ...current.assetRegistry,
          ...(payload.addedAssetMetadata ?? {}),
        },
        globalSettings: {
          ...current.globalSettings,
          customFonts: Array.from(mergedFontsMap.values()),
        },
        profiles: {
          ...current.profiles,
          [activeProfile.id]: {
            ...activeProfile,
            updatedAt: nowIso,
            theme: nextTheme,
            layout: cloneLayout(payload.layout),
          },
        },
      };

      // Only commit newly uploaded fonts that are actually referenced by a text element;
      // retain previously saved fonts unless explicitly removed.
      const stateWithoutNewFonts: PersistedWorkspaceState = {
        ...candidateState,
        globalSettings: {
          ...current.globalSettings,
        },
      };
      const referencedWithoutNewFonts = collectReferencedAssetIds(stateWithoutNewFonts);
      const newlyAddedSet = new Set((payload.addedCustomFonts ?? []).map((f) => f.assetId));
      const filteredFonts = candidateState.globalSettings.customFonts.filter(
        (font) => !newlyAddedSet.has(font.assetId) || referencedWithoutNewFonts.has(font.assetId),
      );

      // Recompute after font filtering and prune dangling assetRegistry keys
      const nextStateForRefs: PersistedWorkspaceState = {
        ...candidateState,
        globalSettings: {
          ...candidateState.globalSettings,
          customFonts: filteredFonts,
        },
      };
      const finalReferenced = collectReferencedAssetIds(nextStateForRefs);
      const prunedRegistry = Object.fromEntries(
        Object.entries(nextStateForRefs.assetRegistry).filter(([id]) => finalReferenced.has(id)),
      );

      const saved = await service.writeWorkspace({
        ...nextStateForRefs,
        assetRegistry: prunedRegistry,
      });

      set((draft) => {
        draft.workspace = saved;
      });
      useThemeStore.getState().syncFromThemeConfig(nextTheme);
      usePreferencesStore.getState().hydratePreferences(saved.globalSettings);
      void reconcileSpeedAlarm(saved);

      if (payload.candidateOrphanIds && payload.candidateOrphanIds.length > 0) {
        void cleanupUnreferencedAssets(payload.candidateOrphanIds, saved);
      }

      return saved;
    },

    createProfile: async (input, service = chromeStorageService) => {
      const trimmedName = input.name.trim().slice(0, 60);
      if (!trimmedName) {
        throw new Error('Profile name cannot be empty.');
      }

      const current = get().workspace;
      const nowIso = new Date().toISOString();
      const newProfile = createProfileFromPreset(input.presetType, {
        name: trimmedName,
        nowIso,
      });

      const activate = input.switchTo !== false;
      const nextState: PersistedWorkspaceState = {
        ...current,
        revision: current.revision + 1,
        updatedAt: nowIso,
        activeProfileId: activate ? newProfile.id : current.activeProfileId,
        profiles: {
          ...current.profiles,
          [newProfile.id]: newProfile,
        },
      };

      const saved = await service.writeWorkspace(nextState);
      set((draft) => {
        draft.workspace = saved;
      });

      if (activate) {
        useThemeStore.getState().syncFromThemeConfig(newProfile.theme);
        void reconcileSpeedAlarm(saved);
      }

      return saved.profiles[newProfile.id]!;
    },

    renameProfile: async (profileId, newName, service = chromeStorageService) => {
      const trimmed = newName.trim().slice(0, 60);
      if (!trimmed) {
        throw new Error('Profile name cannot be empty.');
      }

      const current = get().workspace;
      const target = current.profiles[profileId];
      if (!target) {
        throw new Error(`Profile "${profileId}" does not exist.`);
      }

      const nowIso = new Date().toISOString();
      const nextState: PersistedWorkspaceState = {
        ...current,
        revision: current.revision + 1,
        updatedAt: nowIso,
        profiles: {
          ...current.profiles,
          [profileId]: {
            ...target,
            name: trimmed,
            updatedAt: nowIso,
          },
        },
      };

      const saved = await service.writeWorkspace(nextState);
      set((draft) => {
        draft.workspace = saved;
      });
      return saved.profiles[profileId]!;
    },

    duplicateProfile: async (profileId, newName, service = chromeStorageService) => {
      const current = get().workspace;
      const source = current.profiles[profileId];
      if (!source) {
        throw new Error(`Profile "${profileId}" does not exist.`);
      }

      const nowIso = new Date().toISOString();
      const existingNames = new Set(
        Object.values(current.profiles).map((p) => p.name.toLowerCase()),
      );
      let candidateName = newName?.trim().slice(0, 60) || `${source.name} Copy`;
      if (existingNames.has(candidateName.toLowerCase())) {
        let suffix = 2;
        while (existingNames.has(`${source.name} Copy ${suffix}`.toLowerCase())) {
          suffix += 1;
        }
        candidateName = `${source.name} Copy ${suffix}`.slice(0, 60);
      }

      const cloned = cloneProfileWithFreshIds(source, {
        newName: candidateName,
        nowIso,
      });

      const nextState: PersistedWorkspaceState = {
        ...current,
        revision: current.revision + 1,
        updatedAt: nowIso,
        profiles: {
          ...current.profiles,
          [cloned.id]: cloned,
        },
      };

      const saved = await service.writeWorkspace(nextState);
      set((draft) => {
        draft.workspace = saved;
      });
      return saved.profiles[cloned.id]!;
    },

    switchProfile: async (profileId, service = chromeStorageService) => {
      const current = get().workspace;
      const target = current.profiles[profileId];
      if (!target) {
        throw new Error(`Profile "${profileId}" does not exist.`);
      }

      if (current.activeProfileId === profileId) {
        useThemeStore.getState().syncFromThemeConfig(target.theme);
        return target;
      }

      const nowIso = new Date().toISOString();
      const nextState: PersistedWorkspaceState = {
        ...current,
        revision: current.revision + 1,
        updatedAt: nowIso,
        activeProfileId: profileId,
      };

      const saved = await service.writeWorkspace(nextState);
      set((draft) => {
        draft.workspace = saved;
      });
      const active = saved.profiles[profileId]!;
      useThemeStore.getState().syncFromThemeConfig(active.theme);
      void reconcileSpeedAlarm(saved);
      return active;
    },

    deleteProfile: async (profileId, options) => {
      const service = options?.service ?? chromeStorageService;
      const db = options?.db ?? assetDb;
      const current = get().workspace;
      const target = current.profiles[profileId];
      if (!target) {
        throw new Error(`Profile "${profileId}" does not exist.`);
      }

      const remainingEntries = Object.entries(current.profiles).filter(([id]) => id !== profileId);
      if (remainingEntries.length === 0) {
        throw new Error('Cannot delete the last remaining workspace profile.');
      }

      const candidateAssetIds = collectProfileAssetIds(target);
      const nextProfiles = Object.fromEntries(remainingEntries);
      const nextActiveProfileId =
        current.activeProfileId === profileId
          ? (remainingEntries[0]?.[0] ?? '')
          : current.activeProfileId;

      const nowIso = new Date().toISOString();
      const draftState: PersistedWorkspaceState = {
        ...current,
        revision: current.revision + 1,
        updatedAt: nowIso,
        activeProfileId: nextActiveProfileId,
        profiles: nextProfiles,
      };

      const stillReferenced = collectReferencedAssetIds(draftState);
      const prunedRegistry = Object.fromEntries(
        Object.entries(draftState.assetRegistry).filter(([id]) => stillReferenced.has(id)),
      );

      const saved = await service.writeWorkspace({
        ...draftState,
        assetRegistry: prunedRegistry,
      });

      set((draft) => {
        draft.workspace = saved;
      });

      const nextActive = saved.profiles[saved.activeProfileId];
      if (nextActive) {
        useThemeStore.getState().syncFromThemeConfig(nextActive.theme);
      }
      void reconcileSpeedAlarm(saved);

      const purgedAssetIds = await cleanupUnreferencedAssets(candidateAssetIds, saved, db);
      return {
        deletedProfileId: profileId,
        nextActiveProfileId: saved.activeProfileId,
        purgedAssetIds,
      };
    },

    replaceWorkspaceState: async (nextState, options) => {
      const service = options?.service ?? chromeStorageService;
      const db = options?.db ?? assetDb;
      const current = get().workspace;
      const previousAssetIds = collectReferencedAssetIds(current);

      const stillReferenced = collectReferencedAssetIds(nextState);
      const normalizedState: PersistedWorkspaceState = {
        ...nextState,
        revision: Math.max(nextState.revision, current.revision + 1),
        updatedAt: new Date().toISOString(),
        assetRegistry: Object.fromEntries(
          Object.entries(nextState.assetRegistry).filter(([id]) => stillReferenced.has(id)),
        ),
      };

      const saved = await service.writeWorkspace(normalizedState);
      set((draft) => {
        draft.workspace = saved;
        draft.status = 'ready';
        draft.errorMessage = null;
      });

      const active = saved.profiles[saved.activeProfileId];
      if (active) {
        useThemeStore.getState().syncFromThemeConfig(active.theme);
      }
      usePreferencesStore.getState().hydratePreferences(saved.globalSettings);
      void reconcileSpeedAlarm(saved);

      if (previousAssetIds.size > 0) {
        await cleanupUnreferencedAssets(previousAssetIds, saved, db);
      }

      return saved;
    },

    setSyncChromeBookmarks: async (enabled, service = chromeStorageService) => {
      const current = get().workspace;
      const activeProfile = current.profiles[current.activeProfileId];
      if (!activeProfile || activeProfile.navigation.syncChromeBookmarks === enabled) return;

      const nowIso = new Date().toISOString();
      const nextState: PersistedWorkspaceState = {
        ...current,
        revision: current.revision + 1,
        updatedAt: nowIso,
        profiles: {
          ...current.profiles,
          [activeProfile.id]: {
            ...activeProfile,
            updatedAt: nowIso,
            navigation: {
              ...activeProfile.navigation,
              syncChromeBookmarks: enabled,
            },
          },
        },
      };

      const saved = await service.writeWorkspace(nextState);
      set((draft) => {
        draft.workspace = saved;
      });
    },

    setSpeedCache: (cache) => {
      set((draft) => {
        draft.workspace.speedCache = cache;
      });
    },

    syncFromExternalStorage: (rawValue, isEditing) => {
      const migrated = validateAndMigrateWorkspace(rawValue);
      if (!migrated.ok) return;

      const nextState = migrated.state;
      if (isEditing) {
        set((draft) => {
          draft.workspace.speedCache = nextState.speedCache;
        });
        return;
      }

      const currentRevision = get().workspace.revision;
      if (
        nextState.revision === currentRevision &&
        JSON.stringify(nextState.speedCache) === JSON.stringify(get().workspace.speedCache)
      ) {
        return;
      }

      set((draft) => {
        draft.workspace = nextState;
      });
      const activeProfile = nextState.profiles[nextState.activeProfileId];
      if (activeProfile) {
        useThemeStore.getState().syncFromThemeConfig(activeProfile.theme);
      }
      usePreferencesStore.getState().hydratePreferences(nextState.globalSettings);
    },

    resetWorkspace: async (service = chromeStorageService) => {
      const defaults = await service.resetWorkspace();
      set((draft) => {
        draft.workspace = defaults;
        draft.status = 'ready';
        draft.errorMessage = null;
        draft.recoveryNotice = null;
      });
      const activeProfile = defaults.profiles[defaults.activeProfileId];
      if (activeProfile) {
        useThemeStore.getState().syncFromThemeConfig(activeProfile.theme);
      }
      usePreferencesStore.getState().hydratePreferences(defaults.globalSettings);
      void reconcileSpeedAlarm(defaults);
    },

    getActiveProfile: () => {
      const { workspace } = get();
      return workspace.profiles[workspace.activeProfileId];
    },
  })),
);
