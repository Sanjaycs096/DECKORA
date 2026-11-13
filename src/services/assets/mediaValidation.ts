import type { CustomFontRecord } from '@/types/workspace';

export type RasterImageMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/avif';
export type SupportedImageMime = RasterImageMime | 'image/gif';
export type SupportedFontFormat = 'woff2' | 'woff';

export const MEDIA_LIMITS = {
  wallpaper: {
    maxBytes: 15 * 1024 * 1024,
    maxWidth: 7680,
    maxHeight: 4320,
    allowedMimes: ['image/png', 'image/jpeg', 'image/webp', 'image/avif'] as const,
  },
  image: {
    maxBytes: 10 * 1024 * 1024,
    maxWidth: 6000,
    maxHeight: 6000,
    allowedMimes: ['image/png', 'image/jpeg', 'image/webp', 'image/avif'] as const,
  },
  gif: {
    maxBytes: 15 * 1024 * 1024,
    maxWidth: 2400,
    maxHeight: 2400,
    allowedMimes: ['image/gif'] as const,
  },
  font: {
    maxBytes: 5 * 1024 * 1024,
    allowedFormats: ['woff2', 'woff'] as const,
  },
} as const;

export class MediaValidationError extends Error {
  readonly code:
    | 'EMPTY_FILE'
    | 'SVG_EXCLUDED'
    | 'UNSUPPORTED_FORMAT'
    | 'WRONG_MEDIA_KIND'
    | 'SIZE_EXCEEDED'
    | 'DIMENSION_EXCEEDED'
    | 'CORRUPT_HEADER';

  constructor(code: MediaValidationError['code'], message: string) {
    super(message);
    this.name = 'MediaValidationError';
    this.code = code;
  }
}

export interface ValidatedMediaFile {
  kind: 'wallpaper' | 'image' | 'gif';
  mimeType: SupportedImageMime;
  fileName: string;
  byteSize: number;
  width?: number;
  height?: number;
  blob: Blob;
  sha256: string;
}

export interface ValidatedFontFile {
  format: SupportedFontFormat;
  mimeType: string;
  familyName: string;
  displayName: string;
  byteSize: number;
  buffer: ArrayBuffer;
  sha256: string;
}

async function readFileBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    const ab = await blob.arrayBuffer();
    return new Uint8Array(ab);
  }
  const ab = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read binary buffer.'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read error.'));
    reader.readAsArrayBuffer(blob);
  });
  return new Uint8Array(ab);
}

function asciiAt(bytes: Uint8Array, start: number, length: number): string {
  if (bytes.length < start + length) return '';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += String.fromCharCode(bytes[start + i]!);
  }
  return out;
}

function startsWithAsciiText(bytes: Uint8Array, needle: string): boolean {
  const sample = asciiAt(bytes, 0, Math.min(bytes.length, 512))
    .replace(/^\uFEFF/, '')
    .trimStart()
    .toLowerCase();
  return sample.includes(needle.toLowerCase());
}

export function detectImageSignature(bytes: Uint8Array): SupportedImageMime | 'svg' | null {
  if (bytes.length >= 8) {
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return 'image/png';
    }
  }

  if (bytes.length >= 3) {
    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'image/jpeg';
    }
  }

  if (bytes.length >= 6) {
    // GIF87a or GIF89a
    const header = asciiAt(bytes, 0, 6);
    if (header === 'GIF87a' || header === 'GIF89a') {
      return 'image/gif';
    }
  }

  if (bytes.length >= 12) {
    // WebP: RIFF....WEBP
    if (asciiAt(bytes, 0, 4) === 'RIFF' && asciiAt(bytes, 8, 4) === 'WEBP') {
      return 'image/webp';
    }
    // AVIF: ....ftypavif or ....ftypavis
    if (asciiAt(bytes, 4, 4) === 'ftyp') {
      const brandWindow = asciiAt(bytes, 8, Math.min(24, bytes.length - 8));
      if (brandWindow.includes('avif') || brandWindow.includes('avis')) {
        return 'image/avif';
      }
    }
  }

  // Reject SVG / XML / HTML / script payloads
  if (
    startsWithAsciiText(bytes, '<svg') ||
    startsWithAsciiText(bytes, '<!doctype svg') ||
    (startsWithAsciiText(bytes, '<?xml') && startsWithAsciiText(bytes, '<svg'))
  ) {
    return 'svg';
  }

  return null;
}

export function detectFontSignature(bytes: Uint8Array): SupportedFontFormat | null {
  if (bytes.length < 4) return null;
  const sig = asciiAt(bytes, 0, 4);
  if (sig === 'wOF2') return 'woff2';
  if (sig === 'wOFF') return 'woff';
  return null;
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) * 16777216 +
    (((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0))
  );
}

