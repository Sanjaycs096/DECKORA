import { DECKORA_SEED_PALETTE } from '@/design-system/tokens';
import type {
  CanvasLayout,
  ClockElementProps,
  GenericCanvasElement,
  GifElementProps,
  GlobalPreferences,
  ImageElementProps,
  PersistedWorkspaceState,
  SearchElementProps,
  ShortcutItem,
  ShortcutsElementProps,
  SpeedElementProps,
  TextElementProps,
  ThemeConfig,
  WallpaperConfig,
  WorkspaceProfile,
} from '@/types/workspace';
import { CURRENT_SCHEMA_VERSION } from './schemas';

export const DEFAULT_PROFILE_ID = 'profile-personal';
export const DEFAULT_CLOCK_ELEMENT_ID = 'el-clock-default';
export const DEFAULT_SEARCH_ELEMENT_ID = 'el-search-default';
export const DEFAULT_SHORTCUTS_ELEMENT_ID = 'el-shortcuts-default';
export const DEFAULT_SPEED_ELEMENT_ID = 'el-speed-default';

export const DEFAULT_CLOCK_PROPS: ClockElementProps = {
  format: '24h',
  showSeconds: true,
  showDate: true,
  showWeekday: true,
  weekdayFormat: 'long',
  timeZone: 'local',
  fontFamily: 'Manrope Variable',
  fontSizePx: 76,
  fontWeight: 600,
  letterSpacingEm: -0.02,
  color: 'auto',
  alignment: 'center',
  containerStyle: 'floating',
};

export const DEFAULT_SEARCH_PROPS: SearchElementProps = {
  engine: 'google',
  customEngineTemplate: '',
  placeholder: 'Search Google or type a query...',
  showEngineSelector: true,
  showSearchIcon: true,
  showClearButton: true,
  visualStyle: 'glass',
  focusShortcut: 'both',
  enableLocalHistory: false,
  recentQueries: [],
};

export const DEFAULT_SPEED_PROPS: SpeedElementProps = {
  title: 'Internet Speed',
  autoMeasureIntervalMinutes: 0,
  showDownload: true,
  showUpload: true,
  showPing: true,
  showLastTested: true,
  showManualButton: true,
  precision: 1,
  layoutMode: 'standard',
  downloadProbeBytes: 2_097_152,
  uploadProbeBytes: 524_288,
};

export const DEFAULT_IMAGE_PROPS: Omit<ImageElementProps, 'assetId'> = {
  altText: 'Uploaded image',
  shape: 'rounded-rect',
  fit: 'cover',
  starPoints: 5,
  customCornerRadiiPx: [24, 8, 24, 8],
  crop: {
    zoom: 1,
    panXPct: 50,
    panYPct: 50,
  },
};

export const DEFAULT_GIF_PROPS: Omit<GifElementProps, 'assetId'> = {
  altText: 'Animated GIF',
  fit: 'cover',
  paused: false,
  showControlsOnHover: true,
};

export const DEFAULT_TEXT_PROPS: TextElementProps = {
  content: 'Your Space. Your Focus.',
  fontFamily: 'Manrope Variable',
  uploadedFontAssetId: null,
  fontSizePx: 32,
  fontWeight: 600,
  italic: false,
  underline: false,
  color: '#E5EAF2',
  opacity: 1,
  alignment: 'center',
  letterSpacingEm: 0,
  lineHeight: 1.25,
  textShadow: 'subtle',
  backgroundStyle: 'none',
  backgroundColor: '#19283C',
  backgroundOpacity: 0.55,
  paddingPx: 16,
};

export interface WallpaperGradientPreset {
  id: string;
  label: string;
  gradientCss: string;
  recommendedAppearance: 'dark' | 'light';
}

