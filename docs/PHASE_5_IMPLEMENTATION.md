# PHASE 5 — CLOCK, SEARCH, SHORTCUTS AUDIT & INTERNET SPEED MONITOR

**Product:** AURORA — Your Personal Browser Workspace  
**Tagline:** *"Your Browser. Your Space."*  
**Phase Status:** Implementation Complete  
**Schema Version:** `4` (`CURRENT_SCHEMA_VERSION = 4`)

---

## 1. Phase 5 Deliverables Summary

Phase 5 audits and strengthens AURORA's three core Phase 2 productivity widgets (**Live Clock**, **Search Bar**, and **Shortcuts Grid**), exposes full customization controls inside Master Edit Mode's Properties Inspector, and delivers the primary Phase 5 feature: a privacy-first, permission-gated **Internet Speed Monitor** powered by real bounded Cloudflare probes and optional MV3 background scheduling.

---

## 2. Schema Evolution (`v3 -> v4`) & Architecture Compliance

### 2.1 Storage Schema & Migrations (`src/types/workspace.ts`, `src/services/storage/schemas.ts`, `src/services/storage/defaults.ts`)
- Bumped `CURRENT_SCHEMA_VERSION` from `3` to `4`.
- Extended element property models cleanly with safe Zod defaults:
  - `ClockElementProps` (`clockPropsSchema`): added `fontFamily`, `fontSizePx`, `fontWeight`, `letterSpacingEm`, `color`, `alignment` (`left` / `center` / `right`), and `containerStyle` (`floating` / `crystal`).
  - `SearchElementProps` (`searchPropsSchema`): added `showEngineSelector`, `showSearchIcon`, `showClearButton`, `visualStyle` (`glass` / `solid`), `focusShortcut` (`/` / `ctrl+k` / `both` / `none`), `enableLocalHistory` (`false` by default), and `recentQueries` (max 8 strings).
  - `ShortcutsElementProps` (`shortcutsPropsSchema`): added `iconShape` (`squircle` / `circle` / `square`), `density` (`comfortable` / `compact`), `columns` (`auto` / `3` / `4` / `5` / `6`), and partial-override safe `parseShortcutsProps`.
  - Added `SpeedElementProps` (`speedPropsSchema`) and default widget (`DEFAULT_SPEED_ELEMENT_ID = 'el-speed-default'`) seeded into `createDefaultCanvasElements()` in non-overlapping canvas coordinates.
  - Upgraded `PersistedWorkspaceState.speedCache` to structured `SpeedCacheState` (`status`, `phase`, `isRunning`, `runningStartedAt`, `lastAttemptAt`, `lastSuccessfulResult`, `errorMessage`).
- Lossless migration in `validateAndMigrateWorkspace`:
  - `v1 -> v4`, `v2 -> v4`, and `v3 -> v4` preserve existing custom user layouts untouched while upgrading legacy `speedCache` entries cleanly.

---

## 3. Core Widget Audit & Strengthening

### 3.1 Live Clock (`src/features/clock/clockFormat.ts`, `useClockNow.ts`, `LiveClock.tsx`)
- **Shared Render-Isolated Timer:** Consolidated all clock tick timers into a single shared wall-clock scheduler (`useClockNow.ts`) aligned to exact 1-second or 60-second boundaries, feeding a `React.memo`-isolated `<ClockDigitsDisplay />` leaf so 1-second ticks never trigger re-renders across sibling canvas widgets.
- **Timezone Validation & Display:** Added `CURATED_TIMEZONES` presets plus arbitrary IANA timezone validation (`validateTimeZone`) via `Intl.DateTimeFormat`, surfacing a compact non-local city badge (`title` with full IANA zone) and explicit fallback indicator on invalid inputs.
- **Surface & Edit Preview Safety:** Supports floating borderless and Royal Crystal card container modes, alignment, digit size/color/weight customization, and hides interactive hover dropdown controls while `editPreview` is active.

### 3.2 Multi-Engine Search Bar (`src/features/search/searchProviders.ts`, `SearchBar.tsx`)
- **Hardened Custom Search Template Validation:** Rejects unsafe URL schemes and malformed placeholder host templates (`validateCustomSearchTemplate`), allowing valid `http`/`https` templates containing `{query}`.
- **100% Local Offline Suggestions (ADR-004):** Added a keyboard-navigable (`ArrowUp` / `ArrowDown` / `Enter` / `Escape`) suggestion popover matching pinned workspace shortcuts first, followed by **opt-in** on-device recent queries (`enableLocalHistory: false` by default) with per-item deletion and clear-history controls—never making network autocomplete requests.
- **Configurable Chrome & Shortcuts:** Wired `visualStyle` (`glass` vs `solid`), configurable `focusShortcut` (`/` / `ctrl+k` / `both` / `none`), and visibility toggles for engine selector, search icon, and clear button.

