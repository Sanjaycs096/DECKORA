import { generateStableId, pruneAndNormalizeGroups } from '@/features/editor/layoutOps';
import {
  createDefaultCanvasLayout,
  createDefaultProfile,
  createDefaultThemeConfig,
  createDefaultWallpaperConfig,
  WALLPAPER_GRADIENT_PRESETS,
} from '@/services/storage/defaults';
import type {
  CanvasLayout,
  ElementGroup,
  GenericCanvasElement,
  ProfilePresetType,
  ShortcutItem,
  WorkspaceProfile,
} from '@/types/workspace';

export interface ProfilePresetMetadata {
  presetType: ProfilePresetType;
  label: string;
  description: string;
  icon: string;
  accentColor: string;
  secondaryAccentColor: string;
}

export const PROFILE_PRESET_LIST: readonly ProfilePresetMetadata[] = [
  {
    presetType: 'personal',
    label: 'Personal',
    description: 'Balanced daily New Tab with clock, search, shortcuts & speed monitor',
    icon: 'person',
    accentColor: '#7FD3F7',
    secondaryAccentColor: '#8B7CF6',
  },
  {
    presetType: 'work',
    label: 'Work',
    description: 'High-clarity slate studio tuned for engineering & productivity links',
    icon: 'work',
    accentColor: '#38BDF8',
    secondaryAccentColor: '#60A5FA',
  },
  {
    presetType: 'study',
    label: 'Study',
    description: 'Calm emerald workspace built for distraction-free reading & research',
    icon: 'school',
    accentColor: '#34D399',
    secondaryAccentColor: '#7FD3F7',
  },
  {
    presetType: 'minimal',
    label: 'Minimal',
    description: 'Ultra-clean monochrome canvas with centered time and quick search',
    icon: 'crop_square',
    accentColor: '#7FD3F7',
    secondaryAccentColor: '#94A3B8',
  },
  {
    presetType: 'creative',
    label: 'Creative',
    description: 'Expressive violet gradient canvas with typography banner and studio grid',
    icon: 'palette',
    accentColor: '#A78BFA',
    secondaryAccentColor: '#F472B6',
  },
  {
    presetType: 'custom',
    label: 'Custom',
    description: 'Fresh Royal Crystal blank-friendly starter workspace ready to sculpt',
    icon: 'tune',
    accentColor: '#7FD3F7',
    secondaryAccentColor: '#8B7CF6',
  },
] as const;

export function getProfilePresetMeta(presetType: ProfilePresetType): ProfilePresetMetadata {
  return (
    PROFILE_PRESET_LIST.find((item) => item.presetType === presetType) ?? PROFILE_PRESET_LIST[0]!
  );
}

const WORK_SHORTCUTS: ShortcutItem[] = [
  {
    id: 'sc-work-github',
    title: 'GitHub',
    url: 'https://github.com/',
    iconSource: 'favicon',
    materialSymbolName: 'code',
    monogramColor: '#38BDF8',
  },
  {
    id: 'sc-work-gmail',
    title: 'Gmail',
    url: 'https://mail.google.com/',
    iconSource: 'favicon',
    materialSymbolName: 'mail',
    monogramColor: '#F87171',
  },
  {
    id: 'sc-work-calendar',
    title: 'Calendar',
    url: 'https://calendar.google.com/',
    iconSource: 'favicon',
    materialSymbolName: 'calendar_today',
    monogramColor: '#60A5FA',
  },
  {
    id: 'sc-work-docs',
    title: 'Google Docs',
    url: 'https://docs.google.com/',
    iconSource: 'favicon',
    materialSymbolName: 'description',
    monogramColor: '#75CFFF',
  },
  {
    id: 'sc-work-linear',
    title: 'Linear',
    url: 'https://linear.app/',
    iconSource: 'favicon',
    materialSymbolName: 'view_kanban',
    monogramColor: '#A78BFA',
  },
  {
    id: 'sc-work-figma',
    title: 'Figma',
    url: 'https://www.figma.com/',
    iconSource: 'favicon',
    materialSymbolName: 'design_services',
    monogramColor: '#F472B6',
  },
];

const STUDY_SHORTCUTS: ShortcutItem[] = [
  {
    id: 'sc-study-scholar',
    title: 'Google Scholar',
    url: 'https://scholar.google.com/',
    iconSource: 'favicon',
    materialSymbolName: 'school',
    monogramColor: '#34D399',
  },
  {
    id: 'sc-study-mdn',
    title: 'MDN Docs',
    url: 'https://developer.mozilla.org/',
    iconSource: 'favicon',
    materialSymbolName: 'menu_book',
    monogramColor: '#75CFFF',
  },
  {
    id: 'sc-study-wiki',
    title: 'Wikipedia',
    url: 'https://www.wikipedia.org/',
    iconSource: 'favicon',
    materialSymbolName: 'public',
    monogramColor: '#94A3B8',
  },
  {
    id: 'sc-study-arxiv',
    title: 'arXiv',
    url: 'https://arxiv.org/',
    iconSource: 'favicon',
    materialSymbolName: 'science',
    monogramColor: '#FBBF24',
  },
];

