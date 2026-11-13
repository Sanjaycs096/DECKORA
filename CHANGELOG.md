# Changelog

All notable changes to **DECKORA — Your Personal Browser Workspace** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned

- Cloud backup sync options with user-provided encryption keys.
- Additional widget types: interactive to-do lists, sticky notes, and weather forecast.

---

## [0.1.0] - 2026-11-13

### Added

- **Recursive Nested Bookmarks Navigation:** Multi-level cascading flyout panels supporting arbitrary folder depth, hover activation, breadcrumb jump navigation, keyboard arrow controls (`ArrowRight`/`ArrowLeft`), and seamless pointer bridge transitions.
- **Master Edit Mode & Interactive Canvas Engine:** Sub-pixel freeform layout engine with drag-and-drop, selection bounding boxes, multi-element grouping/ungrouping, magnetic grid snapping, alignment guides, layer ordering, and full undo/redo transaction stack.
- **Real-Time Internet Speed Monitor Widget:** Live latency, download speed, and upload speed monitoring with on-demand testing and background scheduler support.
- **Multi-Profile Management:** Context switching across dedicated workspace profiles (Personal, Work, Study, Minimal, Creative, Custom) with individual layouts, themes, and curated navigation links.
- **Wallpaper & Background Studio:** Curated Royal Crystal gradients, custom solid palettes, user-uploaded image objects, animated GIFs, backdrop blur, dim scrim, and vignette atmosphere controls.
- **Smart Search & Shortcuts:** Multi-engine search switcher (Google, DuckDuckGo, Bing) with instant `/` shortcut focusing, and customizable 8-slot shortcut decks.
- **Dual Horizon Decks Brand Identity:** Modern lettermark "D" constructed from layered workspace decks in Ice Blue and Royal Violet, accompanied by high-DPI icons (16px, 32px, 48px, 128px), social preview banner (1280×640), and Chrome Web Store promotional assets.
- **Privacy & Security Foundation:** 100% local-first architecture. Zero telemetry, zero third-party CDNs, and zero external trackers. Media blobs persist securely in local IndexedDB (`aurora-assets-db`).
- **Comprehensive Quality Pipeline:** 30 automated test suites (128 passing tests in Vitest), ESLint validation, TypeScript strict mode, and unified cross-platform Prettier line-ending enforcement.
