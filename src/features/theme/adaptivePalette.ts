import { getContrastRatio, parseHexColor } from '@/design-system/themeEngine';
import { DECKORA_SEED_PALETTE } from '@/design-system/tokens';
import { assetDb, type AssetDatabaseService } from '@/services/assets/assetDb';
import type { ExtractedWallpaperPalette, WallpaperConfig } from '@/types/workspace';

export interface RgbaPixelBuffer {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface ExtractPaletteOptions {
  imageBlob?: Blob | null;
  db?: AssetDatabaseService;
  decodeImagePixels?: (blob: Blob) => Promise<RgbaPixelBuffer | null>;
}

interface RgbTriple {
  r: number;
  g: number;
  b: number;
}

interface HslTriple {
  h: number; // 0..360
  s: number; // 0..1
  l: number; // 0..1
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function clampUnit(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (value: number) => clampByte(value).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): HslTriple {
  const rn = clampByte(r) / 255;
  const gn = clampByte(g) / 255;
  const bn = clampByte(b) / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta > 0.0001) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / delta + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      default:
        h = (rn - gn) / delta + 4;
        break;
    }
    h *= 60;
  }

  return { h, s, l };
}

export function hslToRgb(h: number, s: number, l: number): RgbTriple {
  const hue = ((h % 360) + 360) % 360;
  const sat = clampUnit(s);
  const light = clampUnit(l);

  if (sat <= 0.0001) {
    const gray = clampByte(light * 255);
    return { r: gray, g: gray, b: gray };
  }

  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  const hueToChannel = (tInput: number) => {
    let t = tInput;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  return {
    r: clampByte(hueToChannel(hue / 360 + 1 / 3) * 255),
    g: clampByte(hueToChannel(hue / 360) * 255),
    b: clampByte(hueToChannel(hue / 360 - 1 / 3) * 255),
  };
}

export function mixHexColors(hexA: string, hexB: string, weightB: number): string {
  const a = parseHexColor(hexA);
  const b = parseHexColor(hexB);
  if (!a || !b) return hexA;
  const t = clampUnit(weightB);
  return rgbToHex(a.r * (1 - t) + b.r * t, a.g * (1 - t) + b.g * t, a.b * (1 - t) + b.b * t);
}

/**
 * Adjusts lightness of a color until it reaches at least `minRatio` WCAG contrast
 * against `backgroundHex`, preserving hue as closely as possible.
 */
export function ensureWcagContrast(
  foregroundHex: string,
  backgroundHex: string,
  minRatio = 4.5,
  targetMode: 'dark' | 'light' = 'dark',
): string {
  const parsed = parseHexColor(foregroundHex);
  if (!parsed) {
    return targetMode === 'dark' ? DECKORA_SEED_PALETTE.iceBlue : '#0284C7';
  }

  if (getContrastRatio(foregroundHex, backgroundHex) >= minRatio) {
    return rgbToHex(parsed.r, parsed.g, parsed.b);
  }

  const hsl = rgbToHsl(parsed.r, parsed.g, parsed.b);
  const stepDirection = targetMode === 'dark' ? 0.04 : -0.04;
  let candidateLightness = hsl.l;
  let bestHex = rgbToHex(parsed.r, parsed.g, parsed.b);
  let bestRatio = getContrastRatio(bestHex, backgroundHex);

  for (let i = 0; i < 25; i += 1) {
    candidateLightness = clampUnit(candidateLightness + stepDirection);
    const nextRgb = hslToRgb(hsl.h, Math.max(hsl.s, 0.32), candidateLightness);
    const nextHex = rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b);
    const ratio = getContrastRatio(nextHex, backgroundHex);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestHex = nextHex;
    }
    if (ratio >= minRatio) {
      return nextHex;
    }
    if (candidateLightness <= 0.02 || candidateLightness >= 0.98) {
      break;
    }
  }

  return bestRatio >= minRatio
    ? bestHex
    : targetMode === 'dark'
      ? DECKORA_SEED_PALETTE.iceBlue
      : '#0284C7';
}

