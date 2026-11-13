# PHASE 2 — Implementation Documentation

**Product:** AURORA — Your Personal Browser Workspace  
**Phase:** Phase 2 — Default New Tab Experience & Fixed Navigation  
**Status:** Complete  

---

## 1. Overview

Phase 2 transforms the Phase 1 verification shell into the complete, responsive default New Tab workspace while preserving all Phase 1 architecture, design tokens, storage guardrails, and confirmed Architecture Decision Records (ADR-003, ADR-004, ADR-005, ADR-009).

The New Tab workspace (`src/app/App.tsx`) composes:
1. **Royal Crystal Ambient Background** (`src/components/shared/AuroraBackground.tsx`)
2. **Fixed Top Navigation Layer** (`src/features/navigation/TopNavigation.tsx`)
3. **Live Floating Clock & Date Widget** (`src/features/clock/LiveClock.tsx`)
4. **Zero-Permission Multi-Engine Search Bar** (`src/features/search/SearchBar.tsx`)
5. **Local Website Shortcuts Grid & CRUD Dialog** (`src/features/shortcuts/ShortcutsGrid.tsx`)

---

## 2. Phase 1 Foundation Reused

Phase 2 builds directly on the existing Phase 1 primitives and services:
- **UI Primitives (`src/components/ui/`):** `Button`, `IconButton`, `GlassPanel`, `Dialog`, `Input`, `SearchInput`, `TooltipProvider` / `Tooltip`, `ToastViewport` (`src/state/toastStore.ts`).
- **Typography & Icons (`src/components/shared/MaterialSymbol.tsx`):** Locally bundled `@fontsource-variable/inter`, `@fontsource-variable/manrope`, and `@fontsource-variable/material-symbols-rounded` (zero external icon fonts or CDNs).
- **Theme & Design System (`src/design-system/themeEngine.ts`, `src/hooks/useThemeSync.ts`, `src/styles/tokens.css`):** Centralized `--aurora-*` and `--glass-*` tokens driving Dark (`Midnight Royal`), Light (`Pearl Crystal`), and `System` adaptive themes.
- **Persistence & Validation (`src/services/storage/` & `src/state/workspaceStore.ts`):** `chromeStorageService` + Zod v4 schemas + `useWorkspaceStore` atomic persistence commits.

---

## 3. Data Model & Schema Migration (`v1 -> v2`)

Phase 2 increments the workspace schema version from `1` to `2` (`CURRENT_SCHEMA_VERSION = 2` in `src/services/storage/schemas.ts`):

- **Typed Element Props (`src/types/workspace.ts`):**
  - `ClockElementProps`: `hourFormat` (`'24h' | '12h'`), `showSeconds`, `showDate`, `showWeekday`.
  - `SearchElementProps`: `engine` (`'google' | 'bing' | 'duckduckgo' | 'custom'`), `customSearchUrlTemplate`, `placeholder`, `openInNewTab`, `showQuickEngineSwitcher`.
  - `ShortcutsElementProps`: `items` (`ShortcutItem[]`), `columns` (`'auto' | 4 | 6`), `showLabels`.
- **Default Phase 2 Elements (`src/services/storage/defaults.ts`):**
  - `DEFAULT_CLOCK_ELEMENT_ID` (`'aurora-clock-1'`), `DEFAULT_SEARCH_ELEMENT_ID` (`'aurora-search-1'`), `DEFAULT_SHORTCUTS_ELEMENT_ID` (`'aurora-shortcuts-1'`).
  - `DEFAULT_SHORTCUT_ITEMS`: 8 local curated shortcuts (YouTube, GitHub, Gmail, Google Drive, ChatGPT, LinkedIn, Stack Overflow, Google Calendar).
- **Automatic `v1 -> v2` Migration (`validateAndMigrateWorkspace` in `src/services/storage/schemas.ts`):**
  - Preserves existing user `theme`, `navigation`, `preferences`, `activeProfileId`, and profile metadata.
  - Seeds the default clock, search, and shortcuts layout elements for any v1 profile whose `layout.elements` was empty (`schemaVersion` bumped to `2`).
- **Store Mutation (`src/state/workspaceStore.ts`):**
  - Added `updateActiveProfileElementProps(elementId, propsPatch, service?)` for surgical persistence of per-widget settings (clock preferences, active search engine, shortcuts array).

---

## 4. Feature Architecture

