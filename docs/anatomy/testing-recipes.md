# Anatomy Recipe Testing Patterns

This guide describes the current anatomy-focused testing assets and how to exercise them accurately. Use it to locate the right fixtures, choose the right level of test, and run the validation scripts that ship with the repository.

## Testing assets at a glance

- **Unit tests** live in `tests/unit/anatomy/`. The directory contains focused suites for services such as `RecipeProcessor`, `BodyBlueprintFactory`, `PartSelectionService`, `GraphIntegrityValidator`, and the body description composer pipeline, along with anatomy visualizer entrypoint tests.【F:tests/unit/anatomy/recipeProcessor.test.js†L1-L79】【F:tests/unit/anatomy/bodyBlueprintFactory.test.js†L1-L54】【F:tests/unit/anatomy/graphIntegrityValidator.test.js†L1-L65】
- **Integration tests** live in `tests/integration/anatomy/`. They rely on shared test beds to cover full workflows such as spider generation, descriptor validation, clothing integration, and cache behaviour.【F:tests/integration/anatomy/giantSpiderGeneration.test.js†L1-L120】【F:tests/integration/anatomy/bodyDescriptorSystemConsistency.test.js†L1-L84】
- **Shared anatomy fixtures** live in `tests/common/anatomy/`. Notable helpers include `anatomyIntegrationTestBed.js`, `simplifiedAnatomyTestBed.js`, `enhancedAnatomyTestBed.js`, and the anatomy visualizer test beds.【F:tests/common/anatomy/anatomyIntegrationTestBed.js†L1-L116】【F:tests/common/anatomy/simplifiedAnatomyTestBed.js†L1-L63】【F:tests/common/anatomy/enhancedAnatomyTestBed.js†L1-L34】
- **General-purpose mocks** live in `tests/common/mockFactories/`. The index re-exports helpers such as `createMockLogger`, `createMockSafeEventDispatcher`, `createMockValidatedEventDispatcherForIntegration`, `createMockSchemaValidator`, and `createMockEventDispatchService` that the anatomy test beds depend on.【F:tests/common/mockFactories/index.js†L1-L38】【F:tests/common/mockFactories/loggerMocks.js†L1-L48】【F:tests/common/mockFactories/eventBusMocks.js†L1-L36】【F:tests/common/mockFactories/coreServices.js†L342-L452】

## Unit testing patterns

Unit suites build lightweight doubles in place rather than relying on the shared test beds. `tests/unit/anatomy/recipeProcessor.test.js` shows the standard structure: create plain Jest mocks, instantiate the service, and assert on observable behaviour.【F:tests/unit/anatomy/recipeProcessor.test.js†L1-L79】

```javascript
import { RecipeProcessor } from '../../../src/anatomy/recipeProcessor.js';

const mockDataRegistry = { get: jest.fn() };
const mockLogger = { debug: jest.fn() };

const processor = new RecipeProcessor({
  dataRegistry: mockDataRegistry,
  logger: mockLogger,
});
```

Use that pattern for most services. When real data is helpful, prefer `InMemoryDataRegistry` from `src/data/inMemoryDataRegistry.js`, which is already exercised throughout the integration test beds.【F:tests/common/anatomy/anatomyIntegrationTestBed.js†L1-L57】

## Integration testing patterns

### AnatomyIntegrationTestBed

`tests/common/anatomy/anatomyIntegrationTestBed.js` creates a complete anatomy environment: it wires an `EntityManager`, `InMemoryDataRegistry`, `BodyBlueprintFactory`, `AnatomyGenerationService`, the description pipeline, clothing support, and validation rules. Call `await loadAnatomyModData()` before executing workflows so that components, entities, blueprints, recipes, and clothing metadata mirror `data/mods/anatomy/` fixtures.【F:tests/common/anatomy/anatomyIntegrationTestBed.js†L1-L210】【F:tests/common/anatomy/anatomyIntegrationTestBed.js†L728-L816】

The existing giant spider integration suite demonstrates the recommended usage pattern: build the test bed, load mod data, construct the service you want to exercise, then assert on entity graph contents and socket compatibility.【F:tests/integration/anatomy/giantSpiderGeneration.test.js†L1-L146】

