## Description

Please include a summary of the change and which issue is fixed or feature implemented.

Fixes #(issue)

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Refactor or structure optimization (no functional changes)
- [ ] Documentation update
- [ ] Security enhancement

## Architectural & Security Verification

- [ ] Complies with Chrome MV3 security constraints (strict CSP, no remote scripts, no eval)
- [ ] Maintains local-first guarantee (zero analytics, zero external network leakage)
- [ ] Preserves backward compatibility of workspace state and IndexedDB schemas
- [ ] Exclusively uses Google Material Symbols Rounded (`<MaterialSymbol />`)
- [ ] All inputs validated via Zod schemas

## Verification Pipeline

- [ ] `pnpm format:check` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (all unit and integration tests)
- [ ] `pnpm build` completes without errors
- [ ] Tested locally as an unpacked Chrome extension in `chrome://extensions`

