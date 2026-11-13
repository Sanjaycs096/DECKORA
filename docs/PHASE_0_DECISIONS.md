# PHASE 0 — Architecture Decision Records (ADRs)

**Product:** AURORA — Your Personal Browser Workspace  
**Purpose:** Document major technical and product decisions, evaluate alternatives, surface trade-offs, and clearly distinguish confirmed recommendations from choices requiring explicit user sign-off prior to Phase 1.

---

## Decision Status Summary

| ADR | Topic | Status |
|---|---|---|
| `ADR-001` | Hybrid Anchor-Percent + Reference-Scaled Canvas Coordinates | **Recommended (Architectural Baseline)** |
| `ADR-002` | Storage Split: `chrome.storage.local` + `IndexedDB` (No Sync Binary Storage) | **Recommended (Platform Constraint)** |
| `ADR-003` | Image Upload Policy: Raster + GIF vs Raw SVG Uploads | **Requires User Approval** |
| `ADR-004` | Search Execution & Live Suggestions Permission Strategy | **Requires User Approval** |
| `ADR-005` | Internet Speed Test Endpoint & Opt-In Permission Strategy | **Requires User Approval** |
| `ADR-006` | SVG `<clipPath>` + Vector Stroke Layering for Shaped Images | **Recommended (Architectural Baseline)** |
| `ADR-007` | Transactional `savedWorkspace` vs `editingDraft` Separation | **Recommended (Product Requirement)** |
| `ADR-008` | Locally Bundled Google Material Symbols Only (`lucide-react` Excluded) | **Recommended (Product Mandate)** |
| `ADR-009` | Top Nav Bookmarks: Curated Local + Optional `bookmarks` Permission | **Requires User Approval** |
| `ADR-010` | Custom Fonts: `FontFace` Uploads + Curated System Stacks | **Recommended (Architectural Baseline)** |

---

## `ADR-001`: Hybrid Anchor-Percent + Reference-Scaled Canvas Coordinates
- **Decision:** Store element positions as viewport-safe percentages (`xPct`, `yPct`) and element dimensions as reference pixels (`widthPx`, `heightPx` on a `1440×900` baseline) with per-element minimum bounds and non-destructive runtime viewport clamping.
- **Status:** Recommended (Architectural Baseline).
- **Reasoning:** Pure pixel coordinates push widgets off-screen when switching from a 1440p monitor to a 768p laptop; pure percentage widths/heights stretch circular photos into ovals and crush text/search bars on ultrawide displays.
- **Alternatives Considered:**
  1. *Fixed-column CSS Grid (like MYNT/Momentum):* Prevents overlapping creative compositions and freeform art placement.
  2. *Pure Percentage X/Y/W/H:* Distorts aspect ratios and ruins typography legibility across aspect ratios.
- **Benefits:** Preserves composition intent across desktop resolutions, prevents widget distortion, and protects offscreen elements without mutating saved coordinates.
- **Trade-offs:** Slightly more complex group resize and viewport-clamping math in the canvas engine.

---

## `ADR-002`: Storage Split (`chrome.storage.local` + `IndexedDB`)
- **Decision:** Store workspace metadata, profiles, layouts, and preferences in `chrome.storage.local`; store wallpapers, images, raw GIF blobs, and font binaries in `IndexedDB`. Do not use `chrome.storage.sync` for layouts or assets.
- **Status:** Recommended (Platform Constraint).
- **Reasoning:** `chrome.storage.sync` enforces a `100 KB` total / `8 KB` per-item limit, which breaks immediately with multi-element layouts or any uploaded media.
- **Alternatives Considered:** Base64 strings inside `chrome.storage.local` (bloats JSON parsing on every New Tab boot and hits the 10 MB local limit quickly).
- **Benefits:** Sub-10ms JSON layout boot, gigabyte-scale binary capacity via IndexedDB, and zero base64 memory inflation.
- **Trade-offs:** No automatic cross-device Chrome Sync in v1; cross-device portability is served via explicit Export/Import profile bundles (Phase 7).

---

