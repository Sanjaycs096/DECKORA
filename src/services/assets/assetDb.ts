import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AssetKind, AssetMetadata } from '@/types/workspace';

export const ASSET_DB_NAME = 'aurora-assets-db';
export const ASSET_DB_VERSION = 1;

export interface StoredAssetRecord {
  id: string;
  kind: AssetKind;
  mimeType: string;
  bytes: ArrayBuffer;
  createdAt: number;
}

export interface StoredFontRecord {
  id: string;
  familyName: string;
  format: 'woff2' | 'woff' | 'ttf' | 'otf';
  buffer: ArrayBuffer;
  createdAt: number;
}

interface AuroraAssetDBSchema extends DBSchema {
  assets: {
    key: string;
    value: StoredAssetRecord;
    indexes: { 'by-kind': AssetKind };
  };
  asset_metadata: {
    key: string;
    value: AssetMetadata;
    indexes: { 'by-kind': AssetKind };
  };
  fonts: {
    key: string;
    value: StoredFontRecord;
  };
}

export type AssetStorageErrorCode = 'NOT_FOUND' | 'INVALID_INPUT' | 'QUOTA_EXCEEDED' | 'DB_ERROR';

export class AssetStorageError extends Error {
  readonly code: AssetStorageErrorCode;

  constructor(code: AssetStorageErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'AssetStorageError';
    this.code = code;
  }
}

function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const errObj = error as { name?: unknown; message?: unknown; code?: unknown };
  if (errObj.name === 'QuotaExceededError' || errObj.code === 22) return true;
  if (typeof errObj.message === 'string' && /quota/i.test(errObj.message)) return true;
  return false;
}

export interface AddAssetInput {
  id: string;
  kind: AssetKind;
  name: string;
  mimeType: string;
  blob: Blob;
  width?: number;
  height?: number;
  sha256?: string;
}

export interface AssetWithMetadata {
  blob: Blob;
  metadata: AssetMetadata;
}

async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('FileReader did not produce an ArrayBuffer.'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read Blob.'));
    reader.readAsArrayBuffer(blob);
  });
}

export class AssetDatabaseService {
  private dbPromise: Promise<IDBPDatabase<AuroraAssetDBSchema>> | null = null;
  private readonly dbName: string;

  constructor(dbName = ASSET_DB_NAME) {
    this.dbName = dbName;
  }

