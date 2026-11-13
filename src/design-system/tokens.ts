import type { ThemeConfig } from '@/types/workspace';

export const DECKORA_SEED_PALETTE = {
  midnightNavy: '#0B1220',
  royalSlate: '#1E2A44',
  deepBlue: '#27395C',
  iceBlue: '#7FD3F7',
  royalViolet: '#8B7CF6',
  emerald: '#34D399',
  iceWhite: '#EAF4FF',
} as const;

/** @deprecated Use DECKORA_SEED_PALETTE; retained for backward-compatible token consumers. */
export const AURORA_SEED_PALETTE = DECKORA_SEED_PALETTE;

export const GLASS_LIMITS = {
  opacityMin: 0.15,
  opacityMax: 0.95,
  blurMinPx: 0,
  blurMaxPx: 36,
  saturationMinPct: 100,
  saturationMaxPct: 180,
  radiusMinPx: 0,
  radiusMaxPx: 32,
} as const;

export interface SemanticTokenSet {
  bgCanvas: string;
  bgElevated: string;
  surface: string;
  surfaceElevated: string;
  surfaceSolid: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  borderSubtle: string;
  borderHighlight: string;
  focusRing: string;
  success: string;
  warning: string;
  error: string;
  shadowSoft: string;
  shadowElevated: string;
}

export const DARK_SEMANTIC_TOKENS: SemanticTokenSet = {
  bgCanvas: DECKORA_SEED_PALETTE.midnightNavy,
  bgElevated: DECKORA_SEED_PALETTE.royalSlate,
  surface: 'rgba(30, 42, 68, 0.58)',
  surfaceElevated: 'rgba(39, 57, 92, 0.72)',
  surfaceSolid: DECKORA_SEED_PALETTE.royalSlate,
  textPrimary: DECKORA_SEED_PALETTE.iceWhite,
  textSecondary: '#B3C4DB',
  textMuted: '#7C8FA9',
  primary: DECKORA_SEED_PALETTE.iceBlue,
  primaryForeground: DECKORA_SEED_PALETTE.midnightNavy,
  secondary: DECKORA_SEED_PALETTE.deepBlue,
  secondaryForeground: DECKORA_SEED_PALETTE.iceWhite,
  accent: DECKORA_SEED_PALETTE.royalViolet,
  borderSubtle: 'rgba(234, 244, 255, 0.14)',
  borderHighlight: 'rgba(127, 211, 247, 0.35)',
  focusRing: DECKORA_SEED_PALETTE.iceBlue,
  success: DECKORA_SEED_PALETTE.emerald,
  warning: '#FBBF24',
  error: '#F87171',
  shadowSoft: '0 12px 32px -8px rgba(4, 9, 20, 0.48)',
  shadowElevated: '0 20px 48px -12px rgba(4, 9, 20, 0.68)',
};

