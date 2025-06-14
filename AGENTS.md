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
npm run format && npm run lint   # keep style & quality
npm run test                         # runs Jest

# proxy server
cd llm-proxy-server
npm install
npm run format && npm run lint
npm run test
```

> **Tip:** No global installs needed—everything comes from `devDependencies`.

---

## Scripts

For more details on the project structure and coding standards associated with these scripts, see CONTRIBUTING.md.

| Location | Script                | Purpose                                                         |
| -------- | --------------------- | --------------------------------------------------------------- |
| root     | `npm run format`      | Formats all files with Prettier                                 |
| root     | `npm run lint`        | ESLint + auto-fix; fails on remaining errs                      |
| root     | `npm run test`        | Runs root-level Jest suite                                      |
| root     | `npm run test:single` | If passing a module path, good for testing modules in isolation |
| root     | `npm run start`       | Builds then serves app with `http-server`                       |
| proxy    | `npm run format`      | Formats all files with Prettier                                 |
| proxy    | `npm run lint`        | ESLint + auto-fix; fails on remaining errs                      |
| proxy    | `npm run test`        | Runs proxy tests                                                |
| proxy    | `npm run start`       | Runs node API server                                            |

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

1. After code generation, run `npm run test` (root) and `cd llm-proxy-server && npm run test`.
2. If any tests fail, diagnose the failure, attempt auto-fix via `npm run lint` (root and proxy), then re-run tests.
3. If tests still fail, create a PR labeled “🚫 tests failing—needs human review” with logs included.

---

### Formatting Guidelines for Codex Agents

- Run `npm run format` in both the root and `llm-proxy-server` before any code changes are finalized.
- Use Prettier config at `.prettierrc.json`—agents should not override these rules.
- See CONTRIBUTING.md for more on coding standards.

---

## Linting

We use **ESLint** with Prettier integration, Jest rules, and JSDoc checks.  
Note: currently lint shows a huge amount of issues due to having started using lint very late in the project, so only
try to fix lint issues in the files you're working with. See CONTRIBUTING.md for policy.

```bash
npm run lint              # root
cd proxy-llm-server
npm run lint              # proxy
```

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

| Symptom                     | Fix                                  |
| --------------------------- | ------------------------------------ |
| Prettier changes on CI      | Run `npm run format` locally         |
| ESLint rule not auto-fixing | Address manually or adjust config    |
| Tests can’t find `jest`     | `rm -rf node_modules && npm install` |
| Port 8080 already in use    | `PORT=8081 npm run start`            |
| Proxy env vars missing      | Copy `.env.example` → `.env`         |

Remember to consult CONTRIBUTING.md for more detailed information on all aspects of contributing to this project.
