import { z } from 'zod';
import type {
  ClockElementProps,
  GifElementProps,
  ImageElementProps,
  PersistedWorkspaceState,
  SearchElementProps,
  ShortcutsElementProps,
  SpeedCacheState,
  SpeedElementProps,
  TextElementProps,
  WallpaperConfig,
  WorkspaceProfile,
} from '@/types/workspace';
import { sanitizeHttpUrl } from '@/utils/url';
import { createDefaultCanvasLayout } from './defaults';

export const CURRENT_SCHEMA_VERSION = 5 as const;

const hexColorSchema = z.string().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/, 'Invalid hex color');

const httpUrlSchema = z
  .string()
  .url()
  .refine((val) => sanitizeHttpUrl(val) !== null, 'Only http/https URLs are allowed');

const DANGEROUS_CSS_PATTERN = /[;{}<>\\\n\r]|url\s*\(|expression\s*\(/i;

function safeCssStringSchema(maxLength = 300) {
  return z
    .string()
    .min(1)
    .max(maxLength)
    .refine((val) => !DANGEROUS_CSS_PATTERN.test(val), 'Unsafe CSS value rejected');
}

const safeGradientCssSchema = z
  .string()
  .max(1200)
  .refine((val) => !DANGEROUS_CSS_PATTERN.test(val), 'Unsafe CSS gradient rejected');

const safeCustomTemplateSchema = z
  .string()
  .max(500)
  .refine((val) => {
    const trimmed = val.trim();
    if (!trimmed) return true;
    if (!trimmed.includes('{query}')) return false;
    return sanitizeHttpUrl(trimmed.replaceAll('{query}', 'test')) !== null;
  }, 'Custom search template must be an http/https URL containing {query}');

export const wallpaperConfigSchemaV2 = z.object({
  type: z.enum(['none', 'solid', 'gradient', 'image']),
  solidColor: safeCssStringSchema(64),
  gradientCss: safeGradientCssSchema,
  assetId: z.string().nullable(),
  fit: z.enum(['cover', 'contain', 'fill']),
  position: z.enum(['center', 'top', 'bottom', 'left', 'right']),
  blurPx: z.number().min(0).max(40),
  dimPct: z.number().min(0).max(80),
  overlayColor: safeCssStringSchema(64),
  overlayOpacity: z.number().min(0).max(0.75),
});

export const wallpaperConfigSchema = z.object({
  type: z.enum(['none', 'solid', 'gradient', 'image']),
  solidColor: safeCssStringSchema(64),
  gradientCss: safeGradientCssSchema,
  assetId: z.string().nullable(),
  fit: z.enum(['cover', 'contain', 'fill']),
  position: z.enum(['center', 'top', 'bottom', 'left', 'right', 'custom']),
  focalXPct: z.number().min(0).max(100),
  focalYPct: z.number().min(0).max(100),
  blurPx: z.number().min(0).max(40),
  dimPct: z.number().min(0).max(80),
  overlayColor: safeCssStringSchema(64),
  overlayOpacity: z.number().min(0).max(0.75),
  vignettePct: z.number().min(0).max(80),
});

export const extractedPaletteSchemaV4 = z.object({
  dominant: hexColorSchema,
  accent: hexColorSchema,
  averageLuminance: z.number().min(0).max(1),
  recommendedAppearance: z.enum(['dark', 'light']),
});

export const extractedPaletteSchema = z.object({
  dominant: hexColorSchema,
  accent: hexColorSchema,
  secondaryAccent: hexColorSchema.optional(),
  bgCanvas: hexColorSchema.optional(),
  surfaceTint: hexColorSchema.optional(),
  borderHighlight: hexColorSchema.optional(),
  contrastRatio: z.number().min(1).max(21).optional(),
  sourceSignature: z.string().max(200).optional(),
  extractedAt: z.string().optional(),
  averageLuminance: z.number().min(0).max(1),
  recommendedAppearance: z.enum(['dark', 'light']),
});

export const glassConfigSchema = z.object({
  opacity: z.number().min(0.15).max(0.95),
  blurPx: z.number().min(0).max(36),
  saturationPct: z.number().min(100).max(180),
  borderOpacity: z.number().min(0).max(0.5),
  innerHighlight: z.boolean(),
  shadowIntensity: z.enum(['none', 'subtle', 'medium']),
  radiusPx: z.number().min(0).max(32),
});

export const themeConfigSchemaV2 = z.object({
  appearance: z.enum(['dark', 'light', 'system']),
  accentColor: hexColorSchema,
  secondaryAccentColor: hexColorSchema,
  useWallpaperAdaptivePalette: z.boolean(),
  extractedPalette: extractedPaletteSchema.nullable(),
  glass: glassConfigSchema,
  wallpaper: wallpaperConfigSchemaV2,
});

export const themeConfigSchema = z.object({
  appearance: z.enum(['dark', 'light', 'system']),
  accentColor: hexColorSchema,
  secondaryAccentColor: hexColorSchema,
  useWallpaperAdaptivePalette: z.boolean(),
  extractedPalette: extractedPaletteSchema.nullable(),
  glass: glassConfigSchema,
  wallpaper: wallpaperConfigSchema,
});

export const navigationConfigSchema = z.object({
  visible: z.boolean(),
  style: z.enum(['floating-pills', 'crystal-bar', 'auto-hide']),
  showBookmarks: z.boolean(),
  syncChromeBookmarks: z.boolean(),
  showGmail: z.boolean(),
  showImages: z.boolean(),
  showAppsGrid: z.boolean(),
  showProfileShortcut: z.boolean(),
  profileDisplayName: z.string().max(64),
  profileAvatarAssetId: z.string().nullable(),
  curatedBookmarks: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1).max(80),
      url: httpUrlSchema,
    }),
  ),
});

