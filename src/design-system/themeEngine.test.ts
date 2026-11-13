import { describe, expect, it } from 'vitest';
import {
  DECKORA_SEED_PALETTE,
  DARK_SEMANTIC_TOKENS,
  LIGHT_SEMANTIC_TOKENS,
  applyThemeTokensToDocument,
} from './tokens';
import { getContrastRatio, resolveThemePalette } from './themeEngine';
import { createDefaultThemeConfig } from '@/services/storage/defaults';

describe('Design System Tokens & Theme Engine', () => {
  it('exposes the approved Deckora Royal Crystal seed palette', () => {
    expect(DECKORA_SEED_PALETTE).toEqual({
      midnightNavy: '#0B1220',
      royalSlate: '#1E2A44',
      deepBlue: '#27395C',
      iceBlue: '#7FD3F7',
      royalViolet: '#8B7CF6',
      emerald: '#34D399',
      iceWhite: '#EAF4FF',
    });
  });

  it('maintains high contrast ratios in default dark and light themes', () => {
    expect(
      getContrastRatio(DARK_SEMANTIC_TOKENS.textPrimary, DARK_SEMANTIC_TOKENS.bgCanvas),
    ).toBeGreaterThan(10);
    expect(
      getContrastRatio(LIGHT_SEMANTIC_TOKENS.textPrimary, LIGHT_SEMANTIC_TOKENS.bgCanvas),
    ).toBeGreaterThan(10);
  });

  it('resolves dark, light, and system appearance modes accurately', () => {
    const baseTheme = createDefaultThemeConfig();

    expect(
      resolveThemePalette({ ...baseTheme, appearance: 'dark' }, false).resolvedAppearance,
    ).toBe('dark');
    expect(
      resolveThemePalette({ ...baseTheme, appearance: 'light' }, true).resolvedAppearance,
    ).toBe('light');
    expect(
      resolveThemePalette({ ...baseTheme, appearance: 'system' }, true).resolvedAppearance,
    ).toBe('dark');
    expect(
      resolveThemePalette({ ...baseTheme, appearance: 'system' }, false).resolvedAppearance,
    ).toBe('light');
  });

  it('applies --aurora-* and --glass-* CSS custom properties to root element', () => {
    const root = document.createElement('div');
    const theme = createDefaultThemeConfig();
    const { resolvedAppearance, tokens } = resolveThemePalette(theme, true);

    applyThemeTokensToDocument(resolvedAppearance, theme, tokens, root);

    expect(root.classList.contains('dark')).toBe(true);
    expect(root.dataset.auroraTheme).toBe('dark');
    expect(root.style.getPropertyValue('--aurora-bg-canvas')).toBe('#0B1220');
    expect(root.style.getPropertyValue('--aurora-primary')).toBe('#7FD3F7');
    expect(root.style.getPropertyValue('--glass-blur')).toBe('18px');
    expect(root.style.getPropertyValue('--glass-opacity')).toBe('0.58');
  });
});
