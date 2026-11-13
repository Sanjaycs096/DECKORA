import { useEffect, useRef } from 'react';
import { useEditorSessionStore } from '@/state/editorSessionStore';
import { EditableCanvasStage } from './EditableCanvasStage';
import { EditorToolbar } from './EditorToolbar';
import { LayersPanel } from './LayersPanel';
import { PropertiesInspector } from './PropertiesInspector';
import { useCanvasBounds } from './useCanvasBounds';

function isEditableFormTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }
  return Boolean(target.isContentEditable || target.closest('[contenteditable="true"]'));
}

function hasOpenModalDialog(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(document.querySelector('[role="dialog"][data-state="open"]'));
}

export function MasterEditorShell() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasBounds = useCanvasBounds(stageRef);

  const isDirty = useEditorSessionStore((s) => s.isDirty);

  useEffect(() => {
    if (!isDirty) return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const handleEditorKeyDown = (event: KeyboardEvent) => {
      const store = useEditorSessionStore.getState();
      if (!store.isEditing) return;

      if (isEditableFormTarget(event.target) || hasOpenModalDialog()) {
        return;
      }

      const mod = event.ctrlKey || event.metaKey;
      const key = event.key;
      const lower = key.toLowerCase();

      if (mod && lower === 's') {
        event.preventDefault();
        void store.commitDraft();
        return;
      }

      if (mod && lower === 'z' && event.shiftKey) {
        event.preventDefault();
        store.redo();
        return;
      }

      if (mod && lower === 'y') {
        event.preventDefault();
        store.redo();
        return;
      }

      if (mod && lower === 'z' && !event.shiftKey) {
        event.preventDefault();
        store.undo();
        return;
      }

      if (mod && lower === 'd') {
        event.preventDefault();
        store.duplicateSelection(canvasBounds);
        return;
      }

      if (mod && lower === 'a') {
        event.preventDefault();
        store.selectAll();
        return;
      }

      if (mod && lower === 'g' && event.shiftKey) {
        event.preventDefault();
        store.ungroupSelection();
        return;
      }

      if (mod && lower === 'g' && !event.shiftKey) {
        event.preventDefault();
        store.groupSelection();
        return;
      }

      if (key === 'Delete' || key === 'Backspace') {
        if (store.selectedElementIds.length > 0) {
          event.preventDefault();
          store.deleteSelection();
        }
        return;
      }

      if (key === 'Escape') {
        if (store.selectedElementIds.length > 0) {
          event.preventDefault();
          store.clearSelection();
        }
        return;
      }

      if (key === ']' || key === '[') {
        if (store.selectedElementIds.length > 0) {
          event.preventDefault();
          if (mod) {
            store.reorderLayers(key === ']' ? 'bring-to-front' : 'send-to-back');
          } else {
            store.reorderLayers(key === ']' ? 'bring-forward' : 'send-backward');
          }
        }
        return;
      }

      if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') {
        if (store.selectedElementIds.length > 0) {
          event.preventDefault();
          const step = event.shiftKey ? 10 : 1;
          const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
          const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
          store.nudgeSelection(dx, dy, canvasBounds);
        }
      }
    };

    window.addEventListener('keydown', handleEditorKeyDown);
    return () => window.removeEventListener('keydown', handleEditorKeyDown);
  }, [canvasBounds]);

  return (
    <div data-testid="master-editor-shell" className="relative flex min-h-dvh w-full flex-col">
      <EditorToolbar canvasBounds={canvasBounds} />
      <EditableCanvasStage canvasBounds={canvasBounds} stageRef={stageRef} />
      <LayersPanel />
      <PropertiesInspector canvasBounds={canvasBounds} />
    </div>
  );
}