export const elementTransformSchema = z.object({
  xPct: z.number().min(-50).max(150),
  yPct: z.number().min(-50).max(150),
  widthPx: z.number().min(20).max(4000),
  heightPx: z.number().min(20).max(4000),
  minWidthPx: z.number().min(20),
  minHeightPx: z.number().min(20),
  aspectLocked: z.boolean(),
});

export const elementStyleBaseSchema = z.object({
  opacity: z.number().min(0).max(1),
  borderWidthPx: z.number().min(0).max(12),
  borderColor: safeCssStringSchema(64),
  borderStyle: z.enum(['solid', 'dashed', 'none']),
  shadow: z.enum(['none', 'soft', 'elevated', 'glow']),
  cornerRadiusPx: z.number().min(0).max(9999),
});

export const genericCanvasElementSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['clock', 'search', 'shortcuts', 'image', 'gif', 'text', 'speed']),
  name: z.string().min(1).max(100),
  transform: elementTransformSchema,
  style: elementStyleBaseSchema,
  zIndex: z.number().int().min(0),
  visible: z.boolean(),
  locked: z.boolean(),
  groupId: z.string().nullable(),
  props: z.record(z.string(), z.unknown()),
});

export const elementGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  locked: z.boolean(),
  hidden: z.boolean(),
  childIds: z.array(z.string().min(1)),
});

export const canvasLayoutSchema = z.object({
  referenceViewport: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  grid: z.object({
    enabled: z.boolean(),
    sizePx: z.union([z.literal(8), z.literal(12), z.literal(16), z.literal(24)]),
    snapToGrid: z.boolean(),
    snapToGuides: z.boolean(),
  }),
  groups: z.record(z.string(), elementGroupSchema),
  elements: z.record(z.string(), genericCanvasElementSchema),
  zOrder: z.array(z.string()),
});

export const workspaceProfileSchemaV2 = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  presetType: z.enum(['personal', 'work', 'study', 'minimal', 'creative', 'custom']),
  createdAt: z.string(),
  updatedAt: z.string(),
  theme: themeConfigSchemaV2,
  navigation: navigationConfigSchema,
  layout: canvasLayoutSchema,
});

export const workspaceProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  presetType: z.enum(['personal', 'work', 'study', 'minimal', 'creative', 'custom']),
  description: z.string().max(160).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  theme: themeConfigSchema,
  navigation: navigationConfigSchema,
  layout: canvasLayoutSchema,
});

