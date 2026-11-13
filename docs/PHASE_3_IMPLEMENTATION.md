# PHASE 3 — Implementation Documentation

**Product:** AURORA — Your Personal Browser Workspace  
**Phase:** Phase 3 — Master Edit Mode & Interactive Canvas Engine  
**Status:** Complete  

---

## 1. Canvas Architecture & Coordinate Model

AURORA renders both View Mode ([WorkspaceViewCanvas.tsx](file:///c:/Users/sanja/project/JARVIS/src/features/editor/WorkspaceViewCanvas.tsx)) and Master Edit Mode ([EditableCanvasStage.tsx](file:///c:/Users/sanja/project/JARVIS/src/features/editor/EditableCanvasStage.tsx)) over an identical **Safe Canvas Area** below the `56px` fixed header bar (`top: 56px`, full remaining viewport height).

### Hybrid Coordinate Representation (`src/features/editor/geometry.ts`)
- **Persisted Anchors:** `xPct` and `yPct` percentages relative to the Safe Canvas Area dimensions (`transformToScreenRect`, `screenRectToTransform`).
- **Reference-Scaled Dimensions:** `widthPx` and `heightPx` relative to a canonical `1440×900` baseline (`getCanvasScale`, clamped `0.55x–1.35x` across laptop and ultrawide monitors).
- **Non-Destructive Clamping:** Render-time clamping keeps elements accessible (`32px` minimum visible grab margin) on smaller screens without overwriting user ultrawide coordinates. Compact viewports (`< 560px`) stack gracefully in View Mode.
- **Anti-Drift Conversion:** Pointer gestures calculate deltas cumulatively from gesture-start snapshots (`startRects`) rather than accumulating incremental rounding errors per `pointermove`.

---

## 2. Transactional Editing & Draft/Commit Lifecycle

Strict isolation is enforced across `savedWorkspace`, `editingDraft`, and `editorSession` ([editorSessionStore.ts](file:///c:/Users/sanja/project/JARVIS/src/state/editorSessionStore.ts), [workspaceStore.ts](file:///c:/Users/sanja/project/JARVIS/src/state/workspaceStore.ts)):

1. **Enter Edit Mode (`enterEditMode`):**
   - Deep-clones `activeProfile.layout` via `structuredClone` and normalizes group/zOrder integrity into `baselineLayout` + `draftLayout`.
   - Leaves committed `useWorkspaceStore.workspace` completely untouched.
2. **Draft-Only Mutations:**
   - Moving, resizing, grouping, layering, locking, inspector numeric edits, and undo/redo mutate ONLY `draftLayout`.
   - `isDirty` compares `draftLayout` against `baselineLayout` (`areLayoutsEqual`), automatically returning to `false` if edits are undone back to baseline.
3. **Atomic Save (`commitDraft`):**
   - Double-click guarded by `isSaving`.
   - Runs `pruneAndNormalizeGroups`, `validateLayoutIntegrity`, and strict `persistedWorkspaceSchema.safeParse` inside `chromeStorageService.writeWorkspace`.
   - Updates `useWorkspaceStore.workspace` and clears draft + transient history **only after persistence succeeds**.
   - On failure: keeps Edit Mode active, preserves `draftLayout` and history, records `saveError`, and displays a retryable error toast.
4. **Discard & Refresh Safety (`discardChanges`):**
   - Confirms before dropping dirty drafts via Radix `<Dialog>`.
   - Restores the untouched committed layout, clears draft + history, and warns via `beforeunload` when exiting a tab with unsaved changes.

---

## 3. Selection Model & Pointer Interaction Lifecycle

- **Single & Multi-Selection:** Click selects an element (or expands to all members of its group cleanly); `Ctrl/Cmd + Click` or `Shift + Click` toggles/adds selection; clicking empty canvas clears selection.
- **Marquee Drag Selection:** Pointer-down and drag across empty canvas renders a normalized selection marquee rectangle (`rectsIntersect`) supporting additive `Ctrl/Shift` sweeps.
- **Locked Elements:** Selectable for inspection and unlocking, visually identified by an amber dashed outline and explicit `<MaterialSymbol name="lock" />` `(Locked)` badge; excluded from dragging, resizing, nudging, alignment, and grouping.
- **Widget Interaction Shield:** In Edit Mode, inner widget links/inputs have `pointer-events-none` and `disableGlobalShortcut` so clicking shortcuts or search bars selects/drags cleanly without triggering navigation or form focus; exiting Edit Mode restores full normal widget interaction.
- **60 fps Pointer Pipeline:** `window` pointer listeners batch live drag/resize/marquee coordinates through `requestAnimationFrame` into local transient overlay state without pushing Zustand updates or history entries per raw mouse event, committing one atomic history step on `pointerup`. Interrupted interactions (`pointercancel`, `Escape`) restore pre-gesture geometry cleanly.

---

## 4. Resize Strategy & Grouping Architecture

- **8-Point Handles (`nw, n, ne, e, se, s, sw, w`):** Single-element resize locks opposite edges via `computeResizedRect`, enforces element `minWidthPx`/`minHeightPx`, prevents negative dimensions, and supports `Shift` or per-element `aspectLocked` aspect preservation.
- **Multi-Selection & Group Resize:** Scales the selection union bounding box proportionally around the opposite anchor (`computeMultiSelectionResizedTransforms`), preserving member spacing and respecting minimum sizes.
- **Logical Groups (`layoutOps.ts`):**
  - Stored directly in `CanvasLayout.groups` (`childIds`) and synchronized with `element.groupId`.
  - Prevents nested/circular groups, duplicate memberships, and orphan 1-item groups (`pruneAndNormalizeGroups` automatically dissolves any group reduced below 2 children after deletion).
  - Duplicating an entire group clones all members cleanly under a fresh group ID while preserving shared asset references.

---

## 5. Snapping, Alignment Guides & Layer Ordering

- **Visual Grid:** Rendered strictly inside Edit Mode (`draftLayout.grid.enabled`) at `8px`, `12px`, `16px`, or `24px` spacing (`snapToGrid`). Never shown in View Mode.
- **Magnetic Alignment Guides (`src/features/editor/snapping.ts`):** Evaluates canvas edges/center, sibling edges/centers (including locked elements), and group bounds within a `6px` threshold (`Alt` temporarily bypasses snap). Excludes moving IDs to prevent self-snapping.
- **Layer Panel (`LayersPanel.tsx`):** Lists top-to-bottom stacking order keyed strictly by stable element IDs, supporting inline rename, visibility toggle, lock toggle, and synchronized Z-order actions (`bring-to-front`, `bring-forward`, `send-backward`, `send-to-back`).

---

## 6. Bounded History (`Undo / Redo`) & Keyboard Shortcuts

- **Bounded Snapshot Stack:** Immutable `{ layout, selectedElementIds, label }` snapshots capped at **`50` entries** (`MAX_HISTORY_ENTRIES = 50`), zero binary media stored. Any new mutation clears `future` redo history cleanly. Arrow-key nudges coalesce within a `450ms` burst window.
- **Keyboard Shortcuts (`MasterEditorShell.tsx`):**
  - `Ctrl/Cmd + Z` (Undo), `Ctrl/Cmd + Shift + Z` / `Ctrl/Cmd + Y` (Redo), `Ctrl/Cmd + D` (Duplicate), `Delete` / `Backspace` (Delete), `Escape` (Cancel gesture / Clear selection), `Ctrl/Cmd + A` (Select all), `Arrow` / `Shift + Arrow` (1px / 10px Nudge), `Ctrl/Cmd + G` (Group), `Ctrl/Cmd + Shift + G` (Ungroup), `Ctrl/Cmd + S` (Save), `[`/`]` and `Ctrl/Cmd + [`/`]` (Layer stacking).
  - Automatically suppressed when focus is inside `<input>`, `<textarea>`, `<select>`, `[contenteditable]`, or an open modal dialog.

---

## 7. Persistence, Schema Compatibility & Known Limitations

- **Schema Version `2` Compatibility:** Phase 2's `schemaVersion: 2` model already included `CanvasLayout`, `grid`, `groups`, `elements`, and `zOrder`; Phase 3 adds strict `validateLayoutIntegrity` enforcement inside `chromeStorageService.writeWorkspace` so structurally inconsistent groups or `zOrder` lists cannot be committed.
- **Rollback & Recovery:** Uncommitted edits live strictly in memory (`draftLayout`); browser refresh or extension reload always restores the last atomically persisted `chrome.storage.local` state cleanly.
- **Deferred Scope (Phases 4–7):** Wallpaper uploader/cropper, shaped image/GIF/text elements, internet speed test engine, profile manager UI, and Chrome bookmark sync remain deferred as scoped.

