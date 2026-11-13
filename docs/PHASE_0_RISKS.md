# PHASE 0 — Risk & Feasibility Assessment

**Product:** AURORA — Your Personal Browser Workspace  
**Target Environment:** Google Chrome Manifest V3 (MV3)  

---

## Risk Matrix Summary

| ID | Risk Area | Severity | Likelihood | Mitigation Readiness |
|---|---|---|---|---|
| `RSK-01` | Chrome MV3 Service Worker Suspension & 24/7 Speed Monitoring Myth | High | Certain | Designed Around Constraint |
| `RSK-02` | Native Chrome Toolbar / Bookmarks / Profile Override Limitation | Medium | Certain | Clear UI Boundary |
| `RSK-03` | `chrome.storage` Quotas vs Large Media & Orphaned Blobs | High | High | IndexedDB + Two-Phase GC |
| `RSK-04` | Large Animated GIF Decoding, Memory Leaks & Frame Flattening | High | Medium | Raw Blob + Canvas Pause Overlay |
| `RSK-05` | Search Suggestions & Speed Test Host Permission Warnings | High | High | Optional Permissions + Local Fallback |
| `RSK-06` | Custom Uploaded Font Loading Latency, Failures & Licensing | Medium | Medium | `FontFace` Validation + Notice |
| `RSK-07` | Multi-Resolution Canvas Distortion & Offscreen Elements | High | High | Hybrid Anchor-% + Reference Clamp |
| `RSK-08` | Backdrop-Filter Blur GPU Cost & Wallpaper Contrast Failure | Medium | Medium | Adaptive Scrim + Solid Fallback |
| `RSK-09` | XSS / Malicious File Upload / Unsafe URL Injection | Critical | Medium | Magic-Byte Sniffing + Strict CSP |
| `RSK-10` | `shadcn/ui` Icon Library Drift (`lucide-react` Leakage) | Medium | High | Lint Rule + `<MaterialSymbol />` |
| `RSK-11` | CRXJS / Vite MV3 Build & Playwright Extension CI Friction | Medium | Medium | Verified Multi-Entry Fallback + `--headless=new` |
| `RSK-12` | Bandwidth Exhaustion / Metered Data via Auto Speed Tests | Medium | Medium | Strict Byte Caps + `saveData` Guard |

---

## Detailed Technical Risk Analysis & Mitigations

### `RSK-01` — Chrome MV3 Service Worker Lifecycle & 24/7 Speed Monitoring Limitations
- **Technical Reality:** Chrome MV3 terminates background service workers after ~30 seconds of idle time and **never** runs extensions when Chrome is closed. `chrome.alarms` enforces a >= 1-minute minimum period in packed extensions and can be throttled when the OS sleeps or Chrome reduces background activity.
- **Impact:** Promising "24/7 continuous real-time bandwidth monitoring" would be technically impossible and misleading.
- **Mitigation:**
  - Design the Speed Monitor around **on-demand manual tests** plus **conservative periodic `chrome.alarms` checks (`15m` / `30m` / `60m`) strictly while Chrome is running and online**, cached in `chrome.storage.local`.
  - Clearly disclose this lifecycle behavior in the Speed Widget tooltip and Settings.
  - Never fabricate or interpolate fake speed values.

### `RSK-02` — New Tab Override Limitations (Native Chrome UI)
- **Technical Reality:** `chrome_url_overrides.newtab` replaces only the inner web viewport of newly opened tabs. Extensions cannot restyle Chrome's native omnibox, native tab strip, native bookmarks bar, or native Google profile switcher button.
- **Impact:** Users expecting the extension to re-skin Chrome's browser frame could be confused.
- **Mitigation:** Implement AURORA's clean Fixed Top Navigation bar inside the New Tab viewport (`Bookmarks`, `Gmail`, `Images`, 6-dot `Apps`, `Profile`), with optional `bookmarks` permission to mirror user bookmarks cleanly.

### `RSK-03` — Storage Quotas & Cross-Profile Orphaned Assets
- **Technical Reality:** `chrome.storage.sync` has a hard `100 KB` total / `8 KB` per-item cap; `chrome.storage.local` defaults to `10 MB` (even before considering base64 image bloat). Base64-encoding images inside JSON crashes storage quotas rapidly.
- **Mitigation:**
  - Keep `chrome.storage.local` strictly for lightweight JSON layouts, profiles, and metadata (`< 500 KB` typical).
  - Store all wallpapers, images, GIFs, and fonts as binary `Blob`/`ArrayBuffer` objects in **IndexedDB** (`aurora-assets-db`), which shares origin quota (typically gigabytes depending on free disk space).
  - Enforce reasonable per-file upload limits (10–15 MB) and implement **Two-Phase Orphan Asset Garbage Collection** across *all* profiles on **Save** / **Discard**.

### `RSK-04` — Animated GIF Preservation, Pause/Play & Memory Leaks
- **Technical Reality:** Drawing an uploaded GIF to `<canvas>` during upload destroys animation frames and produces a static image. Leaving dozens of unrevoked `URL.createObjectURL(blob)` references across tab lifecycles leaks memory. Conversely, native `<img>` tags have no built-in `.pause()` method.
- **Mitigation:**
  - Bypass `<canvas>` re-encoding completely on upload; validate `GIF87a`/`GIF89a` bytes and store the raw `Blob`.
  - Render via `<img src={objectUrl}>` wrapped by a reference-counted `ObjectURLManager` that calls `URL.revokeObjectURL` cleanly on unmount.
  - Implement Pause by snapping the visible frame onto a stacked `<canvas>` (`ctx.drawImage(imgRef, ...)`) and hiding the `<img>`; Play restores the live `<img>`.

