import { reconcileSpeedAlarm } from '@/background/speedScheduler';
import { generateStableId, validateLayoutIntegrity } from '@/features/editor/layoutOps';
import { cloneProfileWithFreshIds } from '@/features/profiles/profilePresets';
import { assetDb, AssetStorageError, type AssetDatabaseService } from '@/services/assets/assetDb';
import {
  cleanupUnreferencedAssets,
  collectProfileAssetIds,
  collectReferencedAssetIds,
} from '@/services/assets/assetLifecycle';
import {
  loadCustomFontIntoDocument,
  MediaValidationError,
  validateFontFile,
  validateMediaFile,
} from '@/services/assets/mediaValidation';
import {
  chromeStorageService,
  type ChromeStorageService,
} from '@/services/storage/chromeStorageService';
import { validateAndMigrateWorkspace } from '@/services/storage/schemas';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useThemeStore } from '@/state/themeStore';
import { useWorkspaceStore } from '@/state/workspaceStore';
import type {
  AssetMetadata,
  CustomFontRecord,
  PersistedWorkspaceState,
  WorkspaceProfile,
} from '@/types/workspace';
import { sanitizeHttpUrl } from '@/utils/url';
import {
  auroraBundleManifestSchema,
  computeBinarySha256,
  findUnsafeSerializedStrings,
  MAX_BUNDLE_ARCHIVE_BYTES,
  MAX_BUNDLE_UNCOMPRESSED_BYTES,
  readBlobArrayBuffer,
  type AuroraBundleManifest,
  type BundleAssetManifestEntry,
} from './bundleFormat';
import { readZipArchive, ZipArchiveError } from './zipArchive';

export type ImportMode = 'import-as-new' | 'replace-profile' | 'restore-all';

export class BundleImportError extends Error {
  readonly code:
    | 'INVALID_FILE'
    | 'SIZE_EXCEEDED'
    | 'INVALID_MANIFEST'
    | 'INVALID_WORKSPACE'
    | 'SECURITY_VIOLATION'
    | 'MISSING_ASSET'
    | 'CORRUPT_ASSET'
    | 'QUOTA_EXCEEDED'
    | 'COMMIT_FAILED';

  constructor(code: BundleImportError['code'], message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'BundleImportError';
    this.code = code;
  }
}

export interface ValidatedImportAssetPayload {
  manifestEntry: BundleAssetManifestEntry;
  bytes: Uint8Array;
  blob: Blob;
  fontRecord?: CustomFontRecord;
}

export interface ValidatedImportBundle {
  manifest: AuroraBundleManifest;
  workspace: PersistedWorkspaceState;
  assetPayloads: Record<string, ValidatedImportAssetPayload>;
  summary: {
    profileCount: number;
    profileNames: string[];
    assetCount: number;
    totalAssetBytes: number;
    sourceSchemaVersion: number;
    migratedFromLegacy: boolean;
  };
}

function validateProfileUrlsStrict(profile: WorkspaceProfile): void {
  for (const bm of profile.navigation.curatedBookmarks) {
    if (!sanitizeHttpUrl(bm.url)) {
      throw new BundleImportError(
        'SECURITY_VIOLATION',
        `Bookmark "${bm.title}" in profile "${profile.name}" contains a disallowed URL scheme.`,
      );
    }
  }

  for (const el of Object.values(profile.layout.elements)) {
    if (el.type === 'shortcuts' && Array.isArray(el.props.items)) {
      for (const rawItem of el.props.items) {
        if (rawItem && typeof rawItem === 'object') {
          const rec = rawItem as Record<string, unknown>;
          const url = typeof rec.url === 'string' ? rec.url : '';
          if (!sanitizeHttpUrl(url)) {
            throw new BundleImportError(
              'SECURITY_VIOLATION',
              `Shortcut in profile "${profile.name}" contains an unsafe URL scheme.`,
            );
          }
        }
      }
    }
    if (el.type === 'search' && typeof el.props.customEngineTemplate === 'string') {
      const tpl = el.props.customEngineTemplate.trim();
      if (
        tpl &&
        (!tpl.includes('{query}') || !sanitizeHttpUrl(tpl.replaceAll('{query}', 'test')))
      ) {
        throw new BundleImportError(
          'SECURITY_VIOLATION',
          `Custom search template in profile "${profile.name}" contains a disallowed URL scheme.`,
        );
      }
    }
  }
}

