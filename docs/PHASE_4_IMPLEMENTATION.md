# PHASE 4 — VISUAL CUSTOMIZATION, WALLPAPERS, IMAGE OBJECTS, ANIMATED GIFs & CUSTOM TEXT

**Product:** AURORA — Your Personal Browser Workspace  
**Tagline:** *"Your Browser. Your Space."*  
**Phase Status:** Implementation Complete  
**Schema Version:** `3` (`CURRENT_SCHEMA_VERSION = 3`)

---

## 1. Phase 4 Deliverables Summary

Phase 4 transforms AURORA from a structured widget layout canvas into a deeply customizable personal workspace by adding local-first wallpaper customization, multi-shape uploaded Image Objects, untouched animated GIF elements, and customizable plain-text typography blocks—while keeping 100% of binary media inside IndexedDB and preserving transactional Save/Discard isolation inside Master Edit Mode.

---

## 2. Schema Evolution (`v2 -> v3`) & Architecture Compliance

### 2.1 Storage Schema & Migrations (`src/services/storage/schemas.ts`, `src/types/workspace.ts`)
- Bumped `CURRENT_SCHEMA_VERSION` from `2` to `3`.
- Extended `WallpaperConfig` (`wallpaperConfigSchema`) with:
  - `position`: `'center' | 'top' | 'bottom' | 'left' | 'right' | 'custom'`
  - `focalXPct`: `0..100`
  - `focalYPct`: `0..100`
  - `vignettePct`: `0..80`
- Added typed element property schemas and resilient fallback parsers:
  - `imagePropsSchema` & `parseImageProps`
  - `gifPropsSchema` & `parseGifProps`
  - `textPropsSchema` & `parseTextProps`
- Implemented lossless automatic migrations inside `validateAndMigrateWorkspace`:
  - `v1 -> v3`: preserves theme settings, upgrades wallpaper to `v3` focal defaults, and seeds default widgets for empty Phase 1 layouts.
  - `v2 -> v3`: upgrades existing wallpaper presets and maps legacy anchor `position` values (`left`, `right`, `top`, `bottom`, `center`) directly into `focalXPct` / `focalYPct` coordinates.

### 2.2 Storage Separation (`ADR-002`)
- `chrome.storage.local` stores strictly lightweight JSON metadata (`assetId`, `uploadedFontAssetId`, crops, styles, typography, wallpaper parameters).
- `aurora-assets-db` (IndexedDB v1) stores all raw binary buffers (`assets`, `asset_metadata`, and `fonts` stores) with explicit `QUOTA_EXCEEDED` error detection in `AssetStorageError`.

---

## 3. Media Validation & Security (`ADR-003`)

Implemented in `src/services/assets/mediaValidation.ts`:
- **Magic-Byte Inspection:** Every file's header bytes are verified before ingestion:
  - **Raster Images (`wallpaper`, `image`):** PNG (`89 50 4E 47`), JPEG (`FF D8 FF`), WebP (`RIFF....WEBP`), AVIF (`ftypavif` / `ftypavis`).
  - **Animated GIFs (`gif`):** Strictly `GIF87a` and `GIF89a`.
  - **Custom Fonts (`font`):** Strictly `WOFF2` (`wOF2`) and `WOFF` (`wOFF`).
- **Explicit Exclusions:** `.svg` files and spoofed XML/`<svg` markup payloads are rejected immediately with `MediaValidationError('SVG_EXCLUDED')`.
- **Format & Limit Guards:**
  - Wallpaper: max `15 MB`, `7680×4320` px.
  - Image Object: max `10 MB`, `6000×6000` px; animated GIFs uploaded into Image picker are redirected with a clear message toward **Add GIF**.
  - Animated GIF: max `15 MB`, `2400×2400` px; stored unmodified without transcoding or frame dropping.
  - Custom Font: max `5 MB`, validated via `FontFace` loading before commit.

---

## 4. ObjectURL Lifecycle & Transactional Garbage Collection

- **`src/services/assets/assetUrlManager.ts` & `src/hooks/useAssetObjectUrl.ts`:**
  - Reference-counted `Map<assetId, { url, refCount }>` cache deduplicates concurrent reads and shares a single `Blob` URL across duplicated elements referencing the same `assetId`.
  - `URL.revokeObjectURL` executes automatically only once the last mounted consumer releases its reference (`refCount <= 0`).
  - Object URLs remain strictly runtime-only and are never persisted.