### `RSK-05` — Host Permissions, Chrome Web Store Review & Search Suggestions
- **Technical Reality:** Requesting `<all_urls>` or broad host permissions triggers alarming Chrome install warnings ("Read and change all your data on all websites") and slows Chrome Web Store review. Yet live third-party search autocomplete (`suggestqueries.google.com`) and third-party speed probes (`speed.cloudflare.com`) are cross-origin network requests.
- **Mitigation:**
  - Default search submits via standard HTTPS URL navigation (zero host permissions) with instant **local** autocomplete across shortcuts/apps.
  - Place live search autocomplete and active speed-test endpoints behind Chrome's **`optional_host_permissions`**, requested dynamically via `chrome.permissions.request()` *only* if the user opts in.

### `RSK-06` — Custom Font Loading, Validation & Licensing
- **Technical Reality:** Malformed `.ttf`/`.woff2` files can fail parsing silently, causing fallback to Times New Roman; large CJK font files can exceed 15 MB; users may mistakenly think uploaded fonts are synced or redistributed.
- **Mitigation:**
  - Sniff binary magic bytes (`wOF2`, `wOFF`, `0x00010000`, `OTTO`) and cap font uploads at `8 MB`.
  - Pre-validate with `await new FontFace(family, buf).load()` *before* persisting to IndexedDB; wrap in error handling and register all active fonts before rendering text widgets.
  - Display a clear notice in Settings -> Typography that uploaded fonts remain local to the user's device for personal use.

### `RSK-07` — Multi-Resolution Canvas Positioning & Offscreen Drift
- **Technical Reality:** Switching from a `2560×1440` desktop monitor to a `1366×768` laptop window can push pixel-positioned elements off-screen or cause percentage-sized widgets to squash into unusable aspect ratios.
- **Mitigation:**
  - Use **Hybrid Anchor-Percentage (`xPct`, `yPct`) + Reference-Scaled (`widthPx`, `heightPx`) Coordinates** with per-element `minWidthPx`/`minHeightPx`.
  - Apply a non-destructive runtime `clampToViewport` guard ensuring every visible widget keeps >= `32px` inside the safe viewport without overwriting the user's saved ultra-wide coordinates.
  - Provide a one-click **"Recenter Offscreen Elements"** action in Master Edit Mode.

### `RSK-08` — GPU Compositing Cost of `backdrop-filter` & Wallpaper Readability
- **Technical Reality:** Stacking many overlapping `backdrop-filter: blur(24px)` elements over 4K wallpapers can cause frame drops on integrated GPUs; bright white wallpapers make white crystal text unreadable.
- **Mitigation:**
  - Cap blur at `36px`, promote dragged elements to `will-change: transform` only during active drag, and provide a "Reduced Glass / Solid Mode" toggle + `@supports` fallback.
  - Run offscreen Canvas luminance & color quantization on wallpaper upload to recommend Light/Dark mode and auto-tune background dim/scrim opacity.

### `RSK-09` — Security Risks (XSS, SVG Scripts, Unsafe URLs)
- **Technical Reality:** User-editable text, shortcut URLs, image click URLs, and uploaded SVG files are classic XSS/injection vectors if handled carelessly.
- **Mitigation:**
  - Strictly forbid `dangerouslySetInnerHTML` and `eval`; enforce MV3 CSP (`script-src 'self'`).
  - Parse all shortcut and click URLs with `new URL()`, allowing **only** `http:` and `https:`.
  - Restrict uploaded images to safe raster formats + GIF (`PNG`, `JPEG`, `WebP`, `AVIF`, `GIF`)—excluding raw SVG uploads in v1 unless rendered strictly via sanitized rasterization (ADR-003).

### `RSK-10` — Icon Library Discipline (`lucide-react` Leakage)
- **Technical Reality:** `shadcn/ui` CLI generators inject `lucide-react` imports into `dialog.tsx`, `select.tsx`, `checkbox.tsx`, etc. by default.
- **Mitigation:** Exclude `lucide-react` from `package.json` entirely, enforce an ESLint `no-restricted-imports` rule blocking `lucide-react` / `@fortawesome/*`, and route all UI icons through `<MaterialSymbol />`.

### `RSK-11` — Build Tooling & Automated Browser Extension E2E Friction
- **Technical Reality:** Vite plugins for MV3 sometimes break HMR on Windows or mismatch manifest paths; Playwright headless Chromium previously required headed mode for extensions unless configured with `--headless=new` and `launchPersistentContext`.
- **Mitigation:** Test `vite build` output directly in CI using `chromium.launchPersistentContext('', { headless: false, args: ['--headless=new', '--disable-extensions-except=./dist', '--load-extension=./dist'] })` (with `xvfb-run` on Linux GitHub Actions runners).

### `RSK-12` — Bandwidth Cost of Automated Speed Monitoring
- **Technical Reality:** Running a 25 MB speed test every minute would consume > 36 GB/day of user bandwidth and drain mobile hotspot / metered plans.
- **Mitigation:** Enforce strict per-test byte caps (`1–5 MB` down, `0.5–1 MB` up), conservative default interval (`30 min` or `Manual Only`), automatic skip when `navigator.connection?.saveData === true` or offline, and explicit user-selectable payload presets.

