import { beforeEach, describe, expect, it } from 'vitest';
import {
  ChromeStorageService,
  type StorageBackendAdapter,
} from '@/services/storage/chromeStorageService';
import { useEditorSessionStore } from './editorSessionStore';
import { usePreferencesStore } from './preferencesStore';
import { useThemeStore } from './themeStore';
import { useWorkspaceStore } from './workspaceStore';

function createMemoryAdapter(): StorageBackendAdapter {
  const store = new Map<string, unknown>();
  return {
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
}

describe('State Management Separation & Persistence', () => {
  beforeEach(() => {
    usePreferencesStore.getState().resetPreferences();
  });

  it('hydrates workspace, preferences, and theme stores cleanly', async () => {
    const storage = new ChromeStorageService(createMemoryAdapter());
    await useWorkspaceStore.getState().hydrate(storage);

    expect(useWorkspaceStore.getState().status).toBe('ready');
    expect(useWorkspaceStore.getState().getActiveProfile()?.name).toBe('Personal');
    expect(useThemeStore.getState().resolvedAppearance).toBe('dark');
    expect(usePreferencesStore.getState().preferences.defaultFontFamily).toBe('Inter Variable');
  });

  it('persists theme changes across reloads and increments revision', async () => {
    const storage = new ChromeStorageService(createMemoryAdapter());
    await useWorkspaceStore.getState().hydrate(storage);

    const updatedTheme = {
      ...useThemeStore.getState().theme,
      appearance: 'light' as const,
    };
    await useWorkspaceStore.getState().saveActiveProfileTheme(updatedTheme, storage);

    expect(useWorkspaceStore.getState().workspace.revision).toBe(2);
    expect(useThemeStore.getState().resolvedAppearance).toBe('light');

    await useWorkspaceStore.getState().resetWorkspace(storage);
    expect(useWorkspaceStore.getState().workspace.revision).toBe(1);
    expect(useThemeStore.getState().resolvedAppearance).toBe('dark');
  });

  it('keeps editorSessionStore strictly inactive in Phase 1', () => {
    const editor = useEditorSessionStore.getState();
    expect(editor.isEditing).toBe(false);
    expect(editor.draftLayout).toBeNull();
    expect(editor.isDirty).toBe(false);
  });
});
