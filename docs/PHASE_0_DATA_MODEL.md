# PHASE 0 — Data Model & Storage Schema

**Product:** AURORA — Your Personal Browser Workspace  
**Schema Version:** `1`  
**Serialization Format:** JSON (`chrome.storage.local`) + Binary Blobs (`IndexedDB`)  

---

## 1. Persistent vs. Ephemeral State Separation

AURORA strictly isolates committed persistent data from transient editing sessions:

1. **`PersistedWorkspaceState` (`chrome.storage.local`)**: Source of truth rendered on every New Tab and surviving browser restarts. Only updated via an atomic **Save** commit or explicit Settings mutation.
2. **`EditorSessionState` (In-Memory Zustand Store)**: Active exclusively while Master Edit Mode is open. Holds `draftLayout`, `selectionIds`, `clipboard`, `undoStack`, `redoStack`, `snapGuides`, and `pendingAssetIds` (blobs uploaded during the current unsaved session).
3. **`IndexedDB` (`aurora-assets-db`)**: Stores heavy binary payloads (`wallpaper`, `image`, `gif`, `font`, `shortcut-icon`) referenced by `assetId` UUIDs—never serialized inside JSON.

---

## 2. TypeScript Domain Interfaces

### 2.1 Root Workspace & Profile Structures

```typescript
export type SchemaVersion = 1;

export type ProfilePresetType =
  | 'personal'
  | 'work'
  | 'study'
  | 'minimal'
  | 'creative'
  | 'custom';

export interface PersistedWorkspaceState {
  schemaVersion: SchemaVersion;
  revision: number; // Monotonically incremented on every Save for multi-tab sync
  updatedAt: string; // ISO 8601 timestamp
  activeProfileId: string;
  profiles: Record<string, WorkspaceProfile>;
  globalSettings: GlobalPreferences;
  assetRegistry: Record<string, AssetMetadata>;
  speedCache: SpeedReading | null;
}

export interface WorkspaceProfile {
  id: string;
  name: string;
  presetType: ProfilePresetType;
  createdAt: string;
  updatedAt: string;
  theme: ThemeConfig;
  navigation: NavigationConfig;
  layout: CanvasLayout;
}
```

### 2.2 Theme, Wallpaper & Navigation Configuration

```typescript
export type AppearanceMode = 'dark' | 'light' | 'system';

export interface ThemeConfig {
  appearance: AppearanceMode;
  accentColor: string; // Hex e.g. '#75CFFF'
  secondaryAccentColor: string; // Hex e.g. '#A78BFA'
  useWallpaperAdaptivePalette: boolean;
  extractedPalette: {
    dominant: string;
    accent: string;
    averageLuminance: number; // 0.0 (dark) to 1.0 (bright)
    recommendedAppearance: 'dark' | 'light';
  } | null;
  glass: {
    opacity: number; // 0.15 - 0.95
    blurPx: number; // 0 - 36
    saturationPct: number; // 100 - 180
    borderOpacity: number; // 0 - 0.5
    innerHighlight: boolean;
    shadowIntensity: 'none' | 'subtle' | 'medium';
    radiusPx: number; // 0 - 32
  };
  wallpaper: WallpaperConfig;
}

export type WallpaperSourceType = 'none' | 'solid' | 'gradient' | 'image';

export interface WallpaperConfig {
  type: WallpaperSourceType;
  solidColor: string;
  gradientCss: string; // Validated safe linear/radial gradient spec
  assetId: string | null; // References IndexedDB 'wallpapers' store
  fit: 'cover' | 'contain' | 'fill';
  position: 'center' | 'top' | 'bottom' | 'left' | 'right';
  blurPx: number; // 0 - 40
  dimPct: number; // 0 - 80
  overlayColor: string;
  overlayOpacity: number; // 0 - 0.75
}

export interface NavigationConfig {
  visible: boolean;
  style: 'floating-pills' | 'crystal-bar' | 'auto-hide';
  showBookmarks: boolean;
  syncChromeBookmarks: boolean; // Requires optional 'bookmarks' permission
  showGmail: boolean;
  showImages: boolean;
  showAppsGrid: boolean; // 6-dot Google Apps launcher
  showProfileShortcut: boolean;
  profileDisplayName: string;
  profileAvatarAssetId: string | null;
  curatedBookmarks: Array<{
    id: string;
    title: string;
    url: string; // Sanitized http/https only
  }>;
}
```