export function createProfileFromPreset(
  presetType: ProfilePresetType,
  options?: {
    id?: string;
    name?: string;
    nowIso?: string;
  },
): WorkspaceProfile {
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const meta = getProfilePresetMeta(presetType);
  const baseProfile = createDefaultProfile(nowIso);
  const profileId = options?.id ?? generateStableId(`profile-${presetType}`);
  const profileName = options?.name?.trim() || meta.label;

  const baseTheme = createDefaultThemeConfig();
  baseTheme.accentColor = meta.accentColor;
  baseTheme.secondaryAccentColor = meta.secondaryAccentColor;

  if (presetType === 'personal') {
    return {
      ...baseProfile,
      id: profileId,
      name: profileName,
      presetType: 'personal',
      description: meta.description,
    };
  }

  if (presetType === 'work') {
    const layout = createDefaultCanvasLayout();
    const shortcutsEl = layout.elements['el-shortcuts-default'];
    if (shortcutsEl) {
      shortcutsEl.props = {
        ...shortcutsEl.props,
        items: WORK_SHORTCUTS.map((s) => ({ ...s })),
        columns: 3,
      };
    }
    const clockEl = layout.elements['el-clock-default'];
    if (clockEl) {
      clockEl.props = {
        ...clockEl.props,
        containerStyle: 'crystal',
        showSeconds: false,
      };
    }

    return {
      ...baseProfile,
      id: profileId,
      name: profileName,
      presetType: 'work',
      description: meta.description,
      theme: {
        ...baseTheme,
        wallpaper: {
          ...createDefaultWallpaperConfig(),
          gradientCss: WALLPAPER_GRADIENT_PRESETS[1]!.gradientCss,
        },
      },
      navigation: {
        ...baseProfile.navigation,
        curatedBookmarks: [
          { id: 'bm-work-gh', title: 'GitHub', url: 'https://github.com' },
          { id: 'bm-work-mdn', title: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
        ],
      },
      layout,
    };
  }

  if (presetType === 'study') {
    const layout = createDefaultCanvasLayout();
    const clockEl = layout.elements['el-clock-default'];
    if (clockEl) {
      clockEl.transform = { ...clockEl.transform, yPct: 16 };
    }
    const shortcutsEl = layout.elements['el-shortcuts-default'];
    if (shortcutsEl) {
      shortcutsEl.props = {
        ...shortcutsEl.props,
        items: STUDY_SHORTCUTS.map((s) => ({ ...s })),
        columns: 4,
      };
    }
    // Remove speed monitor for focused study layout and add a gentle focus quote text element
    delete layout.elements['el-speed-default'];
    layout.zOrder = layout.zOrder.filter((id) => id !== 'el-speed-default');
    const textId = 'el-study-banner';
    layout.elements[textId] = {
      id: textId,
      type: 'text',
      name: 'Study Mantra',
      zIndex: layout.zOrder.length,
      visible: true,
      locked: false,
      groupId: null,
      transform: {
        xPct: 33.33,
        yPct: 76,
        widthPx: 480,
        heightPx: 72,
        minWidthPx: 180,
        minHeightPx: 48,
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
      props: {
        content: 'Deep Focus • One chapter at a time',
        fontFamily: 'Manrope Variable',
        uploadedFontAssetId: null,
        fontSizePx: 20,
        fontWeight: 500,
        italic: false,
        underline: false,
        color: '#E5EAF2',
        opacity: 0.9,
        alignment: 'center',
        letterSpacingEm: 0.02,
        lineHeight: 1.3,
        textShadow: 'subtle',
        backgroundStyle: 'crystal',
        backgroundColor: '#0F292E',
        backgroundOpacity: 0.48,
        paddingPx: 14,
      },
    };
    layout.zOrder.push(textId);

    return {
      ...baseProfile,
      id: profileId,
      name: profileName,
      presetType: 'study',
      description: meta.description,
      theme: {
        ...baseTheme,
        wallpaper: {
          ...createDefaultWallpaperConfig(),
          gradientCss: WALLPAPER_GRADIENT_PRESETS[3]!.gradientCss,
        },
      },
      layout,
    };
  }

  if (presetType === 'minimal') {
    const layout = createDefaultCanvasLayout();
    delete layout.elements['el-speed-default'];
    delete layout.elements['el-shortcuts-default'];
    layout.zOrder = ['el-clock-default', 'el-search-default'];
    if (layout.elements['el-clock-default']) {
      layout.elements['el-clock-default'].transform = {
        ...layout.elements['el-clock-default'].transform,
        yPct: 26,
      };
      layout.elements['el-clock-default'].props = {
        ...layout.elements['el-clock-default'].props,
        showSeconds: false,
      };
    }
    if (layout.elements['el-search-default']) {
      layout.elements['el-search-default'].transform = {
        ...layout.elements['el-search-default'].transform,
        yPct: 48,
      };
    }

    return {
      ...baseProfile,
      id: profileId,
      name: profileName,
      presetType: 'minimal',
      description: meta.description,
      theme: {
        ...baseTheme,
        wallpaper: {
          ...createDefaultWallpaperConfig(),
          type: 'solid',
          solidColor: '#090D16',
        },
      },
      layout,
    };
  }

  if (presetType === 'creative') {
    const layout = createDefaultCanvasLayout();
    const bannerId = 'el-creative-title';
    layout.elements[bannerId] = {
      id: bannerId,
      type: 'text',
      name: 'Studio Heading',
      zIndex: layout.zOrder.length,
      visible: true,
      locked: false,
      groupId: null,
      transform: {
        xPct: 33.33,
        yPct: 7.5,
        widthPx: 480,
        heightPx: 54,
        minWidthPx: 180,
        minHeightPx: 40,
        aspectLocked: false,
      },
      style: {
        opacity: 1,
        borderWidthPx: 0,
        borderColor: 'transparent',
        borderStyle: 'none',
        shadow: 'none',
        cornerRadiusPx: 14,
      },
      props: {
        content: 'CREATIVE STUDIO',
        fontFamily: 'Manrope Variable',
        uploadedFontAssetId: null,
        fontSizePx: 16,
        fontWeight: 700,
        italic: false,
        underline: false,
        color: '#A78BFA',
        opacity: 0.95,
        alignment: 'center',
        letterSpacingEm: 0.24,
        lineHeight: 1.2,
        textShadow: 'subtle',
        backgroundStyle: 'none',
        backgroundColor: '#19283C',
        backgroundOpacity: 0.55,
        paddingPx: 10,
      },
    };
    layout.zOrder.push(bannerId);

    return {
      ...baseProfile,
      id: profileId,
      name: profileName,
      presetType: 'creative',
      description: meta.description,
      theme: {
        ...baseTheme,
        wallpaper: {
          ...createDefaultWallpaperConfig(),
          gradientCss: WALLPAPER_GRADIENT_PRESETS[2]!.gradientCss,
        },
      },
      layout,
    };
  }

  // 'custom' preset
  return {
    ...baseProfile,
    id: profileId,
    name: profileName,
    presetType: 'custom',
    description: meta.description,
  };
}

/**
 * Deep-clones a WorkspaceProfile and assigns collision-free element & group IDs
 * while intentionally preserving referenced asset IDs for shared deduplicated storage.
 */
export function cloneProfileWithFreshIds(
  source: WorkspaceProfile,
  options: {
    newId?: string;
    newName: string;
    nowIso?: string;
  },
): WorkspaceProfile {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const clonedTheme = structuredClone(source.theme);
  const clonedNav = structuredClone(source.navigation);

  const elementIdMap = new Map<string, string>();
  for (const oldId of Object.keys(source.layout.elements)) {
    elementIdMap.set(oldId, generateStableId('el'));
  }

  const groupIdMap = new Map<string, string>();
  for (const oldGroupId of Object.keys(source.layout.groups)) {
    groupIdMap.set(oldGroupId, generateStableId('grp'));
  }

  const nextElements: Record<string, GenericCanvasElement> = {};
  for (const [oldId, element] of Object.entries(source.layout.elements)) {
    const freshId = elementIdMap.get(oldId) ?? generateStableId('el');
    const copy = structuredClone(element);
    copy.id = freshId;
    copy.groupId = copy.groupId ? (groupIdMap.get(copy.groupId) ?? null) : null;
    nextElements[freshId] = copy;
  }

  const nextGroups: Record<string, ElementGroup> = {};
  for (const [oldGroupId, group] of Object.entries(source.layout.groups)) {
    const freshGroupId = groupIdMap.get(oldGroupId) ?? generateStableId('grp');
    nextGroups[freshGroupId] = {
      ...structuredClone(group),
      id: freshGroupId,
      childIds: group.childIds
        .map((cid) => elementIdMap.get(cid))
        .filter((cid): cid is string => Boolean(cid)),
    };
  }

  const nextZOrder = source.layout.zOrder
    .map((oldId) => elementIdMap.get(oldId))
    .filter((id): id is string => Boolean(id));

  const nextLayout: CanvasLayout = pruneAndNormalizeGroups({
    referenceViewport: { ...source.layout.referenceViewport },
    grid: { ...source.layout.grid },
    groups: nextGroups,
    elements: nextElements,
    zOrder: nextZOrder,
  });

  return {
    id: options.newId ?? generateStableId(`profile-${source.presetType}`),
    name: options.newName.trim().slice(0, 60) || `${source.name} Copy`,
    presetType: source.presetType,
    description: source.description,
    createdAt: nowIso,
    updatedAt: nowIso,
    theme: clonedTheme,
    navigation: clonedNav,
    layout: nextLayout,
  };
}