export const globalPreferencesSchema = z.object({
  animationsEnabled: z.boolean(),
  entranceStaggerMs: z.number().int().min(0).max(200),
  respectReducedMotion: z.boolean(),
  defaultFontFamily: z.string().min(1),
  developerModeDiagnostics: z.boolean(),
  customFonts: z.array(
    z.object({
      assetId: z.string().min(1),
      familyName: z.string().min(1),
      format: z.enum(['woff2', 'woff', 'ttf', 'otf']),
      byteSize: z.number().int().nonnegative(),
      addedAt: z.string(),
    }),
  ),
});

export const assetMetadataSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['wallpaper', 'image', 'gif', 'font', 'shortcut-icon']),
  name: z.string().min(1).max(180),
  mimeType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sha256: z.string().optional(),
});

export const legacySpeedReadingSchema = z.object({
  downloadMbps: z.number().nonnegative().nullable(),
  uploadMbps: z.number().nonnegative().nullable(),
  latencyMs: z.number().nonnegative().nullable(),
  measuredAt: z.string(),
  source: z.enum(['manual', 'alarm']),
  status: z.enum(['ok', 'offline', 'permission-required', 'error']),
  errorMessage: z.string().optional(),
});

export const speedMeasurementSchema = z.object({
  downloadMbps: z.number().nonnegative(),
  uploadMbps: z.number().nonnegative(),
  pingMs: z.number().nonnegative(),
  jitterMs: z.number().nonnegative().default(0),
  measuredAt: z.string(),
  source: z.enum(['manual', 'alarm']),
  downloadBytes: z.number().int().positive(),
  uploadBytes: z.number().int().positive(),
});

export const speedCacheStateSchema = z.object({
  status: z.enum(['idle', 'testing', 'completed', 'failed', 'offline', 'permission-required']),
  phase: z.enum(['idle', 'ping', 'download', 'upload', 'complete']).default('idle'),
  isRunning: z.boolean().default(false),
  runningStartedAt: z.string().nullable().default(null),
  lastAttemptAt: z.string().nullable().default(null),
  lastSuccessfulResult: speedMeasurementSchema.nullable().default(null),
  errorMessage: z.string().nullable().default(null),
});

export const clockPropsSchema = z.object({
  format: z.enum(['12h', '24h']).default('24h'),
  showSeconds: z.boolean().default(true),
  showDate: z.boolean().default(true),
  showWeekday: z.boolean().default(true),
  weekdayFormat: z.enum(['short', 'long']).default('long'),
  timeZone: z.string().min(1).max(80).default('local'),
  fontFamily: safeCssStringSchema(120).default('Manrope Variable'),
  fontSizePx: z.number().min(28).max(140).default(76),
  fontWeight: z
    .union([z.literal(300), z.literal(400), z.literal(500), z.literal(600), z.literal(700)])
    .default(600),
  letterSpacingEm: z.number().min(-0.06).max(0.2).default(-0.02),
  color: safeCssStringSchema(64).default('auto'),
  alignment: z.enum(['left', 'center', 'right']).default('center'),
  containerStyle: z.enum(['floating', 'crystal']).default('floating'),
});

export const searchPropsSchema = z.object({
  engine: z.enum(['google', 'bing', 'duckduckgo', 'custom']).default('google'),
  customEngineTemplate: safeCustomTemplateSchema.default(''),
  placeholder: z.string().max(160).default('Search Google or type a query...'),
  showEngineSelector: z.boolean().default(true),
  showSearchIcon: z.boolean().default(true),
  showClearButton: z.boolean().default(true),
  visualStyle: z.enum(['glass', 'solid']).default('glass'),
  focusShortcut: z.enum(['/', 'ctrl+k', 'both', 'none']).default('both'),
  enableLocalHistory: z.boolean().default(false),
  recentQueries: z.array(z.string().min(1).max(120)).max(8).default([]),
});

