import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  cleanupUnreferencedAssets,
  collectReferencedAssetIds,
  verifySpecificAssetIdsExist,
} from '@/services/assets/assetLifecycle';
import type { ChromeStorageService } from '@/services/storage/chromeStorageService';
import type {
  AssetMetadata,
  CanvasLayout,
  CustomFontRecord,
  EditorSessionState,
  ElementStyleBase,
  ElementTransform,
  GenericCanvasElement,
  ThemeConfig,
  WallpaperConfig,
} from '@/types/workspace';
import {
  DEFAULT_REFERENCE_VIEWPORT,
  type AlignDirection,
  type CanvasDimensions,
  type DistributeAxis,
} from '@/features/editor/geometry';
import {
  alignSelectedElements,
  applyElementTransformPatches,
  areLayoutsEqual,
  bringAllElementsIntoView,
  cloneLayout,
  deleteElements,
  distributeSelectedElements,
  duplicateElements,
  expandSelectionWithGroups,
  groupElements,
  insertElementIntoLayout,
  MAX_HISTORY_ENTRIES,
  nudgeElements,
  pruneAndNormalizeGroups,
  renameElement as renameElementInLayout,
  reorderElementsZOrder,
  setElementsLocked,
  setElementVisibility as setElementVisibilityInLayout,
  ungroupElements,
  type HistorySnapshot,
  type LayerOrderAction,
} from '@/features/editor/layoutOps';
import type { SnapGuideLine } from '@/features/editor/snapping';
import { useThemeStore } from './themeStore';
import { useToastStore } from './toastStore';
import { useWorkspaceStore } from './workspaceStore';

export interface EditorSessionStoreState extends EditorSessionState {
  baselineLayout: CanvasLayout | null;
  baselineTheme: ThemeConfig | null;
  retiredAssetIds: string[];
  draftAssetMetadata: Record<string, AssetMetadata>;
  pendingCustomFonts: CustomFontRecord[];
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  activeSnapGuides: SnapGuideLine[];
  showLayersPanel: boolean;
  showInspectorPanel: boolean;
  isSaving: boolean;
  saveError: string | null;
  lastHistoryKey: string | null;
  lastHistoryAt: number;

  enterEditMode: () => boolean;
  discardChanges: () => void;
  commitDraft: (service?: ChromeStorageService) => Promise<boolean>;

