import { assetDb, type AssetDatabaseService } from '@/services/assets/assetDb';
import {
  collectProfileAssetIds,
  collectReferencedAssetIds,
} from '@/services/assets/assetLifecycle';
import type { AssetMetadata, PersistedWorkspaceState, WorkspaceProfile } from '@/types/workspace';
import {
  DECKORA_BUNDLE_EXTENSION,
  DECKORA_BUNDLE_FORMAT,
  DECKORA_BUNDLE_FORMAT_VERSION,
  computeBinarySha256,
  extensionForAsset,
  findUnsafeSerializedStrings,
  readBlobArrayBuffer,
  sanitizeArchiveFileBaseName,
  type BundleAssetManifestEntry,
  type BundleExportScope,
  type DeckoraBundleManifest,
} from './bundleFormat';
import { readZipArchive, writeZipArchive, type ZipWriteEntry } from './zipArchive';

export type ExportStage =
  'collecting-refs' | 'reading-assets' | 'packaging' | 'verifying' | 'complete';

export interface ExportProgress {
  stage: ExportStage;
  percent: number;
  message: string;
}

export interface ExportBundleOptions {
  scope: BundleExportScope;
  profileId?: string;
  db?: AssetDatabaseService;
  signal?: AbortSignal;
  onProgress?: (progress: ExportProgress) => void;
}

export interface ExportBundleResult {
  blob: Blob;
  fileName: string;
  byteSize: number;
  manifest: DeckoraBundleManifest;
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Export cancelled by user.', 'AbortError');
  }
}

function sanitizeWorkspaceForExport(
  workspace: PersistedWorkspaceState,
  scope: BundleExportScope,
  targetProfileId?: string,
): {
  sanitizedWorkspace: PersistedWorkspaceState;
  referencedAssetIds: string[];
  targetProfiles: WorkspaceProfile[];
} {
  let profilesToExport: Record<string, WorkspaceProfile>;
  let activeProfileId: string;

  if (scope === 'single-profile') {
    const id = targetProfileId ?? workspace.activeProfileId;
    const target = workspace.profiles[id];
    if (!target) {
      throw new Error(`Cannot export missing profile "${id}".`);
    }
    profilesToExport = { [target.id]: structuredClone(target) };
    activeProfileId = target.id;
  } else {
    profilesToExport = structuredClone(workspace.profiles);
    activeProfileId = workspace.activeProfileId;
  }

  const targetProfiles = Object.values(profilesToExport);
  const directRefs = new Set<string>();
  for (const profile of targetProfiles) {
    collectProfileAssetIds(profile, directRefs);
  }

  const exportedFonts =
    scope === 'full-workspace'
      ? structuredClone(workspace.globalSettings.customFonts)
      : structuredClone(
          workspace.globalSettings.customFonts.filter((font) => directRefs.has(font.assetId)),
        );

  const partialState: PersistedWorkspaceState = {
    schemaVersion: workspace.schemaVersion,
    revision: 1,
    updatedAt: workspace.updatedAt,
    activeProfileId,
    profiles: profilesToExport,
    globalSettings: {
      ...structuredClone(workspace.globalSettings),
      customFonts: exportedFonts,
    },
    assetRegistry: {},
    // Never include transient network/speed cache snapshots in portable backups
    speedCache: null,
  };

  const allReferencedIds = Array.from(collectReferencedAssetIds(partialState));
  const filteredRegistry: Record<string, AssetMetadata> = {};
  for (const id of allReferencedIds) {
    const meta = workspace.assetRegistry[id];
    if (meta) {
      filteredRegistry[id] = structuredClone(meta);
    }
  }
  partialState.assetRegistry = filteredRegistry;

  const unsafeReason = findUnsafeSerializedStrings(partialState);
  if (unsafeReason) {
    throw new Error(`Export safety check failed: ${unsafeReason}`);
  }

  return {
    sanitizedWorkspace: partialState,
    referencedAssetIds: allReferencedIds,
    targetProfiles,
  };
}

