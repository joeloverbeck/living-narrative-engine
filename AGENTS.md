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
npm test          # runs Jest

# proxy server
cd llm-proxy-server
npm install
npm test
~~~

> **Tip:** No global installs needed—everything comes from `devDependencies`.

---

## Scripts

| Location | Script          | Purpose                         |
|----------|-----------------|---------------------------------|
| root     | `npm test`      | Runs root-level Jest suite      |
| root     | `npm run start` | Launches app with `http-server` |
| proxy    | `npm test`      | Runs proxy tests                |

---

## Linting & Formatting

We currently **do not** enforce linting.  
If you introduce ESLint/Prettier, ensure CI fails on lint errors and update this doc.

---

## Pull Requests

1. **Title format** – `[Fix] Short description`
2. **Description template**

~~~text
Summary: <one-line what/why>

Testing Done:
- [ ] Root tests `npm test`
- [ ] Proxy tests `cd llm-proxy-server && npm test`
- [ ] Manual smoke run `npm run start`
~~~

3. CI **must** be green before requesting review.

---

## Troubleshooting

| Symptom                  | Fix                                  |
|--------------------------|--------------------------------------|
| Tests can’t find `jest`  | `rm -rf node_modules && npm install` |
| Port 8080 already in use | `PORT=8081 npm run start`            |
| Proxy env vars missing   | Copy `.env.example` → `.env`         |