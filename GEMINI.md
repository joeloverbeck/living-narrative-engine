# Living Narrative Engine

## Project Overview
The **Living Narrative Engine** is a browser-based, data-driven text adventure engine built on an Entity Component System (ECS) architecture. It features deep integration with Large Language Models (LLMs) via a local proxy server to generate dynamic narrative content, character motivations, and dialogue.

**Key Characteristics:**
- **Language:** Modern JavaScript (ES Modules) with TypeScript type checking (`checkJs`).
- **Architecture:** ECS (Entities defined by JSON components).
- **Data-Driven:** Game content resides in `data/mods/` as JSON files.
- **AI Integration:** Dedicated `llm-proxy-server` for connecting to LLMs.

## Setup & Installation
1.  **Root Dependencies:**
    ```bash
    npm install
    ```
2.  **Proxy Server Dependencies:**
    ```bash
    cd llm-proxy-server
    npm install
    cd ..
    ```

## Development Workflow

### Running the Engine
To start both the game client and the LLM proxy server concurrently:
```bash
npm run dev
```
- **Client:** Served at `http://localhost:8080` (typically).
- **Proxy:** Runs on port 3001.

### Building
Build the distribution bundle (uses `esbuild`):
```bash
npm run build
```

### Validation (CRITICAL)
Because logic is data-driven, JSON validation is essential. Run this after *any* change to `data/mods/`:
```bash
npm run validate:ecosystem
```
*   `npm run validate:quick`: Faster, non-strict check.
*   `npm run validate:strict`: Full check (required for CI).

## Testing Strategy
**Framework:** Jest

- **Unit Tests:** `npm run test:unit` (Components/Utilities)
- **Integration:** `npm run test:integration` (Wiring/Systems)
- **E2E:** `npm run test:e2e` (Narrative flows)
- **CI Gate:** `npm run test:ci`

**Known Issue:** If tests hang or exit forcefully, use `--runInBand`:
```bash
npm run test:single -- tests/path/to/test.js
```

## Project Structure
- `src/`: Browser runtime source code.
- `data/mods/`: Canonical game content (JSON packs). **Do not hardcode content in `src/`.**
- `llm-proxy-server/`: Node.js server for LLM API handling.
- `scripts/`: Build, validation, and maintenance scripts.
- `tests/`: Shared specs and test fixtures.
- `AGENTS.md`: **Strict** detailed development and contribution guidelines.

## Development Guidelines
*   **Code Style:** Follow `AGENTS.md`. `camelCase` functions, `PascalCase` classes.
*   **Linting:** `npm run format` (Prettier).
    -   For better performance during development, use `npm run lint:staged` to lint only the currently staged JavaScript/TypeScript files.

*   **Mod Architecture:** Respect the namespace separation. Use `resolve-library-id` patterns if checking `data/mods` references.
*   **Commits:** Imperative summaries. See `AGENTS.md`.
