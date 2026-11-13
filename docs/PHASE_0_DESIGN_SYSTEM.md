# PHASE 0 — UI/UX Design Specification: Royal Crystal UI

**Product:** AURORA — Your Personal Browser Workspace  
**Design Identity:** Premium · Royal · Minimal · Crystal · Futuristic · Professional  
**Foundation:** Refined Material 3 Principles + Disciplined Glassmorphism  
**Iconography Rule:** Google Material Symbols **ONLY** (zero Lucide, Font Awesome, or third-party icon packs)  

---

## 1. Visual Identity & Design Philosophy

AURORA should feel like a bespoke native desktop studio rather than a crowded browser dashboard.

### Core Aesthetic Principles
1. **Material Clarity Meets Crystalline Depth:** Surfaces sit at intentional elevation planes using translucent frosted glass, subtle specular top-edge highlights (`1px` hairline borders), and soft ambient shadows—never heavy neon glows, noisy gradients, or stacked drop shadows.
2. **Content-First Breathing Room:** Not every element is trapped in a card. The Clock and Custom Text can float directly over the wallpaper with adaptive contrast protection, while utility widgets (Search, Speed Monitor, Inspector Panels) inhabit Royal Crystal glass containers.
3. **Wallpaper-Respecting Contrast:** A beautiful New Tab fails if bright or busy wallpapers make text illegible. Every theme combines dynamic backdrop scrims, controlled glass opacity, and luminance-aware foreground switching.
4. **Zero Editing Clutter in View Mode:** Selection handles, grid overlays, and inspector panels exist strictly inside Master Edit Mode.

---

## 2. Color Token System

### 2.1 Seed Palette Reference

| Seed Token | Hex | Semantic Role |
|---|---|---|
| **Midnight Navy** | `#101827` | Primary deep canvas base (Dark) |
| **Royal Slate** | `#19283C` | Elevated surface / panel base (Dark) |
| **Deep Blue** | `#243B55` | Interactive container / hover surface |
| **Ice Blue** | `#75CFFF` | Primary radiant accent / focus ring / active state |
| **Royal Violet** | `#A78BFA` | Secondary accent / edit mode indicator / selection |
| **Pearl White** | `#E5EAF2` | Primary crisp foreground text (Dark) & light base |

### 2.2 Semantic Design Tokens (CSS Custom Properties)

#### Dark Theme (Default — "Midnight Royal")
| CSS Token | Value | Usage |
|---|---|---|
| `--aurora-bg-canvas` | `#101827` | Base fallback canvas behind wallpaper |
| `--aurora-surface-1` | `rgba(25, 40, 60, 0.58)` | Crystal widget fill |
| `--aurora-surface-2` | `rgba(36, 59, 85, 0.72)` | Elevated popovers, drawers, toolbars |
| `--aurora-surface-solid` | `#19283C` | Solid-mode widgets & `backdrop-filter` fallback |
| `--aurora-text-primary` | `#E5EAF2` | Clock, headings, primary labels (`>= 10:1` on Midnight Navy) |
| `--aurora-text-secondary` | `#A9B8CE` | Dates, metadata, secondary labels (`>= 5.4:1`) |
| `--aurora-text-muted` | `#7487A3` | Placeholders, disabled captions |
| `--aurora-accent-primary` | `#75CFFF` | Primary actions, focus outline, active indicators |
| `--aurora-accent-secondary` | `#A78BFA` | Edit Mode chrome, selection handles, alignment guides |
| `--aurora-border-subtle` | `rgba(229, 234, 242, 0.14)` | Crystal hairline perimeter |
| `--aurora-border-highlight` | `rgba(117, 207, 255, 0.35)` | Active/hover crystal edge |
| `--aurora-status-success` | `#34D399` | Save confirmation, healthy latency |
| `--aurora-status-warning` | `#FBBF24` | High latency, quota warning |
| `--aurora-status-error` | `#F87171` | Offline state, validation error, destructive actions |

