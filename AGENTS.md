# Repository Guidelines

## Project Structure & Module Organization
Source for the browser runtime lives in `src/` (engine, AI, UI entry points, and designer tooling such as `coreMotivationsGenerator/`). Gameplay data and mods stay in `data/mods/`—treat these JSON packs as canonical content. Shared specs, fixtures, and mock scenes live under `tests/`, reusable automations in `scripts/`, docs in `docs/`, distribution bundles in `dist/`, and the standalone LLM proxy resides in `llm-proxy-server/`.

## Build, Test, and Development Commands
Run `npm run dev` to boot the engine alongside the proxy in watch mode; use `npm run start:all` for production-like manual testing. `npm run build` emits optimized bundles, and `npm run build:clean` resets stale artifacts. Content teams should validate data with `npm run validate:ecosystem` (fast variant `validate:quick`, hard gate `validate:strict`). Generate new modules via `npm run create-mod` and refresh manifests with `npm run update-manifest:validate`.

There are known issues with force exits when running tests, which we haven't been able to solve. Run individual test suites with --runInBand to prevent this. When executing a subset of tests (single files or targeted suites), ignore coverage thresholds—only enforce coverage on full-suite runs like `npm run test:ci`.

## Coding Style & Naming Conventions
Code is modern ES modules with TypeScript-friendly typings; favor descriptive folder names over mega-files. Prettier (`npm run format`) enforces two-space indentation, single quotes, and trailing commas. ESLint (flat config) is mandatory—`npm run lint` must pass with no `no-console` violations in browser code and the custom `mod-architecture/no-hardcoded-mod-references` rule satisfied. Use `camelCase` for functions, `PascalCase` for classes/components, and SCREAMING_SNAKE for shared constants.

## Testing Guidelines
Jest powers every suite. Use `npm run test:unit` for component and utility coverage, `npm run test:integration` + `test:integration:build` to verify bundle wiring, `npm run test:e2e` for narrative flows, and `npm run test:performance` / `test:memory` for regressions uncovered during profiling. `npm run test:ci` runs validation, type-checks, and the primary suites—treat it as the pre-push gate. Keep snapshots under `tests/__snapshots__` accurate, prefer deterministic fixtures, and mirror file names (`foo.test.js`) with the modules they exercise.

## Commit & Pull Request Guidelines
Commits follow short, imperative summaries (see `git log` entries like "Fixing many tests."). Reference related tickets or PR numbers in the body, include rationale for gameplay-affecting changes, and land schema edits alongside the scripts or data they require. PRs should describe scope, mention new commands or config keys, attach UI screenshots when relevant, and link validation/test logs (paste `npm run test:ci` output or attach coverage deltas).

## Security & Configuration Tips
Never commit secrets—LLM API keys, proxy credentials, or analytics tokens belong in untracked `.env` files (see `llm-proxy-server/README.md`). Run `npm run cleanup:ports` before `start:all` to avoid orphaned dev servers, and review `config/` plus `scripts/cleanup-ports.js` before changing network bindings or websocket ports.
