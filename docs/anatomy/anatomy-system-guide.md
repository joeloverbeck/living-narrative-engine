# Anatomy System Guide

This guide captures the current shape of the Living Narrative Engine anatomy stack. It verifies the files, services, and data the system actually uses as of **2025-11-12**.

## Table of Contents

1. [System Overview](#system-overview)
2. [Current State](#current-state)
3. [Core Architecture](#core-architecture)
4. [Generation Pipeline](#generation-pipeline)
5. [Shared Orientation Logic](#shared-orientation-logic)
6. [Validation Pipeline](#validation-pipeline)
7. [Event-Driven Integration](#event-driven-integration)
8. [Key Services](#key-services)
9. [Data Flow Snapshot](#data-flow-snapshot)
10. [Caching Strategy](#caching-strategy)
11. [Body Descriptor Registry](#body-descriptor-registry)
12. [Extension Points](#extension-points)
13. [Performance Notes](#performance-notes)
14. [Historical Context](#historical-context)
15. [Related Documentation](#related-documentation)

## System Overview

The anatomy stack uses a **Blueprint → Recipe → Entity Graph** progression. Mods contribute blueprint and recipe JSON, while runtime services assemble those inputs into entity hierarchies that downstream systems (e.g., clothing) can observe through events.

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Anatomy System                            │
├──────────────────────────────────────────────────────────────┤
│  Data Layer (Mods)                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │ Structure   │  │ Blueprints  │  │  Recipes    │           │
│  │ Templates   │  │ (schema v1/ │  │ (patterns & │           │
│  │             │  │      v2)    │  │  slots)     │           │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘           │
│         │                 │                 │                 │
│  ───────┴─────────────────┴─────────────────┴──────────────  │
│                                                               │
│  Service Layer                                                │
│  ┌─────────────────────────────────────────────────────┐      │
│  │ AnatomyGenerationWorkflow                           │      │
│  │ (stages: parts map, slot entities, clothing, events) │      │
│  └───────────────────┬─────────────────────────────────┘      │
│                      │                                       │
│         ┌────────────┼────────────┐                         │
│         ▼            ▼            ▼                         │
│  ┌───────────┐ ┌──────────┐ ┌──────────────┐                │
│  │BodyBlueprint││Recipe     ││EntityGraph    │                │
│  │Factory      ││Processor  ││Builder        │                │
│  └───────────┘ └──────────┘ └──────────────┘                │
│         │            │            │                         │
│  ───────┴────────────┴────────────┴──────────────────────  │
│                                                               │
│  Support Services                                             │
│  ┌──────────────┐ ┌─────────────┐ ┌──────────────────┐      │
│  │ SlotGenerator│ │ SocketGenerator│ AnatomySocketIndex│    │
│  └──────────────┘ └─────────────┘ └──────────────────┘      │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼ ANATOMY_GENERATED
                  ┌─────────────────┐
                  │  Clothing       │
                  │  System         │
                  └─────────────────┘
```

## Current State

- **Schema Support**: Blueprint schema v1 (explicit slots) and v2 (structure templates + generators) are live.
- **Shared Orientation**: `src/anatomy/shared/orientationResolver.js` backs both `slotGenerator.js` and `socketGenerator.js`.
- **Pattern Resolution**: `src/anatomy/recipePatternResolver/patternResolver.js` resolves `matches`, `matchesGroup`, `matchesPattern`, and `matchesAll` selectors.
- **Socket Indexing**: `src/anatomy/services/anatomySocketIndex.js` provides the runtime cache consumed during event publication and clothing attachment.
- **Blueprint Validation**: `validateRecipeSlots` and `checkBlueprintRecipeCompatibility` live in `src/anatomy/bodyBlueprintFactory/blueprintValidator.js` and run during graph creation; there is no separate `BlueprintRecipeValidator` class.

## Core Architecture

### Blueprint Inputs

- Files: `data/mods/anatomy/blueprints/*.blueprint.json`
- Structure templates (v2 only): `data/mods/anatomy/structure-templates/*.structure-template.json`
- Factory: `src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js`
- Slot generation helpers: `src/anatomy/slotGenerator.js`, `src/anatomy/socketGenerator.js`

### Recipe Inputs

- Files: `data/mods/anatomy/recipes/*.recipe.json` (additional recipes can live in other mods such as `data/mods/core/recipes/`)
- Processor: `src/anatomy/recipeProcessor.js`
- Pattern resolver: `src/anatomy/recipePatternResolver/patternResolver.js`
- Part selection: `src/anatomy/partSelectionService.js`

### Entity Graph Outputs

- Builder: `src/anatomy/entityGraphBuilder.js`
- Body graph utilities: `src/anatomy/bodyGraphService.js`
- Socket index for lookups: `src/anatomy/services/anatomySocketIndex.js`

## Generation Pipeline

`AnatomyGenerationWorkflow` (`src/anatomy/workflows/anatomyGenerationWorkflow.js`) orchestrates the process through explicit stages located in `src/anatomy/workflows/stages/`:

1. **Blueprint + Recipe Assembly** – `BodyBlueprintFactory.createAnatomyGraph()` loads blueprint/recipe data, runs slot and socket generators, resolves patterns, evaluates constraints, and constructs the base entity graph.
2. **Parts Map Stage** – `partsMapBuildingStage.js` builds name→entity mappings and updates the owning entity's `anatomy:body` component.
3. **Slot Entity Stage** – `slotEntityCreationStage.js` creates blueprint slot entities, maps slots to entities, and writes clothing slot metadata for the owner.
4. **Clothing Stage (optional)** – `clothingInstantiationStage.js` delegates to `ClothingInstantiationService.instantiateRecipeClothing()` when the recipe declares `clothingEntities`.
5. **Event Publication Stage (optional)** – `eventPublicationStage.js` emits `ANATOMY_GENERATED` when both an event bus and `AnatomySocketIndex` are configured.

Each stage short-circuits if its dependencies are missing, so older call sites can still construct anatomy without clothing or event emission.

## Shared Orientation Logic

`OrientationResolver` (`src/anatomy/shared/orientationResolver.js`) is the single source of truth for slot and socket orientation naming. It supports `bilateral`, `quadrupedal`, `radial`, `indexed`, and `custom` schemes and always returns deterministic strings. Both generators import it directly, removing the historical divergence that previously caused slot/socket mismatches.

## Validation Pipeline

The anatomy system validates content across four stages, from schema load through runtime graph checks:

### Stage 1: Schema Validation

- **Implementation**: `AjvSchemaValidator.validate(schemaId, data)` in `src/validation/ajvSchemaValidator.js`
- **Coverage**: Anatomy schemas for recipes, blueprints, structure templates, and related JSON definitions under `data/schemas/`
- **When it runs**: During mod loading pipeline's schema phase and via `npm run validate:recipe`

### Stage 2: Recipe Validation Pipeline

`RecipeValidationRunner` (`src/anatomy/validation/RecipeValidationRunner.js`) orchestrates the validation pipeline and chains eleven validators:

1. **Component existence** – Confirms every referenced component is registered
2. **Property schemas** – Validates component property payloads
3. **Body descriptor fields** – Cross-checks descriptor keys and enums against the `anatomy:body` component schema
4. **Blueprint existence** – Ensures the referenced blueprint can be resolved
5. **Socket compatibility** – Confirms blueprint `additionalSlots` reference existing sockets on the root entity
6. **Pattern dry run** – Resolves patterns against processed blueprint to warn when expressions match nothing
7. **Descriptor coverage** – Highlights slots without descriptor components
8. **Explicit part availability** – Verifies entity definitions exist for every explicit slot and pattern requirement
9. **Generated slot availability** – Simulates pattern expansion and checks for matching entity definitions
10. **Entity load failures** – Surfaces loaders' recorded entity-definition failures
11. **Recipe usage hint** – Warns when no entity definition references the recipe ID

Run via: `npm run validate:recipe [--verbose|--json] <path>` (CLI uses `RecipeValidationRunner`)

#### Fail-Fast Validators

`ComponentExistenceValidator` and `PropertySchemaValidator` form the fail-fast gate for Stage 2. Both validators are constructed with `failFast: true`, so the pipeline halts as soon as either emits an error, regardless of the CLI option `--fail-fast` or the `options.failFast` flag passed to `ValidationPipeline.execute(...)`. Configuration can disable later validators or downgrade severities, but these two cannot be bypassed or downgraded—the stage will not proceed to part availability, pattern matching, or descriptor checks until component references resolve and property payloads pass schema validation.

- **Component existence** stops on the first missing component and now warns (without creating false positives) when `slot.properties` or `pattern.properties` contain arrays/numbers instead of plain objects. The malformed properties are skipped so they do not masquerade as component IDs.
- **Property schemas** emit an `INVALID_PROPERTY_OBJECT` error when those malformed property maps are encountered, ensuring contributors get an actionable error that points back to the component schema contract.

Because the validators own their `failFast` flag, callers cannot override this behavior by forcing `options.failFast = false`; doing so only affects lower-priority validators. Treat the pair as the contract that guarantees component/schema integrity before any downstream checks execute.

### Stage 3: Runtime Generation Validation

- **Blueprint slot enforcement**: `validateRecipeSlots` throws when a recipe declares slots that the blueprint does not define
- **Graph integrity**: After graph construction, `GraphIntegrityValidator` runs six rule classes:
  - Socket limits
  - Recipe constraints
  - Cycle detection
  - Joint completeness
  - Orphan detection
  - Part-type compatibility
- **Location**: `src/anatomy/bodyBlueprintFactory/blueprintValidator.js` and `src/anatomy/graphIntegrityValidator.js`

### Stage 4: Body Descriptor Consistency

- **Runtime enforcement**: `BodyDescriptorValidator.validate(...)` (`src/anatomy/utils/bodyDescriptorValidator.js`) rejects unknown descriptor keys and invalid enum values
- **Loader checks**: `src/anatomy/validators/bodyDescriptorValidator.js` powers both `AnatomyRecipeLoader` and the CLI script
- **CLI**: `npm run validate:body-descriptors` verifies formatting configuration

### Descriptor Registry Quick Reference

| Descriptor | Display key | Type | Valid values |
| --- | --- | --- | --- |
| `height` | `height` | Enumerated | microscopic, minuscule, tiny, petite, short, average, tall, very-tall, gigantic, colossal, titanic |
| `skinColor` | `skin_color` | Free-form | Any string |
| `build` | `build` | Enumerated | skinny, slim, lissom, toned, athletic, shapely, hourglass, thick, muscular, hulking, stocky, frail, gaunt, skeletal, atrophied, cadaverous, massive, willowy, barrel-chested, lanky |
| `composition` | `body_composition` | Enumerated | underweight, lean, average, soft, chubby, overweight, obese, atrophied, emaciated, skeletal, malnourished, dehydrated, wasted, desiccated, bloated, rotting |
| `hairDensity` | `body_hair` | Enumerated | hairless, sparse, light, moderate, hairy, very-hairy, furred |
| `smell` | `smell` | Free-form | Any string |

## Event-Driven Integration

- **Dispatcher**: `eventPublicationStage.js`
- **Event ID**: `'ANATOMY_GENERATED'`
- **Payload**:

  ```javascript
  {
    entityId,            // owner entity ID
    blueprintId,         // blueprint used for construction
    sockets,             // [{ id, orientation }] from AnatomySocketIndex
    timestamp,           // dispatch timestamp
    bodyParts,           // array of created entity IDs
    partsMap,            // plain object version of the parts map
    slotEntityMappings,  // plain object version of slot→entity bindings
  }
  ```

`ClothingInstantiationService` (`src/clothing/services/clothingInstantiationService.js`) receives a `SlotResolver` (`src/anatomy/integration/SlotResolver.js`). When the event fires, downstream systems can reuse the same resolver and socket data to attach equipment or generate descriptions without touching the anatomy workflow directly.

## Key Services

### AnatomyGenerationWorkflow

- File: `src/anatomy/workflows/anatomyGenerationWorkflow.js`
- Public API: `generate(blueprintId, recipeId, { ownerId })`, `validateBodyDescriptors()`, `validateRecipe()`
- Dependencies: entity manager, data registry, logger, `BodyBlueprintFactory`, optional clothing instantiation service, optional event bus, optional `AnatomySocketIndex`
- Delegates stage work to helpers instead of inlining logic; no private `#buildPartsMap` style methods exist anymore.

### BodyBlueprintFactory

- File: `src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js`
- Responsibilities: load blueprint JSON via `blueprintLoader.js`, validate slot usage via `blueprintValidator.js`, expand slots through `slotResolutionOrchestrator.js`, coordinate `RecipeProcessor`, `PartSelectionService`, `SocketManager`, and `EntityGraphBuilder`.
- Validation: `validateRecipeSlots()` throws when recipes reference slots that do not exist, while `checkBlueprintRecipeCompatibility()` returns structured warnings/errors for missing required slots or unexpected extras.

### AnatomySocketIndex

- File: `src/anatomy/services/anatomySocketIndex.js`
- Cache contents: per-root `#socketToEntityMap`, `#entityToSocketsMap`, and `#rootEntityCache`
- Key methods: `buildIndex()`, `findEntityWithSocket()`, `getEntitySockets()`, `getEntitiesWithSockets()`, `invalidateIndex()`, `clearCache()`
- Cache coordinator: registers maps with any provided `cacheCoordinator`, but no `ANATOMY_STRUCTURE_CHANGED` event is currently wired up.

## Data Flow Snapshot

```
Mod JSON → DataRegistry → BodyBlueprintFactory
  ├─ SlotGenerator & SocketGenerator (orientation-aware)
  ├─ RecipeProcessor + RecipePatternResolver (pattern expansion)
  └─ EntityGraphBuilder (entity + component creation)
       ↓
Parts Map Stage → Slot Entity Stage → (optional) Clothing Stage → (optional) Event Publication
```

Recipes may combine explicit `slots` with advanced patterns. `patternResolver.js` calls matcher modules in `matchers/` and validators in `validators/` to produce final slot maps before graph creation.

## Caching Strategy

### AnatomySocketIndex

- Build: invoked lazily or explicitly through `buildIndex(rootEntityId)`
- Lookup: `findEntityWithSocket()` and `getEntitySockets()` hit maps for O(1) retrieval once built
- Invalidation: `invalidateIndex(rootEntityId)` removes cached entries for the hierarchy; `clearCache()` clears every map
- Coordination: optional integration with `cacheCoordinator` via constructor injection

### Blueprint & Recipe Data

`IDataRegistry` instances cache blueprint, template, and recipe JSON under keys such as `anatomyBlueprints`, `anatomyStructureTemplates`, and `anatomyRecipes`. They reload only when mods are refreshed.

## Body Descriptor Registry

- File: `src/anatomy/registries/bodyDescriptorRegistry.js`
- Registry fields: `schemaProperty`, `displayLabel`, `displayKey`, `dataPath`, `validValues`, `displayOrder`, `extractor`, `formatter`, `required`
- Current descriptors (in display order):
  1. `height` – enumerated values include `microscopic`, `tiny`, `average`, up to `titanic`
  2. `skinColor` – free-form string
  3. `build` – enumerated values ranging from `skinny` to `barrel-chested`
  4. `composition` – enumerated values such as `lean`, `bloated`, `rotting`
  5. `hairDensity` – enumerated values from `hairless` through `furred`
  6. `smell` – free-form string

Helpers `getDescriptorMetadata()`, `getAllDescriptorNames()`, `getDescriptorsByDisplayOrder()`, and `validateDescriptorValue()` surface this data to validators and formatting logic.

## Extension Points

- **Orientation Schemes**
  1. Update `src/anatomy/shared/orientationResolver.js`
  2. Extend any schema validation (e.g., `data/schemas/anatomy.structure-template.schema.json`)
  3. Document the new scheme in `docs/anatomy/blueprints-and-recipes.md`

- **Pattern Matchers**
  1. Add matcher/validator modules under `src/anatomy/recipePatternResolver/matchers/` and `validators/`
  2. Register them in `patternResolver.js`
  3. Extend schemas like `data/schemas/anatomy.recipe.schema.json`
  4. Update `docs/anatomy/blueprints-and-recipes.md`

- **Event Subscribers**

  ```javascript
  eventBus.on('ANATOMY_GENERATED', ({ entityId, sockets }) => {
    // Resolve clothing or descriptions using SlotResolver + AnatomySocketIndex data
  });
  ```

- **Custom Validation Hooks**

  The compatibility helpers in `blueprintValidator.js` already return structured issues. Additional validation can be layered on top without modifying the workflow by inspecting those results.

## Performance Notes

- **Blueprint v1** builds faster because slots are explicit; **v2** pays extra cost for template expansion but reduces data duplication.
- `AnatomySocketIndex` shifts repeated socket lookups from O(n) traversal to O(1) map access after the first build.
- Large creatures (≈50 parts) can allocate hundreds of kilobytes in the index; call `invalidateIndex()` for dormant entities to release memory.

## Historical Context

- **OrientationResolver Extraction** – Consolidated orientation logic into `src/anatomy/shared/orientationResolver.js`, eliminating the drift that previously existed between `slotGenerator.js` and `socketGenerator.js`.
- **Workflow Staging** – Moved the monolithic generation routine into `src/anatomy/workflows/stages/` to improve observability and make clothing/event integration optional.
- **Socket Index Introduction** – Added `src/anatomy/services/anatomySocketIndex.js` so clothing attachment could avoid scanning the entire entity graph each time.

These refactors are reflected directly in the file layout cited above.

## Related Documentation

- [Blueprints and Recipes Guide](./blueprints-and-recipes.md)
- [Body Descriptors Complete](./body-descriptors-complete.md)
- [Non-Human Quickstart](./non-human-quickstart.md)
- [Troubleshooting](./troubleshooting.md)
- [Anatomy Testing Guide](./anatomy-testing-guide.md)
- [Anatomy Development Guide](../development/anatomy-development-guide.md)

---

**Maintained By**: Living Narrative Engine Core Team  
**Last Reviewed**: 2025-11-12