### Simplified and enhanced variants

- `simplifiedAnatomyTestBed.js` constructs a lighter environment that you can expand on demand. It helps when you only need the anatomy description service or minimal component definitions without loading every mod fixture.【F:tests/common/anatomy/simplifiedAnatomyTestBed.js†L1-L120】
- `enhancedAnatomyTestBed.js` extends the integration test bed with complex blueprint generators, clothing orchestration, and optional error injection for stress scenarios.【F:tests/common/anatomy/enhancedAnatomyTestBed.js†L1-L40】
- `anatomyVisualizerTestBed.js` supplies DOM and event mocks for the anatomy visualizer unit tests; combine it with the suites in `tests/unit/anatomy/anatomy-visualizer*.test.js` when working on UI-specific behaviour.【F:tests/common/anatomy/anatomyVisualizerTestBed.js†L1-L36】【F:tests/unit/anatomy/anatomy-visualizer.test.js†L1-L40】

## Validation and CLI checks

Use the shipped npm scripts whenever you need to validate recipes or run the test matrix:

- `npm run test:unit` and `npm run test:integration` execute the anatomy suites alongside the rest of the project. Target a single file with Jest's `--testPathPattern` option if you need to focus on one scenario.【F:package.json†L24-L115】
- `npm run validate:recipe` invokes `scripts/validate-recipe.js`, which loads the required mods and runs the pre-flight validator (`RecipePreflightValidator`) across eleven checks covering component existence, schema validation, body descriptors, blueprint and socket compatibility, pattern matching, descriptor coverage, part availability, generated slot coverage, entity definition load failures, and recipe usage.【F:package.json†L63-L86】【F:scripts/validate-recipe.js†L1-L109】【F:src/anatomy/validation/RecipePreflightValidator.js†L53-L148】
- `npm run validate:body-descriptors` runs `scripts/validate-body-descriptors.js` to cross-check descriptor registries with formatting configuration.【F:package.json†L78-L80】【F:scripts/validate-body-descriptors.js†L1-L40】
- `npm run validate` triggers the full mod validation pipeline in `scripts/validateMods.js`, which is the same entry point used in CI.【F:package.json†L65-L74】

`GraphIntegrityValidator` enforces the runtime rules that the integration suites assert against: socket limits, recipe constraint checks, cycle detection, joint consistency, orphan detection, and part-type compatibility. The integration tests in `tests/integration/anatomy/graphIntegrityValidator.*.test.js` cover those behaviours end-to-end.【F:src/anatomy/graphIntegrityValidator.js†L1-L90】【F:tests/integration/anatomy/graphIntegrityValidator.integration.test.js†L1-L64】

## Recommended workflow

1. Start with `npm run validate:recipe path/to/recipe.recipe.json` to ensure the recipe passes the pre-flight validator before you write or update tests.【F:scripts/validate-recipe.js†L1-L109】
2. Add or adjust the relevant unit suites in `tests/unit/anatomy/` to pin the service-level behaviour.【F:tests/unit/anatomy/recipeProcessor.test.js†L1-L79】
3. Cover the complete flow with integration tests that use `AnatomyIntegrationTestBed` (or one of its variants) inside `tests/integration/anatomy/`.【F:tests/integration/anatomy/giantSpiderGeneration.test.js†L1-L146】
4. Execute `npm run test:unit`, `npm run test:integration`, and—when you touch descriptors—`npm run validate:body-descriptors` to confirm nothing regresses.【F:package.json†L24-L115】
5. Finish with `npm run validate` before shipping to ensure the broader mod ecosystem still loads correctly.【F:package.json†L65-L74】

For additional background, pair this guide with the anatomy system overview, the recipe creation checklist, and the validation workflow documents in the same directory.【F:docs/anatomy/anatomy-system-guide.md†L1-L15】【F:docs/anatomy/recipe-creation-checklist.md†L1-L20】【F:docs/anatomy/validation-workflow.md†L1-L32】
