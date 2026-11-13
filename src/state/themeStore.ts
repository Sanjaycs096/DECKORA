import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { resolveThemePalette } from '@/design-system/themeEngine';
import { DARK_SEMANTIC_TOKENS, type SemanticTokenSet } from '@/design-system/tokens';
import { createDefaultThemeConfig } from '@/services/storage/defaults';
import type { AppearanceMode, ThemeConfig } from '@/types/workspace';

function detectSystemDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export interface ThemeStoreState {
  theme: ThemeConfig;
  systemPrefersDark: boolean;
  resolvedAppearance: 'dark' | 'light';
  tokens: SemanticTokenSet;
  syncFromThemeConfig: (theme: ThemeConfig) => void;
  setAppearance: (appearance: AppearanceMode) => void;
  setAccentColor: (accentColor: string) => void;
  setGlassOpacity: (opacity: number) => void;
  setGlassBlur: (blurPx: number) => void;
  setSystemPrefersDark: (prefersDark: boolean) => void;
}

const initialTheme = createDefaultThemeConfig();
const initialSystemDark = detectSystemDark();
const initialResolved = resolveThemePalette(initialTheme, initialSystemDark);

export const useThemeStore = create<ThemeStoreState>()(
  immer((set) => ({
    theme: initialTheme,
    systemPrefersDark: initialSystemDark,
    resolvedAppearance: initialResolved.resolvedAppearance,
    tokens: initialResolved.tokens ?? DARK_SEMANTIC_TOKENS,
    syncFromThemeConfig: (theme) =>
      set((draft) => {
        draft.theme = theme;
        const resolved = resolveThemePalette(theme, draft.systemPrefersDark);
        draft.resolvedAppearance = resolved.resolvedAppearance;
        draft.tokens = resolved.tokens;
      }),
    setAppearance: (appearance) =>
      set((draft) => {
        draft.theme.appearance = appearance;
        const resolved = resolveThemePalette(draft.theme, draft.systemPrefersDark);
        draft.resolvedAppearance = resolved.resolvedAppearance;
        draft.tokens = resolved.tokens;
      }),
    setAccentColor: (accentColor) =>
      set((draft) => {
        draft.theme.accentColor = accentColor;
        const resolved = resolveThemePalette(draft.theme, draft.systemPrefersDark);
        draft.resolvedAppearance = resolved.resolvedAppearance;
        draft.tokens = resolved.tokens;
      }),
    setGlassOpacity: (opacity) =>
      set((draft) => {
        draft.theme.glass.opacity = Math.min(0.95, Math.max(0.15, opacity));
      }),
    setGlassBlur: (blurPx) =>
      set((draft) => {
        draft.theme.glass.blurPx = Math.min(36, Math.max(0, blurPx));
      }),
    setSystemPrefersDark: (prefersDark) =>
      set((draft) => {
        draft.systemPrefersDark = prefersDark;
        const resolved = resolveThemePalette(draft.theme, prefersDark);
        draft.resolvedAppearance = resolved.resolvedAppearance;
        draft.tokens = resolved.tokens;
      }),
  })),
);