export const shortcutItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(60),
  url: httpUrlSchema,
  iconSource: z.enum(['favicon', 'material-symbol', 'monogram']),
  materialSymbolName: z.string().nullable(),
  monogramColor: safeCssStringSchema(64),
});

export const shortcutsPropsSchema = z.object({
  items: z.array(shortcutItemSchema).max(48),
  showLabels: z.boolean().default(true),
  openInNewTab: z.boolean().default(false),
  iconShape: z.enum(['squircle', 'circle', 'square']).default('squircle'),
  density: z.enum(['comfortable', 'compact']).default('comfortable'),
  columns: z
    .union([z.literal('auto'), z.literal(3), z.literal(4), z.literal(5), z.literal(6)])
    .default('auto'),
  orientation: z.enum(['horizontal', 'vertical']).default('horizontal'),
});

export const speedPropsSchema = z.object({
  title: z.string().min(1).max(60).default('Internet Speed'),
  autoMeasureIntervalMinutes: z
    .union([z.literal(0), z.literal(15), z.literal(30), z.literal(60)])
    .default(0),
  showDownload: z.boolean().default(true),
  showUpload: z.boolean().default(true),
  showPing: z.boolean().default(true),
  showLastTested: z.boolean().default(true),
  showManualButton: z.boolean().default(true),
  precision: z.union([z.literal(1), z.literal(2)]).default(1),
  layoutMode: z.enum(['standard', 'compact']).default('standard'),
  downloadProbeBytes: z
    .union([z.literal(1_048_576), z.literal(2_097_152), z.literal(5_242_880)])
    .default(2_097_152),
  uploadProbeBytes: z.union([z.literal(524_288), z.literal(1_048_576)]).default(524_288),
});

export function parseClockProps(raw: Record<string, unknown> | undefined): ClockElementProps {
  const parsed = clockPropsSchema.safeParse(raw ?? {});
  if (parsed.success) return parsed.data;
  return clockPropsSchema.parse({});
}

export function parseSearchProps(raw: Record<string, unknown> | undefined): SearchElementProps {
  const parsed = searchPropsSchema.safeParse(raw ?? {});
  if (parsed.success) return parsed.data;
  return searchPropsSchema.parse({});
}

export function parseShortcutsProps(
  raw: Record<string, unknown> | undefined,
  fallbackItems: ShortcutsElementProps['items'] = [],
): ShortcutsElementProps {
  const candidate =
    raw && raw.items === undefined
      ? { items: fallbackItems, ...raw }
      : (raw ?? { items: fallbackItems });
  const parsed = shortcutsPropsSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;
  return {
    items: fallbackItems,
    showLabels: true,
    openInNewTab: false,
    iconShape: 'squircle',
    density: 'comfortable',
    columns: 'auto',
    orientation: 'horizontal',
  };
}

export function parseSpeedProps(raw: Record<string, unknown> | undefined): SpeedElementProps {
  const parsed = speedPropsSchema.safeParse(raw ?? {});
  if (parsed.success) return parsed.data;
  return speedPropsSchema.parse({});
}

export const imageShapeSchema = z.enum([
  'square',
  'rectangle',
  'rounded-rect',
  'circle',
  'oval',
  'diamond',
  'star',
  'custom-rounded',
]);

export const imagePropsSchema = z.object({
  assetId: z.string().min(1),
  altText: z.string().max(200).default('Uploaded image'),
  shape: imageShapeSchema.default('rounded-rect'),
  fit: z.enum(['cover', 'contain']).default('cover'),
  starPoints: z.number().int().min(4).max(12).default(5),
  customCornerRadiiPx: z
    .tuple([
      z.number().min(0).max(200),
      z.number().min(0).max(200),
      z.number().min(0).max(200),
      z.number().min(0).max(200),
    ])
    .default([24, 8, 24, 8]),
  crop: z
    .object({
      zoom: z.number().min(1).max(3).default(1),
      panXPct: z.number().min(0).max(100).default(50),
      panYPct: z.number().min(0).max(100).default(50),
    })
    .default({ zoom: 1, panXPct: 50, panYPct: 50 }),
});