- **`src/services/assets/assetLifecycle.ts`:**
  - `collectReferencedAssetIds` walks **all workspace profiles**, active wallpaper configs, profile avatars, canvas elements (`props.assetId` and `props.uploadedFontAssetId`), and `globalSettings.customFonts`.
  - **Edit Mode Transactional Behavior (`src/state/editorSessionStore.ts`):**
    - Uploads during Edit Mode append to `pendingUploadedAssetIds`; deleted/replaced saved elements record IDs into `retiredAssetIds`.
    - `draftTheme` updates live previews across `AuroraBackground` and `useThemeSync` without altering `savedWorkspace`.
    - **On Discard:** `savedWorkspace` & `useThemeStore` are restored intact, and only truly unreferenced `pendingUploadedAssetIds` are deleted from IndexedDB.
    - **On Save:** `verifySpecificAssetIdsExist` checks newly uploaded referenced assets exist in IndexedDB; `chromeStorageService.writeWorkspace` runs **first**; only after persistence succeeds are unreferenced candidate orphans purged from IndexedDB.

---

## 5. Features Implemented

### 5.1 Wallpaper & Background Customization (`src/features/wallpaper/WallpaperDialog.tsx`, `src/components/shared/AuroraBackground.tsx`)
- Accessible from both **View Mode** Top Navigation (saves immediately) and **Master Edit Mode** Toolbar / Canvas Inspector (transactional draft preview + Save/Discard isolation).
- Supports local image upload with pre-apply preview, Fit (`cover` / `contain` / `fill`), Position presets + custom `focalXPct`/`focalYPct` sliders, Blur (`0–40 px`), Dim Scrim (`0–80%`), Vignette (`0–80%`), Tint Color Overlay (`0–75%`), **Contrast-Safe Scrim** one-click helper, 6 curated Crystal gradients, Solid colors / swatches, None fallback, and Restore Default.

### 5.2 Image Objects (`src/features/elements/ImageElementRenderer.tsx`)
- Renders PNG, JPEG, WebP, and AVIF images across **8 geometric shapes**: `square`, `rectangle`, `rounded-rect`, `circle`, `oval`, `diamond`, `star` (`4–12` configurable points), and `custom-rounded` (`[TL, TR, BR, BL]` independent corner radii).
- Complex polygons (`diamond`, `star`) follow ADR-006: SVG `clipPathUnits="objectBoundingBox"` masking paired with an outer `drop-shadow` wrapper and crisp non-scaling vector border stroke overlay.
- Non-destructive crop (`zoom` 1×–3×, `panXPct`, `panYPct`, `cover`/`contain`), shared `assetId` duplication without binary duplication, and graceful missing-asset fallback card.

### 5.3 Animated GIF Elements (`src/features/elements/GifElementRenderer.tsx`)
- Native `<img>` rendering preserving original `GIF87a`/`GIF89a` loops untouched, with `loading="lazy"`.
- Rectangular framing (border width/color/style, corner radius, shadow, opacity, `cover`/`contain`).
- Honest Play / Pause / Replay hover controls utilizing transient offscreen `<canvas>` frame capture (and accessible fallback pause overlay when canvas capture is unavailable or `prefers-reduced-motion` is active), without mutating persisted binaries.

### 5.4 Custom Text Elements (`src/features/elements/TextElementRenderer.tsx`, `src/hooks/useCustomFontsSync.ts`)
- Strictly escaped React plain-text rendering (`whitespace-pre-wrap break-words`, zero `dangerouslySetInnerHTML`).
- Bundled `Inter Variable`, `Manrope Variable`, curated system sans/serif/monospace stacks, and optional user-uploaded `.woff2`/`.woff` custom fonts registered cleanly into `document.fonts`.
- Full typography and container Inspector controls (`fontSizePx`, `fontWeight`, `italic`, `underline`, `color`, `opacity`, `alignment`, `letterSpacingEm`, `lineHeight`, `textShadow`, `backgroundStyle`, `backgroundColor`/`backgroundOpacity`, padding, border, shadow, and direct multiline text editing).

### 5.5 Editor UX & Inspector (`EditorToolbar.tsx`, `AddElementDialogs.tsx`, `ElementInspectorSections.tsx`, `PropertiesInspector.tsx`, `LayersPanel.tsx`)
- Added **Add** dropdown (`Add Image Object`, `Add Animated GIF`, `Add Custom Text`) and **Wallpaper** quick button to the Edit Mode Toolbar.
- Extended Properties Inspector with context-aware **Image Shape & Crop**, **Animated GIF**, **Text Typography**, and **Appearance & Frame** panels—each participating cleanly in Edit Mode's bounded 50-entry Undo/Redo stack.

