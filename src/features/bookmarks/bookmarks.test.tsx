import { createRef } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import manifestJson from '../../../public/manifest.json';
import { TooltipProvider } from '@/components/ui';
import { useWorkspaceStore } from '@/state/workspaceStore';
import { BookmarksDrawer } from './BookmarksDrawer';
import { getInitialMainFolders, normalizeChromeBookmarkTree } from './bookmarksService';

type BookmarkListener = () => void;
type PermRemovedListener = (removed: chrome.permissions.Permissions) => void;

function createMockBookmarkEvents() {
  const listeners = new Set<BookmarkListener>();
  const makeEvent = () => ({
    addListener: vi.fn((fn: BookmarkListener) => listeners.add(fn)),
    removeListener: vi.fn((fn: BookmarkListener) => listeners.delete(fn)),
    hasListener: vi.fn((fn: BookmarkListener) => listeners.has(fn)),
    hasListeners: vi.fn(() => listeners.size > 0),
    getRules: vi.fn(),
    removeRules: vi.fn(),
    addRules: vi.fn(),
  });
  return {
    listeners,
    onCreated: makeEvent(),
    onRemoved: makeEvent(),
    onChanged: makeEvent(),
    onMoved: makeEvent(),
    onChildrenReordered: makeEvent(),
    onImportEnded: makeEvent(),
  };
}

