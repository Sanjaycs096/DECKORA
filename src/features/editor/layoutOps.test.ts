import { describe, expect, it } from 'vitest';
import {
  createDefaultCanvasLayout,
  DEFAULT_CLOCK_ELEMENT_ID,
  DEFAULT_SEARCH_ELEMENT_ID,
  DEFAULT_SHORTCUTS_ELEMENT_ID,
  DEFAULT_SPEED_ELEMENT_ID,
} from '@/services/storage/defaults';
import {
  alignSelectedElements,
  deleteElements,
  distributeSelectedElements,
  duplicateElements,
  expandSelectionWithGroups,
  groupElements,
  nudgeElements,
  reorderElementsZOrder,
  setElementsLocked,
  ungroupElements,
  validateLayoutIntegrity,
} from './layoutOps';
import { transformToScreenRect } from './geometry';

describe('Canvas Layout Operations (Grouping, Layering, Duplicate, Delete, Align)', () => {
  const canvas = { width: 1440, height: 900 };

  it('groups and ungroups elements cleanly without altering visible element positions', () => {
    const initial = createDefaultCanvasLayout();
    const beforeClock = { ...initial.elements[DEFAULT_CLOCK_ELEMENT_ID]!.transform };
    const beforeSearch = { ...initial.elements[DEFAULT_SEARCH_ELEMENT_ID]!.transform };

    const grouped = groupElements(initial, [DEFAULT_CLOCK_ELEMENT_ID, DEFAULT_SEARCH_ELEMENT_ID]);
    const integrityGrouped = validateLayoutIntegrity(grouped);
    expect(integrityGrouped.valid).toBe(true);

    const groupId = grouped.elements[DEFAULT_CLOCK_ELEMENT_ID]?.groupId;
    expect(groupId).toBeTruthy();
    expect(grouped.elements[DEFAULT_SEARCH_ELEMENT_ID]?.groupId).toBe(groupId);
    expect(grouped.groups[groupId!]?.childIds).toEqual([
      DEFAULT_CLOCK_ELEMENT_ID,
      DEFAULT_SEARCH_ELEMENT_ID,
    ]);

    // Selection expansion returns full group membership
    expect(expandSelectionWithGroups(grouped, [DEFAULT_CLOCK_ELEMENT_ID])).toEqual([
      DEFAULT_CLOCK_ELEMENT_ID,
      DEFAULT_SEARCH_ELEMENT_ID,
    ]);

    const ungrouped = ungroupElements(grouped, [DEFAULT_CLOCK_ELEMENT_ID]);
    expect(validateLayoutIntegrity(ungrouped).valid).toBe(true);
    expect(Object.keys(ungrouped.groups)).toHaveLength(0);
    expect(ungrouped.elements[DEFAULT_CLOCK_ELEMENT_ID]?.groupId).toBeNull();
    expect(ungrouped.elements[DEFAULT_CLOCK_ELEMENT_ID]?.transform).toEqual(beforeClock);
    expect(ungrouped.elements[DEFAULT_SEARCH_ELEMENT_ID]?.transform).toEqual(beforeSearch);
  });

  it('dissolves orphan 1-member groups automatically when deleting one group child', () => {
    const grouped = groupElements(createDefaultCanvasLayout(), [
      DEFAULT_CLOCK_ELEMENT_ID,
      DEFAULT_SEARCH_ELEMENT_ID,
    ]);

    const afterDelete = deleteElements(grouped, [DEFAULT_CLOCK_ELEMENT_ID]);
    expect(validateLayoutIntegrity(afterDelete).valid).toBe(true);
    expect(afterDelete.elements[DEFAULT_CLOCK_ELEMENT_ID]).toBeUndefined();
    expect(afterDelete.elements[DEFAULT_SEARCH_ELEMENT_ID]?.groupId).toBeNull();
    expect(Object.keys(afterDelete.groups)).toHaveLength(0);
  });

  it('duplicates selected elements with new IDs and preserves full-group cloning', () => {
    const grouped = groupElements(createDefaultCanvasLayout(), [
      DEFAULT_CLOCK_ELEMENT_ID,
      DEFAULT_SEARCH_ELEMENT_ID,
    ]);

    const { layout: afterDup, duplicatedIds } = duplicateElements(
      grouped,
      [DEFAULT_CLOCK_ELEMENT_ID, DEFAULT_SEARCH_ELEMENT_ID],
      canvas,
    );

    expect(validateLayoutIntegrity(afterDup).valid).toBe(true);
    expect(duplicatedIds).toHaveLength(2);
    expect(afterDup.zOrder).toHaveLength(6);

    const dupGroupId = afterDup.elements[duplicatedIds[0]!]?.groupId;
    expect(dupGroupId).toBeTruthy();
    expect(dupGroupId).not.toBe(grouped.elements[DEFAULT_CLOCK_ELEMENT_ID]?.groupId);
    expect(afterDup.elements[duplicatedIds[1]!]?.groupId).toBe(dupGroupId);
  });

  it('updates stacking order and keeps zOrder & numeric zIndex synchronized', () => {
    const initial = createDefaultCanvasLayout();
    expect(initial.zOrder).toEqual([
      DEFAULT_CLOCK_ELEMENT_ID,
      DEFAULT_SEARCH_ELEMENT_ID,
      DEFAULT_SHORTCUTS_ELEMENT_ID,
      DEFAULT_SPEED_ELEMENT_ID,
    ]);

    const front = reorderElementsZOrder(initial, [DEFAULT_CLOCK_ELEMENT_ID], 'bring-to-front');
    expect(front.zOrder).toEqual([
      DEFAULT_SEARCH_ELEMENT_ID,
      DEFAULT_SHORTCUTS_ELEMENT_ID,
      DEFAULT_SPEED_ELEMENT_ID,
      DEFAULT_CLOCK_ELEMENT_ID,
    ]);
    expect(front.elements[DEFAULT_CLOCK_ELEMENT_ID]?.zIndex).toBe(3);
    expect(front.elements[DEFAULT_SEARCH_ELEMENT_ID]?.zIndex).toBe(0);

    const back = reorderElementsZOrder(front, [DEFAULT_CLOCK_ELEMENT_ID], 'send-to-back');
    expect(back.zOrder).toEqual(initial.zOrder);
  });

  it('prevents locked elements from nudging or aligning', () => {
    const initial = createDefaultCanvasLayout();
    const locked = setElementsLocked(initial, [DEFAULT_CLOCK_ELEMENT_ID], true);

    const nudged = nudgeElements(locked, [DEFAULT_CLOCK_ELEMENT_ID], 20, 20, canvas);
    expect(nudged.elements[DEFAULT_CLOCK_ELEMENT_ID]?.transform).toEqual(
      locked.elements[DEFAULT_CLOCK_ELEMENT_ID]?.transform,
    );

    const aligned = alignSelectedElements(locked, [DEFAULT_CLOCK_ELEMENT_ID], 'left', canvas);
    expect(aligned.elements[DEFAULT_CLOCK_ELEMENT_ID]?.transform).toEqual(
      locked.elements[DEFAULT_CLOCK_ELEMENT_ID]?.transform,
    );
  });

  it('distributes 3+ elements evenly along vertical axis', () => {
    const initial = createDefaultCanvasLayout();
    initial.elements[DEFAULT_CLOCK_ELEMENT_ID]!.transform.yPct = 10;
    initial.elements[DEFAULT_SEARCH_ELEMENT_ID]!.transform.yPct = 22;
    initial.elements[DEFAULT_SHORTCUTS_ELEMENT_ID]!.transform.yPct = 60;

    const distributed = distributeSelectedElements(
      initial,
      [DEFAULT_CLOCK_ELEMENT_ID, DEFAULT_SEARCH_ELEMENT_ID, DEFAULT_SHORTCUTS_ELEMENT_ID],
      'vertical',
      canvas,
    );

    const r1 = transformToScreenRect(
      distributed.elements[DEFAULT_CLOCK_ELEMENT_ID]!.transform,
      canvas,
      canvas,
    );
    const r2 = transformToScreenRect(
      distributed.elements[DEFAULT_SEARCH_ELEMENT_ID]!.transform,
      canvas,
      canvas,
    );
    const r3 = transformToScreenRect(
      distributed.elements[DEFAULT_SHORTCUTS_ELEMENT_ID]!.transform,
      canvas,
      canvas,
    );

    const gap1 = r2.top - (r1.top + r1.height);
    const gap2 = r3.top - (r2.top + r2.height);
    expect(gap1).toBeCloseTo(gap2, 0);
  });
});
