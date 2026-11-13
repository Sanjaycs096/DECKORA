export type SchemaVersion = 5;

export type SearchEngineId = 'google' | 'bing' | 'duckduckgo' | 'custom';

export interface ClockElementProps {
  format: '12h' | '24h';
  showSeconds: boolean;
  showDate: boolean;
  showWeekday: boolean;
  weekdayFormat: 'short' | 'long';
  timeZone: string;
  fontFamily: string;
  fontSizePx: number;
  fontWeight: 300 | 400 | 500 | 600 | 700;
  letterSpacingEm: number;
  color: string;
  alignment: 'left' | 'center' | 'right';
  containerStyle: 'floating' | 'crystal';
}

export interface SearchElementProps {
  engine: SearchEngineId;
  customEngineTemplate: string;
  placeholder: string;
  showEngineSelector: boolean;
  showSearchIcon: boolean;
  showClearButton: boolean;
  visualStyle: 'glass' | 'solid';
  focusShortcut: '/' | 'ctrl+k' | 'both' | 'none';
  enableLocalHistory: boolean;
  recentQueries: string[];
}

export interface ShortcutItem {
  id: string;
  title: string;
  url: string;
  iconSource: 'favicon' | 'material-symbol' | 'monogram';
  materialSymbolName: string | null;
  monogramColor: string;
}

export interface ShortcutsElementProps {
  items: ShortcutItem[];
  showLabels: boolean;
  openInNewTab: boolean;
  iconShape: 'squircle' | 'circle' | 'square';
  density: 'comfortable' | 'compact';
  columns: 'auto' | 3 | 4 | 5 | 6;
  orientation: 'horizontal' | 'vertical';
}

export type SpeedAutoIntervalMinutes = 0 | 15 | 30 | 60;

export interface SpeedElementProps {
  title: string;
  autoMeasureIntervalMinutes: SpeedAutoIntervalMinutes;
  showDownload: boolean;
  showUpload: boolean;
  showPing: boolean;
  showLastTested: boolean;
  showManualButton: boolean;
  precision: 1 | 2;
  layoutMode: 'standard' | 'compact';
  downloadProbeBytes: 1_048_576 | 2_097_152 | 5_242_880;
  uploadProbeBytes: 524_288 | 1_048_576;
}

export type ProfilePresetType = 'personal' | 'work' | 'study' | 'minimal' | 'creative' | 'custom';

export type AppearanceMode = 'dark' | 'light' | 'system';

export type WallpaperSourceType = 'none' | 'solid' | 'gradient' | 'image';

export interface WallpaperConfig {
  type: WallpaperSourceType;
  solidColor: string;
  gradientCss: string;
  assetId: string | null;
  fit: 'cover' | 'contain' | 'fill';
  position: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'custom';
  focalXPct: number;
  focalYPct: number;
  blurPx: number;
  dimPct: number;
  overlayColor: string;
  overlayOpacity: number;
  vignettePct: number;
}

export interface ExtractedWallpaperPalette {
  dominant: string;
  accent: string;
  secondaryAccent?: string;
  bgCanvas?: string;
  surfaceTint?: string;
  borderHighlight?: string;
  contrastRatio?: number;
  sourceSignature?: string;
  extractedAt?: string;
  averageLuminance: number;
  recommendedAppearance: 'dark' | 'light';
}

export interface GlassConfig {
  opacity: number;
  blurPx: number;
  saturationPct: number;
  borderOpacity: number;
  innerHighlight: boolean;
  shadowIntensity: 'none' | 'subtle' | 'medium';
  radiusPx: number;
}

export interface ThemeConfig {
  appearance: AppearanceMode;
  accentColor: string;
  secondaryAccentColor: string;
  useWallpaperAdaptivePalette: boolean;
  extractedPalette: ExtractedWallpaperPalette | null;
  glass: GlassConfig;
  wallpaper: WallpaperConfig;
}

export interface CuratedBookmark {
  id: string;
  title: string;
  url: string;
}

export interface NavigationConfig {
  visible: boolean;
  style: 'floating-pills' | 'crystal-bar' | 'auto-hide';
  showBookmarks: boolean;
  syncChromeBookmarks: boolean;
  showGmail: boolean;
  showImages: boolean;
  showAppsGrid: boolean;
  showProfileShortcut: boolean;
  profileDisplayName: string;
  profileAvatarAssetId: string | null;
  curatedBookmarks: CuratedBookmark[];
}

export interface ElementGroup {
  id: string;
  name: string;
  locked: boolean;
  hidden: boolean;
  childIds: string[];
}

export interface ElementTransform {
  xPct: number;
  yPct: number;
  widthPx: number;
  heightPx: number;
  minWidthPx: number;
  minHeightPx: number;
  aspectLocked: boolean;
}

