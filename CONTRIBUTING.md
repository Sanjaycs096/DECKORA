# Contributing to DECKORA

Thank you for your interest in contributing to **DECKORA — Your Personal Browser Workspace**!

DECKORA is built with React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, Zod, and Chrome Extension Manifest V3.

---

## Code of Conduct & Core Principles

Before contributing, please keep DECKORA's architectural invariants in mind:

1. **Local-First & Zero Telemetry**: We never add remote analytics, external telemetry, user tracking, or mandatory accounts.
2. **Strict Manifest V3 Security**: No `eval`, no inline script injection, no remote scripts, and least-privilege extension permissions.
3. **Design System & Iconography**: DECKORA strictly uses Google Material Symbols Rounded via `<MaterialSymbol />`. Do not introduce secondary icon libraries (`lucide-react`, `react-icons`, etc.).
4. **Data Integrity & Schema Safety**: All storage operations must validate against Zod schemas and maintain backward compatibility.

---

## Development Setup

### Prerequisites

- **Node.js**: v20.x or v22.x+
- **pnpm**: v10.x+
- **Google Chrome**: Modern release supporting MV3

### Installation

```bash
# Clone the repository
git clone https://github.com/Sanjaycs096/DECKORA.git
cd DECKORA

# Install dependencies using frozen lockfile
pnpm install --frozen-lockfile
```

### Development Scripts

```bash
# Start Vite development server
pnpm dev

# Run TypeScript type check
pnpm typecheck

# Check code formatting with Prettier
pnpm format:check

# Format code automatically
pnpm format

# Run ESLint
pnpm lint

# Run Vitest test suite
pnpm test

# Run tests with coverage
pnpm test:coverage

# Build the unpacked Chrome MV3 extension
pnpm build
```

---

## Loading the Extension in Google Chrome

1. Run `pnpm build` to compile the extension into `dist/`.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click **Load unpacked** in the top-left toolbar.
5. Select the `dist/` directory inside your project folder.
6. Open a new tab in Chrome to see DECKORA in action!

---

## Branching Conventions

- Create feature or fix branches from `main`.
- Branch naming guidelines:
  - `feat/<short-description>`: New features or UI components
  - `fix/<short-description>`: Bug fixes and security patches
  - `refactor/<short-description>`: Code organization or internal cleanups
  - `docs/<short-description>`: Documentation improvements

---

## Commit Guidelines

We follow the Conventional Commits specification:

- `feat: <description>`
- `fix: <description>`
- `docs: <description>`
- `style: <description>`
- `refactor: <description>`
- `test: <description>`
- `chore: <description>`

Examples:

- `feat: add vertical layout option to shortcuts widget`
- `fix: sanitize URL protocols before opening links`
- `docs: update installation instructions in README`

---

## Quality & Testing Expectations

Every Pull Request must pass the full automated verification pipeline before merging:

1. `pnpm format:check` — Prettier styling
2. `pnpm typecheck` — Strict TypeScript checking with zero errors
3. `pnpm lint` — ESLint rules including restricted imports and hooks
4. `pnpm test` — 100% passing Vitest test suite
5. `pnpm build` — Clean production compilation producing a working `dist/`

---

## Submitting a Pull Request

1. Fork the repository and create your branch from `main`.
2. Implement your changes following project conventions.
3. Ensure all tests and lint checks pass locally.
4. Push to your fork and submit a Pull Request to `DECKORA:main`.
5. Fill out the PR template completely, noting any security or schema implications.
