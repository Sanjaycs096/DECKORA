import type { AssetMetadata } from '@/types/workspace';
import { assetDb, type AssetDatabaseService } from './assetDb';

export interface AcquiredAssetResource {
  url: string;
  metadata: AssetMetadata;
}

interface CacheEntry {
  url: string;
  metadata: AssetMetadata;
  refCount: number;
}

const activeCache = new Map<string, CacheEntry>();
const pendingReads = new Map<string, Promise<AcquiredAssetResource | null>>();

function createBlobUrl(blob: Blob): string {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(blob);
  }
  throw new Error('URL.createObjectURL is unavailable in this environment.');
}

function revokeBlobUrl(url: string): void {
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}

export async function acquireAssetUrl(
  assetId: string,
  db: AssetDatabaseService = assetDb,
): Promise<AcquiredAssetResource | null> {
  const existing = activeCache.get(assetId);
  if (existing) {
    existing.refCount += 1;
    return { url: existing.url, metadata: existing.metadata };
  }

  let pending = pendingReads.get(assetId);
  if (!pending) {
    pending = (async () => {
      const result = await db.readAsset(assetId);
      if (!result) return null;
      const url = createBlobUrl(result.blob);
      const entry: CacheEntry = {
        url,
        metadata: result.metadata,
        refCount: 0,
      };
      activeCache.set(assetId, entry);
      return { url, metadata: result.metadata };
    })().finally(() => {
      pendingReads.delete(assetId);
    });
    pendingReads.set(assetId, pending);
  }

  const resolved = await pending;
  if (!resolved) return null;

  const entry = activeCache.get(assetId);
  if (entry) {
    entry.refCount += 1;
    return { url: entry.url, metadata: entry.metadata };
  }
  return null;
}

export function releaseAssetUrl(assetId: string): void {
  const entry = activeCache.get(assetId);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    activeCache.delete(assetId);
    revokeBlobUrl(entry.url);
  }
}

export function invalidateCachedAssetUrl(assetId: string): void {
  const entry = activeCache.get(assetId);
  if (!entry) return;
  activeCache.delete(assetId);
  revokeBlobUrl(entry.url);
}

export function getCachedAssetRefCount(assetId: string): number {
  return activeCache.get(assetId)?.refCount ?? 0;
}

export function clearAllCachedAssetUrls(): void {
  for (const entry of activeCache.values()) {
    revokeBlobUrl(entry.url);
  }
  activeCache.clear();
  pendingReads.clear();
}
