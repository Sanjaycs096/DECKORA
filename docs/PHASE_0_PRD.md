# PHASE 0 — Product Requirements Document (PRD)

**Product Name:** AURORA — Your Personal Browser Workspace  
**Tagline:** *"Your Browser. Your Space."*  
**Target Platform:** Google Chrome (Manifest V3) — Desktop-first  
**Document Status:** Phase 0 Planning Deliverable (Pre-Implementation)  

---

## 1. Product Vision & Strategic Positioning

AURORA replaces Chrome's default New Tab page with a calm, deeply customizable, desktop-grade personal workspace. While existing New Tab extensions (such as MYNT — Material You New Tab, which serves solely as a general category reference) focus primarily on fixed grids, preset themes, or widget cards, AURORA empowers users with **direct-manipulation creative control** over their browser homepage while maintaining a cohesive **Royal Crystal** visual language.

### Core Product Pillars
1. **Unrestricted Canvas Personalization:** Every element on the New Tab workspace is an independent, movable, resizable, layer-ordered object managed through a dedicated **Master Edit Mode**.
2. **Signature Royal Crystal Aesthetic:** Refined Material 3 structure combined with disciplined glassmorphism—translucent surfaces, controlled backdrop blur, crisp hairline borders, and wallpaper-adaptive contrast—never cluttered or over-decorated.
3. **Local-First Privacy & Instant Performance:** Zero mandatory accounts, zero remote telemetry, zero cloud lock-in. All layouts, wallpapers, uploaded images, animated GIFs, and custom fonts live locally in browser storage and render immediately upon opening a tab.
4. **Honest, Reliable Utility:** Live clock/date, multi-engine search, resilient quick shortcuts, and an honest, bandwidth-conscious internet speed monitoring widget operating strictly within Chrome Manifest V3 capabilities.

---

## 2. Workspace Inspection Baseline

Before establishing requirements, the workspace (`c:\Users\sanja\project\JARVIS`) was inspected:
- **Repository State:** Clean, empty workspace directory; no existing Git repository, `package.json`, `manifest.json`, source files, design assets, or documentation were present.
- **Local Toolchain Detected:** Node.js `v24.12.0`, npm `11.6.2`, pnpm `10.29.3`.
- **Implication:** AURORA is a greenfield project. No legacy code constrains the architecture, and all Phase 0 blueprints establish the foundational standard prior to Phase 1 scaffolding.

---

## 3. Target User Experience

### First-Run Experience
- Opening a New Tab immediately after installation displays a curated, balanced default **Personal** profile featuring the Midnight Navy / Royal Slate crystal theme, a centered live clock and date, an interactive search bar, a minimal top navigation bar, and starter quick shortcuts—ready to use in under 150 ms without forced onboarding modals or account sign-ups.
- A discreet, unobtrusive **Edit / Customize** action invites the user into Master Edit Mode when they wish to reshape their space.

### Daily Usage (View Mode)
- Clean, distraction-free workspace with zero editing chrome (no handles, no grid lines, no toolbars).
- Instant focus on the search bar via keyboard shortcut (`/` or `Ctrl+K` / `⌘K`), single-click access to shortcuts and top navigation, and at-a-glance visibility of time, date, and latest network status.

### Creative Customization (Master Edit Mode)
- Clicking **Edit / Customize** smoothly transitions the page into an interactive studio with a floating toolbar, context-sensitive properties inspector, layers panel, and explicit **Save** / **Discard** transactional controls.
- Users can compose layered layouts combining shaped images, animated GIFs, custom-font typography, widgets, and shortcuts—with undo/redo, alignment guides, snapping, grouping, and profile switching.

---

## 4. Complete Feature Catalogue & Functional Requirements

### A. Fixed Navigation Area
- **Purpose:** Provide familiar, fast-access browser navigation within the New Tab page without attempting to override Chrome's native browser chrome.
- **Chrome Platform Constraint:** Chrome extensions cannot alter Chrome's native toolbar, omnibox, native bookmarks bar, or native browser profile switcher. AURORA implements these controls inside the New Tab viewport.
- **Functional Requirements:**
  - `FR-NAV-01`: Top navigation bar positioned stably at the top of the workspace by default, visually distinct from user-draggable canvas elements.
  - `FR-NAV-02`: Default controls: Bookmarks / Bookmark Shortcuts drawer or bar, Gmail link, Google Images link, Google Apps launcher (six-dot grid popover), and Google Account profile shortcut.
  - `FR-NAV-03`: Hover states, focus rings, and minimal visual footprint aligned with the Royal Crystal theme.
  - `FR-NAV-04`: Users can toggle visibility of individual navigation items, switch between minimal/compact/glass styles, and optionally enable Chrome Bookmarks integration (via optional `bookmarks` permission requested on opt-in).
