import { generateStableId } from '@/features/editor/layoutOps';
import {
  DEFAULT_CLOCK_PROPS,
  DEFAULT_SEARCH_PROPS,
  DEFAULT_SHORTCUT_ITEMS,
  DEFAULT_SHORTCUTS_PROPS,
  DEFAULT_SPEED_PROPS,
} from '@/services/storage/defaults';
import type { CanvasLayout, GenericCanvasElement } from '@/types/workspace';

export type PresetWidgetKind = 'clock' | 'search' | 'shortcuts' | 'speed';

function centerPosition(widthPx: number, heightPx: number, layout?: CanvasLayout | null) {
  const refW = layout?.referenceViewport.width ?? 1440;
  const refH = layout?.referenceViewport.height ?? 900;
  const xPct = Number((((refW - widthPx) / 2 / refW) * 100).toFixed(2));
  const yPct = Number((((refH - heightPx) / 2 / refH) * 100).toFixed(2));
  return { xPct, yPct };
}

export function createPresetWidgetElement(
  kind: PresetWidgetKind,
  draftLayout?: CanvasLayout | null,
): GenericCanvasElement {
  const zIndex = draftLayout ? draftLayout.zOrder.length : 0;

  switch (kind) {
    case 'speed': {
      const widthPx = 300;
      const heightPx = 184;
      const pos = centerPosition(widthPx, heightPx, draftLayout);
      return {
        id: generateStableId('el-speed'),
        type: 'speed',
        name: 'Speed Monitor',
        zIndex,
        visible: true,
        locked: false,
        groupId: null,
        transform: {
          xPct: pos.xPct,
          yPct: pos.yPct,
          widthPx,
          heightPx,
          minWidthPx: 220,
          minHeightPx: 132,
          aspectLocked: false,
        },
        style: {
          opacity: 1,
          borderWidthPx: 1,
          borderColor: 'rgba(229, 234, 242, 0.16)',
          borderStyle: 'solid',
          shadow: 'soft',
          cornerRadiusPx: 20,
        },
        props: { ...DEFAULT_SPEED_PROPS },
      };
    }

    case 'clock': {
      const widthPx = 420;
      const heightPx = 148;
      const pos = centerPosition(widthPx, heightPx, draftLayout);
      return {
        id: generateStableId('el-clock'),
        type: 'clock',
        name: 'Clock Widget',
        zIndex,
        visible: true,
        locked: false,
        groupId: null,
        transform: {
          xPct: pos.xPct,
          yPct: pos.yPct,
          widthPx,
          heightPx,
          minWidthPx: 200,
          minHeightPx: 92,
          aspectLocked: false,
        },
        style: {
          opacity: 1,
          borderWidthPx: 0,
          borderColor: 'transparent',
          borderStyle: 'none',
          shadow: 'none',
          cornerRadiusPx: 16,
        },
        props: { ...DEFAULT_CLOCK_PROPS },
      };
    }

    case 'search': {
      const widthPx = 620;
      const heightPx = 58;
      const pos = centerPosition(widthPx, heightPx, draftLayout);
      return {
        id: generateStableId('el-search'),
        type: 'search',
        name: 'Search Bar',
        zIndex,
        visible: true,
        locked: false,
        groupId: null,
        transform: {
          xPct: pos.xPct,
          yPct: pos.yPct,
          widthPx,
          heightPx,
          minWidthPx: 260,
          minHeightPx: 48,
          aspectLocked: false,
        },
        style: {
          opacity: 1,
          borderWidthPx: 1,
          borderColor: 'rgba(229, 234, 242, 0.16)',
          borderStyle: 'solid',
          shadow: 'soft',
          cornerRadiusPx: 9999,
        },
        props: { ...DEFAULT_SEARCH_PROPS, recentQueries: [] },
      };
    }

    case 'shortcuts': {
      const widthPx = 720;
      const heightPx = 220;
      const pos = centerPosition(widthPx, heightPx, draftLayout);
      return {
        id: generateStableId('el-shortcuts'),
        type: 'shortcuts',
        name: 'Shortcuts Grid',
        zIndex,
        visible: true,
        locked: false,
        groupId: null,
        transform: {
          xPct: pos.xPct,
          yPct: pos.yPct,
          widthPx,
          heightPx,
          minWidthPx: 240,
          minHeightPx: 112,
          aspectLocked: false,
        },
        style: {
          opacity: 1,
          borderWidthPx: 0,
          borderColor: 'transparent',
          borderStyle: 'none',
          shadow: 'none',
          cornerRadiusPx: 20,
        },
        props: {
          ...DEFAULT_SHORTCUTS_PROPS,
          items: DEFAULT_SHORTCUT_ITEMS.slice(0, 4).map((item) => ({ ...item })),
        },
      };
    }
  }
}
