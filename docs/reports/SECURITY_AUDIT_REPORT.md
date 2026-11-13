# DECKORA — Comprehensive Security Audit Report

**Date:** 2026-11-13  
**Auditor:** Antigravity Chrome Extension Security Engineering  
**Scope:** Complete DECKORA source tree, build configuration, dependencies, and git history  
**Target Repository:** [https://github.com/Sanjaycs096/DECKORA.git](https://github.com/Sanjaycs096/DECKORA.git)  
**Security Baseline:** Chrome Manifest V3 (MV3), OWASP ASVS Level 2, Local-First Architecture  

---

## 1. Executive Summary

A comprehensive source-level and architectural security review was performed across DECKORA v0.1.0. 

**Overall Security Rating: PRODUCTION READY**

DECKORA exhibits an exemplary defense-in-depth security architecture. Because the application is strictly client-side and local-first, the attack surface is significantly minimized compared to cloud-dependent extensions:
- **Zero Secrets Detected:** Automated regex and static code scans confirmed zero API keys, credentials, or private tokens anywhere in the codebase.
- **Strict MV3 Compliance:** Extension manifest enforces `script-src 'self'; object-src 'self';` with zero remote code execution, zero `eval()`, and zero content script injections.
- **Zero Remote Telemetry:** No user analytics, crash reporters, external tracking, or third-party trackers exist.
- **Defensive Data Handling:** Strict URL protocol validation (`http:`, `https:` only), ZIP Slip directory traversal guards, file magic-byte validation, and comprehensive Zod schema parsing at all trust boundaries.
- **Zero Production Vulnerabilities:** `pnpm audit --prod` confirmed 0 vulnerabilities in runtime dependencies.

---

## 2. Secrets & Sensitive Information Audit

### 2.1 Scan Methodology
An automated secret scanning script was executed against all repository files (TypeScript, JavaScript, JSON, YAML, Markdown, CSS, HTML). The scan checked for:
- Google API keys (`AIza...`)
- GitHub Personal Access Tokens (`ghp_...`, `gho_...`)
- AWS access keys (`AKIA...`)
- PEM-encoded private keys (`-----BEGIN PRIVATE KEY-----`)
- Hardcoded passwords and authorization headers
- Unintended `.env` files or staging credentials

### 2.2 Findings
- **Result:** **0 Findings / Clean**
- No secrets or credentials were discovered in any source code, configuration files, test fixtures, or documentation.
- The `.gitignore` file explicitly excludes `.env`, `.env.*`, `*.local`, `*.db`, `*.sqlite`, and editor configurations.

---

## 3. Chrome Extension MV3 Security Review

### 3.1 Permissions Audit (`public/manifest.json`)
The extension follows the principle of least privilege:

```json
{
  "permissions": ["storage", "favicon", "alarms"],
  "optional_permissions": ["bookmarks", "search"],
  "optional_host_permissions": [
    "https://speed.cloudflare.com/*",
    "https://suggestqueries.google.com/*",
    "https://duckduckgo.com/*",
    "https://api.bing.com/*"
  ]
}
```

- **Required Core Permissions:**
  - `storage`: Required for local JSON metadata persistence in `chrome.storage.local`.
  - `favicon`: Uses Chrome's internal `chrome://favicon2/` API to load domain icons without exposing user browsing habits to external third-party favicon aggregators.
  - `alarms`: Schedules user-configured periodic speed tests strictly when Chrome is active.
- **Opt-In Permissions:**
  - `bookmarks` and `search` are strictly declared under `optional_permissions`. They are never requested at installation time. Instead, an interactive browser permission dialog is triggered only when the user explicitly enables native bookmark mirroring or omnibox search.
- **Opt-In Host Permissions:**
  - Zero broad wildcards (`<all_urls>`, `*://*/*`, `http://*/*`) are requested.
  - Only specific HTTPS endpoints (`speed.cloudflare.com` and search engines) are declared as `optional_host_permissions` and requested on-demand.

### 3.2 Content Security Policy (CSP)
Manifest V3 enforces a hardened CSP for extension pages:
```
script-src 'self'; object-src 'self';
```
- No `'unsafe-eval'` or `'unsafe-inline'` script execution is permitted.
- All application JavaScript is bundled locally in `dist/assets/`.
- No remote scripts can be loaded or executed at runtime.

### 3.3 Context Boundaries & Content Scripts
- DECKORA declares **zero content scripts**. It does not inject code into external web pages.
- The application runs exclusively within the New Tab page viewport (`chrome_url_overrides.newtab: "newtab.html"`).
- Background operations are limited to `background.js` (an ephemeral MV3 service worker managing alarm events).

---

## 4. Frontend Security & DOM XSS Analysis

### 4.1 DOM XSS Sinks
- **`dangerouslySetInnerHTML`:** Audit verified **zero instances** in the production codebase.
- **`eval()` & `new Function()`:** Audit verified **zero instances**.
- **Dynamic Script Injection:** Zero dynamic `<script>` tag creations or `document.write` calls.

### 4.2 URL Sanitization (`src/utils/url.ts`)
All user-provided URLs (shortcuts, custom search engines, links) pass through `sanitizeHttpUrl()`:
```typescript
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export function sanitizeHttpUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
```
- Completely neutralizes `javascript:`, `vbscript:`, `data:`, `file:`, and invalid schemes before they can be rendered or navigated.

---

## 5. Media Upload & Binary Asset Security

### 5.1 Magic-Byte Validation (`src/services/assets/mediaValidation.ts`)
- File uploads (wallpapers, canvas images, animated GIFs) are validated by inspecting binary magic numbers in the file buffer:
  - **PNG:** `89 50 4E 47 0D 0A 1A 0A`
  - **JPEG:** `FF D8 FF`
  - **GIF:** `GIF87a` or `GIF89a`
  - **WebP:** `RIFF....WEBP`
  - **AVIF:** `....ftypavif` or `....ftypavis`
  - **WOFF2 / WOFF:** `wOF2` / `wOFF`
- **SVG Exclusion (ADR-003):** Raw SVG uploads are strictly rejected to eliminate embedded `<script>` tag execution, XML external entity (XXE) injection, and SVG-based XSS vectors.

### 5.2 Upload Bounds Enforcement
- File size caps: 15 MB for wallpapers and GIFs, 10 MB for images, 5 MB for fonts.
- Header dimension bounds: 7680×4320 px (wallpapers), 6000×6000 px (images), 2400×2400 px (GIFs).
- Integrity: Every stored asset computes and stores a cryptographic SHA-256 hash.

---

## 6. ZIP Import/Export Security (Zip Slip & Decompression Bomb Protection)

The custom ZIP parsing engine in `src/features/portability/zipArchive.ts` enforces multi-layered safeguards:

1. **Directory Traversal (Zip Slip) Defense:**
   - `normalizeSafeZipPath()` checks entry paths for null bytes, drive letters (`C:`), Windows backslashes (`\`), absolute paths (`/`), and `..` segments.
   - Any path attempting traversal throws `ZipArchiveError('UNSAFE_PATH')`.
2. **Decompression Bomb Protection:**
   - Maximum uncompressed archive size limit: **120 MB** across all entries.
   - Maximum entry count: **250 entries**.
   - Maximum single entry size: **25 MB**.
   - Incremental streaming decompression via `DecompressionStream('deflate-raw')` tracks byte counts in flight and aborts immediately if bounds are exceeded before exhausting browser memory.
3. **Data Integrity:**
   - Bit-level CRC-32 verification matches declared central directory headers against extracted payloads.
   - Archive manifest is validated against the strict Zod schema `persistedWorkspaceStateSchema`.

---

## 7. Network Speed Monitor Boundaries

The speed testing engine (`src/features/speed/speedEngine.ts`):
- Targets only official Cloudflare CDN endpoints (`https://speed.cloudflare.com/__down`, `https://speed.cloudflare.com/__up`).
- Enforces strict chunk sizes (250 KB, 1 MB, 5 MB caps).
- Enforces a hard **10-second timeout** per phase with active `AbortController` cancellation.
- Respects `navigator.connection?.saveData` to prevent consuming metered data.
- **Zero Data Transmission:** Upload tests transmit synthetic zero-filled `Uint8Array` byte buffers. No user shortcuts, browsing data, profile names, or bookmarks are ever transmitted.

---

## 8. Privacy & Data Handling Model

| Data Item | Storage Location | Accessible By | Transmitted Externally? |
| :--- | :--- | :--- | :--- |
| Workspace Layouts & Elements | `chrome.storage.local` | DECKORA extension only | **NO** |
| User Shortcuts & URLs | `chrome.storage.local` | DECKORA extension only | **NO** |
| Workspace Profiles | `chrome.storage.local` | DECKORA extension only | **NO** |
| Uploaded Images & GIFs | IndexedDB (`aurora-assets-db`) | DECKORA extension only | **NO** |
| Custom Wallpapers | IndexedDB (`aurora-assets-db`) | DECKORA extension only | **NO** |
| Custom Fonts (WOFF/WOFF2) | IndexedDB (`aurora-assets-db`) | DECKORA extension only | **NO** |
| Search Queries | Immediate navigation | Configured search engine | Only on user search submit |
| Live Search Suggestions | Direct query to provider | Selected search provider | Only if opt-in enabled |
| Speed Test Telemetry | In-memory measurement | Cloudflare speed test CDN | Only synthetic ping/bytes |

---

## 9. Supply-Chain & Dependency Audit

- **Production Dependencies Audit (`pnpm audit --prod`):**
  - **0 Known Vulnerabilities** found.
  - All 19 production packages are actively verified, pinned in `pnpm-lock.yaml`, and free of known vulnerabilities.
- **Development Tooling Audit (`pnpm audit`):**
  - Found 1 moderate severity advisory: [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) in `minimatch` (`>=7.0.0 <11.0.1`).
  - *Dependency Path:* `typescript-eslint > @typescript-eslint/typescript-estree > minimatch`.
  - *Impact Assessment:* Development and linting only. This code runs solely during local `eslint .` invocations on developer machines. It is never packaged into `dist/` or shipped in the extension. The exploit requires feeding malicious glob patterns, which does not occur during internal static linting. Exploitability in DECKORA is **None (Zero Risk)**.

---

## 10. Security Risk Matrix & Conclusion

| Risk Area | Inherent Risk | Implemented Mitigation | Residual Risk |
| :--- | :--- | :--- | :--- |
| **XSS via Shortcut URLs** | High | Strict `sanitizeHttpUrl()` (`http:`/`https:` only) | Negligible |
| **Malicious Media Payload** | High | Binary magic-byte sniffing, dimension caps, raw SVG ban | Negligible |
| **Zip Slip File Overwrite** | High | Strict path normalization and path traversal rejection | Negligible |
| **Remote Code Execution** | Critical | Strict MV3 CSP (`script-src 'self'`), zero eval, no remote scripts | None |
| **Data Leakage / Telemetry** | High | Strictly local-first architecture, zero analytics | None |
| **Excessive Permissions** | Medium | Least privilege; bookmarks, search & hosts strictly opt-in | None |

**Conclusion:** DECKORA v0.1.0 complies with all relevant Chrome MV3 and open-source software security standards. It is cleared for public release.