- **Acceptance Criteria:**
  - Default navigation items remain anchored and aligned across desktop viewports (`1280×720` through `3840×2160`).
  - Toggling item visibility or appearance persists across New Tabs and browser restarts.
  - No unauthorized Chrome API permission is requested if the user uses curated bookmarks only.

### B. Background & Wallpaper Customization
- **Purpose:** Allow users to establish the atmospheric foundation of their workspace without degrading legibility.
- **Functional Requirements:**
  - `FR-BG-01`: Upload local wallpaper images (PNG, JPEG, WebP, AVIF) stored in IndexedDB; replace or remove existing wallpaper.
  - `FR-BG-02`: Built-in curated color themes (Midnight Navy, Royal Slate, Pearl Daybreak, etc.) and custom solid/gradient background color pickers.
  - `FR-BG-03`: Positioning and sizing controls: `cover`, `contain`, `fill`, alignment anchors (`center`, `top`, `bottom`, `left`, `right`).
  - `FR-BG-04`: Adjustable backdrop blur (`0–40 px`), dim/brightness (`0–80%`), and tinted overlay color/opacity.
  - `FR-BG-05`: Wallpaper-adaptive palette extraction (computing dominant and accent colors offscreen) and automatic contrast protection (scrim recommendation or adaptive surface opacity) to preserve text/widget readability.
  - `FR-BG-06`: Appearance modes: Dark, Light, Automatic (follows `prefers-color-scheme`), plus custom accent color override.
- **Acceptance Criteria:**
  - Uploaded wallpapers render immediately from local IndexedDB cache without network dependency.
  - Changing blur, dim, or overlay updates live in preview and persists upon Save.
  - Foreground text over high-contrast wallpapers maintains readable contrast via automatic scrim or crystal surface opacity.

### C. Live Clock and Date
- **Purpose:** Deliver an accurate, customizable, zero-jank focal timepiece.
- **Functional Requirements:**
  - `FR-CLK-01`: Live `HH:MM:SS` display with 12-hour (`AM/PM`) and 24-hour format toggle.
  - `FR-CLK-02`: Date formatted in `DD/MM/YYYY` with optional weekday label (short or full).
  - `FR-CLK-03`: Configurable IANA time zone selection (defaulting to system local time zone).
  - `FR-CLK-04`: Typography controls: font family, font size, weight, color, alignment (`left`, `center`, `right`), optional tabular numerals, and subtle tick/fade animation.
  - `FR-CLK-05`: Supports free-floating rendering (no card background required) or optional crystal panel container.
- **Acceptance Criteria:**
  - Clock updates strictly on second boundaries without causing React rerenders in sibling canvas elements.
  - Time zone changes immediately reflect accurate local/target time and date via `Intl.DateTimeFormat`.

### D. Search Bar
- **Purpose:** Provide instant web search from the New Tab workspace.
- **Functional Requirements:**
  - `FR-SRC-01`: Engine support for Google, Bing, DuckDuckGo, and user-defined Custom Search Engine (URL template containing `{query}`).
  - `FR-SRC-02`: Search submission via standard HTTPS navigation (`window.location.assign` or `chrome.tabs.update`) requiring **zero** host permissions.
  - `FR-SRC-03`: Search suggestions: Local instant suggestions (matching user's shortcuts, history/bookmarks if permitted) enabled by default with zero external leakage; optional live web suggestions only if user explicitly opts in and grants the corresponding optional host permission (or via Chrome's `chrome.search.query` when using default engine—see ADR-004).
  - `FR-SRC-04`: Customizable placeholder text, search icon visibility, clear-input button, width, height, canvas position, and visual style (`glass` vs `solid`).
  - `FR-SRC-05`: Keyboard shortcuts: `/` or `Ctrl+K` (`⌘K`) focuses search input when not editing text; `Escape` clears/blurs.
- **Acceptance Criteria:**
  - Submitting a query launches the selected engine accurately with proper URL encoding (`encodeURIComponent`).
  - Resizing, repositioning, and styling changes persist in layout state.

