## Release Checklist

Use this checklist before cutting a new extension release.

### 1. Code and Type Safety

- `bun run compile` — Type-check the codebase (`tsc --noEmit`).

### 2. Internationalization

- `npm run check:i18n:dupes` — Ensure there are no duplicate i18n keys.
- `npm run check:i18n:coverage` — Verify required i18n keys exist in:
  - `src/assets/locale/*/common.json` (React UI).
  - `src/public/_locales/*/messages.json` (Chrome/Firefox locales).

### 3. Build Artifacts

- `bun run build` — Build extension bundles for Chrome, Firefox, and Edge.
- `bun run zip` (and/or `bun run zip:firefox`) — Generate release archives.

### 4. Tests and Automated Checks

- `npm run test:e2e` — Run Playwright end-to-end tests.
- Optionally, run targeted suites (e.g. `npm run test:e2e:perf`) as needed for the release.

### 5. Manual QA

- Smoke-test core flows in Chrome, Firefox, and Edge:
  - Options / Settings screens.
  - Sidepanel chat and tools UI (including tool call log & approval banner).
  - OCR/TTS, media review, and RAG/knowledge features.
  - Command palette shortcuts and labels in multiple locales.
- Confirm no obvious layout or localization regressions in non-English languages.

### 6. Documentation and Metadata

- Update any relevant docs under `docs/` (features, settings, known issues).
- Verify extension metadata (name, description, icons) is correct for the target stores.

