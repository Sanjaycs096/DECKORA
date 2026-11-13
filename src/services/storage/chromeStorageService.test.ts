import { describe, expect, it } from 'vitest';
import {
  ChromeStorageService,
  StorageServiceError,
  WORKSPACE_STORAGE_KEY,
  type StorageBackendAdapter,
} from './chromeStorageService';
import { createDefaultWorkspaceState } from './defaults';
import { validateAndMigrateWorkspace } from './schemas';

function createMemoryAdapter(initial?: Record<string, unknown>): StorageBackendAdapter {
  const store = new Map<string, unknown>(Object.entries(initial ?? {}));
  return {
    get: (key) => Promise.resolve(store.get(key)),
    set: (key, value) => {
      store.set(key, value);
      return Promise.resolve();
    },
    remove: (key) => {
      store.delete(key);
      return Promise.resolve();
    },
  };
}

describe('ChromeStorageService & Zod Validation', () => {
  it('initializes with schema v5 defaults when storage is empty', async () => {
    const service = new ChromeStorageService(createMemoryAdapter());
    const result = await service.initialize();

    expect(result.recoveredFromInvalid).toBe(false);
    expect(result.state.schemaVersion).toBe(5);
    expect(result.state.revision).toBe(1);
    expect(result.state.profiles['profile-personal']?.name).toBe('Personal');
    expect(result.state.profiles['profile-personal']?.layout.zOrder).toContain('el-clock-default');
    expect(result.state.profiles['profile-personal']?.layout.zOrder).toContain('el-speed-default');
    expect(result.state.profiles['profile-personal']?.theme.wallpaper.focalXPct).toBe(50);
    expect(result.state.profiles['profile-personal']?.theme.wallpaper.vignettePct).toBe(0);
  });

  it('migrates Phase 1 v1 payloads to v5 while preserving existing theme settings', async () => {
    const v3Template = createDefaultWorkspaceState();
    const personal = v3Template.profiles['profile-personal']!;
    const v1Payload = {
      ...v3Template,
      schemaVersion: 1,
      revision: 7,
      profiles: {
        'profile-personal': {
          ...personal,
          theme: {
            ...personal.theme,
            appearance: 'light' as const,
            wallpaper: {
              type: 'gradient',
              solidColor: '#101827',
              gradientCss: 'linear-gradient(#111, #222)',
              assetId: null,
              fit: 'cover',
              position: 'center',
              blurPx: 2,
              dimPct: 10,
              overlayColor: '#101827',
              overlayOpacity: 0.1,
            },
          },
          layout: {
            ...personal.layout,
            elements: {},
            zOrder: [],
          },
        },
      },
    };

    const adapter = createMemoryAdapter({
      [WORKSPACE_STORAGE_KEY]: v1Payload,
    });
    const service = new ChromeStorageService(adapter);

    const result = await service.readWorkspace();
    expect(result.recoveredFromInvalid).toBe(false);
    expect(result.state.schemaVersion).toBe(5);
    expect(result.state.revision).toBe(7);
    expect(result.state.profiles['profile-personal']?.theme.appearance).toBe('light');
    expect(result.state.profiles['profile-personal']?.theme.wallpaper.focalXPct).toBe(50);
    expect(result.state.profiles['profile-personal']?.layout.zOrder.length).toBe(4);
  });

  it('migrates Phase 2/3 v2 payloads cleanly to v5 with wallpaper focal points', async () => {
    const v3Template = createDefaultWorkspaceState();
    const personal = v3Template.profiles['profile-personal']!;
    const v2Payload = {
      ...v3Template,
      schemaVersion: 2,
      revision: 12,
      profiles: {
        'profile-personal': {
          ...personal,
          theme: {
            ...personal.theme,
            wallpaper: {
              type: 'solid',
              solidColor: '#121826',
              gradientCss: '',
              assetId: null,
              fit: 'contain',
              position: 'right',
              blurPx: 4,
              dimPct: 20,
              overlayColor: '#101827',
              overlayOpacity: 0.2,
            },
          },
        },
      },
    };

    const adapter = createMemoryAdapter({
      [WORKSPACE_STORAGE_KEY]: v2Payload,
    });
    const service = new ChromeStorageService(adapter);

    const result = await service.readWorkspace();
    expect(result.recoveredFromInvalid).toBe(false);
    expect(result.state.schemaVersion).toBe(5);
    expect(result.state.revision).toBe(12);
    expect(result.state.profiles['profile-personal']?.theme.wallpaper.focalXPct).toBe(100);
    expect(result.state.profiles['profile-personal']?.theme.wallpaper.focalYPct).toBe(50);
    expect(result.state.profiles['profile-personal']?.theme.wallpaper.vignettePct).toBe(0);
  });

  it('migrates Phase 4 v3 payloads and legacy speedCache cleanly to v5 without modifying custom user layouts', async () => {
    const template = createDefaultWorkspaceState();
    const personal = template.profiles['profile-personal']!;
    const v3ClockOnly = {
      ...template,
      schemaVersion: 3,
      revision: 19,
      speedCache: {
        downloadMbps: 142.5,
        uploadMbps: 41.2,
        latencyMs: 14.3,
        measuredAt: '2026-10-01T10:00:00.000Z',
        source: 'manual' as const,
        status: 'ok' as const,
      },
      profiles: {
        'profile-personal': {
          ...personal,
          layout: {
            ...personal.layout,
            elements: {
              'el-clock-default': personal.layout.elements['el-clock-default']!,
            },
            zOrder: ['el-clock-default'],
          },
        },
      },
    };

    const adapter = createMemoryAdapter({
      [WORKSPACE_STORAGE_KEY]: v3ClockOnly,
    });
    const service = new ChromeStorageService(adapter);

    const result = await service.readWorkspace();
    expect(result.recoveredFromInvalid).toBe(false);
    expect(result.state.schemaVersion).toBe(5);
    expect(result.state.revision).toBe(19);
    // Custom non-empty v3 layout must not be forcibly altered
    expect(result.state.profiles['profile-personal']?.layout.zOrder).toEqual(['el-clock-default']);
    // Legacy speedCache reading is preserved inside v4 SpeedCacheState
    expect(result.state.speedCache?.status).toBe('completed');
    expect(result.state.speedCache?.lastSuccessfulResult?.downloadMbps).toBe(142.5);
    expect(result.state.speedCache?.lastSuccessfulResult?.source).toBe('manual');
  });

  it('persists and reads back valid workspace updates', async () => {
    const adapter = createMemoryAdapter();
    const service = new ChromeStorageService(adapter);
    const initial = await service.initialize();

    const updated = {
      ...initial.state,
      revision: 2,
    };
    await service.writeWorkspace(updated);

    const reloaded = await service.readWorkspace();
    expect(reloaded.recoveredFromInvalid).toBe(false);
    expect(reloaded.state.revision).toBe(2);
  });

  it('recovers gracefully when stored workspace JSON is invalid', async () => {
    const adapter = createMemoryAdapter({
      [WORKSPACE_STORAGE_KEY]: { schemaVersion: 99, corrupted: true },
    });
    const service = new ChromeStorageService(adapter);

    const result = await service.readWorkspace();
    expect(result.recoveredFromInvalid).toBe(true);
    expect(result.recoveryReason).toContain('Unsupported');
    expect(result.state.schemaVersion).toBe(5);
  });

  it('migrates Phase 5 v4 payloads losslessly to v5 preserving all profiles and palettes', async () => {
    const template = createDefaultWorkspaceState();
    const v4Payload = {
      ...template,
      schemaVersion: 4,
      revision: 27,
      profiles: {
        'profile-personal': {
          ...template.profiles['profile-personal']!,
          theme: {
            ...template.profiles['profile-personal']!.theme,
            extractedPalette: {
              dominant: '#182A44',
              accent: '#75CFFF',
              averageLuminance: 0.19,
              recommendedAppearance: 'dark' as const,
            },
          },
        },
      },
    };

    const service = new ChromeStorageService(
      createMemoryAdapter({ [WORKSPACE_STORAGE_KEY]: v4Payload }),
    );
    const result = await service.readWorkspace();
    expect(result.recoveredFromInvalid).toBe(false);
    expect(result.state.schemaVersion).toBe(5);
    expect(result.state.revision).toBe(27);
    expect(result.state.profiles['profile-personal']?.theme.extractedPalette?.accent).toBe(
      '#75CFFF',
    );
  });

  it('rejects oversized metadata payloads to prevent binary storage in chrome.storage.local', async () => {
    const service = new ChromeStorageService(createMemoryAdapter());
    const defaults = createDefaultWorkspaceState();
    const hugeNote = 'A'.repeat(600 * 1024);

    const bloated = {
      ...defaults,
      profiles: {
        ...defaults.profiles,
        'profile-personal': {
          ...defaults.profiles['profile-personal']!,
          navigation: {
            ...defaults.profiles['profile-personal']!.navigation,
            curatedBookmarks: [{ id: 'huge', title: hugeNote, url: 'https://example.com' }],
          },
        },
      },
    };

    await expect(service.writeWorkspace(bloated)).rejects.toBeInstanceOf(StorageServiceError);
  });

  it('detects missing activeProfileId during Zod migration check', () => {
    const defaults = createDefaultWorkspaceState();
    const broken = {
      ...defaults,
      activeProfileId: 'non-existent-profile',
    };
    const res = validateAndMigrateWorkspace(broken);
    expect(res.ok).toBe(false);
  });

  it('rejects layouts with broken group/zOrder integrity and persists valid grouped layouts cleanly', async () => {
    const adapter = createMemoryAdapter();
    const service = new ChromeStorageService(adapter);
    const initial = await service.initialize();
    const profile = initial.state.profiles['profile-personal']!;

    const corrupted = {
      ...initial.state,
      profiles: {
        ...initial.state.profiles,
        'profile-personal': {
          ...profile,
          layout: {
            ...profile.layout,
            zOrder: [...profile.layout.zOrder, 'missing-element-id'],
          },
        },
      },
    };

    await expect(service.writeWorkspace(corrupted)).rejects.toBeInstanceOf(StorageServiceError);

    const groupedLayout = {
      ...profile.layout,
      groups: {
        'grp-1': {
          id: 'grp-1',
          name: 'Header Group',
          locked: false,
          hidden: false,
          childIds: ['el-clock-default', 'el-search-default'],
        },
      },
      elements: {
        ...profile.layout.elements,
        'el-clock-default': {
          ...profile.layout.elements['el-clock-default']!,
          groupId: 'grp-1',
        },
        'el-search-default': {
          ...profile.layout.elements['el-search-default']!,
          groupId: 'grp-1',
        },
      },
    };

    const validGroupedState = {
      ...initial.state,
      revision: 3,
      profiles: {
        ...initial.state.profiles,
        'profile-personal': {
          ...profile,
          layout: groupedLayout,
        },
      },
    };

    await service.writeWorkspace(validGroupedState);
    const reloaded = await service.readWorkspace();
    expect(reloaded.state.profiles['profile-personal']?.layout.groups['grp-1']?.childIds).toEqual([
      'el-clock-default',
      'el-search-default',
    ]);
  });
});