### 2.3 Canvas Layout & Element Base

```typescript
export interface CanvasLayout {
  referenceViewport: {
    width: number; // Canonical baseline e.g. 1440
    height: number; // Canonical baseline e.g. 900
  };
  grid: {
    enabled: boolean;
    sizePx: 8 | 12 | 16 | 24;
    snapToGrid: boolean;
    snapToGuides: boolean;
  };
  groups: Record<string, ElementGroup>;
  elements: Record<string, CanvasElement>;
  zOrder: string[]; // Ordered array of element IDs from bottom (0) to top (N-1)
}

export interface ElementGroup {
  id: string;
  name: string;
  locked: boolean;
  hidden: boolean;
  childIds: string[];
}

export interface ElementTransform {
  xPct: number; // 0 - 100 (% of safe canvas width)
  yPct: number; // 0 - 100 (% of safe canvas height)
  widthPx: number; // Reference pixel width
  heightPx: number; // Reference pixel height
  minWidthPx: number;
  minHeightPx: number;
  aspectLocked: boolean;
}

export interface ElementStyleBase {
  opacity: number; // 0 - 1
  borderWidthPx: number; // 0 - 12
  borderColor: string;
  borderStyle: 'solid' | 'dashed' | 'none';
  shadow: 'none' | 'soft' | 'elevated' | 'glow';
  cornerRadiusPx: number;
}

export interface BaseCanvasElement {
  id: string;
  type: ElementType;
  name: string; // Human-readable name shown in Layers Panel
  transform: ElementTransform;
  style: ElementStyleBase;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  groupId: string | null;
}

export type ElementType =
  | 'clock'
  | 'search'
  | 'shortcuts'
  | 'image'
  | 'gif'
  | 'text'
  | 'speed';

export type CanvasElement =
  | ClockElement
  | SearchElement
  | ShortcutElement
  | ImageElement
  | GifElement
  | TextElement
  | SpeedWidgetElement;
```

### 2.4 Specific Element Types