### E. Quick Shortcuts
- **Purpose:** Fast visual launcher for frequently visited sites.
- **Functional Requirements:**
  - `FR-SC-01`: Create, edit (title, URL), duplicate, and delete shortcuts.
  - `FR-SC-02`: Customize icon source: automatic site favicon (via MV3 `chrome-extension://<id>/_favicon/`), custom uploaded image, Material Symbol icon, or styled letter monogram.
  - `FR-SC-03`: Customize icon container appearance (circle, rounded square/squircle, square, crystal tile, borderless), label visibility toggle, size, and canvas position.
  - `FR-SC-04`: Graceful fallback chain if favicon fails to load: custom image -> cached favicon -> Material Symbol / colored monogram tile (never broken image icons).
  - `FR-SC-05`: URL validation restricting schemes to safe protocols (`https:`, `http:`, and explicitly permitted safe actions; blocking `javascript:`, `data:`, `vbscript:`).
- **Acceptance Criteria:**
  - Broken or unreachable favicons always render a clean monogram fallback without console errors breaking layout.
  - Shortcuts can be placed individually or in shortcut groups on the canvas.

### F. Image Elements & Geometric Shapes
- **Purpose:** Enable expressive personal artwork, photography, and visual framing on the workspace canvas.
- **Functional Requirements:**
  - `FR-IMG-01`: Upload local images (PNG, JPEG, WebP, AVIF, static SVG sanitized or rasterized—see Security) validated by magic bytes, not extension alone.
  - `FR-IMG-02`: Supported geometric shapes: Square, Rectangle, Circle, Oval, Star (5-point / configurable points), Rounded Rectangle, Diamond, and customizable corner/geometry radius.
  - `FR-IMG-03`: Non-destructive image framing controls: Crop region, Zoom (`1.0x–4.0x`), Pan X/Y inside shape container, Replace image, Delete element.
  - `FR-IMG-04`: Transform & styling: Resize, reposition, layer ordering (`zIndex`), opacity (`0–100%`), optional border (width, color, style), optional drop shadow.
  - `FR-IMG-05`: Optional click action in View Mode: None, Open URL (validated `http`/`https`), or Expand Lightbox preview.
- **Acceptance Criteria:**
  - Clipping preserves crisp vector edges at any DPI and supports borders + drop shadows around non-rectangular shapes (Star, Diamond, Circle).
  - Replacing an image cleans up the orphaned blob from IndexedDB upon Save.

### G. Animated GIF Element
- **Purpose:** Allow decorative or ambient animated GIFs without losing animation frames.
- **Functional Requirements:**
  - `FR-GIF-01`: Dedicated rectangular GIF element accepting `image/gif` validated via `GIF87a` / `GIF89a` header bytes.
  - `FR-GIF-02`: Preserve full multi-frame animation natively via IndexedDB `Blob` + `ObjectURL` rendering in `<img>` (never flattened through canvas re-encoding on upload).
  - `FR-GIF-03`: Controls: Upload, replace, delete, resize, reposition, adjustable aspect ratio (locked or free), rounded corners, optional border & shadow, layer ordering, opacity.
  - `FR-GIF-04`: Pause / Play toggle (and "Respect Reduced Motion" auto-pause option) implemented via frozen-frame `<canvas>` capture overlay when paused, restoring live `<img>` on play.
- **Acceptance Criteria:**
  - Uploaded animated GIFs animate smoothly across New Tabs and browser restarts.
  - Pausing freezes the visual frame cleanly; resuming restores animation without re-downloading.

### H. Custom Text Element
- **Purpose:** Provide typographic notes, quotes, headers, or labels anywhere on the canvas.
- **Functional Requirements:**
  - `FR-TXT-01`: User-defined text rendered safely as plain text / structured style tokens (no raw HTML injection).
  - `FR-TXT-02`: Typography controls: font family (bundled fonts + curated system stacks + locally uploaded `.woff2`/`.woff`/`.ttf`/`.otf` fonts), font size, font weight (`100–900`), italic, underline, color, opacity, horizontal alignment, letter spacing, line height, text shadow, optional crystal/solid background pill/card with padding & radius.
  - `FR-TXT-03`: Resize (width/auto-height or fixed box) and reposition on canvas.
  - `FR-TXT-04`: Custom font uploader validates binary font signatures, loads via `FontFace` API, stores font binary in IndexedDB, and displays licensing notice (personal local use only).