export const WALLPAPER_GRADIENT_PRESETS: WallpaperGradientPreset[] = [
  {
    id: 'royal-crystal',
    label: 'Royal Crystal',
    gradientCss:
      'radial-gradient(ellipse 80% 60% at 18% 12%, rgba(30, 42, 68, 0.92) 0%, transparent 65%), radial-gradient(ellipse 65% 55% at 85% 22%, rgba(139, 124, 246, 0.18) 0%, transparent 62%), linear-gradient(180deg, #0B1220 0%, #152138 55%, #0B1220 100%)',
    recommendedAppearance: 'dark',
  },
  {
    id: 'arctic-aurora',
    label: 'Arctic Horizon',
    gradientCss:
      'radial-gradient(circle at 15% 20%, #7FD3F7 0%, transparent 45%), radial-gradient(circle at 82% 75%, #8B7CF6 0%, transparent 50%), linear-gradient(135deg, #0B1220 0%, #1E2A44 100%)',
    recommendedAppearance: 'dark',
  },
  {
    id: 'midnight-violet',
    label: 'Midnight Violet',
    gradientCss:
      'radial-gradient(circle at 72% 18%, rgba(167, 139, 250, 0.35) 0%, transparent 52%), linear-gradient(160deg, #0F172A 0%, #1E1B4B 55%, #111827 100%)',
    recommendedAppearance: 'dark',
  },
  {
    id: 'deep-emerald',
    label: 'Obsidian Emerald',
    gradientCss:
      'radial-gradient(circle at 25% 80%, rgba(16, 185, 129, 0.25) 0%, transparent 55%), linear-gradient(145deg, #090D16 0%, #0F292E 60%, #101827 100%)',
    recommendedAppearance: 'dark',
  },
  {
    id: 'pearl-mist',
    label: 'Pearl Crystal',
    gradientCss:
      'radial-gradient(ellipse 80% 60% at 16% 12%, rgba(117, 207, 255, 0.28) 0%, transparent 62%), radial-gradient(ellipse 65% 55% at 84% 20%, rgba(167, 139, 250, 0.16) 0%, transparent 60%), linear-gradient(180deg, #F3F7FC 0%, #E8F0FA 55%, #EEF3F9 100%)',
    recommendedAppearance: 'light',
  },
  {
    id: 'warm-horizon',
    label: 'Dusk Horizon',
    gradientCss:
      'radial-gradient(circle at 80% 18%, rgba(251, 146, 60, 0.24) 0%, transparent 48%), radial-gradient(circle at 18% 75%, rgba(99, 102, 241, 0.26) 0%, transparent 55%), linear-gradient(135deg, #1E1B4B 0%, #312E81 48%, #172554 100%)',
    recommendedAppearance: 'dark',
  },
];

export interface TextFontOption {
  label: string;
  value: string;
  category: 'bundled' | 'system';
}

export const CURATED_TEXT_FONTS: TextFontOption[] = [
  { label: 'Inter Variable (Sans)', value: 'Inter Variable', category: 'bundled' },
  { label: 'Manrope Variable (Display)', value: 'Manrope Variable', category: 'bundled' },
  {
    label: 'Geometric System Sans',
    value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    category: 'system',
  },
  {
    label: 'Editorial Serif',
    value: 'Georgia, "Times New Roman", Cambria, serif',
    category: 'system',
  },
  {
    label: 'Developer Monospace',
    value: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
    category: 'system',
  },
];

export function createDefaultWallpaperConfig(): WallpaperConfig {
  return {
    type: 'gradient',
    solidColor: DECKORA_SEED_PALETTE.midnightNavy,
    gradientCss: WALLPAPER_GRADIENT_PRESETS[0]!.gradientCss,
    assetId: null,
    fit: 'cover',
    position: 'center',
    focalXPct: 50,
    focalYPct: 50,
    blurPx: 0,
    dimPct: 0,
    overlayColor: DECKORA_SEED_PALETTE.midnightNavy,
    overlayOpacity: 0,
    vignettePct: 0,
  };
}

export const DEFAULT_SHORTCUT_ITEMS: ShortcutItem[] = [
  {
    id: 'sc-youtube',
    title: 'YouTube',
    url: 'https://www.youtube.com/',
    iconSource: 'favicon',
    materialSymbolName: 'smart_display',
    monogramColor: '#EF4444',
  },
  {
    id: 'sc-github',
    title: 'GitHub',
    url: 'https://github.com/',
    iconSource: 'favicon',
    materialSymbolName: 'code',
    monogramColor: '#75CFFF',
  },
  {
    id: 'sc-gmail',
    title: 'Gmail',
    url: 'https://mail.google.com/',
    iconSource: 'favicon',
    materialSymbolName: 'mail',
    monogramColor: '#F87171',
  },
  {
    id: 'sc-drive',
    title: 'Google Drive',
    url: 'https://drive.google.com/',
    iconSource: 'favicon',
    materialSymbolName: 'cloud',
    monogramColor: '#34D399',
  },
  {
    id: 'sc-chatgpt',
    title: 'ChatGPT',
    url: 'https://chatgpt.com/',
    iconSource: 'favicon',
    materialSymbolName: 'auto_awesome',
    monogramColor: '#A78BFA',
  },
  {
    id: 'sc-linkedin',
    title: 'LinkedIn',
    url: 'https://www.linkedin.com/',
    iconSource: 'favicon',
    materialSymbolName: 'work',
    monogramColor: '#38BDF8',
  },
  {
    id: 'sc-stackoverflow',
    title: 'Stack Overflow',
    url: 'https://stackoverflow.com/',
    iconSource: 'favicon',
    materialSymbolName: 'forum',
    monogramColor: '#FBBF24',
  },
  {
    id: 'sc-calendar',
    title: 'Google Calendar',
    url: 'https://calendar.google.com/',
    iconSource: 'favicon',
    materialSymbolName: 'calendar_today',
    monogramColor: '#60A5FA',
  },
];

export const DEFAULT_SHORTCUTS_PROPS: ShortcutsElementProps = {
  items: DEFAULT_SHORTCUT_ITEMS,
  showLabels: true,
  openInNewTab: false,
  iconShape: 'squircle',
  density: 'comfortable',
  columns: 'auto',
  orientation: 'horizontal',
};

