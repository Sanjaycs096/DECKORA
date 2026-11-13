import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import {
  ChromeStorageService,
  type StorageBackendAdapter,
} from '@/services/storage/chromeStorageService';
import { DEFAULT_SHORTCUTS_ELEMENT_ID } from '@/services/storage/defaults';
import { parseShortcutsProps } from '@/services/storage/schemas';
import { useEditorSessionStore } from '@/state/editorSessionStore';
import { useWorkspaceStore } from '@/state/workspaceStore';
import { ShortcutFavicon } from './ShortcutFavicon';
import { ShortcutsGrid } from './ShortcutsGrid';

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

describe('ShortcutsGrid & ShortcutFavicon', () => {
  beforeEach(async () => {
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
    const service = new ChromeStorageService(createMemoryAdapter());
    await useWorkspaceStore.getState().hydrate(service);
  });

  it('renders all 8 default shortcuts', () => {
    render(<ShortcutsGrid />);

    for (const label of [
      'YouTube',
      'GitHub',
      'Gmail',
      'Google Drive',
      'ChatGPT',
      'LinkedIn',
      'Stack Overflow',
      'Google Calendar',
    ]) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('adds, edits, and removes shortcuts with URL validation', async () => {
    const user = userEvent.setup();
    render(<ShortcutsGrid />);

    // Add invalid URL first
    await user.click(screen.getByRole('button', { name: 'Add shortcut' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'MDN Docs');
    await user.type(within(dialog).getByLabelText('URL'), 'javascript:alert(1)');
    await user.click(within(dialog).getByRole('button', { name: 'Add Shortcut' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/http:\/\/ or https:\/\//i);

    // Fix URL and save
    const urlInput = within(dialog).getByLabelText('URL');
    await user.clear(urlInput);
    await user.type(urlInput, 'https://developer.mozilla.org');
    await user.click(within(dialog).getByRole('button', { name: 'Add Shortcut' }));

    expect(await screen.findByRole('link', { name: 'MDN Docs' })).toHaveAttribute(
      'href',
      'https://developer.mozilla.org/',
    );

    // Edit MDN Docs -> MDN Web Docs
    await user.click(screen.getByRole('button', { name: 'Shortcut actions for MDN Docs' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit shortcut' }));
    const editDialog = screen.getByRole('dialog');
    const nameInput = within(editDialog).getByLabelText('Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'MDN Web Docs');
    await user.click(within(editDialog).getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByRole('link', { name: 'MDN Web Docs' })).toBeInTheDocument();

    // Remove MDN Web Docs
    await user.click(screen.getByRole('button', { name: 'Shortcut actions for MDN Web Docs' }));
    await user.click(screen.getByRole('menuitem', { name: 'Remove' }));

    expect(screen.queryByRole('link', { name: 'MDN Web Docs' })).not.toBeInTheDocument();
    const storedItems = useWorkspaceStore.getState().getActiveProfile()?.layout.elements[
      DEFAULT_SHORTCUTS_ELEMENT_ID
    ]?.props.items as unknown[];
    expect(storedItems).toHaveLength(8);
  });

  it('rejects duplicate shortcut URLs and respects openInNewTab target attributes', async () => {
    const user = userEvent.setup();
    render(
      <ShortcutsGrid
        propsOverride={{
          openInNewTab: true,
        }}
      />,
    );

    const ghLink = screen.getByRole('link', { name: 'GitHub' });
    expect(ghLink).toHaveAttribute('target', '_blank');
    expect(ghLink).toHaveAttribute('rel', 'noopener noreferrer');

    await user.click(screen.getByRole('button', { name: 'Add shortcut' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'GitHub Duplicate');
    await user.type(within(dialog).getByLabelText('URL'), 'https://github.com/');
    await user.click(within(dialog).getByRole('button', { name: 'Add Shortcut' }));

    expect(within(dialog).getByRole('alert')).toHaveTextContent(/already exists/i);
  });

  it('falls back gracefully when chrome _favicon image errors', () => {
    // Mock chrome.runtime.getURL for this test
    const originalChrome = globalThis.chrome;
    globalThis.chrome = {
      runtime: {
        id: 'test-ext-id',
        getURL: vi.fn((path: string) => `chrome-extension://test-ext-id${path}`),
      },
    } as unknown as typeof chrome;

    const { container } = render(
      <ShortcutFavicon
        shortcut={{
          id: 'sc-test',
          title: 'TestSite',
          url: 'https://testsite.example.com/',
          iconSource: 'favicon',
          materialSymbolName: null,
          monogramColor: '#75CFFF',
        }}
      />,
    );

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    if (img) {
      fireEvent.error(img);
    }

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('T')).toBeInTheDocument();

    globalThis.chrome = originalChrome;
  });

  it('recovers favicon rendering when a shortcut URL is updated after an image error', () => {
    const originalChrome = globalThis.chrome;
    globalThis.chrome = {
      runtime: {
        id: 'test-ext-id',
        getURL: vi.fn((path: string) => `chrome-extension://test-ext-id${path}`),
      },
    } as unknown as typeof chrome;

    const { container, rerender } = render(
      <ShortcutFavicon
        shortcut={{
          id: 'sc-test',
          title: 'BrokenSite',
          url: 'https://broken.example.com/',
          iconSource: 'favicon',
          materialSymbolName: null,
          monogramColor: '#75CFFF',
        }}
      />,
    );

    const firstImg = container.querySelector('img');
    expect(firstImg).not.toBeNull();
    if (firstImg) fireEvent.error(firstImg);
    expect(container.querySelector('img')).toBeNull();

    // Update URL -> new favicon image must attempt loading cleanly instead of sticking on fallback
    rerender(
      <ShortcutFavicon
        shortcut={{
          id: 'sc-test',
          title: 'FixedSite',
          url: 'https://fixed.example.com/',
          iconSource: 'favicon',
          materialSymbolName: null,
          monogramColor: '#75CFFF',
        }}
      />,
    );
    expect(container.querySelector('img')).not.toBeNull();

    globalThis.chrome = originalChrome;
  });

  it('defaults legacy shortcuts without orientation to horizontal and switches cleanly to vertical layout', () => {
    const legacyParsed = parseShortcutsProps({}, []);
    expect(legacyParsed.orientation).toBe('horizontal');

    const { rerender } = render(<ShortcutsGrid />);
    const region = screen.getByRole('region', { name: 'Quick shortcuts' });
    expect(region).toHaveAttribute('data-orientation', 'horizontal');

    rerender(<ShortcutsGrid propsOverride={{ orientation: 'vertical' }} embeddedInCanvas />);
    expect(region).toHaveAttribute('data-orientation', 'vertical');
    const grid = region.querySelector('div.grid') as HTMLElement;
    expect(grid.style.gridAutoFlow).toBe('column');

    // Verify all shortcuts remain rendered in exact preserved order
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.getAttribute('aria-label'))).toEqual([
      'YouTube',
      'GitHub',
      'Gmail',
      'Google Drive',
      'ChatGPT',
      'LinkedIn',
      'Stack Overflow',
      'Google Calendar',
    ]);
  });

  it('supports Layout Direction Horizontal/Vertical toggle in Inspector with Undo/Redo, Discard, and Save', async () => {
    window.localStorage.clear();
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
    useEditorSessionStore.setState(useEditorSessionStore.getInitialState());

    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(useWorkspaceStore.getState().status).toBe('ready');
    });

    await user.click(screen.getByRole('button', { name: 'Edit workspace' }));

    // Select Shortcuts layer
    await user.click(
      document.querySelector(`[data-layer-id="${DEFAULT_SHORTCUTS_ELEMENT_ID}"] button`)!,
    );

    const directionGroup = await screen.findByRole('group', {
      name: 'Shortcuts layout direction',
    });
    const horizontalBtn = within(directionGroup).getByRole('button', { name: 'Horizontal' });
    const verticalBtn = within(directionGroup).getByRole('button', { name: 'Vertical' });
    expect(horizontalBtn).toHaveAttribute('aria-pressed', 'true');
    expect(verticalBtn).toHaveAttribute('aria-pressed', 'false');

    // Switch to Vertical
    await user.click(verticalBtn);
    expect(verticalBtn).toHaveAttribute('aria-pressed', 'true');
    expect(
      useEditorSessionStore.getState().draftLayout?.elements[DEFAULT_SHORTCUTS_ELEMENT_ID]?.props
        .orientation,
    ).toBe('vertical');

    // Undo restores Horizontal, Redo restores Vertical
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(
      useEditorSessionStore.getState().draftLayout?.elements[DEFAULT_SHORTCUTS_ELEMENT_ID]?.props
        .orientation,
    ).toBe('horizontal');

    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(
      useEditorSessionStore.getState().draftLayout?.elements[DEFAULT_SHORTCUTS_ELEMENT_ID]?.props
        .orientation,
    ).toBe('vertical');

    // Discard rolls back orientation cleanly
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    const confirmDialog = await screen.findByRole('dialog');
    await user.click(within(confirmDialog).getByRole('button', { name: 'Discard Changes' }));
    await waitFor(() => {
      expect(useEditorSessionStore.getState().isEditing).toBe(false);
    });
    expect(
      useWorkspaceStore.getState().getActiveProfile()?.layout.elements[DEFAULT_SHORTCUTS_ELEMENT_ID]
        ?.props.orientation,
    ).toBe('horizontal');

    // Re-enter Edit Mode, switch to Vertical, and Save persistently
    await user.click(screen.getByRole('button', { name: 'Edit workspace' }));
    await user.click(
      document.querySelector(`[data-layer-id="${DEFAULT_SHORTCUTS_ELEMENT_ID}"] button`)!,
    );
    const reopenedGroup = await screen.findByRole('group', {
      name: 'Shortcuts layout direction',
    });
    await user.click(within(reopenedGroup).getByRole('button', { name: 'Vertical' }));
    await user.click(screen.getByRole('button', { name: 'Save workspace layout' }));
    await waitFor(() => {
      expect(useEditorSessionStore.getState().isEditing).toBe(false);
    });
    expect(
      useWorkspaceStore.getState().getActiveProfile()?.layout.elements[DEFAULT_SHORTCUTS_ELEMENT_ID]
        ?.props.orientation,
    ).toBe('vertical');
    expect(screen.getByRole('region', { name: 'Quick shortcuts' })).toHaveAttribute(
      'data-orientation',
      'vertical',
    );
  });
});
