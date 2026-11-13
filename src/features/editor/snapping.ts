import type { CanvasLayout } from '@/types/workspace';
import {
  clampScreenRectToCanvas,
  getRectUnion,
  transformToScreenRect,
  type CanvasDimensions,
  type ResizeHandle,
  type ScreenRect,
} from './geometry';

export const DEFAULT_SNAP_THRESHOLD_PX = 6;

export interface SnapGuideLine {
  id: string;
  orientation: 'vertical' | 'horizontal';
  positionPx: number;
  startPx: number;
  endPx: number;
  source: 'canvas' | 'element' | 'group';
}

export interface SnapComputationResult {
  rect: ScreenRect;
  guides: SnapGuideLine[];
  snappedX: boolean;
  snappedY: boolean;
}

interface AxisTarget {
  position: number;
  startPx: number;
  endPx: number;
  source: 'canvas' | 'element' | 'group';
}

export function collectSnapTargets(
  layout: CanvasLayout,
  excludedIds: Set<string>,
  canvasBounds: CanvasDimensions,
): { vertical: AxisTarget[]; horizontal: AxisTarget[] } {
  const vertical: AxisTarget[] = [
    { position: 0, startPx: 0, endPx: canvasBounds.height, source: 'canvas' },
    { position: canvasBounds.width / 2, startPx: 0, endPx: canvasBounds.height, source: 'canvas' },
    { position: canvasBounds.width, startPx: 0, endPx: canvasBounds.height, source: 'canvas' },
  ];

  const horizontal: AxisTarget[] = [
    { position: 0, startPx: 0, endPx: canvasBounds.width, source: 'canvas' },
    { position: canvasBounds.height / 2, startPx: 0, endPx: canvasBounds.width, source: 'canvas' },
    { position: canvasBounds.height, startPx: 0, endPx: canvasBounds.width, source: 'canvas' },
  ];

  for (const id of layout.zOrder) {
    if (excludedIds.has(id)) continue;
    const element = layout.elements[id];
    if (!element || !element.visible) continue;
    const rect = transformToScreenRect(element.transform, canvasBounds, layout.referenceViewport);

    vertical.push(
      { position: rect.left, startPx: rect.top, endPx: rect.top + rect.height, source: 'element' },
      {
        position: rect.left + rect.width / 2,
        startPx: rect.top,
        endPx: rect.top + rect.height,
        source: 'element',
      },
      {
        position: rect.left + rect.width,
        startPx: rect.top,
        endPx: rect.top + rect.height,
        source: 'element',
      },
    );

    horizontal.push(
      { position: rect.top, startPx: rect.left, endPx: rect.left + rect.width, source: 'element' },
      {
        position: rect.top + rect.height / 2,
        startPx: rect.left,
        endPx: rect.left + rect.width,
        source: 'element',
      },
      {
        position: rect.top + rect.height,
        startPx: rect.left,
        endPx: rect.left + rect.width,
        source: 'element',
      },
    );
  }

  for (const group of Object.values(layout.groups)) {
    const memberRects: ScreenRect[] = [];
    let hasExcludedMember = false;

    for (const childId of group.childIds) {
      if (excludedIds.has(childId)) {
        hasExcludedMember = true;
        break;
      }
      const child = layout.elements[childId];
      if (!child || !child.visible) continue;
      memberRects.push(
        transformToScreenRect(child.transform, canvasBounds, layout.referenceViewport),
      );
    }

    if (hasExcludedMember || memberRects.length === 0) continue;
    const union = getRectUnion(memberRects);
    if (!union) continue;

    vertical.push(
      {
        position: union.left,
        startPx: union.top,
        endPx: union.top + union.height,
        source: 'group',
      },
      {
        position: union.left + union.width / 2,
        startPx: union.top,
        endPx: union.top + union.height,
        source: 'group',
      },
      {
        position: union.left + union.width,
        startPx: union.top,
        endPx: union.top + union.height,
        source: 'group',
      },
    );

    horizontal.push(
      {
        position: union.top,
        startPx: union.left,
        endPx: union.left + union.width,
        source: 'group',
      },
      {
        position: union.top + union.height / 2,
        startPx: union.left,
        endPx: union.left + union.width,
        source: 'group',
      },
      {
        position: union.top + union.height,
        startPx: union.left,
        endPx: union.left + union.width,
        source: 'group',
      },
    );
  }

  return { vertical, horizontal };
}

