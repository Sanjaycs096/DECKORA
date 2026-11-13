import { describe, expect, it } from 'vitest';
import {
  createDefaultCanvasLayout,
  DEFAULT_CLOCK_ELEMENT_ID,
  DEFAULT_SEARCH_ELEMENT_ID,
} from '@/services/storage/defaults';
import { snapMoveRect, snapResizeRect } from './snapping';
import { transformToScreenRect } from './geometry';

describe('Canvas Snapping & Alignment Guides', () => {
  const canvas = { width: 1440, height: 900 };

  it('snaps moving element to canvas center and emits alignment guide', () => {
    const layout = createDefaultCanvasLayout();
    layout.grid.snapToGuides = true;
    layout.grid.snapToGrid = false;
    layout.elements[DEFAULT_SEARCH_ELEMENT_ID]!.visible = false;
    layout.elements['el-shortcuts-default']!.visible = false;

    const movingWidth = 400;
    // Slightly off center by 3px (canvas center = 720, box left = 523 => center = 723)
    const result = snapMoveRect(
      { left: 523, top: 100, width: movingWidth, height: 120 },
      layout,
      [DEFAULT_CLOCK_ELEMENT_ID],
      canvas,
    );

    expect(result.snappedX).toBe(true);
    expect(result.rect.left).toBe(520);
    expect(result.guides.some((g) => g.orientation === 'vertical' && g.positionPx === 720)).toBe(
      true,
    );
  });

  it('snaps to other element edges (including locked elements) but never snaps to self', () => {
    const layout = createDefaultCanvasLayout();
    layout.grid.snapToGuides = true;
    layout.grid.snapToGrid = false;
    layout.elements['el-shortcuts-default']!.visible = false;

    const searchEl = layout.elements[DEFAULT_SEARCH_ELEMENT_ID]!;
    searchEl.transform.xPct = 10;
    searchEl.transform.widthPx = 200;
    searchEl.locked = true; // Locked elements remain valid snap references
    const searchRect = transformToScreenRect(searchEl.transform, canvas, layout.referenceViewport);

    // Move clock near searchRect.left within threshold (4px away)
    const snappedToOther = snapMoveRect(
      { left: searchRect.left + 4, top: 80, width: 300, height: 100 },
      layout,
      [DEFAULT_CLOCK_ELEMENT_ID],
      canvas,
    );
    expect(snappedToOther.rect.left).toBeCloseTo(searchRect.left, 2);

    // Put clock inside excludedIds so it cannot self-snap to its own original coordinates
    const clockEl = layout.elements[DEFAULT_CLOCK_ELEMENT_ID]!;
    clockEl.transform.xPct = 70;
    const clockRect = transformToScreenRect(clockEl.transform, canvas, layout.referenceViewport);
    const noSelfSnap = snapMoveRect(
      { left: clockRect.left + 4, top: 10, width: clockRect.width, height: clockRect.height },
      layout,
      [DEFAULT_CLOCK_ELEMENT_ID],
      canvas,
    );
    expect(noSelfSnap.rect.left).toBeCloseTo(clockRect.left + 4, 2);
  });

  it('applies configurable grid snapping and obeys snap threshold and bypass flag', () => {
    const layout = createDefaultCanvasLayout();
    layout.grid.snapToGuides = false;
    layout.grid.snapToGrid = true;
    layout.grid.sizePx = 16;

    const snapped = snapMoveRect(
      { left: 103, top: 203, width: 200, height: 100 },
      layout,
      [DEFAULT_CLOCK_ELEMENT_ID],
      canvas,
    );
    expect(snapped.rect.left).toBe(96);
    expect(snapped.rect.top).toBe(208);

    const bypassed = snapMoveRect(
      { left: 103, top: 203, width: 200, height: 100 },
      layout,
      [DEFAULT_CLOCK_ELEMENT_ID],
      canvas,
      { bypassSnap: true },
    );
    expect(bypassed.rect.left).toBe(103);
    expect(bypassed.rect.top).toBe(203);
    expect(bypassed.guides).toHaveLength(0);
  });

  it('snaps active resize edges to alignment targets cleanly', () => {
    const layout = createDefaultCanvasLayout();
    layout.grid.snapToGuides = true;
    layout.grid.snapToGrid = false;

    const searchRect = transformToScreenRect(
      layout.elements[DEFAULT_SEARCH_ELEMENT_ID]!.transform,
      canvas,
      layout.referenceViewport,
    );
    const searchRight = searchRect.left + searchRect.width;

    // Resizing right edge near searchRight
    const resized = snapResizeRect(
      { left: 300, top: 100, width: searchRight - 300 + 4, height: 120 },
      'e',
      layout,
      [DEFAULT_CLOCK_ELEMENT_ID],
      canvas,
      100,
      60,
    );

    expect(resized.snappedX).toBe(true);
    expect(resized.rect.left + resized.rect.width).toBeCloseTo(searchRight, 2);
  });
});