#### Light Theme ("Pearl Crystal")
| CSS Token | Value | Usage |
|---|---|---|
| `--aurora-bg-canvas` | `#EEF3F9` | Base light canvas |
| `--aurora-surface-1` | `rgba(255, 255, 255, 0.64)` | Light crystal widget fill |
| `--aurora-surface-2` | `rgba(241, 246, 252, 0.84)` | Elevated inspector / menus |
| `--aurora-surface-solid` | `#FFFFFF` | Solid-mode widgets & fallback |
| `--aurora-text-primary` | `#101827` | Primary foreground (`>= 14:1` on white) |
| `--aurora-text-secondary` | `#3B4E6B` | Secondary labels (`>= 6.8:1`) |
| `--aurora-text-muted` | `#64748B` | Placeholders |
| `--aurora-accent-primary` | `#0284C7` | High-contrast Ice Blue derivative for light surfaces |
| `--aurora-accent-secondary` | `#7C3AED` | High-contrast Royal Violet derivative |
| `--aurora-border-subtle` | `rgba(16, 24, 39, 0.12)` | Subtle dark hairline |
| `--aurora-border-highlight` | `rgba(2, 132, 199, 0.38)` | Hover/active hairline |

#### Theme Modes Supported
1. **Dark** (`Midnight Royal`)
2. **Light** (`Pearl Crystal`)
3. **System Automatic** (`prefers-color-scheme` reactive listener)
4. **Custom Accent Override** (user chooses primary accent hex; system auto-derives accessible hover/tint/focus tokens and checks WCAG contrast)
5. **Wallpaper-Adaptive Palette** (on wallpaper upload, an offscreen `<canvas>` samples downscaled pixels via median-cut / k-means quantization to extract dominant hue and average relative luminance `L`, recommending Dark vs Light foreground mode and an adaptive scrim opacity)

---

## 3. Crystal / Glassmorphism Token System

Glassmorphism is parameterized so users can tune transparency globally or per-widget while guaranteeing legibility.

| Token | Default (Dark) | Default (Light) | Configurable Range |
|---|---|---|---|
| `--glass-opacity` | `0.58` | `0.64` | `0.15` – `0.95` |
| `--glass-blur` | `18px` | `18px` | `0px` – `36px` |
| `--glass-saturation` | `145%` | `135%` | `100%` – `180%` |
| `--glass-border-width` | `1px` | `1px` | `0px` – `2px` |
| `--glass-inner-glow` | `inset 0 1px 0 rgba(255,255,255,0.12)` | `inset 0 1px 0 rgba(255,255,255,0.65)` | On / Off |
| `--glass-shadow` | `0 12px 32px -8px rgba(4, 9, 20, 0.45)` | `0 12px 32px -8px rgba(16, 24, 39, 0.12)` | Subtle / Medium / None |
| `--glass-radius-lg` | `20px` | `20px` | `0px` – `32px` |
| `--glass-radius-pill` | `9999px` | `9999px` | Fixed pill |

### Fallback & Readability Rules
- **`@supports not (backdrop-filter: blur(1px))` or Low-Power Mode:** Automatically falls back to `--aurora-surface-solid` at `0.92` alpha so text never loses contrast.
- **Wallpaper Contrast Guard:** If computed wallpaper luminance behind free-floating text violates contrast thresholds (`< 4.5:1`), AURORA applies either an adaptive subtle radial text-shadow or recommends increasing the background dim scrim.

---

## 4. Typography System

All bundled fonts are packaged locally as WOFF2 files inside the extension bundle (zero external Google Fonts CDN requests so MV3 CSP stays clean and offline startup is instantaneous).

### Font Families
- **Display / Clock Default:** `Manrope` (geometric clarity, crisp tabular numerals)
- **UI / Body Default:** `Inter` (high legibility at `11px–16px`, clean weights `400–700`)
- **System Safe Stacks:** `system-ui`, `-apple-system`, `Segoe UI`, `Roboto`, `SF Pro Display`, `JetBrains Mono` (optional monospace)
- **User-Uploaded Fonts:** Local `.woff2`, `.woff`, `.ttf`, `.otf` registered via `FontFace` API

### Type Scale

