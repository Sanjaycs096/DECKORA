import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { AssetDatabaseService } from './assetDb';
import { cleanupUnreferencedAssets, collectReferencedAssetIds } from './assetLifecycle';
import {
  acquireAssetUrl,
  clearAllCachedAssetUrls,
  getCachedAssetRefCount,
  releaseAssetUrl,
} from './assetUrlManager';
import { createDefaultWorkspaceState } from '@/services/storage/defaults';

describe('Asset URL Manager & Transactional Lifecycle GC', () => {
  let db: AssetDatabaseService;

  beforeEach(() => {
    clearAllCachedAssetUrls();
    db = new AssetDatabaseService(
      `aurora-lifecycle-test-${Math.random().toString(36).slice(2, 8)}`,
    );
  });

  afterEach(async () => {
    clearAllCachedAssetUrls();
    await db.closeConnection();
    vi.restoreAllMocks();
  });

  it('reference-counts Blob URLs safely and revokes only when last consumer releases', async () => {
    const createSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation((blob) => `blob:test-${(blob as Blob).size}-${Math.random()}`);
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]).buffer], {
      type: 'image/png',
    });
    await db.addAsset({
      id: 'asset-shared-1',
      kind: 'image',
      name: 'shared.png',
      mimeType: 'image/png',
      blob,
    });

    const first = await acquireAssetUrl('asset-shared-1', db);
    const second = await acquireAssetUrl('asset-shared-1', db);

    expect(first).not.toBeNull();
    expect(second?.url).toBe(first?.url);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(getCachedAssetRefCount('asset-shared-1')).toBe(2);

    // First consumer unmounts (e.g., duplicated copy removed) -> URL must remain valid
    releaseAssetUrl('asset-shared-1');
    expect(getCachedAssetRefCount('asset-shared-1')).toBe(1);
    expect(revokeSpy).not.toHaveBeenCalled();

    // Last consumer unmounts -> revokeObjectURL called once
    releaseAssetUrl('asset-shared-1');
    expect(getCachedAssetRefCount('asset-shared-1')).toBe(0);
    expect(revokeSpy).toHaveBeenCalledWith(first!.url);
  });

  it('preserves shared cross-profile/duplicated assets during garbage collection and deletes true orphans', async () => {
    const sampleBlob = new Blob([new Uint8Array([1, 2, 3, 4]).buffer], { type: 'image/png' });
    await db.addAsset({
      id: 'asset-used-in-profile-b',
      kind: 'wallpaper',
      name: 'work-bg.png',
      mimeType: 'image/png',
      blob: sampleBlob,
    });
    await db.addAsset({
      id: 'asset-true-orphan',
      kind: 'image',
      name: 'abandoned.png',
      mimeType: 'image/png',
      blob: sampleBlob,
    });

    const workspace = createDefaultWorkspaceState();
    const profilePersonal = workspace.profiles['profile-personal']!;
    workspace.profiles['profile-work'] = {
      ...structuredClone(profilePersonal),
      id: 'profile-work',
      name: 'Work',
      theme: {
        ...profilePersonal.theme,
        wallpaper: {
          ...profilePersonal.theme.wallpaper,
          type: 'image',
          assetId: 'asset-used-in-profile-b',
        },
      },
    };

    const referenced = collectReferencedAssetIds(workspace);
    expect(referenced.has('asset-used-in-profile-b')).toBe(true);
    expect(referenced.has('asset-true-orphan')).toBe(false);

    const deleted = await cleanupUnreferencedAssets(
      ['asset-used-in-profile-b', 'asset-true-orphan'],
      workspace,
      db,
    );

    expect(deleted).toEqual(['asset-true-orphan']);
    expect(await db.readAsset('asset-used-in-profile-b')).not.toBeNull();
    expect(await db.readAsset('asset-true-orphan')).toBeNull();
  });
});