/**
 * Deterministic header-based dimension parser (PNG IHDR, GIF LSD, JPEG SOF0-2, WebP VP8/VP8L/VP8X).
 */
export function parseImageHeaderDimensions(
  bytes: Uint8Array,
  mimeType: SupportedImageMime,
): { width: number; height: number } | null {
  if (mimeType === 'image/png' && bytes.length >= 24 && asciiAt(bytes, 12, 4) === 'IHDR') {
    const width = readUint32BE(bytes, 16);
    const height = readUint32BE(bytes, 20);
    if (width > 0 && height > 0) return { width, height };
  }

  if (mimeType === 'image/gif' && bytes.length >= 10) {
    const width = readUint16LE(bytes, 6);
    const height = readUint16LE(bytes, 8);
    if (width > 0 && height > 0) return { width, height };
  }

  if (mimeType === 'image/jpeg') {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1]!;
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd8)) {
        offset += 2;
        continue;
      }
      const segmentLength = readUint16BE(bytes, offset + 2);
      if (segmentLength < 2) break;
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isSof && offset + 8 < bytes.length) {
        const height = readUint16BE(bytes, offset + 5);
        const width = readUint16BE(bytes, offset + 7);
        if (width > 0 && height > 0) return { width, height };
      }
      offset += 2 + segmentLength;
    }
  }

  if (mimeType === 'image/webp' && bytes.length >= 30) {
    const chunk = asciiAt(bytes, 12, 4);
    if (chunk === 'VP8X') {
      const width = 1 + ((bytes[24] ?? 0) | ((bytes[25] ?? 0) << 8) | ((bytes[26] ?? 0) << 16));
      const height = 1 + ((bytes[27] ?? 0) | ((bytes[28] ?? 0) << 8) | ((bytes[29] ?? 0) << 16));
      if (width > 0 && height > 0) return { width, height };
    } else if (chunk === 'VP8 ' && bytes.length >= 30) {
      const width = readUint16LE(bytes, 26) & 0x3fff;
      const height = readUint16LE(bytes, 28) & 0x3fff;
      if (width > 0 && height > 0) return { width, height };
    } else if (chunk === 'VP8L' && bytes.length >= 25) {
      const b0 = bytes[21] ?? 0;
      const b1 = bytes[22] ?? 0;
      const b2 = bytes[23] ?? 0;
      const b3 = bytes[24] ?? 0;
      const width = 1 + (b0 | ((b1 & 0x3f) << 8));
      const height = 1 + (((b1 & 0xc0) >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10));
      if (width > 0 && height > 0) return { width, height };
    }
  }

  return null;
}

async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  if (
    typeof crypto !== 'undefined' &&
    crypto.subtle &&
    typeof crypto.subtle.digest === 'function'
  ) {
    const bufferCopy = new Uint8Array(bytes).buffer;
    const hash = await crypto.subtle.digest('SHA-256', bufferCopy);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return `len-${bytes.byteLength}`;
}

async function decodeDimensionsInBrowser(
  blob: Blob,
): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      const result = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return result;
    } catch {
      return null;
    }
  }
  return null;
}

function getLowerExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : '';
}

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export async function validateMediaFile(
  file: File | Blob,
  targetKind: 'wallpaper' | 'image' | 'gif',
  explicitFileName?: string,
): Promise<ValidatedMediaFile> {
  const fileName =
    explicitFileName ?? (file instanceof File ? file.name : `${targetKind}-${Date.now()}`);
  const ext = getLowerExtension(fileName);
  const declaredMime = (file.type || '').toLowerCase();

  if (file.size === 0) {
    throw new MediaValidationError('EMPTY_FILE', 'Selected file is empty (0 bytes).');
  }

  if (ext === '.svg' || declaredMime.includes('svg')) {
    throw new MediaValidationError(
      'SVG_EXCLUDED',
      'Raw SVG files are excluded for security (ADR-003). Please upload PNG, JPEG, WebP, AVIF, or GIF.',
    );
  }

  const limits = MEDIA_LIMITS[targetKind];
  if (file.size > limits.maxBytes) {
    throw new MediaValidationError(
      'SIZE_EXCEEDED',
      `File "${fileName}" exceeds the ${formatMegabytes(limits.maxBytes)} limit for ${targetKind} uploads.`,
    );
  }

  const bytes = await readFileBytes(file);
  const detectedMime = detectImageSignature(bytes);

  if (detectedMime === 'svg') {
    throw new MediaValidationError(
      'SVG_EXCLUDED',
      'SVG markup detected inside file. Raw SVG uploads are excluded for security (ADR-003).',
    );
  }

  if (!detectedMime) {
    throw new MediaValidationError(
      'UNSUPPORTED_FORMAT',
      `Unsupported or corrupted file "${fileName}". Expected ${
        targetKind === 'gif' ? 'an animated GIF (.gif)' : 'PNG, JPEG, WebP, or AVIF'
      }.`,
    );
  }

  if (targetKind === 'gif' && detectedMime !== 'image/gif') {
    throw new MediaValidationError(
      'WRONG_MEDIA_KIND',
      `File "${fileName}" is ${detectedMime}, not an animated GIF. Use "Add Image" for static images.`,
    );
  }

  if ((targetKind === 'image' || targetKind === 'wallpaper') && detectedMime === 'image/gif') {
    throw new MediaValidationError(
      'WRONG_MEDIA_KIND',
      targetKind === 'wallpaper'
        ? 'Animated GIFs are not supported as page wallpapers. Add animated GIFs as a canvas GIF element instead.'
        : 'Animated GIFs should be added via "Add GIF" so original frame animation is preserved.',
    );
  }

  const headerDims = parseImageHeaderDimensions(bytes, detectedMime);
  const browserDims = headerDims ?? (await decodeDimensionsInBrowser(file));

  if (browserDims) {
    if (browserDims.width > limits.maxWidth || browserDims.height > limits.maxHeight) {
      throw new MediaValidationError(
        'DIMENSION_EXCEEDED',
        `Image dimensions (${browserDims.width}×${browserDims.height}) exceed the maximum allowed ${limits.maxWidth}×${limits.maxHeight} px.`,
      );
    }
  }

  const normalizedBlob = new Blob([new Uint8Array(bytes).buffer], { type: detectedMime });
  const sha256 = await computeSha256Hex(bytes);

  return {
    kind: targetKind,
    mimeType: detectedMime,
    fileName,
    byteSize: normalizedBlob.size,
    width: browserDims?.width,
    height: browserDims?.height,
    blob: normalizedBlob,
    sha256,
  };
}

export async function validateFontFile(
  file: File | Blob,
  explicitFileName?: string,
): Promise<ValidatedFontFile> {
  const fileName =
    explicitFileName ?? (file instanceof File ? file.name : `custom-font-${Date.now()}.woff2`);
  const ext = getLowerExtension(fileName);

  if (file.size === 0) {
    throw new MediaValidationError('EMPTY_FILE', 'Font file is empty (0 bytes).');
  }

  if (ext && ext !== '.woff2' && ext !== '.woff') {
    throw new MediaValidationError(
      'UNSUPPORTED_FORMAT',
      'Only WOFF2 and WOFF custom font files are supported for local embedding.',
    );
  }

  if (file.size > MEDIA_LIMITS.font.maxBytes) {
    throw new MediaValidationError(
      'SIZE_EXCEEDED',
      `Font "${fileName}" exceeds the ${formatMegabytes(MEDIA_LIMITS.font.maxBytes)} size limit.`,
    );
  }

  const bytes = await readFileBytes(file);
  const detectedFormat = detectFontSignature(bytes);
  if (!detectedFormat) {
    throw new MediaValidationError(
      'CORRUPT_HEADER',
      `File "${fileName}" does not contain a valid WOFF2 or WOFF font header.`,
    );
  }

  const rawBaseName = fileName.replace(/\.[^.]+$/, '');
  const cleanLabel = rawBaseName
    .replace(/[^a-zA-Z0-9 _-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const displayName = cleanLabel || 'Custom Font';
  const shortSuffix = Math.random().toString(36).slice(2, 6);
  const safeFamilySlug = displayName.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 32) || 'CustomFont';
  const familyName = `AuroraUser-${safeFamilySlug}-${shortSuffix}`;

  const buffer = new Uint8Array(bytes).buffer;
  const sha256 = await computeSha256Hex(bytes);

  return {
    format: detectedFormat,
    mimeType: detectedFormat === 'woff2' ? 'font/woff2' : 'font/woff',
    familyName,
    displayName,
    byteSize: buffer.byteLength,
    buffer,
    sha256,
  };
}

const loadedFontFamilies = new Set<string>();

export async function loadCustomFontIntoDocument(
  familyName: string,
  buffer: ArrayBuffer,
): Promise<boolean> {
  if (loadedFontFamilies.has(familyName)) return true;
  if (typeof FontFace !== 'function' || typeof document === 'undefined' || !document.fonts) {
    return false;
  }

  const face = new FontFace(familyName, buffer);
  const loaded = await face.load();
  document.fonts.add(loaded);
  loadedFontFamilies.add(familyName);
  return true;
}

export function isCustomFontLoaded(record: CustomFontRecord): boolean {
  return loadedFontFamilies.has(record.familyName);
}
