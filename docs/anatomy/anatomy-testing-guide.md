# Anatomy System Testing Guide

This guide describes the current automated coverage for the anatomy system and how to extend it. All examples and file
paths below reflect the repository as it exists today.

## Test Locations and Commands

| Suite       | Path prefix                  | How to run                                                                 |
| ----------- | ---------------------------- | --------------------------------------------------------------------------- |
| Unit        | `tests/unit/anatomy/`        | `npm run test:unit -- --testPathPattern=tests/unit/anatomy`                 |
| Integration | `tests/integration/anatomy/` | `npm run test:integration -- --testPathPattern=tests/integration/anatomy`   |
| End-to-End  | `tests/e2e/anatomy/`         | `npm run test:e2e -- --testPathPattern=tests/e2e/anatomy`                   |
| Performance | `tests/performance/anatomy/` | `npm run test:performance -- --testPathPattern=tests/performance/anatomy`   |
| Regression  | `tests/regression/anatomy/`  | `npm run test:single -- --runTestsByPath tests/regression/anatomy/<file>.test.js` |

> Jest pattern flags allow you to run only the anatomy-related files while still using the standard npm scripts.

### Coverage thresholds

| Config                       | Branches | Functions | Lines | Statements |
| ---------------------------- | -------- | --------- | ----- | ---------- |
| `jest.config.unit.js`        | 93%      | 99%       | 99%   | 99%        |
| `jest.config.integration.js` | 70%      | 70%       | 70%   | 70%        |
| `jest.config.e2e.js`         | 20%      | 20%       | 20%   | 20%        |
| `jest.config.performance.js` | 0%       | 0%        | 0%    | 0%         |

Regression runs use the base `jest.config.js`, which does not set additional thresholds.

## Unit Tests

The unit suite validates individual services, factories, and helpers. Notable files include:

- `tests/unit/anatomy/shared/orientationResolver.test.js` and
  `tests/unit/anatomy/shared/orientationResolver.properties.test.js` – exhaustively validate
  `src/anatomy/shared/orientationResolver.js`, including edge cases for bilateral, radial, indexed, custom, and
  quadrupedal schemes.
- `tests/unit/anatomy/slotGenerator.test.js` and `tests/unit/anatomy/socketGenerator.test.js` – ensure the generators
  call `OrientationResolver` and emit synchronized IDs across templates.
- `tests/unit/anatomy/recipePatternResolver/*.test.js` – cover recipe matching, constraint validation, and error
  handling for pattern resolution.
- `tests/unit/anatomy/services/anatomySocketIndex.test.js` – verifies cache building, invalidation, and error logging for
  `src/anatomy/services/anatomySocketIndex.js`.
- Supporting suites (for example `bodyBlueprintFactory/*.test.js`, `bodyDescriptionComposer/*.test.js`, and
  `anatomyGenerationService*.test.js`) focus on orchestration logic, schema validation, and guard rails around the data
  registry.

When adding new unit scenarios, reuse existing mocks from `tests/common/mockFactories/` to satisfy the strict coverage
thresholds.

## Integration Tests

Integration coverage centres around real service wiring with the anatomy data registries.

- `tests/common/anatomy/anatomyIntegrationTestBed.js`, `enhancedAnatomyTestBed.js`, and `simplifiedAnatomyTestBed.js`
  build full stacks with `EntityManager`, `BodyBlueprintFactory`, `AnatomyGenerationService`, `SocketManager`,
  `BodyGraphService`, clothing services, and cache layers. Most integration suites instantiate one of these helpers.
- `tests/integration/anatomy/anatomyGenerationService.realFlow.integration.test.js` exercises an end-to-end pipeline: the
  blueprint factory, recipe processor, entity graph builder, socket manager, and clothing services.
- `tests/integration/anatomy/anatomyInitializationService.*.integration.test.js` cover queue management, retries, and
  failure handling for the initialization daemon.
- `tests/integration/anatomy/slotSocketSynchronization.test.js` and
  `tests/integration/anatomy/slotSocketContract.enhanced.test.js` assert that `SlotGenerator` and `SocketGenerator`
  remain in lock-step across bilateral, radial, indexed, and custom templates.
- `tests/integration/anatomy/anatomySocketIndex.realModules.integration.test.js` verifies cache invalidation when the
  anatomy graph mutates.
