# Phase 6.2 Implementation Notes — DECKORA Rebranding, Logo System, Google Navigation & Bookmark Flyout

**Project:** DECKORA — Your Personal Browser Workspace  
**Previous Identity:** AURORA  
**Status:** Completed  
**Design System:** Royal Crystal  

---

## 1. Complete AURORA → DECKORA Rebranding & Compatibility Preservation

### User-Facing Identity & Manifest Updates
- Updated [`public/manifest.json`](../public/manifest.json) to `"name": "DECKORA — Your Personal Browser Workspace"`, `"short_name": "DECKORA"`, tagline description, and `icons/deckora-{16,32,48,128}.png`.
- Updated [`newtab.html`](../newtab.html) title (`New Tab — DECKORA`) and local 32px PNG favicon link.
- Updated [`package.json`](../package.json) package name (`deckora-newtab-extension`) and description.
- Updated [`public/fonts/LICENSES.md`](../public/fonts/LICENSES.md), [`README.md`](../README.md), and all UI/dialog copy across Bookmarks, Shortcuts, Speed Monitor, Backup/Restore, and diagnostic console prefixes (`[DECKORA SW]`, `[DECKORA Fonts]`, `[DECKORA GC]`, `[DECKORA WidgetErrorBoundary]`).

### Official Royal Crystal Palette Alignment
Aligned [`src/design-system/tokens.ts`](../src/design-system/tokens.ts), [`src/styles/tokens.css`](../src/styles/tokens.css), [`src/design-system/themeEngine.ts`](../src/design-system/themeEngine.ts), [`src/components/shared/AuroraBackground.tsx`](../src/components/shared/AuroraBackground.tsx), [`src/features/theme/adaptivePalette.ts`](../src/features/theme/adaptivePalette.ts), [`src/features/wallpaper/WallpaperDialog.tsx`](../src/features/wallpaper/WallpaperDialog.tsx), and [`src/services/storage/defaults.ts`](../src/services/storage/defaults.ts) with `DECKORA_SEED_PALETTE`:
- Midnight Navy: `#0B1220`
- Royal Slate: `#1E2A44`
- Ice Blue: `#7FD3F7`
- Violet: `#8B7CF6`
- Emerald: `#34D399`
- Ice White: `#EAF4FF`

### Backward Compatibility Guaranteed
- Preserved persistent storage key (`aurora_workspace_v1`), IndexedDB database name (`aurora-assets-db`), alarm name (`aurora-speed-monitor`), CSS variable names (`--aurora-*`), and existing preset IDs (`arctic-aurora`) so existing users retain saved layouts and media without migration friction.
- Updated [`src/features/portability/bundleFormat.ts`](../src/features/portability/bundleFormat.ts), [`exportService.ts`](../src/features/portability/exportService.ts), and [`PortabilityDialog.tsx`](../src/features/portability/PortabilityDialog.tsx) to export `.deckora-bundle.zip` (`deckora-workspace-bundle` + `deckoraAppVersion`) while accepting **both** `.deckora-bundle.zip` and legacy `.aurora-bundle.zip` (`aurora-workspace-bundle` + `auroraAppVersion`) during validation and import.

---

## 2. DECKORA Brand & Logo System ("The Layered D")

> **Design Note:** Because no external approved Deckora logo artwork existed in the workspace, the assets below represent an initial bespoke vector interpretation designed strictly around **The Layered D** concept and the Royal Crystal palette, rather than a final external designer sign-off.

- **Concept:** Geometric capital **D** constructed from 3 layered spatial planes (Violet depth slice, Royal Slate bevel, luminous Ice White → Ice Blue crystal foreground), an open negative-space counter, a subtle horizon edge highlight, and an Emerald precision accent node, paired with uppercase **Manrope ExtraBold** (`800`) wordmark typography with expanded letter-spacing.
- **Reusable Component:** [`src/components/brand/DeckoraLogo.tsx`](../src/components/brand/DeckoraLogo.tsx) supports `variant="full" | "symbol"`, `tone="brand" | "mono-white" | "mono-dark" | "light"`, `size="sm" | "md" | "lg"`, and optional tagline.
- **About Showcase:** [`src/components/brand/DeckoraAboutDialog.tsx`](../src/components/brand/DeckoraAboutDialog.tsx) displays the identity, palette swatches, and logo variants from the header's top-left `About Deckora` pill.
- **Local Vector & PNG Assets:**
  - `public/brand/deckora-symbol.svg`
  - `public/brand/deckora-logo-horizontal.svg`
  - `public/brand/deckora-logo-mono-white.svg`
  - `public/brand/deckora-logo-mono-dark.svg`
  - `public/brand/deckora-logo-light.svg`
  - `public/brand/deckora-cws-promo-440x280.svg`
  - `public/brand/deckora-cws-marquee-1400x560.svg`
  - `public/icons/deckora-16.png` (simplified thick high-contrast geometry for 16px toolbar/favicon legibility), `deckora-32.png`, `deckora-48.png`, `deckora-128.png` (legacy `aurora-*.png` removed).