## `ADR-003`: Uploaded Image Format Policy (Raster + GIF vs Raw SVG)
- **Decision:** Allow validated raster images (`PNG`, `JPEG`, `WebP`, `AVIF`) and `GIF` (`GIF87a`/`GIF89a`) for user uploads; exclude raw user-uploaded `.svg` files in MVP (or rasterize to PNG on upload if ever added later).
- **Status:** **Requires User Approval.**
- **Reasoning:** SVG is an XML document format capable of embedding `<script>`, `onload` handlers, and external `<use>` references. Restricting uploads to raster + GIF eliminates an entire class of SVG-based XSS and parser vulnerabilities.
- **Alternatives Considered:** Allowing SVG uploads sanitized with DOMPurify and rendered strictly inside `<img src="blob:...">` (where Chrome blocks script execution inside `<img>` SVGs, though malformed SVGs can still trigger rendering bugs).
- **Benefits:** Strongest security posture with zero XML sanitizer maintenance overhead.
- **Trade-offs:** Users cannot upload custom `.svg` vector stickers directly (though geometric vector shapes—Star, Diamond, Circle, etc.—are already built in natively).

---

## `ADR-004`: Search Execution & Live Suggestions Permission Strategy
- **Decision:** Execute searches via direct HTTPS URL navigation (zero host permissions) paired with instant **local** autocomplete (matching user shortcuts & curated apps). Make live third-party search suggestions (Google/DuckDuckGo autocomplete APIs) **opt-in** via Chrome `optional_host_permissions`, OR optionally support `chrome.search.query` when using the browser's default search engine.
- **Status:** **Requires User Approval.**
- **Reasoning:** Fetching live suggestions on every keystroke requires host permissions (`suggestqueries.google.com`, etc.) and sends every typed character to a third-party server before the user presses Enter—conflicting with a strict privacy-first default.
- **Alternatives Considered:** Requesting host permissions for Google/Bing/DuckDuckGo in the base `manifest.json` at install time (triggers scary Chrome Web Store permission prompts for all users).
- **Benefits:** Cleanest install permission profile, zero unintended keystroke leakage, and full flexibility for users who explicitly want live suggestions.
- **Trade-offs:** Out-of-the-box autocomplete suggests local shortcuts/apps only until the user clicks "Enable Live Web Suggestions" in Settings.

---

## `ADR-005`: Internet Speed Monitoring Endpoint & Permission Strategy
- **Decision:** Implement real, bounded speed probes (Ping + 1–5 MB Download + 0.5–1 MB Upload) against **Cloudflare Speed Test (`speed.cloudflare.com`)** (or a user-configured endpoint) using Chrome **`optional_host_permissions`**, scheduled via `chrome.alarms` (`15m`/`30m`/`60m` or `Manual Only`) **strictly while Chrome is open and online**.
- **Status:** **Requires User Approval.**
- **Reasoning:** Chrome extensions cannot run while Chrome is closed, and honest measurements require an actual CORS-accessible speed endpoint with explicit payload caps so users don't burn gigabytes of data. Making the host permission optional keeps core New Tab permissions minimal while allowing users who want the Speed Widget to authorize it in one click.
- **Alternatives Considered:**
  1. *`navigator.connection.downlink` only:* Passive browser estimate capped/rounded by Chrome for fingerprinting protection (often stuck at `10 Mbps`) and provides no upload speed or real active latency test.
  2. *Bundled mandatory `host_permissions` on install:* Forces every user to accept network access permissions even if they hide the Speed Widget.
- **Benefits:** Real, verifiable throughput and latency numbers; zero fabricated metrics; strict bandwidth protection; clean initial install footprint.
- **Trade-offs:** First-time users of the Speed Widget see a one-click "Authorize Speed Test Endpoint" prompt (via `chrome.permissions.request`), and automatic updates pause whenever Chrome is closed.

---

## `ADR-006`: Geometric Image Clipping via SVG `<clipPath>` + Stroke Overlay
- **Decision:** Render Shaped Image elements using an outer container for `filter: drop-shadow(...)` and an inner `<svg>` housing `<clipPath>` geometry, transformed `<image>`, and a crisp top-layer `<path>` border stroke.
- **Status:** Recommended (Architectural Baseline).
- **Reasoning:** Standard CSS `clip-path: polygon(...)` clips away CSS `border` and `box-shadow` on non-rectangular shapes (like Star and Diamond). SVG `<clipPath>` + vector stroke + CSS `filter: drop-shadow` solves clipping, borders, zoom/pan, and shadows cleanly at any DPI.
- **Alternatives Considered:** Pre-baking shapes into raster PNGs on canvas (degrades quality when resizing later in Master Edit Mode and breaks non-destructive re-cropping).
- **Benefits:** Lossless non-destructive cropping/zooming, razor-sharp edges at 4K, and consistent borders/shadows on every shape.
- **Trade-offs:** Slightly heavier DOM structure per shaped image (~4 SVG nodes), negligible for typical counts (`< 50` images).

