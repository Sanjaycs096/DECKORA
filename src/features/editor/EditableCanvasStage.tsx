import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import { useEditorSessionStore } from '@/state/editorSessionStore';
import type { ElementTransform } from '@/types/workspace';
import { CanvasWidgetContent } from './CanvasWidgetContent';
import {
  computeMultiSelectionResizedTransforms,
  computeResizedRect,
  getElementsScreenRects,
  getRectUnion,
  normalizeMarqueeRect,
  rectsIntersect,
  screenRectToTransform,
  type CanvasDimensions,
  type ResizeHandle,
  type ScreenRect,
} from './geometry';
import { expandSelectionWithGroups, getUnlockedIds } from './layoutOps';
import { snapMoveRect, snapResizeRect, type SnapGuideLine } from './snapping';

interface DragGestureState {
  mode: 'drag';
  startClientX: number;
  startClientY: number;
  moved: boolean;
  activeIds: string[];
  startRects: Record<string, ScreenRect>;
  startUnion: ScreenRect;
}

interface ResizeGestureState {
  mode: 'resize';
  handle: ResizeHandle;
  startClientX: number;
  startClientY: number;
  moved: boolean;
  activeIds: string[];
  startRects: Record<string, ScreenRect>;
  startUnion: ScreenRect;
  minWidth: number;
  minHeight: number;
  aspectLocked: boolean;
}

interface MarqueeGestureState {
  mode: 'marquee';
  startLocalX: number;
  startLocalY: number;
  additive: boolean;
  baseSelection: string[];
}

type ActiveGesture = DragGestureState | ResizeGestureState | MarqueeGestureState;

interface TransientRenderState {
  rects: Record<string, ScreenRect>;
  guides: SnapGuideLine[];
  marquee: ScreenRect | null;
  statusLabel: string | null;
}

const HANDLE_CONFIG: Array<{
  id: ResizeHandle;
  label: string;
  cursor: string;
  positionStyle: string;
}> = [
  {
    id: 'nw',
    label: 'Resize top left corner',
    cursor: 'nwse-resize',
    positionStyle: '-top-1.5 -left-1.5',
  },
  {
    id: 'n',
    label: 'Resize top edge',
    cursor: 'ns-resize',
    positionStyle: '-top-1.5 left-1/2 -translate-x-1/2',
  },
  {
    id: 'ne',
    label: 'Resize top right corner',
    cursor: 'nesw-resize',
    positionStyle: '-top-1.5 -right-1.5',
  },
  {
    id: 'e',
    label: 'Resize right edge',
    cursor: 'ew-resize',
    positionStyle: 'top-1/2 -right-1.5 -translate-y-1/2',
  },
  {
    id: 'se',
    label: 'Resize bottom right corner',
    cursor: 'nwse-resize',
    positionStyle: '-right-1.5 -bottom-1.5',
  },
  {
    id: 's',
    label: 'Resize bottom edge',
    cursor: 'ns-resize',
    positionStyle: '-bottom-1.5 left-1/2 -translate-x-1/2',
  },
  {
    id: 'sw',
    label: 'Resize bottom left corner',
    cursor: 'nesw-resize',
    positionStyle: '-bottom-1.5 -left-1.5',
  },
  {
    id: 'w',
    label: 'Resize left edge',
    cursor: 'ew-resize',
    positionStyle: 'top-1/2 -left-1.5 -translate-y-1/2',
  },
];

export interface EditableCanvasStageProps {
  canvasBounds: CanvasDimensions;
  stageRef: React.RefObject<HTMLDivElement | null>;
}

