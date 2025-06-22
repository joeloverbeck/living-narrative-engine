# Living Narrative Engine

Welcome to the Living Narrative Engine repository.

## About The Project

Living Narrative Engine is a browser-based platform designed for creating and playing highly moddable, data-driven
adventure games and immersive simulations. The core philosophy is **extreme moddability** achieved through:

- **Data-Driven Logic:** Game content, rules, and behaviors are primarily defined in JSON files rather than being
  hard-coded. This allows creators to add or modify items, characters, quests, and even core mechanics simply by editing
  data files.
- **Entity Component System (ECS):** The architecture uses an ECS pattern, where game objects (entities) are defined by
  the data components attached to them. This promotes flexibility and emergent gameplay.
- **Mod Support:** The engine is built from the ground up to support mods, treating even core content as potentially
  replaceable data packs.

The long-term vision includes integrating AI agents (LLMs) to drive dynamic NPC interactions and behaviours, creating
truly living narratives.

### AI Narrative Director (Experimental)

An upcoming feature introduces an AI-driven "Narrative Director" that can
dynamically suggest plot twists and quest hooks based on the current game state.
It communicates with the LLM proxy server to keep stories fresh and reactive.

## Memory Components

We now have three distinct memory-related components attachable to any core:actor. Below is a concise reference:

core:short_term_memory

Purpose: Stores ephemeral, first-person internal monologue (e.g., “I can’t believe they did that!”).  
Lifecycle: Capped by maxEntries (default 10).  
Included in Prompt: Under “Your Thoughts”.  
Schema ID: core:short_term_memory → `./data/mods/core/short_term_memory.component.json`

core:perception_log

Purpose: Chronological log of events the character perceives (e.g., “Player X entered the room”).  
Lifecycle: Capped by maxEntries (default 50).  
Included in Prompt: Under “Perception Log”.  
Schema ID: core:perception_log → `./data/mods/core/perception_log.component.json`
Entries reference runtime entity IDs and aren’t resolved to instances.

core:notes

Purpose: Persistent “mental notes”—important items or facts the character deems crucial (e.g., “Joel Overbeck is
untrustworthy”).  
Lifecycle: Uncapped; duplicates filtered out on merge.  
Included in Prompt: Under “<notes>” (only if non-empty).  
Schema ID: core:notes → `./data/mods/core/notes.component.json`

core:goals

Purpose: Short- or long-term goals defined by designers (not LLM-generated).  
Lifecycle: Uncapped; only designer-driven.  
Included in Prompt: Under “<goals>” (only if non-empty).  
Schema ID: core:goals → `./data/mods/core/goals.component.json`

## Getting Started

This project primarily runs in the browser using JavaScript, with a Node.js-based proxy server for handling requests to
Large Language Models (LLMs).

### Prerequisites