export const gifPropsSchema = z.object({
  assetId: z.string().min(1),
  altText: z.string().max(200).default('Animated GIF'),
  fit: z.enum(['cover', 'contain']).default('cover'),
  paused: z.boolean().default(false),
  showControlsOnHover: z.boolean().default(true),
});

export const textPropsSchema = z.object({
  content: z.string().max(4000).default('Custom Text'),
  fontFamily: safeCssStringSchema(120).default('Inter Variable'),
  uploadedFontAssetId: z.string().nullable().default(null),
  fontSizePx: z.number().min(10).max(160).default(28),
  fontWeight: z
    .union([z.literal(300), z.literal(400), z.literal(500), z.literal(600), z.literal(700)])
    .default(600),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
  color: safeCssStringSchema(64).default('#E5EAF2'),
  opacity: z.number().min(0.1).max(1).default(1),
  alignment: z.enum(['left', 'center', 'right']).default('center'),
  letterSpacingEm: z.number().min(-0.1).max(0.5).default(0),
  lineHeight: z.number().min(0.9).max(2.5).default(1.25),
  textShadow: z.enum(['none', 'subtle', 'crisp']).default('subtle'),
  backgroundStyle: z.enum(['none', 'crystal', 'solid']).default('none'),
  backgroundColor: safeCssStringSchema(64).default('#19283C'),
  backgroundOpacity: z.number().min(0).max(1).default(0.55),
  paddingPx: z.number().min(0).max(64).default(16),
});

export function parseImageProps(raw: Record<string, unknown>): ImageElementProps {
  const parsed = imagePropsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return {
    assetId: typeof raw.assetId === 'string' ? raw.assetId : '',
    altText: typeof raw.altText === 'string' ? raw.altText.slice(0, 200) : 'Uploaded image',
    shape: 'rounded-rect',
    fit: 'cover',
    starPoints: 5,
    customCornerRadiiPx: [24, 8, 24, 8],
    crop: { zoom: 1, panXPct: 50, panYPct: 50 },
  };
}

export function parseGifProps(raw: Record<string, unknown>): GifElementProps {
  const parsed = gifPropsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return {
    assetId: typeof raw.assetId === 'string' ? raw.assetId : '',
    altText: typeof raw.altText === 'string' ? raw.altText.slice(0, 200) : 'Animated GIF',
    fit: 'cover',
    paused: false,
    showControlsOnHover: true,
  };
}

export function parseTextProps(raw: Record<string, unknown>): TextElementProps {
  const parsed = textPropsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return {
    content: typeof raw.content === 'string' ? raw.content.slice(0, 4000) : 'Custom Text',
    fontFamily:
      typeof raw.fontFamily === 'string' &&
      raw.fontFamily.length > 0 &&
      raw.fontFamily.length <= 120 &&
      !DANGEROUS_CSS_PATTERN.test(raw.fontFamily)
        ? raw.fontFamily
        : 'Inter Variable',
    uploadedFontAssetId:
      typeof raw.uploadedFontAssetId === 'string' ? raw.uploadedFontAssetId : null,
    fontSizePx: 28,
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
}

export const persistedWorkspaceSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string(),
  activeProfileId: z.string().min(1),
  profiles: z.record(z.string(), workspaceProfileSchemaV2),
  globalSettings: globalPreferencesSchema,
  assetRegistry: z.record(z.string(), assetMetadataSchema),
  speedCache: legacySpeedReadingSchema.nullable(),
});

export const persistedWorkspaceSchemaV2 = z.object({
  schemaVersion: z.literal(2),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string(),
  activeProfileId: z.string().min(1),
  profiles: z.record(z.string(), workspaceProfileSchemaV2),
  globalSettings: globalPreferencesSchema,
  assetRegistry: z.record(z.string(), assetMetadataSchema),
  speedCache: legacySpeedReadingSchema.nullable(),
});

export const persistedWorkspaceSchemaV3 = z.object({
  schemaVersion: z.literal(3),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string(),
  activeProfileId: z.string().min(1),
  profiles: z.record(z.string(), workspaceProfileSchema),
  globalSettings: globalPreferencesSchema,
  assetRegistry: z.record(z.string(), assetMetadataSchema),
  speedCache: legacySpeedReadingSchema.nullable(),
});