export function EditableCanvasStage({ canvasBounds, stageRef }: EditableCanvasStageProps) {
  const draftLayout = useEditorSessionStore((s) => s.draftLayout);
  const selectedElementIds = useEditorSessionStore((s) => s.selectedElementIds);

  const selectElement = useEditorSessionStore((s) => s.selectElement);
  const setSelection = useEditorSessionStore((s) => s.setSelection);
  const clearSelection = useEditorSessionStore((s) => s.clearSelection);
  const commitTransformPatches = useEditorSessionStore((s) => s.commitTransformPatches);

  const [transient, setTransient] = useState<TransientRenderState | null>(null);
  const gestureRef = useRef<ActiveGesture | null>(null);
  const latestTransientRef = useRef<TransientRenderState | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const cancelGesture = useCallback(() => {
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    gestureRef.current = null;
    latestTransientRef.current = null;
    setTransient(null);
  }, []);

  useEffect(() => {
    const handleEscCancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && gestureRef.current) {
        event.preventDefault();
        event.stopPropagation();
        cancelGesture();
      }
    };
    window.addEventListener('keydown', handleEscCancel, true);
    return () => {
      window.removeEventListener('keydown', handleEscCancel, true);
    };
  }, [cancelGesture]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const baseElementRects = useMemo(() => {
    if (!draftLayout) return {};
    return getElementsScreenRects(draftLayout, draftLayout.zOrder, canvasBounds);
  }, [draftLayout, canvasBounds]);

  const attachWindowPointerTracking = useCallback(
    (
      onMoveUpdate: (moveEvent: PointerEvent) => void,
      onFinish: (upEvent: PointerEvent) => void,
    ) => {
      let latestMoveEvent: PointerEvent | null = null;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        latestMoveEvent = moveEvent;
        if (rafIdRef.current !== null) return;
        rafIdRef.current = window.requestAnimationFrame(() => {
          rafIdRef.current = null;
          if (latestMoveEvent && gestureRef.current) {
            onMoveUpdate(latestMoveEvent);
          }
        });
      };

      const cleanup = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerCancel);
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        if (rafIdRef.current !== null) {
          window.cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        if (latestMoveEvent && gestureRef.current) {
          onMoveUpdate(latestMoveEvent);
        }
        cleanup();
        onFinish(upEvent);
      };

      const handlePointerCancel = () => {
        cleanup();
        cancelGesture();
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerCancel);
    },
    [cancelGesture],
  );

  const beginDragGesture = (event: ReactPointerEvent<HTMLDivElement>, activeIds: string[]) => {
    if (!draftLayout || activeIds.length === 0) return;

    const startRects = getElementsScreenRects(draftLayout, activeIds, canvasBounds);
    const startUnion = getRectUnion(Object.values(startRects));
    if (!startUnion) return;

    gestureRef.current = {
      mode: 'drag',
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
      activeIds,
      startRects,
      startUnion,
    };

    attachWindowPointerTracking(
      (moveEvent) => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.mode !== 'drag' || !draftLayout) return;

        const dx = moveEvent.clientX - gesture.startClientX;
        const dy = moveEvent.clientY - gesture.startClientY;
        if (!gesture.moved && Math.hypot(dx, dy) < 2) return;
        gesture.moved = true;

        const candidateUnion: ScreenRect = {
          ...gesture.startUnion,
          left: gesture.startUnion.left + dx,
          top: gesture.startUnion.top + dy,
        };

        const snapped = snapMoveRect(candidateUnion, draftLayout, gesture.activeIds, canvasBounds, {
          bypassSnap: moveEvent.altKey,
        });

        const actualDx = snapped.rect.left - gesture.startUnion.left;
        const actualDy = snapped.rect.top - gesture.startUnion.top;

        const nextRects: Record<string, ScreenRect> = {};
        for (const id of gesture.activeIds) {
          const orig = gesture.startRects[id];
          if (orig) {
            nextRects[id] = {
              ...orig,
              left: orig.left + actualDx,
              top: orig.top + actualDy,
            };
          }
        }

        const nextState: TransientRenderState = {
          rects: nextRects,
          guides: snapped.guides,
          marquee: null,
          statusLabel: `${Math.round(snapped.rect.left)}, ${Math.round(snapped.rect.top)}`,
        };
        latestTransientRef.current = nextState;
        setTransient(nextState);
      },
      () => {
        const gesture = gestureRef.current;
        const snapshot = latestTransientRef.current;
        gestureRef.current = null;
        latestTransientRef.current = null;
        setTransient(null);

        if (!gesture || gesture.mode !== 'drag' || !gesture.moved || !snapshot || !draftLayout) {
          return;
        }

        const patches: Record<string, ElementTransform> = {};
        for (const id of gesture.activeIds) {
          const el = draftLayout.elements[id];
          const finalRect = snapshot.rects[id];
          if (el && finalRect) {
            patches[id] = screenRectToTransform(
              finalRect,
              el.transform,
              canvasBounds,
              draftLayout.referenceViewport,
            );
          }
        }
        commitTransformPatches(
          patches,
          gesture.activeIds.length > 1 ? 'Move elements' : 'Move element',
        );
      },
    );
  };

  const beginResizeGesture = (
    handle: ResizeHandle,
    event: ReactPointerEvent<HTMLButtonElement>,
    activeIds: string[],
  ) => {
    event.stopPropagation();
    event.preventDefault();
    if (!draftLayout || activeIds.length === 0) return;

    const startRects = getElementsScreenRects(draftLayout, activeIds, canvasBounds);
    const startUnion = getRectUnion(Object.values(startRects));
    if (!startUnion) return;

    const singleEl = activeIds.length === 1 ? draftLayout.elements[activeIds[0]!] : undefined;
    const minWidth = singleEl ? singleEl.transform.minWidthPx * 0.65 : 64;
    const minHeight = singleEl ? singleEl.transform.minHeightPx * 0.65 : 48;
    const aspectLocked = Boolean(singleEl?.transform.aspectLocked);

    gestureRef.current = {
      mode: 'resize',
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
      activeIds,
      startRects,
      startUnion,
      minWidth,
      minHeight,
      aspectLocked,
    };

    attachWindowPointerTracking(
      (moveEvent) => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.mode !== 'resize' || !draftLayout) return;

        const dx = moveEvent.clientX - gesture.startClientX;
        const dy = moveEvent.clientY - gesture.startClientY;
        if (!gesture.moved && Math.hypot(dx, dy) < 2) return;
        gesture.moved = true;

        const preserveAspect = gesture.aspectLocked || moveEvent.shiftKey;
        const rawResized = computeResizedRect(
          gesture.startUnion,
          gesture.handle,
          dx,
          dy,
          gesture.minWidth,
          gesture.minHeight,
          canvasBounds,
          preserveAspect,
        );

        const snapped = preserveAspect
          ? { rect: rawResized, guides: [] as SnapGuideLine[] }
          : snapResizeRect(
              rawResized,
              gesture.handle,
              draftLayout,
              gesture.activeIds,
              canvasBounds,
              gesture.minWidth,
              gesture.minHeight,
              { bypassSnap: moveEvent.altKey },
            );

        const nextRects: Record<string, ScreenRect> = {};
        if (gesture.activeIds.length === 1) {
          nextRects[gesture.activeIds[0]!] = snapped.rect;
        } else {
          const scaleX =
            gesture.startUnion.width > 0 ? snapped.rect.width / gesture.startUnion.width : 1;
          const scaleY =
            gesture.startUnion.height > 0 ? snapped.rect.height / gesture.startUnion.height : 1;
          for (const id of gesture.activeIds) {
            const mStart = gesture.startRects[id];
            if (!mStart) continue;
            nextRects[id] = {
              left: snapped.rect.left + (mStart.left - gesture.startUnion.left) * scaleX,
              top: snapped.rect.top + (mStart.top - gesture.startUnion.top) * scaleY,
              width: Math.max(20, mStart.width * scaleX),
              height: Math.max(20, mStart.height * scaleY),
            };
          }
        }

        const nextState: TransientRenderState = {
          rects: nextRects,
          guides: snapped.guides,
          marquee: null,
          statusLabel: `${Math.round(snapped.rect.width)} × ${Math.round(snapped.rect.height)}`,
        };
        latestTransientRef.current = nextState;
        setTransient(nextState);
      },
      () => {
        const gesture = gestureRef.current;
        const snapshot = latestTransientRef.current;
        gestureRef.current = null;
        latestTransientRef.current = null;
        setTransient(null);

        if (!gesture || gesture.mode !== 'resize' || !gesture.moved || !snapshot || !draftLayout) {
          return;
        }

        if (gesture.activeIds.length === 1) {
          const id = gesture.activeIds[0]!;
          const el = draftLayout.elements[id];
          const finalRect = snapshot.rects[id];
          if (el && finalRect) {
            commitTransformPatches(
              {
                [id]: screenRectToTransform(
                  finalRect,
                  el.transform,
                  canvasBounds,
                  draftLayout.referenceViewport,
                ),
              },
              'Resize element',
            );
          }
        } else {
          const nextUnion = getRectUnion(Object.values(snapshot.rects));
          if (nextUnion) {
            const patches = computeMultiSelectionResizedTransforms(
              gesture.startUnion,
              nextUnion,
              gesture.startRects,
              draftLayout.elements,
              canvasBounds,
              draftLayout.referenceViewport,
            );
            commitTransformPatches(patches, 'Resize selection');
          }
        }
      },
    );
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !draftLayout) return;

    const stageRect = stageRef.current?.getBoundingClientRect();
    const startLocalX = stageRect ? event.clientX - stageRect.left : event.clientX;
    const startLocalY = stageRect ? event.clientY - stageRect.top : event.clientY;
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    const baseSelection = [...selectedElementIds];

    if (!additive) {
      clearSelection();
    }

    gestureRef.current = {
      mode: 'marquee',
      startLocalX,
      startLocalY,
      additive,
      baseSelection,
    };

    attachWindowPointerTracking(
      (moveEvent) => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.mode !== 'marquee' || !draftLayout) return;

        const currentStageRect = stageRef.current?.getBoundingClientRect();
        const curX = currentStageRect
          ? moveEvent.clientX - currentStageRect.left
          : moveEvent.clientX;
        const curY = currentStageRect
          ? moveEvent.clientY - currentStageRect.top
          : moveEvent.clientY;

        const box = normalizeMarqueeRect(gesture.startLocalX, gesture.startLocalY, curX, curY);
        if (box.width < 4 && box.height < 4) return;

        const hitIds: string[] = [];
        for (const id of draftLayout.zOrder) {
          const el = draftLayout.elements[id];
          const r = baseElementRects[id];
          if (!el || !el.visible || !r) continue;
          if (rectsIntersect(box, r)) {
            hitIds.push(id);
          }
        }

        const combined = gesture.additive
          ? Array.from(new Set([...gesture.baseSelection, ...hitIds]))
          : hitIds;
        setSelection(combined);

        const nextState: TransientRenderState = {
          rects: {},
          guides: [],
          marquee: box,
          statusLabel: `${combined.length} selected`,
        };
        latestTransientRef.current = nextState;
        setTransient(nextState);
      },
      () => {
        gestureRef.current = null;
        latestTransientRef.current = null;
        setTransient(null);
      },
    );
  };

  const handleElementPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    elementId: string,
  ) => {
    if (event.button !== 0 || !draftLayout) return;
    event.stopPropagation();

    const isToggle = event.ctrlKey || event.metaKey || event.shiftKey;
    let nextSelection = selectedElementIds;

    if (isToggle) {
      selectElement(elementId, { toggle: true });
      nextSelection = useEditorSessionStore.getState().selectedElementIds;
    } else if (!selectedElementIds.includes(elementId)) {
      selectElement(elementId);
      nextSelection = expandSelectionWithGroups(draftLayout, [elementId]);
    }

    const unlockedToMove = getUnlockedIds(draftLayout, nextSelection);
    if (unlockedToMove.length > 0 && nextSelection.includes(elementId)) {
      beginDragGesture(event, unlockedToMove);
    }
  };

  if (!draftLayout) return null;

  const displayedRects: Record<string, ScreenRect> = {
    ...baseElementRects,
    ...(transient?.rects ?? {}),
  };

  const selectedUnlockedIds = getUnlockedIds(draftLayout, selectedElementIds);
  const activeResizeBox =
    selectedUnlockedIds.length > 0
      ? getRectUnion(
          selectedUnlockedIds
            .map((id) => displayedRects[id])
            .filter((r): r is ScreenRect => Boolean(r)),
        )
      : null;

  const activeGroupsInSelection = Array.from(
    new Set(
      selectedElementIds
        .map((id) => draftLayout.elements[id]?.groupId)
        .filter((gid): gid is string => Boolean(gid && draftLayout.groups[gid])),
    ),
  );

  return (
    <main
      ref={stageRef}
      aria-label="Interactive canvas editor"
      onPointerDown={handleCanvasPointerDown}
      className="relative mt-14 h-[calc(100dvh-3.5rem)] w-full overflow-hidden select-none"
    >
      {/* Edit-mode visual grid overlay (never visible in normal View Mode) */}
      {draftLayout.grid.enabled && (
        <div
          aria-hidden="true"
          data-testid="canvas-grid-overlay"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(117, 207, 255, 0.24) 1px, transparent 1px)`,
            backgroundSize: `${draftLayout.grid.sizePx}px ${draftLayout.grid.sizePx}px`,
          }}
        />
      )}

      {/* Render workspace elements */}
      {draftLayout.zOrder.map((id, orderIndex) => {
        const element = draftLayout.elements[id];
        const rect = displayedRects[id];
        if (!element || !rect) return null;

        const isSelected = selectedElementIds.includes(id);

        return (
          <div
            key={id}
            data-editor-element-id={id}
            data-selected={isSelected ? 'true' : 'false'}
            data-locked={element.locked ? 'true' : 'false'}
            onPointerDown={(e) => handleElementPointerDown(e, id)}
            style={{
              left: `${rect.left}px`,
              top: `${rect.top}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
              zIndex: orderIndex + 1,
              opacity: element.visible ? element.style.opacity : 0.25,
            }}
            className={`group absolute transition-[box-shadow] duration-75 ${
              element.locked ? 'cursor-not-allowed' : 'cursor-move'
            }`}
          >
            {/* Non-interactive preview of actual widget so links/inputs do not hijack dragging */}
            <div className="pointer-events-none h-full w-full">
              <CanvasWidgetContent element={element} editPreview />
            </div>

            {/* Interactive selection outline */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 rounded-2xl border transition-colors ${
                isSelected
                  ? element.locked
                    ? 'border-dashed border-2 border-[var(--aurora-warning)] bg-[var(--aurora-warning)]/5'
                    : 'border-2 border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/5'
                  : 'border border-dashed border-transparent group-hover:border-[var(--aurora-border-highlight)]'
              }`}
            />

            {/* Element status badge on selection or lock */}
            {(isSelected || element.locked) && (
              <div className="pointer-events-none absolute -top-6 left-0 flex items-center gap-1 rounded-md border border-[var(--aurora-border)] bg-[var(--aurora-bg-elevated)]/95 px-1.5 py-0.5 text-[10px] font-medium text-[var(--aurora-text)] shadow-sm">
                {element.locked && (
                  <MaterialSymbol name="lock" size={11} className="text-[var(--aurora-warning)]" />
                )}
                <span>{element.name}</span>
                {element.locked && <span className="text-[var(--aurora-warning)]">(Locked)</span>}
              </div>
            )}
          </div>
        );
      })}

      {/* Group boundary overlays for selected grouped elements */}
      {activeGroupsInSelection.map((groupId) => {
        const group = draftLayout.groups[groupId];
        if (!group) return null;
        const memberRects = group.childIds
          .map((cid) => displayedRects[cid])
          .filter((r): r is ScreenRect => Boolean(r));
        const union = getRectUnion(memberRects);
        if (!union) return null;

        return (
          <div
            key={groupId}
            aria-hidden="true"
            className="pointer-events-none absolute z-30 rounded-2xl border border-dashed border-[var(--aurora-secondary)]"
            style={{
              left: `${union.left - 4}px`,
              top: `${union.top - 4}px`,
              width: `${union.width + 8}px`,
              height: `${union.height + 8}px`,
            }}
          >
            <span className="absolute -bottom-5 left-0 rounded bg-[var(--aurora-secondary)]/90 px-1.5 py-0.5 text-[10px] font-semibold text-[#0B1220]">
              {group.name}
            </span>
          </div>
        );
      })}

      {/* Active selection bounding box + 8 resize handles */}
      {activeResizeBox && (
        <div
          aria-label="Selection bounds"
          className="pointer-events-none absolute z-35 border border-[var(--aurora-primary)]"
          style={{
            left: `${activeResizeBox.left}px`,
            top: `${activeResizeBox.top}px`,
            width: `${activeResizeBox.width}px`,
            height: `${activeResizeBox.height}px`,
          }}
        >
          {HANDLE_CONFIG.map((handle) => (
            <button
              key={handle.id}
              type="button"
              aria-label={handle.label}
              data-resize-handle={handle.id}
              onPointerDown={(e) => beginResizeGesture(handle.id, e, selectedUnlockedIds)}
              style={{ cursor: handle.cursor }}
              className={`pointer-events-auto absolute h-3 w-3 rounded-sm border border-[#0B1220] bg-[var(--aurora-primary)] shadow-sm transition-transform hover:scale-125 focus-visible:ring-2 focus-visible:ring-[var(--aurora-primary)] focus-visible:outline-none ${handle.positionStyle}`}
            />
          ))}

          {transient?.statusLabel && (
            <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 rounded-md bg-[#0B1220]/95 px-2 py-0.5 font-mono text-[10px] font-medium whitespace-nowrap text-[var(--aurora-primary)] shadow">
              {transient.statusLabel}
            </div>
          )}
        </div>
      )}

      {/* Alignment guides */}
      {transient?.guides.map((guide) => (
        <div
          key={guide.id}
          aria-hidden="true"
          data-snap-guide={guide.orientation}
          className="pointer-events-none absolute z-40 bg-[var(--aurora-secondary)]"
          style={
            guide.orientation === 'vertical'
              ? {
                  left: `${guide.positionPx}px`,
                  top: `${guide.startPx}px`,
                  width: '1px',
                  height: `${Math.max(1, guide.endPx - guide.startPx)}px`,
                }
              : {
                  left: `${guide.startPx}px`,
                  top: `${guide.positionPx}px`,
                  width: `${Math.max(1, guide.endPx - guide.startPx)}px`,
                  height: '1px',
                }
          }
        />
      ))}

      {/* Marquee drag selection rectangle */}
      {transient?.marquee && (
        <div
          aria-hidden="true"
          data-testid="marquee-selection-box"
          className="pointer-events-none absolute z-40 rounded border border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/12"
          style={{
            left: `${transient.marquee.left}px`,
            top: `${transient.marquee.top}px`,
            width: `${transient.marquee.width}px`,
            height: `${transient.marquee.height}px`,
          }}
        />
      )}
    </main>
  );
}