Ensure you have Node.js and npm installed. You can download them from [https://nodejs.org/](https://nodejs.org/).

### Installation & Setup

1. **Clone the repository (if you haven't already)**

   ```bash
   git clone https://github.com/joeloverbeck/living-narrative-engine.git
   cd living-narrative-engine
   ```

2. **Install root project dependencies**
   Navigate to the root directory of the cloned project (e.g., `living-narrative-engine`) and run:

   ```bash
   npm install
   ```

3. **Install LLM Proxy Server dependencies**
   Navigate to the `llm-proxy-server` subdirectory within the project:

   ```bash
   cd llm-proxy-server
   ```

   Then, install its specific dependencies:

   ```bash
   npm install
   ```

   Once done, return to the root project directory:

   ```bash
   cd ..
   ```

### Running locally

To run the application, you will need to start two separate processes in two different command line terminals or
"windows":

1. **Start the LLM Proxy Server:**

- Open a new command line terminal.
- Navigate to the `llm-proxy-server` directory:

  ```bash
  cd path/to/your/project/living-narrative-engine/llm-proxy-server
  ```

- Run the development server:

  ```bash
  npm run dev
  ```

  This server will handle API requests related to LLM interactions. Keep this terminal window open.

2. **Start the Main Application:**

- Open a separate new command line terminal.
- Navigate to the root directory of the project (e.g., `living-narrative-engine`):

  ```bash
  cd path/to/your/project/living-narrative-engine
  ```

- Run the main application:

  ```bash
  npm run start
  ```

  This will typically open the application in your default web browser (e.g., at a URL like `http://localhost:3000` or
  similar, depending on your project's `start` script configuration). Check the terminal output for the exact URL.

## Configuration

### Game Configuration (`game.json`)

The core behavior and content loading of the Living Narrative Engine are controlled by a central configuration file
named `game.json`.

**Location:**

- This file **must** be named exactly `game.json`.
- Place this file in the **base data directory** of your project (typically the `./data/` folder, alongside `schemas/`,
  `worlds/`, etc.). The engine uses the `IConfiguration.getBaseDataPath()` and `IConfiguration.getGameConfigFilename()`
  settings, resolved via `IPathResolver.resolveGameConfigPath()`, to locate this file.

**Requirement:**

- This file is **required** for the engine to start. If `game.json` is missing, cannot be fetched, contains invalid
  JSON, or does not conform to the required schema, the engine will fail to load, logging a fatal error.

**Format:**

The `game.json` file must be a JSON object containing a single required property: `mods`.

    {
      "mods": [
        "core",
        "base_adventure_mechanics",
        "my_custom_story_mod"
      ]
    }

**Load Order / Priority:**

The order of mod IDs listed in the mods array defines the initial load priority for mods and their content. Mods listed
later in the array will generally override content (like items, entities, actions) from mods listed earlier, assuming
they have the same ID. The final conflict resolution also depends on dependency management (which is planned for future
implementation).

**Schema:**

The formal structure of this file is defined by the `game.schema.json` schema file. The engine validates `game.json`
against this schema during startup. You can refer to `data/schemas/game.schema.json` for the precise definition.
UI icons and labels are validated against `ui-icons.schema.json` and `ui-labels.schema.json` and loaded by the new **UiLoader**. Definitions from later mods override earlier ones.

## Dependency & Conflict Validation

A robust modding system relies on clearly defined dependencies and the ability to handle potential conflicts. The Living
Narrative Engine employs a **fail-fast** philosophy during mod loading regarding critical dependency and conflict
issues. This means the engine will halt the loading process immediately upon detecting a fatal error, providing clear
feedback to the user or developer rather than attempting to continue with a potentially unstable configuration.

**Mod IDs are treated as case-insensitive** for all validation purposes (e.g., "MyMod", "mymod", and "myMod" are
considered the same ID). However, the originally declared casing in a mod's manifest `id` field is preserved for display
and registry purposes.

### Dependency Rules

Dependencies are declared in the `mod-manifest.json` file within the `dependencies` array. Each entry specifies a
required `modId` and a `version` requirement (using Semantic Versioning ranges).

**Rule D1: Missing Dependency**

- **Description:** A loaded mod declares a dependency on another mod ID that is not present in the list of mods being
  loaded (`game.json` or resolved dependency chain).
- **Severity:** **FATAL**
- **Reasoning:** The mod explicitly requires functionality or content from the missing dependency. Proceeding would
  likely lead to runtime errors.
- **Example:**
  - `ModA/mod-manifest.json`:
    ```json
    {
      "id": "ModA",
      "version": "1.0.0",
      "dependencies": [{ "modId": "CoreUtils", "version": ">=1.2.0" }]
    }
    ```
  - `game.json`: `{ "mods": ["ModA", "AnotherMod"] }` (Missing "CoreUtils")
  - **Outcome:** Loading halts with an error indicating "ModA" requires missing dependency "CoreUtils".

**Rule D2: Version Mismatch (Incompatible Version)**

- **Description:** A dependency is declared, and the required mod ID _is_ present, but the loaded version of that
  dependency does not satisfy the version range specified.
- **Severity:** **FATAL**
- **Reasoning:** The mod was built against a specific version (or range) of the dependency. Using an incompatible
  version (too old or potentially too new if explicitly restricted) can cause API incompatibilities or unexpected
  behavior.
- **Example:**
  - `ModB/mod-manifest.json`:
    ```json
    {
      "id": "ModB",
      "version": "2.0.0",
      "dependencies": [{ "modId": "CoreUtils", "version": "^1.3.0" }]
    }
    ```
    (Requires CoreUtils >=1.3.0 and <2.0.0)
  - `CoreUtils/mod-manifest.json`: `{ "id": "CoreUtils", "version": "1.2.5" }`
  - `game.json`: `{ "mods": ["CoreUtils", "ModB"] }`
  - **Outcome:** Loading halts. Error: "ModB" requires "CoreUtils" version "^1.3.0", but found "1.2.5".

**Rule D3: Circular Dependency**

- **Description:** A dependency chain exists where Mod A depends on Mod B, and Mod B (directly or indirectly) depends
  back on Mod A.
- **Severity:** **FATAL**
- **Reasoning:** Circular dependencies create an unresolvable load order and often indicate a design flaw in the mods.
- **Example:**
  - `ModX/mod-manifest.json`: `{ "id": "ModX", "dependencies": [{ "modId": "ModY", "version": "1.0.0" }] }`
  - `ModY/mod-manifest.json`: `{ "id": "ModY", "dependencies": [{ "modId": "ModX", "version": "1.0.0" }] }`
  - **Outcome:** Loading halts with an error detecting a circular dependency between "ModX" and "ModY".

### Conflict Rules

Conflicts are declared in the `mod-manifest.json` file within the `conflicts` array. Each entry specifies a `modId` that
this mod is known to be incompatible with. Version ranges _can_ be specified but are less common for conflicts.

**Rule C1: Declared Conflict Present**

- **Description:** A loaded mod declares a conflict with another mod ID, and that conflicting mod ID is also present in
  the list of mods being loaded.
- **Severity:** **FATAL**
- **Reasoning:** The mod author has explicitly stated these mods should not be run together due to known issues (e.g.,
  overriding the same critical data in incompatible ways, causing game-breaking bugs). Respecting this declaration
  prevents known unstable states.
- **Example:**
  - `AwesomeSwords/mod-manifest.json`:
    ```json
    {
      "id": "AwesomeSwords",
      "version": "1.0.0",
      "conflicts": [{ "modId": "SuperSwords" }]
    }
    ```
  - `SuperSwords/mod-manifest.json`: `{ "id": "SuperSwords", "version": "1.0.0" }`
  - `game.json`: `{ "mods": ["AwesomeSwords", "SuperSwords"] }`
  - **Outcome:** Loading halts. Error: Detected conflict between "AwesomeSwords" and "SuperSwords" as declared by
    "AwesomeSwords".

**Rule C2: Duplicate Mod ID Loaded**

- **Description:** Two different mod sources (e.g., different directories being scanned or listed in `game.json`)
  provide a manifest declaring the _same_ `id` (case-insensitive). This is distinct from dependencies; it means the
  engine found two separate mods claiming to be the same thing.
- **Severity:** **FATAL**
- **Reasoning:** It's ambiguous which mod source is the "correct" one. Allowing both could lead to unpredictable file
  overrides or data corruption. The user must resolve the ambiguity by removing or renaming one of the sources. Note:
  This rule applies _before_ dependency/conflict checks based on the final list of loaded mods.
- **Example:**
  - Directory `./mods/MyMod/mod-manifest.json`: `{ "id": "MyMod", "version": "1.0.0" }`
  - Directory `./mods/AnotherAttempt/mod-manifest.json`: `{ "id": "mymod", "version": "1.1.0" }`
  - `game.json`: `{ "mods": ["MyMod", "AnotherAttempt"] }` (Assuming both directories correspond to these IDs)
  - **Outcome:** Loading halts. Error: Duplicate mod ID "mymod" found from sources "MyMod" and "AnotherAttempt".

### Engine Compatibility

Mods can specify the range of engine versions they are compatible with using the `gameVersion` field in their
`mod-manifest.json`.

- **Field:** `gameVersion`
- **Format:** A string representing a Semantic Versioning (SemVer) range (e.g., `"^1.2.0"`, `">=1.0.0 <2.0.0"`,
  `"1.5.x"`). See the [npm semver documentation](https://docs.npmjs.com/cli/v7/using-npm/semver) for details on range
  syntax.
- **Behavior:** During startup, the engine checks its own version (`ENGINE_VERSION`) against the `gameVersion` range
  specified by _each_ loaded mod that includes this field.
- **Validation:**
  - If a mod specifies a `gameVersion` range, and the `ENGINE_VERSION` does _not_ satisfy that range, the engine will
    **halt startup** with a fatal `ModDependencyError`, listing all incompatible mods.
  - If a mod specifies a `gameVersion` that is not a valid SemVer range string (e.g., misspelled, incorrect type),
    the engine will **halt startup** with a fatal `TypeError`.
  - If a mod _omits_ the `gameVersion` field, or sets it to `null`, an empty string (`""`), or only whitespace, it is
    **skipped** for this check and will not cause an engine compatibility error.

**Rule E1: Engine Version Incompatibility**

- **Description:** A loaded mod declares a `gameVersion` range, but the current engine version (`ENGINE_VERSION`) does
  not fall within that range.
- **Severity:** **FATAL**
- **Reasoning:** The mod author expects specific engine features or behavior present only within the declared version
  range. Running outside this range risks runtime errors or incorrect functionality.
- **Example:**
  - `SomeMod/mod-manifest.json`:
    ```json
    { "id": "SomeMod", "version": "1.0.0", "gameVersion": "^1.2.0" }
    ```
    (Requires engine >=1.2.0 and <2.0.0)
  - Current Engine Version (`ENGINE_VERSION`): `1.1.5`
  - **Outcome:** Loading halts. Error: "SomeMod" incompatible with engine v1.1.5 (requires '^1.2.0').

### Validation Summary Table

| Rule Code | Description                     | Severity | Notes                                                                    |
| :-------- | :------------------------------ | :------- | :----------------------------------------------------------------------- |
| **D1**    | Missing Dependency              | FATAL    | Cannot proceed without required content/functionality.                   |
| **D2**    | Incompatible Dependency Version | FATAL    | Potential for API breaks or incorrect behavior.                          |
| **D3**    | Circular Dependency             | FATAL    | Unresolvable load order.                                                 |
| **C1**    | Declared Conflict Present       | FATAL    | Explicitly marked as incompatible by mod author.                         |
| **C2**    | Duplicate Mod ID Source         | FATAL    | Ambiguous which mod source is canonical. Must be resolved manually.      |
| _(N/A)_   | Manifest Schema Validation      | FATAL    | (`modManifestLoader` error `VALIDATION_FAIL`) Invalid manifest format.   |
| _(N/A)_   | Manifest ID Mismatch            | FATAL    | (`modManifestLoader` error `ID_MISMATCH`) Manifest `id` != requested ID. |
| **E1**    | Engine Version Incompatibility  | FATAL    | Mod requires a different engine version range.                           |
| _(N/A)_   | Invalid `gameVersion` Format    | FATAL    | (`modVersionValidator` re-throws `TypeError`) Not a valid SemVer range.  |

_(Note: Schema validation, ID mismatch, and invalid gameVersion format errors are typically caught by specific
loaders/validators but are included here for completeness as fatal loading errors related to manifests)._

### Creating a New Mod

To scaffold a new mod directory with a starter `mod-manifest.json` run:

    npm run create-mod -- <modId>

Replace `<modId>` with your desired identifier. The script creates
`data/mods/<modId>/` and populates a minimal manifest you can edit further.

### Documentation ▶️

**JSON Logic – Composite Operators ➜ docs/json-logic/composite-logical-operators.md**  
Quick reference for and, or, and not/!, including edge-cases and examples.

**Full JSON Logic Usage Guide ➜ docs/json-logic/json-logic-usage.md**  
Complete operator list, context explanation, and many ready-made patterns.

**Mod Manifest Loader Usage ➜ docs/mods/modManifestLoader.md**
How to use the ModManifestLoader service and handle potential errors.

**Mod Manifest Format ➜ docs/mods/mod_manifest_format.md**
Details of every allowed field with a sample manifest.

**UI Icons & Labels ➜ docs/mods/loader.md#ui-directory-structure**
Overview of the `ui/` folder and how icons/labels are merged.
**Display Error Event Payload ➜ docs/events/display_error_payload.md**
Overview of the payload structure emitted when dispatching `core:display_error` events.
**Turn Processing Events ➜ docs/events/turn_processing_events.md**
Overview of the events fired when any actor's turn processing begins and ends.

**Namespaced IDs & resolveFields ➜ docs/mods/namespaced_ids_and_resolveFields.md**
Explains how identifiers are namespaced and how reference resolution works across mods.

**Action Macros ➜ docs/mods/macros.md**
Define reusable action sequences and reference them within rules.

### License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License.  
See the LICENSE file for full details.