---

## `ADR-007`: Transactional Editor State (`savedWorkspace` vs `editingDraft`)
- **Decision:** Maintain `editingDraft` strictly separate from `savedWorkspace` while Master Edit Mode is active, committing atomically on **Save** (plus multi-tab `chrome.storage.onChanged` sync) and reverting + purging uncommitted blobs on **Discard**. Store an optional crash-recovery snapshot in IndexedDB that prompts explicitly rather than silently overwriting the saved workspace.
- **Status:** Recommended (Product Requirement).
- **Reasoning:** Prevents half-finished edits from corrupting newly opened tabs while still protecting users against accidental tab closure if desired.
- **Alternatives Considered:** Live auto-saving every drag step directly to persistent storage (makes "Discard" impossible and leaks uncommitted experiment edits into every new tab).
- **Benefits:** Predictable studio editing workflow with safe rollback and clean asset garbage collection.
- **Trade-offs:** Requires disciplined ref-counting for uploaded blobs created mid-session.

---

## `ADR-008`: Bundled Google Material Symbols Only (`lucide-react` Excluded)
- **Decision:** Bundle `Material Symbols Rounded` WOFF2 locally inside the extension and build a unified `<MaterialSymbol />` component. Strip `lucide-react` from all `shadcn/ui` components and enforce an ESLint `no-restricted-imports` rule against Lucide/Font Awesome.
- **Status:** Recommended (Product Mandate).
- **Reasoning:** Strictly enforces the icon rule, complies with MV3 offline/CSP requirements (no `fonts.googleapis.com` CDN dependency), and maintains cohesive visual weight across every control.
- **Alternatives Considered:** Using SVG icon sprites from `@material-symbols/svg-400` per icon (smaller initial bundle if < 80 icons used, also viable—can tree-shake SVGs or subset WOFF2 in Phase 7).
- **Benefits:** Guaranteed visual consistency and zero external network dependency.
- **Trade-offs:** Requires manual icon replacement when adding new `shadcn/ui` primitives.

---

## `ADR-009`: Top Navigation Bookmarks Integration Strategy
- **Decision:** Provide curated local bookmarks in the Top Navigation bar by default (zero extra permissions), with a one-click **"Sync Chrome Bookmarks Bar"** toggle in Settings -> Navigation that requests Chrome's **`bookmarks`** permission as an `optional_permissions` prompt.
- **Status:** **Requires User Approval.**
- **Reasoning:** Requesting `bookmarks` at install time triggers a Chrome warning ("Read and change your bookmarks") that privacy-minded users may distrust if they only want AURORA's curated shortcuts.
- **Alternatives Considered:** Making `bookmarks` a required manifest permission (simpler code, slightly higher permission friction on Chrome Web Store).
- **Benefits:** Minimal install warning while still delivering full Chrome Bookmarks Bar integration for users who want it.
- **Trade-offs:** Extra permission-request UI state in the Bookmarks drawer/settings.

---

## `ADR-010`: Custom Font Loading Strategy
- **Decision:** Support bundled `Inter` / `Manrope`, curated safe system font stacks, and user-uploaded local fonts (`.woff2`, `.woff`, `.ttf`, `.otf`) validated via binary signatures and loaded through `new FontFace(...)` from IndexedDB. Defer Chrome's experimental `queryLocalFonts()` API as an optional future enhancement.
- **Status:** Recommended (Architectural Baseline).
- **Reasoning:** `queryLocalFonts()` triggers an extra browser permission prompt, behaves inconsistently across OS/extension contexts, and returns hundreds of obscure system fonts that clutter the UI; uploaded fonts + curated stacks give predictable cross-tab fidelity.
- **Alternatives Considered:** Calling `window.queryLocalFonts()` immediately on font dropdown open.
- **Benefits:** Reliable typography rendering, clean UX, and full offline portability via IndexedDB.
- **Trade-offs:** Users wanting an exotic locally installed OS font must upload its `.ttf`/`.woff2` file into AURORA's Typography manager.