function remapImportedProfileAssets(
  profile: WorkspaceProfile,
  assetIdMap: Map<string, string>,
): WorkspaceProfile {
  const next = cloneProfileWithFreshIds(profile, {
    newId: profile.id,
    newName: profile.name,
    nowIso: new Date().toISOString(),
  });

  if (next.theme.wallpaper.type === 'image' && next.theme.wallpaper.assetId) {
    const mapped = assetIdMap.get(next.theme.wallpaper.assetId);
    if (mapped) {
      next.theme.wallpaper.assetId = mapped;
    }
  }

  if (next.navigation.profileAvatarAssetId) {
    const mapped = assetIdMap.get(next.navigation.profileAvatarAssetId);
    if (mapped) {
      next.navigation.profileAvatarAssetId = mapped;
    }
  }

  for (const element of Object.values(next.layout.elements)) {
    if (typeof element.props.assetId === 'string') {
      const mapped = assetIdMap.get(element.props.assetId);
      if (mapped) {
        element.props.assetId = mapped;
      }
    }
    if (typeof element.props.uploadedFontAssetId === 'string') {
      const mapped = assetIdMap.get(element.props.uploadedFontAssetId);
      if (mapped) {
        element.props.uploadedFontAssetId = mapped;
      }
    }
  }

  return next;
}

