# JSON Schemas

This directory houses all JSON Schemas used by the Living Narrative Engine. They provide validation rules for the various data files that drive the game and its modding system.

Below is a brief overview of the purpose for each schema file.

## Core configuration

- **`game.schema.json`** – schema for the root `game.json` file that lists mods to load and optionally the starting world. See [docs/CONFIG_SCHEMA.md](../../docs/CONFIG_SCHEMA.md) for more details.
- **`world.schema.json`** – defines a world, including entity instances created at load time.
- **`llm-configs.schema.json`** – validates `llm-configs.json` describing available Large Language Models.

## Entity and component data

- **`component.schema.json`** – format for component definitions (name, data schema).
- **`entity-definition.schema.json`** – shape for entity templates reused across worlds.
- **`entity-instance.schema.json`** – individual entity instance files referencing definitions and components.
- **`goal.schema.json`** – goal objects attached to actors.

## Gameplay logic

- **`action.schema.json`** – declares an action available to players or AI.
- **`rule.schema.json`** – Event‑Condition‑Action style rules executed by the engine.
- **`event.schema.json`** – structure for event definitions.
- **`operation.schema.json`** – base schema describing operations that make up an action’s implementation. Individual operation parameter schemas live in the `operations/` subfolder.
- **`macro.schema.json`** – reusable sequences of operations referenced from rules.
- **`condition.schema.json`** and **`condition-container.schema.json`** – validate condition definitions written with JsonLogic.
- **`json-logic.schema.json`** – subset of JsonLogic operators allowed in the engine.

## UI and prompts

- **`ui-icons.schema.json`** and **`ui-labels.schema.json`** – UI resources loaded from mods.
- **`prompt-text.schema.json`** – validates text blocks injected into prompts for the LLM.
- **`action-result.schema.json`** – standard structure returned from action handlers.

## Mod metadata

- **`mod-manifest.schema.json`** – required manifest describing each mod’s contents.

## Referencing schemas

Modders can include a `$schema` property in any JSON file to reference the appropriate schema for editor tooling. Use URLs such as `http://example.com/schemas/world.schema.json`. Examples of `$schema` usage are shown throughout [docs/mods](../../docs/mods/).
