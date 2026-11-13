import type { CanvasLayout, ElementTransform, GenericCanvasElement } from '@/types/workspace';

export interface CanvasDimensions {
  width: number;
  height: number;
}

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export type AlignDirection = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributeAxis = 'horizontal' | 'vertical';

export const DEFAULT_REFERENCE_VIEWPORT: CanvasDimensions = {
  width: 1440,
  height: 900,
};

export const CANVAS_SAFE_PADDING_PX = 8;
export const MIN_VISIBLE_GRAB_MARGIN_PX = 32;

export function roundPrecision(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (min > max) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Uniformly scales reference dimensions (1440x900 baseline) to fit the active canvas bounds
 * while keeping widgets crisp across laptops and ultra-wide monitors.
 */
export function getCanvasScale(
  canvasBounds: CanvasDimensions,
  referenceViewport: CanvasDimensions = DEFAULT_REFERENCE_VIEWPORT,
): number {
  const safeW = Math.max(320, canvasBounds.width);
  const safeH = Math.max(240, canvasBounds.height);
  const refW = Math.max(320, referenceViewport.width);
  const refH = Math.max(240, referenceViewport.height);
  return clampNumber(Math.min(safeW / refW, safeH / refH), 0.55, 1.35);
}

/**
 * Converts persisted percentage anchor + reference-scaled pixels into viewport screen pixels
 * with non-destructive boundary clamping so elements stay accessible on smaller displays.
 */
export function transformToScreenRect(
  transform: ElementTransform,
  canvasBounds: CanvasDimensions,
  referenceViewport: CanvasDimensions = DEFAULT_REFERENCE_VIEWPORT,
): ScreenRect {
  const safeW = Math.max(320, canvasBounds.width);
  const safeH = Math.max(240, canvasBounds.height);
  const scale = getCanvasScale({ width: safeW, height: safeH }, referenceViewport);
  const minScale = Math.min(scale, 1);

  const minScreenW = Math.max(20, transform.minWidthPx * minScale);
  const minScreenH = Math.max(20, transform.minHeightPx * minScale);

  const maxW = Math.max(minScreenW, safeW - CANVAS_SAFE_PADDING_PX * 2);
  const maxH = Math.max(minScreenH, safeH - CANVAS_SAFE_PADDING_PX * 2);

  const width = clampNumber(transform.widthPx * scale, minScreenW, maxW);
  const height = clampNumber(transform.heightPx * scale, minScreenH, maxH);

  const rawLeft = (transform.xPct / 100) * safeW;
  const rawTop = (transform.yPct / 100) * safeH;

  const minLeft = Math.min(0, -width + MIN_VISIBLE_GRAB_MARGIN_PX);
  const maxLeft = Math.max(minLeft, safeW - Math.min(width, MIN_VISIBLE_GRAB_MARGIN_PX));
  const minTop = Math.min(0, -height + MIN_VISIBLE_GRAB_MARGIN_PX);
  const maxTop = Math.max(minTop, safeH - Math.min(height, MIN_VISIBLE_GRAB_MARGIN_PX));

  return {
    left: clampNumber(rawLeft, minLeft, maxLeft),
    top: clampNumber(rawTop, minTop, maxTop),
    width,
    height,
  };
}

/**
 * Clamps a screen rect strictly inside the full safe canvas interior [0, safeW] x [0, safeH]
 * (used during interactive moves/resizes/bring-into-view).
 */
export function clampScreenRectToCanvas(
  rect: ScreenRect,
  canvasBounds: CanvasDimensions,
): ScreenRect {
  const safeW = Math.max(320, canvasBounds.width);
  const safeH = Math.max(240, canvasBounds.height);
  const width = clampNumber(rect.width, 20, safeW);
  const height = clampNumber(rect.height, 20, safeH);
  const left = clampNumber(rect.left, 0, Math.max(0, safeW - width));
  const top = clampNumber(rect.top, 0, Math.max(0, safeH - height));
  return { left, top, width, height };
}

/**
 * Converts a screen rect back into persisted ElementTransform coordinates relative to referenceViewport.
 */
export function screenRectToTransform(
  rect: ScreenRect,
  baseTransform: ElementTransform,
  canvasBounds: CanvasDimensions,
  referenceViewport: CanvasDimensions = DEFAULT_REFERENCE_VIEWPORT,
): ElementTransform {
  const safeW = Math.max(320, canvasBounds.width);
  const safeH = Math.max(240, canvasBounds.height);
  const scale = getCanvasScale({ width: safeW, height: safeH }, referenceViewport);

  const clamped = clampScreenRectToCanvas(rect, { width: safeW, height: safeH });

  const widthPx = roundPrecision(
    clampNumber(clamped.width / scale, baseTransform.minWidthPx, 4000),
    2,
  );
  const heightPx = roundPrecision(
    clampNumber(clamped.height / scale, baseTransform.minHeightPx, 4000),
    2,
  );

  const xPct = roundPrecision(clampNumber((clamped.left / safeW) * 100, -50, 150), 3);
  const yPct = roundPrecision(clampNumber((clamped.top / safeH) * 100, -50, 150), 3);

  return {
    ...baseTransform,
    xPct,
    yPct,
    widthPx,
    heightPx,
  };
}

export function getRectUnion(rects: ScreenRect[]): ScreenRect | null {
  if (rects.length === 0) return null;
  let minLeft = Number.POSITIVE_INFINITY;
  let minTop = Number.POSITIVE_INFINITY;
  let maxRight = Number.NEGATIVE_INFINITY;
  let maxBottom = Number.NEGATIVE_INFINITY;

  for (const r of rects) {
    minLeft = Math.min(minLeft, r.left);
    minTop = Math.min(minTop, r.top);
    maxRight = Math.max(maxRight, r.left + r.width);
    maxBottom = Math.max(maxBottom, r.top + r.height);
  }

  return {
    left: minLeft,
    top: minTop,
    width: Math.max(1, maxRight - minLeft),
    height: Math.max(1, maxBottom - minTop),
  };
}

export function getElementsScreenRects(
  layout: CanvasLayout,
  elementIds: string[],
  canvasBounds: CanvasDimensions,
): Record<string, ScreenRect> {
  const result: Record<string, ScreenRect> = {};
  for (const id of elementIds) {
    const el = layout.elements[id];
    if (el) {
      result[id] = transformToScreenRect(el.transform, canvasBounds, layout.referenceViewport);
    }
  }
  return result;
}

/**
 * Computes an anchored resize rectangle from an explicit handle and delta without opposite-edge drift.
 */
export function computeResizedRect(
  startRect: ScreenRect,
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number,
  minWidth: number,
  minHeight: number,
  canvasBounds: CanvasDimensions,
  preserveAspect: boolean,
): ScreenRect {
  const safeW = Math.max(320, canvasBounds.width);
  const safeH = Math.max(240, canvasBounds.height);
  const effMinW = Math.max(20, Math.min(minWidth, safeW));
  const effMinH = Math.max(20, Math.min(minHeight, safeH));

  const startRight = startRect.left + startRect.width;
  const startBottom = startRect.top + startRect.height;

  let left = startRect.left;
  let top = startRect.top;
  let width = startRect.width;
  let height = startRect.height;

  const movesWest = handle === 'nw' || handle === 'w' || handle === 'sw';
  const movesEast = handle === 'ne' || handle === 'e' || handle === 'se';
  const movesNorth = handle === 'nw' || handle === 'n' || handle === 'ne';
  const movesSouth = handle === 'sw' || handle === 's' || handle === 'se';

  if (movesEast) {
    const maxEastWidth = Math.max(effMinW, safeW - startRect.left);
    width = clampNumber(startRect.width + deltaX, effMinW, maxEastWidth);
  } else if (movesWest) {
    const maxWestWidth = Math.max(effMinW, startRight);
    width = clampNumber(startRect.width - deltaX, effMinW, maxWestWidth);
    left = startRight - width;
  }

  if (movesSouth) {
    const maxSouthHeight = Math.max(effMinH, safeH - startRect.top);
    height = clampNumber(startRect.height + deltaY, effMinH, maxSouthHeight);
  } else if (movesNorth) {
    const maxNorthHeight = Math.max(effMinH, startBottom);
    height = clampNumber(startRect.height - deltaY, effMinH, maxNorthHeight);
    top = startBottom - height;
  }

  if (preserveAspect && startRect.width > 0 && startRect.height > 0) {
    const aspect = startRect.width / startRect.height;
    const isCorner = (movesEast || movesWest) && (movesNorth || movesSouth);
    if (isCorner) {
      const widthRatio = width / startRect.width;
      const heightRatio = height / startRect.height;
      if (Math.abs(widthRatio - 1) >= Math.abs(heightRatio - 1)) {
        height = clampNumber(width / aspect, effMinH, movesNorth ? startBottom : safeH - top);
        width = height * aspect;
      } else {
        width = clampNumber(height * aspect, effMinW, movesWest ? startRight : safeW - left);
        height = width / aspect;
      }
      if (movesWest) left = startRight - width;
      if (movesNorth) top = startBottom - height;
    } else if (movesEast || movesWest) {
      height = clampNumber(width / aspect, effMinH, safeH - top);
      width = height * aspect;
      if (movesWest) left = startRight - width;
    } else if (movesNorth || movesSouth) {
      width = clampNumber(height * aspect, effMinW, safeW - left);
      height = width / aspect;
      if (movesNorth) top = startBottom - height;
    }
  }

  return clampScreenRectToCanvas({ left, top, width, height }, { width: safeW, height: safeH });
}

/**
 * Proportionally transforms child rectangles inside a multi-selection or group bounding box resize.
 */
export function computeMultiSelectionResizedTransforms(
  startGroupRect: ScreenRect,
  nextGroupRect: ScreenRect,
  startMemberRects: Record<string, ScreenRect>,
  elements: Record<string, GenericCanvasElement>,
  canvasBounds: CanvasDimensions,
  referenceViewport: CanvasDimensions,
): Record<string, ElementTransform> {
  const scaleX = startGroupRect.width > 0 ? nextGroupRect.width / startGroupRect.width : 1;
  const scaleY = startGroupRect.height > 0 ? nextGroupRect.height / startGroupRect.height : 1;
  const nextTransforms: Record<string, ElementTransform> = {};

  for (const [id, memberStartRect] of Object.entries(startMemberRects)) {
    const element = elements[id];
    if (!element) continue;

    const relLeft = memberStartRect.left - startGroupRect.left;
    const relTop = memberStartRect.top - startGroupRect.top;

    const candidateRect: ScreenRect = {
      left: nextGroupRect.left + relLeft * scaleX,
      top: nextGroupRect.top + relTop * scaleY,
      width: memberStartRect.width * scaleX,
      height: memberStartRect.height * scaleY,
    };

    nextTransforms[id] = screenRectToTransform(
      candidateRect,
      element.transform,
      canvasBounds,
      referenceViewport,
    );
  }

  return nextTransforms;
}

export function rectsIntersect(a: ScreenRect, b: ScreenRect): boolean {
  return (
    a.left <= b.left + b.width &&
    a.left + a.width >= b.left &&
    a.top <= b.top + b.height &&
    a.top + a.height >= b.top
  );
}

export function normalizeMarqueeRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): ScreenRect {
  return {
    left: Math.min(startX, endX),
    top: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  };
}
