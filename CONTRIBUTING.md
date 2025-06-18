# Contributing to Living Narrative Engine

Thank you for your interest in contributing to the Living Narrative Engine! Whether you're a human developer or an AI
agent, your help is valuable. To ensure consistency, maintainability, and a smooth development process, please adhere to
the guidelines outlined below.

## Philosophy

Living Narrative Engine is designed to be **extremely moddable** and **data-driven**. Contributions should respect this
philosophy by favoring configurable, data-defined solutions over hard-coded logic where appropriate. Understanding the
Entity Component System (ECS) principles and the modding system (as detailed in `README.md`) will be beneficial.

## Getting Started & Development Environment

Our project consists of two main parts: the client-side browser application (root) and a Node.js based LLM proxy
server (`llm-proxy-server`).

### Prerequisites

- **Node.js**: Version 20.x or newer (e.g., `20.10.0` or as specified in `.nvmrc` if present).
- **npm**: Version 10.x or newer (comes with Node.js typically).
  - Use `nvm use` if you have `nvm` (Node Version Manager) installed to switch to the project's recommended Node
    version.

### Initial Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/your-username/living-narrative-engine.git
   cd living-narrative-engine
   ```

2. **Install Root Project Dependencies:**

   ```bash
   npm install
   ```

3. **Install LLM Proxy Server Dependencies:**
   ```bash
   cd llm-proxy-server
   npm install
   cd ..
   ```

### Running The Application

- **To run both the main app and the LLM proxy server (recommended for full functionality):**
  ```bash
  npm run start:all
  ```
- **To run both with the LLM proxy server in development/watch mode:**
  ```bash
  npm run dev
  ```
- **To run only the main application (client-side, LLM features will not connect):**

  ```bash
  npm run start
  ```

  This builds the client-side assets into the `dist/` folder and serves them using `http-server`.

- **To run only the LLM proxy server:**
  Navigate to the `llm-proxy-server` directory:
  ```bash
  cd llm-proxy-server
  npm run start # For production-like start
  # or
  npm run dev   # For development with auto-reloading
  ```

## Project Structure

Familiarize yourself with the main project directories:

- `config/`: Contains configuration files, primarily for Large Language Models (LLMs) and logging.
- `css/`: Stylesheets used by the web application.
- `data/`: Crucial for the data-driven nature of the engine. Contains:
  - Mods (game content, rules, entities, etc., in subdirectories).
  - Schemas (JSON schemas for validating mod files and other data structures).
    Operation schemas live in `data/schemas/operations/` with one file per
    operation type.
  - Core game configuration like `game.json`.
- `docs/`: Contains documentation, including guides on JSON Logic usage and other engine systems.
- `llm-proxy-server/`: A separate Node.js sub-project. This acts as an API server to proxy requests to various LLM
  services. It has its own `package.json`, tests, and source code.
- `src/`: Main JavaScript source code for the client-side engine.
- `tests/`: Contains Jest tests for the root client-side application.
- `dist/`: (Generated) Contains the built application files for serving. Not to be committed directly.

## Coding Standards

### Formatting

- **Prettier**: This project uses Prettier for automated code formatting. Ensure code is formatted before committing.
  - Run `npm run format` from the **root directory** to format all relevant files in both the root project and
    `llm-proxy-server`.
- Configuration is in `.prettierrc.json`.

### Linting

- **ESLint**: ESLint is used for static code analysis.
  - Run `npm run lint` from the **root directory** to lint files there.
  - Run `npm run lint` from the **`llm-proxy-server` directory** (`cd llm-proxy-server && npm run lint`) to lint files
    specific to the proxy server.
- Configuration is in `eslint.config.js` (root) and potentially another in `llm-proxy-server/`. We extend
  `eslint:recommended`, `eslint-config-prettier`.
- **eslint-plugin-jsdoc**: This plugin is used to validate JSDoc comments.
- **Important Note for AI Agents (and humans):** The project currently has a backlog of linting issues. When modifying
  existing files, prioritize fixing lint issues within the scope of your changes. For new files, ensure they are
  lint-free.

### Module System

- The project primarily uses **ES Modules (ESM)** (`import`/`export` syntax) for JavaScript files, especially in `src/`.

### Naming Conventions

- **Variables and Functions**: Use `camelCase` (e.g., `loadModData`).
- **Constants**: Use `UPPER_SNAKE_CASE` (e.g., `DEFAULT_ENTITY_HEALTH`).
- **Classes and Constructors**: Use `PascalCase` (e.g., `ModLoaderService`).
- **File Names**: Use `camelCase.js` (e.g., `entityMananger.js`) or `kebab-case.js` for utility files or components. Be
  consistent within a directory.
- Names should be descriptive and unambiguous.

### General Practices

- **Single Responsibility Principle (SRP)**: Functions and classes should be small, focused, and do one thing well.
- **Modularity**: Adhere to the project structure. Create clear module interfaces using `export`.
- **Centralized Utility Imports**: Use `src/utils/index.js` to import common utilities like logger helpers and object helpers.
- **Minimize Side Effects**: Prefer pure functions where possible, especially for data transformation and game logic.
- **Immutability**: Favor immutable data structures and updates where practical to simplify state management and
  debugging.
- **Asynchronous Operations**: Use `async/await` for Promises.

### AI Agent Roles & Boundaries

- **Feature Development:** Agents may create new features to their full extent.
- **Bug Fixing:** Agents can attempt to reproduce, fix, and test any failing test cases, including linting issues.
- **Documentation Updates:** Agents can update or generate JSDoc blocks, but PRs must be flagged for human doc review.
- **Modding & Data‐Driven Changes:** Agents can generate or validate JSON-based mod files but must follow JSON schema
  conventions under `data/schemas/`.
- **Testing:** Agents must write or update Jest tests covering new or modified modules. Use the Arrange-Act-Assert
  pattern.
- **Versioning:** Agents may propose version bumps and changelog entries, but humans must verify them. If an agent
  updates package.json from 1.2.3 to 1.2.4, a human should confirm change log accuracy before merging. Use a PR template
  reminding agents to include:

```markdown
## Changelog Entry