export function createDefaultCanvasElements(): Record<string, GenericCanvasElement> {
  return {
    [DEFAULT_CLOCK_ELEMENT_ID]: {
      id: DEFAULT_CLOCK_ELEMENT_ID,
      type: 'clock',
      name: 'Main Clock',
      zIndex: 0,
      visible: true,
      locked: false,
      groupId: null,
      transform: {
        xPct: 35.417,
        yPct: 14,
        widthPx: 420,
        heightPx: 148,
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
    },
    [DEFAULT_SEARCH_ELEMENT_ID]: {
      id: DEFAULT_SEARCH_ELEMENT_ID,
      type: 'search',
      name: 'Search Bar',
      zIndex: 1,
      visible: true,
      locked: false,
      groupId: null,
      transform: {
        xPct: 26.389,
        yPct: 36,
        widthPx: 680,
        heightPx: 58,
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
    },
    [DEFAULT_SHORTCUTS_ELEMENT_ID]: {
      id: DEFAULT_SHORTCUTS_ELEMENT_ID,
      type: 'shortcuts',
      name: 'Quick Shortcuts',
      zIndex: 2,
      visible: true,
      locked: false,
      groupId: null,
      transform: {
        xPct: 23.611,
        yPct: 48,
        widthPx: 760,
        heightPx: 224,
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
        items: DEFAULT_SHORTCUT_ITEMS.map((item) => ({ ...item })),
      },
    },
    [DEFAULT_SPEED_ELEMENT_ID]: {
      id: DEFAULT_SPEED_ELEMENT_ID,
      type: 'speed',
      name: 'Speed Monitor',
      zIndex: 3,
      visible: true,
      locked: false,
      groupId: null,
      transform: {
        xPct: 2.5,
        yPct: 73,
        widthPx: 300,
        heightPx: 184,
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
    },
  };
}

export function createDefaultCanvasLayout(): CanvasLayout {
  return {
    referenceViewport: { width: 1440, height: 900 },
    grid: {
      enabled: false,
      sizePx: 12,
      snapToGrid: true,
      snapToGuides: true,
    },
    groups: {},
    elements: createDefaultCanvasElements(),
    zOrder: [
      DEFAULT_CLOCK_ELEMENT_ID,
      DEFAULT_SEARCH_ELEMENT_ID,
      DEFAULT_SHORTCUTS_ELEMENT_ID,
      DEFAULT_SPEED_ELEMENT_ID,
    ],
  };
}

export function createDefaultThemeConfig(): ThemeConfig {
  return {
    appearance: 'dark',
    accentColor: DECKORA_SEED_PALETTE.iceBlue,
    secondaryAccentColor: DECKORA_SEED_PALETTE.royalViolet,
    useWallpaperAdaptivePalette: true,
    extractedPalette: null,
    glass: {
      opacity: 0.58,
      blurPx: 18,
      saturationPct: 145,
      borderOpacity: 0.16,
      innerHighlight: true,
      shadowIntensity: 'subtle',
      radiusPx: 20,
    },
    wallpaper: createDefaultWallpaperConfig(),
  };
}

export function createDefaultGlobalPreferences(): GlobalPreferences {
  return {
    animationsEnabled: true,
    entranceStaggerMs: 20,
    respectReducedMotion: true,
    defaultFontFamily: 'Inter Variable',
    developerModeDiagnostics: false,
    customFonts: [],
  };
}

export function createDefaultProfile(nowIso = new Date().toISOString()): WorkspaceProfile {
  return {
    id: DEFAULT_PROFILE_ID,
    name: 'Personal',
    presetType: 'personal',
    createdAt: nowIso,
    updatedAt: nowIso,
    theme: createDefaultThemeConfig(),
    navigation: {
      visible: true,
      style: 'crystal-bar',
      showBookmarks: true,
      syncChromeBookmarks: false,
      showGmail: true,
      showImages: true,
      showAppsGrid: true,
      showProfileShortcut: true,
      profileDisplayName: 'Workspace User',
      profileAvatarAssetId: null,
      curatedBookmarks: [
        { id: 'bm-github', title: 'GitHub', url: 'https://github.com' },
        {
          id: 'bm-chrome-docs',
          title: 'Chrome Extensions',
          url: 'https://developer.chrome.com/docs/extensions',
        },
      ],
    },
    layout: createDefaultCanvasLayout(),
  };
}

export function createDefaultWorkspaceState(
  nowIso = new Date().toISOString(),
): PersistedWorkspaceState {
  const defaultProfile = createDefaultProfile(nowIso);
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: 1,
    updatedAt: nowIso,
    activeProfileId: defaultProfile.id,
    profiles: {
      [defaultProfile.id]: defaultProfile,
    },
    globalSettings: createDefaultGlobalPreferences(),
    assetRegistry: {},
    speedCache: null,
  };
}
