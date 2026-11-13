import { z } from 'zod';
import { assetMetadataSchema } from '@/services/storage/schemas';
import type { AssetKind, CustomFontRecord } from '@/types/workspace';

export const DECKORA_BUNDLE_FORMAT = 'deckora-workspace-bundle' as const;
export const LEGACY_AURORA_BUNDLE_FORMAT = 'aurora-workspace-bundle' as const;
export const DECKORA_BUNDLE_FORMAT_VERSION = 1 as const;
export const DECKORA_BUNDLE_EXTENSION = '.deckora-bundle.zip' as const;
export const LEGACY_AURORA_BUNDLE_EXTENSION = '.aurora-bundle.zip' as const;

export const AURORA_BUNDLE_FORMAT = DECKORA_BUNDLE_FORMAT;
export const AURORA_BUNDLE_FORMAT_VERSION = DECKORA_BUNDLE_FORMAT_VERSION;
export const AURORA_BUNDLE_EXTENSION = DECKORA_BUNDLE_EXTENSION;

export const MAX_BUNDLE_ARCHIVE_BYTES = 100 * 1024 * 1024;
export const MAX_BUNDLE_UNCOMPRESSED_BYTES = 120 * 1024 * 1024;

export type BundleExportScope = 'single-profile' | 'full-workspace';

export const bundleAssetManifestEntrySchema = assetMetadataSchema.extend({
  archivePath: z
    .string()
    .min(8)
    .regex(/^assets\/[a-zA-Z0-9._-]+$/, 'Invalid asset archive path'),
  sha256: z.string().min(4),
  fontFamilyName: z.string().min(1).max(160).optional(),
  fontFormat: z.enum(['woff2', 'woff', 'ttf', 'otf']).optional(),
});

export type BundleAssetManifestEntry = z.infer<typeof bundleAssetManifestEntrySchema>;

const baseBundleManifestFields = {
  formatVersion: z.literal(DECKORA_BUNDLE_FORMAT_VERSION),
  schemaVersion: z.number().int().min(1).max(20),
  exportedAt: z.string().min(10),
  exportScope: z.enum(['single-profile', 'full-workspace']),
  exportedProfileIds: z.array(z.string().min(1)).min(1),
  exportedProfileNames: z.array(z.string().min(1)).min(1),
  assetCount: z.number().int().nonnegative(),
  totalAssetBytes: z.number().int().nonnegative(),
  assets: z.array(bundleAssetManifestEntrySchema),
};

export const deckoraBundleManifestSchema = z.object({
  format: z.literal(DECKORA_BUNDLE_FORMAT),
  deckoraAppVersion: z.string().min(1).max(32),
  ...baseBundleManifestFields,
});

export const legacyAuroraBundleManifestSchema = z.object({
  format: z.literal(LEGACY_AURORA_BUNDLE_FORMAT),
  auroraAppVersion: z.string().min(1).max(32),
  ...baseBundleManifestFields,
});

export const auroraBundleManifestSchema = z.union([
  deckoraBundleManifestSchema,
  legacyAuroraBundleManifestSchema,
]);

export type DeckoraBundleManifest = z.infer<typeof deckoraBundleManifestSchema>;
export type AuroraBundleManifest = z.infer<typeof auroraBundleManifestSchema>;

export function extensionForAsset(
  mimeType: string,
  kind: AssetKind,
  fontFormat?: CustomFontRecord['format'],
): string {
  if (kind === 'font') {
    return fontFormat === 'woff' ? 'woff' : 'woff2';
  }
  switch (mimeType.toLowerCase()) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/avif':
      return 'avif';
    case 'image/gif':
      return 'gif';
    default:
      return 'bin';
  }
}

export async function readBlobArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
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
    reader.onerror = () => {
      reject(reader.error ?? new Error('Unable to read Blob bytes.'));
    };
    reader.readAsArrayBuffer(blob);
  });
}

export async function computeBinarySha256(bytes: Uint8Array): Promise<string> {
  if (
    typeof crypto !== 'undefined' &&
    crypto.subtle &&
    typeof crypto.subtle.digest === 'function'
  ) {
    const copy = new Uint8Array(bytes).buffer;
    const digest = await crypto.subtle.digest('SHA-256', copy);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return `len-${bytes.byteLength}`;
}

const FORBIDDEN_PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recursively ensures exported/imported JSON contains zero transient blob: URLs,
 * unsafe execution/file/data URLs, or prototype-pollution keys.
 */
export function findUnsafeSerializedStrings(value: unknown, path = 'root'): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed.startsWith('blob:')) {
      return `Transient blob URL found at ${path}.`;
    }
    if (
      trimmed.startsWith('javascript:') ||
      trimmed.startsWith('vbscript:') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('file:')
    ) {
      return `Unsafe URL scheme found at ${path}.`;
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const hit = findUnsafeSerializedStrings(value[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }

  if (value && typeof value === 'object') {
    for (const key of Object.getOwnPropertyNames(value)) {
      if (FORBIDDEN_PROTO_KEYS.has(key)) {
        return `Prototype pollution key "${key}" rejected at ${path}.`;
      }
      const prop = (value as Record<string, unknown>)[key];
      const hit = findUnsafeSerializedStrings(prop, `${path}.${key}`);
      if (hit) return hit;
    }
  }

  return null;
}

export function sanitizeArchiveFileBaseName(label: string): string {
  const clean = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return clean || 'workspace';
}