| Role | Font Family | Size | Weight | Line Height | Tracking | Notes |
|---|---|---|---|---|---|---|
| **Hero Clock** | `Manrope` (configurable) | `clamp(3.5rem, 6vw, 6.5rem)` | `600` | `1.0` | `-0.03em` | `font-variant-numeric: tabular-nums` |
| **Date & Weekday** | `Inter` (configurable) | `1rem` – `1.25rem` | `500` | `1.3` | `0.02em` | `DD/MM/YYYY` |
| **Page / Modal Heading** | `Manrope` | `1.25rem` (`20px`) | `600` | `1.3` | `-0.01em` | Settings & Inspector headers |
| **Widget Title** | `Inter` | `0.875rem` (`14px`) | `600` | `1.4` | `0.01em` | Speed widget, Apps drawer |
| **Body Content** | `Inter` | `0.875rem` (`14px`) | `400` | `1.5` | `0em` | Standard copy |
| **Labels & Inspector** | `Inter` | `0.75rem` (`12px`) | `500` | `1.35` | `0.02em` | Property labels, shortcut captions |
| **Buttons & Chips** | `Inter` | `0.8125rem` (`13px`) | `500` | `1.2` | `0.01em` | Toolbar & controls |
| **Custom User Text** | User-selected | `10px` – `160px` | `100`–`900` | `0.9`–`2.5` | `-0.05em`–`0.4em` | Fully customizable |

---

## 5. Iconography Standard (Google Material Symbols Only)

- **Library:** Self-hosted `Material Symbols Rounded` (variable font WOFF2) or curated SVG paths derived strictly from Google Material Symbols.
- **No Mixed Icons:** `shadcn/ui` primitives (Dialog close, Select chevron, Checkbox check, Switch) MUST be refactored during Phase 1 to use `<MaterialSymbol name="..." />` instead of `lucide-react`.
- **Optical Sizing:** `18px` inside dense inspector inputs, `20px` in toolbars/nav, `24px` in primary triggers.

---

## 6. Component & Layout Wireframes

### 6.1 Default New Tab Layout (View Mode)

```text
+-----------------------------------------------------------------------------------+
| [Bookmarks v]                     [Personal v]   [Gmail] [Images] [:: Apps] [ (U) ]|
|-----------------------------------------------------------------------------------|
|                                                                                   |
|                                    14:16:32                                       |
|                              Thursday, 12/11/2026                                 |
|                                                                                   |
|                   +-------------------------------------------+                   |
|                   | (G)  Search Google or type URL...     (x) |                   |
|                   +-------------------------------------------+                   |
|                                                                                   |
|             [ YT ]       [ GH ]       [ Mail ]       [ Docs ]      [ + ]          |
|            YouTube       GitHub       Outlook         Drive        Add            |
|                                                                                   |
|  +-----------------------------+                                                  |
|  | Speed Monitor       (↻)     |                                                  |
|  | ↓ 184.2 Mbps   ↑ 42.6 Mbps  |                                                  |
|  | Ping: 14 ms   • 2m ago      |                                                  |
|  +-----------------------------+                                                  |
|                                                         [⚙ Settings] [✎ Edit]     |
+-----------------------------------------------------------------------------------+
```

### 6.2 Fixed Navigation Area Specification
- **Height:** `52px` top safe strip (`padding: 12px 24px`), non-overlapping by default (canvas warns or anchors below top safe zone unless user disables top bar).
- **Left Group:** Bookmarks trigger (opens Crystal Bookmark Bar / Drawer) + optional Profile Pill (`Personal v` switcher).
- **Right Group:** `Gmail` (`https://mail.google.com`), `Images` (`https://www.google.com/imghp`), `Apps` (6-dot Material grid popover with Google Workspace & user-pinnable web apps), `Profile` avatar button (links to `https://myaccount.google.com/` with customizable local photo/initials).
- **Clear Distinction:** Subtle frosted bar or floating top pills; cannot be accidentally dragged in Edit Mode (configured separately in Settings -> Navigation).

### 6.3 Master Edit Mode Layout