- `tests/integration/anatomy/targetlessActionPrerequisites.test.js` and
  `tests/integration/anatomy/targetlessActionWorkflow.test.js` ensure action discovery and execution respect anatomy and
  clothing prerequisites when `targets` is set to `"none"`.

Integration suites frequently rely on auto-loaded mod content. Use `tests/common/mods/ModTestFixture.js` together with
`ModEntityBuilder` when new coverage requires real rule or action evaluation.

## End-to-End Tests

The anatomy end-to-end folder contains workflow-level validations that exercise the runtime entry points with realistic
fixtures:

- `tests/e2e/anatomy/anatomyGraphBuildingPipeline.e2e.test.js` and
  `tests/e2e/anatomy/anatomyGraphBuildingPipeline.isolated.e2e.test.js` walk the graph-building flow from blueprint
  loading to entity instantiation.
- `tests/e2e/anatomy/clothingEquipmentIntegration.e2e.test.js` verifies clothing instantiation against generated sockets.
- `tests/e2e/anatomy/complexBlueprintProcessing.e2e.test.js`, `cephalopodSpeciesVariety.e2e.test.js`, and
  `multiEntityOperations.e2e.test.js` focus on large blueprints, multi-root entities, and concurrency behaviour.

## Regression and Contract Suites

- Regression scenarios live in `tests/regression/anatomy/` (`humanoid.regression.test.js`, `spider.regression.test.js`,
  `octopoid.regression.test.js`) and lock in fixes for historical bugs such as orientation drift and duplicate socket
  IDs.
- Contract coverage (synchronisation, blueprint-recipe compatibility, and anatomy/clothing integration) resides in:
  - `tests/integration/anatomy/slotSocketSynchronization.test.js`
  - `tests/integration/anatomy/slotSocketContract.enhanced.test.js`
  - `tests/integration/anatomy/blueprintRecipeCompatibility.integration.test.js`
  - `tests/integration/anatomy/anatomyGenerationWithClothing.test.js`

When tightening contracts, update these suites rather than writing ad-hoc assertions elsewhere.

## Performance Tests

`tests/performance/anatomy/` measures hot paths under load. Representative cases include:

- `anatomyPerformance.test.js` – stress tests repeated generation.
- `slotGenerator.performance.test.js` and `socketGenerator.performance.test.js` – monitor ID generation scalability.
- `templateProcessorPerformance.test.js` and `templateExpansion.performance.test.js` – profile complex blueprint
  templates and recipe application.

Performance suites run with relaxed coverage thresholds but surface regressions in timing expectations, so preserve or
update the recorded baselines when altering algorithms.

## Fixtures, Builders, and Utilities

| Helper                                                  | Purpose                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `tests/common/anatomy/anatomyIntegrationTestBed.js`     | Full-stack integration harness with real services and in-memory registry.                  |
| `tests/common/anatomy/enhancedAnatomyTestBed.js`        | Variant exposing additional hooks for graph manipulation and cache inspection.             |
| `tests/common/anatomy/simplifiedAnatomyTestBed.js`      | Lightweight harness for tests that only require slot/socket generation.                    |
| `tests/common/anatomy/complexBlueprintDataGenerator.js` | Pre-built complex templates and recipes for stress or regression scenarios.                |
| `tests/common/anatomy/anatomyVisualizerTestBed.js`      | DOM-oriented setup used by the anatomy visualizer unit tests.                              |
| `tests/common/mods/ModTestFixture.js`                   | Auto-loads action rules, conditions, and scope categories for mod-driven scenarios.        |
| `tests/common/mods/ModEntityBuilder.js`                 | Fluent builder for entities; provides `.withBody`, `.asBodyPart`, and clothing helpers.    |

Re-use these utilities to avoid duplicating boilerplate and to keep tests aligned with existing patterns.

## Recipe Testing Patterns

### Unit Testing Patterns

Unit suites build lightweight doubles in place rather than relying on the shared test beds. `tests/unit/anatomy/recipeProcessor.test.js` shows the standard structure: create plain Jest mocks, instantiate the service, and assert on observable behaviour.

```javascript
import { RecipeProcessor } from '../../../src/anatomy/recipeProcessor.js';

const mockDataRegistry = { get: jest.fn() };
const mockLogger = { debug: jest.fn() };

const processor = new RecipeProcessor({
  dataRegistry: mockDataRegistry,
  logger: mockLogger,
});
```