export interface ElementStyleBase {
  opacity: number;
  borderWidthPx: number;
  borderColor: string;
  borderStyle: 'solid' | 'dashed' | 'none';
  shadow: 'none' | 'soft' | 'elevated' | 'glow';
  cornerRadiusPx: number;
}

export type ImageShapeType =
  | 'square'
  | 'rectangle'
  | 'rounded-rect'
  | 'circle'
  | 'oval'
  | 'diamond'
  | 'star'
  | 'custom-rounded';

export interface ImageElementProps {
  assetId: string;
  altText: string;
  shape: ImageShapeType;
  fit: 'cover' | 'contain';
  starPoints: number;
  customCornerRadiiPx: [number, number, number, number];
  crop: {
    zoom: number;
    panXPct: number;
    panYPct: number;
  };
}

export interface GifElementProps {
  assetId: string;
  altText: string;
  fit: 'cover' | 'contain';
  paused: boolean;
  showControlsOnHover: boolean;
}

export interface TextElementProps {
  content: string;
  fontFamily: string;
  uploadedFontAssetId: string | null;
  fontSizePx: number;
  fontWeight: 300 | 400 | 500 | 600 | 700;
  italic: boolean;
  underline: boolean;
  color: string;
  opacity: number;
  alignment: 'left' | 'center' | 'right';
  letterSpacingEm: number;
  lineHeight: number;
  textShadow: 'none' | 'subtle' | 'crisp';
  backgroundStyle: 'none' | 'crystal' | 'solid';
  backgroundColor: string;
  backgroundOpacity: number;
  paddingPx: number;
}

export type ElementType = 'clock' | 'search' | 'shortcuts' | 'image' | 'gif' | 'text' | 'speed';

export interface BaseCanvasElement {
  id: string;
  type: ElementType;
  name: string;
  transform: ElementTransform;
  style: ElementStyleBase;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  groupId: string | null;
}

export interface GenericCanvasElement extends BaseCanvasElement {
  props: Record<string, unknown>;
}

export interface CanvasLayout {
  referenceViewport: {
    width: number;
    height: number;
  };
  grid: {
    enabled: boolean;
    sizePx: 8 | 12 | 16 | 24;
    snapToGrid: boolean;
    snapToGuides: boolean;
  };
  groups: Record<string, ElementGroup>;
  elements: Record<string, GenericCanvasElement>;
  zOrder: string[];
}

export interface WorkspaceProfile {
  id: string;
  name: string;
  presetType: ProfilePresetType;
  description?: string;
  createdAt: string;
  updatedAt: string;
  theme: ThemeConfig;
  navigation: NavigationConfig;
  layout: CanvasLayout;
}

export interface CustomFontRecord {
  assetId: string;
  familyName: string;
  format: 'woff2' | 'woff' | 'ttf' | 'otf';
  byteSize: number;
  addedAt: string;
}

export interface GlobalPreferences {
  animationsEnabled: boolean;
  entranceStaggerMs: number;
  respectReducedMotion: boolean;
  defaultFontFamily: string;
  developerModeDiagnostics: boolean;
  customFonts: CustomFontRecord[];
}

export type AssetKind = 'wallpaper' | 'image' | 'gif' | 'font' | 'shortcut-icon';

export interface AssetMetadata {
  id: string;
  kind: AssetKind;
  name: string;
  mimeType: string;
  byteSize: number;
  width?: number;
  height?: number;
  createdAt: string;
  updatedAt: string;
  sha256?: string;
}

export type SpeedTestStatus =
  'idle' | 'testing' | 'completed' | 'failed' | 'offline' | 'permission-required';

export type SpeedTestPhase = 'idle' | 'ping' | 'download' | 'upload' | 'complete';

export interface SpeedMeasurement {
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  jitterMs: number;
  measuredAt: string;
  source: 'manual' | 'alarm';
  downloadBytes: number;
  uploadBytes: number;
}

export interface SpeedCacheState {
  status: SpeedTestStatus;
  phase: SpeedTestPhase;
  isRunning: boolean;
  runningStartedAt: string | null;
  lastAttemptAt: string | null;
  lastSuccessfulResult: SpeedMeasurement | null;
  errorMessage: string | null;
}

export interface PersistedWorkspaceState {
  schemaVersion: SchemaVersion;
  revision: number;
  updatedAt: string;
  activeProfileId: string;
  profiles: Record<string, WorkspaceProfile>;
  globalSettings: GlobalPreferences;
  assetRegistry: Record<string, AssetMetadata>;
  speedCache: SpeedCacheState | null;
}

export interface EditorSessionState {
  isEditing: boolean;
  profileId: string | null;
  draftLayout: CanvasLayout | null;
  draftTheme: ThemeConfig | null;
  selectedElementIds: string[];
  pendingUploadedAssetIds: string[];
  isDirty: boolean;
}