### 3.3 Quick Shortcuts Grid (`src/features/shortcuts/shortcutUtils.ts`, `ShortcutDialog.tsx`, `ShortcutFavicon.tsx`, `ShortcutsGrid.tsx`)
- **Normalized Duplicate Detection:** Added `normalizeShortcutUrl` to detect duplicate shortcut URLs cleanly on Add while excluding the edited shortcut (`excludeId`) during Edit.
- **Tab Behavior Fix:** Wired `openInNewTab` directly to rendered `<a>` links (`target="_blank"` with `rel="noopener noreferrer"`).
- **Favicon Recovery Fix:** Replaced sticky boolean error state in `ShortcutFavicon` with `failedUrl`-keyed fallback tracking so updating a shortcut's URL immediately re-attempts favicon loading cleanly.
- **Layout & Density Options:** Supports `squircle`, `circle`, and `square` tile geometry, `comfortable` vs `compact` spacing, and explicit `auto` or `3–6` column grids.

---

## 4. Internet Speed Monitor (`src/features/speed/`, `src/background/`)

### 4.1 Explicit Opt-In Permission Gate (`speedPermissions.ts`, `ADR-005`)
- Declares `https://speed.cloudflare.com/*` strictly under `optional_host_permissions` in `public/manifest.json`.
- Zero probes or permission prompts execute automatically at install or initial New Tab load.
- Ungranted state renders a non-intrusive card explaining Cloudflare speed probes with an explicit **Enable Speed Test** button triggering `chrome.permissions.request`. Declining permission stays quiet without modal nagging or fabricated results.

### 4.2 Bounded Cloudflare Measurement Engine & Coordinator (`speedEngine.ts`, `speedCoordinator.ts`)
- **Honest Sequential Probes:**
  1. **Latency & Jitter (`ping`):** 3 sequential zero-byte `GET https://speed.cloudflare.com/__down?bytes=0` probes computing median latency (`pingMs`) and average sample delta (`jitterMs`).
  2. **Download (`download`):** Bounded `GET https://speed.cloudflare.com/__down?bytes=<size>` (`1 MB` / `2 MB` [default] / `5 MB`).
  3. **Upload (`upload`):** Bounded `POST https://speed.cloudflare.com/__up` (`512 KB` [default] / `1 MB`).
- **Resilience & State Integrity:**
  - Enforces 15s `AbortController` phase timeouts, immediate `navigator.onLine === false` short-circuiting (`offline`), and `navigator.connection.saveData` background alarm skipping.
  - Prevents overlapping runs via an in-process single-flight promise lock plus `90_000ms` stale persisted running lock recovery.
  - Distinguishes `idle`, `testing`, `completed`, `failed`, `offline`, and `permission-required` states while **strictly preserving `lastSuccessfulResult`** across subsequent failures, offline states, or permission revocation.

### 4.3 Background Scheduling & Live Sync (`src/background/speedScheduler.ts`, `service-worker.ts`, `workspaceStore.ts`, `App.tsx`)
- Supports `0` (Manual Only default), `15`, `30`, and `60`-minute intervals via `chrome.alarms` (`AURORA_SPEED_ALARM_NAME = 'aurora-speed-monitor'`).
- Reconciles alarms safely on extension install/startup, workspace commit, profile switch, reset, storage changes, and `chrome.permissions.onRemoved` revocation without duplicate alarm registrations.
- Syncs completed background measurements into open New Tab views via `chrome.storage.onChanged` -> `syncFromExternalStorage`, respecting active Master Edit Mode draft sessions without overwriting unsaved user edits.

---

## 5. Master Edit Mode & Inspector Integration

- **`src/features/elements/createPresetWidget.ts` & `EditorToolbar.tsx`:** Added **Add Speed Monitor**, **Add Clock Widget**, **Add Search Bar**, and **Add Shortcuts Grid** directly into the Edit Mode **Add** menu.
- **`src/features/editor/ElementInspectorSections.tsx` & `PropertiesInspector.tsx`:** Added `ClockInspectorSection`, `SearchInspectorSection`, `ShortcutsInspectorSection`, and `SpeedInspectorSection`, plus `ElementStyleInspectorSection` (`Corner Radius`, opacity, shadow, border) support for Speed Monitor widgets. Every edit participates cleanly in transactional Save/Discard isolation and Undo/Redo history.

