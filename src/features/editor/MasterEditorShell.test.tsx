import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import {
  DEFAULT_CLOCK_ELEMENT_ID,
  DEFAULT_SEARCH_ELEMENT_ID,
  DEFAULT_SHORTCUTS_ELEMENT_ID,
} from '@/services/storage/defaults';
import { useEditorSessionStore } from '@/state/editorSessionStore';
import { useWorkspaceStore } from '@/state/workspaceStore';

describe('Master Edit Mode Interactive UI, Pointer Gestures & Keyboard Shortcuts', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
    useEditorSessionStore.setState(useEditorSessionStore.getInitialState());
  });

  it('enters Edit Mode, supports selection, pointer drag/resize as single history steps, and locked element protection', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(useWorkspaceStore.getState().status).toBe('ready');
    });

    // Enter Master Edit Mode
    await user.click(screen.getByRole('button', { name: 'Edit workspace' }));
    expect(screen.getByRole('banner', { name: 'Master Edit Mode toolbar' })).toBeInTheDocument();

    const clockNode = document.querySelector(
      `[data-editor-element-id="${DEFAULT_CLOCK_ELEMENT_ID}"]`,
    ) as HTMLElement;
    const searchNode = document.querySelector(
      `[data-editor-element-id="${DEFAULT_SEARCH_ELEMENT_ID}"]`,
    ) as HTMLElement;
    expect(clockNode).toBeTruthy();
    expect(searchNode).toBeTruthy();

    // Pointer drag clock: pointerdown -> pointermove -> pointerup commits ONE undo entry
    const startX =
      useEditorSessionStore.getState().draftLayout!.elements[DEFAULT_CLOCK_ELEMENT_ID]!.transform
        .xPct;

    fireEvent.pointerDown(clockNode, { button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(window, { clientX: 280, clientY: 230 });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 32));
    });
    // Intermediate move must NOT enter history yet
    expect(useEditorSessionStore.getState().past.length).toBe(0);

    fireEvent.pointerUp(window, { clientX: 280, clientY: 230 });

    await waitFor(() => {
      expect(useEditorSessionStore.getState().past.length).toBe(1);
    });
    const movedX =
      useEditorSessionStore.getState().draftLayout!.elements[DEFAULT_CLOCK_ELEMENT_ID]!.transform
        .xPct;
    expect(movedX).toBeGreaterThan(startX);

    // Resize via SE handle produces one additional history entry
    const seHandle = document.querySelector('[data-resize-handle="se"]') as HTMLElement;
    expect(seHandle).toBeTruthy();
    const startWidth =
      useEditorSessionStore.getState().draftLayout!.elements[DEFAULT_CLOCK_ELEMENT_ID]!.transform
        .widthPx;

    fireEvent.pointerDown(seHandle, { button: 0, clientX: 500, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 580, clientY: 340 });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 32));
    });
    fireEvent.pointerUp(window, { clientX: 580, clientY: 340 });

    await waitFor(() => {
      expect(useEditorSessionStore.getState().past.length).toBe(2);
    });
    expect(
      useEditorSessionStore.getState().draftLayout!.elements[DEFAULT_CLOCK_ELEMENT_ID]!.transform
        .widthPx,
    ).toBeGreaterThan(startWidth);

    // Lock selected clock -> dragging must leave coordinates completely untouched
    await user.click(screen.getByRole('button', { name: 'Lock selection' }));
    const lockedXPct =
      useEditorSessionStore.getState().draftLayout!.elements[DEFAULT_CLOCK_ELEMENT_ID]!.transform
        .xPct;
    fireEvent.pointerDown(clockNode, { button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(window, { clientX: 360, clientY: 300 });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 32));
    });
    fireEvent.pointerUp(window, { clientX: 360, clientY: 300 });
    expect(
      useEditorSessionStore.getState().draftLayout!.elements[DEFAULT_CLOCK_ELEMENT_ID]!.transform
        .xPct,
    ).toBe(lockedXPct);
  });

  it('handles keyboard shortcuts cleanly while suppressing shortcuts inside Inspector inputs', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(useWorkspaceStore.getState().status).toBe('ready');
    });

    await user.click(screen.getByRole('button', { name: 'Edit workspace' }));

    // Select All (Ctrl+A)
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    expect(useEditorSessionStore.getState().selectedElementIds).toHaveLength(4);

    // Duplicate (Ctrl+D) -> 8 elements
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true });
    expect(useEditorSessionStore.getState().draftLayout?.zOrder).toHaveLength(8);

    // Undo (Ctrl+Z) -> back to 4 elements
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(useEditorSessionStore.getState().draftLayout?.zOrder).toHaveLength(4);

    // Group two selected elements with Ctrl+G and ungroup with Ctrl+Shift+G
    act(() => {
      useEditorSessionStore
        .getState()
        .setSelection([DEFAULT_CLOCK_ELEMENT_ID, DEFAULT_SEARCH_ELEMENT_ID]);
    });
    const groupBtn = screen.getByRole('button', { name: 'Group selected elements (Ctrl+G)' });
    const ungroupBtn = screen.getByRole('button', {
      name: 'Ungroup selected elements (Ctrl+Shift+G)',
    });
    expect(groupBtn).toBeEnabled();
    expect(ungroupBtn).toBeDisabled();

    fireEvent.keyDown(window, { key: 'g', ctrlKey: true });
    expect(Object.keys(useEditorSessionStore.getState().draftLayout!.groups).length).toBe(1);
    expect(ungroupBtn).toBeEnabled();

    fireEvent.keyDown(window, { key: 'g', ctrlKey: true, shiftKey: true });
    expect(Object.keys(useEditorSessionStore.getState().draftLayout!.groups).length).toBe(0);

    // Verify toolbar Group & Ungroup buttons also operate identically on click
    await user.click(groupBtn);
    expect(Object.keys(useEditorSessionStore.getState().draftLayout!.groups).length).toBe(1);
    await user.click(ungroupBtn);
    expect(Object.keys(useEditorSessionStore.getState().draftLayout!.groups).length).toBe(0);

    // Select single shortcuts widget via Layers panel, verify arrow nudge + input shortcut protection
    await user.click(
      document.querySelector(`[data-layer-id="${DEFAULT_SHORTCUTS_ELEMENT_ID}"] button`)!,
    );
    const beforeNudgeX =
      useEditorSessionStore.getState().draftLayout!.elements[DEFAULT_SHORTCUTS_ELEMENT_ID]!
        .transform.xPct;
    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true });
    expect(
      useEditorSessionStore.getState().draftLayout!.elements[DEFAULT_SHORTCUTS_ELEMENT_ID]!
        .transform.xPct,
    ).toBeGreaterThan(beforeNudgeX);

    const widthInput = await screen.findByLabelText<HTMLInputElement>(/Width/i);
    fireEvent.keyDown(widthInput, { key: 'Delete' });
    expect(
      useEditorSessionStore.getState().draftLayout?.elements[DEFAULT_SHORTCUTS_ELEMENT_ID],
    ).toBeDefined();

    // Validation feedback in Inspector rejects invalid negative width
    await user.clear(widthInput);
    await user.type(widthInput, '10');
    fireEvent.blur(widthInput);
    expect(screen.getByRole('alert')).toHaveTextContent(/must be between/i);

    // Keyboard Delete outside inputs removes selected widget
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(
      useEditorSessionStore.getState().draftLayout?.elements[DEFAULT_SHORTCUTS_ELEMENT_ID],
    ).toBeUndefined();

    // Ctrl+S saves layout atomically
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => {
      expect(useEditorSessionStore.getState().isEditing).toBe(false);
    });
    expect(
      useWorkspaceStore.getState().getActiveProfile()!.layout.elements[
        DEFAULT_SHORTCUTS_ELEMENT_ID
      ],
    ).toBeUndefined();
  });

  it('shows discard confirmation dialog on dirty edits and restores committed workspace when discarded', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(useWorkspaceStore.getState().status).toBe('ready');
    });

    await user.click(screen.getByRole('button', { name: 'Edit workspace' }));

    // Toggle grid overlay to mark dirty
    await user.click(screen.getByRole('button', { name: 'Toggle canvas grid' }));
    expect(screen.getByTestId('canvas-grid-overlay')).toBeInTheDocument();
    expect(useEditorSessionStore.getState().isDirty).toBe(true);

    // Click Discard -> confirmation dialog opens -> confirm Discard Changes
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(/Discard Unsaved Changes/i);
    await user.click(screen.getByRole('button', { name: 'Discard Changes' }));

    await waitFor(() => {
      expect(useEditorSessionStore.getState().isEditing).toBe(false);
    });
    expect(useWorkspaceStore.getState().getActiveProfile()!.layout.grid.enabled).toBe(false);
  });

  it('supports marquee selection, empty-canvas deselection, and Layers panel rename & reorder', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(useWorkspaceStore.getState().status).toBe('ready');
    });

    await user.click(screen.getByRole('button', { name: 'Edit workspace' }));

    // Empty-canvas marquee drag sweeping across the whole workspace selects all 3 widgets
    const stage = screen.getByRole('main', { name: 'Interactive canvas editor' });
    fireEvent.pointerDown(stage, { button: 0, clientX: 5, clientY: 60 });
    fireEvent.pointerMove(window, { clientX: 1000, clientY: 700 });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 32));
    });
    expect(screen.getByTestId('marquee-selection-box')).toBeInTheDocument();
    fireEvent.pointerUp(window, { clientX: 1000, clientY: 700 });

    expect(useEditorSessionStore.getState().selectedElementIds.length).toBeGreaterThanOrEqual(2);

    // Clicking empty canvas clears selection
    fireEvent.pointerDown(stage, { button: 0, clientX: 2, clientY: 62 });
    fireEvent.pointerUp(window, { clientX: 2, clientY: 62 });
    expect(useEditorSessionStore.getState().selectedElementIds).toEqual([]);

    // Layers panel: click clock layer -> rename -> bring to front
    await user.click(screen.getByRole('button', { name: /Rename Main Clock/i }));
    const renameInput = screen.getByLabelText('Rename Main Clock');
    await user.clear(renameInput);
    await user.type(renameInput, 'Hero Clock{enter}');
    expect(
      useEditorSessionStore.getState().draftLayout!.elements[DEFAULT_CLOCK_ELEMENT_ID]!.name,
    ).toBe('Hero Clock');

    // Select renamed layer and Bring to front
    act(() => {
      useEditorSessionStore.getState().selectElement(DEFAULT_CLOCK_ELEMENT_ID);
    });
    await user.click(screen.getByRole('button', { name: 'Bring to front' }));
    const zOrder = useEditorSessionStore.getState().draftLayout!.zOrder;
    expect(zOrder[zOrder.length - 1]).toBe(DEFAULT_CLOCK_ELEMENT_ID);
  });
});