### A. Fixed Top Navigation (`src/features/navigation/`)
- **`navDestinations.ts`:** Centralized navigation destination constants and the 10-service Google Apps launcher list (Search, Gmail, Maps, YouTube, Drive, Calendar, Photos, Translate, Docs, Sheets).
- **`TopNavigation.tsx`:**
  - **Left cluster:** Bookmarks (`chrome://bookmarks/`), Gmail (`https://mail.google.com/`), Images (`https://images.google.com/`), conditionally filtered by `navigation.showBookmarks`, `navigation.showGmail`, `navigation.showImages`.
  - **Bookmarks Handling:** Because Chrome restricts direct `<a href="chrome://bookmarks/">` navigation from extension pages, `openBookmarksManager()` uses `chrome.tabs.update({ url: 'chrome://bookmarks/' })` (zero extra permissions required) and triggers an informational toast in standalone `vite dev` web preview.
  - **Right cluster:** Theme cycle quick toggle (`dark` -> `light` -> `system`, persisted via `useThemeStore`), **Google Apps Grid** popover (`GoogleAppsPopover.tsx`), and Google Account shortcut (`https://myaccount.google.com/`).
- **`GoogleAppsPopover.tsx`:**
  - Keyboard-accessible popover with outside-click dismissal, `Escape` key dismissal with focus return to trigger, arrow-key/Tab focus containment, and 3-column Royal Crystal glass grid of Google services.

### B. Live Floating Clock & Date (`src/features/clock/`)
- **`clockFormat.ts`:** Deterministic date/time formatting helpers (`formatClockTime`, `formatClockDate`, `getMsUntilNextSecond`) supporting `24h` / `12h` (with AM/PM badge), `DD/MM/YYYY`, optional weekday, and optional seconds.
- **`LiveClock.tsx`:**
  - Uses an isolated component timer (`useState` + boundary-aligned recursive `setTimeout` ticking cleanly on second rollovers via `getMsUntilNextSecond`) so 1 Hz updates **never** re-render the parent workspace, search bar, or shortcuts grid.
  - Provides subtle inline hover/focus controls to toggle `24h`/`12h` format, seconds visibility, and weekday display—all persisted via `updateActiveProfileElementProps`.

### C. Zero-Permission Search Bar (`src/features/search/`)
- **`searchProviders.ts`:** Zero-network search URL builders for Google, Bing, DuckDuckGo, and user-defined Custom templates (`{query}` or appended `encodeURIComponent(query)`), guarded by `sanitizeHttpUrl` (`http:` / `https:` only).
- **`SearchBar.tsx`:**
  - Interactive provider selector chip (`Google` default), text input with clear button, and crystal submit button.
  - Global keyboard shortcuts: `/` or `Ctrl+K` / `⌘K` focuses and selects the search input (safely ignoring key presses inside existing inputs, textareas, selects, or `[contenteditable]`).
  - Inline custom URL template editor when `Custom` engine is active.
  - Complies strictly with **ADR-004** (zero suggestion endpoints or host permissions requested).

### D. Local Website Shortcuts (`src/features/shortcuts/`)
- **`shortcutUtils.ts`:** URL normalization (`normalizeShortcutUrl` defaults bare domains like `github.com` to `https://github.com/` while rejecting `javascript:`, `data:`, `file:`, and `chrome://` URLs in user shortcuts), label/domain helpers, and deterministic monogram hue fallback.
- **`ShortcutFavicon.tsx`:** Uses Chrome MV3 `/_favicon/?pageUrl=...&size=64` when running inside the Chrome extension context (`chrome.runtime.id`), cleanly falling back on load error or web preview to a crisp Royal Crystal initial monogram badge (`<a>` zero external network calls).
- **`ShortcutDialog.tsx` & `ShortcutsGrid.tsx`:** Responsive shortcut grid (`grid-cols-2 sm:grid-cols-4 lg:grid-cols-4`) supporting up to 24 local shortcuts, **Add shortcut**, per-tile overflow/hover **Edit** & **Remove** actions, and stateful persisted commits via `updateActiveProfileElementProps`.

### E. Error Isolation & Accessibility
- **`WidgetErrorBoundary.tsx`:** Each major New Tab widget (`LiveClock`, `SearchBar`, `ShortcutsGrid`) is wrapped in an independent React error boundary so a widget-level exception cannot blank the New Tab page or hide navigation/search.
- Semantic HTML landmarks (`<header>`, `<nav>`, `<main>`, `<footer>`), accessible `aria-label`s, `aria-expanded` / `aria-controls` on the Apps popover, visible `:focus-visible` focus rings (`--aurora-focus`), and full keyboard operability (`Tab`, `Escape`, `/`, `Ctrl+K`).

---

## 5. Known Phase 2 Limitations (By Design)

- Master Edit Mode, drag-and-drop free canvas positioning, snap grids/guides, multi-selection, grouping, resize handles, layer stack, undo/redo, custom wallpaper upload/crop, shaped image/GIF/custom text elements, live internet speed monitor, and opt-in Chrome bookmark synchronization remain deferred to **Phases 3–7**.
- Because Phase 2 does not include the wallpaper upload picker yet, `AuroraBackground` renders the Royal Crystal layered mesh gradients for Dark and Light modes.

