# PHASE 6.1 — UI REFINEMENT & BUG FIXES

**Product:** AURORA — Your Personal Browser Workspace  
**Tagline:** _"Your Browser. Your Space."_  
**Phase Status:** Implementation Complete  
**Schema Version:** `5` (`CURRENT_SCHEMA_VERSION = 5`, backward compatible with `v1`–`v5`)

---

## 1. Phase 6.1 Scope & Refinements

Phase 6.1 delivers targeted visual refinements and functional corrections requested after Phase 6 testing while preserving AURORA's Manifest V3 architecture, Royal Crystal design system, Material Symbols Rounded icon standard, Zustand transactional draft editing, and local-first storage guarantees:

1. **Quick Shortcuts Horizontal & Vertical Layout (`src/types/workspace.ts`, `src/services/storage/schemas.ts`, `src/features/shortcuts/ShortcutsGrid.tsx`, `src/features/editor/ElementInspectorSections.tsx`):**
   - Added `orientation: 'horizontal' | 'vertical'` to `ShortcutsElementProps` with Zod default `'horizontal'` (`parseShortcutsProps` guarantees backward compatibility for existing saved `v1`–`v5` workspaces without requiring a breaking migration).
   - Added a **Layout Direction** (`Horizontal` | `Vertical`) segmented control to **Shortcuts Grid** in the Properties Inspector, updating draft state cleanly (live preview, Undo/Redo, Discard rollback, and transactional Save persistence).
   - Implemented dynamic column-major vertical flow (`gridAutoFlow: 'column'`) driven by a `ResizeObserver` measuring the canvas widget height so vertical columns fill top-to-bottom cleanly before spilling into subsequent columns without overlap or clipping, while preserving exact user shortcut order.
2. **Top Header Cleanup (`src/features/navigation/TopNavigation.tsx`):**
   - Removed the redundant **Customize wallpaper** image icon button next to **Edit** in the top-right header utility cluster so top navigation stays balanced and minimal.
   - Kept full wallpaper & backdrop customization accessible via **Edit Mode -> Customize wallpaper** toolbar action, **Properties Inspector -> Canvas Background**, and **Theme menu -> Wallpaper & Backdrop...**.
3. **Bookmarks Folder-First Navigation (`src/features/bookmarks/bookmarksService.ts`, `src/features/bookmarks/BookmarksDrawer.tsx`):**
   - Exported `isChromeSystemWrapperFolder()` and `getInitialMainFolders(snapshot)` to unwrap Chrome's synthetic root wrapper containers (`Bookmarks bar`, `Other bookmarks`, `Mobile bookmarks`) and surface the user's organized Level-1 main folders (e.g., `COURSE-`, `PROJECT-`, `PLACEMENT-`, `PLATFORM-`, `OTHERS`) immediately on opening Bookmarks with permission granted.
   - Excluded loose root-level individual bookmarks from the initial folder-only Level-1 view (while preserving full-tree keyword search across all bookmarks via `searchBookmarksSnapshot`).
   - Preserved recursive descendant bookmark counts excluding subfolder nodes (`folderBookmarkCount` traverses child bookmarks and child folder totals recursively), Chrome node ordering, empty-folder feedback, and live Chrome event refreshes.
   - Positioned Chrome Bookmarks first when permission is granted, and added an explicit **Back** navigation button alongside interactive breadcrumbs (`All Folders > Folder > Subfolder`).
4. **Bottom Footer Removal & Chrome `Customize Chrome` Ownership (`src/app/App.tsx`):**
   - Removed AURORA's rendered `<footer>` bar (`AURORA — Local-First New Tab Workspace` / `Press / to search`) to maximize vertical canvas space and eliminate unnecessary visual clutter.
   - **Browser-Owned Button Investigation:** Verified that the bottom-right `Customize Chrome` button observed on New Tab pages inside Google Chrome is browser-native Chromium NTP UI rendered outside AURORA's extension DOM (`newtab.html`). Because MV3 extensions cannot and should not attempt unsupported browser-frame injection or internal flag manipulation, no extension workaround is used and Chrome's native control remains intact cleanly.
