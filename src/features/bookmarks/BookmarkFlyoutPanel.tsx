import { type KeyboardEvent as ReactKeyboardEvent, useRef } from 'react';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import { Button, IconButton } from '@/components/ui';
import type { NormalizedBookmarkFolder, NormalizedBookmarkNode } from './bookmarksService';

export interface BookmarkFlyoutPanelProps {
  /** The folder represented by this flyout panel. */
  folder: NormalizedBookmarkFolder;
  /** Nesting depth: 0 = immediate child of main folder / sidebar, 1 = subfolder, etc. */
  depth: number;
  /** Active path of folder IDs from root to deepest active folder. */
  activePath: string[];
  /** Lookup map for all folders in the snapshot. */
  foldersById: Record<string, NormalizedBookmarkFolder>;
  /** The top-level main folder anchoring this branch. */
  activeMainFolder: NormalizedBookmarkFolder;
  /** Called when a folder child in this panel is hovered. */
  onSelectFolderHover: (folderId: string, depth: number) => void;
  /** Called when a folder child in this panel is clicked. */
  onSelectFolderClick: (folderId: string, depth: number) => void;
  /** Called when a bookmark item in this panel is hovered. */
  onBookmarkHover: (depth: number) => void;
  /** Step back one level in the flyout chain. */
  onNavigateParent: () => void;
  /** Collapse all flyouts back to the sidebar. */
  onNavigateRoot: () => void;
  /** Jump directly to an ancestor in the path. */
  onNavigatePathIndex: (depthIndex: number) => void;
  /** Called when the drawer should close. */
  onOpenChange: (open: boolean) => void;
  /** Optional URL navigation callback. */
  onNavigateUrl?: (url: string) => void;
  /** Cancel any pending hover dismissal timer. */
  onMouseEnterPanel?: () => void;
  /** Favicon renderer component. */
  renderFavicon: (title: string, url: string) => React.ReactNode;
}