export async function inspectAndValidateBundle(file: File | Blob): Promise<ValidatedImportBundle> {
  if (!(file instanceof Blob) || file.size === 0) {
    throw new BundleImportError('INVALID_FILE', 'Selected backup file is empty.');
  }
  if (file.size > MAX_BUNDLE_ARCHIVE_BYTES) {
    throw new BundleImportError(
      'SIZE_EXCEEDED',
      `Backup file exceeds the ${Math.round(MAX_BUNDLE_ARCHIVE_BYTES / (1024 * 1024))} MB limit.`,
    );
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await readBlobArrayBuffer(file);
  } catch (error) {
    throw new BundleImportError('INVALID_FILE', 'Unable to read backup file bytes.', error);
  }

  let entries;
  try {
    entries = await readZipArchive(buffer, {
      maxArchiveBytes: MAX_BUNDLE_ARCHIVE_BYTES,
      maxTotalUncompressedBytes: MAX_BUNDLE_UNCOMPRESSED_BYTES,
    });
  } catch (error) {
    if (error instanceof ZipArchiveError) {
      if (error.code === 'UNSAFE_PATH') {
        throw new BundleImportError('SECURITY_VIOLATION', error.message, error);
      }
      if (error.code === 'SIZE_LIMIT_EXCEEDED') {
        throw new BundleImportError('SIZE_EXCEEDED', error.message, error);
      }
      throw new BundleImportError('INVALID_FILE', error.message, error);
    }
    throw new BundleImportError('INVALID_FILE', 'Failed to parse backup archive.', error);
  }

  const entryMap = new Map<string, Uint8Array>();
  for (const entry of entries) {
    if (
      entry.path !== 'manifest.json' &&
      entry.path !== 'workspace.json' &&
      !entry.path.startsWith('assets/')
    ) {
      throw new BundleImportError(
        'SECURITY_VIOLATION',
        `Unexpected archive entry "${entry.path}" rejected.`,
      );
    }
    entryMap.set(entry.path, entry.data);
  }

  const manifestBytes = entryMap.get('manifest.json');
  const workspaceBytes = entryMap.get('workspace.json');
  if (!manifestBytes || !workspaceBytes) {
    throw new BundleImportError(
      'INVALID_MANIFEST',
      'Backup archive is missing required manifest.json or workspace.json.',
    );
  }

  const decoder = new TextDecoder('utf-8', { fatal: true });
  let rawManifest: unknown;
  let rawWorkspace: unknown;
  try {
    rawManifest = JSON.parse(decoder.decode(manifestBytes)) as unknown;
    rawWorkspace = JSON.parse(decoder.decode(workspaceBytes)) as unknown;
  } catch (error) {
    throw new BundleImportError(
      'INVALID_MANIFEST',
      'Backup JSON metadata is malformed and cannot be parsed.',
      error,
    );
  }

  const unsafeManifestReason = findUnsafeSerializedStrings(rawManifest, 'manifest');
  if (unsafeManifestReason) {
    throw new BundleImportError(
      'SECURITY_VIOLATION',
      `Rejected unsafe manifest payload: ${unsafeManifestReason}`,
    );
  }

  const parsedManifest = auroraBundleManifestSchema.safeParse(rawManifest);
  if (!parsedManifest.success) {
    throw new BundleImportError(
      'INVALID_MANIFEST',
      `Invalid bundle manifest: ${parsedManifest.error.issues[0]?.message ?? 'unknown field error'}`,
    );
  }
  const manifest = parsedManifest.data;

  const unsafeReason = findUnsafeSerializedStrings(rawWorkspace, 'workspace');
  if (unsafeReason) {
    throw new BundleImportError('SECURITY_VIOLATION', `Rejected unsafe payload: ${unsafeReason}`);
  }

  const sourceSchemaVersion =
    rawWorkspace && typeof rawWorkspace === 'object' && 'schemaVersion' in rawWorkspace
      ? Number((rawWorkspace as { schemaVersion?: unknown }).schemaVersion ?? 0)
      : 0;

  const migratedResult = validateAndMigrateWorkspace(rawWorkspace);
  if (!migratedResult.ok) {
    throw new BundleImportError(
      'INVALID_WORKSPACE',
      `Backup workspace schema invalid: ${migratedResult.error}`,
    );
  }

  const importedWorkspace = {
    ...migratedResult.state,
    speedCache: null,
  };

  for (const [profileId, profile] of Object.entries(importedWorkspace.profiles)) {
    const integrity = validateLayoutIntegrity(profile.layout);
    if (!integrity.valid) {
      throw new BundleImportError(
        'INVALID_WORKSPACE',
        `Layout integrity failed in profile "${profileId}": ${integrity.errors[0] ?? 'corrupted layout'}`,
      );
    }
    validateProfileUrlsStrict(profile);
  }

  const manifestAssetById = new Map<string, BundleAssetManifestEntry>();
  for (const assetEntry of manifest.assets) {
    if (manifestAssetById.has(assetEntry.id)) {
      throw new BundleImportError(
        'INVALID_MANIFEST',
        `Duplicate manifest asset id "${assetEntry.id}".`,
      );
    }
    manifestAssetById.set(assetEntry.id, assetEntry);
  }

  const referencedAssetIds = Array.from(collectReferencedAssetIds(importedWorkspace));
  const assetPayloads: Record<string, ValidatedImportAssetPayload> = {};
  const fontRecordById = new Map(
    importedWorkspace.globalSettings.customFonts.map((f) => [f.assetId, f]),
  );

  for (const assetId of referencedAssetIds) {
    const manifestEntry = manifestAssetById.get(assetId);
    if (!manifestEntry) {
      throw new BundleImportError(
        'MISSING_ASSET',
        `Referenced asset "${assetId}" is missing from bundle manifest.`,
      );
    }

    const assetBytes = entryMap.get(manifestEntry.archivePath);
    if (!assetBytes) {
      throw new BundleImportError(
        'MISSING_ASSET',
        `Archive binary "${manifestEntry.archivePath}" for asset "${manifestEntry.name}" is missing.`,
      );
    }

    if (assetBytes.byteLength !== manifestEntry.byteSize) {
      throw new BundleImportError(
        'CORRUPT_ASSET',
        `Size mismatch for "${manifestEntry.name}" (expected ${manifestEntry.byteSize} bytes, got ${assetBytes.byteLength}).`,
      );
    }

    const actualSha = await computeBinarySha256(assetBytes);
    if (manifestEntry.sha256 && actualSha !== manifestEntry.sha256) {
      throw new BundleImportError(
        'CORRUPT_ASSET',
        `Integrity checksum mismatch (SHA-256) for "${manifestEntry.name}".`,
      );
    }

    const rawBlob = new Blob([new Uint8Array(assetBytes).buffer], {
      type: manifestEntry.mimeType,
    });

    if (manifestEntry.kind === 'font') {
      try {
        const validatedFont = await validateFontFile(rawBlob, manifestEntry.name);
        const existingFontRecord = fontRecordById.get(assetId);
        assetPayloads[assetId] = {
          manifestEntry,
          bytes: assetBytes,
          blob: rawBlob,
          fontRecord: existingFontRecord ?? {
            assetId,
            familyName: manifestEntry.fontFamilyName ?? validatedFont.familyName,
            format: validatedFont.format,
            byteSize: validatedFont.byteSize,
            addedAt: new Date().toISOString(),
          },
        };
      } catch (error) {
        throw new BundleImportError(
          error instanceof MediaValidationError ? 'SECURITY_VIOLATION' : 'CORRUPT_ASSET',
          error instanceof Error
            ? `Rejected font asset "${manifestEntry.name}": ${error.message}`
            : `Invalid font asset "${manifestEntry.name}".`,
          error,
        );
      }
    } else {
      const targetKind =
        manifestEntry.kind === 'wallpaper'
          ? 'wallpaper'
          : manifestEntry.kind === 'gif'
            ? 'gif'
            : 'image';
      try {
        const validatedMedia = await validateMediaFile(rawBlob, targetKind, manifestEntry.name);
        assetPayloads[assetId] = {
          manifestEntry,
          bytes: assetBytes,
          blob: validatedMedia.blob,
        };
      } catch (error) {
        throw new BundleImportError(
          error instanceof MediaValidationError ? 'SECURITY_VIOLATION' : 'CORRUPT_ASSET',
          error instanceof Error
            ? `Rejected media asset "${manifestEntry.name}": ${error.message}`
            : `Invalid media asset "${manifestEntry.name}".`,
          error,
        );
      }
    }
  }

  const importedProfilesList = Object.values(importedWorkspace.profiles);

  return {
    manifest,
    workspace: importedWorkspace,
    assetPayloads,
    summary: {
      profileCount: importedProfilesList.length,
      profileNames: importedProfilesList.map((p) => p.name),
      assetCount: Object.keys(assetPayloads).length,
      totalAssetBytes: Object.values(assetPayloads).reduce(
        (sum, item) => sum + item.bytes.byteLength,
        0,
      ),
      sourceSchemaVersion,
      migratedFromLegacy: migratedResult.migrated,
    },
  };
}

