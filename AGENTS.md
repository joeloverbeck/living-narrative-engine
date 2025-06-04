# AGENTS.md

## Overview

This repository contains two Node projects:

| Path                | Purpose             |
|---------------------|---------------------|
| `/`                 | App + tests         |
| `/llm-proxy-server` | Proxy micro-service |

All commands assume **Node ≥ 20** and **npm ≥ 10** (use `nvm use` if you have multiple versions).

---

## Quick Start

~~~bash
# root app
npm install
npm run format && npm run lint   # keep style & quality
npm test                         # runs Jest

# proxy server
cd llm-proxy-server
npm install
npm test
~~~

> **Tip:** No global installs needed—everything comes from `devDependencies`.

---

## Scripts

| Location | Script           | Purpose                                    |
|----------|------------------|--------------------------------------------|
| root     | `npm run format` | Formats all files with Prettier            |
| root     | `npm run lint`   | ESLint + auto-fix; fails on remaining errs |
| root     | `npm test`       | Runs root-level Jest suite                 |
| root     | `npm run start`  | Builds then serves app with `http-server`  |
| proxy    | `npm test`       | Runs proxy tests                           |

---

## Formatting

We enforce **Prettier**.  
Run it before committing or running tests:

~~~bash 
npm run format            # root
~~~

CI will fail if files are not correctly formatted.

---

## Linting

We use **ESLint** with Prettier integration, Jest rules, and JSDoc checks.  
Note: currently lint shows a huge amount of issues due to having started using lint very late in the project,
so only try to fix lint issues in the files you're working with.

~~~bash
npm run lint              # root
~~~

---

## Pull Requests

1. **Title format** – `[Fix] Short description`
2. **Description template**

~~~text
Summary: <one-line what/why>

Testing Done:
- [ ] Code formatted     `npm run format`
- [ ] Lint passes        `npm run lint`
- [ ] Root tests         `npm test`
- [ ] Proxy tests        `cd llm-proxy-server && npm test`
- [ ] Manual smoke run   `npm run start`
~~~

3. CI **must** be green before requesting review.

---

## Troubleshooting

| Symptom                     | Fix                                  |
|-----------------------------|--------------------------------------|
| Prettier changes on CI      | Run `npm run format` locally         |
| ESLint rule not auto-fixing | Address manually or adjust config    |
| Tests can’t find `jest`     | `rm -rf node_modules && npm install` |
| Port 8080 already in use    | `PORT=8081 npm run start`            |
| Proxy env vars missing      | Copy `.env.example` → `.env`         |