export function BookmarkFlyoutPanel({
  folder,
  depth,
  activePath,
  foldersById,
  activeMainFolder,
  onSelectFolderHover,
  onSelectFolderClick,
  onBookmarkHover,
  onNavigateParent,
  onNavigateRoot,
  onNavigatePathIndex,
  onOpenChange,
  onNavigateUrl,
  onMouseEnterPanel,
  renderFavicon,
}: BookmarkFlyoutPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});

  // The child folder ID selected at depth + 1 (if any)
  const childFolderId = activePath[depth + 1] ?? null;
  const childFolder: NormalizedBookmarkFolder | null =
    childFolderId && foldersById[childFolderId] ? foldersById[childFolderId] : null;

  // Breadcrumbs: path of folders from activeMainFolder down to this panel
  const breadcrumbChain: NormalizedBookmarkFolder[] = [];
  for (let i = 0; i <= depth; i++) {
    const id = activePath[i];
    if (id && foldersById[id]) {
      breadcrumbChain.push(foldersById[id]);
    }
  }

  const handleItemKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement | HTMLAnchorElement>,
    node: NormalizedBookmarkNode,
    index: number,
  ) => {
    const children = folder.children;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextNode = children[(index + 1) % children.length];
      if (nextNode) {
        itemRefs.current[nextNode.id]?.focus();
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevNode = children[(index - 1 + children.length) % children.length];
      if (prevNode) {
        itemRefs.current[prevNode.id]?.focus();
      }
    } else if (event.key === 'ArrowRight' && node.kind === 'folder') {
      event.preventDefault();
      onSelectFolderClick(node.id, depth + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (depth > 0) {
        onNavigateParent();
      } else {
        onNavigateRoot();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (depth > 0) {
        onNavigateParent();
      } else {
        onNavigateRoot();
      }
    }
  };

  return (
    <div className="flex flex-col items-start gap-2.5 sm:flex-row">
      <section
        ref={panelRef}
        role="region"
        aria-label={`${folder.title} bookmarks`}
        onMouseEnter={onMouseEnterPanel}
        className="aurora-glass-elevated flex max-h-[calc(100dvh-5.25rem)] w-full flex-col overflow-hidden border border-[var(--aurora-border)] shadow-2xl transition-all duration-[var(--aurora-duration-fast)] motion-reduce:transition-none sm:w-88 md:w-96"
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--aurora-border)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {depth > 0 && (
              <IconButton
                icon="arrow_back"
                label="Back to parent folder"
                size="sm"
                onClick={onNavigateParent}
              />
            )}
            <div className="min-w-0">
              <h3 className="truncate font-[var(--font-display)] text-sm font-semibold text-[var(--aurora-text)]">
                {folder.title}
              </h3>
              <p className="truncate text-[11px] text-[var(--aurora-text-muted)]">
                {folder.bookmarkCount} {folder.bookmarkCount === 1 ? 'bookmark' : 'bookmarks'}
                {depth > 0 ? ` • inside ${activeMainFolder.title}` : ''}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {depth === 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Back to folders"
                onClick={onNavigateRoot}
                className="h-7 shrink-0 px-2 text-[11px]"
              >
                <MaterialSymbol name="close" size={14} />
                <span className="hidden sm:inline">Folders</span>
              </Button>
            ) : (
              <IconButton
                icon="close"
                label={`Close ${folder.title} folder`}
                size="sm"
                onClick={onNavigateParent}
              />
            )}
          </div>
        </div>

        {/* Breadcrumb Navigation when deeply nested */}
        {breadcrumbChain.length > 1 && (
          <nav
            aria-label="Bookmark folder breadcrumbs"
            className="flex flex-wrap items-center gap-1 border-b border-[var(--aurora-border)] bg-[var(--aurora-surface)]/30 px-4 py-2 text-[11px] text-[var(--aurora-text-secondary)]"
          >
            {breadcrumbChain.map((sub, idx) => {
              const isCurrent = idx === breadcrumbChain.length - 1;
              return (
                <span key={sub.id} className="inline-flex items-center gap-1">
                  {idx > 0 && <MaterialSymbol name="chevron_right" size={13} />}
                  <button
                    type="button"
                    onClick={() => onNavigatePathIndex(idx)}
                    aria-current={isCurrent ? 'location' : undefined}
                    className={`aurora-focus-ring cursor-pointer rounded px-1.5 py-0.5 transition-colors hover:text-[var(--aurora-text)] ${
                      isCurrent ? 'font-semibold text-[var(--aurora-primary)]' : ''
                    }`}
                  >
                    {sub.title}
                  </button>
                </span>
              );
            })}
          </nav>
        )}

        {/* Folder Content Listing */}
        <div className="flex-1 overflow-y-auto p-3">
          {folder.children.length === 0 ? (
            <div className="rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/30 p-6 text-center text-xs text-[var(--aurora-text-secondary)]">
              This folder has no bookmarks yet.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--aurora-border)] overflow-hidden rounded-2xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/35">
              {folder.children.map((node, index) => {
                if (node.kind === 'folder') {
                  const isExpanded = childFolderId === node.id;
                  return (
                    <li key={node.id}>
                      <button
                        ref={(el) => {
                          itemRefs.current[node.id] = el;
                        }}
                        type="button"
                        aria-expanded={isExpanded}
                        aria-haspopup="true"
                        onPointerEnter={(e) => {
                          if (e.pointerType !== 'touch') {
                            onSelectFolderHover(node.id, depth + 1);
                          }
                        }}
                        onMouseEnter={() => onSelectFolderHover(node.id, depth + 1)}
                        onClick={() => onSelectFolderClick(node.id, depth + 1)}
                        onKeyDown={(e) => handleItemKeyDown(e, node, index)}
                        className={`aurora-focus-ring flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors ${
                          isExpanded
                            ? 'border-l-2 border-[var(--aurora-border-highlight)] bg-[var(--aurora-primary)]/14 text-[var(--aurora-text)]'
                            : 'hover:bg-[var(--aurora-surface-elevated)]/60 text-[var(--aurora-text)]'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <MaterialSymbol
                            name={isExpanded ? 'folder_open' : 'folder'}
                            size={17}
                            className="shrink-0 text-[var(--aurora-primary)]"
                          />
                          <span className="truncate text-xs font-medium">{node.title}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-[var(--aurora-text-muted)]">
                          <span>{node.bookmarkCount}</span>
                          <MaterialSymbol name="chevron_right" size={16} />
                        </div>
                      </button>
                    </li>
                  );
                }

                // Bookmark Item
                return (
                  <li
                    key={node.id}
                    onMouseEnter={() => onBookmarkHover(depth + 1)}
                    className="flex items-center justify-between gap-2 px-3 py-2 transition-colors hover:bg-[var(--aurora-surface-elevated)]/60"
                  >
                    <a
                      ref={(el) => {
                        itemRefs.current[node.id] = el;
                      }}
                      href={node.url}
                      onClick={(e) => {
                        if (onNavigateUrl) {
                          e.preventDefault();
                          onNavigateUrl(node.url);
                          onOpenChange(false);
                        }
                      }}
                      onKeyDown={(e) => handleItemKeyDown(e, node, index)}
                      className="aurora-focus-ring flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-0.5"
                    >
                      {renderFavicon(node.title, node.url)}
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
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Recursive Render of Next Nested Child Flyout Panel */}
      {childFolder && (
        <BookmarkFlyoutPanel
          folder={childFolder}
          depth={depth + 1}
          activePath={activePath}
          foldersById={foldersById}
          activeMainFolder={activeMainFolder}
          onSelectFolderHover={onSelectFolderHover}
          onSelectFolderClick={onSelectFolderClick}
          onBookmarkHover={onBookmarkHover}
          onNavigateParent={onNavigateParent}
          onNavigateRoot={onNavigateRoot}
          onNavigatePathIndex={onNavigatePathIndex}
          onOpenChange={onOpenChange}
          onNavigateUrl={onNavigateUrl}
          onMouseEnterPanel={onMouseEnterPanel}
          renderFavicon={renderFavicon}
        />
      )}
    </div>
  );
}