Use that pattern for most services. When real data is helpful, prefer `InMemoryDataRegistry` from `src/data/inMemoryDataRegistry.js`, which is already exercised throughout the integration test beds.

### Integration Testing Patterns

#### AnatomyIntegrationTestBed

`tests/common/anatomy/anatomyIntegrationTestBed.js` creates a complete anatomy environment: it wires an `EntityManager`, `InMemoryDataRegistry`, `BodyBlueprintFactory`, `AnatomyGenerationService`, the description pipeline, clothing support, and validation rules. Call `await loadAnatomyModData()` before executing workflows so that components, entities, blueprints, recipes, and clothing metadata mirror `data/mods/anatomy/` fixtures.

The existing giant spider integration suite demonstrates the recommended usage pattern: build the test bed, load mod data, construct the service you want to exercise, then assert on entity graph contents and socket compatibility.

#### Simplified and Enhanced Variants

- `simplifiedAnatomyTestBed.js` constructs a lighter environment that you can expand on demand. It helps when you only need the anatomy description service or minimal component definitions without loading every mod fixture.
- `enhancedAnatomyTestBed.js` extends the integration test bed with complex blueprint generators, clothing orchestration, and optional error injection for stress scenarios.
- `anatomyVisualizerTestBed.js` supplies DOM and event mocks for the anatomy visualizer unit tests.

### Validation and CLI Checks

Use the shipped npm scripts whenever you need to validate recipes or run the test matrix:

- `npm run test:unit` and `npm run test:integration` execute the anatomy suites alongside the rest of the project. Target a single file with Jest's `--testPathPattern` option if you need to focus on one scenario.
- `npm run validate:recipe` invokes `scripts/validate-recipe.js`, which loads the required mods and runs the pre-flight validator (`RecipePreflightValidator`) across eleven checks covering component existence, schema validation, body descriptors, blueprint and socket compatibility, pattern matching, descriptor coverage, part availability, generated slot coverage, entity definition load failures, and recipe usage.
- `npm run validate:body-descriptors` runs `scripts/validate-body-descriptors.js` to cross-check descriptor registries with formatting configuration.
- `npm run validate` triggers the full mod validation pipeline in `scripts/validateMods.js`, which is the same entry point used in CI.

`GraphIntegrityValidator` enforces the runtime rules that the integration suites assert against: socket limits, recipe constraint checks, cycle detection, joint consistency, orphan detection, and part-type compatibility. The integration tests in `tests/integration/anatomy/graphIntegrityValidator.*.test.js` cover those behaviours end-to-end.

### Recommended Workflow

1. Start with `npm run validate:recipe path/to/recipe.recipe.json` to ensure the recipe passes the pre-flight validator before you write or update tests.
2. Add or adjust the relevant unit suites in `tests/unit/anatomy/` to pin the service-level behaviour.
3. Cover the complete flow with integration tests that use `AnatomyIntegrationTestBed` (or one of its variants) inside `tests/integration/anatomy/`.
4. Execute `npm run test:unit`, `npm run test:integration`, and—when you touch descriptors—`npm run validate:body-descriptors` to confirm nothing regresses.
5. Finish with `npm run validate` before shipping to ensure the broader mod ecosystem still loads correctly.

## Targetless Action Testing Notes

Targetless seduction actions rely on anatomy prerequisites and clothing coverage checks. The authoritative references
are `tests/integration/anatomy/targetlessActionPrerequisites.test.js` and the data under
`data/mods/seduction/actions/*.action.json`.

Key rules when authoring new tests:

1. Build actors with `ModEntityBuilder.withBody(rootId)` and model each body part as a separate entity using
   `.asBodyPart({ subType, parent, children, socketId })`. The builder writes the minimal
   `{ body: { root: <entityId> } }` structure required by the anatomy graph services.
2. Additional actors or occupants must be created explicitly to satisfy `hasOtherActorsAtLocation` and similar
   prerequisites.
3. Clothing coverage checks depend on `clothing:equipment` and `clothing:slot_metadata` components. Mirror the patterns
   from `targetlessActionPrerequisites.test.js` to reproduce coverage scenarios.
4. Forbidden components (for example `positioning:hugging`) are attached via
   `ModEntityBuilder.withComponent(componentId, data)` and automatically filtered during discovery.
5. Discovery (`fixture.discoverActions`) is synchronous, while execution (`fixture.executeAction`) returns a promise.

By following these conventions, the action discovery pipeline matches runtime behaviour without requiring custom stubs.
