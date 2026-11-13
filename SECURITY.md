# Security Policy

## Overview

DECKORA is committed to ensuring the highest level of security and privacy for its users. Because DECKORA is a Chrome Extension that overrides the browser's New Tab page, security and privacy are core architectural priorities.

## Supported Versions

Only the latest release version on the `main` branch is supported for security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

## Architectural Security Commitments

1. **Local-First & Zero Telemetry**: DECKORA does not run analytics, user tracking, or remote telemetry. All workspace states, profiles, bookmarks, and shortcuts are stored exclusively inside the browser's local sandbox (`chrome.storage.local` and IndexedDB).
2. **Strict Manifest V3 CSP**: DECKORA enforces `script-src 'self'; object-src 'self';`. No remote executable code or `eval()` is ever permitted or executed.
3. **Least-Privilege Permissions**:
   - `storage`, `favicon`, and `alarms` are required core permissions.
   - `bookmarks` and `search` are strictly opt-in permissions requested via interactive browser permission dialogs when the user toggles those features.
   - Host permissions (`speed.cloudflare.com`, search suggestion APIs) are strictly opt-in and restricted.
4. **Defensive Input Handling**:
   - URL protocols are strictly sanitized to allow only `http:`, `https:`, and safe browser URLs. `javascript:`, `vbscript:`, and arbitrary `data:` URIs are strictly blocked.
   - Workspace imports enforce strict ZIP archive size limits, CRC32/SHA-256 integrity verification, canonical ZIP path validation (preventing directory traversal / Zip Slip), file magic-byte sniffing (PNG, JPEG, WebP, AVIF, GIF), and full Zod schema validation.

## Reporting a Vulnerability

If you discover a security vulnerability or potential risk in DECKORA:

1. **Do not create a public issue or discuss the vulnerability publicly.**
2. Please use **GitHub Private Vulnerability Reporting** via the repository's [Security Advisories](https://github.com/Sanjaycs096/DECKORA/security/advisories) tab.
3. Include detailed reproduction steps, the affected component or file path, and an assessment of the vulnerability's impact.
4. Allow reasonable time for the maintainers to review, reproduce, and remediate the issue before any public disclosure.

Thank you for helping keep DECKORA and its users secure.