function relativeLuminanceRgb(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function hueDistanceDeg(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export function computeWallpaperSignature(wallpaper: WallpaperConfig): string {
  switch (wallpaper.type) {
    case 'image':
      return `image:${wallpaper.assetId ?? 'none'}`;
    case 'solid':
      return `solid:${wallpaper.solidColor.trim().toLowerCase()}`;
    case 'gradient': {
      let hash = 2166136261;
      for (let i = 0; i < wallpaper.gradientCss.length; i += 1) {
        hash ^= wallpaper.gradientCss.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return `gradient:${(hash >>> 0).toString(16)}`;
    }
    case 'none':
    default:
      return 'none:default';
  }
}

function buildFinalPalette(
  dominantRgb: RgbTriple,
  accentRgb: RgbTriple,
  secondaryRgb: RgbTriple,
  averageLuminance: number,
  sourceSignature?: string,
): ExtractedWallpaperPalette {
  const recommendedAppearance: 'dark' | 'light' = averageLuminance < 0.45 ? 'dark' : 'light';
  const dominant = rgbToHex(dominantRgb.r, dominantRgb.g, dominantRgb.b);
  const rawAccent = rgbToHex(accentRgb.r, accentRgb.g, accentRgb.b);
  const rawSecondary = rgbToHex(secondaryRgb.r, secondaryRgb.g, secondaryRgb.b);

  const baseCanvas = recommendedAppearance === 'dark' ? '#0B1220' : '#EEF4FA';
  const baseSurface = recommendedAppearance === 'dark' ? '#1E2A44' : '#F6F9FD';

  const bgCanvas = mixHexColors(
    baseCanvas,
    dominant,
    recommendedAppearance === 'dark' ? 0.22 : 0.12,
  );
  const surfaceTint = mixHexColors(
    baseSurface,
    dominant,
    recommendedAppearance === 'dark' ? 0.26 : 0.1,
  );

  const accent = ensureWcagContrast(rawAccent, bgCanvas, 4.5, recommendedAppearance);
  const secondaryAccent = ensureWcagContrast(rawSecondary, bgCanvas, 4.5, recommendedAppearance);
  const contrastRatio = Number(getContrastRatio(accent, bgCanvas).toFixed(2));
  const borderHighlight = mixHexColors(
    accent,
    '#FFFFFF',
    recommendedAppearance === 'dark' ? 0.2 : 0,
  );

  return {
    dominant,
    accent,
    secondaryAccent,
    bgCanvas,
    surfaceTint,
    borderHighlight,
    contrastRatio,
    sourceSignature,
    extractedAt: new Date().toISOString(),
    averageLuminance: Number(clampUnit(averageLuminance).toFixed(4)),
    recommendedAppearance,
  };
}

/**
 * Pure pixel-buffer quantizer producing dominant, primary accent, secondary accent,
 * surface/background tints, and WCAG-guarded contrast metrics.
 */
export function extractPaletteFromRgbaPixels(
  pixelBuffer: RgbaPixelBuffer,
  sourceSignature?: string,
): ExtractedWallpaperPalette {
  const { data } = pixelBuffer;
  const buckets = new Map<
    number,
    { count: number; rSum: number; gSum: number; bSum: number; satSum: number }
  >();

  let totalSamples = 0;
  let luminanceSum = 0;

  const stride = Math.max(1, Math.floor(data.length / (4 * 2500)));
  for (let i = 0; i + 3 < data.length; i += 4 * stride) {
    const a = data[i + 3] ?? 0;
    if (a < 32) continue;

    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;

    totalSamples += 1;
    luminanceSum += relativeLuminanceRgb(r, g, b);

    const hsl = rgbToHsl(r, g, b);
    const qr = r >> 4;
    const qg = g >> 4;
    const qb = b >> 4;
    const key = (qr << 8) | (qg << 4) | qb;

    const entry = buckets.get(key) ?? { count: 0, rSum: 0, gSum: 0, bSum: 0, satSum: 0 };
    entry.count += 1;
    entry.rSum += r;
    entry.gSum += g;
    entry.bSum += b;
    entry.satSum += hsl.s;
    buckets.set(key, entry);
  }

  if (totalSamples === 0 || buckets.size === 0) {
    return buildFinalPalette(
      parseHexColor(DECKORA_SEED_PALETTE.midnightNavy)!,
      parseHexColor(DECKORA_SEED_PALETTE.iceBlue)!,
      parseHexColor(DECKORA_SEED_PALETTE.royalViolet)!,
      0.12,
      sourceSignature,
    );
  }

  const averageLuminance = luminanceSum / totalSamples;
  const candidates = Array.from(buckets.values()).map((bucket) => {
    const r = Math.round(bucket.rSum / bucket.count);
    const g = Math.round(bucket.gSum / bucket.count);
    const b = Math.round(bucket.bSum / bucket.count);
    const hsl = rgbToHsl(r, g, b);
    const coverage = bucket.count / totalSamples;
    const avgSat = bucket.satSum / bucket.count;
    // Favor saturated, mid-lightness hues for accents rather than muddy greys/blacks
    const lightnessBalance = 1 - Math.abs(hsl.l - 0.54) * 1.4;
    const accentScore =
      (avgSat * 0.72 + Math.max(0.1, lightnessBalance) * 0.28) * Math.sqrt(coverage);
    return { rgb: { r, g, b }, hsl, count: bucket.count, coverage, accentScore };
  });

  candidates.sort((a, b) => b.count - a.count);
  const dominant = candidates[0]!;

  const accentSorted = [...candidates].sort((a, b) => b.accentScore - a.accentScore);
  const primaryAccentCandidate =
    accentSorted.find((c) => c.hsl.s >= 0.18 && hueDistanceDeg(c.hsl.h, dominant.hsl.h) >= 12) ??
    accentSorted[0]!;

  const secondaryCandidate = accentSorted.find(
    (c) =>
      c !== primaryAccentCandidate &&
      c.hsl.s >= 0.16 &&
      hueDistanceDeg(c.hsl.h, primaryAccentCandidate.hsl.h) >= 28,
  );

  const secondaryRgb = secondaryCandidate
    ? secondaryCandidate.rgb
    : hslToRgb(
        primaryAccentCandidate.hsl.h + 48,
        Math.max(0.45, primaryAccentCandidate.hsl.s),
        clampUnit(primaryAccentCandidate.hsl.l),
      );

  return buildFinalPalette(
    dominant.rgb,
    primaryAccentCandidate.rgb,
    secondaryRgb,
    averageLuminance,
    sourceSignature,
  );
}

function extractColorStopsFromCss(css: string): RgbTriple[] {
  const results: RgbTriple[] = [];
  const hexMatches = css.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g);
  for (const match of hexMatches) {
    const parsed = parseHexColor(match[0]);
    if (parsed) results.push(parsed);
  }

  const rgbMatches = css.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g);
  for (const match of rgbMatches) {
    const r = Number(match[1]);
    const g = Number(match[2]);
    const b = Number(match[3]);
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      results.push({ r: clampByte(r), g: clampByte(g), b: clampByte(b) });
    }
  }

  return results;
}