export const persistedWorkspaceSchemaV4 = z.object({
  schemaVersion: z.literal(4),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string(),
  activeProfileId: z.string().min(1),
  profiles: z.record(z.string(), workspaceProfileSchema),
  globalSettings: globalPreferencesSchema,
  assetRegistry: z.record(z.string(), assetMetadataSchema),
  speedCache: speedCacheStateSchema.nullable(),
});

export const persistedWorkspaceSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string(),
  activeProfileId: z.string().min(1),
  profiles: z.record(z.string(), workspaceProfileSchema),
  globalSettings: globalPreferencesSchema,
  assetRegistry: z.record(z.string(), assetMetadataSchema),
  speedCache: speedCacheStateSchema.nullable(),
});

export type MigrationResult =
  { ok: true; state: PersistedWorkspaceState; migrated: boolean } | { ok: false; error: string };

function migrateLegacySpeedCache(
  legacy: z.infer<typeof legacySpeedReadingSchema> | null,
): SpeedCacheState | null {
  if (!legacy) return null;
  const hasNumbers =
    legacy.status === 'ok' &&
    typeof legacy.downloadMbps === 'number' &&
    typeof legacy.uploadMbps === 'number' &&
    typeof legacy.latencyMs === 'number';

  return {
    status:
      legacy.status === 'ok' ? 'completed' : legacy.status === 'error' ? 'failed' : legacy.status,
    phase: hasNumbers ? 'complete' : 'idle',
    isRunning: false,
    runningStartedAt: null,
    lastAttemptAt: legacy.measuredAt || null,
    lastSuccessfulResult: hasNumbers
      ? {
          downloadMbps: legacy.downloadMbps!,
          uploadMbps: legacy.uploadMbps!,
          pingMs: legacy.latencyMs!,
          jitterMs: 0,
          measuredAt: legacy.measuredAt,
          source: legacy.source,
          downloadBytes: 2_097_152,
          uploadBytes: 524_288,
        }
      : null,
    errorMessage: legacy.errorMessage ?? null,
  };
}

function upgradeWallpaperV2ToV3(
  wallpaper: z.infer<typeof wallpaperConfigSchemaV2>,
): WallpaperConfig {
  const focalMap: Record<WallpaperConfig['position'], { x: number; y: number }> = {
    center: { x: 50, y: 50 },
    top: { x: 50, y: 0 },
    bottom: { x: 50, y: 100 },
    left: { x: 0, y: 50 },
    right: { x: 100, y: 50 },
    custom: { x: 50, y: 50 },
  };
  const focal = focalMap[wallpaper.position];
  return {
    ...wallpaper,
    focalXPct: focal.x,
    focalYPct: focal.y,
    vignettePct: 0,
  };
}

function migrateProfileV2ToV4(
  profile: z.infer<typeof workspaceProfileSchemaV2>,
  seedDefaultLayoutIfEmpty: boolean,
): WorkspaceProfile {
  const hasElements = Object.keys(profile.layout.elements).length > 0;
  return {
    ...profile,
    theme: {
      ...profile.theme,
      wallpaper: upgradeWallpaperV2ToV3(profile.theme.wallpaper),
    },
    layout: !seedDefaultLayoutIfEmpty || hasElements ? profile.layout : createDefaultCanvasLayout(),
  };
}

/**
 * Validates and migrates raw storage payloads to schemaVersion 5.
 * Supports seamless upgrades from Phase 1 (v1), Phase 2-3 (v2), Phase 4 (v3), and Phase 5 (v4) payloads without data loss.
 */
