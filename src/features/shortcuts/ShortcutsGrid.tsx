import { useEffect, useMemo, useRef, useState } from 'react';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
  IconButton,
  useToastStore,
} from '@/components/ui';
import { DEFAULT_SHORTCUTS_ELEMENT_ID, DEFAULT_SHORTCUT_ITEMS } from '@/services/storage/defaults';
import { parseShortcutsProps } from '@/services/storage/schemas';
import { useWorkspaceStore } from '@/state/workspaceStore';
import type { ShortcutItem, ShortcutsElementProps } from '@/types/workspace';
import { sanitizeHttpUrl } from '@/utils/url';
import { ShortcutDialog } from './ShortcutDialog';
import { ShortcutFavicon } from './ShortcutFavicon';

export interface ShortcutsGridProps {
  elementId?: string;
  propsOverride?: Record<string, unknown>;
  embeddedInCanvas?: boolean;
  editPreview?: boolean;
  onNavigate?: (url: string) => void;
}

const ICON_SHAPE_CLASS: Record<ShortcutsElementProps['iconShape'], string> = {
  squircle: 'rounded-2xl',
  circle: 'rounded-full',
  square: 'rounded-lg',
};

const COLUMNS_CLASS: Record<ShortcutsElementProps['columns'], string> = {
  auto: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
};