```typescript
export interface ClockElement extends BaseCanvasElement {
  type: 'clock';
  props: {
    format: '12h' | '24h';
    showSeconds: boolean;
    showDate: boolean; // DD/MM/YYYY
    showWeekday: boolean;
    weekdayFormat: 'short' | 'long';
    timeZone: string; // IANA e.g. 'Asia/Kolkata' or 'local'
    fontFamily: string;
    fontSizePx: number;
    fontWeight: 300 | 400 | 500 | 600 | 700;
    color: string; // 'auto' or hex
    alignment: 'left' | 'center' | 'right';
    containerStyle: 'floating' | 'crystal';
    animation: 'none' | 'colon-pulse' | 'digit-fade';
  };
}

export interface SearchElement extends BaseCanvasElement {
  type: 'search';
  props: {
    engine: 'google' | 'bing' | 'duckduckgo' | 'custom';
    customEngineTemplate: string; // e.g. 'https://kagi.com/search?q={query}'
    enableLocalSuggestions: boolean;
    enableLiveSuggestions: boolean; // Opt-in only
    placeholder: string;
    showSearchIcon: boolean;
    showClearButton: boolean;
    visualStyle: 'glass' | 'solid';
    focusShortcut: '/' | 'ctrl+k' | 'both' | 'none';
  };
}

export interface ShortcutItem {
  id: string;
  title: string;
  url: string; // Validated http/https
  iconSource: 'favicon' | 'custom-asset' | 'material-symbol' | 'monogram';
  customAssetId: string | null;
  materialSymbolName: string | null;
  monogramColor: string;
}

export interface ShortcutElement extends BaseCanvasElement {
  type: 'shortcuts';
  props: {
    mode: 'single' | 'collection';
    items: ShortcutItem[];
    columns: number; // Used when mode === 'collection'
    iconShape: 'circle' | 'squircle' | 'square' | 'crystal-tile';
    iconSizePx: number; // 32 - 80
    showLabels: boolean;
    openInNewTab: boolean;
  };
}

export type ImageShapeType =
  | 'square'
  | 'rectangle'
  | 'circle'
  | 'oval'
  | 'star'
  | 'rounded-rect'
  | 'diamond'
  | 'custom-rounded';

export interface ImageElement extends BaseCanvasElement {
  type: 'image';
  props: {
    assetId: string; // References IndexedDB 'images' store
    altText: string;
    shape: ImageShapeType;
    starPoints: number; // Default 5
    customCornerRadiiPx: [number, number, number, number]; // TL, TR, BR, BL
    crop: {
      zoom: number; // 1.0 - 4.0
      panXPct: number; // -50 to +50
      panYPct: number; // -50 to +50
    };
    clickAction: 'none' | 'open-url' | 'lightbox';
    clickUrl: string | null;
  };
}

export interface GifElement extends BaseCanvasElement {
  type: 'gif';
  props: {
    assetId: string; // References IndexedDB 'gifs' store (raw GIF87a/89a blob)
    altText: string;
    fit: 'cover' | 'contain';
    paused: boolean;
    showControlsOnHover: boolean;
  };
}

export interface TextElement extends BaseCanvasElement {
  type: 'text';
  props: {
    content: string; // Plain text rendered safely via text node
    fontFamily: string;
    uploadedFontAssetId: string | null; // Optional custom font from IndexedDB
    fontSizePx: number; // 10 - 160
    fontWeight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    italic: boolean;
    underline: boolean;
    color: string;
    alignment: 'left' | 'center' | 'right';
    letterSpacingEm: number; // -0.05 to 0.4
    lineHeight: number; // 0.9 to 2.5
    textShadow: 'none' | 'subtle' | 'crisp';
    backgroundStyle: 'none' | 'crystal' | 'solid';
    backgroundColor: string;
    paddingPx: number;
  };
}

export interface SpeedWidgetElement extends BaseCanvasElement {
  type: 'speed';
  props: {
    enabled: boolean;
    autoMeasureIntervalMinutes: 0 | 15 | 30 | 60; // 0 = Manual Only
    downloadProbeBytes: 1_048_576 | 2_097_152 | 5_242_880;
    uploadProbeBytes: 524_288 | 1_048_576;
    endpointPreset: 'cloudflare' | 'custom';
    customEndpointBaseUrl: string | null;
    visualStyle: 'crystal' | 'solid';
    showLatency: boolean;
    showLastUpdated: boolean;
  };
}

export interface SpeedReading {
  downloadMbps: number | null;
  uploadMbps: number | null;
  latencyMs: number | null;
  measuredAt: string; // ISO 8601
  source: 'manual' | 'alarm';
  status: 'ok' | 'offline' | 'permission-required' | 'error';
  errorMessage?: string;
}
```

### 2.5 Global Preferences, Assets & Ephemeral Editor State

```typescript
export interface GlobalPreferences {
  animationsEnabled: boolean;
  entranceStaggerMs: number;
  respectReducedMotion: boolean;
  defaultFontFamily: string;
  developerModeDiagnostics: boolean;
  customFonts: Array<{
    assetId: string;
    familyName: string;
    format: 'woff2' | 'woff' | 'ttf' | 'otf';
    byteSize: number;
    addedAt: string;
  }>;
}

export type AssetKind = 'wallpaper' | 'image' | 'gif' | 'font' | 'shortcut-icon';

export interface AssetMetadata {
  id: string;
  kind: AssetKind;
  mimeType: string;
  byteSize: number;
  width?: number;
  height?: number;
  createdAt: string;
  sha256?: string; // Enables deduplication across profiles
}

/**
 * Ephemeral Editor State — NEVER persisted directly as the active New Tab view.
 */
export interface EditorSessionState {
  isEditing: boolean;
  profileId: string | null;
  draftLayout: CanvasLayout | null;
  draftTheme: ThemeConfig | null;
  draftNavigation: NavigationConfig | null;
  selectedElementIds: string[];
  hoveredElementId: string | null;
  clipboard: CanvasElement[];
  undoStack: EditorHistorySnapshot[];
  redoStack: EditorHistorySnapshot[];
  pendingUploadedAssetIds: string[]; // Cleaned up if user clicks Discard
  isDirty: boolean;
}

export interface EditorHistorySnapshot {
  label: string;
  timestamp: number;
  layout: CanvasLayout;
}
```

