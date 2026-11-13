import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChromeStorageService,
  type StorageBackendAdapter,
} from '@/services/storage/chromeStorageService';
import { DEFAULT_SEARCH_ELEMENT_ID } from '@/services/storage/defaults';
import { useWorkspaceStore } from '@/state/workspaceStore';
import { SearchBar } from './SearchBar';

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

describe('SearchBar Component', () => {
  beforeEach(async () => {
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
    const service = new ChromeStorageService(createMemoryAdapter());
    await useWorkspaceStore.getState().hydrate(service);
  });

  it('submits encoded query to default Google provider and skips empty submit', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(<SearchBar onNavigate={onNavigate} />);

    const input = screen.getByRole('searchbox', { name: 'Search query' });
    await user.type(input, '   {Enter}');
    expect(onNavigate).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, 'chrome mv3{Enter}');
    expect(onNavigate).toHaveBeenCalledWith('https://www.google.com/search?q=chrome%20mv3');
  });

  it('switches provider to DuckDuckGo, clears input, and focuses on "/" shortcut', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(<SearchBar onNavigate={onNavigate} />);

    await user.keyboard('/');
    const input = screen.getByRole('searchbox', { name: 'Search query' });
    expect(input).toHaveFocus();

    await user.click(screen.getByRole('button', { name: /Search provider:/i }));
    await user.click(screen.getByRole('menuitem', { name: 'DuckDuckGo' }));

    await user.type(input, 'privacy');
    await user.click(screen.getByRole('button', { name: 'Clear search query' }));
    expect(input).toHaveValue('');

    await user.type(input, 'aurora{Enter}');
    expect(onNavigate).toHaveBeenCalledWith('https://duckduckgo.com/?q=aurora');
  });

  it('offers local shortcut suggestions via ArrowDown/Enter and keeps local history opt-in by default', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(<SearchBar onNavigate={onNavigate} />);

    // Local history is OFF by default
    const initialProps = useWorkspaceStore.getState().getActiveProfile()?.layout.elements[
      DEFAULT_SEARCH_ELEMENT_ID
    ]?.props as { enableLocalHistory?: boolean; recentQueries?: string[] };
    expect(initialProps.enableLocalHistory).toBe(false);

    // Search "example query" without opt-in -> recentQueries must remain empty
    const input = screen.getByRole('searchbox', { name: 'Search query' });
    await user.type(input, 'example query{Enter}');
    expect(onNavigate).toHaveBeenCalledWith('https://www.google.com/search?q=example%20query');
    expect(
      (
        useWorkspaceStore.getState().getActiveProfile()?.layout.elements[DEFAULT_SEARCH_ELEMENT_ID]
          ?.props as { recentQueries?: string[] }
      ).recentQueries,
    ).toEqual([]);

    // Opt into local history via provider menu
    await user.click(screen.getByRole('button', { name: /Search provider:/i }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: /Save local recent searches/i }));

    await user.clear(input);
    await user.type(input, 'typescript docs{Enter}');
    expect(
      (
        useWorkspaceStore.getState().getActiveProfile()?.layout.elements[DEFAULT_SEARCH_ELEMENT_ID]
          ?.props as { recentQueries?: string[] }
      ).recentQueries,
    ).toEqual(['typescript docs']);

    // Typing "git" matches default "GitHub" shortcut locally -> ArrowDown + Enter navigates directly
    await user.clear(input);
    await user.type(input, 'git');
    const listbox = await screen.findByRole('listbox', { name: 'Local search suggestions' });
    expect(listbox).toBeInTheDocument();

    await user.keyboard('{ArrowDown}{Enter}');
    expect(onNavigate).toHaveBeenCalledWith('https://github.com/');
  });
});