---

## 3. Footer Removal & Full-Viewport Verification

- Audited View Mode (`WorkspaceViewCanvas.tsx`), Edit Mode (`EditableCanvasStage.tsx`), `App.tsx`, and global styles: confirmed zero `<footer>` elements, zero pseudoelement attribution strips, and zero reserved bottom margins.
- Switched desktop canvas sizing from `100vh - 3.5rem` to `h-[calc(100dvh-3.5rem)]` so both View Mode and Edit Mode reclaim the complete viewport cleanly underneath the fixed `56px` (`h-14`) top header. (Chrome's built-in bottom-right *"Customize Chrome"* browser chip remains outside extension DOM scope.)

---

## 4. Categorized, Searchable Google Apps Launcher & Avatar-Only Account Access

- **Google Apps Popover (`src/features/navigation/GoogleAppsPopover.tsx`, `navDestinations.ts`):**
  - Anchored to the 6-dot `apps` trigger button with locally bundled **Material Symbols Rounded** glyphs only.
  - Organized into 4 searchable groups:
    1. **Core:** Search, Gmail, Account, Drive, Calendar, Contacts, Keep, Tasks
    2. **Productivity:** Docs, Sheets, Slides, Forms, Sites, Meet, Chat
    3. **Media & Discovery:** YouTube, Photos, Maps, News, Play, Books, Arts & Culture
    4. **Learning & Tools:** Classroom, Earth, Translate, Scholar, Finance, Flights, Shopping
  - Supports live instant search filtering, scrollable responsive layout, Escape dismissal with trigger focus return, click-outside dismissal, zero OAuth/host permissions, and clean HTTPS navigation (`target="_blank"` by default when not intercepted by test spy `onNavigate`).
- **Avatar-Only Google Account Link (`src/features/navigation/TopNavigation.tsx`):**
  - Renders solely as a `36px × 36px` (`h-9 w-9`) circular avatar button (`aria-label="Google Account"`) linking to `https://myaccount.google.com/` with zero adjacent user-name text, email address, or claims of Chrome account detection.

---

## 5. Bookmarks: Left Folder Sidebar with Hover Flyout

- Refactored [`src/features/bookmarks/BookmarksDrawer.tsx`](../src/features/bookmarks/BookmarksDrawer.tsx) from a centered modal into a top-left floating panel (`fixed top-16 left-4 sm:left-6 z-[70]`) anchored cleanly below the header.
- **Folder-First Initial View:** Unwraps Chrome's system containers (`Bookmarks bar`, `Other bookmarks`, `Mobile bookmarks`) via `getInitialMainFolders` and renders dynamic top-level user folders only, each displaying folder icon, title, and recursive descendant bookmark count (excluding folder nodes).
- **Hover + Click Flyout:** Moving over a folder (for non-touch pointers) or clicking/keyboard-selecting highlights the row and opens an adjacent right-hand floating flyout showing that folder's bookmarks (with Chrome `_favicon` or monogram fallback) and nested subfolders. Shared wrapper + leave grace timer allows seamless pointer travel between sidebar and flyout.
- **Pinning, Subfolder Navigation & Keyboard Accessibility:** Clicking pins a folder (`aria-current="true"`); nested subfolders support breadcrumb + `"Back to parent folder"` navigation inside the flyout; `"Back to folders"` collapses back to folder-only view; ArrowUp/ArrowDown/ArrowRight/ArrowLeft, Escape (returns focus to Bookmarks button), and outside clicks work cleanly. Preserves opt-in `chrome.bookmarks` gating, live event updates, zero mutations, and Curated Workspace Links.

---

## 6. Edit Mode Toolbar Icons Clarification (Group & Ungroup)

Inspected [`src/features/editor/EditorToolbar.tsx`](../src/features/editor/EditorToolbar.tsx) (`lines 260–284`) to clarify the two icons in the central Canvas Actions toolbar:
1. **`group_work` (circle enclosing 3 nodes):** **Group Selected Elements** (`groupSelection`, shortcut `Ctrl+G`). Enabled when `>= 2` unlocked elements are selected (`canGroup`). Wraps selection in a shared layout group container.
2. **`workspaces` (3 connected circular nodes triangle):** **Ungroup Selected Elements** (`ungroupSelection`, shortcut `Ctrl+Shift+G`). Enabled when selected items belong to at least one active group (`canUngroup`). Dissolves the group while keeping all widgets positioned cleanly on the canvas.

Updated accessible button labels and hover tooltips to `"Group selected elements (Ctrl+G)"` and `"Ungroup selected elements (Ctrl+Shift+G)"` so purpose and keyboard shortcuts are immediately clear.