```text
+-----------------------------------------------------------------------------------+
| EDITING DRAFT (Unsaved changes)   [Undo][Redo] | [Snap][Grid] | [Discard] [Save]  |
+-----------------------------------------------------------------------------------+
| [Layers]       |                                                 | [Inspector]    |
| • Clock        |        +----[Selected: Star Image]----+         | Position       |
| • Search Bar   |        o              o               o         | X: 64%  Y: 32% |
| v Group: Media |        |         ★  Photo             |         | W: 220  H: 220 |
|   • Star Img   |        o              o               o         |----------------|
|   • Quote Txt  |        +------------------------------+         | Shape: [Star v]|
| • GIF Mascot   |           | (smart center guide)                | Zoom:  [==•--] |
| • Speed Widget |           v                                     | Border:[1px #..] |
|                |   +-----------------------------------------+   | Shadow:[Soft v]|
| [+ Add Element]|   | [Dup][Group][Front][Back][Lock][Delete] |   | Opacity:[100%] |
+-----------------------------------------------------------------------------------+
```

#### Edit Mode Chrome Behavior
1. **Top Editor Header:** Shows active profile name, dirty-state badge (`Unsaved Draft`), `Undo` / `Redo`, `Grid` / `Snap` toggles, `Reset Layout`, `Discard`, and primary Ice Blue `Save` button.
2. **Left Layers Panel (Collapsible `240px`):** Hierarchical list (top-most z-index at top), drag-to-reorder, eye visibility toggle, lock toggle, group expand/collapse, `+ Add Element` menu (Image, GIF, Text, Shortcut, Clock, Search, Speed Widget).
3. **Floating Contextual Toolbar:** Appears near selection or bottom-center dock with quick actions: Duplicate, Group/Ungroup, Align (6 modes), Distribute (H/V), Z-order (Front/Forward/Backward/Back), Lock, Delete.
4. **Right Properties Inspector (`288px`):** Dynamically adapts to single selection, multi-selection (shared Transform/Align/Group), or canvas background when nothing is selected.

### 6.4 Settings Interface Structure
Modal/Slide-over Crystal Drawer (`max-width: 920px`, `height: 82vh`) with left rail for the **10 Categories**:
1. **Appearance:** Dark / Light / System theme, Seed & Custom Accent, Crystal Glass Opacity & Blur sliders.
2. **Wallpaper:** Upload / Replace / Remove, Built-in presets, Color/Gradient picker, Fit (`cover`/`contain`), Position, Blur, Dim, Tint Overlay, Adaptive Palette toggle.
3. **Layout:** Grid size, Snap sensitivity, Safe margins, Responsive scaling mode, Reset layout.
4. **Widgets:** Enable/disable Clock, Search, Shortcuts, Speed Monitor defaults; Speed test interval & endpoint settings.
5. **Search:** Default engine (Google, Bing, DuckDuckGo, Custom URL), Suggestion source (Local only vs Opt-in live), Keyboard shortcut bindings.
6. **Typography:** Default UI/Clock font, Upload custom local fonts (`.woff2`/`.ttf`/`.otf`), Manage uploaded fonts.
7. **Navigation:** Toggle Bookmarks, Gmail, Images, Apps 6-dot grid, Profile button; Edit custom profile avatar/name; Nav bar style (Floating pills vs Full glass bar vs Hidden on hover).
8. **Animations:** Entrance animation speed, Hover micro-interactions, Reduced motion override.
9. **Storage:** Visual quota bar (Local Storage + IndexedDB breakdown by Wallpapers, Images, GIFs, Fonts), Clean orphaned blobs, Export/Import profile bundle (`.aurora.json` / `.zip`).
10. **Advanced:** Profiles manager (Personal, Work, Study, Minimal, Creative + Custom), Optional Chrome permissions status (`bookmarks`, `optional_host_permissions`), Diagnostics/Reset.

---

## 7. Widget & Element Visual Specifications

### Shaped Image Element
- Supports Square, Rectangle, Circle, Oval, Star, Rounded Rectangle, Diamond, and Custom Corner Radius.
- **Rendering Technique:** Outer positioned container applies `filter: drop-shadow(...)` so shadows trace non-rectangular silhouettes (e.g., Star points). Inside, an `<svg viewBox="0 0 W H">` holds `<clipPath>` geometry + `<image preserveAspectRatio="xMidYMid slice">` (transformed by zoom & pan offset) + an optional top-layered SVG `<path>` stroke for crisp borders without clipping artifacts!

