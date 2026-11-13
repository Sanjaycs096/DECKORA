import type {
  CanvasLayout,
  ElementGroup,
  ElementTransform,
  GenericCanvasElement,
  ThemeConfig,
} from '@/types/workspace';
import {
  clampNumber,
  clampScreenRectToCanvas,
  getCanvasScale,
  getElementsScreenRects,
  getRectUnion,
  roundPrecision,
  screenRectToTransform,
  transformToScreenRect,
  type AlignDirection,
  type CanvasDimensions,
  type DistributeAxis,
  type ScreenRect,
} from './geometry';

export const MAX_HISTORY_ENTRIES = 50;

export type LayerOrderAction =
  'bring-forward' | 'send-backward' | 'bring-to-front' | 'send-to-back';

export interface HistorySnapshot {
  label: string;
  layout: CanvasLayout;
  theme?: ThemeConfig;
  selectedElementIds: string[];
}

export function cloneLayout(layout: CanvasLayout): CanvasLayout {
  return structuredClone(layout);
}

export function generateStableId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeZOrder(layout: CanvasLayout): CanvasLayout {
  const next = cloneLayout(layout);
  const seen = new Set<string>();
  const cleanOrder: string[] = [];

  for (const id of next.zOrder) {
    if (!seen.has(id) && next.elements[id]) {
      seen.add(id);
      cleanOrder.push(id);
    }
  }

  for (const id of Object.keys(next.elements)) {
    if (!seen.has(id)) {
      seen.add(id);
      cleanOrder.push(id);
    }
  }

  next.zOrder = cleanOrder;
  cleanOrder.forEach((id, idx) => {
    const el = next.elements[id];
    if (el) {
      el.zIndex = idx;
    }
  });

  return next;
}

export function pruneAndNormalizeGroups(layout: CanvasLayout): CanvasLayout {
  const next = cloneLayout(layout);
  const nextGroups: Record<string, ElementGroup> = {};
  const claimedChildren = new Set<string>();

  for (const [groupId, group] of Object.entries(next.groups)) {
    const validChildIds: string[] = [];
    for (const childId of group.childIds) {
      if (next.elements[childId] && !claimedChildren.has(childId)) {
        validChildIds.push(childId);
        claimedChildren.add(childId);
      }
    }

    if (validChildIds.length >= 2) {
      nextGroups[groupId] = {
        ...group,
        childIds: validChildIds,
      };
      for (const childId of validChildIds) {
        const child = next.elements[childId];
        if (child) child.groupId = groupId;
      }
    } else if (validChildIds.length === 1) {
      const loneId = validChildIds[0];
      if (loneId && next.elements[loneId]) {
        next.elements[loneId].groupId = null;
      }
    }
  }

  for (const el of Object.values(next.elements)) {
    if (el.groupId !== null && !nextGroups[el.groupId]) {
      el.groupId = null;
    }
  }

  next.groups = nextGroups;
  return normalizeZOrder(next);
}

export interface LayoutIntegrityResult {
  valid: boolean;
  errors: string[];
}