- **[1.2.4] – 2025-06-04**
  - Fixed bug in `authenticateUser` error handling (#123)
  - Improved JSDoc for `errorHandler.js`
```

### AI-Generated Code Review Checklist

- [ ] Runs `npm run lint` and produces zero errors in the files the agents have modified.
- [ ] Includes complete JSDoc per CONTRIBUTING.md.
- [ ] Passes all Jest tests at 100% or higher coverage for modified modules.
- [ ] No significant performance regressions.
- [ ] Security scan results are clean (if adding new dependencies or modules).

## JSDoc Commenting Standards

Comprehensive JSDoc commenting is **mandatory** for this project. It serves multiple purposes:

1. Clear documentation for human developers.
2. A "schema" or "API contract" for agentic AI systems contributing to the codebase.
3. Improved IDE support and type checking assistance.

- All exported functions, classes, methods, and complex data structures (`@typedef`) **must** have JSDoc blocks.
- Use JSDoc types consistently (e.g., `{string}`, `{number}`, `{boolean}`, `{object}`, `{Array<MyType>}`, custom
  `@typedef` names).
- For complex object parameters or return types where a `@typedef` is not yet defined inline, consider defining a
  `@typedef` for clarity.

### Key JSDoc Tags and Usage

The following table outlines recommended JSDoc tags and their purpose within this project:

| JSDoc Tag      | Purpose in this Project                                                                                         | Example Snippet (Conceptual)                                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@description` | Provide a clear summary of the function/class/module's purpose.                                                 | `/** @description Manages the loading and processing of game mods. */`                                                                                                              |
| `@param`       | Define type, name, and purpose of each function/method parameter. Essential for function contracts.             | `/** @param {string} modId - The unique identifier for the mod. */`<br/>`/** @param {ModData[]} modsToProcess - Array of raw mod data objects. */`                                  |
| `@returns`     | Define type and meaning of a function's/method's return value.                                                  | `/** @returns {Promise<ProcessedMod>} A promise resolving to the processed mod data. */`<br/>`/** @returns {boolean} True if the action was successful, false otherwise. */`        |
| `@typedef`     | Define the structure of custom data objects (e.g., entity definitions, action payloads). Acts as a schema.      | `/** @typedef {object} EntitySchema @property {string} id - Unique ID. @property {string} name - Display name. @property {object.<string, any>} components - Entity components. */` |
| `@property`    | Used within `@typedef` or for class properties to define type, name, and description.                           | `/** @property {string} characterName - The name of the character. */`                                                                                                              |
| `@type`        | Specify the type of a variable, constant, or class property, especially if complex or not immediately inferred. | `/** @type {Map<string, Entity>} */`<br/>`this.entities = new Map();`                                                                                                               |
| `@example`     | Illustrate usage for functions/methods with non-obvious inputs or to show typical integration.                  | `/** @example const player = world.getEntityById('player'); */`                                                                                                                     |
| `@throws`      | Document specific, explicitly thrown errors a function/method might produce.                                    | `/** @throws {Error} If the mod manifest is malformed. */`                                                                                                                          |
| `@module`      | Define the module name, especially for files representing a logical unit or service.                            | `/** @module ModLoaderService */`                                                                                                                                                   |
| `@see`         | Refer to other relevant documentation, code sections, or concepts.                                              | `/** @see {@link module:RuleEngine} for how conditions are evaluated. */`<br/>`/** @see README.md section on Mod Manifest. */`                                                      |
| `@async`       | Indicate that a function is asynchronous (returns a Promise). Redundant if `@returns {Promise<... S>}` is used. | `/** @async */`                                                                                                                                                                     |
| `@private`     | Indicate that a member should be considered private (though JS doesn't enforce true private).                   | `/** @private */`                                                                                                                                                                   |
| `@since`       | Indicate when a feature or module was added (version or date).                                                  | `/** @since 0.1.0 */`                                                                                                                                                               |
| `@deprecated`  | Mark a function or feature as deprecated. Provide alternatives if available.                                    | `/** @deprecated since 0.2.0. Use `newImprovedFunction()` instead. */`                                                                                                              |
| `@todo`        | Note pending tasks or improvements directly in the code.                                                        | `/** @todo Implement caching for loaded mod assets. */`                                                                                                                             |
| `@class`       | Used for JSDoc blocks describing a class.                                                                       | `/** @description Represents a game entity within the engine. @class */`                                                                                                            |
| `@extends`     | Used with `@class` to indicate inheritance.                                                                     | `/** @extends {BaseComponent} */`                                                                                                                                                   |
| `@fires`       | Document events that a class or module might emit.                                                              | `/** @fires LivingNarrativeEngine#modLoaded */`                                                                                                                                     |

## Testing

Comprehensive testing is crucial for maintaining the stability of the engine, especially given its data-driven and
moddable nature.

- **Framework**: All tests are written using **Jest**.
- **Root Project Tests**:
  - Located in the `tests/` directory.
  - Run using `npm run test` from the root directory.
  - These tests run in a `jsdom` environment to simulate a browser.
  - Check test coverage using `npm run coverage` from the root directory.
- **LLM Proxy Server Tests**:
  - Located in the `llm-proxy-server/tests/` directory.
  - Run using `npm run test` from within the `llm-proxy-server` directory (`cd llm-proxy-server && npm run test`).
- **Test Structure**: Follow the **Arrange-Act-Assert (AAA)** pattern for clarity.
- **Coverage**: Aim for high code coverage. New features should ideally be accompanied by tests.
- **Mocks**: Utilize `jest.mock()` or `jest-mock-extended` for mocking dependencies.
- **Agentic testing**: AI Agents should generate new tests with comprehensive edge-case coverage, not just minimal
  passing tests.

**Before committing, ensure all tests pass in both the root project and the `llm-proxy-server`.**

## Committing Code and Pull Requests

1. **Pre-Commit Checks**:

   - Format your code: `npm run format` (from root).
   - Lint\_ your code: `npm run lint` (from root) AND `cd llm-proxy-server && npm run lint`. Address new errors an
   - Run all tests: `npm run test` (from root) AND `cd llm-proxy-server && npm run test`. Ensure they all pass.

2. **Commit Messages**:

   - Write clear, concise, and descriptive commit messages.
   - Follow conventional commit message formats if possible (e.g., `feat: add new targeting system`,
     `fix: resolve issue with item parsing`).

3. **Pull Requests (PRs)**:

   - **Title Format**: `[Scope/Type] Short description of the change`
     - Examples: `[Fix] Resolve mod loading circular dependency bug`, `[Feat] Implement weather system component`,
       `[Docs] Update JSDoc for EntityService`
   - **Description**: Use the following template (as also noted in `AGENTS.md`):

     ```text
     Summary: <One-line summary of what this PR does and why it's needed.>

     Changes Made:
     - <Detailed point 1>
     - <Detailed point 2>
     - ...

     Testing Done:
     - [ ] Code formatted (`npm run format` from root)
     - [ ] Lint passes (`npm run lint` in root AND `llm-proxy-server`)
     - [ ] Root tests pass (`npm run test` in root)
     - [ ] Proxy server tests pass (`cd llm-proxy-server && npm run test`)
     - [ ] Manual smoke test / User validation (Describe what was tested)

     Related Issues:
     - Closes #<issue_number> (if applicable)

     Notes for Reviewers:
     - <Any specific points to focus on, or questions for the reviewer>
     ```

   - Ensure your branch is up-to-date with the main branch before submitting.
   - CI checks (if configured) must pass before a PR can be merged.

## Mod Development Specifics

Given the engine's reliance on mods defined in the `data/` directory:

- When adding or modifying game logic, entities, actions, or rules, you will likely be working with JSON files within a
  mod's directory (e.g., `data/core/items/healing_potion.json`).
- Familiarize yourself with the `mod.manifest.json` structure and its importance for defining mod metadata,
  dependencies, and conflicts.
- Refer to `README.md` for detailed information on:
  - Mod structure and `mod.manifest.json`.
  - Dependency and conflict resolution rules (D1-D3, C1-C2).
  - Engine version compatibility (`gameVersion` in manifest, Rule E1).
  - JSON schema validation for mod files.
- Consult `docs/` for guides on using JSON Logic for rule definitions and other specific systems.

## Understanding the Engine and its Data-Driven Nature

- **README.md**: The primary source for understanding the project's architecture, modding system, data flow, and ECS
  principles.
- **`docs/` directory**: Contains more specific documentation on various sub-systems like JSON Logic usage.
- **Turn Processing Events ➜ docs/events/turn_processing_events.md**: Details on the events dispatched when any actor's turn starts or ends.
- **Existing Code in `src/` and `data/`**: Reading existing modules and core mod data can provide valuable insight into
  how things work.

## Reporting Issues

If you encounter bugs, have suggestions for improvements, or want to discuss new features, please open an issue on the
project's GitHub issue tracker. Provide as much detail as possible, including:

- Steps to reproduce (for bugs).
- Expected behavior.
- Actual behavior.
- Engine version (if applicable).
- Any relevant error messages or logs.

---

Thank you for contributing to the Living Narrative Engine project!