  selectElement: (id: string, options?: { toggle?: boolean; additive?: boolean }) => void;
  setSelection: (ids: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;

  addElement: (
    element: GenericCanvasElement,
    options?: {
      assetMetadata?: AssetMetadata;
      fontRecord?: CustomFontRecord;
      select?: boolean;
      label?: string;
    },
  ) => void;
  updateElementProps: (
    id: string,
    propsPatch: Record<string, unknown>,
    options?: {
      label?: string;
      assetMetadata?: AssetMetadata;
      fontRecord?: CustomFontRecord;
      coalesceKey?: string;
    },
  ) => void;
  updateElementStyle: (
    id: string,
    stylePatch: Partial<ElementStyleBase>,
    options?: { label?: string; coalesceKey?: string },
  ) => void;
  updateDraftWallpaper: (
    patch: Partial<WallpaperConfig>,
    options?: { assetMetadata?: AssetMetadata; coalesceKey?: string; label?: string },
  ) => void;
  updateDraftTheme: (patch: Partial<ThemeConfig>, label?: string) => void;

  commitTransformPatches: (patches: Record<string, ElementTransform>, label: string) => void;
  nudgeSelection: (dx: number, dy: number, canvasBounds?: CanvasDimensions) => void;
  duplicateSelection: (canvasBounds?: CanvasDimensions) => void;
  deleteSelection: () => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  toggleLockSelection: () => void;
  setElementLocked: (id: string, locked: boolean) => void;
  setElementVisibility: (id: string, visible: boolean) => void;
  renameElement: (id: string, name: string) => void;
  toggleElementAspectLock: (id: string) => void;
  reorderLayers: (action: LayerOrderAction, targetIds?: string[]) => void;
  alignSelection: (direction: AlignDirection, canvasBounds?: CanvasDimensions) => void;
  distributeSelection: (axis: DistributeAxis, canvasBounds?: CanvasDimensions) => void;
  bringAllIntoView: (canvasBounds?: CanvasDimensions) => void;
  updateGridConfig: (patch: Partial<CanvasLayout['grid']>) => void;

  undo: () => void;
  redo: () => void;

  setActiveSnapGuides: (guides: SnapGuideLine[]) => void;
  setShowLayersPanel: (open: boolean) => void;
  setShowInspectorPanel: (open: boolean) => void;
}

const NUDGE_COALESCE_WINDOW_MS = 450;

function areThemesEqual(a: ThemeConfig | null, b: ThemeConfig | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function computeIsDirty(
  nextLayout: CanvasLayout,
  baselineLayout: CanvasLayout | null,
  nextTheme: ThemeConfig | null,
  baselineTheme: ThemeConfig | null,
): boolean {
  if (!baselineLayout) return true;
  if (!areLayoutsEqual(nextLayout, baselineLayout)) return true;
  if (!areThemesEqual(nextTheme, baselineTheme)) return true;
  return false;
}

function extractElementAssetIds(el: GenericCanvasElement | undefined): string[] {
  if (!el) return [];
  const ids: string[] = [];
  if (typeof el.props.assetId === 'string' && el.props.assetId.length > 0) {
    ids.push(el.props.assetId);
  }
  if (typeof el.props.uploadedFontAssetId === 'string' && el.props.uploadedFontAssetId.length > 0) {
    ids.push(el.props.uploadedFontAssetId);
  }
  return ids;
}

export const useEditorSessionStore = create<EditorSessionStoreState>()(
  immer((set, get) => {
    const pushCommittedMutation = (
      label: string,
      mutator: (
        draftLayout: CanvasLayout,
        selectedIds: string[],
        draftTheme: ThemeConfig | null,
      ) => {
        nextLayout: CanvasLayout;
        nextTheme?: ThemeConfig | null;
        nextSelection?: string[];
        addedAssetMetadata?: AssetMetadata;
        addedFontRecord?: CustomFontRecord;
        retiredAssetIds?: string[];
      },
      options?: { coalesceKey?: string },
    ) => {
      const state = get();
      if (!state.isEditing || !state.draftLayout) return;

      const prevLayout = state.draftLayout;
      const prevTheme = state.draftTheme;
      const prevSelection = [...state.selectedElementIds];
      const result = mutator(prevLayout, prevSelection, prevTheme);
      const nextLayout = result.nextLayout;
      const nextTheme = result.nextTheme !== undefined ? result.nextTheme : prevTheme;

      if (
        areLayoutsEqual(prevLayout, nextLayout) &&
        areThemesEqual(prevTheme, nextTheme) &&
        (!result.nextSelection ||
          JSON.stringify(result.nextSelection) === JSON.stringify(prevSelection))
      ) {
        return;
      }

      const now = Date.now();
      const canCoalesce =
        Boolean(options?.coalesceKey) &&
        state.lastHistoryKey === options?.coalesceKey &&
        now - state.lastHistoryAt <= NUDGE_COALESCE_WINDOW_MS &&
        state.past.length > 0;

      set((draft) => {
        if (!canCoalesce) {
          draft.past.push({
            label,
            layout: cloneLayout(prevLayout),
            theme: prevTheme ? structuredClone(prevTheme) : undefined,
            selectedElementIds: prevSelection,
          });
          if (draft.past.length > MAX_HISTORY_ENTRIES) {
            draft.past.shift();
          }
        }
        draft.future = [];
        draft.draftLayout = nextLayout;
        draft.draftTheme = nextTheme;

        if (result.addedAssetMetadata) {
          const meta = result.addedAssetMetadata;
          if (!draft.pendingUploadedAssetIds.includes(meta.id)) {
            draft.pendingUploadedAssetIds.push(meta.id);
          }
          draft.draftAssetMetadata[meta.id] = meta;
        }
        if (result.addedFontRecord) {
          const font = result.addedFontRecord;
          if (!draft.pendingUploadedAssetIds.includes(font.assetId)) {
            draft.pendingUploadedAssetIds.push(font.assetId);
          }
          if (!draft.pendingCustomFonts.some((f) => f.assetId === font.assetId)) {
            draft.pendingCustomFonts.push(font);
          }
        }
        if (result.retiredAssetIds) {
          for (const rid of result.retiredAssetIds) {
            if (rid && !draft.retiredAssetIds.includes(rid)) {
              draft.retiredAssetIds.push(rid);
            }
          }
        }

        if (result.nextSelection) {
          draft.selectedElementIds = result.nextSelection;
        } else {
          draft.selectedElementIds = draft.selectedElementIds.filter((id) =>
            Boolean(nextLayout.elements[id]),
          );
        }
        draft.isDirty = computeIsDirty(
          nextLayout,
          draft.baselineLayout,
          nextTheme,
          draft.baselineTheme,
        );
        draft.saveError = null;
        draft.lastHistoryKey = options?.coalesceKey ?? null;
        draft.lastHistoryAt = now;
      });
    };

    return {
      isEditing: false,
      profileId: null,
      baselineLayout: null,
      baselineTheme: null,
      draftLayout: null,
      draftTheme: null,
      selectedElementIds: [],
      pendingUploadedAssetIds: [],
      retiredAssetIds: [],
      draftAssetMetadata: {},
      pendingCustomFonts: [],
      isDirty: false,
      past: [],
      future: [],
      activeSnapGuides: [],
      showLayersPanel: true,
      showInspectorPanel: true,
      isSaving: false,
      saveError: null,
      lastHistoryKey: null,
      lastHistoryAt: 0,

      enterEditMode: () => {
        const activeProfile = useWorkspaceStore.getState().getActiveProfile();
        if (!activeProfile) return false;

        const clonedLayout = pruneAndNormalizeGroups(cloneLayout(activeProfile.layout));
        const clonedTheme = structuredClone(activeProfile.theme);

        set((draft) => {
          draft.isEditing = true;
          draft.profileId = activeProfile.id;
          draft.baselineLayout = cloneLayout(clonedLayout);
          draft.baselineTheme = structuredClone(clonedTheme);
          draft.draftLayout = clonedLayout;
          draft.draftTheme = clonedTheme;
          draft.selectedElementIds = [];
          draft.pendingUploadedAssetIds = [];
          draft.retiredAssetIds = [];
          draft.draftAssetMetadata = {};
          draft.pendingCustomFonts = [];
          draft.isDirty = false;
          draft.past = [];
          draft.future = [];
          draft.activeSnapGuides = [];
          draft.isSaving = false;
          draft.saveError = null;
          draft.lastHistoryKey = null;
          draft.lastHistoryAt = 0;
        });
        return true;
      },

      discardChanges: () => {
        const state = get();
        const pendingToClean = [...state.pendingUploadedAssetIds];
        const savedWorkspace = useWorkspaceStore.getState().workspace;
        const activeProfile = savedWorkspace.profiles[savedWorkspace.activeProfileId];

        set((draft) => {
          draft.isEditing = false;
          draft.profileId = null;
          draft.baselineLayout = null;
          draft.baselineTheme = null;
          draft.draftLayout = null;
          draft.draftTheme = null;
          draft.selectedElementIds = [];
          draft.pendingUploadedAssetIds = [];
          draft.retiredAssetIds = [];
          draft.draftAssetMetadata = {};
          draft.pendingCustomFonts = [];
          draft.isDirty = false;
          draft.past = [];
          draft.future = [];
          draft.activeSnapGuides = [];
          draft.isSaving = false;
          draft.saveError = null;
          draft.lastHistoryKey = null;
          draft.lastHistoryAt = 0;
        });

        if (activeProfile) {
          useThemeStore.getState().syncFromThemeConfig(activeProfile.theme);
        }

        if (pendingToClean.length > 0) {
          void cleanupUnreferencedAssets(pendingToClean, savedWorkspace);
        }
      },

      commitDraft: async (service) => {
        const state = get();
        if (!state.isEditing || !state.draftLayout || state.isSaving) {
          return false;
        }

        const sanitized = pruneAndNormalizeGroups(state.draftLayout);
        const draftThemeSnapshot = state.draftTheme ? structuredClone(state.draftTheme) : undefined;
        const savedWorkspace = useWorkspaceStore.getState().workspace;

        set((draft) => {
          draft.isSaving = true;
          draft.saveError = null;
        });

        try {
          if (state.pendingUploadedAssetIds.length > 0) {
            const neededInDraft = collectReferencedAssetIds(savedWorkspace, {
              layout: sanitized,
              theme: draftThemeSnapshot ?? null,
            });
            const newIdsToCheck = state.pendingUploadedAssetIds.filter((id) =>
              neededInDraft.has(id),
            );
            const assetCheck = await verifySpecificAssetIdsExist(newIdsToCheck);
            if (!assetCheck.valid) {
              throw new Error(
                `Uploaded media asset missing from local database (${assetCheck.missingAssetIds.join(', ')}).`,
              );
            }
          }

          const candidateOrphans = [...state.pendingUploadedAssetIds, ...state.retiredAssetIds];

          await useWorkspaceStore.getState().commitActiveProfileDraft(
            {
              layout: sanitized,
              theme: draftThemeSnapshot,
              addedAssetMetadata: { ...state.draftAssetMetadata },
              addedCustomFonts: [...state.pendingCustomFonts],
              candidateOrphanIds: candidateOrphans,
            },
            service,
          );

          set((draft) => {
            draft.isEditing = false;
            draft.profileId = null;
            draft.baselineLayout = null;
            draft.baselineTheme = null;
            draft.draftLayout = null;
            draft.draftTheme = null;
            draft.selectedElementIds = [];
            draft.pendingUploadedAssetIds = [];
            draft.retiredAssetIds = [];
            draft.draftAssetMetadata = {};
            draft.pendingCustomFonts = [];
            draft.isDirty = false;
            draft.past = [];
            draft.future = [];
            draft.activeSnapGuides = [];
            draft.isSaving = false;
            draft.saveError = null;
            draft.lastHistoryKey = null;
            draft.lastHistoryAt = 0;
          });
          useToastStore.getState().push({
            title: 'Workspace saved',
            description: 'Your layout and visual changes have been committed cleanly.',
            variant: 'success',
          });
          return true;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unable to save workspace layout.';
          set((draft) => {
            draft.isSaving = false;
            draft.saveError = message;
          });
          useToastStore.getState().push({
            title: 'Save failed',
            description: `${message} Your draft is preserved—please retry.`,
            variant: 'error',
          });
          return false;
        }
      },

      selectElement: (id, options) => {
        const { draftLayout, isEditing, selectedElementIds } = get();
        if (!isEditing || !draftLayout || !draftLayout.elements[id]) return;

        const targetIds = expandSelectionWithGroups(draftLayout, [id]);
        if (options?.toggle || options?.additive) {
          const currentSet = new Set(selectedElementIds);
          const allTargetSelected = targetIds.every((tid) => currentSet.has(tid));
          if (allTargetSelected && options.toggle) {
            for (const tid of targetIds) currentSet.delete(tid);
          } else {
            for (const tid of targetIds) currentSet.add(tid);
          }
          set((draft) => {
            draft.selectedElementIds = draftLayout.zOrder.filter((zid) => currentSet.has(zid));
          });
          return;
        }

        set((draft) => {
          draft.selectedElementIds = targetIds;
        });
      },

      setSelection: (ids) => {
        const { draftLayout, isEditing } = get();
        if (!isEditing || !draftLayout) return;
        const expanded = expandSelectionWithGroups(draftLayout, ids);
        set((draft) => {
          draft.selectedElementIds = expanded;
        });
      },

      selectAll: () => {
        const { draftLayout, isEditing } = get();
        if (!isEditing || !draftLayout) return;
        const visibleIds = draftLayout.zOrder.filter((id) => draftLayout.elements[id]?.visible);
        set((draft) => {
          draft.selectedElementIds = visibleIds;
        });
      },

      clearSelection: () => {
        set((draft) => {
          draft.selectedElementIds = [];
          draft.activeSnapGuides = [];
        });
      },

      addElement: (element, options) => {
        pushCommittedMutation(options?.label ?? `Add ${element.type} element`, (layout) => {
          const nextLayout = insertElementIntoLayout(layout, element);
          return {
            nextLayout,
            nextSelection: options?.select === false ? undefined : [element.id],
            addedAssetMetadata: options?.assetMetadata,
            addedFontRecord: options?.fontRecord,
          };
        });
      },

      updateElementProps: (id, propsPatch, options) => {
        pushCommittedMutation(
          options?.label ?? 'Update element properties',
          (layout) => {
            const el = layout.elements[id];
            if (!el) return { nextLayout: layout };

            const retiredAssetIds: string[] = [];
            if (
              typeof propsPatch.assetId === 'string' &&
              typeof el.props.assetId === 'string' &&
              el.props.assetId !== propsPatch.assetId
            ) {
              retiredAssetIds.push(el.props.assetId);
            }
            if (
              propsPatch.uploadedFontAssetId !== undefined &&
              typeof el.props.uploadedFontAssetId === 'string' &&
              el.props.uploadedFontAssetId !== propsPatch.uploadedFontAssetId
            ) {
              retiredAssetIds.push(el.props.uploadedFontAssetId);
            }

            const next = cloneLayout(layout);
            if (next.elements[id]) {
              next.elements[id].props = {
                ...next.elements[id].props,
                ...structuredClone(propsPatch),
              };
            }

            return {
              nextLayout: next,
              addedAssetMetadata: options?.assetMetadata,
              addedFontRecord: options?.fontRecord,
              retiredAssetIds,
            };
          },
          { coalesceKey: options?.coalesceKey },
        );
      },

      updateElementStyle: (id, stylePatch, options) => {
        pushCommittedMutation(
          options?.label ?? 'Update element style',
          (layout) => {
            const el = layout.elements[id];
            if (!el) return { nextLayout: layout };
            const next = cloneLayout(layout);
            if (next.elements[id]) {
              next.elements[id].style = {
                ...next.elements[id].style,
                ...stylePatch,
              };
            }
            return { nextLayout: next };
          },
          { coalesceKey: options?.coalesceKey },
        );
      },

      updateDraftWallpaper: (patch, options) => {
        pushCommittedMutation(
          options?.label ?? 'Update wallpaper',
          (layout, _selectedIds, currentTheme) => {
            if (!currentTheme) return { nextLayout: layout };
            const nextTheme = structuredClone(currentTheme);
            const oldAssetId =
              nextTheme.wallpaper.type === 'image' ? nextTheme.wallpaper.assetId : null;
            nextTheme.wallpaper = {
              ...nextTheme.wallpaper,
              ...structuredClone(patch),
            };
            const retiredAssetIds =
              oldAssetId && oldAssetId !== nextTheme.wallpaper.assetId ? [oldAssetId] : [];
            return {
              nextLayout: layout,
              nextTheme,
              addedAssetMetadata: options?.assetMetadata,
              retiredAssetIds,
            };
          },
          { coalesceKey: options?.coalesceKey },
        );
      },

      updateDraftTheme: (patch, label = 'Update theme') => {
        pushCommittedMutation(label, (layout, _selectedIds, currentTheme) => {
          if (!currentTheme) return { nextLayout: layout };
          const nextTheme: ThemeConfig = {
            ...structuredClone(currentTheme),
            ...structuredClone(patch),
          };
          return {
            nextLayout: layout,
            nextTheme,
          };
        });
      },

      commitTransformPatches: (patches, label) => {
        pushCommittedMutation(label, (layout) => ({
          nextLayout: applyElementTransformPatches(layout, patches),
        }));
      },

      nudgeSelection: (dx, dy, canvasBounds = DEFAULT_REFERENCE_VIEWPORT) => {
        pushCommittedMutation(
          'Nudge elements',
          (layout, selectedIds) => ({
            nextLayout: nudgeElements(layout, selectedIds, dx, dy, canvasBounds),
          }),
          { coalesceKey: 'nudge' },
        );
      },

      duplicateSelection: (canvasBounds = DEFAULT_REFERENCE_VIEWPORT) => {
        pushCommittedMutation('Duplicate selection', (layout, selectedIds) => {
          const { layout: nextLayout, duplicatedIds } = duplicateElements(
            layout,
            selectedIds,
            canvasBounds,
          );
          return {
            nextLayout,
            nextSelection: duplicatedIds.length > 0 ? duplicatedIds : selectedIds,
          };
        });
      },

      deleteSelection: () => {
        pushCommittedMutation('Delete selection', (layout, selectedIds) => {
          const retiredAssetIds: string[] = [];
          for (const id of selectedIds) {
            retiredAssetIds.push(...extractElementAssetIds(layout.elements[id]));
          }
          return {
            nextLayout: deleteElements(layout, selectedIds),
            nextSelection: [],
            retiredAssetIds,
          };
        });
      },

      groupSelection: () => {
        pushCommittedMutation('Group selection', (layout, selectedIds) => ({
          nextLayout: groupElements(layout, selectedIds),
        }));
      },

      ungroupSelection: () => {
        pushCommittedMutation('Ungroup selection', (layout, selectedIds) => ({
          nextLayout: ungroupElements(layout, selectedIds),
        }));
      },

      toggleLockSelection: () => {
        pushCommittedMutation('Toggle lock', (layout, selectedIds) => {
          if (selectedIds.length === 0) return { nextLayout: layout };
          const allCurrentlyLocked = selectedIds.every((id) => layout.elements[id]?.locked);
          return {
            nextLayout: setElementsLocked(layout, selectedIds, !allCurrentlyLocked),
          };
        });
      },

      setElementLocked: (id, locked) => {
        pushCommittedMutation(locked ? 'Lock element' : 'Unlock element', (layout) => {
          const targetIds = expandSelectionWithGroups(layout, [id]);
          return {
            nextLayout: setElementsLocked(layout, targetIds, locked),
          };
        });
      },

      setElementVisibility: (id, visible) => {
        pushCommittedMutation(visible ? 'Show element' : 'Hide element', (layout) => ({
          nextLayout: setElementVisibilityInLayout(layout, id, visible),
        }));
      },

      renameElement: (id, name) => {
        pushCommittedMutation('Rename element', (layout) => ({
          nextLayout: renameElementInLayout(layout, id, name),
        }));
      },

      toggleElementAspectLock: (id) => {
        pushCommittedMutation('Toggle aspect ratio lock', (layout) => {
          const el = layout.elements[id];
          if (!el) return { nextLayout: layout };
          const next = cloneLayout(layout);
          if (next.elements[id]) {
            next.elements[id].transform.aspectLocked = !el.transform.aspectLocked;
          }
          return { nextLayout: next };
        });
      },

      reorderLayers: (action, targetIds) => {
        pushCommittedMutation(`Reorder layer (${action})`, (layout, selectedIds) => {
          const ids = targetIds && targetIds.length > 0 ? targetIds : selectedIds;
          return {
            nextLayout: reorderElementsZOrder(layout, ids, action),
          };
        });
      },

      alignSelection: (direction, canvasBounds = DEFAULT_REFERENCE_VIEWPORT) => {
        pushCommittedMutation(`Align ${direction}`, (layout, selectedIds) => ({
          nextLayout: alignSelectedElements(layout, selectedIds, direction, canvasBounds),
        }));
      },

      distributeSelection: (axis, canvasBounds = DEFAULT_REFERENCE_VIEWPORT) => {
        pushCommittedMutation(`Distribute ${axis}`, (layout, selectedIds) => ({
          nextLayout: distributeSelectedElements(layout, selectedIds, axis, canvasBounds),
        }));
      },

      bringAllIntoView: (canvasBounds = DEFAULT_REFERENCE_VIEWPORT) => {
        pushCommittedMutation('Bring all elements into view', (layout) => ({
          nextLayout: bringAllElementsIntoView(layout, canvasBounds),
        }));
      },

      updateGridConfig: (patch) => {
        pushCommittedMutation('Update grid & snap settings', (layout) => {
          const next = cloneLayout(layout);
          next.grid = {
            ...next.grid,
            ...patch,
          };
          return { nextLayout: next };
        });
      },

      undo: () => {
        const state = get();
        if (!state.isEditing || !state.draftLayout || state.past.length === 0) return;

        const previous = state.past[state.past.length - 1]!;
        const currentSnapshot: HistorySnapshot = {
          label: previous.label,
          layout: cloneLayout(state.draftLayout),
          theme: state.draftTheme ? structuredClone(state.draftTheme) : undefined,
          selectedElementIds: [...state.selectedElementIds],
        };

        set((draft) => {
          draft.past.pop();
          draft.future.push(currentSnapshot);
          if (draft.future.length > MAX_HISTORY_ENTRIES) {
            draft.future.shift();
          }
          draft.draftLayout = cloneLayout(previous.layout);
          const restoredTheme = previous.theme ? structuredClone(previous.theme) : draft.draftTheme;
          draft.draftTheme = restoredTheme;
          draft.selectedElementIds = [...previous.selectedElementIds];
          draft.isDirty = computeIsDirty(
            previous.layout,
            draft.baselineLayout,
            restoredTheme,
            draft.baselineTheme,
          );
          draft.activeSnapGuides = [];
          draft.saveError = null;
          draft.lastHistoryKey = null;
        });
      },

      redo: () => {
        const state = get();
        if (!state.isEditing || !state.draftLayout || state.future.length === 0) return;

        const nextSnap = state.future[state.future.length - 1]!;
        const currentSnapshot: HistorySnapshot = {
          label: nextSnap.label,
          layout: cloneLayout(state.draftLayout),
          theme: state.draftTheme ? structuredClone(state.draftTheme) : undefined,
          selectedElementIds: [...state.selectedElementIds],
        };

        set((draft) => {
          draft.future.pop();
          draft.past.push(currentSnapshot);
          if (draft.past.length > MAX_HISTORY_ENTRIES) {
            draft.past.shift();
          }
          draft.draftLayout = cloneLayout(nextSnap.layout);
          const restoredTheme = nextSnap.theme ? structuredClone(nextSnap.theme) : draft.draftTheme;
          draft.draftTheme = restoredTheme;
          draft.selectedElementIds = [...nextSnap.selectedElementIds];
          draft.isDirty = computeIsDirty(
            nextSnap.layout,
            draft.baselineLayout,
            restoredTheme,
            draft.baselineTheme,
          );
          draft.activeSnapGuides = [];
          draft.saveError = null;
          draft.lastHistoryKey = null;
        });
      },

      setActiveSnapGuides: (guides) => {
        set((draft) => {
          draft.activeSnapGuides = guides;
        });
      },

      setShowLayersPanel: (open) => {
        set((draft) => {
          draft.showLayersPanel = open;
        });
      },

      setShowInspectorPanel: (open) => {
        set((draft) => {
          draft.showInspectorPanel = open;
        });
      },
    };
  }),
);