describe('Phase 6.2 — Left Bookmark Sidebar, Hover Flyout & Opt-In Chrome Bookmarks', () => {
  const originalChrome = globalThis.chrome;

  beforeEach(() => {
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalChrome === undefined) {
      delete (globalThis as { chrome?: unknown }).chrome;
    } else {
      globalThis.chrome = originalChrome;
    }
  });

  it('declares bookmarks strictly under optional_permissions in manifest.json', () => {
    expect(manifestJson.permissions).not.toContain('bookmarks');
    expect(manifestJson.optional_permissions).toContain('bookmarks');
  });

  it('sanitizes unsafe javascript: URLs when normalizing Chrome bookmark trees', () => {
    const snapshot = normalizeChromeBookmarkTree([
      {
        id: '0',
        title: '',
        syncing: false,
        children: [
          {
            id: '1',
            parentId: '0',
            title: 'Bookmarks Bar',
            syncing: false,
            children: [
              {
                id: '10',
                parentId: '1',
                title: 'Valid',
                url: 'https://developer.chrome.com/',
                syncing: false,
              },
              {
                id: '11',
                parentId: '1',
                title: 'XSS Link',
                url: 'javascript:alert(1)',
                syncing: false,
              },
            ],
          },
        ],
      },
    ]);

    expect(snapshot.totalBookmarks).toBe(1);
    expect(snapshot.flatBookmarks.map((b) => b.title)).toEqual(['Valid']);
  });

  it('shows opt-in prompt when permission is denied, preserves curated bookmarks, and opens left folder sidebar upon approval', async () => {
    const user = userEvent.setup();
    let granted = false;
    const events = createMockBookmarkEvents();
    const removedListeners = new Set<PermRemovedListener>();

    const treeData: chrome.bookmarks.BookmarkTreeNode[] = [
      {
        id: '0',
        title: '',
        syncing: false,
        children: [
          {
            id: '1',
            parentId: '0',
            title: 'Bookmarks Bar',
            syncing: false,
            children: [
              {
                id: '2',
                parentId: '1',
                title: 'Engineering',
                syncing: false,
                children: [
                  {
                    id: '20',
                    parentId: '2',
                    title: 'TypeScript Docs',
                    url: 'https://www.typescriptlang.org/docs/',
                    syncing: false,
                  },
                ],
              },
              {
                id: '3',
                parentId: '1',
                title: 'MDN Web Docs',
                url: 'https://developer.mozilla.org/',
                syncing: false,
              },
            ],
          },
        ],
      },
    ];

    const getTreeMock = vi.fn(() => Promise.resolve(treeData));
    const requestMock = vi.fn(() => {
      granted = true;
      return Promise.resolve(true);
    });

    (globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: {
        id: 'test-ext-id',
        getURL: (p: string) => `chrome-extension://test-ext-id/${p.replace(/^\//, '')}`,
      },
      permissions: {
        contains: vi.fn(() => Promise.resolve(granted)),
        request: requestMock,
        onRemoved: {
          addListener: vi.fn((fn: PermRemovedListener) => removedListeners.add(fn)),
          removeListener: vi.fn((fn: PermRemovedListener) => removedListeners.delete(fn)),
        },
      },
      bookmarks: {
        getTree: getTreeMock,
        onCreated: events.onCreated,
        onRemoved: events.onRemoved,
        onChanged: events.onChanged,
        onMoved: events.onMoved,
        onChildrenReordered: events.onChildrenReordered,
        onImportEnded: events.onImportEnded,
      },
    };

    const onOpenChange = vi.fn();
    const { unmount } = render(
      <TooltipProvider>
        <BookmarksDrawer open onOpenChange={onOpenChange} />
      </TooltipProvider>,
    );

    // Curated bookmarks are immediately visible with zero Chrome permissions
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enable Chrome Bookmarks/i })).toBeInTheDocument();
    expect(getTreeMock).not.toHaveBeenCalled();

    // Grant permission via user action
    await user.click(screen.getByRole('button', { name: /Enable Chrome Bookmarks/i }));
    expect(requestMock).toHaveBeenCalledWith({ permissions: ['bookmarks'] });
    await waitFor(() => expect(getTreeMock).toHaveBeenCalledTimes(1));

    // Left sidebar shows ONLY main folders initially without opening bookmarks flyout yet
    expect(screen.getByRole('complementary', { name: 'Bookmarks sidebar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bookmarks Bar/i })).not.toBeInTheDocument();
    expect(screen.queryByText('MDN Web Docs')).not.toBeInTheDocument();
    expect(screen.queryByText('TypeScript Docs')).not.toBeInTheDocument();

    // Hover opens adjacent flyout showing Engineering bookmarks cleanly
    await user.hover(screen.getByRole('button', { name: /Engineering/i }));
    const flyout = screen.getByRole('region', { name: 'Engineering bookmarks' });
    expect(within(flyout).getByText('TypeScript Docs')).toBeInTheDocument();

    // Search across full tree finds loose root bookmarks too
    const searchInput = screen.getByLabelText('Search Chrome bookmarks');
    await user.type(searchInput, 'MDN');
    expect(screen.getByText('MDN Web Docs')).toBeInTheDocument();
    expect(screen.queryByText('TypeScript Docs')).not.toBeInTheDocument();
    await user.clear(searchInput);

    // Chrome bookmark mutation event triggers refresh cleanly
    events.listeners.forEach((fn) => fn());
    await waitFor(() => expect(getTreeMock).toHaveBeenCalledTimes(2));

    // Revoking permission returns cleanly to opt-in state
    removedListeners.forEach((fn) => fn({ permissions: ['bookmarks'] }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Enable Chrome Bookmarks/i })).toBeInTheDocument();
    });

    // Unmount detaches all bookmark & permission listeners
    unmount();
    expect(events.listeners.size).toBe(0);
    expect(removedListeners.size).toBe(0);
  });

  it('handles denied permission gracefully without throwing or hiding curated links', async () => {
    const user = userEvent.setup();
    (globalThis as unknown as { chrome: unknown }).chrome = {
      permissions: {
        contains: vi.fn(() => Promise.resolve(false)),
        request: vi.fn(() => Promise.resolve(false)),
      },
      bookmarks: {
        getTree: vi.fn(),
      },
    };

    render(
      <TooltipProvider>
        <BookmarksDrawer open onOpenChange={vi.fn()} />
      </TooltipProvider>,
    );

    await user.click(screen.getByRole('button', { name: /Enable Chrome Bookmarks/i }));
    expect(await screen.findByText(/declined/i)).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
  });

  it('supports hover switching across dynamic main folders, nested flyout drill-down, pinning, and Escape focus restore', async () => {
    const user = userEvent.setup();
    const events = createMockBookmarkEvents();

    const treeData: chrome.bookmarks.BookmarkTreeNode[] = [
      {
        id: '0',
        title: '',
        syncing: false,
        children: [
          {
            id: '1',
            parentId: '0',
            title: 'Bookmarks bar',
            syncing: false,
            children: [
              {
                id: '101',
                parentId: '1',
                title: 'COURSE-',
                syncing: false,
                children: [
                  {
                    id: '101-1',
                    parentId: '101',
                    title: 'Algorithms',
                    syncing: false,
                    children: [
                      {
                        id: 'b-1',
                        parentId: '101-1',
                        title: 'CP-Algorithms',
                        url: 'https://cp-algorithms.com/',
                        syncing: false,
                      },
                      {
                        id: 'b-2',
                        parentId: '101-1',
                        title: 'Visualgo',
                        url: 'https://visualgo.net/',
                        syncing: false,
                      },
                    ],
                  },
                  {
                    id: 'b-3',
                    parentId: '101',
                    title: 'MIT OCW',
                    url: 'https://ocw.mit.edu/',
                    syncing: false,
                  },
                ],
              },
              {
                id: '102',
                parentId: '1',
                title: 'PROJECT-',
                syncing: false,
                children: [
                  {
                    id: 'b-4',
                    parentId: '102',
                    title: 'React Docs',
                    url: 'https://react.dev/',
                    syncing: false,
                  },
                ],
              },
              {
                id: '105',
                parentId: '1',
                title: 'OTHERS',
                syncing: false,
                children: [],
              },
              {
                id: 'loose-1',
                parentId: '1',
                title: 'Unorganized Root Link',
                url: 'https://news.ycombinator.com/',
                syncing: false,
              },
            ],
          },
          {
            id: '2',
            parentId: '0',
            title: 'Other bookmarks',
            syncing: false,
            children: [
              {
                id: 'loose-2',
                parentId: '2',
                title: 'Unorganized Other Link',
                url: 'https://example.org/',
                syncing: false,
              },
            ],
          },
        ],
      },
    ];

    const snapshot = normalizeChromeBookmarkTree(treeData);
    const mainFolders = getInitialMainFolders(snapshot);
    expect(mainFolders.map((f) => [f.title, f.bookmarkCount])).toEqual([
      ['COURSE-', 3],
      ['PROJECT-', 1],
      ['OTHERS', 0],
    ]);

    (globalThis as unknown as { chrome: unknown }).chrome = {
      permissions: {
        contains: vi.fn(() => Promise.resolve(true)),
        request: vi.fn(() => Promise.resolve(true)),
      },
      bookmarks: {
        getTree: vi.fn(() => Promise.resolve(treeData)),
        onCreated: events.onCreated,
        onRemoved: events.onRemoved,
        onChanged: events.onChanged,
        onMoved: events.onMoved,
        onChildrenReordered: events.onChildrenReordered,
        onImportEnded: events.onImportEnded,
      },
    };

    const triggerRef = createRef<HTMLButtonElement>();
    const onOpenChange = vi.fn();

    render(
      <TooltipProvider>
        <div>
          <button ref={triggerRef} type="button">
            Bookmarks Trigger
          </button>
          <BookmarksDrawer open onOpenChange={onOpenChange} triggerRef={triggerRef} />
        </div>
      </TooltipProvider>,
    );

    const courseBtn = await screen.findByRole('button', { name: /COURSE-/i });
    const projectBtn = screen.getByRole('button', { name: /PROJECT-/i });
    const othersBtn = screen.getByRole('button', { name: /OTHERS/i });

    // Chrome wrappers & loose root links stay hidden from initial sidebar view
    expect(screen.queryByRole('button', { name: /Bookmarks bar/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Unorganized Root Link')).not.toBeInTheDocument();
    expect(within(courseBtn).getByText('3')).toBeInTheDocument();

    // Hovering COURSE- opens COURSE- flyout dynamically
    await user.hover(courseBtn);
    expect(screen.getByRole('region', { name: 'COURSE- bookmarks' })).toBeInTheDocument();
    expect(screen.getByText('MIT OCW')).toBeInTheDocument();

    // Moving hover directly to PROJECT- switches adjacent flyout smoothly
    await user.hover(projectBtn);
    expect(screen.getByRole('region', { name: 'PROJECT- bookmarks' })).toBeInTheDocument();
    expect(screen.getByText('React Docs')).toBeInTheDocument();
    expect(screen.queryByText('MIT OCW')).not.toBeInTheDocument();

    // Clicking COURSE- pins it and allows drilling into nested Algorithms subfolder inside flyout
    await user.click(courseBtn);
    const algoBtn = screen.getByRole('button', { name: /Algorithms/i });
    await user.click(algoBtn);
    expect(screen.getByRole('region', { name: 'Algorithms bookmarks' })).toBeInTheDocument();
    expect(screen.getByText('CP-Algorithms')).toBeInTheDocument();
    expect(screen.getByText('Visualgo')).toBeInTheDocument();

    // Back button inside flyout steps up to COURSE-
    await user.click(screen.getByRole('button', { name: 'Back to parent folder' }));
    expect(screen.getByText('MIT OCW')).toBeInTheDocument();

    // Explicit Back to folders collapses flyout cleanly back to folder-only sidebar
    await user.click(screen.getByRole('button', { name: 'Back to folders' }));
    expect(screen.queryByText('MIT OCW')).not.toBeInTheDocument();

    // Hovering empty folder shows helpful empty notice inside flyout
    await user.hover(othersBtn);
    expect(screen.getByText('This folder has no bookmarks yet.')).toBeInTheDocument();

    // Pressing Escape closes sidebar & returns focus cleanly to Bookmarks trigger
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(triggerRef.current).toHaveFocus();
  });
});
