import { afterEach, describe, expect, it } from 'vitest';
import { AssetDatabaseService, AssetStorageError } from './assetDb';

describe('AssetDatabaseService (IndexedDB aurora-assets-db)', () => {
  const instances: AssetDatabaseService[] = [];

  function createIsolatedDb(): AssetDatabaseService {
    const db = new AssetDatabaseService(`aurora-test-db-${Math.random().toString(36).slice(2)}`);
    instances.push(db);
    return db;
  }

  afterEach(async () => {
    await Promise.all(instances.map((instance) => instance.closeConnection()));
    instances.length = 0;
  });

  it('initializes IndexedDB and inserts, reads, updates, lists, and deletes assets', async () => {
    const db = createIsolatedDb();
    await db.initAssetDb();

    const sampleBlob = new Blob(['fake-png-binary-data'], { type: 'image/png' });
    const created = await db.addAsset({
      id: 'asset-1',
      kind: 'image',
      name: 'crystal.png',
      mimeType: 'image/png',
      blob: sampleBlob,
      width: 512,
      height: 512,
    });

    expect(created.id).toBe('asset-1');
    expect(created.byteSize).toBe(sampleBlob.size);

    const fetched = await db.readAsset('asset-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.metadata.name).toBe('crystal.png');
    expect(fetched?.blob.size).toBe(sampleBlob.size);

    const updatedMeta = await db.updateAssetMetadata('asset-1', { name: 'crystal-renamed.png' });
    expect(updatedMeta.name).toBe('crystal-renamed.png');

    const list = await db.listAssets('image');
    expect(list).toHaveLength(1);

    await db.deleteAsset('asset-1');
    expect(await db.readAsset('asset-1')).toBeNull();
    expect(await db.listAssets()).toHaveLength(0);
  });

  it('stores and retrieves font buffers in the fonts object store', async () => {
    const db = createIsolatedDb();
    const buffer = new Uint8Array([0x77, 0x4f, 0x46, 0x32]).buffer;

    await db.addFont({
      id: 'font-1',
      familyName: 'CustomCrystal',
      format: 'woff2',
      buffer,
      createdAt: Date.now(),
    });

    const font = await db.readFont('font-1');
    expect(font?.familyName).toBe('CustomCrystal');
    expect(font?.buffer.byteLength).toBe(4);
  });

  it('handles missing assets and invalid inputs cleanly', async () => {
    const db = createIsolatedDb();

    expect(await db.readAsset('missing-id')).toBeNull();
    await expect(db.updateAssetMetadata('missing-id', { name: 'nope' })).rejects.toBeInstanceOf(
      AssetStorageError,
    );
    await expect(
      db.addAsset({
        id: '',
        kind: 'image',
        name: 'bad',
        mimeType: 'image/png',
        blob: new Blob(['ok']),
      }),
    ).rejects.toBeInstanceOf(AssetStorageError);
  });
});
