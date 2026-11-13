import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { TooltipProvider } from '@/components/ui';
import { AssetDatabaseService } from '@/services/assets/assetDb';
import {
  ChromeStorageService,
  type StorageBackendAdapter,
} from '@/services/storage/chromeStorageService';
import { useThemeStore } from '@/state/themeStore';
import { useWorkspaceStore } from '@/state/workspaceStore';
import { ProfileManagerDialog } from './ProfileManagerDialog';
import { createProfileFromPreset } from './profilePresets';

function createMemoryStorageService(): ChromeStorageService {
  const store = new Map<string, unknown>();
  const adapter: StorageBackendAdapter = {
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
  return new ChromeStorageService(adapter);
}

describe('Phase 6 — Multi-Profile Workspace Management & Shared Asset GC', () => {
  let db: AssetDatabaseService;
  let storage: ChromeStorageService;

  beforeEach(async () => {
    db = new AssetDatabaseService(`aurora-profiles-test-${Math.random().toString(36).slice(2, 8)}`);
    storage = createMemoryStorageService();
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
    await useWorkspaceStore.getState().hydrate(storage);
  });

  afterEach(async () => {
    await db.closeConnection();
  });

  it('creates tailored profiles for Personal, Work, Study, Minimal, Creative, and Custom presets', () => {
    const presets = ['personal', 'work', 'study', 'minimal', 'creative', 'custom'] as const;
    for (const preset of presets) {
      const profile = createProfileFromPreset(preset, { name: `My ${preset}` });
      expect(profile.name).toBe(`My ${preset}`);
      expect(profile.presetType).toBe(preset);
      expect(profile.layout.zOrder.length).toBeGreaterThanOrEqual(2);
    }

    const minimal = createProfileFromPreset('minimal');
    expect(minimal.layout.elements['el-speed-default']).toBeUndefined();
    const creative = createProfileFromPreset('creative');
    expect(creative.theme.accentColor).toBe('#A78BFA');
  });

  it('supports create, rename, duplicate, switch (syncing theme), and blocks deleting the last profile', async () => {
    const work = await useWorkspaceStore
      .getState()
      .createProfile({ name: 'Work Hub', presetType: 'work', switchTo: true }, storage);

    expect(useWorkspaceStore.getState().workspace.activeProfileId).toBe(work.id);
    expect(useThemeStore.getState().theme.accentColor).toBe('#38BDF8');

    const renamed = await useWorkspaceStore
      .getState()
      .renameProfile(work.id, 'Engineering', storage);
    expect(renamed.name).toBe('Engineering');

    const copy = await useWorkspaceStore.getState().duplicateProfile(work.id, undefined, storage);
    expect(copy.name).toBe('Engineering Copy');
    expect(copy.layout.zOrder[0]).not.toBe(work.layout.zOrder[0]);

    // Switch back to Personal
    await useWorkspaceStore.getState().switchProfile('profile-personal', storage);
    expect(useThemeStore.getState().theme.accentColor).toBe('#7FD3F7');

    // Delete copy and work, then verify last remaining profile cannot be deleted
    await useWorkspaceStore.getState().deleteProfile(copy.id, { service: storage, db });
    await useWorkspaceStore.getState().deleteProfile(work.id, { service: storage, db });

    await expect(
      useWorkspaceStore.getState().deleteProfile('profile-personal', { service: storage, db }),
    ).rejects.toThrow(/last remaining/i);
  });

  it('protects shared assets referenced by another profile while purging profile-exclusive orphans on delete', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const sharedBlob = new Blob([pngBytes.buffer], { type: 'image/png' });
    const exclusiveBlob = new Blob([pngBytes.buffer], { type: 'image/png' });

    const sharedMeta = await db.addAsset({
      id: 'asset-shared-wall',
      kind: 'wallpaper',
      name: 'shared-wall.png',
      mimeType: 'image/png',
      blob: sharedBlob,
    });
    const exclusiveMeta = await db.addAsset({
      id: 'asset-work-only-img',
      kind: 'image',
      name: 'work-only.png',
      mimeType: 'image/png',
      blob: exclusiveBlob,
    });

    // Attach shared wallpaper to Personal
    const personal = useWorkspaceStore.getState().workspace.profiles['profile-personal']!;
    await useWorkspaceStore.getState().saveActiveProfileWallpaper(
      {
        ...personal.theme.wallpaper,
        type: 'image',
        assetId: sharedMeta.id,
      },
      sharedMeta,
      storage,
    );

    // Create Work profile using BOTH shared wallpaper AND an exclusive canvas image
    const work = await useWorkspaceStore
      .getState()
      .createProfile({ name: 'Work', presetType: 'work', switchTo: true }, storage);

    const currentState = useWorkspaceStore.getState().workspace;
    const workProfile = currentState.profiles[work.id]!;
    await useWorkspaceStore.getState().replaceWorkspaceState(
      {
        ...currentState,
        assetRegistry: {
          ...currentState.assetRegistry,
          [exclusiveMeta.id]: exclusiveMeta,
        },
        profiles: {
          ...currentState.profiles,
          [work.id]: {
            ...workProfile,
            theme: {
              ...workProfile.theme,
              wallpaper: {
                ...workProfile.theme.wallpaper,
                type: 'image',
                assetId: sharedMeta.id,
              },
            },
            layout: {
              ...workProfile.layout,
              elements: {
                ...workProfile.layout.elements,
                'el-work-img': {
                  id: 'el-work-img',
                  type: 'image',
                  name: 'Work Diagram',
                  zIndex: workProfile.layout.zOrder.length,
                  visible: true,
                  locked: false,
                  groupId: null,
                  transform: {
                    xPct: 10,
                    yPct: 10,
                    widthPx: 200,
                    heightPx: 200,
                    minWidthPx: 40,
                    minHeightPx: 40,
                    aspectLocked: false,
                  },
                  style: {
                    opacity: 1,
                    borderWidthPx: 0,
                    borderColor: 'transparent',
                    borderStyle: 'none',
                    shadow: 'none',
                    cornerRadiusPx: 16,
                  },
                  props: { assetId: exclusiveMeta.id },
                },
              },
              zOrder: [...workProfile.layout.zOrder, 'el-work-img'],
            },
          },
        },
      },
      { service: storage, db },
    );

    const deleteResult = await useWorkspaceStore
      .getState()
      .deleteProfile(work.id, { service: storage, db });

    expect(deleteResult.nextActiveProfileId).toBe('profile-personal');
    expect(deleteResult.purgedAssetIds).toEqual([exclusiveMeta.id]);
    expect(await db.readAsset(sharedMeta.id)).not.toBeNull();
    expect(await db.readAsset(exclusiveMeta.id)).toBeNull();
  });

  it('allows creating, renaming, and deleting profiles via ProfileManagerDialog with delete confirmation', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ProfileManagerDialog open onOpenChange={() => {}} />
      </TooltipProvider>,
    );

    const nameInput = screen.getByLabelText('New profile name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Focus Mode');
    await user.click(screen.getByRole('button', { name: /Create & Switch/i }));

    expect(await screen.findByText('Focus Mode')).toBeInTheDocument();

    // Rename newly created Focus Mode profile
    await user.click(screen.getByRole('button', { name: 'Rename Focus Mode' }));
    const renameInput = screen.getByLabelText('Rename profile input');
    await user.clear(renameInput);
    await user.type(renameInput, 'Deep Focus{Enter}');
    expect(await screen.findByText('Deep Focus')).toBeInTheDocument();

    // Trigger delete confirmation and confirm
    await user.click(screen.getByRole('button', { name: 'Delete Deep Focus' }));
    const confirmDialog = await screen.findByRole('dialog', {
      name: /Delete Profile .*Deep Focus/i,
    });
    await user.click(within(confirmDialog).getByRole('button', { name: 'Delete Profile' }));

    expect(screen.queryByText('Deep Focus')).not.toBeInTheDocument();
  });
});