---

## 3. IndexedDB (`aurora-assets-db`) Schema

| Object Store | Key Path | Value Type | Purpose |
|---|---|---|---|
| `blobs` | `id` (`assetId`) | `{ id: string, kind: AssetKind, mimeType: string, blob: Blob, createdAt: number }` | Raw binary wallpapers, images, raw multi-frame GIFs, shortcut icons |
| `fonts` | `id` (`assetId`) | `{ id: string, familyName: string, buffer: ArrayBuffer, format: string, createdAt: number }` | Uploaded local fonts loaded via `FontFace` |
| `recovery_drafts` | `profileId` | `{ profileId: string, savedRevision: number, draftLayout: CanvasLayout, updatedAt: number }` | Optional crash recovery snapshot (explicitly prompts user to Resume or Discard—never silently replaces `savedLayout`) |

---

## 4. Example Serialized Persistent Layout

```json
{
  "schemaVersion": 1,
  "revision": 14,
  "updatedAt": "2026-11-12T08:45:00.000Z",
  "activeProfileId": "profile-personal",
  "profiles": {
    "profile-personal": {
      "id": "profile-personal",
      "name": "Personal",
      "presetType": "personal",
      "createdAt": "2026-11-10T10:00:00.000Z",
      "updatedAt": "2026-11-12T08:45:00.000Z",
      "theme": {
        "appearance": "dark",
        "accentColor": "#75CFFF",
        "secondaryAccentColor": "#A78BFA",
        "useWallpaperAdaptivePalette": true,
        "extractedPalette": {
          "dominant": "#19283C",
          "accent": "#75CFFF",
          "averageLuminance": 0.14,
          "recommendedAppearance": "dark"
        },
        "glass": {
          "opacity": 0.58,
          "blurPx": 18,
          "saturationPct": 145,
          "borderOpacity": 0.16,
          "innerHighlight": true,
          "shadowIntensity": "subtle",
          "radiusPx": 20
        },
        "wallpaper": {
          "type": "gradient",
          "solidColor": "#101827",
          "gradientCss": "radial-gradient(circle at 20% 20%, #243B55 0%, #101827 70%)",
          "assetId": null,
          "fit": "cover",
          "position": "center",
          "blurPx": 0,
          "dimPct": 10,
          "overlayColor": "#101827",
          "overlayOpacity": 0.15
        }
      },
      "navigation": {
        "visible": true,
        "style": "crystal-bar",
        "showBookmarks": true,
        "syncChromeBookmarks": false,
        "showGmail": true,
        "showImages": true,
        "showAppsGrid": true,
        "showProfileShortcut": true,
        "profileDisplayName": "Sanja",
        "profileAvatarAssetId": null,
        "curatedBookmarks": [
          { "id": "bm-1", "title": "GitHub", "url": "https://github.com" },
          { "id": "bm-2", "title": "Docs", "url": "https://developer.chrome.com/docs/extensions" }
        ]
      },
      "layout": {
        "referenceViewport": { "width": 1440, "height": 900 },
        "grid": { "enabled": false, "sizePx": 12, "snapToGrid": true, "snapToGuides": true },
        "groups": {},
        "zOrder": ["el-clock-1", "el-search-1", "el-shortcuts-1", "el-speed-1"],
        "elements": {
          "el-clock-1": {
            "id": "el-clock-1",
            "type": "clock",
            "name": "Main Clock",
            "zIndex": 0,
            "visible": true,
            "locked": false,
            "groupId": null,
            "transform": {
              "xPct": 38.0,
              "yPct": 18.0,
              "widthPx": 360,
              "heightPx": 130,
              "minWidthPx": 180,
              "minHeightPx": 70,
              "aspectLocked": false
            },
            "style": {
              "opacity": 1,
              "borderWidthPx": 0,
              "borderColor": "#E5EAF2",
              "borderStyle": "none",
              "shadow": "none",
              "cornerRadiusPx": 16
            },
            "props": {
              "format": "24h",
              "showSeconds": true,
              "showDate": true,
              "showWeekday": true,
              "weekdayFormat": "long",
              "timeZone": "local",
              "fontFamily": "Manrope",
              "fontSizePx": 76,
              "fontWeight": 600,
              "color": "auto",
              "alignment": "center",
              "containerStyle": "floating",
              "animation": "colon-pulse"
            }
          },
          "el-search-1": {
            "id": "el-search-1",
            "type": "search",
            "name": "Search Bar",
            "zIndex": 1,
            "visible": true,
            "locked": false,
            "groupId": null,
            "transform": {
              "xPct": 28.0,
              "yPct": 38.0,
              "widthPx": 620,
              "heightPx": 56,
              "minWidthPx": 260,
              "minHeightPx": 44,
              "aspectLocked": false
            },
            "style": {
              "opacity": 1,
              "borderWidthPx": 1,
              "borderColor": "rgba(229,234,242,0.16)",
              "borderStyle": "solid",
              "shadow": "soft",
              "cornerRadiusPx": 9999
            },
            "props": {
              "engine": "google",
              "customEngineTemplate": "",
              "enableLocalSuggestions": true,
              "enableLiveSuggestions": false,
              "placeholder": "Search Google or jump to a shortcut...",
              "showSearchIcon": true,
              "showClearButton": true,
              "visualStyle": "glass",
              "focusShortcut": "both"
            }
          },
          "el-shortcuts-1": {
            "id": "el-shortcuts-1",
            "type": "shortcuts",
            "name": "Quick Shortcuts",
            "zIndex": 2,
            "visible": true,
            "locked": false,
            "groupId": null,
            "transform": {
              "xPct": 31.0,
              "yPct": 50.0,
              "widthPx": 540,
              "heightPx": 110,
              "minWidthPx": 120,
              "minHeightPx": 84,
              "aspectLocked": false
            },
            "style": {
              "opacity": 1,
              "borderWidthPx": 0,
              "borderColor": "transparent",
              "borderStyle": "none",
              "shadow": "none",
              "cornerRadiusPx": 16
            },
            "props": {
              "mode": "collection",
              "columns": 5,
              "iconShape": "squircle",
              "iconSizePx": 52,
              "showLabels": true,
              "openInNewTab": false,
              "items": [
                {
                  "id": "sc-1",
                  "title": "YouTube",
                  "url": "https://www.youtube.com",
                  "iconSource": "favicon",
                  "customAssetId": null,
                  "materialSymbolName": null,
                  "monogramColor": "#75CFFF"
                }
              ]
            }
          },
          "el-speed-1": {
            "id": "el-speed-1",
            "type": "speed",
            "name": "Speed Monitor",
            "zIndex": 3,
            "visible": true,
            "locked": false,
            "groupId": null,
            "transform": {
              "xPct": 4.0,
              "yPct": 74.0,
              "widthPx": 280,
              "heightPx": 144,
              "minWidthPx": 220,
              "minHeightPx": 120,
              "aspectLocked": false
            },
            "style": {
              "opacity": 1,
              "borderWidthPx": 1,
              "borderColor": "rgba(229,234,242,0.16)",
              "borderStyle": "solid",
              "shadow": "soft",
              "cornerRadiusPx": 20
            },
            "props": {
              "enabled": true,
              "autoMeasureIntervalMinutes": 30,
              "downloadProbeBytes": 2097152,
              "uploadProbeBytes": 524288,
              "endpointPreset": "cloudflare",
              "customEndpointBaseUrl": null,
              "visualStyle": "crystal",
              "showLatency": true,
              "showLastUpdated": true
            }
          }
        }
      }
    }
  },
  "globalSettings": {
    "animationsEnabled": true,
    "entranceStaggerMs": 20,
    "respectReducedMotion": true,
    "defaultFontFamily": "Inter",
    "developerModeDiagnostics": false,
    "customFonts": []
  },
  "assetRegistry": {},
  "speedCache": null
}
```