export interface ExecuteImportOptions {
  mode: ImportMode;
  targetProfileId?: string;
  currentWorkspace?: PersistedWorkspaceState;
  storageService?: ChromeStorageService;
  db?: AssetDatabaseService;
  syncStores?: boolean;
}

export interface ExecuteImportResult {
  savedWorkspace: PersistedWorkspaceState;
  importedProfileIds: string[];
  stagedAssetIds: string[];
  purgedAssetIds: string[];
}

export async function executeTransactionalImport(
  bundle: ValidatedImportBundle,
  options: ExecuteImportOptions,
): Promise<ExecuteImportResult> {
  const storage = options.storageService ?? chromeStorageService;
  const db = options.db ?? assetDb;
  const baseWorkspace = structuredClone(
    options.currentWorkspace ?? useWorkspaceStore.getState().workspace,
  );
  const shouldSyncStores = options.syncStores !== false;

  const incomingProfiles = Object.values(bundle.workspace.profiles);
  if (incomingProfiles.length === 0) {
    throw new BundleImportError('INVALID_WORKSPACE', 'Backup contains zero profiles to import.');
  }

  // Check estimated quota headroom proactively when available
  if (
    typeof navigator !== 'undefined' &&
    navigator.storage &&
    typeof navigator.storage.estimate === 'function'
  ) {
    try {
      const estimate = await navigator.storage.estimate();
      if (
        typeof estimate.quota === 'number' &&
        typeof estimate.usage === 'number' &&
        estimate.quota - estimate.usage < bundle.summary.totalAssetBytes
      ) {
        throw new BundleImportError(
          'QUOTA_EXCEEDED',
          'Insufficient browser storage quota available for all imported media assets.',
        );
      }
    } catch (error) {
      if (error instanceof BundleImportError) throw error;
    }
  }

  // Map every imported asset ID -> fresh collision-free ID so rollback never overwrites live assets
  const assetIdMap = new Map<string, string>();
  const stagedAssetIds: string[] = [];
  const nextAssetMetadataMap: Record<string, AssetMetadata> = {};
  const nextFontRecords: CustomFontRecord[] = [];

  try {
    for (const [oldAssetId, payload] of Object.entries(bundle.assetPayloads)) {
      const freshAssetId = generateStableId(`asset-${payload.manifestEntry.kind}`);
      assetIdMap.set(oldAssetId, freshAssetId);

      if (payload.manifestEntry.kind === 'font') {
        const fontRec = payload.fontRecord!;
        const format = fontRec.format === 'woff' ? 'woff' : 'woff2';
        const buffer = new Uint8Array(payload.bytes).buffer;
        await db.addFont({
          id: freshAssetId,
          familyName: fontRec.familyName,
          format,
          buffer,
          createdAt: Date.now(),
        });
        stagedAssetIds.push(freshAssetId);

        const nowIso = new Date().toISOString();
        nextFontRecords.push({
          ...fontRec,
          assetId: freshAssetId,
        });
        nextAssetMetadataMap[freshAssetId] = {
          ...payload.manifestEntry,
          id: freshAssetId,
          updatedAt: nowIso,
        };
        await loadCustomFontIntoDocument(fontRec.familyName, buffer).catch(() => false);
      } else {
        const storedMeta = await db.addAsset({
          id: freshAssetId,
          kind: payload.manifestEntry.kind,
          name: payload.manifestEntry.name,
          mimeType: payload.manifestEntry.mimeType,
          blob: payload.blob,
          width: payload.manifestEntry.width,
          height: payload.manifestEntry.height,
          sha256: payload.manifestEntry.sha256,
        });
        stagedAssetIds.push(freshAssetId);
        nextAssetMetadataMap[freshAssetId] = storedMeta;
      }
    }

    const nowIso = new Date().toISOString();
    const candidateOrphanIds = new Set<string>();
    const importedProfileIds: string[] = [];
    let nextWorkspace: PersistedWorkspaceState;

    if (options.mode === 'restore-all') {
      for (const oldId of collectReferencedAssetIds(baseWorkspace)) {
        candidateOrphanIds.add(oldId);
      }

      const rebuiltProfiles: Record<string, WorkspaceProfile> = {};
      for (const rawProf of incomingProfiles) {
        const remapped = remapImportedProfileAssets(rawProf, assetIdMap);
        rebuiltProfiles[remapped.id] = {
          ...remapped,
          updatedAt: nowIso,
        };
        importedProfileIds.push(remapped.id);
      }

      const activeId = rebuiltProfiles[bundle.workspace.activeProfileId]
        ? bundle.workspace.activeProfileId
        : importedProfileIds[0]!;

      nextWorkspace = {
        schemaVersion: bundle.workspace.schemaVersion,
        revision: baseWorkspace.revision + 1,
        updatedAt: nowIso,
        activeProfileId: activeId,
        profiles: rebuiltProfiles,
        globalSettings: {
          ...structuredClone(bundle.workspace.globalSettings),
          customFonts: nextFontRecords,
        },
        assetRegistry: nextAssetMetadataMap,
        speedCache: null,
      };
    } else if (options.mode === 'replace-profile') {
      const targetId = options.targetProfileId ?? baseWorkspace.activeProfileId;
      const existingTarget = baseWorkspace.profiles[targetId];
      if (!existingTarget) {
        throw new BundleImportError(
          'INVALID_WORKSPACE',
          `Target profile "${targetId}" no longer exists.`,
        );
      }
      for (const oldId of collectProfileAssetIds(existingTarget)) {
        candidateOrphanIds.add(oldId);
      }

      const sourceIncoming =
        bundle.workspace.profiles[bundle.workspace.activeProfileId] ?? incomingProfiles[0]!;
      const remapped = remapImportedProfileAssets(sourceIncoming, assetIdMap);
      const replacedProfile: WorkspaceProfile = {
        ...remapped,
        id: targetId,
        createdAt: existingTarget.createdAt,
        updatedAt: nowIso,
      };
      importedProfileIds.push(targetId);

      const mergedFontsMap = new Map<string, CustomFontRecord>();
      for (const f of baseWorkspace.globalSettings.customFonts) mergedFontsMap.set(f.assetId, f);
      for (const f of nextFontRecords) mergedFontsMap.set(f.assetId, f);

      const mergedRegistry = {
        ...baseWorkspace.assetRegistry,
        ...nextAssetMetadataMap,
      };

      const draftWorkspace: PersistedWorkspaceState = {
        ...baseWorkspace,
        revision: baseWorkspace.revision + 1,
        updatedAt: nowIso,
        profiles: {
          ...baseWorkspace.profiles,
          [targetId]: replacedProfile,
        },
        globalSettings: {
          ...baseWorkspace.globalSettings,
          customFonts: Array.from(mergedFontsMap.values()),
        },
        assetRegistry: mergedRegistry,
      };
      const referenced = collectReferencedAssetIds(draftWorkspace);
      draftWorkspace.assetRegistry = Object.fromEntries(
        Object.entries(draftWorkspace.assetRegistry).filter(([id]) => referenced.has(id)),
      );
      nextWorkspace = draftWorkspace;
    } else {
      // 'import-as-new': additive safe import with collision-free profile IDs & names
      const nextProfiles = { ...baseWorkspace.profiles };
      const existingNames = new Set(Object.values(nextProfiles).map((p) => p.name.toLowerCase()));

      for (const rawProf of incomingProfiles) {
        const remapped = remapImportedProfileAssets(rawProf, assetIdMap);
        const freshProfileId = generateStableId(`profile-${remapped.presetType}`);
        let uniqueName = remapped.name;
        if (existingNames.has(uniqueName.toLowerCase())) {
          let suffix = 1;
          let candidate = `${remapped.name} (Imported)`;
          while (existingNames.has(candidate.toLowerCase())) {
            suffix += 1;
            candidate = `${remapped.name} (Imported ${suffix})`;
          }
          uniqueName = candidate.slice(0, 60);
        }
        existingNames.add(uniqueName.toLowerCase());

        nextProfiles[freshProfileId] = {
          ...remapped,
          id: freshProfileId,
          name: uniqueName,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        importedProfileIds.push(freshProfileId);
      }

      const mergedFontsMap = new Map<string, CustomFontRecord>();
      for (const f of baseWorkspace.globalSettings.customFonts) mergedFontsMap.set(f.assetId, f);
      for (const f of nextFontRecords) mergedFontsMap.set(f.assetId, f);

      nextWorkspace = {
        ...baseWorkspace,
        revision: baseWorkspace.revision + 1,
        updatedAt: nowIso,
        activeProfileId: importedProfileIds[0] ?? baseWorkspace.activeProfileId,
        profiles: nextProfiles,
        globalSettings: {
          ...baseWorkspace.globalSettings,
          customFonts: Array.from(mergedFontsMap.values()),
        },
        assetRegistry: {
          ...baseWorkspace.assetRegistry,
          ...nextAssetMetadataMap,
        },
      };
    }

    const saved = await storage.writeWorkspace(nextWorkspace);

    if (shouldSyncStores) {
      useWorkspaceStore.setState((draft) => {
        draft.workspace = saved;
        draft.status = 'ready';
        draft.errorMessage = null;
      });
      const activeProfile = saved.profiles[saved.activeProfileId];
      if (activeProfile) {
        useThemeStore.getState().syncFromThemeConfig(activeProfile.theme);
      }
      usePreferencesStore.getState().hydratePreferences(saved.globalSettings);
      void reconcileSpeedAlarm(saved);
    }

    const purgedAssetIds =
      candidateOrphanIds.size > 0
        ? await cleanupUnreferencedAssets(candidateOrphanIds, saved, db)
        : [];

    return {
      savedWorkspace: saved,
      importedProfileIds,
      stagedAssetIds,
      purgedAssetIds,
    };
  } catch (error) {
    // Full transactional rollback of all newly staged IndexedDB assets on any failure
    for (const stagedId of stagedAssetIds) {
      await db.deleteAsset(stagedId).catch(() => {});
    }

    if (error instanceof BundleImportError) {
      throw error;
    }
    if (error instanceof AssetStorageError && error.code === 'QUOTA_EXCEEDED') {
      throw new BundleImportError('QUOTA_EXCEEDED', error.message, error);
    }
    throw new BundleImportError(
      'COMMIT_FAILED',
      error instanceof Error ? error.message : 'Failed to commit imported workspace.',
      error,
    );
  }
}
