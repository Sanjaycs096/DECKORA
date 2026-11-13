import { generateStableId } from '@/features/editor/layoutOps';
import type {
  AssetMetadata,
  CanvasLayout,
  CustomFontRecord,
  PersistedWorkspaceState,
  ThemeConfig,
  WorkspaceProfile,
} from '@/types/workspace';
import { assetDb, type AssetDatabaseService } from './assetDb';
import { invalidateCachedAssetUrl } from './assetUrlManager';
import {
  loadCustomFontIntoDocument,
  validateFontFile,
  validateMediaFile,
  type ValidatedMediaFile,
} from './mediaValidation';

function collectLayoutAssetIds(layout: CanvasLayout, bucket: Set<string>): void {
  for (const element of Object.values(layout.elements)) {
    const assetId = element.props.assetId;
    if (typeof assetId === 'string' && assetId.length > 0) {
      bucket.add(assetId);
    }
    const fontAssetId = element.props.uploadedFontAssetId;
    if (typeof fontAssetId === 'string' && fontAssetId.length > 0) {
      bucket.add(fontAssetId);
    }
  }
}

export function collectThemeAssetIds(theme: ThemeConfig, bucket: Set<string>): void {
  if (theme.wallpaper.type === 'image' && theme.wallpaper.assetId) {
    bucket.add(theme.wallpaper.assetId);
  }
}

export function collectProfileAssetIds(
  profile: WorkspaceProfile,
  bucket: Set<string> = new Set<string>(),
): Set<string> {
  collectThemeAssetIds(profile.theme, bucket);
  if (profile.navigation.profileAvatarAssetId) {
    bucket.add(profile.navigation.profileAvatarAssetId);
  }
  collectLayoutAssetIds(profile.layout, bucket);
  return bucket;
}

/**
 * Mark phase across ALL workspace profiles (plus optional unsaved drafts)
 * so shared assets across profiles or duplicated elements are never prematurely purged.
 */
export function collectReferencedAssetIds(
  workspace: PersistedWorkspaceState,
  draftOverlay?: {
    layout?: CanvasLayout | null;
    theme?: ThemeConfig | null;
    pendingFontIds?: string[];
  },
): Set<string> {
  const refs = new Set<string>();

  for (const profile of Object.values(workspace.profiles)) {
    collectProfileAssetIds(profile, refs);
  }

  for (const fontRecord of workspace.globalSettings.customFonts) {
    if (fontRecord.assetId) {
      refs.add(fontRecord.assetId);
    }
  }

  if (draftOverlay?.layout) {
    collectLayoutAssetIds(draftOverlay.layout, refs);
  }
  if (draftOverlay?.theme) {
    collectThemeAssetIds(draftOverlay.theme, refs);
  }
  if (draftOverlay?.pendingFontIds) {
    for (const fid of draftOverlay.pendingFontIds) {
      if (fid) refs.add(fid);
    }
  }

  return refs;
}

export async function ingestMediaFileToDb(
  file: File | Blob,
  kind: 'wallpaper' | 'image' | 'gif',
  options?: {
    fileName?: string;
    db?: AssetDatabaseService;
  },
): Promise<{ metadata: AssetMetadata; validated: ValidatedMediaFile }> {
  const db = options?.db ?? assetDb;
  const validated = await validateMediaFile(file, kind, options?.fileName);
  const assetId = generateStableId(`asset-${kind}`);

  const metadata = await db.addAsset({
    id: assetId,
    kind,
    name: validated.fileName,
    mimeType: validated.mimeType,
    blob: validated.blob,
    width: validated.width,
    height: validated.height,
    sha256: validated.sha256,
  });

  return { metadata, validated };
}

export async function ingestFontFileToDb(
  file: File | Blob,
  options?: {
    fileName?: string;
    db?: AssetDatabaseService;
  },
): Promise<{
  metadata: AssetMetadata;
  fontRecord: CustomFontRecord;
  displayName: string;
}> {
  const db = options?.db ?? assetDb;
  const validated = await validateFontFile(file, options?.fileName);
  const assetId = generateStableId('asset-font');
  const nowIso = new Date().toISOString();

  // Verify browser can parse font before committing binary metadata where supported
  await loadCustomFontIntoDocument(validated.familyName, validated.buffer);

  await db.addFont({
    id: assetId,
    familyName: validated.familyName,
    format: validated.format,
    buffer: validated.buffer,
    createdAt: Date.now(),
  });

  const metadata: AssetMetadata = {
    id: assetId,
    kind: 'font',
    name: validated.displayName,
    mimeType: validated.mimeType,
    byteSize: validated.byteSize,
    createdAt: nowIso,
    updatedAt: nowIso,
    sha256: validated.sha256,
  };

  const fontRecord: CustomFontRecord = {
    assetId,
    familyName: validated.familyName,
    format: validated.format,
    byteSize: validated.byteSize,
    addedAt: nowIso,
  };

  return {
    metadata,
    fontRecord,
    displayName: validated.displayName,
  };
}

/**
 * Deletes only candidate asset IDs that are NOT referenced anywhere in the saved workspace
 * (and optional active draft overlay). Safe to run best-effort after commit or discard.
 */
export async function cleanupUnreferencedAssets(
  candidateAssetIds: Iterable<string>,
  savedWorkspace: PersistedWorkspaceState,
  db: AssetDatabaseService = assetDb,
): Promise<string[]> {
  const referenced = collectReferencedAssetIds(savedWorkspace);
  const deleted: string[] = [];

  for (const id of new Set(candidateAssetIds)) {
    if (!id || referenced.has(id)) continue;
    try {
      invalidateCachedAssetUrl(id);
      await db.deleteAsset(id);
      deleted.push(id);
    } catch (error) {
      console.warn(`[DECKORA GC] Failed deleting unreferenced asset "${id}":`, error);
    }
  }

  return deleted;
}

export async function verifySpecificAssetIdsExist(
  assetIds: Iterable<string>,
  db: AssetDatabaseService = assetDb,
): Promise<{ valid: boolean; missingAssetIds: string[] }> {
  const uniqueIds = Array.from(new Set(assetIds)).filter(Boolean);
  if (uniqueIds.length === 0) {
    return { valid: true, missingAssetIds: [] };
  }

  const missingAssetIds: string[] = [];
  for (const assetId of uniqueIds) {
    const asset = await db.readAsset(assetId);
    if (asset) continue;
    const font = await db.readFont(assetId);
    if (font) continue;
    missingAssetIds.push(assetId);
  }

  return {
    valid: missingAssetIds.length === 0,
    missingAssetIds,
  };
}

/**
 * Verifies every assetId referenced inside a layout or wallpaper actually exists in IndexedDB
 * before allowing a commit to persist dangling IDs.
 */
export async function verifyDraftAssetsExist(
  layout: CanvasLayout,
  theme: ThemeConfig,
  db: AssetDatabaseService = assetDb,
): Promise<{ valid: boolean; missingAssetIds: string[] }> {
  const needed = new Set<string>();
  collectLayoutAssetIds(layout, needed);
  collectThemeAssetIds(theme, needed);
  return verifySpecificAssetIdsExist(needed, db);
}
