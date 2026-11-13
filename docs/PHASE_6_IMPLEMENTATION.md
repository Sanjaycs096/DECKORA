# PHASE 6 — BOOKMARKS, WORKSPACE PROFILES, PORTABILITY & ADAPTIVE THEMES

**Product:** AURORA — Your Personal Browser Workspace  
**Tagline:** _"Your Browser. Your Space."_  
**Phase Status:** Implementation Complete  
**Schema Version:** `5` (`CURRENT_SCHEMA_VERSION = 5`)

---

## 1. Phase 6 Deliverables & Roadmap Alignment

Phase 6 completes AURORA's workspace personalization, multi-context productivity, portability, and optional Chrome bookmarks integration across four cohesive subsystems:

1. **Opt-In Read-Only Chrome Bookmarks (`src/features/bookmarks/`):** Curated local workspace links remain active with zero permissions; optional Chrome `bookmarks` access reads the browser bookmark hierarchy locally via `chrome.bookmarks.getTree()` with real-time update listeners and instant revocation recovery.
2. **Multi-Profile Workspace Management (`src/features/profiles/`, `src/state/workspaceStore.ts`):** Independent profiles (`Personal`, `Work`, `Study`, `Minimal`, `Creative`, `Custom`) each own isolated layout elements, groups, wallpapers, themes, navigation toggles, search configuration, shortcuts, and background speed schedule.
3. **Self-Contained Portable Export & Transactional Import (`src/features/portability/`):** Zero-dependency standards-compliant `.aurora-bundle.zip` archive writer/reader embedding `manifest.json`, `workspace.json`, and local IndexedDB media/font binaries with SHA-256 verification and atomic transactional IndexedDB rollback on import failure.
4. **Local Adaptive Wallpaper Color Palettes (`src/features/theme/adaptivePalette.ts`, `src/design-system/themeEngine.ts`, `src/features/wallpaper/WallpaperDialog.tsx`):** Browser-local quantization of uploaded image/GIF wallpapers and solid/gradient presets into WCAG-guarded dominant/accent palettes with manual primary/secondary overrides and live preview inside Wallpaper Studio.

> **Roadmap Scope Alignment Note:** `docs/PHASE_0_ROADMAP.md` originally placed theme & adaptive color customization in Phase 6 and multi-profile workspaces + import/export in Phase 7. The approved Phase 6 implementation consolidates all four local personalization, portability, and bookmarks pillars ahead of Phase 7 polish/release hardening.

---

## 2. Schema Evolution (`v4 -> v5`) & Shared Asset Lifecycle

- **Schema Bump (`src/types/workspace.ts`, `src/services/storage/schemas.ts`):**
  - Updated `SchemaVersion = 5` and `CURRENT_SCHEMA_VERSION = 5`.
  - Extended `ExtractedWallpaperPalette` with `secondaryAccent`, `bgCanvas`, `surfaceTint`, `borderHighlight`, `contrastRatio`, `sourceSignature`, and `extractedAt` (maintaining backward compatibility with `v4` palettes).
  - Added optional `description?: string` on `WorkspaceProfile` metadata.
  - Added `persistedWorkspaceSchemaV4` and lossless migration in `validateAndMigrateWorkspace` upgrading `v1`, `v2`, `v3`, and `v4` workspaces cleanly to `v5` while preserving custom layouts, shortcuts, and preferences.
- **Profile-Aware Reference Collection (`src/services/assets/assetLifecycle.ts`):**
  - Exported `collectProfileAssetIds(profile)` shared across `collectReferencedAssetIds`, `deleteProfile`, and export scoping so assets shared across remaining profiles (for example via **Duplicate Profile**) are never deleted prematurely.

---

## 3. Module Breakdown

### 3.1 Opt-In Chrome Bookmarks (`src/features/bookmarks/`, ADR-009)
- **`public/manifest.json`:** Keeps `"bookmarks"` strictly inside `optional_permissions` alongside `"storage"`, `"favicon"`, `"alarms"` in required `permissions`.
- **`bookmarksPermissions.ts`:** User-action-only `requestBookmarksPermission()`, passive `checkBookmarksPermission()`, and `chrome.permissions.onRemoved` revocation subscription.
- **`bookmarksService.ts`:**
  - Read-only `chrome.bookmarks.getTree()` traversal producing immutable folder trees and indexed flat search entries.
  - Strictly enforces `sanitizeHttpUrl` (`http:` / `https:` only; strips `javascript:`, `data:`, `vbscript:`).
  - Subscribes cleanly to `onCreated`, `onRemoved`, `onChanged`, `onMoved`, `onChildrenReordered`, and `onImportEnded` with balanced unmount cleanup.
- **`BookmarksDrawer.tsx`:** Royal Crystal modal drawer accessible from `TopNavigation`. Always displays profile-scoped Curated Workspace Bookmarks (even without permission), plus an opt-in CTA for Chrome Bookmarks, breadcrumb folder navigation, live flat search, `_favicon` icons with letter fallback, current/new-tab open preference, and revocation recovery.