export function validateAndMigrateWorkspace(raw: unknown): MigrationResult {
  if (raw === null || typeof raw !== 'object') {
    return { ok: false, error: 'Storage payload is empty or not an object.' };
  }

  const record = raw as Record<string, unknown>;
  const version = record.schemaVersion;

  if (version === CURRENT_SCHEMA_VERSION) {
    const parsed = persistedWorkspaceSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: `Schema v5 validation failed: ${parsed.error.issues[0]?.message ?? 'unknown error'}`,
      };
    }
    if (!parsed.data.profiles[parsed.data.activeProfileId]) {
      return {
        ok: false,
        error: `Active profile "${parsed.data.activeProfileId}" missing from profiles map.`,
      };
    }
    return { ok: true, state: parsed.data, migrated: false };
  }

  if (version === 4) {
    const parsedV4 = persistedWorkspaceSchemaV4.safeParse(raw);
    if (!parsedV4.success) {
      return {
        ok: false,
        error: `Schema v4 migration failed: ${parsedV4.error.issues[0]?.message ?? 'unknown error'}`,
      };
    }
    if (!parsedV4.data.profiles[parsedV4.data.activeProfileId]) {
      return {
        ok: false,
        error: `Active profile "${parsedV4.data.activeProfileId}" missing from profiles map.`,
      };
    }
    const migratedState: PersistedWorkspaceState = {
      ...parsedV4.data,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
    return { ok: true, state: migratedState, migrated: true };
  }

  if (version === 3) {
    const parsedV3 = persistedWorkspaceSchemaV3.safeParse(raw);
    if (!parsedV3.success) {
      return {
        ok: false,
        error: `Schema v3 migration failed: ${parsedV3.error.issues[0]?.message ?? 'unknown error'}`,
      };
    }
    if (!parsedV3.data.profiles[parsedV3.data.activeProfileId]) {
      return {
        ok: false,
        error: `Active profile "${parsedV3.data.activeProfileId}" missing from profiles map.`,
      };
    }
    const migratedState: PersistedWorkspaceState = {
      ...parsedV3.data,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      speedCache: migrateLegacySpeedCache(parsedV3.data.speedCache),
    };
    return { ok: true, state: migratedState, migrated: true };
  }

  if (version === 2) {
    const parsedV2 = persistedWorkspaceSchemaV2.safeParse(raw);
    if (!parsedV2.success) {
      return {
        ok: false,
        error: `Schema v2 migration failed: ${parsedV2.error.issues[0]?.message ?? 'unknown error'}`,
      };
    }
    if (!parsedV2.data.profiles[parsedV2.data.activeProfileId]) {
      return {
        ok: false,
        error: `Active profile "${parsedV2.data.activeProfileId}" missing from profiles map.`,
      };
    }

    const migratedProfiles = Object.fromEntries(
      Object.entries(parsedV2.data.profiles).map(([profileId, profile]) => [
        profileId,
        migrateProfileV2ToV4(profile, false),
      ]),
    );

    const migratedState: PersistedWorkspaceState = {
      ...parsedV2.data,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      profiles: migratedProfiles,
      speedCache: migrateLegacySpeedCache(parsedV2.data.speedCache),
    };

    return { ok: true, state: migratedState, migrated: true };
  }

  if (version === 1) {
    const parsedV1 = persistedWorkspaceSchemaV1.safeParse(raw);
    if (!parsedV1.success) {
      return {
        ok: false,
        error: `Schema v1 migration failed: ${parsedV1.error.issues[0]?.message ?? 'unknown error'}`,
      };
    }
    if (!parsedV1.data.profiles[parsedV1.data.activeProfileId]) {
      return {
        ok: false,
        error: `Active profile "${parsedV1.data.activeProfileId}" missing from profiles map.`,
      };
    }

    const migratedProfiles = Object.fromEntries(
      Object.entries(parsedV1.data.profiles).map(([profileId, profile]) => [
        profileId,
        migrateProfileV2ToV4(profile, true),
      ]),
    );

    const migratedState: PersistedWorkspaceState = {
      ...parsedV1.data,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      profiles: migratedProfiles,
      speedCache: migrateLegacySpeedCache(parsedV1.data.speedCache),
    };

    return { ok: true, state: migratedState, migrated: true };
  }

  return {
    ok: false,
    error: `Unsupported or missing schemaVersion: ${String(version)}`,
  };
}