export function validateLayoutIntegrity(layout: CanvasLayout): LayoutIntegrityResult {
  const errors: string[] = [];
  const elementIds = new Set(Object.keys(layout.elements));
  const zOrderSet = new Set(layout.zOrder);

  if (zOrderSet.size !== layout.zOrder.length) {
    errors.push('zOrder contains duplicate element IDs.');
  }

  for (const id of layout.zOrder) {
    if (!elementIds.has(id)) {
      errors.push(`zOrder references unknown element ID "${id}".`);
    }
  }

  for (const id of elementIds) {
    if (!zOrderSet.has(id)) {
      errors.push(`Element "${id}" is missing from zOrder.`);
    }
    const el = layout.elements[id];
    if (!el) continue;

    const t = el.transform;
    const nums = [t.xPct, t.yPct, t.widthPx, t.heightPx, t.minWidthPx, t.minHeightPx];
    if (nums.some((n) => !Number.isFinite(n))) {
      errors.push(`Element "${id}" has non-finite transform values.`);
    }
    if (
      t.widthPx <= 0 ||
      t.heightPx <= 0 ||
      t.widthPx < t.minWidthPx ||
      t.heightPx < t.minHeightPx
    ) {
      errors.push(`Element "${id}" has invalid or below-minimum dimensions.`);
    }
    if (el.groupId !== null) {
      const grp = layout.groups[el.groupId];
      if (!grp || !grp.childIds.includes(id)) {
        errors.push(`Element "${id}" references invalid group "${el.groupId}".`);
      }
    }
  }

  for (const [groupId, group] of Object.entries(layout.groups)) {
    const childSet = new Set(group.childIds);
    if (childSet.size !== group.childIds.length) {
      errors.push(`Group "${groupId}" has duplicate child IDs.`);
    }
    if (group.childIds.length < 2) {
      errors.push(`Group "${groupId}" has fewer than 2 child elements.`);
    }
    for (const childId of group.childIds) {
      const child = layout.elements[childId];
      if (!child) {
        errors.push(`Group "${groupId}" references missing element "${childId}".`);
      } else if (child.groupId !== groupId) {
        errors.push(`Group child "${childId}" has mismatched groupId "${String(child.groupId)}".`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function expandSelectionWithGroups(layout: CanvasLayout, elementIds: string[]): string[] {
  const expanded = new Set<string>();
  for (const id of elementIds) {
    const el = layout.elements[id];
    if (!el) continue;
    if (el.groupId && layout.groups[el.groupId]) {
      for (const childId of layout.groups[el.groupId]!.childIds) {
        if (layout.elements[childId]) expanded.add(childId);
      }
    } else {
      expanded.add(id);
    }
  }
  return layout.zOrder.filter((id) => expanded.has(id));
}

export function getUnlockedIds(layout: CanvasLayout, ids: string[]): string[] {
  return ids.filter((id) => {
    const el = layout.elements[id];
    if (!el || el.locked) return false;
    if (el.groupId && layout.groups[el.groupId]?.locked) return false;
    return true;
  });
}

export function areLayoutsEqual(a: CanvasLayout, b: CanvasLayout): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function applyElementTransformPatches(
  layout: CanvasLayout,
  patches: Record<string, ElementTransform>,
): CanvasLayout {
  const next = cloneLayout(layout);
  for (const [id, transform] of Object.entries(patches)) {
    const el = next.elements[id];
    if (el && !el.locked) {
      el.transform = {
        ...transform,
        widthPx: Math.max(transform.minWidthPx, transform.widthPx),
        heightPx: Math.max(transform.minHeightPx, transform.heightPx),
      };
    }
  }
  return next;
}

export function nudgeElements(
  layout: CanvasLayout,
  selectedIds: string[],
  deltaScreenX: number,
  deltaScreenY: number,
  canvasBounds: CanvasDimensions,
): CanvasLayout {
  const unlockedIds = getUnlockedIds(layout, selectedIds);
  if (unlockedIds.length === 0) return layout;

  const currentRects = getElementsScreenRects(layout, unlockedIds, canvasBounds);
  const groupUnion = getRectUnion(Object.values(currentRects));
  if (!groupUnion) return layout;

  const clampedDeltaX = clampNumber(
    deltaScreenX,
    -groupUnion.left,
    Math.max(0, canvasBounds.width - (groupUnion.left + groupUnion.width)),
  );
  const clampedDeltaY = clampNumber(
    deltaScreenY,
    -groupUnion.top,
    Math.max(0, canvasBounds.height - (groupUnion.top + groupUnion.height)),
  );

  if (clampedDeltaX === 0 && clampedDeltaY === 0) return layout;

  const patches: Record<string, ElementTransform> = {};
  for (const id of unlockedIds) {
    const el = layout.elements[id];
    const rect = currentRects[id];
    if (!el || !rect) continue;
    patches[id] = screenRectToTransform(
      {
        ...rect,
        left: rect.left + clampedDeltaX,
        top: rect.top + clampedDeltaY,
      },
      el.transform,
      canvasBounds,
      layout.referenceViewport,
    );
  }

  return applyElementTransformPatches(layout, patches);
}

export function canGroupSelection(layout: CanvasLayout, selectedIds: string[]): boolean {
  const unlocked = getUnlockedIds(layout, selectedIds);
  return unlocked.length >= 2;
}

export function canUngroupSelection(layout: CanvasLayout, selectedIds: string[]): boolean {
  return selectedIds.some((id) => {
    const el = layout.elements[id];
    return Boolean(el?.groupId && layout.groups[el.groupId]);
  });
}

export function groupElements(layout: CanvasLayout, selectedIds: string[]): CanvasLayout {
  const eligibleIds = layout.zOrder.filter((id) => {
    const el = layout.elements[id];
    return Boolean(el && !el.locked && selectedIds.includes(id));
  });
  if (eligibleIds.length < 2) return layout;

  const next = cloneLayout(layout);
  const groupId = generateStableId('grp');

  // Remove selected elements from any prior groups first
  for (const id of eligibleIds) {
    const el = next.elements[id];
    if (el?.groupId && next.groups[el.groupId]) {
      const oldGroup = next.groups[el.groupId]!;
      oldGroup.childIds = oldGroup.childIds.filter((cid) => cid !== id);
    }
    if (el) el.groupId = groupId;
  }

  const nextGroupNumber = Object.keys(next.groups).length + 1;
  next.groups[groupId] = {
    id: groupId,
    name: `Group ${nextGroupNumber}`,
    locked: false,
    hidden: false,
    childIds: eligibleIds,
  };

  return pruneAndNormalizeGroups(next);
}

export function ungroupElements(layout: CanvasLayout, selectedIds: string[]): CanvasLayout {
  const touchedGroupIds = new Set<string>();
  for (const id of selectedIds) {
    const groupId = layout.elements[id]?.groupId;
    if (groupId && layout.groups[groupId]) {
      touchedGroupIds.add(groupId);
    }
  }
  if (touchedGroupIds.size === 0) return layout;

  const next = cloneLayout(layout);
  for (const groupId of touchedGroupIds) {
    const grp = next.groups[groupId];
    if (grp) {
      for (const childId of grp.childIds) {
        if (next.elements[childId]) {
          next.elements[childId].groupId = null;
        }
      }
      delete next.groups[groupId];
    }
  }

  return pruneAndNormalizeGroups(next);
}

export function duplicateElements(
  layout: CanvasLayout,
  selectedIds: string[],
  canvasBounds: CanvasDimensions,
): { layout: CanvasLayout; duplicatedIds: string[] } {
  const orderedIds = layout.zOrder.filter((id) => selectedIds.includes(id) && layout.elements[id]);
  if (orderedIds.length === 0) return { layout, duplicatedIds: [] };

  const next = cloneLayout(layout);
  const offsetXPx = 24;
  const offsetYPx = 24;
  const duplicatedIds: string[] = [];
  const oldToNewId = new Map<string, string>();
  const oldGroupMembersSelected = new Map<string, string[]>();

  for (const oldId of orderedIds) {
    const original = layout.elements[oldId];
    if (!original) continue;
    if (original.groupId) {
      const arr = oldGroupMembersSelected.get(original.groupId) ?? [];
      arr.push(oldId);
      oldGroupMembersSelected.set(original.groupId, arr);
    }

    const newId = generateStableId(`el-${original.type}`);
    oldToNewId.set(oldId, newId);

    const cloned: GenericCanvasElement = structuredClone(original);
    cloned.id = newId;
    cloned.name = `${original.name} Copy`;
    cloned.locked = false;
    cloned.groupId = null;

    const currentRect = transformToScreenRect(
      cloned.transform,
      canvasBounds,
      next.referenceViewport,
    );
    const shiftedRect = clampScreenRectToCanvas(
      {
        ...currentRect,
        left: currentRect.left + offsetXPx,
        top: currentRect.top + offsetYPx,
      },
      canvasBounds,
    );
    cloned.transform = screenRectToTransform(
      shiftedRect,
      cloned.transform,
      canvasBounds,
      next.referenceViewport,
    );

    next.elements[newId] = cloned;
    next.zOrder.push(newId);
    duplicatedIds.push(newId);
  }

  // Recreate group membership if an entire group was selected and duplicated
  for (const [oldGroupId, selectedOldMembers] of oldGroupMembersSelected.entries()) {
    const oldGroup = layout.groups[oldGroupId];
    if (oldGroup && selectedOldMembers.length === oldGroup.childIds.length) {
      const newGroupId = generateStableId('grp');
      const newChildIds = selectedOldMembers
        .map((oid) => oldToNewId.get(oid))
        .filter((nid): nid is string => Boolean(nid));

      if (newChildIds.length >= 2) {
        next.groups[newGroupId] = {
          id: newGroupId,
          name: `${oldGroup.name} Copy`,
          locked: false,
          hidden: false,
          childIds: newChildIds,
        };
        for (const nid of newChildIds) {
          if (next.elements[nid]) next.elements[nid].groupId = newGroupId;
        }
      }
    }
  }

  return {
    layout: pruneAndNormalizeGroups(next),
    duplicatedIds,
  };
}

export function insertElementIntoLayout(
  layout: CanvasLayout,
  element: GenericCanvasElement,
): CanvasLayout {
  const next = cloneLayout(layout);
  const cloned = structuredClone(element);
  next.elements[cloned.id] = cloned;
  if (!next.zOrder.includes(cloned.id)) {
    next.zOrder.push(cloned.id);
  }
  return normalizeZOrder(next);
}

export function deleteElements(layout: CanvasLayout, selectedIds: string[]): CanvasLayout {
  const toDelete = new Set(selectedIds.filter((id) => Boolean(layout.elements[id])));
  if (toDelete.size === 0) return layout;

  const next = cloneLayout(layout);
  for (const id of toDelete) {
    const el = next.elements[id];
    if (el?.groupId && next.groups[el.groupId]) {
      const grp = next.groups[el.groupId]!;
      grp.childIds = grp.childIds.filter((cid) => cid !== id);
    }
    delete next.elements[id];
  }
  next.zOrder = next.zOrder.filter((id) => !toDelete.has(id));

  return pruneAndNormalizeGroups(next);
}

export function setElementsLocked(
  layout: CanvasLayout,
  elementIds: string[],
  locked: boolean,
): CanvasLayout {
  const next = cloneLayout(layout);
  let changed = false;

  for (const id of elementIds) {
    const el = next.elements[id];
    if (el && el.locked !== locked) {
      el.locked = locked;
      changed = true;
    }
  }

  if (!changed) return layout;

  for (const group of Object.values(next.groups)) {
    const allLocked = group.childIds.every((cid) => next.elements[cid]?.locked);
    group.locked = allLocked;
  }

  return next;
}

export function setElementVisibility(
  layout: CanvasLayout,
  elementId: string,
  visible: boolean,
): CanvasLayout {
  const el = layout.elements[elementId];
  if (!el || el.visible === visible) return layout;
  const next = cloneLayout(layout);
  if (next.elements[elementId]) {
    next.elements[elementId].visible = visible;
  }
  return next;
}

export function renameElement(layout: CanvasLayout, elementId: string, name: string): CanvasLayout {
  const trimmed = name.trim();
  const el = layout.elements[elementId];
  if (!el || !trimmed || el.name === trimmed) return layout;
  const next = cloneLayout(layout);
  if (next.elements[elementId]) {
    next.elements[elementId].name = trimmed.slice(0, 100);
  }
  return next;
}

export function reorderElementsZOrder(
  layout: CanvasLayout,
  selectedIds: string[],
  action: LayerOrderAction,
): CanvasLayout {
  const targetSet = new Set(selectedIds.filter((id) => Boolean(layout.elements[id])));
  if (targetSet.size === 0) return layout;

  const order = [...layout.zOrder];

  if (action === 'bring-to-front') {
    const rest = order.filter((id) => !targetSet.has(id));
    const moved = order.filter((id) => targetSet.has(id));
    const nextOrder = [...rest, ...moved];
    if (JSON.stringify(nextOrder) === JSON.stringify(order)) return layout;
    const next = cloneLayout(layout);
    next.zOrder = nextOrder;
    return normalizeZOrder(next);
  }

  if (action === 'send-to-back') {
    const moved = order.filter((id) => targetSet.has(id));
    const rest = order.filter((id) => !targetSet.has(id));
    const nextOrder = [...moved, ...rest];
    if (JSON.stringify(nextOrder) === JSON.stringify(order)) return layout;
    const next = cloneLayout(layout);
    next.zOrder = nextOrder;
    return normalizeZOrder(next);
  }

  if (action === 'bring-forward') {
    const nextOrder = [...order];
    for (let i = nextOrder.length - 2; i >= 0; i -= 1) {
      const curr = nextOrder[i]!;
      const above = nextOrder[i + 1]!;
      if (targetSet.has(curr) && !targetSet.has(above)) {
        nextOrder[i] = above;
        nextOrder[i + 1] = curr;
      }
    }
    if (JSON.stringify(nextOrder) === JSON.stringify(order)) return layout;
    const next = cloneLayout(layout);
    next.zOrder = nextOrder;
    return normalizeZOrder(next);
  }

  // send-backward
  const nextOrder = [...order];
  for (let i = 1; i < nextOrder.length; i += 1) {
    const curr = nextOrder[i]!;
    const below = nextOrder[i - 1]!;
    if (targetSet.has(curr) && !targetSet.has(below)) {
      nextOrder[i] = below;
      nextOrder[i - 1] = curr;
    }
  }
  if (JSON.stringify(nextOrder) === JSON.stringify(order)) return layout;
  const next = cloneLayout(layout);
  next.zOrder = nextOrder;
  return normalizeZOrder(next);
}

export function alignSelectedElements(
  layout: CanvasLayout,
  selectedIds: string[],
  direction: AlignDirection,
  canvasBounds: CanvasDimensions,
): CanvasLayout {
  const unlockedIds = getUnlockedIds(layout, selectedIds);
  if (unlockedIds.length === 0) return layout;

  const rects = getElementsScreenRects(layout, unlockedIds, canvasBounds);
  const boundingBox: ScreenRect =
    unlockedIds.length === 1
      ? { left: 0, top: 0, width: canvasBounds.width, height: canvasBounds.height }
      : (getRectUnion(Object.values(rects)) ?? {
          left: 0,
          top: 0,
          width: canvasBounds.width,
          height: canvasBounds.height,
        });

  const patches: Record<string, ElementTransform> = {};
  for (const id of unlockedIds) {
    const el = layout.elements[id];
    const rect = rects[id];
    if (!el || !rect) continue;

    let nextLeft = rect.left;
    let nextTop = rect.top;

    switch (direction) {
      case 'left':
        nextLeft = boundingBox.left;
        break;
      case 'center':
        nextLeft = boundingBox.left + (boundingBox.width - rect.width) / 2;
        break;
      case 'right':
        nextLeft = boundingBox.left + boundingBox.width - rect.width;
        break;
      case 'top':
        nextTop = boundingBox.top;
        break;
      case 'middle':
        nextTop = boundingBox.top + (boundingBox.height - rect.height) / 2;
        break;
      case 'bottom':
        nextTop = boundingBox.top + boundingBox.height - rect.height;
        break;
    }

    patches[id] = screenRectToTransform(
      { ...rect, left: nextLeft, top: nextTop },
      el.transform,
      canvasBounds,
      layout.referenceViewport,
    );
  }

  return applyElementTransformPatches(layout, patches);
}

export function distributeSelectedElements(
  layout: CanvasLayout,
  selectedIds: string[],
  axis: DistributeAxis,
  canvasBounds: CanvasDimensions,
): CanvasLayout {
  const unlockedIds = getUnlockedIds(layout, selectedIds);
  if (unlockedIds.length < 3) return layout;

  const rects = getElementsScreenRects(layout, unlockedIds, canvasBounds);
  const items = unlockedIds
    .map((id) => ({ id, rect: rects[id] }))
    .filter((entry): entry is { id: string; rect: ScreenRect } => Boolean(entry.rect));

  if (items.length < 3) return layout;

  const patches: Record<string, ElementTransform> = {};

  if (axis === 'horizontal') {
    const sorted = [...items].sort((a, b) => a.rect.left - b.rect.left);
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const totalWidths = sorted.reduce((acc, item) => acc + item.rect.width, 0);
    const span = last.rect.left + last.rect.width - first.rect.left;
    const gap = (span - totalWidths) / (sorted.length - 1);

    let cursor = first.rect.left + first.rect.width + gap;
    for (let i = 1; i < sorted.length - 1; i += 1) {
      const item = sorted[i]!;
      const el = layout.elements[item.id];
      if (!el) continue;
      patches[item.id] = screenRectToTransform(
        { ...item.rect, left: cursor },
        el.transform,
        canvasBounds,
        layout.referenceViewport,
      );
      cursor += item.rect.width + gap;
    }
  } else {
    const sorted = [...items].sort((a, b) => a.rect.top - b.rect.top);
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const totalHeights = sorted.reduce((acc, item) => acc + item.rect.height, 0);
    const span = last.rect.top + last.rect.height - first.rect.top;
    const gap = (span - totalHeights) / (sorted.length - 1);

    let cursor = first.rect.top + first.rect.height + gap;
    for (let i = 1; i < sorted.length - 1; i += 1) {
      const item = sorted[i]!;
      const el = layout.elements[item.id];
      if (!el) continue;
      patches[item.id] = screenRectToTransform(
        { ...item.rect, top: cursor },
        el.transform,
        canvasBounds,
        layout.referenceViewport,
      );
      cursor += item.rect.height + gap;
    }
  }

  return applyElementTransformPatches(layout, patches);
}

export function bringAllElementsIntoView(
  layout: CanvasLayout,
  canvasBounds: CanvasDimensions,
): CanvasLayout {
  const next = cloneLayout(layout);
  let changed = false;

  for (const id of next.zOrder) {
    const el = next.elements[id];
    if (!el) continue;
    const scale = getCanvasScale(canvasBounds, next.referenceViewport);
    const rawW = el.transform.widthPx * scale;
    const rawH = el.transform.heightPx * scale;
    const rawLeft = (el.transform.xPct / 100) * canvasBounds.width;
    const rawTop = (el.transform.yPct / 100) * canvasBounds.height;

    const clamped = clampScreenRectToCanvas(
      { left: rawLeft, top: rawTop, width: rawW, height: rawH },
      canvasBounds,
    );
    const nextTransform = screenRectToTransform(
      clamped,
      el.transform,
      canvasBounds,
      next.referenceViewport,
    );
    if (
      roundPrecision(nextTransform.xPct, 2) !== roundPrecision(el.transform.xPct, 2) ||
      roundPrecision(nextTransform.yPct, 2) !== roundPrecision(el.transform.yPct, 2) ||
      roundPrecision(nextTransform.widthPx, 1) !== roundPrecision(el.transform.widthPx, 1) ||
      roundPrecision(nextTransform.heightPx, 1) !== roundPrecision(el.transform.heightPx, 1)
    ) {
      el.transform = nextTransform;
      changed = true;
    }
  }

  return changed ? next : layout;
}
