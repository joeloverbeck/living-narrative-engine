# AGENTS.md

## Overview

This `AGENTS.MD` file provides a quick reference for AI agents working on the Living Narrative Engine repository. For
comprehensive contribution guidelines, including coding standards, JSDoc requirements, testing procedures, and details
on the modding system, **please refer to the main [CONTRIBUTING.md](CONTRIBUTING.md) file located in the root of this
repository.**

This repository contains two Node projects:

| Path                | Purpose             |
| ------------------- | ------------------- |
| `/`                 | App + tests         |
| `/llm-proxy-server` | Proxy micro-service |

All commands assume **Node ≥ 20** and **npm ≥ 10** (use `nvm use` if you have multiple versions).

---

## Quick Start

Make sure to consult [CONTRIBUTING.md](CONTRIBUTING.md) for detailed setup and environment information.

```bash
# root app
npm install
npm run format
npm run lint   # keep style & quality
npm run test   # runs Jest

# proxy server
cd llm-proxy-server
npm install
npm run format
npm run lint
npm run test
```

> **Tip:** No global installs needed—everything comes from `devDependencies`.

---

## Scripts

For more details on the project structure and coding standards associated with these scripts, see CONTRIBUTING.md.

### Core Development Scripts

| Location | Script                | Purpose                                                         |
| -------- | --------------------- | --------------------------------------------------------------- |
| root     | `npm run format`      | Formats all files with Prettier                                 |
| root     | `npm run lint`        | ESLint + auto-fix; fails on remaining errs                      |
| root     | `npm run typecheck`   | TypeScript type checking for JavaScript files                   |
| root     | `npm run scope:lint`  | Validate scope DSL files                                        |
| root     | `npm run start`       | Builds then serves app with `http-server`                       |
| root     | `npm run dev`         | Runs app + proxy server concurrently                            |
| root     | `npm run start:all`   | Start both app and proxy services                               |
| proxy    | `npm run format`      | Formats all files with Prettier                                 |
| proxy    | `npm run lint`        | ESLint + auto-fix; fails on remaining errs                      |
| proxy    | `npm run typecheck`   | TypeScript type checking                                        |
| proxy    | `npm run start`       | Runs node API server                                            |
| proxy    | `npm run dev`         | Runs server with file watching                                  |

### Testing Scripts

| Location | Script                    | Purpose                                                         |
| -------- | ------------------------- | --------------------------------------------------------------- |
| root     | `npm run test:unit`       | Unit tests with coverage (80%+ requirement)                     |
| root     | `npm run test:integration`| Integration tests with coverage                                 |
| root     | `npm run test:e2e`        | End-to-end tests with coverage                                  |
| root     | `npm run test:performance`| Performance and benchmark tests                                 |
| root     | `npm run test:memory`     | Memory leak detection tests                                     |
| root     | `npm run test:single`     | Sequential test execution for debugging                         |
| root     | `npm run test:ci`         | Complete CI test suite (unit + integration + e2e)               |
| proxy    | `npm run test`            | Full proxy test suite with coverage                             |
| proxy    | `npm run test:unit`       | Unit tests only                                                 |
| proxy    | `npm run test:integration`| Integration tests                                               |
| proxy    | `npm run test:e2e`        | End-to-end tests                                                |
| proxy    | `npm run test:single`     | Sequential test execution for debugging                         |

### Build Scripts

| Location | Script                | Purpose                                                         |
| -------- | --------------------- | --------------------------------------------------------------- |
| root     | `npm run build`       | Production build with esbuild                                   |
| root     | `npm run build:dev`   | Development build                                               |
| root     | `npm run build:prod`  | Production optimized build                                      |
| root     | `npm run build:watch` | Build with file watching                                        |

### Validation Scripts

| Location | Script                    | Purpose                                                         |
| -------- | ------------------------- | --------------------------------------------------------------- |
| root     | `npm run validate`        | Validate all mods                                               |
| root     | `npm run validate:ecosystem` | Validate mod ecosystem references                            |
| root     | `npm run validate:strict` | Strict validation with failure on warnings                      |
| root     | `npm run update-manifest` | Update mod manifests                                            |

