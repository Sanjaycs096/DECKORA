import { useState } from 'react';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import { IconButton } from '@/components/ui';
import { useEditorSessionStore } from '@/state/editorSessionStore';
import type { ElementType } from '@/types/workspace';

const ELEMENT_TYPE_ICONS: Record<ElementType, string> = {
  clock: 'schedule',
  search: 'search',
  shortcuts: 'apps',
  image: 'image',
  gif: 'gif_box',
  text: 'title',
  speed: 'speed',
};

export function LayersPanel() {
  const showLayersPanel = useEditorSessionStore((s) => s.showLayersPanel);
  const draftLayout = useEditorSessionStore((s) => s.draftLayout);
  const selectedElementIds = useEditorSessionStore((s) => s.selectedElementIds);

  const selectElement = useEditorSessionStore((s) => s.selectElement);
  const setElementLocked = useEditorSessionStore((s) => s.setElementLocked);
  const setElementVisibility = useEditorSessionStore((s) => s.setElementVisibility);
  const renameElement = useEditorSessionStore((s) => s.renameElement);
  const reorderLayers = useEditorSessionStore((s) => s.reorderLayers);
  const setShowLayersPanel = useEditorSessionStore((s) => s.setShowLayersPanel);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  if (!showLayersPanel || !draftLayout) return null;

  const layersTopToBottom = [...draftLayout.zOrder].reverse();
  const hasSelection = selectedElementIds.length > 0;

  const startRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameDraft(currentName);
  };

  const commitRename = () => {
    if (renamingId && renameDraft.trim()) {
      renameElement(renamingId, renameDraft.trim());
    }
    setRenamingId(null);
    setRenameDraft('');
  };

  return (
    <aside
      aria-label="Layers panel"
      className="aurora-glass-elevated fixed top-16 bottom-4 left-3 z-40 flex w-60 flex-col rounded-2xl border border-[var(--aurora-border)] shadow-[var(--glass-shadow)] sm:w-64"
    >
      <div className="flex items-center justify-between border-b border-[var(--aurora-border)] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <MaterialSymbol name="layers" size={18} className="text-[var(--aurora-primary)]" />
          <h2 className="font-[var(--font-display)] text-xs font-semibold tracking-wider text-[var(--aurora-text)] uppercase">
            Layers ({layersTopToBottom.length})
          </h2>
        </div>
        <IconButton
          icon="close"
          label="Close layers panel"
          size="sm"
          iconSize={16}
          onClick={() => setShowLayersPanel(false)}
          className="h-6 w-6 rounded-full"
        />
      </div>

      <div className="flex items-center justify-between border-b border-[var(--aurora-border)] px-2.5 py-1.5">
        <span className="text-[11px] font-medium text-[var(--aurora-text-muted)]">Stack order</span>
        <div className="flex items-center gap-0.5">
          <IconButton
            icon="flip_to_front"
            label="Bring to front"
            size="sm"
            iconSize={16}
            disabled={!hasSelection}
            onClick={() => reorderLayers('bring-to-front')}
            className="h-7 w-7"
          />
          <IconButton
            icon="arrow_upward"
            label="Bring forward"
            size="sm"
            iconSize={16}
            disabled={!hasSelection}
            onClick={() => reorderLayers('bring-forward')}
            className="h-7 w-7"
          />
          <IconButton
            icon="arrow_downward"
            label="Send backward"
            size="sm"
            iconSize={16}
            disabled={!hasSelection}
            onClick={() => reorderLayers('send-backward')}
            className="h-7 w-7"
          />
          <IconButton
            icon="flip_to_back"
            label="Send to back"
            size="sm"
            iconSize={16}
            disabled={!hasSelection}
            onClick={() => reorderLayers('send-to-back')}
            className="h-7 w-7"
          />
        </div>
      </div>

      <ul role="list" aria-label="Canvas layers" className="flex-1 space-y-1 overflow-y-auto p-2">
        {layersTopToBottom.map((id) => {
          const element = draftLayout.elements[id];
          if (!element) return null;

          const isSelected = selectedElementIds.includes(id);
          const group = element.groupId ? draftLayout.groups[element.groupId] : undefined;
          const isRenaming = renamingId === id;

          return (
            <li
              key={id}
              data-layer-id={id}
              className={`group flex items-center gap-1.5 rounded-xl border px-2 py-1.5 transition-colors ${
                isSelected
                  ? 'border-[var(--aurora-primary)]/60 bg-[var(--aurora-primary)]/12 text-[var(--aurora-text)]'
                  : 'border-transparent hover:border-[var(--aurora-border)] hover:bg-[var(--aurora-surface)]/60 text-[var(--aurora-text-secondary)]'
              }`}
            >
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={(e) =>
                  selectElement(id, {
                    toggle: e.ctrlKey || e.metaKey,
                    additive: e.shiftKey,
                  })
                }
                onDoubleClick={() => startRename(id, element.name)}
                className="aurora-focus-ring flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg py-0.5 text-left"
              >
                <MaterialSymbol
                  name={ELEMENT_TYPE_ICONS[element.type] ?? 'widgets'}
                  size={16}
                  className={
                    isSelected ? 'text-[var(--aurora-primary)]' : 'text-[var(--aurora-text-muted)]'
                  }
                />
                <div className="min-w-0 flex-1">
                  {isRenaming ? (
                    <input
                      type="text"
                      value={renameDraft}
                      autoFocus
                      aria-label={`Rename ${element.name}`}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={commitRename}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          commitRename();
                        } else if (e.key === 'Escape') {
                          setRenamingId(null);
                          setRenameDraft('');
                        }
                      }}
                      className="w-full rounded border border-[var(--aurora-primary)] bg-[var(--aurora-bg-elevated)] px-1.5 py-0.5 text-xs text-[var(--aurora-text)] focus:outline-none"
                    />
                  ) : (
                    <>
                      <p
                        className={`truncate text-xs font-medium ${
                          element.visible ? '' : 'opacity-45 line-through'
                        }`}
                      >
                        {element.name}
                      </p>
                      {group && (
                        <p className="truncate text-[10px] text-[var(--aurora-secondary)]">
                          {group.name}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </button>

              <div className="flex shrink-0 items-center gap-0.5">
                {!isRenaming && (
                  <IconButton
                    icon="edit"
                    label={`Rename ${element.name}`}
                    size="sm"
                    iconSize={14}
                    onClick={() => startRename(id, element.name)}
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  />
                )}
                <IconButton
                  icon={element.visible ? 'visibility' : 'visibility_off'}
                  label={element.visible ? `Hide ${element.name}` : `Show ${element.name}`}
                  size="sm"
                  iconSize={15}
                  onClick={() => setElementVisibility(id, !element.visible)}
                  className={`h-6 w-6 ${
                    element.visible
                      ? 'opacity-60 group-hover:opacity-100'
                      : 'text-[var(--aurora-warning)] opacity-100'
                  }`}
                />
                <IconButton
                  icon={element.locked ? 'lock' : 'lock_open'}
                  label={element.locked ? `Unlock ${element.name}` : `Lock ${element.name}`}
                  size="sm"
                  iconSize={15}
                  onClick={() => setElementLocked(id, !element.locked)}
                  className={`h-6 w-6 ${
                    element.locked
                      ? 'text-[var(--aurora-warning)] opacity-100'
                      : 'opacity-60 group-hover:opacity-100'
                  }`}
                />
              </div>
            </li>
          );
        })}

        {layersTopToBottom.length === 0 && (
          <li className="px-2 py-6 text-center text-xs text-[var(--aurora-text-muted)]">
            No workspace elements left. Click Discard to restore defaults or Save an empty layout.
          </li>
        )}
      </ul>
    </aside>
  );
}