export const LIGHT_SEMANTIC_TOKENS: SemanticTokenSet = {
  bgCanvas: '#EEF4FA',
  bgElevated: '#FFFFFF',
  surface: 'rgba(255, 255, 255, 0.66)',
  surfaceElevated: 'rgba(241, 246, 252, 0.88)',
  surfaceSolid: '#FFFFFF',
  textPrimary: DECKORA_SEED_PALETTE.midnightNavy,
  textSecondary: '#364968',
  textMuted: '#64748B',
  primary: '#0284C7',
  primaryForeground: '#FFFFFF',
  secondary: '#DCE6F2',
  secondaryForeground: DECKORA_SEED_PALETTE.midnightNavy,
  accent: '#7C3AED',
  borderSubtle: 'rgba(11, 18, 32, 0.12)',
  borderHighlight: 'rgba(2, 132, 199, 0.38)',
  focusRing: '#0284C7',
  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',
  shadowSoft: '0 12px 32px -8px rgba(11, 18, 32, 0.12)',
  shadowElevated: '0 20px 48px -12px rgba(11, 18, 32, 0.18)',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function applyThemeTokensToDocument(
  resolvedAppearance: 'dark' | 'light',
  theme: ThemeConfig,
  tokens: SemanticTokenSet,
  rootElement: HTMLElement = document.documentElement,
): void {
  rootElement.classList.remove('dark', 'light');
  rootElement.classList.add(resolvedAppearance);
  rootElement.dataset.auroraTheme = resolvedAppearance;

  const { style } = rootElement;
  style.setProperty('--aurora-bg-canvas', tokens.bgCanvas);
  style.setProperty('--aurora-bg-elevated', tokens.bgElevated);
  style.setProperty('--aurora-surface', tokens.surface);
  style.setProperty('--aurora-surface-elevated', tokens.surfaceElevated);
  style.setProperty('--aurora-surface-solid', tokens.surfaceSolid);
  style.setProperty('--aurora-text', tokens.textPrimary);
  style.setProperty('--aurora-text-secondary', tokens.textSecondary);
  style.setProperty('--aurora-text-muted', tokens.textMuted);
  style.setProperty('--aurora-primary', tokens.primary);
  style.setProperty('--aurora-primary-foreground', tokens.primaryForeground);
  style.setProperty('--aurora-secondary', tokens.secondary);
  style.setProperty('--aurora-secondary-foreground', tokens.secondaryForeground);
  style.setProperty('--aurora-accent', tokens.accent);
  style.setProperty('--aurora-border', tokens.borderSubtle);
  style.setProperty('--aurora-border-highlight', tokens.borderHighlight);
  style.setProperty('--aurora-focus-ring', tokens.focusRing);
  style.setProperty('--aurora-success', tokens.success);
  style.setProperty('--aurora-warning', tokens.warning);
  style.setProperty('--aurora-error', tokens.error);
  style.setProperty('--aurora-shadow-soft', tokens.shadowSoft);
  style.setProperty('--aurora-shadow-elevated', tokens.shadowElevated);

  const glassOpacity = clamp(theme.glass.opacity, GLASS_LIMITS.opacityMin, GLASS_LIMITS.opacityMax);
  const glassBlur = clamp(theme.glass.blurPx, GLASS_LIMITS.blurMinPx, GLASS_LIMITS.blurMaxPx);
  const glassSat = clamp(
    theme.glass.saturationPct,
    GLASS_LIMITS.saturationMinPct,
    GLASS_LIMITS.saturationMaxPct,
  );
  const glassRadius = clamp(
    theme.glass.radiusPx,
    GLASS_LIMITS.radiusMinPx,
    GLASS_LIMITS.radiusMaxPx,
  );

  const baseRgb = resolvedAppearance === 'dark' ? '30, 42, 68' : '255, 255, 255';
  const elevatedRgb = resolvedAppearance === 'dark' ? '39, 57, 92' : '241, 246, 252';
  const borderRgb = resolvedAppearance === 'dark' ? '234, 244, 255' : '11, 18, 32';
  const highlightAlpha = resolvedAppearance === 'dark' ? '0.12' : '0.65';

  style.setProperty('--glass-opacity', String(glassOpacity));
  style.setProperty('--glass-bg', `rgba(${baseRgb}, ${glassOpacity})`);
  style.setProperty(
    '--glass-bg-elevated',
    `rgba(${elevatedRgb}, ${Math.min(0.95, glassOpacity + 0.16)})`,
  );
  style.setProperty('--glass-blur', `${glassBlur}px`);
  style.setProperty('--glass-saturation', `${glassSat}%`);
  style.setProperty('--glass-border-color', `rgba(${borderRgb}, ${theme.glass.borderOpacity})`);
  style.setProperty(
    '--glass-inner-glow',
    theme.glass.innerHighlight ? `inset 0 1px 0 rgba(255, 255, 255, ${highlightAlpha})` : 'none',
  );
  style.setProperty('--glass-radius', `${glassRadius}px`);
  style.setProperty(
    '--glass-shadow',
    theme.glass.shadowIntensity === 'none'
      ? 'none'
      : theme.glass.shadowIntensity === 'medium'
        ? tokens.shadowElevated
        : tokens.shadowSoft,
  );
}