- **Acceptance Criteria:**
  - Uploaded fonts persist across browser restarts and load prior to text paint via `document.fonts.add`.
  - Malicious script payloads typed into text elements render strictly as literal characters.

### I. Internet Speed Monitoring Widget
- **Purpose:** Provide users with a crystal-styled network telemetry widget showing real measured speed and latency.
- **Platform Reality & Honesty Requirement:** Chrome MV3 **does not** permit 24/7 execution when the browser is closed, and MV3 service workers suspend after ~30 seconds of idle time. No simulated or fabricated speed values may ever be presented.
- **Functional Requirements:**
  - `FR-SPD-01`: Display Download speed (Mbps), Upload speed (Mbps), Ping/Latency (ms), Last measurement timestamp, Connection status, Loading progress, and Error/Offline states.
  - `FR-SPD-02`: Manual "Run Speed Test" trigger directly from the widget.
  - `FR-SPD-03`: Periodic automatic measurements **only while Chrome is running and online**, scheduled via `chrome.alarms` (respecting Chrome's >=1 minute minimum and default conservative intervals: 15 min, 30 min, 60 min, or Manual Only) and/or foreground active-tab refresh if stale.
  - `FR-SPD-04`: Bandwidth-conscious bounded test payloads (e.g., configurable 1 MB–5 MB download probe, 512 KB–1 MB upload probe, lightweight RTT ping) with abort/timeout safeguards and metered-connection awareness (`navigator.connection?.saveData`).
  - `FR-SPD-05`: Explicit UI disclosure clarifying that monitoring runs periodically only while Chrome is open and requires user-approved measurement endpoint access.
- **Acceptance Criteria:**
  - Offline or blocked tests transition cleanly into a readable error state with retry action and preserve last known timestamped reading (marked stale).
  - Bandwidth consumed per test stays strictly within configured byte cap.

### J. Master Edit Mode (Visual Studio)
- **Purpose:** Transform the New Tab page into a precision drag-and-drop layout editor on demand.
- **Functional Requirements:**
  - `FR-EDT-01`: Single prominent **Edit / Customize** entry button toggles Master Edit Mode.
  - `FR-EDT-02`: Element interactions: Click select, Shift+click multi-select, marquee box multi-select, drag-to-reposition, 8-handle resize (with corner aspect-ratio lock option).
  - `FR-EDT-03`: Organization & arrangement: Group, Ungroup, Duplicate, Delete, Lock/Unlock, Bring Forward, Send Backward, Bring to Front, Send to Back.
  - `FR-EDT-04`: Precision layout tools: Align (Left, Center, Right, Top, Middle, Bottom), Distribute (Horizontally, Vertically), Snap-to-Grid (configurable grid size), Smart Alignment Guides (edges & centers against canvas and sibling elements).
  - `FR-EDT-05`: Clipboard & History: Copy/Paste elements (within workspace), Undo / Redo stack (minimum 50 steps in session), Keyboard shortcuts (`Delete`, `Ctrl+Z`, `Ctrl+Y`/`Ctrl+Shift+Z`, `Ctrl+C`, `Ctrl+V`, `Ctrl+D`, `Ctrl+G`, `Arrow` nudge 1px / `Shift+Arrow` 10px).
  - `FR-EDT-06`: Editor UI panels: Floating top/bottom action toolbar, right-side context-sensitive Properties Inspector, left/toggleable Layers Panel, and explicit **Save**, **Discard**, **Reset Layout** actions.
  - `FR-EDT-07`: **Transactional Draft/Saved Separation:** Editing mutates `editingDraft` in memory (with optional crash-recovery scratchpad) without overwriting `savedLayout`. Clicking **Save** atomically commits `editingDraft` to persistent storage and triggers orphaned asset cleanup; clicking **Discard** reverts all changes cleanly to `savedLayout`.
- **Acceptance Criteria:**
  - Opening a second New Tab during uncommitted editing renders `savedLayout` (not unsaved edits) unless explicitly saved.
  - Clicking Save persists all layout, style, and asset changes across New Tabs and full browser restarts.

### K. Settings, Personalization & Profiles
- **Functional Requirements:**
  - `FR-SET-01`: Centralized Settings Drawer/Modal organized into 10 sections: Appearance, Wallpaper, Layout, Widgets, Search, Typography, Navigation, Animations, Storage, Advanced.
  - `FR-SET-02`: Multi-profile support with starter presets: **Personal**, **Work**, **Study**, **Minimal**, **Creative**. Users can create, rename, duplicate, switch, and delete profiles.
  - `FR-SET-03`: Export and Import configuration bundles (JSON layout + preferences; optional local asset bundle export with validation and schema versioning).
  - `FR-SET-04`: Storage inspector showing indexedDB asset consumption, orphaned asset cleanup, and factory reset.

---

## 5. User Stories (Representative)

| ID | Role | User Story | Priority |
|---|---|---|---|
| `US-01` | Daily Browser User | As a user, I want my New Tab to open instantaneously with my saved clock, search bar, and wallpaper so my browsing flow never feels delayed. | P0 |
| `US-02` | Creative Customizer | As a user, I want to enter Edit Mode, upload a photo into a star or circle frame, resize it, and add a drop shadow so my workspace feels uniquely mine. | P0 |
| `US-03` | Aesthetic Enthusiast | As a user, I want to upload an animated GIF and place custom-font text beside it without the GIF turning into a static image. | P0 |
| `US-04` | Power User | As a user, I want to multi-select widgets, align them with smart guides, group them, and undo mistakes before committing Save. | P0 |
| `US-05` | Multi-Context User | As a user, I want separate Work and Personal profiles so I can switch between productivity shortcuts and minimal aesthetics in one click. | P1 |
| `US-06` | Network-Conscious User | As a user, I want to see real download/upload/ping speeds in a crystal widget and run manual checks without burning excessive data. | P1 |
| `US-07` | Privacy-Conscious User | As a user, I want all my images, shortcuts, and settings stored locally on my device with zero accounts or background tracking. | P0 |

---

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | Initial New Tab interactive render < 150 ms (warm) / < 300 ms (cold) for standard layouts; 60 fps drag/resize interactions; zero full-page rerenders on 1 Hz clock ticks. |
| **Reliability** | Atomic layout commits with schema versioning and corrupt-draft recovery; broken assets or failed widgets degrade gracefully without crashing the New Tab page. |
| **Security** | Strict MV3 CSP (`script-src 'self'`); magic-byte validation on all uploaded images, GIFs, and fonts; zero `eval`/`innerHTML` of user strings; URL scheme allowlisting. |
| **Privacy** | 100% local-first data storage; zero analytics SDKs; explicit disclosure and opt-in for any external network call (speed probe, optional live search suggestions). |
| **Accessibility** | WCAG 2.1 AA contrast compliance where achievable; full keyboard navigation in View and Edit modes; `prefers-reduced-motion` support; ARIA labels on all icon controls. |
| **Iconography** | Exclusive use of locally bundled **Google Material Symbols** across the entire application (zero Lucide/Font Awesome dependencies). |

---

## 7. Scope Definition

### MVP Scope (Phases 1–8 Target)
- Chrome MV3 New Tab override with instant local boot.
- Fixed Top Navigation (curated shortcuts, Gmail, Images, 6-dot Apps drawer, Profile link, visibility/style config, optional Chrome Bookmarks sync).
- Royal Crystal Design System (Dark, Light, System, Custom Accent, Wallpaper-adaptive contrast, Glass tokens).
- Full Master Edit Mode (all 20 editing operations, floating toolbar, inspector, layers, transactional Save/Discard, Undo/Redo).
- Core Elements: Clock & Date, Search Bar, Quick Shortcuts, Shaped Image Element (all 7 shapes + custom radius + crop/zoom/pan), Animated GIF Element (preserve animation + pause/play), Custom Text Element (system + uploaded fonts), Internet Speed Widget (manual + conservative periodic MV3 alarm checks).
- Multi-profile management (5 starter presets + custom CRUD), 10-category Settings UI, JSON/archive Export & Import.
- Automated Unit, Integration, Playwright E2E, and GitHub Actions CI.

### Future Enhancement Scope (Post-MVP / v1.1+)
- Additional optional widgets (Weather, Pomodoro Timer, Sticky Notes, Calendar Agenda, System/Tab Manager).
- Multi-breakpoint responsive layout overrides (distinct desktop vs compact-window coordinate maps).
- Optional peer-to-peer / user-owned encrypted backup sync (e.g., WebDAV / GitHub Gist / Google Drive user-owned file) — strictly opt-in.
- Plugin/Widget SDK for community crystal widgets.