  async initAssetDb(): Promise<IDBPDatabase<AuroraAssetDBSchema>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<AuroraAssetDBSchema>(this.dbName, ASSET_DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('assets')) {
            const assetsStore = db.createObjectStore('assets', { keyPath: 'id' });
            assetsStore.createIndex('by-kind', 'kind');
          }
          if (!db.objectStoreNames.contains('asset_metadata')) {
            const metadataStore = db.createObjectStore('asset_metadata', { keyPath: 'id' });
            metadataStore.createIndex('by-kind', 'kind');
          }
          if (!db.objectStoreNames.contains('fonts')) {
            db.createObjectStore('fonts', { keyPath: 'id' });
          }
        },
        blocked() {
          console.warn('[DECKORA AssetDB] Database upgrade blocked by another open tab.');
        },
        blocking() {
          console.warn('[DECKORA AssetDB] Closing outdated database connection.');
        },
      }).catch((error: unknown) => {
        this.dbPromise = null;
        throw new AssetStorageError('DB_ERROR', 'Failed to initialize IndexedDB.', error);
      });
    }
    return this.dbPromise;
  }

  async addAsset(input: AddAssetInput): Promise<AssetMetadata> {
    if (!input.id.trim()) {
      throw new AssetStorageError('INVALID_INPUT', 'Asset id must not be empty.');
    }
    if (!(input.blob instanceof Blob) || input.blob.size === 0) {
      throw new AssetStorageError('INVALID_INPUT', 'Asset blob must be a non-empty Blob.');
    }

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const metadata: AssetMetadata = {
      id: input.id,
      kind: input.kind,
      name: input.name,
      mimeType: input.mimeType,
      byteSize: input.blob.size,
      width: input.width,
      height: input.height,
      createdAt: nowIso,
      updatedAt: nowIso,
      sha256: input.sha256,
    };

    try {
      const bytes = await blobToArrayBuffer(input.blob);
      const db = await this.initAssetDb();
      const tx = db.transaction(['assets', 'asset_metadata'], 'readwrite');
      await Promise.all([
        tx.objectStore('assets').put({
          id: input.id,
          kind: input.kind,
          mimeType: input.mimeType,
          bytes,
          createdAt: nowMs,
        }),
        tx.objectStore('asset_metadata').put(metadata),
        tx.done,
      ]);
      return metadata;
    } catch (error) {
      if (error instanceof AssetStorageError) throw error;
      if (isQuotaExceededError(error)) {
        throw new AssetStorageError(
          'QUOTA_EXCEEDED',
          'Browser IndexedDB storage quota exceeded while saving media. Delete unused images or GIFs and try again.',
          error,
        );
      }
      throw new AssetStorageError('DB_ERROR', `Failed to store asset "${input.id}".`, error);
    }
  }

  async readAsset(id: string): Promise<AssetWithMetadata | null> {
    try {
      const db = await this.initAssetDb();
      const tx = db.transaction(['assets', 'asset_metadata'], 'readonly');
      const [assetRecord, metadata] = await Promise.all([
        tx.objectStore('assets').get(id),
        tx.objectStore('asset_metadata').get(id),
      ]);
      await tx.done;

      if (!assetRecord || !metadata) {
        return null;
      }

      const blob = new Blob([assetRecord.bytes], { type: assetRecord.mimeType });
      return { blob, metadata };
    } catch (error) {
      if (error instanceof AssetStorageError) throw error;
      throw new AssetStorageError('DB_ERROR', `Failed to read asset "${id}".`, error);
    }
  }

  async updateAssetMetadata(
    id: string,
    patch: Partial<Pick<AssetMetadata, 'name' | 'width' | 'height'>>,
  ): Promise<AssetMetadata> {
    try {
      const db = await this.initAssetDb();
      const tx = db.transaction('asset_metadata', 'readwrite');
      const store = tx.objectStore('asset_metadata');
      const existing = await store.get(id);
      if (!existing) {
        throw new AssetStorageError('NOT_FOUND', `Asset metadata "${id}" does not exist.`);
      }

      const updated: AssetMetadata = {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      await store.put(updated);
      await tx.done;
      return updated;
    } catch (error) {
      if (error instanceof AssetStorageError) throw error;
      throw new AssetStorageError(
        'DB_ERROR',
        `Failed to update metadata for asset "${id}".`,
        error,
      );
    }
  }

  async deleteAsset(id: string): Promise<void> {
    try {
      const db = await this.initAssetDb();
      const tx = db.transaction(['assets', 'asset_metadata', 'fonts'], 'readwrite');
      await Promise.all([
        tx.objectStore('assets').delete(id),
        tx.objectStore('asset_metadata').delete(id),
        tx.objectStore('fonts').delete(id),
        tx.done,
      ]);
    } catch (error) {
      if (error instanceof AssetStorageError) throw error;
      throw new AssetStorageError('DB_ERROR', `Failed to delete asset "${id}".`, error);
    }
  }

  async listAssets(kind?: AssetKind): Promise<AssetMetadata[]> {
    try {
      const db = await this.initAssetDb();
      if (kind) {
        return await db.getAllFromIndex('asset_metadata', 'by-kind', kind);
      }
      return await db.getAll('asset_metadata');
    } catch (error) {
      if (error instanceof AssetStorageError) throw error;
      throw new AssetStorageError('DB_ERROR', 'Failed to list stored assets.', error);
    }
  }

  async addFont(record: StoredFontRecord): Promise<void> {
    if (!record.id.trim() || record.buffer.byteLength === 0) {
      throw new AssetStorageError(
        'INVALID_INPUT',
        'Font record requires valid id and non-empty buffer.',
      );
    }
    try {
      const db = await this.initAssetDb();
      await db.put('fonts', record);
    } catch (error) {
      if (error instanceof AssetStorageError) throw error;
      if (isQuotaExceededError(error)) {
        throw new AssetStorageError(
          'QUOTA_EXCEEDED',
          `Browser IndexedDB storage quota exceeded while saving font "${record.familyName}".`,
          error,
        );
      }
      throw new AssetStorageError(
        'DB_ERROR',
        `Failed to store font "${record.familyName}".`,
        error,
      );
    }
  }

  async readFont(id: string): Promise<StoredFontRecord | null> {
    try {
      const db = await this.initAssetDb();
      return (await db.get('fonts', id)) ?? null;
    } catch (error) {
      throw new AssetStorageError('DB_ERROR', `Failed to read font "${id}".`, error);
    }
  }

  async closeConnection(): Promise<void> {
    if (this.dbPromise) {
      const db = await this.dbPromise;
      db.close();
      this.dbPromise = null;
    }
  }
}

export const assetDb = new AssetDatabaseService();