export function snapMoveRect(
  candidateRect: ScreenRect,
  layout: CanvasLayout,
  movingElementIds: string[],
  canvasBounds: CanvasDimensions,
  options?: {
    thresholdPx?: number;
    bypassSnap?: boolean;
  },
): SnapComputationResult {
  const clampedCandidate = clampScreenRectToCanvas(candidateRect, canvasBounds);
  if (options?.bypassSnap) {
    return { rect: clampedCandidate, guides: [], snappedX: false, snappedY: false };
  }

  const thresholdPx = options?.thresholdPx ?? DEFAULT_SNAP_THRESHOLD_PX;
  const { snapToGrid, snapToGuides, sizePx } = layout.grid;
  const excludedIds = new Set(movingElementIds);
  const guides: SnapGuideLine[] = [];

  let nextLeft = clampedCandidate.left;
  let nextTop = clampedCandidate.top;
  let snappedX = false;
  let snappedY = false;

  if (snapToGuides) {
    const targets = collectSnapTargets(layout, excludedIds, canvasBounds);

    // Evaluate X edges: left, center, right
    const movingXAnchors = [
      clampedCandidate.left,
      clampedCandidate.left + clampedCandidate.width / 2,
      clampedCandidate.left + clampedCandidate.width,
    ];
    let bestXDist = thresholdPx + 0.001;
    let bestXDelta = 0;
    let bestXTarget: AxisTarget | null = null;

    for (const target of targets.vertical) {
      for (const anchor of movingXAnchors) {
        const delta = target.position - anchor;
        const absDelta = Math.abs(delta);
        if (absDelta < bestXDist) {
          const testLeft = nextLeft + delta;
          if (testLeft >= 0 && testLeft + clampedCandidate.width <= canvasBounds.width) {
            bestXDist = absDelta;
            bestXDelta = delta;
            bestXTarget = target;
          }
        }
      }
    }

    if (bestXTarget) {
      nextLeft += bestXDelta;
      snappedX = true;
      guides.push({
        id: `v-${Math.round(bestXTarget.position)}`,
        orientation: 'vertical',
        positionPx: bestXTarget.position,
        startPx: Math.min(bestXTarget.startPx, clampedCandidate.top),
        endPx: Math.max(bestXTarget.endPx, clampedCandidate.top + clampedCandidate.height),
        source: bestXTarget.source,
      });
    }

    // Evaluate Y edges: top, middle, bottom
    const movingYAnchors = [
      clampedCandidate.top,
      clampedCandidate.top + clampedCandidate.height / 2,
      clampedCandidate.top + clampedCandidate.height,
    ];
    let bestYDist = thresholdPx + 0.001;
    let bestYDelta = 0;
    let bestYTarget: AxisTarget | null = null;

    for (const target of targets.horizontal) {
      for (const anchor of movingYAnchors) {
        const delta = target.position - anchor;
        const absDelta = Math.abs(delta);
        if (absDelta < bestYDist) {
          const testTop = nextTop + delta;
          if (testTop >= 0 && testTop + clampedCandidate.height <= canvasBounds.height) {
            bestYDist = absDelta;
            bestYDelta = delta;
            bestYTarget = target;
          }
        }
      }
    }

    if (bestYTarget) {
      nextTop += bestYDelta;
      snappedY = true;
      guides.push({
        id: `h-${Math.round(bestYTarget.position)}`,
        orientation: 'horizontal',
        positionPx: bestYTarget.position,
        startPx: Math.min(bestYTarget.startPx, nextLeft),
        endPx: Math.max(bestYTarget.endPx, nextLeft + clampedCandidate.width),
        source: bestYTarget.source,
      });
    }
  }

  if (snapToGrid && sizePx > 0) {
    if (!snappedX) {
      const snappedGridX = Math.round(nextLeft / sizePx) * sizePx;
      if (snappedGridX >= 0 && snappedGridX + clampedCandidate.width <= canvasBounds.width) {
        nextLeft = snappedGridX;
        snappedX = true;
      }
    }
    if (!snappedY) {
      const snappedGridY = Math.round(nextTop / sizePx) * sizePx;
      if (snappedGridY >= 0 && snappedGridY + clampedCandidate.height <= canvasBounds.height) {
        nextTop = snappedGridY;
        snappedY = true;
      }
    }
  }

  return {
    rect: clampScreenRectToCanvas(
      {
        left: nextLeft,
        top: nextTop,
        width: clampedCandidate.width,
        height: clampedCandidate.height,
      },
      canvasBounds,
    ),
    guides,
    snappedX,
    snappedY,
  };
}