async function defaultDecodeImagePixels(blob: Blob): Promise<RgbaPixelBuffer | null> {
  if (typeof document === 'undefined') {
    return null;
  }

  const targetSize = 48;
  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;

  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) {
    return null;
  }

  let bitmap: ImageBitmap | null = null;
  let objectUrl: string | null = null;

  try {
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(blob);
      const scale = Math.min(1, targetSize / Math.max(bitmap.width, bitmap.height, 1));
      const drawW = Math.max(1, Math.round(bitmap.width * scale));
      const drawH = Math.max(1, Math.round(bitmap.height * scale));
      canvas.width = drawW;
      canvas.height = drawH;
      ctx.drawImage(bitmap, 0, 0, drawW, drawH);
      const imgData = ctx.getImageData(0, 0, drawW, drawH);
      return { data: imgData.data, width: drawW, height: drawH };
    }

    if (typeof URL.createObjectURL === 'function') {
      objectUrl = URL.createObjectURL(blob);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Failed to decode wallpaper image locally.'));
        el.src = objectUrl!;
      });
      const scale = Math.min(
        1,
        targetSize / Math.max(img.naturalWidth || 48, img.naturalHeight || 48, 1),
      );
      const drawW = Math.max(1, Math.round((img.naturalWidth || 48) * scale));
      const drawH = Math.max(1, Math.round((img.naturalHeight || 48) * scale));
      canvas.width = drawW;
      canvas.height = drawH;
      ctx.drawImage(img, 0, 0, drawW, drawH);
      const imgData = ctx.getImageData(0, 0, drawW, drawH);
      return { data: imgData.data, width: drawW, height: drawH };
    }

    return null;
  } finally {
    if (bitmap && typeof bitmap.close === 'function') {
      bitmap.close();
    }
    if (objectUrl && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(objectUrl);
    }
    canvas.width = 0;
    canvas.height = 0;
  }
}

