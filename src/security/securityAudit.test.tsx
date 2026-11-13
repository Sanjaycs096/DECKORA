import fs from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TextElementRenderer } from '@/features/elements/TextElementRenderer';
import { findUnsafeSerializedStrings } from '@/features/portability/bundleFormat';
import {
  executeTransactionalImport,
  inspectAndValidateBundle,
} from '@/features/portability/importService';
import {
  normalizeSafeZipPath,
  writeZipArchive,
  ZipArchiveError,
} from '@/features/portability/zipArchive';
import { executeBoundedSpeedTest } from '@/features/speed/speedEngine';
import type { AddAssetInput, AssetDatabaseService } from '@/services/assets/assetDb';
import { MediaValidationError, validateMediaFile } from '@/services/assets/mediaValidation';
import type { ChromeStorageService } from '@/services/storage/chromeStorageService';
import {
  createDefaultCanvasLayout,
  createDefaultWorkspaceState,
} from '@/services/storage/defaults';
import {
  parseSearchProps,
  parseTextProps,
  validateAndMigrateWorkspace,
} from '@/services/storage/schemas';
import type { AssetMetadata, GenericCanvasElement } from '@/types/workspace';
import { sanitizeHttpUrl } from '@/utils/url';

describe('DECKORA Phase 6.5 Security Hardening & Audit Suite', () => {
  it('enforces strict http/https URL sanitization and rejects script/data/file protocols everywhere', () => {
    const dangerousUrls = [
      'javascript:alert(1)',
      '  JaVaScRiPt:alert(document.cookie) ',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox("xss")',
      'file:///etc/passwd',
      'chrome://settings',
      'blob:https://example.com/123',
      '',
    ];

    for (const bad of dangerousUrls) {
      expect(sanitizeHttpUrl(bad)).toBeNull();
    }

    expect(sanitizeHttpUrl('https://mail.google.com/')).toBe('https://mail.google.com/');
    expect(sanitizeHttpUrl('http://localhost:8080/search?q=test')).toBe(
      'http://localhost:8080/search?q=test',
    );

    // Schema validation also rejects javascript: URLs inside bookmarks, shortcuts, and custom search
    const corruptedWorkspace = createDefaultWorkspaceState();
    const profile = corruptedWorkspace.profiles[corruptedWorkspace.activeProfileId]!;
    profile.navigation.curatedBookmarks.push({
      id: 'bad-bm',
      title: 'Evil Bookmark',
      url: 'javascript:alert(1)',
    });
    expect(validateAndMigrateWorkspace(corruptedWorkspace).ok).toBe(false);

    const parsedSearch = parseSearchProps({
      engine: 'custom',
      customEngineTemplate: 'javascript:alert({query})',
    });
    expect(parsedSearch.customEngineTemplate).toBe('');
  });

  it('neutralizes untrusted HTML/XSS strings and rejects CSS injection payloads in custom text', () => {
    const xssPayload = '<img src=x onerror="window.__deckoraXss=1" /><script>alert(1)</script>';
    const maliciousElement: GenericCanvasElement = {
      id: 'el-xss-test',
      type: 'text',
      name: 'XSS Test',
      transform: {
        xPct: 10,
        yPct: 10,
        widthPx: 300,
        heightPx: 100,
        minWidthPx: 80,
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
      zIndex: 1,
      visible: true,
      locked: false,
      groupId: null,
      props: {
        content: xssPayload,
        fontFamily: 'Inter; } body { background: url(javascript:alert(1)) }',
        color: '#E5EAF2',
      },
    };

    const { container } = render(<TextElementRenderer element={maliciousElement} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain(xssPayload);

    // CSS injection attempt falls back safely to bundled Inter Variable
    const safeProps = parseTextProps(maliciousElement.props);
    expect(safeProps.fontFamily).toBe('Inter Variable');

    // Schema rejects dangerous CSS inside stored theme wallpaper
    const badStyleWorkspace = createDefaultWorkspaceState();
    const active = badStyleWorkspace.profiles[badStyleWorkspace.activeProfileId]!;
    active.theme.wallpaper.solidColor = 'red; background-image: url(https://evil.example/x)';
    expect(validateAndMigrateWorkspace(badStyleWorkspace).ok).toBe(false);
  });

  it('rejects malformed ZIP archives, traversal paths, prototype pollution keys, and data/script payloads', async () => {
    // 1. Malformed archive
    const garbageBlob = new Blob([new Uint8Array([0x50, 0x4b, 0x00, 0xff])], {
      type: 'application/zip',
    });
    await expect(inspectAndValidateBundle(garbageBlob)).rejects.toMatchObject({
      code: 'INVALID_FILE',
    });

    // 2. Directory traversal & unexpected archive entry rejection
    expect(() => normalizeSafeZipPath('../evil.txt')).toThrowError(ZipArchiveError);
    expect(() => normalizeSafeZipPath('/etc/passwd')).toThrowError(ZipArchiveError);
    expect(() => normalizeSafeZipPath('C:\\windows\\system32')).toThrowError(ZipArchiveError);

    const unexpectedEntryZip = await writeZipArchive([
      { path: 'evil.txt', data: new TextEncoder().encode('owned') },
    ]);
    await expect(
      inspectAndValidateBundle(
        new Blob([new Uint8Array(unexpectedEntryZip)], { type: 'application/zip' }),
      ),
    ).rejects.toMatchObject({ code: 'SECURITY_VIOLATION' });

    // 3. Prototype pollution JSON key
    const validWs = createDefaultWorkspaceState();
    const validManifest = {
      format: 'deckora-workspace-bundle',
      deckoraAppVersion: '1.0.0',
      formatVersion: 1,
      schemaVersion: 5,
      exportedAt: new Date().toISOString(),
      exportScope: 'full-workspace',
      exportedProfileIds: [validWs.activeProfileId],
      exportedProfileNames: ['Personal'],
      assetCount: 0,
      totalAssetBytes: 0,
      assets: [],
    };
    const protoJson = `{"__proto__":{"polluted":true},"schemaVersion":5,"revision":1,"updatedAt":"${validWs.updatedAt}","activeProfileId":"${validWs.activeProfileId}","profiles":${JSON.stringify(validWs.profiles)},"globalSettings":${JSON.stringify(validWs.globalSettings)},"assetRegistry":{},"speedCache":null}`;
    const protoZip = await writeZipArchive([
      { path: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(validManifest)) },
      { path: 'workspace.json', data: new TextEncoder().encode(protoJson) },
    ]);
    await expect(
      inspectAndValidateBundle(new Blob([new Uint8Array(protoZip)], { type: 'application/zip' })),
    ).rejects.toMatchObject({ code: 'SECURITY_VIOLATION' });

    // 4. Embedded data: URL inside serialized workspace strings
    expect(findUnsafeSerializedStrings({ url: 'data:text/html,<script>1</script>' })).toContain(
      'Unsafe URL scheme',
    );
  });

  it('rejects SVG-in-disguise and HTML-in-disguise uploaded media payloads (ADR-003)', async () => {
    const fakeSvgPng = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
      'innocent.png',
      { type: 'image/png' },
    );
    await expect(validateMediaFile(fakeSvgPng, 'image')).rejects.toMatchObject({
      code: 'SVG_EXCLUDED',
    });

    const xmlSvg = new File(
      ['<?xml version="1.0"?><svg><rect width="10" height="10"/></svg>'],
      'masked.webp',
      { type: 'image/webp' },
    );
    await expect(validateMediaFile(xmlSvg, 'wallpaper')).rejects.toMatchObject({
      code: 'SVG_EXCLUDED',
    });

    const htmlDisguisedJpg = new File(['<!doctype html><script>alert(1)</script>'], 'bad.jpg', {
      type: 'image/jpeg',
    });
    await expect(validateMediaFile(htmlDisguisedJpg, 'image')).rejects.toBeInstanceOf(
      MediaValidationError,
    );
  });

  it('rolls back staged IndexedDB assets cleanly when workspace persistence fails during import', async () => {
    const fakeWs = createDefaultWorkspaceState();
    const assetId = 'asset-test-1';
    const assetMeta: AssetMetadata = {
      id: assetId,
      kind: 'wallpaper',
      name: 'pixel.png',
      mimeType: 'image/png',
      byteSize: 8,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sha256: 'deadbeef',
    };
    fakeWs.assetRegistry[assetId] = assetMeta;

    const addAsset = vi.fn((input: AddAssetInput) =>
      Promise.resolve({
        id: input.id,
        kind: input.kind,
        name: input.name,
        mimeType: input.mimeType,
        byteSize: input.blob.size,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sha256: input.sha256,
      }),
    );
    const deleteAsset = vi.fn(() => Promise.resolve());

    const failingStorage = {
      writeWorkspace: vi.fn(() => Promise.reject(new Error('Simulated quota failure'))),
    } as unknown as ChromeStorageService;
    const mockDb = { addAsset, deleteAsset } as unknown as AssetDatabaseService;

    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await expect(
      executeTransactionalImport(
        {
          manifest: {
            format: 'deckora-workspace-bundle',
            deckoraAppVersion: '1.0.0',
            formatVersion: 1,
            schemaVersion: 5,
            exportedAt: new Date().toISOString(),
            exportScope: 'full-workspace',
            exportedProfileIds: [fakeWs.activeProfileId],
            exportedProfileNames: ['Personal'],
            assetCount: 1,
            totalAssetBytes: pngBytes.byteLength,
            assets: [
              {
                ...assetMeta,
                archivePath: 'assets/asset-test-1.png',
                sha256: 'deadbeef',
              },
            ],
          },
          workspace: {
            ...fakeWs,
            profiles: {
              [fakeWs.activeProfileId]: {
                ...fakeWs.profiles[fakeWs.activeProfileId]!,
                layout: createDefaultCanvasLayout(),
              },
            },
          },
          assetPayloads: {
            [assetId]: {
              manifestEntry: {
                ...assetMeta,
                archivePath: 'assets/asset-test-1.png',
                sha256: 'deadbeef',
              },
              bytes: pngBytes,
              blob: new Blob([pngBytes], { type: 'image/png' }),
            },
          },
          summary: {
            profileCount: 1,
            profileNames: ['Personal'],
            assetCount: 1,
            totalAssetBytes: pngBytes.byteLength,
            sourceSchemaVersion: 5,
            migratedFromLegacy: false,
          },
        },
        {
          mode: 'import-as-new',
          currentWorkspace: createDefaultWorkspaceState(),
          storageService: failingStorage,
          db: mockDb,
          syncStores: false,
        },
      ),
    ).rejects.toMatchObject({ code: 'COMMIT_FAILED' });

    expect(addAsset).toHaveBeenCalledTimes(1);
    expect(deleteAsset).toHaveBeenCalledTimes(1);
  });

  it('cancels bounded Cloudflare speed test cleanly when aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const abortAwareFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal?.aborted) {
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      }
      return Promise.resolve(new Response(new Uint8Array(64), { status: 200 }));
    });

    const outcome = await executeBoundedSpeedTest({
      downloadProbeBytes: 1_048_576,
      uploadProbeBytes: 524_288,
      source: 'manual',
      signal: controller.signal,
      fetchImpl: abortAwareFetch,
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe('failed');
    }
  });

  it('verifies Manifest V3 least-privilege permissions and strict self-only CSP', () => {
    const manifestPath = path.resolve(process.cwd(), 'public/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      manifest_version: number;
      permissions: string[];
      optional_permissions?: string[];
      host_permissions?: string[];
      optional_host_permissions?: string[];
      content_security_policy?: { extension_pages?: string };
    };

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(['storage', 'favicon', 'alarms']);
    expect(manifest.optional_permissions).toEqual(['bookmarks', 'search']);
    expect(manifest.host_permissions ?? []).toEqual([]);
    expect(manifest.optional_host_permissions).toEqual([
      'https://speed.cloudflare.com/*',
      'https://suggestqueries.google.com/*',
      'https://duckduckgo.com/*',
      'https://api.bing.com/*',
    ]);
    expect(manifest.content_security_policy?.extension_pages).toBe(
      "script-src 'self'; object-src 'self';",
    );
  });
});
