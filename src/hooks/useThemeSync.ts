import { useEffect } from 'react';
import { resolveThemePalette } from '@/design-system/themeEngine';
import { applyThemeTokensToDocument } from '@/design-system/tokens';
import { useEditorSessionStore } from '@/state/editorSessionStore';
import { useThemeStore } from '@/state/themeStore';

export function useThemeSync(): void {
  const savedTheme = useThemeStore((state) => state.theme);
  const systemPrefersDark = useThemeStore((state) => state.systemPrefersDark);
  const setSystemPrefersDark = useThemeStore((state) => state.setSystemPrefersDark);
  const isEditing = useEditorSessionStore((state) => state.isEditing);
  const draftTheme = useEditorSessionStore((state) => state.draftTheme);

  const activeTheme = isEditing && draftTheme ? draftTheme : savedTheme;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemPrefersDark(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [setSystemPrefersDark]);

  useEffect(() => {
    const resolved = resolveThemePalette(activeTheme, systemPrefersDark);
    applyThemeTokensToDocument(resolved.resolvedAppearance, activeTheme, resolved.tokens);
  }, [activeTheme, systemPrefersDark]);
}