export function snapResizeRect(
  candidateRect: ScreenRect,
  handle: ResizeHandle,
  layout: CanvasLayout,
  resizingIds: string[],
  canvasBounds: CanvasDimensions,
  minWidth: number,
  minHeight: number,
  options?: {
    thresholdPx?: number;
    bypassSnap?: boolean;
  },
): SnapComputationResult {
  if (options?.bypassSnap) {
    return {
      rect: clampScreenRectToCanvas(candidateRect, canvasBounds),
      guides: [],
      snappedX: false,
      snappedY: false,
    };
  }

  const thresholdPx = options?.thresholdPx ?? DEFAULT_SNAP_THRESHOLD_PX;
  const { snapToGrid, snapToGuides, sizePx } = layout.grid;
  const guides: SnapGuideLine[] = [];

  let { left, top, width, height } = candidateRect;
  let snappedX = false;
  let snappedY = false;

  const movesWest = handle === 'nw' || handle === 'w' || handle === 'sw';
  const movesEast = handle === 'ne' || handle === 'e' || handle === 'se';
  const movesNorth = handle === 'nw' || handle === 'n' || handle === 'ne';
  const movesSouth = handle === 'sw' || handle === 's' || handle === 'se';

  const targets = snapToGuides
    ? collectSnapTargets(layout, new Set(resizingIds), canvasBounds)
    : null;

  if (targets) {
    if (movesEast) {
      const rightEdge = left + width;
      let bestDist = thresholdPx + 0.001;
      let bestTarget: AxisTarget | null = null;
      for (const t of targets.vertical) {
        const d = Math.abs(t.position - rightEdge);
        if (d < bestDist && t.position - left >= minWidth && t.position <= canvasBounds.width) {
          bestDist = d;
          bestTarget = t;
        }
      }
      if (bestTarget) {
        width = bestTarget.position - left;
        snappedX = true;
        guides.push({
          id: `rv-${Math.round(bestTarget.position)}`,
          orientation: 'vertical',
          positionPx: bestTarget.position,
          startPx: Math.min(bestTarget.startPx, top),
          endPx: Math.max(bestTarget.endPx, top + height),
          source: bestTarget.source,
        });
      }
    } else if (movesWest) {
      const rightEdge = left + width;
      let bestDist = thresholdPx + 0.001;
      let bestTarget: AxisTarget | null = null;
      for (const t of targets.vertical) {
        const d = Math.abs(t.position - left);
        if (d < bestDist && rightEdge - t.position >= minWidth && t.position >= 0) {
          bestDist = d;
          bestTarget = t;
        }
      }
      if (bestTarget) {
        width = rightEdge - bestTarget.position;
        left = bestTarget.position;
        snappedX = true;
        guides.push({
          id: `rv-${Math.round(bestTarget.position)}`,
          orientation: 'vertical',
          positionPx: bestTarget.position,
          startPx: Math.min(bestTarget.startPx, top),
          endPx: Math.max(bestTarget.endPx, top + height),
          source: bestTarget.source,
        });
      }
    }

    if (movesSouth) {
      const bottomEdge = top + height;
      let bestDist = thresholdPx + 0.001;
      let bestTarget: AxisTarget | null = null;
      for (const t of targets.horizontal) {
        const d = Math.abs(t.position - bottomEdge);
        if (d < bestDist && t.position - top >= minHeight && t.position <= canvasBounds.height) {
          bestDist = d;
          bestTarget = t;
        }
      }
      if (bestTarget) {
        height = bestTarget.position - top;
        snappedY = true;
        guides.push({
          id: `rh-${Math.round(bestTarget.position)}`,
          orientation: 'horizontal',
          positionPx: bestTarget.position,
          startPx: Math.min(bestTarget.startPx, left),
          endPx: Math.max(bestTarget.endPx, left + width),
          source: bestTarget.source,
        });
      }
    } else if (movesNorth) {
      const bottomEdge = top + height;
      let bestDist = thresholdPx + 0.001;
      let bestTarget: AxisTarget | null = null;
      for (const t of targets.horizontal) {
        const d = Math.abs(t.position - top);
        if (d < bestDist && bottomEdge - t.position >= minHeight && t.position >= 0) {
          bestDist = d;
          bestTarget = t;
        }
      }
      if (bestTarget) {
        height = bottomEdge - bestTarget.position;
        top = bestTarget.position;
        snappedY = true;
        guides.push({
          id: `rh-${Math.round(bestTarget.position)}`,
          orientation: 'horizontal',
          positionPx: bestTarget.position,
          startPx: Math.min(bestTarget.startPx, left),
          endPx: Math.max(bestTarget.endPx, left + width),
          source: bestTarget.source,
        });
      }
    }
  }

  if (snapToGrid && sizePx > 0) {
    if (!snappedX && movesEast) {
      const snappedRight = Math.round((left + width) / sizePx) * sizePx;
      if (snappedRight - left >= minWidth && snappedRight <= canvasBounds.width) {
        width = snappedRight - left;
        snappedX = true;
      }
    } else if (!snappedX && movesWest) {
      const rightEdge = left + width;
      const snappedLeft = Math.round(left / sizePx) * sizePx;
      if (rightEdge - snappedLeft >= minWidth && snappedLeft >= 0) {
        width = rightEdge - snappedLeft;
        left = snappedLeft;
        snappedX = true;
      }
    }

    if (!snappedY && movesSouth) {
      const snappedBottom = Math.round((top + height) / sizePx) * sizePx;
      if (snappedBottom - top >= minHeight && snappedBottom <= canvasBounds.height) {
        height = snappedBottom - top;
        snappedY = true;
      }
    } else if (!snappedY && movesNorth) {
      const bottomEdge = top + height;
      const snappedTop = Math.round(top / sizePx) * sizePx;
      if (bottomEdge - snappedTop >= minHeight && snappedTop >= 0) {
        height = bottomEdge - snappedTop;
        top = snappedTop;
        snappedY = true;
      }
    }
  }

  return {
    rect: clampScreenRectToCanvas({ left, top, width, height }, canvasBounds),
    guides,
    snappedX,
    snappedY,
  };
}