export function ShortcutsGrid({
  elementId = DEFAULT_SHORTCUTS_ELEMENT_ID,
  propsOverride,
  embeddedInCanvas = false,
  editPreview = false,
  onNavigate,
}: ShortcutsGridProps) {
  const storeShortcutsProps = useWorkspaceStore(
    (s) => s.workspace.profiles[s.workspace.activeProfileId]?.layout.elements[elementId]?.props,
  );
  const rawShortcutsProps = propsOverride ?? storeShortcutsProps;
  const updateElementProps = useWorkspaceStore((s) => s.updateActiveProfileElementProps);
  const pushToast = useToastStore((s) => s.push);

  const shortcutsProps: ShortcutsElementProps = useMemo(
    () => parseShortcutsProps(rawShortcutsProps, DEFAULT_SHORTCUT_ITEMS),
    [rawShortcutsProps],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editingShortcut, setEditingShortcut] = useState<ShortcutItem | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  const isVertical = shortcutsProps.orientation === 'vertical';

  useEffect(() => {
    if (!isVertical) return undefined;
    const node = sectionRef.current;
    if (!node) return undefined;

    const measure = () => {
      setContainerHeight(node.clientHeight);
    };
    measure();

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [isVertical]);

  const persistItems = (nextItems: ShortcutItem[], feedback?: string) => {
    void updateElementProps(elementId, { items: nextItems }).then(() => {
      if (feedback) {
        pushToast({ title: feedback, variant: 'success' });
      }
    });
  };

  const handleOpenAdd = () => {
    setDialogMode('add');
    setEditingShortcut(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: ShortcutItem) => {
    setDialogMode('edit');
    setEditingShortcut(item);
    setDialogOpen(true);
  };

  const handleRemove = (id: string, title: string) => {
    const nextItems = shortcutsProps.items.filter((item) => item.id !== id);
    persistItems(nextItems, `Removed "${title}"`);
  };

  const handleSaveShortcut = (savedItem: ShortcutItem) => {
    if (dialogMode === 'add') {
      persistItems([...shortcutsProps.items, savedItem], `Added "${savedItem.title}"`);
    } else {
      const nextItems = shortcutsProps.items.map((item) =>
        item.id === savedItem.id ? savedItem : item,
      );
      persistItems(nextItems, `Updated "${savedItem.title}"`);
    }
  };

  const isCompact = shortcutsProps.density === 'compact';
  const tileBoxSize = isCompact ? 'h-11 w-11' : 'h-13 w-13';
  const shapeClass = ICON_SHAPE_CLASS[shortcutsProps.iconShape];
  const gridColumnsClass = COLUMNS_CLASS[shortcutsProps.columns];

  const validShortcuts = useMemo(
    () =>
      shortcutsProps.items
        .map((shortcut) => {
          const safeHref = sanitizeHttpUrl(shortcut.url);
          return safeHref ? { shortcut, safeHref } : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    [shortcutsProps.items],
  );

  const showAddButton = !editPreview && shortcutsProps.items.length < 48;
  const totalRenderedTiles = validShortcuts.length + (showAddButton ? 1 : 0);

  const gapPx = isCompact ? 6 : 10;
  const tileRowMinHeight = (isCompact ? 56 : 68) + (shortcutsProps.showLabels ? 24 : 6);
  const measuredVerticalRows =
    embeddedInCanvas && containerHeight > tileRowMinHeight
      ? Math.max(1, Math.floor((containerHeight + gapPx) / (tileRowMinHeight + gapPx)))
      : Math.min(4, Math.max(1, totalRenderedTiles));

  const gridStyle = isVertical
    ? {
        gridAutoFlow: 'column' as const,
        gridTemplateRows: `repeat(${measuredVerticalRows}, minmax(${tileRowMinHeight}px, auto))`,
        gridAutoColumns: isCompact ? 'minmax(76px, 92px)' : 'minmax(88px, 108px)',
      }
    : embeddedInCanvas && shortcutsProps.columns === 'auto'
      ? {
          gridTemplateColumns: `repeat(auto-fill, minmax(${isCompact ? 80 : 94}px, 1fr))`,
        }
      : undefined;

  return (
    <section
      ref={sectionRef}
      aria-label="Quick shortcuts"
      data-orientation={shortcutsProps.orientation}
      className={
        embeddedInCanvas
          ? isVertical
            ? 'h-full w-full overflow-x-auto overflow-y-hidden px-1 py-0.5'
            : 'h-full w-full overflow-x-hidden overflow-y-auto px-1 py-0.5'
          : isVertical
            ? 'w-full max-w-3xl overflow-x-auto px-1 py-0.5'
            : 'w-full max-w-3xl'
      }
    >
      <div
        style={gridStyle}
        className={`grid ${isVertical ? 'w-max content-start items-start' : gridColumnsClass} ${isCompact ? 'gap-1.5' : 'gap-2.5'}`}
      >
        {validShortcuts.map(({ shortcut, safeHref }) => (
          <div
            key={shortcut.id}
            className={`group relative flex flex-col items-center rounded-2xl transition-colors duration-[var(--aurora-duration-fast)] hover:bg-[var(--aurora-surface)] ${
              isCompact ? 'p-1.5' : 'p-2'
            }`}
          >
            <a
              href={safeHref}
              target={shortcutsProps.openInNewTab && !onNavigate ? '_blank' : undefined}
              rel={shortcutsProps.openInNewTab && !onNavigate ? 'noopener noreferrer' : undefined}
              aria-label={shortcut.title}
              onClick={(event) => {
                if (onNavigate) {
                  event.preventDefault();
                  onNavigate(safeHref);
                }
              }}
              className="aurora-focus-ring flex w-full flex-col items-center gap-2 rounded-xl p-1 text-center focus-visible:outline-none"
            >
              <span
                className={`aurora-glass flex items-center justify-center transition-all duration-[var(--aurora-duration-fast)] group-hover:-translate-y-0.5 group-hover:border-[var(--aurora-border-highlight)] ${tileBoxSize} ${shapeClass}`}
              >
                <ShortcutFavicon shortcut={shortcut} />
              </span>
              {shortcutsProps.showLabels && (
                <span className="w-full truncate px-1 text-xs font-medium text-[var(--aurora-text)]">
                  {shortcut.title}
                </span>
              )}
            </a>

            {!editPreview && (
              <div className="absolute top-1.5 right-1.5 opacity-0 transition-opacity duration-[var(--aurora-duration-fast)] group-focus-within:opacity-100 group-hover:opacity-100">
                <Dropdown>
                  <DropdownTrigger asChild>
                    <IconButton
                      icon="more_vert"
                      label={`Shortcut actions for ${shortcut.title}`}
                      size="sm"
                      iconSize={16}
                      className="h-6 w-6 rounded-full bg-[var(--aurora-surface-elevated)]/80"
                    />
                  </DropdownTrigger>
                  <DropdownContent align="end">
                    <DropdownItem icon="edit" onSelect={() => handleOpenEdit(shortcut)}>
                      Edit shortcut
                    </DropdownItem>
                    <DropdownItem
                      icon="delete"
                      onSelect={() => handleRemove(shortcut.id, shortcut.title)}
                    >
                      Remove
                    </DropdownItem>
                  </DropdownContent>
                </Dropdown>
              </div>
            )}
          </div>
        ))}

        {showAddButton && (
          <div className={`flex flex-col items-center rounded-2xl ${isCompact ? 'p-1.5' : 'p-2'}`}>
            <button
              type="button"
              onClick={handleOpenAdd}
              aria-label="Add shortcut"
              className="aurora-focus-ring group flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl p-1 text-center"
            >
              <span
                className={`flex items-center justify-center border border-dashed border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 text-[var(--aurora-text-secondary)] transition-all duration-[var(--aurora-duration-fast)] group-hover:-translate-y-0.5 group-hover:border-[var(--aurora-border-highlight)] group-hover:text-[var(--aurora-primary)] ${tileBoxSize} ${shapeClass}`}
              >
                <MaterialSymbol name="add" size={22} />
              </span>
              {shortcutsProps.showLabels && (
                <span className="w-full truncate px-1 text-xs font-medium text-[var(--aurora-text-secondary)] group-hover:text-[var(--aurora-text)]">
                  Add shortcut
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      <ShortcutDialog
        open={dialogOpen}
        mode={dialogMode}
        initialShortcut={editingShortcut}
        existingItems={shortcutsProps.items}
        onOpenChange={setDialogOpen}
        onSave={handleSaveShortcut}
      />
    </section>
  );
}
