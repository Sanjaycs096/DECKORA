import { describe, expect, it } from 'vitest';
import type { ElementTransform, GenericCanvasElement } from '@/types/workspace';
import {
  clampScreenRectToCanvas,
  computeMultiSelectionResizedTransforms,
  computeResizedRect,
  normalizeMarqueeRect,
  rectsIntersect,
  screenRectToTransform,
  transformToScreenRect,
} from './geometry';

const baseTransform: ElementTransform = {
  xPct: 25,
  yPct: 20,
  widthPx: 400,
  heightPx: 120,
  minWidthPx: 160,
  minHeightPx: 60,
  aspectLocked: false,
};

describe('Canvas Coordinate Geometry', () => {
  it('converts between persisted transform and screen rect cleanly without drift on 1440x900', () => {
    const canvas = { width: 1440, height: 900 };
    const screen = transformToScreenRect(baseTransform, canvas, canvas);

    expect(screen.left).toBeCloseTo(360, 2);
    expect(screen.top).toBeCloseTo(180, 2);
    expect(screen.width).toBeCloseTo(400, 2);
    expect(screen.height).toBeCloseTo(120, 2);

    const roundTripped = screenRectToTransform(screen, baseTransform, canvas, canvas);
    expect(roundTripped.xPct).toBeCloseTo(baseTransform.xPct, 2);
    expect(roundTripped.yPct).toBeCloseTo(baseTransform.yPct, 2);
    expect(roundTripped.widthPx).toBeCloseTo(baseTransform.widthPx, 1);
    expect(roundTripped.heightPx).toBeCloseTo(baseTransform.heightPx, 1);
  });

  it('scales proportionally on smaller laptop and larger ultrawide viewports with boundary clamping', () => {
    const ref = { width: 1440, height: 900 };
    const laptop = { width: 1024, height: 640 };
    const ultrawide = { width: 2560, height: 1440 };

    const laptopRect = transformToScreenRect(baseTransform, laptop, ref);
    expect(laptopRect.width).toBeLessThan(400);
    expect(laptopRect.width).toBeGreaterThanOrEqual(baseTransform.minWidthPx * 0.6);

    const ultrawideRect = transformToScreenRect(baseTransform, ultrawide, ref);
    expect(ultrawideRect.width).toBeGreaterThan(400);

    const clamped = clampScreenRectToCanvas(
      { left: -50, top: 700, width: 300, height: 200 },
      { width: 800, height: 600 },
    );
    expect(clamped.left).toBe(0);
    expect(clamped.top).toBe(400);
    expect(clamped.width).toBe(300);
    expect(clamped.height).toBe(200);
  });

  it('resizes with stable opposite-edge anchoring and minimum dimensions', () => {
    const canvas = { width: 1200, height: 800 };
    const start = { left: 300, top: 200, width: 200, height: 100 };

    // Resize from west edge leftward by 40px -> right edge (500) must stay anchored
    const westExpanded = computeResizedRect(start, 'w', -40, 0, 100, 50, canvas, false);
    expect(westExpanded.left).toBe(260);
    expect(westExpanded.width).toBe(240);
    expect(westExpanded.left + westExpanded.width).toBe(500);

    // Shrink beyond minWidth -> clamps at minWidth (100) cleanly without negative width
    const westClamped = computeResizedRect(start, 'w', 500, 0, 100, 50, canvas, false);
    expect(westClamped.width).toBe(100);
    expect(westClamped.left).toBe(400);
    expect(westClamped.height).toBe(100);
  });

  it('preserves aspect ratio on corner resize when aspect lock is active', () => {
    const canvas = { width: 1200, height: 800 };
    const start = { left: 100, top: 100, width: 200, height: 100 }; // 2:1 ratio

    const resized = computeResizedRect(start, 'se', 100, 10, 50, 25, canvas, true);
    expect(resized.width / resized.height).toBeCloseTo(2, 2);
  });

  it('proportionally transforms group/multi-selection member bounds during bounding box resize', () => {
    const canvas = { width: 1440, height: 900 };
    const elA: GenericCanvasElement = {
      id: 'a',
      type: 'clock',
      name: 'A',
      zIndex: 0,
      visible: true,
      locked: false,
      groupId: null,
      style: {
        opacity: 1,
        borderWidthPx: 0,
        borderColor: 'transparent',
        borderStyle: 'none',
        shadow: 'none',
        cornerRadiusPx: 8,
      },
      transform: {
        xPct: 10,
        yPct: 10,
        widthPx: 100,
        heightPx: 100,
        minWidthPx: 40,
        minHeightPx: 40,
        aspectLocked: false,
      },
      props: {},
    };
    const elB: GenericCanvasElement = {
      ...elA,
      id: 'b',
      name: 'B',
      transform: { ...elA.transform, xPct: 20, yPct: 20 },
    };

    const startMemberRects = {
      a: { left: 100, top: 100, width: 100, height: 100 },
      b: { left: 200, top: 200, width: 100, height: 100 },
    };
    const startGroup = { left: 100, top: 100, width: 200, height: 200 };
    const nextGroup = { left: 100, top: 100, width: 400, height: 400 }; // 2x scale

    const result = computeMultiSelectionResizedTransforms(
      startGroup,
      nextGroup,
      startMemberRects,
      { a: elA, b: elB },
      canvas,
      canvas,
    );

    expect(result.a?.widthPx).toBeCloseTo(200, 1);
    expect(result.b?.widthPx).toBeCloseTo(200, 1);
    // Element b left moves proportionally from +100px relative offset to +200px (left = 300px -> ~20.833%)
    expect(result.b?.xPct).toBeCloseTo((300 / 1440) * 100, 2);
  });

  it('normalizes marquee rectangles and detects element intersection regardless of drag direction', () => {
    const marquee = normalizeMarqueeRect(400, 350, 150, 120);
    expect(marquee).toEqual({ left: 150, top: 120, width: 250, height: 230 });

    expect(rectsIntersect(marquee, { left: 300, top: 200, width: 150, height: 80 })).toBe(true);
    expect(rectsIntersect(marquee, { left: 500, top: 500, width: 100, height: 80 })).toBe(false);
  });
});