---

### JSDoc Requirements for AI Agents

- Every new function or class must include `@description`, `@param`, and `@returns` tags.
- Complex types should use `@typedef` blocks. Agents should follow the examples in CONTRIBUTING.md.

---

### Context Pointers for Agents

- For core game logic, start with `src/engine/gameEngine.js`.
- Always reference the function signature at the top of each file before writing or editing code.

---

### Agent Testing Workflow

1. After code generation, run the appropriate test suite based on your changes:
   - For unit tests: `npm run test:unit` (root) and `cd llm-proxy-server && npm run test:unit`
   - For integration tests: `npm run test:integration` (both root and proxy)
   - For complete testing: `npm run test:ci` (root) - runs unit, integration, and e2e tests
   - For debugging: `npm run test:single` (runs tests sequentially)

2. If any tests fail, diagnose the failure, attempt auto-fix via `npm run lint` (root and proxy), then re-run tests.

3. If tests still fail, create a PR labeled "🚫 tests failing—needs human review" with logs included.

4. Test Organization:
   - **Unit tests**: `tests/unit/` - Mirror the src/ structure for easy navigation
   - **Integration tests**: `tests/integration/` - End-to-end workflow testing
   - **E2E tests**: `tests/e2e/` - Full application flow testing
   - **Performance tests**: `tests/performance/` - Load and benchmark testing
   - **Memory tests**: `tests/memory/` - Memory leak detection
   - **Test helpers**: `tests/common/` - Reusable test utilities, mocks, and builders

5. Coverage Requirements:
   - **Branches**: 80% minimum
   - **Functions**: 90% minimum
   - **Lines**: 90% minimum
   - Tests must pass before marking any task complete

---

### Formatting Guidelines for Codex Agents

- Run `npm run format` in both the root and `llm-proxy-server` before any code changes are finalized.
- Use Prettier config at `.prettierrc.json`—agents should not override these rules.
- See CONTRIBUTING.md for more on coding standards.

---

## Linting

We use **ESLint** with Prettier integration, Jest rules, and JSDoc checks.

### Performance Strategy for Large Codebases

Due to the large number of existing lint issues (project started using ESLint late), follow this approach:

1. **For modified files only**: Use `npx eslint <file-paths>` to lint specific files you've changed
   - Example: `npx eslint src/entities/entityManager.js src/events/eventBus.js`
   - This avoids timeout issues on large codebases

2. **For full codebase**: Use `npm run lint` (may timeout, use with caution)

3. **Auto-fix pattern**: ESLint will auto-fix many issues; review remaining errors manually

```bash
# Lint specific files (recommended for agents)
npx eslint src/path/to/modified/file.js --fix

# Full lint (may timeout)
npm run lint              # root
cd llm-proxy-server
npm run lint              # proxy
```

**Important**: Only fix lint issues in files you modify. Do not attempt to fix all lint issues across the entire codebase.

---

### Branch & PR Naming Conventions for Agents

- Branch format: `feature/agent-{short-description}`, e.g., `feature/agent-add-login-endpoint`.
- PR title format: `[Agent] {One-line summary}`.

```text
Summary: <one-line what/why>

Testing Done:
- [ ] Code formatted     `npm run format`
- [ ] Lint passes        `npm run lint`
- [ ] Root tests         `npm run test`
- [ ] Proxy tests        `cd llm-proxy-server && npm run test`
- [ ] Manual smoke run   `npm run start`
```

3. CI **must** be green before requesting review.

---

## Troubleshooting

| Symptom                     | Fix                                        |
| --------------------------- | ------------------------------------------ |
| Prettier changes on CI      | Run `npm run format` locally               |
| ESLint rule not auto-fixing | Address manually or adjust config          |
| Tests can't find `jest`     | `rm -rf node_modules && npm install`       |
| Port 8080 already in use    | `PORT=8081 npm run start`                  |
| CORS errors from 8081       | Already supported - check proxy is running |
| Proxy env vars missing      | Copy `.env.example` → `.env`               |

Remember to consult CONTRIBUTING.md for more detailed information on all aspects of contributing to this project.