export function extractPaletteFromColorStops(
  stops: RgbTriple[],
  sourceSignature?: string,
): ExtractedWallpaperPalette {
  if (stops.length === 0) {
    return buildFinalPalette(
      parseHexColor(DECKORA_SEED_PALETTE.midnightNavy)!,
      parseHexColor(DECKORA_SEED_PALETTE.iceBlue)!,
      parseHexColor(DECKORA_SEED_PALETTE.royalViolet)!,
      0.12,
      sourceSignature,
    );
  }

  const fakeData = new Uint8ClampedArray(stops.length * 4);
  for (let i = 0; i < stops.length; i += 1) {
    const s = stops[i]!;
    fakeData[i * 4] = s.r;
    fakeData[i * 4 + 1] = s.g;
    fakeData[i * 4 + 2] = s.b;
    fakeData[i * 4 + 3] = 255;
  }

  return extractPaletteFromRgbaPixels(
    { data: fakeData, width: stops.length, height: 1 },
    sourceSignature,
  );
}

/**
 * Extracts a contrast-safe adaptive palette purely locally in browser memory.
 * Never transmits image data or gradient specifications outside the browser.
 */
export async function extractPaletteFromWallpaper(
  wallpaper: WallpaperConfig,
  options?: ExtractPaletteOptions,
): Promise<ExtractedWallpaperPalette> {
  const signature = computeWallpaperSignature(wallpaper);

  if (wallpaper.type === 'none') {
    return extractPaletteFromColorStops(
      [
        parseHexColor(DECKORA_SEED_PALETTE.midnightNavy)!,
        parseHexColor(DECKORA_SEED_PALETTE.iceBlue)!,
        parseHexColor(DECKORA_SEED_PALETTE.royalViolet)!,
      ],
      signature,
    );
  }

  if (wallpaper.type === 'solid') {
    const base =
      parseHexColor(wallpaper.solidColor) ?? parseHexColor(DECKORA_SEED_PALETTE.midnightNavy)!;
    const hsl = rgbToHsl(base.r, base.g, base.b);
    const lum = relativeLuminanceRgb(base.r, base.g, base.b);
    const accentRgb = hslToRgb(hsl.h + 195, Math.max(0.58, hsl.s), lum < 0.45 ? 0.7 : 0.42);
    const secondaryRgb = hslToRgb(hsl.h + 250, Math.max(0.55, hsl.s), lum < 0.45 ? 0.72 : 0.46);
    return buildFinalPalette(base, accentRgb, secondaryRgb, lum, signature);
  }

  if (wallpaper.type === 'gradient') {
    const stops = extractColorStopsFromCss(wallpaper.gradientCss);
    return extractPaletteFromColorStops(stops, signature);
  }

  // wallpaper.type === 'image'
  let blob = options?.imageBlob ?? null;
  if (!blob && wallpaper.assetId) {
    const db = options?.db ?? assetDb;
    const loaded = await db.readAsset(wallpaper.assetId);
    blob = loaded?.blob ?? null;
  }

  if (!blob) {
    throw new Error('Wallpaper image binary could not be loaded for palette extraction.');
  }

  const decoder = options?.decodeImagePixels ?? defaultDecodeImagePixels;
  const pixelBuffer = await decoder(blob);
  if (!pixelBuffer) {
    throw new Error(
      'Local canvas pixel sampling is unavailable in this environment for this image format.',
    );
  }

  return extractPaletteFromRgbaPixels(pixelBuffer, signature);
}
