import { useState } from 'react';
import { DeckoraAboutDialog } from '@/components/brand/DeckoraAboutDialog';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
  IconButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui';
import { AddElementDialog, type AddElementDialogKind } from '@/features/elements/AddElementDialogs';
import {
  createPresetWidgetElement,
  type PresetWidgetKind,
} from '@/features/elements/createPresetWidget';
import { WallpaperDialog } from '@/features/wallpaper/WallpaperDialog';
import { canGroupSelection, canUngroupSelection, getUnlockedIds } from './layoutOps';
import type { CanvasDimensions } from './geometry';
import { useEditorSessionStore } from '@/state/editorSessionStore';
import type { AppearanceMode } from '@/types/workspace';

const APPEARANCE_META: Record<AppearanceMode, { icon: string; label: string }> = {
  dark: { icon: 'dark_mode', label: 'Dark (Midnight Navy)' },
  light: { icon: 'light_mode', label: 'Light (Ice Crystal)' },
  system: { icon: 'contrast', label: 'System Automatic' },
};

export interface EditorToolbarProps {
  canvasBounds: CanvasDimensions;
}

export function EditorToolbar({ canvasBounds }: EditorToolbarProps) {
  const draftLayout = useEditorSessionStore((s) => s.draftLayout);
  const draftTheme = useEditorSessionStore((s) => s.draftTheme);
  const selectedElementIds = useEditorSessionStore((s) => s.selectedElementIds);
  const isDirty = useEditorSessionStore((s) => s.isDirty);
  const isSaving = useEditorSessionStore((s) => s.isSaving);
  const pastCount = useEditorSessionStore((s) => s.past.length);
  const futureCount = useEditorSessionStore((s) => s.future.length);
  const showLayersPanel = useEditorSessionStore((s) => s.showLayersPanel);
  const showInspectorPanel = useEditorSessionStore((s) => s.showInspectorPanel);

  const undo = useEditorSessionStore((s) => s.undo);
  const redo = useEditorSessionStore((s) => s.redo);
  const duplicateSelection = useEditorSessionStore((s) => s.duplicateSelection);
  const deleteSelection = useEditorSessionStore((s) => s.deleteSelection);
  const groupSelection = useEditorSessionStore((s) => s.groupSelection);
  const ungroupSelection = useEditorSessionStore((s) => s.ungroupSelection);
  const toggleLockSelection = useEditorSessionStore((s) => s.toggleLockSelection);
  const updateGridConfig = useEditorSessionStore((s) => s.updateGridConfig);
  const updateDraftTheme = useEditorSessionStore((s) => s.updateDraftTheme);
  const commitDraft = useEditorSessionStore((s) => s.commitDraft);
  const discardChanges = useEditorSessionStore((s) => s.discardChanges);
  const setShowLayersPanel = useEditorSessionStore((s) => s.setShowLayersPanel);
  const setShowInspectorPanel = useEditorSessionStore((s) => s.setShowInspectorPanel);
  const addElement = useEditorSessionStore((s) => s.addElement);

  const [confirmMode, setConfirmMode] = useState<'none' | 'discard' | 'exit'>('none');
  const [addElementKind, setAddElementKind] = useState<AddElementDialogKind>(null);
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  if (!draftLayout) return null;

  const currentAppearance = draftTheme?.appearance ?? 'dark';
  const currentThemeMeta = APPEARANCE_META[currentAppearance];

  const handleInsertPresetWidget = (kind: PresetWidgetKind) => {
    const element = createPresetWidgetElement(kind, draftLayout);
    addElement(element, { select: true });
  };

  const hasSelection = selectedElementIds.length > 0;
  const unlockedSelectionCount = getUnlockedIds(draftLayout, selectedElementIds).length;
  const canGroup = canGroupSelection(draftLayout, selectedElementIds);
  const canUngroup = canUngroupSelection(draftLayout, selectedElementIds);
  const allSelectedLocked =
    hasSelection && selectedElementIds.every((id) => draftLayout.elements[id]?.locked);

  const handleExitClick = () => {
    if (isDirty) {
      setConfirmMode('exit');
    } else {
      discardChanges();
    }
  };

  const handleDiscardClick = () => {
    if (isDirty) {
      setConfirmMode('discard');
    } else {
      discardChanges();
    }
  };

  return (
    <>
      <header
        aria-label="Master Edit Mode toolbar"
        className="aurora-glass-elevated fixed top-0 right-0 left-0 z-50 flex h-14 items-center justify-between gap-2 border-b border-[var(--aurora-border)] px-3 sm:px-5"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                icon="close"
                label="Exit Edit Mode"
                variant="ghost"
                size="sm"
                onClick={handleExitClick}
                disabled={isSaving}
                className="rounded-full"
              />
            </TooltipTrigger>
            <TooltipContent>Exit Edit Mode</TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-2">
            <MaterialSymbol
              name="edit_square"
              size={18}
              className="shrink-0 text-[var(--aurora-primary)]"
            />
            <span className="hidden font-[var(--font-display)] text-sm font-semibold tracking-tight text-[var(--aurora-text)] md:inline">
              Edit Mode
            </span>
          </div>

          {isDirty && (
            <span
              role="status"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--aurora-secondary)]/40 bg-[var(--aurora-secondary)]/15 px-2.5 py-0.5 text-[11px] font-medium text-[var(--aurora-text)]"
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-[var(--aurora-secondary)]"
              />
              Unsaved
            </span>
          )}
        </div>

        <div
          role="toolbar"
          aria-label="Canvas actions"
          className="flex items-center gap-0.5 overflow-x-auto sm:gap-1"
        >
          <Dropdown>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownTrigger asChild>
                  <Button
                    variant="glass"
                    size="sm"
                    aria-label="Add element"
                    className="gap-1 px-2.5"
                  >
                    <MaterialSymbol
                      name="add_circle"
                      size={16}
                      className="text-[var(--aurora-primary)]"
                    />
                    <span className="hidden lg:inline">Add</span>
                  </Button>
                </DropdownTrigger>
              </TooltipTrigger>
              <TooltipContent>Add Widgets, Images, GIFs, or Text</TooltipContent>
            </Tooltip>
            <DropdownContent align="start">
              <DropdownItem icon="speed" onSelect={() => handleInsertPresetWidget('speed')}>
                Add Speed Monitor
              </DropdownItem>
              <DropdownItem icon="schedule" onSelect={() => handleInsertPresetWidget('clock')}>
                Add Clock Widget
              </DropdownItem>
              <DropdownItem icon="search" onSelect={() => handleInsertPresetWidget('search')}>
                Add Search Bar
              </DropdownItem>
              <DropdownItem icon="apps" onSelect={() => handleInsertPresetWidget('shortcuts')}>
                Add Shortcuts Grid
              </DropdownItem>
              <DropdownItem icon="image" onSelect={() => setAddElementKind('image')}>
                Add Image Object
              </DropdownItem>
              <DropdownItem icon="gif_box" onSelect={() => setAddElementKind('gif')}>
                Add Animated GIF
              </DropdownItem>
              <DropdownItem icon="title" onSelect={() => setAddElementKind('text')}>
                Add Custom Text
              </DropdownItem>
            </DropdownContent>
          </Dropdown>

          <Dropdown>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownTrigger asChild>
                  <Button
                    variant="glass"
                    size="sm"
                    aria-label={`Appearance & Theme: ${currentThemeMeta.label}`}
                    className="gap-1.5 px-2.5"
                  >
                    <MaterialSymbol
                      name={currentThemeMeta.icon}
                      size={16}
                      className="text-[var(--aurora-primary)]"
                    />
                    <span className="hidden lg:inline">Theme</span>
                  </Button>
                </DropdownTrigger>
              </TooltipTrigger>
              <TooltipContent>Theme, Wallpaper &amp; Appearance</TooltipContent>
            </Tooltip>
            <DropdownContent align="start">
              <DropdownLabel>Appearance</DropdownLabel>
              <DropdownItem
                icon="dark_mode"
                selected={currentAppearance === 'dark'}
                onSelect={() => updateDraftTheme({ appearance: 'dark' }, 'Switch to Dark theme')}
              >
                Dark (Midnight Navy)
              </DropdownItem>
              <DropdownItem
                icon="light_mode"
                selected={currentAppearance === 'light'}
                onSelect={() => updateDraftTheme({ appearance: 'light' }, 'Switch to Light theme')}
              >
                Light (Ice Crystal)
              </DropdownItem>
              <DropdownItem
                icon="contrast"
                selected={currentAppearance === 'system'}
                onSelect={() =>
                  updateDraftTheme({ appearance: 'system' }, 'Switch to System theme')
                }
              >
                System Automatic
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem icon="wallpaper" onSelect={() => setWallpaperOpen(true)}>
                Wallpaper, Colors &amp; Palette...
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem icon="info" onSelect={() => setAboutOpen(true)}>
                About Deckora...
              </DropdownItem>
            </DropdownContent>
          </Dropdown>

          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                icon="wallpaper"
                label="Customize wallpaper"
                size="sm"
                onClick={() => setWallpaperOpen(true)}
              />
            </TooltipTrigger>
            <TooltipContent>Wallpaper & Background</TooltipContent>
          </Tooltip>

          <div aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--aurora-border)]" />

          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                icon="undo"
                label="Undo"
                size="sm"
                disabled={pastCount === 0}
                onClick={undo}
              />
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                icon="redo"
                label="Redo"
                size="sm"
                disabled={futureCount === 0}
                onClick={redo}
              />
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
          </Tooltip>

          <div aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--aurora-border)]" />

          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                icon="content_copy"
                label="Duplicate selected"
                size="sm"
                disabled={!hasSelection}
                onClick={() => duplicateSelection(canvasBounds)}
              />
            </TooltipTrigger>
            <TooltipContent>Duplicate (Ctrl+D)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                icon="delete"
                label="Delete selected"
                size="sm"
                disabled={!hasSelection || unlockedSelectionCount === 0}
                onClick={deleteSelection}
              />
            </TooltipTrigger>
            <TooltipContent>Delete (Del)</TooltipContent>
          </Tooltip>

          <div aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--aurora-border)]" />

          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                icon="group_work"
                label="Group selected elements (Ctrl+G)"
                size="sm"
                disabled={!canGroup}
                onClick={groupSelection}
              />
            </TooltipTrigger>
            <TooltipContent>Group selected elements (Ctrl+G)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                icon="workspaces"
                label="Ungroup selected elements (Ctrl+Shift+G)"
                size="sm"
                disabled={!canUngroup}
                onClick={ungroupSelection}
              />
            </TooltipTrigger>
            <TooltipContent>Ungroup selected elements (Ctrl+Shift+G)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                icon={allSelectedLocked ? 'lock_open' : 'lock'}
                label={allSelectedLocked ? 'Unlock selection' : 'Lock selection'}
                size="sm"
                disabled={!hasSelection}
                onClick={toggleLockSelection}
              />
            </TooltipTrigger>
            <TooltipContent>{allSelectedLocked ? 'Unlock' : 'Lock'}</TooltipContent>
          </Tooltip>

          <div aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--aurora-border)]" />

          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                icon={draftLayout.grid.enabled ? 'grid_on' : 'grid_off'}
                label="Toggle canvas grid"
                size="sm"
                variant={draftLayout.grid.enabled ? 'primary' : 'ghost'}
                aria-pressed={draftLayout.grid.enabled}
                onClick={() => updateGridConfig({ enabled: !draftLayout.grid.enabled })}
              />
            </TooltipTrigger>
            <TooltipContent>{draftLayout.grid.enabled ? 'Hide Grid' : 'Show Grid'}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                icon="grid_4x4"
                label="Toggle grid snap"
                size="sm"
                variant={draftLayout.grid.snapToGrid ? 'primary' : 'ghost'}
                aria-pressed={draftLayout.grid.snapToGrid}
                onClick={() => updateGridConfig({ snapToGrid: !draftLayout.grid.snapToGrid })}
              />
            </TooltipTrigger>
            <TooltipContent>
              Snap to Grid: {draftLayout.grid.snapToGrid ? 'On' : 'Off'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                icon="straighten"
                label="Toggle alignment guides"
                size="sm"
                variant={draftLayout.grid.snapToGuides ? 'primary' : 'ghost'}
                aria-pressed={draftLayout.grid.snapToGuides}
                onClick={() => updateGridConfig({ snapToGuides: !draftLayout.grid.snapToGuides })}
              />
            </TooltipTrigger>
            <TooltipContent>
              Alignment Guides: {draftLayout.grid.snapToGuides ? 'On' : 'Off'}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                icon="layers"
                label="Toggle layers panel"
                size="sm"
                variant={showLayersPanel ? 'glass' : 'ghost'}
                aria-pressed={showLayersPanel}
                onClick={() => setShowLayersPanel(!showLayersPanel)}
                className="hidden sm:inline-flex"
              />
            </TooltipTrigger>
            <TooltipContent>Layers Panel</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                icon="tune"
                label="Toggle inspector panel"
                size="sm"
                variant={showInspectorPanel ? 'glass' : 'ghost'}
                aria-pressed={showInspectorPanel}
                onClick={() => setShowInspectorPanel(!showInspectorPanel)}
                className="hidden sm:inline-flex"
              />
            </TooltipTrigger>
            <TooltipContent>Properties Inspector</TooltipContent>
          </Tooltip>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDiscardClick}
            disabled={isSaving}
            className="hidden sm:inline-flex"
          >
            Discard
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => void commitDraft()}
            disabled={!isDirty || isSaving}
            aria-label="Save workspace layout"
          >
            <MaterialSymbol name="save" size={16} />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </Button>
        </div>
      </header>

      <Dialog
        open={confirmMode !== 'none'}
        onOpenChange={(open) => {
          if (!open) setConfirmMode('none');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmMode === 'discard' ? 'Discard Unsaved Changes?' : 'Unsaved Workspace Changes'}
            </DialogTitle>
            <DialogDescription>
              {confirmMode === 'discard'
                ? 'All uncommitted positioning, sizing, and grouping edits in this session will be discarded and your last saved layout will be restored.'
                : 'You have unsaved changes in your editing draft. Save them now or discard your draft before exiting Edit Mode.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConfirmMode('none')}>
              Keep Editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmMode('none');
                discardChanges();
              }}
            >
              Discard Changes
            </Button>
            {confirmMode === 'exit' && (
              <Button
                variant="primary"
                disabled={isSaving}
                onClick={() => {
                  setConfirmMode('none');
                  void commitDraft();
                }}
              >
                Save & Exit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddElementDialog kind={addElementKind} onClose={() => setAddElementKind(null)} />
      <WallpaperDialog open={wallpaperOpen} onOpenChange={setWallpaperOpen} />
      <DeckoraAboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  );
}