5. **High-Contrast Dropdown & Select Visibility (`src/styles/tokens.css`, `src/styles/index.css`, `src/components/ui/Dropdown.tsx`, `src/features/editor/ElementInspectorSections.tsx`, `src/features/elements/AddElementDialogs.tsx`):**
   - **Root Cause Fixed:** Inspector and Add-Element `<select>` controls previously referenced an undefined `--aurora-bg` CSS custom property (`bg-[var(--aurora-bg)]/80`), leaving controls transparent and causing native Windows Chrome option popups to inherit light foreground text onto light system backgrounds. In addition, `DropdownContent` used translucent `--glass-bg-elevated` at `z-50`.
   - Added opaque dark/light Royal Crystal menu design tokens (`--aurora-menu-bg`, `--aurora-menu-trigger-bg`, `--aurora-menu-text`, `--aurora-menu-text-secondary`, `--aurora-menu-hover-bg`, `--aurora-menu-hover-text`, `--aurora-menu-selected-bg`, `--aurora-menu-selected-text`, `--aurora-menu-disabled-text`), defined `--aurora-bg` alias fallback, and hardened global CSS rules for any native `<select>` / `<option>`.
   - Upgraded `DropdownContent` (`z-[80]`, opaque `--aurora-menu-bg`, `max-h-[min(320px,65vh)]`, `overflow-y-auto`), `DropdownItem` (`selected` state with check indicator, high-contrast highlighted & disabled states), and exported `<SelectDropdown />` built on `@radix-ui/react-dropdown-menu` with `role="combobox"` trigger semantics and keyboard navigation.
   - Migrated all 19 Inspector & Add-Element dropdowns (`Border style`, `Font family`, `Font weight`, `Text shadow`, `Backing`, `Clock timezone preset`, `Clock container style`, `Default search engine`, `Search visual style`, `Focus shortcut`, `Shortcuts density`, `Shortcuts columns`, `Scheduled measurement`, `Layout mode`, `Precision`, `Download probe`, `Upload probe`, and `Add Text` font/weight pickers) to `<SelectDropdown />` so dark and light themes render legible, consistent Royal Crystal menus on every OS.
   - Audited and replaced every stray `bg-[var(--aurora-bg)]` utility class across `SearchBar.tsx`, `EditableCanvasStage.tsx`, `LayersPanel.tsx`, and `GifElementRenderer.tsx` with `--aurora-bg-elevated` / `--aurora-menu-trigger-bg`.

---

## 2. Files Created & Updated

### Source Files Modified
- `src/styles/tokens.css`, `src/styles/index.css`
- `src/components/ui/Dropdown.tsx`, `src/components/ui/index.ts`
- `src/types/workspace.ts`, `src/services/storage/defaults.ts`, `src/services/storage/schemas.ts`
- `src/features/shortcuts/ShortcutsGrid.tsx`
- `src/features/editor/ElementInspectorSections.tsx`, `src/features/editor/EditableCanvasStage.tsx`, `src/features/editor/LayersPanel.tsx`
- `src/features/elements/AddElementDialogs.tsx`, `src/features/elements/GifElementRenderer.tsx`
- `src/features/search/SearchBar.tsx`
- `src/features/navigation/TopNavigation.tsx`
- `src/features/bookmarks/bookmarksService.ts`, `src/features/bookmarks/BookmarksDrawer.tsx`
- `src/app/App.tsx`

### Test Files Updated / Expanded
- `src/features/shortcuts/ShortcutsGrid.test.tsx`
- `src/features/bookmarks/bookmarks.test.tsx`
- `src/features/navigation/TopNavigation.test.tsx`
- `src/app/App.test.tsx`
- `src/components/ui/uiPrimitives.test.tsx`
- `src/features/speed/SpeedMonitorWidget.test.tsx`