### 3.2 Multi-Profile Workspace Management (`src/features/profiles/`, `src/state/workspaceStore.ts`)
- **`profilePresets.ts`:**
  - Preset factories for `Personal`, `Work`, `Study`, `Minimal`, `Creative`, and `Custom` contexts with distinct Royal Crystal wallpapers, navigation preferences, shortcuts, and layout density.
  - `cloneProfileWithFreshIds` regenerates collision-free profile, element, and group IDs while keeping valid shared `assetId` references intact.
- **`workspaceStore.ts` Actions:**
  - `createProfile`, `renameProfile`, `duplicateProfile`, `switchProfile`, `deleteProfile` (blocks deleting the final remaining profile, updates `activeProfileId`, syncs theme tokens, reconciles background speed alarms, and runs unreferenced IndexedDB garbage collection), `replaceWorkspaceState`, and `setSyncChromeBookmarks`.
- **`ProfileManagerDialog.tsx` & `TopNavigation.tsx`:** Quick active profile dropdown switcher in the top navigation bar, plus a Profile Manager dialog guarded against destructive changes during active Master Edit Mode drafts and backed by explicit delete confirmation.

### 3.3 Portable Backup & Transactional Import (`src/features/portability/`)
- **`zipArchive.ts`:** Zero-dependency standards-compliant PKZIP (`DEFLATE` via `CompressionStream('deflate-raw')` with automatic `STORE` fallback + `DecompressionStream('deflate-raw')`, unsigned CRC-32 validation) with defense-in-depth hardening:
  - Rejects archive traversal (`..`, `\`, leading `/`, null bytes, duplicate entry paths), encrypted entries, multi-disk archives, and excessive entry counts (`> 2,500`).
  - Bounds total archive size (`100 MB`), total uncompressed output (`120 MB`), and per-entry decompressed bytes while inflating streams chunk-by-chunk.
- **`bundleFormat.ts` & `exportService.ts`:**
  - Produces `.aurora-bundle.zip` (`format: 'aurora-workspace-bundle'`, `formatVersion: 1`) containing `manifest.json`, `workspace.json`, and `assets/*`.
  - Scrubs ephemeral `speedCache` (`null`), strips unreferenced IndexedDB records, embeds SHA-256 digests + metadata, supports `AbortSignal` cancellation and stage callbacks, and runs post-build `readZipArchive` self-verification before delivering the download blob.
- **`importService.ts`:**
  - Multi-stage verification before touching persisted state: archive signature & bounds -> path whitelist (`manifest.json`, `workspace.json`, `assets/*`) -> strict Zod schema validation -> unsafe URL/`blob:` payload scan (`findUnsafeSerializedStrings`) -> schema migration (`v1..v5`) -> `validateLayoutIntegrity` & HTTP(S) check -> SHA-256 & byte-length verification -> **re-validation of decoded binaries via `validateMediaFile` and `validateFontFile`** to block SVG/XSS/corrupt files disguised as images/fonts -> IndexedDB quota check.
  - **Transactional Staging & Rollback:** Stages all imported binaries under newly minted `assetId`s before storage write; if staging or Chrome Storage commit fails, every newly staged IndexedDB blob/font is rolled back cleanly while leaving existing profiles and assets untouched.
  - Supports **Import as New Profile** (`import-as-new`), **Replace Active Profile** (`replace-profile`), and **Full Workspace Restore** (`restore-all`).
- **`PortabilityDialog.tsx`:** Royal Crystal Backup & Restore Studio featuring Export scope selection, stage progress with cancel button, pre-import manifest/profile/asset verification summary, mode selector, and mandatory overwrite warning confirmation before destructive replacement/restore.

### 3.4 Adaptive Wallpaper Palette & Theme Engine (`src/features/theme/`, `src/design-system/`, `src/features/wallpaper/`)
- **`adaptivePalette.ts`:**
  - Processes local `Blob` assets via offscreen bounded `<canvas>` (`max 64x64` sampling) with `createImageBitmap` / `Image` fallback and deterministic cleanup (`bitmap.close()`, `URL.revokeObjectURL`) — zero image bytes leave the device.
  - Extracts dominant, primary accent, and secondary accent hues from CSS hex stops on solid/gradient wallpapers cleanly.
  - Computes safe dark/light Royal Crystal background surfaces and runs iterative `ensureWcagContrast` adjustments so text-on-surface tokens meet WCAG AA (`>= 4.5:1`).
- **`themeEngine.ts` & `WallpaperDialog.tsx`:**
  - `resolveAppearanceMode` & `resolveThemePalette` apply extracted adaptive canvas/surface tokens when `useWallpaperAdaptivePalette` is active without sacrificing Royal Crystal contrast or manual Primary/Secondary accent overrides.
  - Extended `WallpaperDialog` with an **Adaptive Wallpaper Palette** panel supporting one-click Extract/Regenerate, Adaptive Switch, Live Preview, Dominant/Accent swatches + WCAG ratio badge, manual Primary & Secondary hex pickers, Revert Default Colors, and full Cancel rollback.