### Animated GIF Element
- Rectangular container with configurable `border-radius`, `border`, `box-shadow`, and `object-fit` (`cover` / `contain`).
- On hover (optional setting) or corner pill, shows subtle Play/Pause Crystal button (`play_arrow` / `pause` Material Symbol). When paused, draws the live `<img>` frame to a `<canvas>` layer and hides the `<img>` cleanly.

### Internet Speed Monitoring Widget
- Compact Crystal card (`~280×150px` default):
  - Header: `network_check` icon + "Network Speed" + manual Refresh button (`refresh` spinning smoothly during test).
  - Metrics row: Download (`south` / `download` icon, large `Manrope` tabular numerals + `Mbps`), Upload (`north` / `upload` icon + `Mbps`).
  - Footer row: Latency (`speed` / `avg_pace` + `ms`), timestamp (`2m ago` / `Never`), and subtle status dot (Green = fresh, Amber = stale/throttled, Red = offline/error).
  - Includes an unobtrusive info tooltip (`info` icon) clarifying: *"Measures periodically while Chrome is open. Never simulated."*

---

## 8. Loading, Empty & Error States

| Scenario | UI Behavior |
|---|---|
| **Initial New Tab Paint** | Render cached layout skeleton/tokens synchronously from fast boot state; wallpaper fades in smoothly (`120ms`) once Blob URL resolves. Zero full-page spinner. |
| **Widget-Level Failure** | Isolated React Error Boundary per widget showing compact crystal fallback (`warning` icon + "Widget failed to load" + Reset/Retry) without crashing Clock or Search. |
| **Favicon Load Failure** | Seamless swap to high-contrast letter monogram on tinted Royal Slate / Accent circle. |
| **Speed Test Offline / Blocked** | Clear inline message ("Offline" or "Permission required for speed test endpoint") + manual Retry / Grant Access CTA; retains timestamped last known measurement marked as stale. |
| **Corrupt Storage / Draft** | Non-blocking toast banner offering "Restore Last Good Snapshot" or "Reset to Default Profile". |

---

## 9. Motion Design Guidelines

| Interaction | Duration | Easing | Notes |
|---|---|---|---|
| **Hover / Button / Shortcut Lift** | `180–220 ms` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Subtle scale `1.02` + border highlight |
| **Settings Drawer / Popovers** | `240–280 ms` | `cubic-bezier(0.16, 1, 0.3, 1)` | Slide + fade (`transform` + `opacity` only) |
| **New Tab Widget Entrance** | `260–320 ms` | `cubic-bezier(0.16, 1, 0.3, 1)` | Optional staggered `20ms` entrance (disableable for instant feel) |
| **Theme / Appearance Switch** | `220 ms` | `ease-out` | Smooth token transition |
| **Drag & Resize Manipulation** | `0 ms` (Direct) | Linear 1:1 pointer tracking | **Zero transition delay** during active pointer drag/resize |

- **`prefers-reduced-motion: reduce`:** Automatically disables entrance staggers, clock colon pulse, and auto-plays GIFs in paused state (with manual Play override).

---

## 10. Accessibility Standards (WCAG 2.1 AA)

1. **Keyboard Operability:** Every control in View Mode, Top Nav, Settings, and Master Edit Mode is reachable via `Tab` / `Shift+Tab`, activated via `Enter` / `Space`, and dismissed via `Escape`.
2. **Focus Visibility:** Custom `2px` high-contrast focus ring (`--aurora-accent-primary` + `2px` offset) visible on `:focus-visible`.
3. **Canvas Keyboard Editing:** Selected canvas elements move by `1px` with Arrow keys (`10px` with `Shift+Arrow`) and cycle selection with `Tab` inside the canvas container.
4. **Screen Readers:** All icon-only Material Symbol buttons carry explicit `aria-label` and `title`; live speed test updates announce via `aria-live="polite"`; Clock avoids `aria-live` chatter every second.
5. **Contrast:** UI chrome (Settings, Inspector, Toolbars, Speed Widget) meets `>= 4.5:1` text contrast and `>= 3:1` UI component contrast in both Dark and Light themes.

