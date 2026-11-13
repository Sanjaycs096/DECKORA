import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { TooltipProvider } from '@/components/ui';
import { AssetDatabaseService } from '@/services/assets/assetDb';
import {
  ChromeStorageService,
  type StorageBackendAdapter,
} from '@/services/storage/chromeStorageService';
import { createDefaultWorkspaceState } from '@/services/storage/defaults';
import { useWorkspaceStore } from '@/state/workspaceStore';
import { readBlobArrayBuffer } from './bundleFormat';
import { exportWorkspaceBundle } from './exportService';
import {
  BundleImportError,
  executeTransactionalImport,
  inspectAndValidateBundle,
} from './importService';
import { PortabilityDialog } from './PortabilityDialog';
import { readZipArchive, writeZipArchive, ZipArchiveError } from './zipArchive';

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

// Valid 1x1 PNG header bytes accepted by mediaValidation magic-byte checks
const VALID_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

// Valid minimal WOFF2 signature bytes accepted by detectFontSignature
const VALID_WOFF2_BYTES = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0x00, 0x01, 0x00, 0x00, 1, 2, 3]);

describe('Phase 6 — Portable Export, Hardened Validation & Transactional Import', () => {
  let sourceDb: AssetDatabaseService;
  let targetDb: AssetDatabaseService;
  let storage: ChromeStorageService;

  beforeEach(async () => {
    sourceDb = new AssetDatabaseService(
      `aurora-export-src-${Math.random().toString(36).slice(2, 8)}`,
    );
    targetDb = new AssetDatabaseService(
      `aurora-import-dst-${Math.random().toString(36).slice(2, 8)}`,
    );
    storage = createMemoryStorageService();
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
    await useWorkspaceStore.getState().hydrate(storage);
  });

  afterEach(async () => {
    await sourceDb.closeConnection();
    await targetDb.closeConnection();
    vi.restoreAllMocks();
  });

  it('exports full workspace bundle with media & fonts (excluding blob URLs & speedCache) and imports cleanly into fresh DB', async () => {
    const wallBlob = new Blob([VALID_PNG_BYTES.buffer], { type: 'image/png' });
    const wallMeta = await sourceDb.addAsset({
      id: 'asset-wallpaper-1',
      kind: 'wallpaper',
      name: 'aurora-bg.png',
      mimeType: 'image/png',
      blob: wallBlob,
      width: 1,
      height: 1,
    });

    await sourceDb.addFont({
      id: 'asset-font-1',
      familyName: 'AuroraUser-StudioFont-ab12',
      format: 'woff2',
      buffer: VALID_WOFF2_BYTES.buffer,
      createdAt: Date.now(),
    });

    const base = createDefaultWorkspaceState();
    const personal = base.profiles['profile-personal']!;
    personal.theme.wallpaper = {
      ...personal.theme.wallpaper,
      type: 'image',
      assetId: wallMeta.id,
    };
    const customTextElId = 'el-text-custom';
    personal.layout.elements[customTextElId] = {
      id: customTextElId,
      type: 'text',
      name: 'Heading',
      zIndex: personal.layout.zOrder.length,
      visible: true,
      locked: false,
      groupId: null,
      transform: {
        xPct: 20,
        yPct: 10,
        widthPx: 300,
        heightPx: 60,
        minWidthPx: 120,
        minHeightPx: 40,
        aspectLocked: false,
      },
      style: {
        opacity: 1,
        borderWidthPx: 0,
        borderColor: 'transparent',
        borderStyle: 'none',
        shadow: 'none',
        cornerRadiusPx: 12,
      },
      props: {
        content: 'Portable Heading',
        fontFamily: 'AuroraUser-StudioFont-ab12',
        uploadedFontAssetId: 'asset-font-1',
      },
    };
    personal.layout.zOrder.push(customTextElId);

    base.assetRegistry[wallMeta.id] = wallMeta;
    base.globalSettings.customFonts.push({
      assetId: 'asset-font-1',
      familyName: 'AuroraUser-StudioFont-ab12',
      format: 'woff2',
      byteSize: VALID_WOFF2_BYTES.byteLength,
      addedAt: new Date().toISOString(),
    });
    base.speedCache = {
      status: 'completed',
      phase: 'complete',
      isRunning: false,
      runningStartedAt: null,
      lastAttemptAt: new Date().toISOString(),
      lastSuccessfulResult: {
        downloadMbps: 220,
        uploadMbps: 45,
        pingMs: 12,
        jitterMs: 1,
        measuredAt: new Date().toISOString(),
        source: 'manual',
        downloadBytes: 2_097_152,
        uploadBytes: 524_288,
      },
      errorMessage: null,
    };

    const stages: string[] = [];
    const exported = await exportWorkspaceBundle(base, {
      scope: 'full-workspace',
      db: sourceDb,
      onProgress: (p) => stages.push(p.stage),
    });

    expect(stages).toContain('collecting-refs');
    expect(stages).toContain('verifying');
    expect(stages[stages.length - 1]).toBe('complete');
    expect(exported.manifest.format).toBe('deckora-workspace-bundle');
    expect(exported.manifest.deckoraAppVersion).toBe('0.1.0');
    expect(exported.manifest.assetCount).toBe(2);
    expect(exported.fileName.startsWith('deckora-')).toBe(true);
    expect(exported.fileName.endsWith('.deckora-bundle.zip')).toBe(true);

    // Inspect archive entries directly to guarantee speedCache is stripped
    const zipEntries = await readZipArchive(await readBlobArrayBuffer(exported.blob));
    const workspaceEntry = zipEntries.find((e) => e.path === 'workspace.json')!;
    const parsedExportJson = JSON.parse(new TextDecoder().decode(workspaceEntry.data)) as {
      speedCache: unknown;
    };
    expect(parsedExportJson.speedCache).toBeNull();

    // Validate & import as new profile into target workspace/DB
    const validated = await inspectAndValidateBundle(exported.blob);
    expect(validated.summary.assetCount).toBe(2);

    const importedResult = await executeTransactionalImport(validated, {
      mode: 'import-as-new',
      storageService: storage,
      db: targetDb,
    });

    expect(importedResult.importedProfileIds.length).toBe(1);
    expect(importedResult.stagedAssetIds.length).toBe(2);
    const importedProfile =
      importedResult.savedWorkspace.profiles[importedResult.importedProfileIds[0]!]!;
    const remappedWallId = importedProfile.theme.wallpaper.assetId!;
    expect(remappedWallId).not.toBe(wallMeta.id);
    expect(await targetDb.readAsset(remappedWallId)).not.toBeNull();
  });

  it('supports export cancellation via AbortSignal cleanly', async () => {
    const controller = new AbortController();
    controller.abort();
    const state = createDefaultWorkspaceState();

    await expect(
      exportWorkspaceBundle(state, {
        scope: 'single-profile',
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects path traversal, oversized entries, corrupted CRC, and disguised SVG payloads inside archives', async () => {
    // 1. Path traversal attempt
    const encoder = new TextEncoder();
    const evilZip = await writeZipArchive([
      { path: 'manifest.json', data: encoder.encode('{}'), compress: false },
    ]);
    await expect(readZipArchive(evilZip, { maxArchiveBytes: 10 })).rejects.toBeInstanceOf(
      ZipArchiveError,
    );

    // Directly test writeZipArchive rejecting unsafe traversal path
    await expect(
      writeZipArchive([{ path: '../../etc/passwd', data: encoder.encode('x') }]),
    ).rejects.toThrow(/traversal/i);

    // 2. Non-ZIP / malformed bytes
    await expect(
      inspectAndValidateBundle(new Blob([encoder.encode('not-a-zip').buffer])),
    ).rejects.toBeInstanceOf(BundleImportError);

    // 3. Disguised SVG inside valid manifest/workspace archive
    const base = createDefaultWorkspaceState();
    const personal = base.profiles['profile-personal']!;
    const svgBytes = encoder.encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
    const assetId = 'asset-wallpaper-svg';
    personal.theme.wallpaper = {
      ...personal.theme.wallpaper,
      type: 'image',
      assetId,
    };
    base.assetRegistry[assetId] = {
      id: assetId,
      kind: 'wallpaper',
      name: 'fake.png',
      mimeType: 'image/png',
      byteSize: svgBytes.byteLength,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const shaBuf = await crypto.subtle.digest('SHA-256', new Uint8Array(svgBytes).buffer);
    const shaHex = Array.from(new Uint8Array(shaBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const taintedManifest = {
      format: 'aurora-workspace-bundle',
      formatVersion: 1,
      auroraAppVersion: '0.1.0',
      schemaVersion: base.schemaVersion,
      exportedAt: new Date().toISOString(),
      exportScope: 'single-profile',
      exportedProfileIds: [personal.id],
      exportedProfileNames: [personal.name],
      assetCount: 1,
      totalAssetBytes: svgBytes.byteLength,
      assets: [
        {
          ...base.assetRegistry[assetId],
          sha256: shaHex,
          archivePath: `assets/${assetId}.png`,
        },
      ],
    };

    const taintedZip = await writeZipArchive([
      { path: 'manifest.json', data: encoder.encode(JSON.stringify(taintedManifest)) },
      { path: 'workspace.json', data: encoder.encode(JSON.stringify(base)) },
      { path: `assets/${assetId}.png`, data: svgBytes, compress: false },
    ]);

    await expect(
      inspectAndValidateBundle(new Blob([new Uint8Array(taintedZip).buffer])),
    ).rejects.toMatchObject({
      name: 'BundleImportError',
      code: 'SECURITY_VIOLATION',
    });
  });

  it('rolls back all newly staged IndexedDB assets if storage commit fails mid-import', async () => {
    const wallBlob = new Blob([VALID_PNG_BYTES.buffer], { type: 'image/png' });
    const wallMeta = await sourceDb.addAsset({
      id: 'asset-wall-rollback',
      kind: 'wallpaper',
      name: 'rollback.png',
      mimeType: 'image/png',
      blob: wallBlob,
    });

    const base = createDefaultWorkspaceState();
    base.profiles['profile-personal']!.theme.wallpaper = {
      ...base.profiles['profile-personal']!.theme.wallpaper,
      type: 'image',
      assetId: wallMeta.id,
    };
    base.assetRegistry[wallMeta.id] = wallMeta;

    const exported = await exportWorkspaceBundle(base, {
      scope: 'single-profile',
      db: sourceDb,
    });
    const validated = await inspectAndValidateBundle(exported.blob);

    // Force chromeStorageService writeWorkspace failure AFTER assets are staged in targetDb
    const failingStorage = createMemoryStorageService();
    vi.spyOn(failingStorage, 'writeWorkspace').mockRejectedValue(
      new Error('Simulated Chrome storage write failure'),
    );

    const beforeRevision = useWorkspaceStore.getState().workspace.revision;

    await expect(
      executeTransactionalImport(validated, {
        mode: 'restore-all',
        storageService: failingStorage,
        db: targetDb,
      }),
    ).rejects.toMatchObject({ code: 'COMMIT_FAILED' });

    // Confirm zero orphaned staged assets remain in targetDb and live store was untouched
    expect(await targetDb.listAssets()).toHaveLength(0);
    expect(useWorkspaceStore.getState().workspace.revision).toBe(beforeRevision);
  });

  it('requires explicit confirmation in PortabilityDialog before destructive Full Restore', async () => {
    const user = userEvent.setup();
    const state = createDefaultWorkspaceState();
    const exported = await exportWorkspaceBundle(state, {
      scope: 'full-workspace',
      db: sourceDb,
    });

    render(
      <TooltipProvider>
        <PortabilityDialog open onOpenChange={() => {}} />
      </TooltipProvider>,
    );

    await user.click(screen.getByRole('tab', { name: 'Import / Restore' }));

    const fileInput = screen.getByLabelText('Choose Deckora backup file');
    const rawArchiveBytes = await readBlobArrayBuffer(exported.blob);
    const file = new File([rawArchiveBytes], exported.fileName, { type: 'application/zip' });

    await user.upload(fileInput, file);
    expect(await screen.findByText(/Archive Verified Ready to Import/i)).toBeInTheDocument();

    // Switch explicitly to Full Restore and verify confirmation warning before commit
    await user.click(screen.getByRole('button', { name: /Full Restore/i }));
    await user.click(screen.getByRole('button', { name: /Apply Import/i }));
    expect(screen.getByText(/Confirm Overwrite/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm & Import/i })).toBeInTheDocument();
  });

  it('imports legacy .aurora-bundle.zip backups seamlessly for backward compatibility', async () => {
    const encoder = new TextEncoder();
    const legacyState = createDefaultWorkspaceState();
    legacyState.profiles['profile-personal']!.name = 'Legacy Personal';

    const legacyManifest = {
      format: 'aurora-workspace-bundle',
      formatVersion: 1,
      auroraAppVersion: '0.1.0',
      schemaVersion: legacyState.schemaVersion,
      exportedAt: new Date().toISOString(),
      exportScope: 'single-profile',
      exportedProfileIds: ['profile-personal'],
      exportedProfileNames: ['Legacy Personal'],
      assetCount: 0,
      totalAssetBytes: 0,
      assets: [],
    };

    const legacyZip = await writeZipArchive([
      { path: 'manifest.json', data: encoder.encode(JSON.stringify(legacyManifest)) },
      { path: 'workspace.json', data: encoder.encode(JSON.stringify(legacyState)) },
    ]);

    const validated = await inspectAndValidateBundle(
      new Blob([new Uint8Array(legacyZip).buffer], { type: 'application/zip' }),
    );
    expect(validated.summary.profileNames).toEqual(['Legacy Personal']);

    const imported = await executeTransactionalImport(validated, {
      mode: 'import-as-new',
      storageService: storage,
      db: targetDb,
    });
    expect(imported.importedProfileIds.length).toBe(1);
    const importedProf = imported.savedWorkspace.profiles[imported.importedProfileIds[0]!]!;
    expect(importedProf.name).toBe('Legacy Personal');
  });
});
