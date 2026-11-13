import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import { Button, IconButton, SearchInput, Skeleton, useToastStore } from '@/components/ui';
import { openBookmarksManager } from '@/features/navigation/navDestinations';
import { getExtensionFaviconUrl, getShortcutMonogram } from '@/features/shortcuts/shortcutUtils';
import { useWorkspaceStore } from '@/state/workspaceStore';
import { sanitizeHttpUrl } from '@/utils/url';
import {
  checkBookmarksPermission,
  requestBookmarksPermission,
  subscribeBookmarksPermissionRemoval,
  type BookmarksPermissionState,
} from './bookmarksPermissions';
import {
  fetchChromeBookmarksTree,
  getInitialMainFolders,
  searchBookmarksSnapshot,
  subscribeToChromeBookmarkEvents,
  type BookmarksTreeSnapshot,
  type NormalizedBookmarkFolder,
} from './bookmarksService';

export interface BookmarksDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (url: string) => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}

function BookmarkFavicon({ title, url }: { title: string; url: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const faviconUrl = getExtensionFaviconUrl(url);

  if (faviconUrl && failedUrl !== faviconUrl) {
    return (
      <img
        src={faviconUrl}
        alt=""
        width={18}
        height={18}
        loading="lazy"
        decoding="async"
        onError={() => setFailedUrl(faviconUrl)}
        className="h-4.5 w-4.5 shrink-0 rounded object-contain"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--aurora-primary)]/18 text-[10px] font-semibold text-[var(--aurora-primary)]"
    >
      {getShortcutMonogram(title, url)}
    </span>
  );
}

export function BookmarksDrawer(props: BookmarksDrawerProps) {
  if (!props.open) {
    return null;
  }

  return <BookmarksDrawerPanel {...props} />;
}

