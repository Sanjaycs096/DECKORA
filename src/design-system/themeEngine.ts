import type { AppearanceMode, ThemeConfig } from '@/types/workspace';
import {
  DECKORA_SEED_PALETTE,
  DARK_SEMANTIC_TOKENS,
  LIGHT_SEMANTIC_TOKENS,
  type SemanticTokenSet,
} from './tokens';

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export function parseHexColor(hex: string): RgbColor | null {
  const cleaned = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const r = Number.parseInt(cleaned.charAt(0) + cleaned.charAt(0), 16);
    const g = Number.parseInt(cleaned.charAt(1) + cleaned.charAt(1), 16);
    const b = Number.parseInt(cleaned.charAt(2) + cleaned.charAt(2), 16);
    return { r, g, b };
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    const r = Number.parseInt(cleaned.slice(0, 2), 16);
    const g = Number.parseInt(cleaned.slice(2, 4), 16);
    const b = Number.parseInt(cleaned.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

function linearizeChannel(channel255: number): number {
  const srgb = channel255 / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

export function computeRelativeLuminance(hex: string): number {
  const rgb = parseHexColor(hex);
  if (!rgb) return 0;
  return (
    0.2126 * linearizeChannel(rgb.r) +
    0.7152 * linearizeChannel(rgb.g) +
    0.0722 * linearizeChannel(rgb.b)
  );
}

export function getContrastRatio(hexA: string, hexB: string): number {
  const lumA = computeRelativeLuminance(hexA);
  const lumB = computeRelativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function resolveAppearanceMode(
  mode: AppearanceMode,
  systemPrefersDark: boolean,
  theme?: Pick<ThemeConfig, 'useWallpaperAdaptivePalette' | 'extractedPalette'>,
): 'dark' | 'light' {
  if (mode === 'dark' || mode === 'light') {
    return mode;
  }
  if (theme?.useWallpaperAdaptivePalette && theme.extractedPalette) {
    return theme.extractedPalette.recommendedAppearance;
  }
  return systemPrefersDark ? 'dark' : 'light';
}

function mixHexSimple(hexA: string, hexB: string, weightB: number): string {
  const a = parseHexColor(hexA);
  const b = parseHexColor(hexB);
  if (!a || !b) return hexA;
  const t = Math.max(0, Math.min(1, weightB));
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${toHex(a.r * (1 - t) + b.r * t)}${toHex(a.g * (1 - t) + b.g * t)}${toHex(a.b * (1 - t) + b.b * t)}`;
}

function toRgba(hex: string, alpha: number): string | null {
  const rgb = parseHexColor(hex);
  if (!rgb) return null;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function resolveThemePalette(
  theme: ThemeConfig,
  systemPrefersDark: boolean,
): { resolvedAppearance: 'dark' | 'light'; tokens: SemanticTokenSet } {
  const resolvedAppearance = resolveAppearanceMode(theme.appearance, systemPrefersDark, theme);
  const baseTokens =
    resolvedAppearance === 'dark' ? { ...DARK_SEMANTIC_TOKENS } : { ...LIGHT_SEMANTIC_TOKENS };

  const customPrimary = parseHexColor(theme.accentColor) ? theme.accentColor : baseTokens.primary;
  const customAccent = parseHexColor(theme.secondaryAccentColor)
    ? theme.secondaryAccentColor
    : baseTokens.accent;

  let bgCanvas = baseTokens.bgCanvas;
  let bgElevated = baseTokens.bgElevated;
  let borderHighlight = toRgba(customPrimary, 0.36) ?? baseTokens.borderHighlight;

  if (theme.useWallpaperAdaptivePalette && theme.extractedPalette) {
    const pal = theme.extractedPalette;
    const dominantValid = Boolean(parseHexColor(pal.dominant));
    const adaptiveCanvas =
      pal.bgCanvas &&
      parseHexColor(pal.bgCanvas) &&
      pal.recommendedAppearance === resolvedAppearance
        ? pal.bgCanvas
        : dominantValid
          ? mixHexSimple(
              baseTokens.bgCanvas,
              pal.dominant,
              resolvedAppearance === 'dark' ? 0.18 : 0.1,
            )
          : baseTokens.bgCanvas;

    const canvasLum = computeRelativeLuminance(adaptiveCanvas);
    // Guarantee Royal Crystal canvas stays deep in dark mode and airy in light mode
    if (
      (resolvedAppearance === 'dark' && canvasLum < 0.16) ||
      (resolvedAppearance === 'light' && canvasLum > 0.65)
    ) {
      bgCanvas = adaptiveCanvas;
      bgElevated =
        pal.surfaceTint &&
        parseHexColor(pal.surfaceTint) &&
        pal.recommendedAppearance === resolvedAppearance
          ? pal.surfaceTint
          : mixHexSimple(baseTokens.bgElevated, adaptiveCanvas, 0.25);
    }

    if (pal.borderHighlight && parseHexColor(pal.borderHighlight)) {
      borderHighlight = toRgba(customPrimary, 0.42) ?? pal.borderHighlight;
    }
  }

  // Pick accessible foreground text for primary buttons based on luminance
  const primaryContrastWithDark = getContrastRatio(
    customPrimary,
    DECKORA_SEED_PALETTE.midnightNavy,
  );
  const primaryContrastWithLight = getContrastRatio(customPrimary, '#FFFFFF');
  const primaryForeground =
    primaryContrastWithDark >= primaryContrastWithLight
      ? DECKORA_SEED_PALETTE.midnightNavy
      : '#FFFFFF';

  return {
    resolvedAppearance,
    tokens: {
      ...baseTokens,
      bgCanvas,
      bgElevated,
      borderHighlight,
      primary: customPrimary,
      primaryForeground,
      accent: customAccent,
      focusRing: customPrimary,
    },
  };
}
