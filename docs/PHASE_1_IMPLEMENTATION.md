# PHASE 1 — Implementation Documentation

**Product:** AURORA — Your Personal Browser Workspace  
**Phase:** Phase 1 — Extension Foundation & Design System  
**Status:** Complete  

---

## 1. Architecture & Build Decisions

### Multi-Entry Vite MV3 Build vs. `@crxjs/vite-plugin`
- **Decision:** Implemented a deterministic **multi-entry Vite 8 MV3 build** (`vite.config.ts`) compiling `newtab.html` and `src/background/service-worker.ts` (`dist/background.js`) alongside static MV3 assets in `public/` (`manifest.json`, PNG icons, font license attribution).
- **Reasoning:** Avoids beta plugin incompatibility with Vite 8 and React 19 on Windows while emitting a clean, predictable `dist/` unpacked extension bundle with zero `eval` or inline scripts (`script-src 'self'; object-src 'self'`).

### Confirmed Phase 0 ADR Alignment
- **ADR-003:** Asset foundation supports PNG, JPEG, WebP, AVIF, and GIF; raw SVG uploads are excluded.
- **ADR-004:** Zero host permissions for search at install; live search suggestions are declared under `optional_host_permissions`.
- **ADR-005:** Speed test host (`https://speed.cloudflare.com/*`) is declared under `optional_host_permissions`, never requested at install.
- **ADR-009:** Curated bookmarks require zero permissions; `bookmarks` and `search` are declared under `optional_permissions`.

---

## 2. Extension Foundation (`public/manifest.json` & Entry Points)

- **`chrome_url_overrides.newtab`:** `newtab.html` -> `src/main.tsx` -> `src/app/App.tsx` (Phase 1 Foundation Verification Shell).
- **`background.service_worker`:** `background.js` (`src/background/service-worker.ts`, `type: "module"`), strictly scoped to `chrome.runtime.onInstalled` schema initialization.
- **Required Permissions:** `storage`, `favicon`, `alarms`.
- **Optional Permissions:** `bookmarks`, `search`, and opt-in host permissions (`speed.cloudflare.com`, suggestion endpoints).

---

## 3. Design System & Typography Implementation

### Royal Crystal Tokens (`src/styles/tokens.css`, `src/design-system/tokens.ts`)
- Centralized CSS variables (`--aurora-*`) and glassmorphism tokens (`--glass-*`) built from the approved seed palette (`#101827`, `#19283C`, `#243B55`, `#75CFFF`, `#A78BFA`, `#E5EAF2`).
- Supports **Dark (`Midnight Royal`)**, **Light (`Pearl Crystal`)**, **System (`prefers-color-scheme`)**, and custom accent contrast derivation (`src/design-system/themeEngine.ts`).
- Includes `@supports not (backdrop-filter: blur(1px))` solid surface fallback and `@media (prefers-reduced-motion: reduce)` timing overrides.

### Local Typography & Exclusive Material Symbols (`src/styles/index.css`, `src/components/shared/MaterialSymbol.tsx`)
- Locally bundled WOFF2 variable fonts via `@fontsource-variable/inter`, `@fontsource-variable/manrope`, and `@fontsource-variable/material-symbols-rounded` (`public/fonts/LICENSES.md`).
- Zero external font/icon CDNs.
- ESLint `no-restricted-imports` rule in `eslint.config.js` strictly blocks `lucide-react`, `@fortawesome/*`, `react-icons`, `@heroicons/*`, `@tabler/icons-react`, and `feather-icons`.

---

## 4. Reusable UI Primitives (`src/components/ui/`)

Built on Radix UI + `class-variance-authority` + `tailwind-merge` using `<MaterialSymbol />` exclusively:
- `Button`, `IconButton`, `Input`, `SearchInput`, `GlassPanel`, `Tooltip`, `Dialog`, `Dropdown`, `Switch`, `Slider`, `Tabs`, `ToastViewport` (`src/state/toastStore.ts`), `LoadingIndicator`, `Skeleton`, `SettingsSection`.

---

## 5. Storage & State Separation

### Chrome Storage (`src/services/storage/`)
- `chromeStorageService.ts` wraps `chrome.storage.local` with Zod v4 validation (`schemas.ts`), deterministic v1 defaults (`defaults.ts`), schema migration entrypoint (`validateAndMigrateWorkspace`), corruption recovery, and a strict `512 KB` payload guardrail rejecting oversized/binary metadata writes.
- Includes a seamless localStorage/in-memory fallback adapter for Vite web preview (`pnpm dev`) and Vitest runs outside Chrome extension APIs.

### IndexedDB (`src/services/assets/assetDb.ts`)
- `aurora-assets-db` (version 1) powered by `idb` with three object stores:
  - `assets` (indexed by `kind`) storing binary `ArrayBuffer` payloads + `mimeType` for lossless Blob reconstruction (`new Blob([bytes], { type })`).
  - `asset_metadata` (indexed by `kind`) storing `AssetMetadata`.
  - `fonts` storing uploaded font `ArrayBuffer` records.
- Implements `initAssetDb`, `addAsset`, `readAsset`, `updateAssetMetadata`, `deleteAsset`, `listAssets`, `addFont`, `readFont`, and typed `AssetStorageError` handling.

### State Ownership (`src/state/`)
- `workspaceStore.ts`: Persisted `PersistedWorkspaceState` hydration and commits.
- `themeStore.ts`: Active `ThemeConfig`, resolved `'dark' | 'light'` mode, and semantic tokens.
- `preferencesStore.ts`: Application `GlobalPreferences`.
- `editorSessionStore.ts`: Phase 3 ownership boundary placeholder (`isEditing: false`).
- `toastStore.ts`: Ephemeral UI notifications.

---

## 6. Known Phase 1 Limitations (By Design)

- The New Tab page (`src/app/App.tsx`) renders the **Phase 1 Foundation Verification Shell** rather than the complete workspace dashboard.
- Top Navigation bar, Master Edit Mode, canvas engine, shaped image renderer, GIF element, custom text element, clock, search bar, shortcuts, speed monitor, and full profile manager are intentionally deferred to Phases 2–7.
- `@fontsource-variable/material-symbols-rounded` full variable font (`~5.4 MB` WOFF2) includes all glyph axes locally; icon subsetting can be evaluated in Phase 7 if extension archive size optimization is desired.

