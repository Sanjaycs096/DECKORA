# Locally Bundled Fonts & Iconography Licenses

DECKORA bundles all typography and iconography assets locally inside the extension bundle (`dist/assets/`) via `@fontsource-variable/*` packages to ensure zero external CDN dependencies, strict Manifest V3 CSP compliance, and instant offline rendering.

## Bundled Packages

1. **Inter (`@fontsource-variable/inter`)**
   - Role: Primary UI, inspector, body, and label typography (`Inter Variable`).
   - License: SIL Open Font License 1.1 (`OFL-1.1`).

2. **Manrope (`@fontsource-variable/manrope`)**
   - Role: Display, wordmark, headings, and clock numeral typography (`Manrope Variable`).
   - License: SIL Open Font License 1.1 (`OFL-1.1`).

3. **Google Material Symbols Rounded (`@fontsource-variable/material-symbols-rounded`)**
   - Role: Exclusive UI icon system across the entire DECKORA extension (`Material Symbols Rounded Variable`).
   - License: SIL Open Font License 1.1 (`OFL-1.1`) / Apache-2.0.

