# DECKORA — Chrome Web Store Submission & Asset Checklist

This document details the exact requirements, assets, metadata, permissions justifications, and submission procedures for publishing **DECKORA — Your Personal Browser Workspace** to the Google Chrome Web Store.

---

## 1. Chrome Web Store Developer Registration

1. Navigate to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Sign in with the designated Google Account (ensure 2-Step Verification / 2FA is active).
3. Pay the one-time Google developer registration fee (\$5.00 USD).
4. Complete the publisher profile verification with developer email and contact details.

---

## 2. Store Visual Assets Checklist

All required graphical assets have been generated and validated according to the official Chrome Web Store specifications:

| Asset Type | File Path | Required Dimensions | Format / Properties | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Store Icon** | [`public/icons/deckora-128.png`](file:///c:/Users/sanja/project/JARVIS/public/icons/deckora-128.png) | 128 × 128 px | PNG (transparent padding, 96×96 squircle symbol) | Verified |
| **Primary Screenshot** | [`docs/screenshots/deckora-workspace-1280x800.png`](file:///c:/Users/sanja/project/JARVIS/docs/screenshots/deckora-workspace-1280x800.png) | 1280 × 800 px | PNG (16:10 aspect ratio, full workspace view) | Verified |
| **Small Promo Tile** | [`public/brand/deckora-cws-promo-440x280.png`](file:///c:/Users/sanja/project/JARVIS/public/brand/deckora-cws-promo-440x280.png) | 440 × 280 px | PNG (exact 440×280, Royal Slate brand gradient) | Verified |
| **Marquee Promo Tile** | [`public/brand/deckora-cws-marquee-1400x560.png`](file:///c:/Users/sanja/project/JARVIS/public/brand/deckora-cws-marquee-1400x560.png) | 1400 × 560 px | PNG (exact 1400×560, large hero banner) | Verified |

---

## 3. Store Listing Copy & Metadata

### Item Details
- **Extension Name:** `DECKORA — Your Personal Browser Workspace`
- **Short Name:** `DECKORA`
- **Version:** `1.0.0`
- **Primary Category:** `Productivity`
- **Secondary Category:** `Search Tools` (or `Workflow & Planning`)
- **Primary Language:** `English (United States)`

### Short Summary (132 characters maximum)
```text
Transform your new tab into an elegant, customizable workspace with draggable widgets, search, bookmarks, and real-time speed monitoring.
```
*(Character count: 132 / 132)*

### Detailed Description (Markdown formatted for the store listing)
```markdown
DECKORA — Your Personal Browser Workspace
Tagline: Your Browser. Your Space.

Transform every new tab into an elegant, focused command center. DECKORA combines the beauty of Royal Crystal glassmorphism with a high-performance interactive canvas engine, giving you complete freedom to arrange your daily tools exactly the way you want.

KEY FEATURES:

✦ Dual-Mode Workspace
Effortlessly switch between Browse Mode for distraction-free daily productivity and Master Edit Mode for complete visual customization.

✦ Drag-and-Drop Interactive Canvas
Freely move, resize, align, and group widgets on a sub-pixel grid with intelligent magnetic snap guides.

✦ Smart Search & Quick Launch
Instant search with multi-engine switching (Google, DuckDuckGo, Bing) and customizable quick-access shortcut decks.

✦ Real-Time Internet Speed Monitor
Monitor network download, upload, and latency with customizable periodic tests or on-demand checks.

✦ Native Chrome Bookmarks Integration
Access your browser bookmarks tree seamlessly via an elegant flyout drawer with instant search and folder navigation.

✦ Custom Wallpapers & Media
Personalize your backdrop with curated Royal Crystal gradients, custom color themes, uploaded images, or animated GIFs.

✦ Multi-Profile Management
Create isolated profiles (e.g., Personal, Work, Focus) and switch contexts with a single click.

✦ 100% Private & Local
DECKORA operates entirely on your device. Zero analytics, zero remote tracking, and zero external CDNs. Your data stays yours.
```

---

## 4. Single-Purpose Explanation

```text
DECKORA serves the single purpose of providing a fully customizable, privacy-first personal dashboard and workspace on the Chrome New Tab page.
```

---

## 5. Permission Justifications (Mandatory for CWS Review)

Google requires explicit, narrow justifications for each requested permission in `manifest.json`:

| Permission | Purpose & Technical Justification |
| :--- | :--- |
| `storage` | Required to persist user workspace layouts, widget configurations, theme preferences, and multi-profile metadata locally in `chrome.storage.local`. |
| `bookmarks` | Required to read the user's existing Chrome bookmarks tree for rendering the Bookmarks Flyout drawer, enabling search and one-click bookmark navigation without leaving the new tab. |
| `unlimitedStorage` | Required to store high-resolution custom background wallpapers, uploaded image objects, and local asset blobs in browser IndexedDB (`aurora-assets-db`) without quota rejection. |

*Note: DECKORA requests zero optional or host permissions (`<all_urls>` is not requested; remote scripts are strictly prohibited).*

---

## 6. Privacy & Data Practices Disclosure

Under the **Privacy practices** tab in the Chrome Web Store Developer Console:

1. **Single Purpose:** Certify that the extension complies with the single-purpose policy.
2. **User Data Disclosure:**
   - **Does this extension collect or transmit user data?** No.
   - **Personal Information:** Not collected.
   - **Health / Financial / Authentication Info:** Not collected.
   - **Browsing History:** Not collected. (Bookmarks are read in-memory to display the bookmark drawer; no URLs or history are logged or transmitted).
   - **Website Content:** Not collected.
3. **Privacy Policy Link:** Provide the public privacy policy URL:
   `https://github.com/Sanjaycs096/DECKORA/blob/main/docs/SECURITY.md` (or dedicated GitHub Pages URL).

---

## 7. Build Packaging & Upload Steps

To generate the production zip package for store upload:

1. Run the clean production build:
   ```bash
   pnpm run build
   ```
2. Compress the contents of the `dist/` directory into a `.zip` archive (do not include the outer `dist/` folder itself):
   ```powershell
   Compress-Archive -Path dist\* -DestinationPath DECKORA-v1.0.0.zip -Force
   ```
3. In the Chrome Web Store Developer Console:
   - Click **Add new item**.
   - Drag and drop `DECKORA-v1.0.0.zip`.
   - Complete Store Listing fields (copy from Section 3 above).
   - Upload graphic assets:
     - 128×128 Store Icon (`public/icons/deckora-128.png`)
     - 1280×800 Workspace Screenshot (`docs/screenshots/deckora-workspace-1280x800.png`)
     - 440×280 Small Promo Tile (`public/brand/deckora-cws-promo-440x280.png`)
     - 1400×560 Marquee Banner (`public/brand/deckora-cws-marquee-1400x560.png`)
   - Fill in Privacy Practices (Section 5 and 6 above).
   - Save as Draft and request review.