function BookmarksDrawerPanel({
  open,
  onOpenChange,
  onNavigate,
  triggerRef,
}: BookmarksDrawerProps) {
  const activeProfile = useWorkspaceStore((s) => s.workspace.profiles[s.workspace.activeProfileId]);
  const pushToast = useToastStore((s) => s.push);

  const [permissionState, setPermissionState] = useState<BookmarksPermissionState>('denied');
  const [permissionNote, setPermissionNote] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<BookmarksTreeSnapshot | null>(null);

  // Hover & click/pin state for the Left Folder Sidebar -> Right Flyout interaction
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
  const [pinnedFolderId, setPinnedFolderId] = useState<string | null>(null);
  const [flyoutSubpathIds, setFlyoutSubpathIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCuratedInGranted, setShowCuratedInGranted] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const folderButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const hoverClearTimerRef = useRef<number | null>(null);

  const cancelHoverClear = useCallback(() => {
    if (hoverClearTimerRef.current !== null) {
      window.clearTimeout(hoverClearTimerRef.current);
      hoverClearTimerRef.current = null;
    }
  }, []);

  const scheduleHoverClear = useCallback(() => {
    cancelHoverClear();
    hoverClearTimerRef.current = window.setTimeout(() => {
      setHoveredFolderId(null);
    }, 120);
  }, [cancelHoverClear]);

  useEffect(() => {
    return () => {
      cancelHoverClear();
    };
  }, [cancelHoverClear]);

  const loadTree = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const next = await fetchChromeBookmarksTree();
      setSnapshot(next);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Unable to read Chrome bookmarks tree.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let cancelled = false;

    const bootstrap = async () => {
      const status = await checkBookmarksPermission();
      if (cancelled) return;
      setPermissionNote(null);
      setPermissionState(status);
      if (status === 'granted') {
        await loadTree();
      } else {
        setSnapshot(null);
      }
    };

    void bootstrap();

    const unsubRevoke = subscribeBookmarksPermissionRemoval(() => {
      if (cancelled) return;
      setPermissionState('denied');
      setSnapshot(null);
      setHoveredFolderId(null);
      setPinnedFolderId(null);
      setFlyoutSubpathIds([]);
      setPermissionNote('Chrome Bookmarks permission was revoked.');
    });

    return () => {
      cancelled = true;
      unsubRevoke();
    };
  }, [open, loadTree]);

  useEffect(() => {
    if (!open || permissionState !== 'granted') {
      return undefined;
    }

    return subscribeToChromeBookmarkEvents(() => {
      void loadTree();
    });
  }, [open, permissionState, loadTree]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (triggerRef?.current?.contains(target)) return;
      onOpenChange(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
        triggerRef?.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onOpenChange, triggerRef]);

  const handleEnableBookmarks = async () => {
    setIsRequesting(true);
    setPermissionNote(null);
    const result = await requestBookmarksPermission();
    setIsRequesting(false);

    if (result.granted) {
      setPermissionState('granted');
      await loadTree();
    } else {
      setPermissionState(result.unavailable ? 'unavailable' : 'denied');
      setPermissionNote(result.reason ?? 'Bookmarks access was not granted.');
    }
  };

  const curatedBookmarks = useMemo(() => {
    const raw = activeProfile?.navigation.curatedBookmarks ?? [];
    return raw
      .map((item) => {
        const clean = sanitizeHttpUrl(item.url);
        return clean ? { ...item, url: clean } : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [activeProfile]);

  const mainFolders = useMemo(() => {
    if (!snapshot) return [];
    return getInitialMainFolders(snapshot);
  }, [snapshot]);

  const activeMainFolderId = hoveredFolderId ?? pinnedFolderId;

  const activeMainFolder: NormalizedBookmarkFolder | null = useMemo(() => {
    if (!snapshot || !activeMainFolderId) return null;
    return mainFolders.find((f) => f.id === activeMainFolderId) ?? null;
  }, [snapshot, mainFolders, activeMainFolderId]);

  const flyoutBreadcrumbTrail = useMemo(() => {
    if (!snapshot || !activeMainFolder) return [];
    return flyoutSubpathIds
      .map((id) => snapshot.foldersById[id])
      .filter((folder): folder is NormalizedBookmarkFolder => Boolean(folder));
  }, [snapshot, activeMainFolder, flyoutSubpathIds]);

  const activeFlyoutFolder: NormalizedBookmarkFolder | null = useMemo(() => {
    if (!activeMainFolder) return null;
    if (flyoutBreadcrumbTrail.length === 0) return activeMainFolder;
    return flyoutBreadcrumbTrail[flyoutBreadcrumbTrail.length - 1] ?? activeMainFolder;
  }, [activeMainFolder, flyoutBreadcrumbTrail]);

  const searchResults = useMemo(() => {
    if (!snapshot || !searchQuery.trim()) return null;
    return searchBookmarksSnapshot(snapshot, searchQuery, 120);
  }, [snapshot, searchQuery]);

  const handleSelectMainFolderHover = (folderId: string) => {
    cancelHoverClear();
    if (hoveredFolderId !== folderId) {
      setFlyoutSubpathIds([]);
    }
    setHoveredFolderId(folderId);
  };

  const handleClickMainFolder = (folderId: string) => {
    cancelHoverClear();
    if (pinnedFolderId === folderId && !hoveredFolderId) {
      setPinnedFolderId(null);
      setFlyoutSubpathIds([]);
      return;
    }
    if (pinnedFolderId !== folderId) {
      setFlyoutSubpathIds([]);
    }
    setPinnedFolderId(folderId);
    setHoveredFolderId(folderId);
  };

  const handleReturnToFolders = () => {
    cancelHoverClear();
    const restoreFocusId = activeMainFolderId;
    setPinnedFolderId(null);
    setHoveredFolderId(null);
    setFlyoutSubpathIds([]);
    if (restoreFocusId) {
      folderButtonRefs.current[restoreFocusId]?.focus();
    }
  };

  const handleFolderKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
    folderId: string,
  ) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextFolder = mainFolders[(index + 1) % mainFolders.length];
      if (nextFolder) {
        folderButtonRefs.current[nextFolder.id]?.focus();
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevFolder = mainFolders[(index - 1 + mainFolders.length) % mainFolders.length];
      if (prevFolder) {
        folderButtonRefs.current[prevFolder.id]?.focus();
      }
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setPinnedFolderId(folderId);
      setHoveredFolderId(folderId);
      setFlyoutSubpathIds([]);
    } else if (event.key === 'ArrowLeft') {
      if (activeMainFolderId) {
        event.preventDefault();
        handleReturnToFolders();
      }
    }
  };

  const handleOpenChromeManager = () => {
    const opened = openBookmarksManager();
    if (!opened) {
      pushToast({
        title: 'Chrome Bookmarks Page',
        description:
          'chrome://bookmarks/ opens directly when running as an unpacked Chrome extension.',
        variant: 'info',
      });
    }
  };

  if (!open) {
    return null;
  }

  const curatedSection = (
    <section aria-label="Curated quick bookmarks" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
          Curated Workspace Links
        </h3>
        <span className="text-[10px] text-[var(--aurora-text-muted)]">Always Local</span>
      </div>

      {curatedBookmarks.length === 0 ? (
        <p className="rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/30 px-3 py-2.5 text-xs text-[var(--aurora-text-secondary)]">
          No curated bookmarks configured for this profile yet.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {curatedBookmarks.map((bm) => (
            <a
              key={bm.id}
              href={bm.url}
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate(bm.url);
                  onOpenChange(false);
                }
              }}
              className="aurora-focus-ring inline-flex items-center gap-2 rounded-full border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/50 px-3 py-1.5 text-xs font-medium text-[var(--aurora-text)] transition-colors hover:border-[var(--aurora-border-highlight)]"
            >
              <BookmarkFavicon title={bm.title} url={bm.url} />
              <span>{bm.title}</span>
            </a>
          ))}
        </div>
      )}
    </section>
  );

  const showFlyout = permissionState === 'granted' && !searchResults && Boolean(activeFlyoutFolder);

  return (
    <div
      ref={wrapperRef}
      role="dialog"
      aria-label="Bookmarks Library"
      onMouseLeave={scheduleHoverClear}
      onMouseEnter={cancelHoverClear}
      className="fixed top-16 right-4 left-4 z-[70] flex flex-col items-start gap-2.5 sm:right-auto sm:left-6 md:flex-row"
    >
      {/* Left Floating Folder Sidebar */}
      <aside
        aria-label="Bookmarks sidebar"
        className="aurora-glass-elevated flex max-h-[calc(100dvh-5.25rem)] w-full flex-col overflow-hidden border border-[var(--aurora-border)] shadow-2xl sm:w-80"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--aurora-border)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--aurora-primary)]/16 text-[var(--aurora-primary)]">
              <MaterialSymbol name="bookmarks" size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-[var(--font-display)] text-sm font-semibold text-[var(--aurora-text)]">
                Bookmarks
              </h2>
              <p className="truncate text-[11px] text-[var(--aurora-text-muted)]">
                {permissionState === 'granted' && snapshot
                  ? `${mainFolders.length} folders • ${snapshot.totalBookmarks} saved`
                  : 'Curated & optional Chrome sync'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {permissionState === 'granted' && (
              <IconButton
                icon="refresh"
                label="Refresh bookmarks"
                size="sm"
                onClick={() => void loadTree()}
                disabled={isLoading}
              />
            )}
            <IconButton
              icon="open_in_new"
              label="Open Chrome Bookmarks Manager"
              size="sm"
              onClick={handleOpenChromeManager}
            />
            <IconButton
              icon="close"
              label="Close bookmarks"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                triggerRef?.current?.focus();
              }}
            />
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-3.5">
          {permissionState !== 'granted' ? (
            <>
              {curatedSection}

              <section
                aria-label="Chrome Bookmarks integration"
                className="space-y-3 border-t border-[var(--aurora-border)] pt-3.5"
              >
                <div className="flex items-start gap-2.5 rounded-2xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/45 p-3.5">
                  <MaterialSymbol
                    name="verified_user"
                    size={20}
                    className="mt-0.5 shrink-0 text-[var(--aurora-primary)]"
                  />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-[var(--aurora-text)]">
                      Read-Only Optional Chrome Bookmarks Sync
                    </p>
                    <p className="text-[11px] leading-relaxed text-[var(--aurora-text-secondary)]">
                      Deckora keeps browser permissions minimal by default. Grant optional{' '}
                      <code className="rounded bg-black/25 px-1 py-0.5 text-[10px]">bookmarks</code>{' '}
                      permission to browse folders in the sidebar and search Chrome bookmarks
                      locally.
                    </p>
                  </div>
                </div>

                {permissionNote && (
                  <p role="status" className="text-xs text-[var(--aurora-warning)]">
                    {permissionNote}
                  </p>
                )}

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={isRequesting}
                  onClick={() => void handleEnableBookmarks()}
                  className="w-full"
                >
                  <MaterialSymbol name="lock_open" size={15} />
                  <span>{isRequesting ? 'Requesting Access...' : 'Enable Chrome Bookmarks'}</span>
                </Button>
              </section>
            </>
          ) : (
            <>
              <SearchInput
                ref={searchInputRef}
                aria-label="Search Chrome bookmarks"
                placeholder="Search bookmarks across folders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery('')}
              />

              {isLoading && !snapshot && (
                <div className="space-y-2" aria-label="Loading bookmarks">
                  <Skeleton className="h-9 w-full rounded-xl" />
                  <Skeleton className="h-9 w-full rounded-xl" />
                  <Skeleton className="h-9 w-full rounded-xl" />
                </div>
              )}

              {loadError && (
                <div
                  role="alert"
                  className="flex items-center justify-between gap-2 rounded-xl border border-[var(--aurora-error)]/40 bg-[var(--aurora-error)]/12 px-3 py-2.5 text-xs text-[var(--aurora-error)]"
                >
                  <span>{loadError}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => void loadTree()}>
                    Retry
                  </Button>
                </div>
              )}

              {snapshot && searchResults ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-[var(--aurora-text-muted)]">
                    <span>
                      {searchResults.totalMatches}{' '}
                      {searchResults.totalMatches === 1 ? 'match' : 'matches'}
                      {searchResults.totalMatches > searchResults.matches.length
                        ? ` (showing first ${searchResults.matches.length})`
                        : ''}
                    </span>
                  </div>

                  {searchResults.matches.length === 0 ? (
                    <div className="rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/30 p-5 text-center text-xs text-[var(--aurora-text-secondary)]">
                      No Chrome bookmarks matched &ldquo;{searchQuery.trim()}&rdquo;.
                    </div>
                  ) : (
                    <ul className="divide-y divide-[var(--aurora-border)] overflow-hidden rounded-2xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/35">
                      {searchResults.matches.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 transition-colors hover:bg-[var(--aurora-surface-elevated)]/60"
                        >
                          <a
                            href={item.url}
                            onClick={(e) => {
                              if (onNavigate) {
                                e.preventDefault();
                                onNavigate(item.url);
                                onOpenChange(false);
                              }
                            }}
                            className="aurora-focus-ring flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-0.5"
                          >
                            <BookmarkFavicon title={item.title} url={item.url} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-[var(--aurora-text)]">
                                {item.title}
                              </p>
                              <p className="truncate text-[10px] text-[var(--aurora-text-muted)]">
                                {item.hostname}
                                {item.pathLabels.length > 0
                                  ? ` • ${item.pathLabels.join(' / ')}`
                                  : ''}
                              </p>
                            </div>
                          </a>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${item.title} in new tab`}
                            className="aurora-focus-ring inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--aurora-text-muted)] transition-colors hover:bg-[var(--aurora-surface)] hover:text-[var(--aurora-text)]"
                          >
                            <MaterialSymbol name="open_in_new" size={14} />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                snapshot && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
                        Folders
                      </span>
                      <span className="text-[10px] text-[var(--aurora-text-muted)]">
                        Hover or click to browse
                      </span>
                    </div>

                    {mainFolders.length === 0 ? (
                      <div className="rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/30 p-5 text-center text-xs text-[var(--aurora-text-secondary)]">
                        No top-level bookmark folders found yet. Use search above or organize
                        folders in Chrome Manager.
                      </div>
                    ) : (
                      <ul role="list" aria-label="Chrome bookmark folders" className="space-y-1">
                        {mainFolders.map((folder, idx) => {
                          const isActive = activeMainFolderId === folder.id;
                          const isPinned = pinnedFolderId === folder.id;
                          return (
                            <li key={folder.id}>
                              <button
                                ref={(el) => {
                                  folderButtonRefs.current[folder.id] = el;
                                }}
                                type="button"
                                aria-expanded={isActive}
                                aria-current={isPinned ? 'true' : undefined}
                                onPointerEnter={(e) => {
                                  if (e.pointerType !== 'touch') {
                                    handleSelectMainFolderHover(folder.id);
                                  }
                                }}
                                onMouseEnter={() => handleSelectMainFolderHover(folder.id)}
                                onClick={() => handleClickMainFolder(folder.id)}
                                onKeyDown={(e) => handleFolderKeyDown(e, idx, folder.id)}
                                className={`aurora-focus-ring flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-all duration-[var(--aurora-duration-fast)] ${
                                  isActive
                                    ? 'border-[var(--aurora-border-highlight)] bg-[var(--aurora-primary)]/14 text-[var(--aurora-text)]'
                                    : 'border-transparent hover:border-[var(--aurora-border)] hover:bg-[var(--aurora-surface)]/55 text-[var(--aurora-text)]'
                                }`}
                              >
                                <span className="flex min-w-0 items-center gap-2.5">
                                  <MaterialSymbol
                                    name={isActive ? 'folder_open' : 'folder'}
                                    size={18}
                                    className="shrink-0 text-[var(--aurora-primary)]"
                                  />
                                  <span className="truncate text-xs font-medium">
                                    {folder.title}
                                  </span>
                                </span>
                                <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-[var(--aurora-text-muted)]">
                                  <span>{folder.bookmarkCount}</span>
                                  <MaterialSymbol name="chevron_right" size={16} />
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )
              )}

              {showCuratedInGranted && (
                <div className="border-t border-[var(--aurora-border)] pt-3">{curatedSection}</div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--aurora-border)] px-4 py-2.5">
          <span className="truncate text-[10px] text-[var(--aurora-text-muted)]">
            {permissionState === 'granted'
              ? 'Read-only local Chrome sync'
              : 'Curated local mode (zero permissions)'}
          </span>
          {permissionState === 'granted' && (
            <button
              type="button"
              onClick={() => setShowCuratedInGranted((prev) => !prev)}
              className="aurora-focus-ring shrink-0 cursor-pointer rounded-md px-2 py-0.5 text-[10px] font-medium text-[var(--aurora-primary)] transition-colors hover:bg-[var(--aurora-surface)]"
            >
              {showCuratedInGranted ? 'Hide Links' : 'Workspace Links'}
            </button>
          )}
        </div>
      </aside>

      {/* Adjacent Floating Bookmark Contents Flyout */}
      {showFlyout && activeFlyoutFolder && activeMainFolder && (
        <section
          aria-label={`${activeFlyoutFolder.title} bookmarks`}
          onMouseEnter={cancelHoverClear}
          className="aurora-glass-elevated flex max-h-[calc(100dvh-5.25rem)] w-full flex-col overflow-hidden border border-[var(--aurora-border)] shadow-2xl sm:w-88 md:w-96"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--aurora-border)] px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              {flyoutBreadcrumbTrail.length > 0 && (
                <IconButton
                  icon="arrow_back"
                  label="Back to parent folder"
                  size="sm"
                  onClick={() => setFlyoutSubpathIds((prev) => prev.slice(0, -1))}
                />
              )}
              <div className="min-w-0">
                <h3 className="truncate font-[var(--font-display)] text-sm font-semibold text-[var(--aurora-text)]">
                  {activeFlyoutFolder.title}
                </h3>
                <p className="truncate text-[11px] text-[var(--aurora-text-muted)]">
                  {activeFlyoutFolder.bookmarkCount}{' '}
                  {activeFlyoutFolder.bookmarkCount === 1 ? 'bookmark' : 'bookmarks'}
                  {flyoutBreadcrumbTrail.length > 0 ? ` • inside ${activeMainFolder.title}` : ''}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Back to folders"
              onClick={handleReturnToFolders}
              className="h-7 shrink-0 px-2 text-[11px]"
            >
              <MaterialSymbol name="close" size={14} />
              <span className="hidden sm:inline">Folders</span>
            </Button>
          </div>

          {flyoutBreadcrumbTrail.length > 0 && (
            <nav
              aria-label="Bookmark folder breadcrumbs"
              className="flex flex-wrap items-center gap-1 border-b border-[var(--aurora-border)] bg-[var(--aurora-surface)]/30 px-4 py-2 text-[11px] text-[var(--aurora-text-secondary)]"
            >
              <button
                type="button"
                onClick={() => setFlyoutSubpathIds([])}
                className="aurora-focus-ring cursor-pointer rounded px-1.5 py-0.5 hover:text-[var(--aurora-text)]"
              >
                {activeMainFolder.title}
              </button>
              {flyoutBreadcrumbTrail.map((sub, idx) => (
                <span key={sub.id} className="inline-flex items-center gap-1">
                  <MaterialSymbol name="chevron_right" size={13} />
                  <button
                    type="button"
                    onClick={() =>
                      setFlyoutSubpathIds(
                        flyoutBreadcrumbTrail.slice(0, idx + 1).map((item) => item.id),
                      )
                    }
                    className={`aurora-focus-ring cursor-pointer rounded px-1.5 py-0.5 hover:text-[var(--aurora-text)] ${
                      idx === flyoutBreadcrumbTrail.length - 1
                        ? 'font-semibold text-[var(--aurora-primary)]'
                        : ''
                    }`}
                  >
                    {sub.title}
                  </button>
                </span>
              ))}
            </nav>
          )}

          <div className="flex-1 overflow-y-auto p-3">
            {activeFlyoutFolder.children.length === 0 ? (
              <div className="rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/30 p-6 text-center text-xs text-[var(--aurora-text-secondary)]">
                This folder has no bookmarks yet.
              </div>
            ) : (
              <ul className="divide-y divide-[var(--aurora-border)] overflow-hidden rounded-2xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/35">
                {activeFlyoutFolder.children.map((node) =>
                  node.kind === 'folder' ? (
                    <li key={node.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPinnedFolderId(activeMainFolder.id);
                          setFlyoutSubpathIds((prev) => [...prev, node.id]);
                        }}
                        className="aurora-focus-ring flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[var(--aurora-surface-elevated)]/60"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <MaterialSymbol
                            name="folder"
                            size={17}
                            className="shrink-0 text-[var(--aurora-primary)]"
                          />
                          <span className="truncate text-xs font-medium text-[var(--aurora-text)]">
                            {node.title}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-[var(--aurora-text-muted)]">
                          <span>{node.bookmarkCount}</span>
                          <MaterialSymbol name="chevron_right" size={16} />
                        </div>
                      </button>
                    </li>
                  ) : (
                    <li
                      key={node.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 transition-colors hover:bg-[var(--aurora-surface-elevated)]/60"
                    >
                      <a
                        href={node.url}
                        onClick={(e) => {
                          if (onNavigate) {
                            e.preventDefault();
                            onNavigate(node.url);
                            onOpenChange(false);
                          }
                        }}
                        className="aurora-focus-ring flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-0.5"
                      >
                        <BookmarkFavicon title={node.title} url={node.url} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-[var(--aurora-text)]">
                            {node.title}
                          </p>
                          <p className="truncate text-[10px] text-[var(--aurora-text-muted)]">
                            {node.hostname}
                          </p>
                        </div>
                      </a>
                      <a
                        href={node.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${node.title} in new tab`}
                        className="aurora-focus-ring inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--aurora-text-muted)] transition-colors hover:bg-[var(--aurora-surface)] hover:text-[var(--aurora-text)]"
                      >
                        <MaterialSymbol name="open_in_new" size={14} />
                      </a>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