export async function exportWorkspaceBundle(
  workspace: PersistedWorkspaceState,
  options: ExportBundleOptions,
): Promise<ExportBundleResult> {
  const db = options.db ?? assetDb;
  const report = (stage: ExportStage, percent: number, message: string) => {
    options.onProgress?.({ stage, percent, message });
  };

  assertNotAborted(options.signal);
  report('collecting-refs', 10, 'Collecting profile configuration and asset references...');

  const { sanitizedWorkspace, referencedAssetIds, targetProfiles } = sanitizeWorkspaceForExport(
    workspace,
    options.scope,
    options.profileId,
  );

  const fontRecordMap = new Map(
    sanitizedWorkspace.globalSettings.customFonts.map((f) => [f.assetId, f]),
  );

  const zipEntries: ZipWriteEntry[] = [];
  const manifestAssets: BundleAssetManifestEntry[] = [];
  let totalAssetBytes = 0;

  for (let idx = 0; idx < referencedAssetIds.length; idx += 1) {
    assertNotAborted(options.signal);
    const assetId = referencedAssetIds[idx]!;
    const pct = 15 + Math.round(((idx + 1) / Math.max(1, referencedAssetIds.length)) * 50);
    report(
      'reading-assets',
      pct,
      `Reading local asset ${idx + 1} of ${referencedAssetIds.length}...`,
    );

    const fontRecord = fontRecordMap.get(assetId);
    const storedAsset = await db.readAsset(assetId);

    if (storedAsset) {
      const arrayBuf = await readBlobArrayBuffer(storedAsset.blob);
      const bytes = new Uint8Array(arrayBuf);
      const sha256 = await computeBinarySha256(bytes);
      const ext = extensionForAsset(
        storedAsset.metadata.mimeType,
        storedAsset.metadata.kind,
        fontRecord?.format,
      );
      const safeIdSlug = assetId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const archivePath = `assets/${safeIdSlug}.${ext}`;

      sanitizedWorkspace.assetRegistry[assetId] = {
        ...storedAsset.metadata,
        byteSize: bytes.byteLength,
        sha256,
      };

      manifestAssets.push({
        ...storedAsset.metadata,
        byteSize: bytes.byteLength,
        sha256,
        archivePath,
      });
      zipEntries.push({
        path: archivePath,
        data: bytes,
        compress: false,
      });
      totalAssetBytes += bytes.byteLength;
      continue;
    }

    const storedFont = await db.readFont(assetId);
    if (storedFont) {
      const bytes = new Uint8Array(storedFont.buffer);
      const sha256 = await computeBinarySha256(bytes);
      const ext = extensionForAsset('font/woff2', 'font', storedFont.format);
      const safeIdSlug = assetId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const archivePath = `assets/${safeIdSlug}.${ext}`;
      const mimeType = storedFont.format === 'woff' ? 'font/woff' : 'font/woff2';
      const nowIso = new Date(storedFont.createdAt).toISOString();

      const existingMeta = sanitizedWorkspace.assetRegistry[assetId];
      const meta: AssetMetadata = existingMeta ?? {
        id: assetId,
        kind: 'font',
        name: storedFont.familyName,
        mimeType,
        byteSize: bytes.byteLength,
        createdAt: nowIso,
        updatedAt: nowIso,
        sha256,
      };

      sanitizedWorkspace.assetRegistry[assetId] = {
        ...meta,
        byteSize: bytes.byteLength,
        sha256,
      };

      manifestAssets.push({
        ...meta,
        byteSize: bytes.byteLength,
        archivePath,
        sha256,
        fontFamilyName: storedFont.familyName,
        fontFormat: storedFont.format,
      });
      zipEntries.push({
        path: archivePath,
        data: bytes,
        compress: false,
      });
      totalAssetBytes += bytes.byteLength;
      continue;
    }

    throw new Error(
      `Referenced asset "${assetId}" is missing from local IndexedDB storage and cannot be exported completely.`,
    );
  }

  assertNotAborted(options.signal);
  report('packaging', 75, 'Packaging Deckora workspace bundle...');

  const exportedAt = new Date().toISOString();
  const manifest: DeckoraBundleManifest = {
    format: DECKORA_BUNDLE_FORMAT,
    formatVersion: DECKORA_BUNDLE_FORMAT_VERSION,
    deckoraAppVersion: '0.1.0',
    schemaVersion: sanitizedWorkspace.schemaVersion,
    exportedAt,
    exportScope: options.scope,
    exportedProfileIds: targetProfiles.map((p) => p.id),
    exportedProfileNames: targetProfiles.map((p) => p.name),
    assetCount: manifestAssets.length,
    totalAssetBytes,
    assets: manifestAssets,
  };

  const encoder = new TextEncoder();
  const orderedEntries: ZipWriteEntry[] = [
    {
      path: 'manifest.json',
      data: encoder.encode(JSON.stringify(manifest, null, 2)),
      compress: true,
    },
    {
      path: 'workspace.json',
      data: encoder.encode(JSON.stringify(sanitizedWorkspace, null, 2)),
      compress: true,
    },
    ...zipEntries,
  ];

  const archiveBytes = await writeZipArchive(orderedEntries, { signal: options.signal });

  assertNotAborted(options.signal);
  report('verifying', 92, 'Verifying archive integrity...');

  // Post-build self-verification before delivering file to user
  const verifiedEntries = await readZipArchive(archiveBytes);
  const verifiedPaths = new Set(verifiedEntries.map((e) => e.path));
  if (!verifiedPaths.has('manifest.json') || !verifiedPaths.has('workspace.json')) {
    throw new Error('Generated archive failed self-verification check.');
  }

  const dateStamp = exportedAt.slice(0, 10);
  const namePart =
    options.scope === 'single-profile'
      ? sanitizeArchiveFileBaseName(targetProfiles[0]?.name ?? 'profile')
      : 'full-workspace';
  const fileName = `deckora-${namePart}-${dateStamp}${DECKORA_BUNDLE_EXTENSION}`;

  const blob = new Blob([new Uint8Array(archiveBytes).buffer], { type: 'application/zip' });
  report('complete', 100, 'Workspace bundle ready.');

  return {
    blob,
    fileName,
    byteSize: blob.size,
    manifest,
  };
}
