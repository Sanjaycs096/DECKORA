# DECKORA

> **Your Personal Browser Workspace.**

[![CI](https://github.com/Sanjaycs096/DECKORA/actions/workflows/ci.yml/badge.svg)](https://github.com/Sanjaycs096/DECKORA/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Chrome MV3](https://img.shields.io/badge/Manifest-V3-success.svg)](public/manifest.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-informational.svg)](tsconfig.json)

---

## 1. Project Title

**DECKORA**

## 2. Tagline

_Your Personal Browser Workspace._

## 3. Professional Introduction

**DECKORA** is an open-source, local-first personal browser workspace built as a Google Chrome Extension using Manifest V3 (`chrome_url_overrides.newtab`). DECKORA transforms Chrome's standard blank New Tab viewport into an elegant, spatial dashboard featuring an interactive freeform canvas, live timekeeping, multi-engine search, custom shortcuts, opt-in network speed monitoring, rich media integration, and an adaptive Royal Crystal design system.

> **Important Boundary Clarification:** DECKORA is strictly a **Chrome New Tab page replacement**. In accordance with Chrome Extension Manifest V3 security boundaries, DECKORA does not—and cannot—modify, restyle, or override Chrome's native browser chrome (the top browser toolbar, omnibox, native tab bar, or browser-level settings). DECKORA lives entirely within the web page viewport of newly opened tabs.

---

## 4. Screenshots & Brand Media

_Brand assets and promotional artwork are available under [`public/brand/`](public/brand/):_

| Asset                       | Preview                                         | Description                                                           |
| :-------------------------- | :---------------------------------------------- | :-------------------------------------------------------------------- |
| **DECKORA Horizontal Logo** | `public/brand/deckora-logo-horizontal.svg`      | Primary brand lockup with layered diamond mark and Manrope typography |
| **DECKORA Vector Symbol**   | `public/brand/deckora-symbol.svg`               | Multi-plane geometric diamond crystal mark                            |
| **Light Theme Wordmark**    | `public/brand/deckora-logo-light.svg`           | High-contrast mark optimized for light workspace backgrounds          |
| **Marquee Artwork**         | `public/brand/deckora-cws-marquee-1400x560.svg` | 1400×560 Royal Crystal workspace showcase art                         |
| **Promo Tile**              | `public/brand/deckora-cws-promo-440x280.svg`    | 440×280 visual tile for extension overview                            |

_(Live screenshots of custom user workspaces can be placed in `docs/screenshots/`.)_

---

## 5. Feature Overview

- **Spatial Interactive Canvas:** Freeform canvas stage with drag-and-drop, fluid pointer resizing, multi-element marquee selection, smart snapping alignment guides, and z-index layer reordering.
- **Transactional Master Edit Mode:** Comprehensive design environment supporting dirty-state tracking, Discard vs. Save confirmation, unbounded Undo/Redo (`Ctrl+Z` / `Ctrl+Y`), and hotkey shortcuts.
- **Minimal 5-Control View Header:** Uncluttered top navigation housing strictly Bookmarks and Gmail (left) alongside Workspace Profiles, Edit Workspace, and the Google Apps launcher popover (right).
- **Bookmarks Sidebar & Flyout:** Left-side dynamic folder drawer with recursive item counts, hover/click adjacent flyouts, nested subfolder navigation, and tree search (requires explicit opt-in `bookmarks` permission; falls back gracefully to curated local bookmarks).
- **Multi-Engine Search Bar:** Instant web search across Google, DuckDuckGo, Bing, GitHub, and YouTube, with configurable privacy options and opt-in search suggestions.
- **Customizable Shortcuts Grid:** Highly configurable quick-access links supporting horizontal and vertical layouts, custom URLs, automatic favicon resolution via Chrome's native favicon service, and modal editing.
- **Opt-In Internet Speed Monitor:** On-demand and schedule-based ping, jitter, download, and upload measurement powered by bounded Cloudflare CDN endpoints (zero telemetry; requires explicit user opt-in for host access).
- **Rich Media & Custom Text:** Binary IndexedDB-backed custom image and animated GIF objects with aspect-ratio locking, alongside typography-styled freeform text elements.
- **Adaptive Royal Crystal Theme Studio:** Dark, Light, and System appearance modes, paired with dynamic color extraction from custom wallpapers, backdrop blur scrims, and curated royal color accents.
- **Workspace Profiles & Portability:** Create multiple independent workspace profiles (e.g. Work, Focus, Minimalist) and seamlessly export/import complete configurations using `.deckora-bundle.zip` (with full backward compatibility for `.aurora-bundle.zip`).

---

## 6. Architecture Overview

DECKORA adheres to a modern, decoupled, reactive architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Google Chrome Browser                          │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                      DECKORA New Tab View                      │   │
│   │                                                                │   │
│   │  ┌──────────────────── TopNavigation ───────────────────────┐  │   │
│   │  │ [Bookmarks] [Gmail]        [Profiles] [Edit] [GoogleApps]│  │   │
│   │  └──────────────────────────────────────────────────────────┘  │   │
│   │                                                                │   │
│   │  ┌───────────────── WorkspaceViewCanvas ────────────────────┐  │   │
│   │  │   [LiveClock]       [SearchBar]       [ShortcutsGrid]    │  │   │
│   │  │   [SpeedMonitor]    [Image/Gif]       [TextElements]     │  │   │
│   │  └──────────────────────────────────────────────────────────┘  │   │
│   └────────────────────────────────┬───────────────────────────────┘   │
│                                    │                                   │
│                        Zustand Reactive State                          │
│          (workspaceStore, editorSessionStore, preferencesStore)         │
│                                    │                                   │
│                   ┌────────────────┴────────────────┐                  │
│                   ▼                                 ▼                  │
│      ┌─────────────────────────┐       ┌─────────────────────────┐     │
│      │   chrome.storage.local   │       │   IndexedDB (idb)       │     │
│      │  (Layouts, JSON configs)│       │  (Binary blobs & media) │     │
│      └─────────────────────────┘       └─────────────────────────┘     │
│                                                     ▲                  │
│   ┌────────────────────────────────┐                │                  │
│   │   Background Service Worker    │────────────────┘                  │
│   │   (Alarms & Speed Scheduler)   │ (Scheduled network tests)         │
│   └────────────────────────────────┘                                   │
└────────────────────────────────────────────────────────────────────────┘
```

1. **View Layer:** High-performance React 19 functional components styled using Tailwind CSS v4 and Radix UI primitives.
2. **State Layer:** Zustand stores using Immer for immutable updates. The editor features a decoupled session store (`editorSessionStore`) that isolates in-flight edits from persisted state until explicitly saved.
3. **Data & Storage Layer:** Two-tier local storage architecture:
   - `chrome.storage.local`: Lightweight, structured JSON schema storing workspace layouts, profile definitions, widget configurations, and user preferences.
   - `IndexedDB` (`aurora-assets-db`): High-capacity transactional object store storing wallpapers, custom fonts, images, and animated GIFs as raw binary `Blob` objects.

---

## 7. Technology Stack

- **Runtime & Platform:** Google Chrome Extension Manifest V3
- **Language:** TypeScript 5.9 (Strict mode enabled, `noExplicitAny: error`, `noUncheckedIndexedAccess: true`)
- **UI Framework:** React 19, React DOM 19
- **Build System:** Vite 8 (`@vitejs/plugin-react`, `@tailwindcss/vite`)
- **Styling:** Tailwind CSS v4, CSS Variables, Royal Crystal design tokens
- **UI Primitives:** Radix UI (`@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-slider`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`)
- **Iconography:** Google Material Symbols Rounded (`@fontsource-variable/material-symbols-rounded`) exclusively
- **Typography:** Inter Variable (`@fontsource-variable/inter`), Manrope Variable (`@fontsource-variable/manrope`)
- **State Management:** Zustand 5, Immer 10
- **Validation & Schemas:** Zod 4
- **Client Storage:** IndexedDB (`idb` v8) and Chrome Storage API (`@types/chrome`)
- **Code Quality:** ESLint 9, `typescript-eslint`, Prettier 3
- **Test Framework:** Vitest 4, `@testing-library/react`, `@testing-library/jest-dom`, JSDOM, `fake-indexeddb`

---

## 8. Repository Structure

```
DECKORA/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   ├── workflows/
│   │   └── ci.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/                               # Phase specifications, PRDs, ADRs & reports
│   └── reports/
│       ├── REPOSITORY_AUDIT_REPORT.md
│       ├── SECURITY_AUDIT_REPORT.md
│       └── RELEASE_VERIFICATION_REPORT.md
├── public/                             # Extension runtime static assets
│   ├── brand/                          # DECKORA vector logos and promotional artwork
│   ├── fonts/                          # SIL Open Font & Apache 2.0 license documents
│   ├── icons/                          # 16, 32, 48, 128px PNG extension icons
│   └── manifest.json                   # Chrome Extension Manifest V3 configuration
├── src/                                # Application source code
│   ├── app/                            # Top-level React App root & integration tests
│   ├── background/                     # MV3 background service worker & alarms scheduler
│   ├── components/                     # Reusable UI primitives & brand components
│   │   ├── brand/                      # DECKORA Logo & About modal
│   │   ├── shared/                     # Canvas background, MaterialSymbol, error boundary
│   │   └── ui/                         # Buttons, Dialogs, Dropdowns, Inputs, Sliders, Tabs
│   ├── design-system/                  # Royal Crystal color tokens & theme engine
│   ├── features/                       # Modular product feature domains
│   │   ├── bookmarks/                  # Sidebar drawer, dynamic folders, Chrome bookmarks sync
│   │   ├── clock/                      # Live digital clock, formatting, and time hooks
│   │   ├── editor/                     # Canvas stage, toolbar, layers, inspector, snapping
│   │   ├── elements/                   # Image, GIF, text rendering and creation dialogs
│   │   ├── navigation/                 # 5-control top navigation bar & Google Apps launcher
│   │   ├── portability/                # ZIP bundle exporter/importer & validation
│   │   ├── profiles/                   # Multi-profile manager and preset templates
│   │   ├── search/                     # Multi-engine search bar & suggestion integration
│   │   ├── shortcuts/                  # Quick links grid, modal editor, and favicon loader
│   │   ├── speed/                      # Bounded Cloudflare speed test engine & widget
│   │   ├── theme/                      # Adaptive wallpaper color extraction & palette generator
│   │   └── wallpaper/                  # Wallpaper manager & solid/gradient/image picker
│   ├── hooks/                          # Shared React hooks (asset URLs, font/theme sync)
│   ├── security/                       # Automated security verification tests
│   ├── services/                       # Data layer services
│   │   ├── assets/                     # IndexedDB binary asset storage & magic-byte validator
│   │   └── storage/                    # chrome.storage adapter & Zod validation schemas
│   ├── state/                          # Zustand global state stores (workspace, editor, theme)
│   ├── styles/                         # Global Tailwind styles & font imports
│   ├── test/                           # Vitest setup & testing mocks
│   ├── types/                          # TypeScript workspace data contracts
│   └── utils/                          # DOM utilities, Classnames (cn), URL protocol sanitizer
├── .gitattributes                      # Git line ending normalization rules
├── .gitignore                          # Git file exclusion rules
├── .npmrc                              # Engine and dependency installation rules
├── .prettierignore                     # Prettier file exclusion rules
├── .prettierrc                         # Prettier formatting configuration
├── CONTRIBUTING.md                     # Contribution guidelines and workflow rules
├── eslint.config.js                    # ESLint 9 configuration with restricted import bans
├── LICENSE                             # MIT Open Source License
├── newtab.html                         # Extension New Tab entrypoint HTML document
├── package.json                        # Node dependencies and project scripts
├── pnpm-lock.yaml                      # Deterministic pnpm dependency lockfile
├── README.md                           # Comprehensive product and technical documentation
├── SECURITY.md                         # Responsible disclosure and security policy
├── tsconfig.json                       # Strict TypeScript compiler options
├── vite.config.ts                      # Multi-entry Vite bundler configuration
└── vitest.config.ts                    # Vitest test suite configuration
```

---

## 9. Installation Requirements

To build and run DECKORA locally, ensure you have:

- **Operating System:** Windows, macOS, or Linux
- **Node.js:** `v20.18.0` or `v22.x+` (verified on Node `v24.12.0`)
- **Package Manager:** `pnpm` `v9.x` or `v10.x` (verified on `v10.29.3`)
- **Browser:** Google Chrome or Chromium derivative supporting Manifest V3

---

## 10. Local Development Setup

Clone the repository and install the project dependencies using pnpm:

```bash
# Clone the repository
git clone https://github.com/Sanjaycs096/DECKORA.git
cd DECKORA

# Install dependencies deterministically
pnpm install --frozen-lockfile
```

---

## 11. Development Commands

The project includes standard scripts for development, quality verification, and testing:

| Command              | Description                                                                                            |
| :------------------- | :----------------------------------------------------------------------------------------------------- |
| `pnpm dev`           | Starts Vite local development server (`http://localhost:5173/newtab.html`) for rapid component styling |
| `pnpm build`         | Executes TypeScript typecheck (`tsc --noEmit`) followed by production Vite build to `dist/`            |
| `pnpm build:watch`   | Continuously watches source files and rebuilds `dist/` on changes                                      |
| `pnpm typecheck`     | Runs strict TypeScript compiler verification without emitting JavaScript                               |
| `pnpm lint`          | Runs ESLint 9 across all source and test files                                                         |
| `pnpm lint:fix`      | Automatically corrects fixable lint and formatting discrepancies                                       |
| `pnpm format:check`  | Validates code formatting against Prettier rules                                                       |
| `pnpm format`        | Formats all source files with Prettier                                                                 |
| `pnpm test`          | Executes the complete Vitest test suite in jsdom                                                       |
| `pnpm test:watch`    | Runs Vitest in interactive watch mode for test-driven development                                      |
| `pnpm test:coverage` | Generates a comprehensive code coverage report                                                         |

---

## 12. Production Build Instructions

To generate a reproducible production release:

```bash
pnpm build
```

The build output is emitted to the `dist/` directory in the project root:

- `dist/newtab.html`: Compiled New Tab HTML document.
- `dist/background.js`: Compiled Chrome MV3 background service worker.
- `dist/assets/`: Code-split JavaScript chunks, scoped CSS, and locally bundled font files.
- `dist/manifest.json`: Copied Manifest V3 configuration.
- `dist/icons/`: Bundled PNG extension icons.
- `dist/brand/`: Bundled SVG branding marks.

---

## 13. Chrome Extension Installation Instructions

To install the built extension in Google Chrome:

1. Ensure you have run `pnpm build` and verified that the `dist/` folder exists.
2. Launch Google Chrome.
3. Open a new tab and navigate to `chrome://extensions/`.
4. Locate the **Developer mode** toggle switch in the top-right corner of the Extensions page and turn it **ON**.
5. In the top-left toolbar, click the **Load unpacked** button.
6. In the system folder picker, browse to your `DECKORA` directory and select the **`dist`** folder.
7. Click **Select Folder** (or **Open**).
8. The extension card **"DECKORA — Your Personal Browser Workspace"** will now appear in your list of installed extensions.

---

## 14. Enabling & Testing the Extension

Once loaded unpacked:

1. Open a new tab by clicking the **+** button in Chrome's tab bar or pressing `Ctrl+T` (Windows/Linux) or `⌘T` (macOS).
2. Chrome will display the DECKORA New Tab workspace.
3. _(First Run Notice)_: If Chrome displays a prompt asking _"Is this the new tab page you were expecting?"_, select **Keep changes** to keep DECKORA as your active New Tab page.
4. Click the **Edit Workspace** button (pencil icon) in the top-right navigation bar to enter Master Edit Mode, customize widgets, and configure your appearance.

---

## 15. Permission Explanations

DECKORA adheres strictly to the principle of least privilege:

### Required Core Permissions

- `storage`: Enables saving workspace widget layouts, profile metadata, search settings, and appearance choices in `chrome.storage.local`.
- `favicon`: Grants access to Chrome's native internal favicon service (`chrome://favicon2/`) to resolve high-resolution favicons for custom shortcut tiles without querying external third-party favicon aggregators.
- `alarms`: Schedules optional, user-configured background speed checks via `chrome.alarms` strictly while Chrome is active.

### Optional Permissions (Strictly Opt-In)

- `bookmarks`: Optional permission requested only when the user toggles on native Chrome bookmark synchronization in the Bookmarks Drawer. If denied, DECKORA uses an isolated curated local bookmark store.
- `search`: Optional permission enabling native omnibox search query execution when configured by the user.

### Optional Host Permissions (Strictly Opt-In)

- `https://speed.cloudflare.com/*`: Required exclusively if the user activates the Internet Speed Monitor. DECKORA queries Cloudflare CDN endpoints solely to measure ping, jitter, and bandwidth.
- `https://suggestqueries.google.com/*`, `https://duckduckgo.com/*`, `https://api.bing.com/*`: Optional suggestion query endpoints queried only if the user explicitly turns on live search query suggestions.

---

## 16. Local Data Storage & Privacy Guarantees

DECKORA is built from the ground up as a **local-first, privacy-respecting product**:

- **Zero Accounts:** No signup, authentication, or cloud account is required.
- **Zero Analytics:** DECKORA contains no Google Analytics, PostHog, Mixpanel, or third-party telemetry scripts.
- **Zero Tracking:** Your bookmarks, browsing history, shortcut URLs, search queries, notes, and wallpapers are never sent to any remote server or maintainer database.
- **Local Storage Architecture:**
  - Layout definitions, widget positions, and profile settings are stored exclusively in Chrome's sandboxed `chrome.storage.local`.
  - Wallpapers, custom uploaded images, animated GIFs, and custom fonts are stored as binary records inside an isolated, client-side IndexedDB database (`aurora-assets-db`).

---

## 17. Workspace Import & Export (.zip)

DECKORA provides a complete backup and restore mechanism:

### Exporting Your Workspace

1. Enter **Master Edit Mode** by clicking the Edit button in the header.
2. In the toolbar, click **Backup / Restore**.
3. Click **Export Workspace**.
4. DECKORA bundles your current workspace metadata, widget layout, profiles, and binary assets (wallpapers, images, fonts) into a single portable `.deckora-bundle.zip` file and triggers a browser download.

### Importing a Workspace

1. In the **Backup / Restore** dialog, select or drag-and-drop a `.deckora-bundle.zip` archive (or legacy `.aurora-bundle.zip`).
2. DECKORA automatically validates the archive:
   - Verifies maximum archive uncompressed size limit (50 MB cap).
   - Validates file paths to prevent directory traversal attacks (Zip Slip).
   - Checks file magic bytes to verify genuine PNG, JPEG, WebP, AVIF, and GIF headers.
   - Validates `manifest.json` structure against the strict Zod workspace schema.
3. Upon successful validation, the workspace and all binary media are restored atomically.

---

## 18. Security Information

DECKORA implements defense-in-depth protections across all layers:

1. **Strict Content Security Policy (CSP):** The extension enforces `script-src 'self'; object-src 'self';`. Inline scripts, `eval()`, `new Function()`, and remote scripts are strictly prohibited.
2. **URL Protocol Sanitization:** All shortcut links and search redirection targets are sanitized using strict protocol validation (`http:`, `https:`). Dangerous schemes such as `javascript:`, `vbscript:`, and arbitrary `data:` URIs are neutralized.
3. **Magic-Byte Sniffing:** Uploaded wallpapers, images, and GIFs are inspected at the binary level using their magic header bytes, preventing MIME-type spoofing or polyglot payload execution.
4. **Local Fonts & Icons:** All fonts (`Inter Variable`, `Manrope Variable`, `Material Symbols Rounded`) are self-hosted and bundled into the extension bundle. No assets are loaded from external CDNs or Google Fonts servers.
5. **Security Reporting:** Refer to [SECURITY.md](SECURITY.md) for vulnerability disclosure procedures.

---

## 19. Testing & Quality Verification

DECKORA includes an automated test suite with 100% pass rates across unit, component, and security integration suites:

```bash
# Run all unit and integration tests
pnpm test
```

### Test Suite Highlights

- **Integration Tests:** `src/app/App.test.tsx` verifies the full New Tab experience, 5-control header, full-viewport layout, and absence of legacy footers.
- **Canvas & History:** `src/features/editor/MasterEditorShell.test.tsx` tests drag-and-drop, snapping, multi-selection marquee, and transaction commits.
- **Security Tests:** `src/security/securityAudit.test.tsx` validates ZIP slip resistance, MIME-spoofing rejection, URL protocol sanitization, least-privilege manifest declaration, and bounded speed test limits.
- **Data & Storage:** `src/services/storage/chromeStorageService.test.ts` and `src/services/assets/assetDb.test.ts` test schema migrations and transactional IndexedDB operations.

---

## 20. Known Limitations

- **Chrome Omnibox & Native Toolbar:** Chrome's MV3 API prevents extensions from modifying or styling Chrome's native browser frame, tab strip, or URL omnibox. DECKORA's visual control begins at the New Tab page viewport.
- **Background Speed Testing Lifecycles:** Chrome terminates background service workers after approximately 30 seconds of inactivity. Periodic background speed tests rely on `chrome.alarms` and only run while Google Chrome is active and connected to the internet. Speed checks do not run when the computer or browser is closed.
- **Single-Origin IndexedDB Quota:** Custom media storage is limited by the browser's origin quota (typically hundreds of megabytes to gigabytes depending on available disk space).

---

## 21. Roadmap

- [ ] **Widget Ecosystem:** Optional weather forecast widget and sticky scratchpad note widget with local Markdown support.
- [ ] **Shortcut Categories:** Ability to organize shortcuts into named tabbed folders or groups on the canvas.
- [ ] **Canvas Layout Snapshots:** Quick layout switcher to flip between multiple canvas arrangements within the same profile.
- [ ] **Live Wallpaper Engine:** Optional CSS shader or subtle canvas particle animation for dynamic background visuals.
- [ ] **Keyboard Navigability:** Full keyboard arrow-key navigation across canvas elements in View Mode.

---

## 22. Contribution Guidelines

Contributions from the community are warmly welcomed! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on code style, branch naming conventions, TypeScript requirements, and PR submission processes.

---

## 23. License

DECKORA is open-source software licensed under the **[MIT License](LICENSE)**.

```
Copyright (c) 2026 SANJAYKUMAR M
```

---

## 24. Author & Maintainer

- **Maintainer:** [SANJAYKUMAR M](https://github.com/Sanjaycs096)
- **GitHub Repository:** [https://github.com/Sanjaycs096/DECKORA](https://github.com/Sanjaycs096/DECKORA)
- **Issue Tracker:** [https://github.com/Sanjaycs096/DECKORA/issues](https://github.com/Sanjaycs096/DECKORA/issues)
