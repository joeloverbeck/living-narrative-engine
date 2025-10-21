# Mod Testing Guide

## Overview

The Mod Testing Guide consolidates everything needed to adopt the Test Module Pattern across mod suites. It explains how the fluent builder architecture composes with standardized configuration factories and provides a step-by-step migration workflow so legacy facade-based tests can transition smoothly.

- **Test Module Pattern architecture** – Understand the builder surface area, module registry, and validation flows that power mod fixtures.
- **Migration workflow** – Follow a consistent, five-step process (decision tree included) to replace direct facade setup with module builders.
- **Configuration factory usage** – Reuse standardized LLM, environment, and mock presets to keep test data consistent across suites.

Use this guide as the canonical reference for all new and migrated mod tests.

> **Need to debug action discovery pipelines?** See the [Action Discovery Testing Toolkit](./action-discovery-testing-toolkit.md) for diagnostics, matchers, and scenario helpers tailored to discovery suites.

## Test Module Pattern Architecture

### Layered Design

The Test Module Pattern wraps the Service Facade layer with a fluent builder abstraction that configures complete mod environments. Each builder exposes concise, chainable methods while keeping the heavy lifting behind the scenes.

```
┌─────────────────────────────────────┐
│         Test Module Pattern         │  <- Tests interact with builders
├─────────────────────────────────────┤
│      Service Facade Pattern         │  <- Simplifies service orchestration
├─────────────────────────────────────┤
│       Core Game Services            │  <- Production implementation
└─────────────────────────────────────┘
```

The test infrastructure is organized across two main directories:

```
tests/common/
├── testConfigurationFactory.js    # Main configuration factory (LLM configs, environments, presets)
├── testPathConfiguration.js       # Path management for isolated test directories
├── facades/                        # Service facade implementations
│   ├── testingFacadeRegistrations.js  # Facade DI registration & createMockFacades()
│   ├── turnExecutionFacade.js
│   ├── actionServiceFacade.js
│   ├── entityServiceFacade.js
│   └── llmServiceFacade.js
└── testing/builders/               # Test Module Pattern implementation
    ├── testModuleBuilder.js        # Primary entry point
    ├── testModuleRegistry.js       # Preset registration and lookup
    ├── modules/                    # Specialized module implementations
    │   ├── turnExecutionTestModule.js
    │   ├── actionProcessingTestModule.js
    │   ├── entityManagementTestModule.js
    │   └── llmTestingModule.js
    ├── presets/                    # Pre-configured scenarios
    │   └── testScenarioPresets.js
    ├── validation/                 # Configuration validation
    │   ├── testModuleValidator.js
    │   └── testConfigurationValidator.js
    ├── interfaces/                 # Type definitions
    │   └── ITestModule.js
    └── errors/                     # Custom error types
        └── testModuleValidationError.js
```

### Core Concepts

- **Builder selection** – Choose the right module through `TestModuleBuilder.forTurnExecution()`, `.forActionProcessing()`, `.forEntityManagement()`, or `.forLLMTesting()` depending on the scenario.
- **Fluent configuration** – Chain builder methods such as `.withMockLLM()`, `.withTestActors()`, `.withWorld()`, and `.withCustomFacades()` before calling `.build()`.
- **Fail-fast validation** – Builders perform validation through `testModuleValidator.js` and surface `TestModuleValidationError` when configuration drift occurs.
- **Sensible defaults** – Presets and standard mocks keep common actor, world, and LLM setups short while remaining customizable through overrides.

### Complete Architecture Flow

Understanding how components interact helps debug issues and choose the right testing approach:

```
Test Code
    ↓
TestModuleBuilder (Entry Point)
    ↓ creates
Test Module (TurnExecution/ActionProcessing/EntityManagement/LLMTesting)
    ↓ uses
TestConfigurationFactory (Preset configurations)
    ↓ configures
createMockFacades() (Service facade creation)
    ↓ returns
Facade Instances (TurnExecutionFacade, ActionServiceFacade, etc.)
    ↓ wraps
Core Game Services (EntityManager, EventBus, ActionDiscovery, etc.)
```

**Key Relationships**:
- **Test Modules** internally call `createMockFacades()` from `tests/common/facades/testingFacadeRegistrations.js`
- **Facades** provide simplified APIs over complex service orchestration
- **TestConfigurationFactory** centralizes LLM strategies, environment presets, and mock configurations
- **TestModuleRegistry** manages scenario presets (combat, socialInteraction, etc.)

**When to Use Each Layer**:
- **Test Modules** (recommended) - Most mod tests, full workflow testing
- **Facades directly** - Low-level adapter tests, HTTP integration tests
- **Core Services** - Unit tests of individual service components

### Quick Example

```javascript
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withMockLLM({ strategy: 'tool-calling' })
  .withTestActors([{ id: 'test-actor', name: 'Test Actor' }])
  .withWorld({ name: 'Test World' })
  .build();
```

### Sitting Arrangement Helpers

High-level seating scenarios can now be composed with a single helper call instead of manually instantiating rooms, furniture, and positioning components. The `ModEntityScenarios.createSitting*` helpers—also exposed as instance methods on `ModTestFixture`—hydrate fixtures with a consistent entity graph and return generated IDs for direct assertions.

| Helper | Best for |
| ------ | -------- |
| `createSittingArrangement(options)` | Full control over seated, standing, and kneeling actors plus additional furniture. |
| `createSittingPair(options)` | Reciprocal seating relationships and closeness metadata for two actors sharing furniture. |
| `createSoloSitting(options)` | Sit/stand transitions where only one actor occupies a seat. |
| `createStandingNearSitting(options)` | Mixed posture scenarios with standing companions (including `standing_behind`). |
| `createSeparateFurnitureArrangement(options)` | Multiple furniture entities populated in a single call for comparison tests. |
| `createKneelingBeforeSitting(options)` | Seated actor plus kneeling observers linked by `positioning:kneeling_before`. |

```javascript
const fixture = await ModTestFixture.forAction(
  'positioning',
  'positioning:sit_down',
  rule,
  condition
);

const scenario = fixture.createSittingPair({
  furnitureId: 'couch1',
  seatedActors: [
    { id: 'alice', name: 'Alice', spotIndex: 0 },
    { id: 'bob', name: 'Bob', spotIndex: 1 },
  ],
});

await fixture.executeAction(scenario.seatedActors[0].id, scenario.furniture.id);

const actor = fixture.entityManager.getEntityInstance('alice');
expect(actor).toHaveComponentData('positioning:sitting_on', {
  furniture_id: scenario.furniture.id,
  spot_index: 0,
});
expect(actor.components['positioning:closeness'].partners).toContain('bob');
```

Usage tips:

- Override `seatedActors`, `standingActors`, or `kneelingActors` to control IDs, display names, and seat indices.
- Pass `closeSeatedActors: false` when actors should sit apart without automatic closeness metadata.
- Supply `additionalFurniture` to pre-create extra seating surfaces without manual builders.
- Call helpers from `ModEntityScenarios` directly when working outside `ModTestFixture`.

## Migration Workflow

Legacy tests that create facades directly should move to module builders to reduce boilerplate and improve readability. Use the decision tree to confirm the migration makes sense, then apply the five-step process.

### Migration Decision Tree

```
┌─────────────────────────────────┐
│ Does the test use facades?       │
└────────────┬────────────────────┘
             │ Yes
             ▼
┌─────────────────────────────────┐
│ Is it testing low-level          │
│ adapter functionality?           │
└────────────┬────────────────────┘
             │ No
             ▼
┌─────────────────────────────────┐
│ Does it need internal access     │
│ beyond module hooks?             │
└────────────┬────────────────────┘
             │ No
             ▼
┌─────────────────────────────────┐
│ MIGRATE to Test Module Pattern  │
└─────────────────────────────────┘
```

### Step-by-Step Migration

1. **Analyze current setup** – Identify `createMockFacades` usage and manual service initialization.
2. **Choose a module** – Map test intent to the appropriate `TestModuleBuilder.for*` method.
3. **Update imports** – Replace facade imports with `tests/common/testing/builders/testModuleBuilder.js`.
4. **Transform configuration** – Convert manual setup into fluent builder calls (LLM strategy, actors, world, mocks, etc.).
5. **Rework assertions** – Use builder-provided helpers and domain matchers to interact with the resulting environment.

### Before and After Snapshot

```javascript
// BEFORE: Manual facade configuration
const facades = createMockFacades({}, jest.fn);
const turnExecutionFacade = facades.turnExecutionFacade;
const actionService = facades.actionService;
const entityService = facades.entityService;
const llmService = facades.llmService;

actionService.setMockActions('test-actor', [
  { actionId: 'core:move', name: 'Move', available: true },
]);

llmService.setMockResponse('test-actor', {
  actionId: 'core:move',
  targets: { direction: 'north' },
});

const testEnvironment = await turnExecutionFacade.initializeTestEnvironment({
  actors: [{ id: 'test-actor', name: 'Test Actor' }],
  llmStrategy: 'tool-calling',
  world: { name: 'Test World', locations: ['tavern'] },
});
```

```javascript
// AFTER: Fluent Test Module Pattern
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withMockLLM({ strategy: 'tool-calling' })
  .withTestActors([{ id: 'test-actor', name: 'Test Actor' }])
  .withWorld({ name: 'Test World' })
  .build();
```

### Common Migration Scenarios

| Scenario                | Recommended Module                            | Notes |
| ----------------------- | --------------------------------------------- | ----- |
| Full turn execution     | `TestModuleBuilder.forTurnExecution()`        | Ideal for AI decision or action resolution tests |
| Action discovery only   | `TestModuleBuilder.forActionProcessing()`     | Keeps mocks focused on action services |
| Entity lifecycle tests  | `TestModuleBuilder.forEntityManagement()`     | Provides entity manager utilities and presets |
| Prompt/LLM validation   | `TestModuleBuilder.forLLMTesting()`           | Centralizes LLM mock responses and prompt builders |

### Troubleshooting Tips

#### Configuration and Validation Issues

- **Validation errors** usually mean a required builder method is missing or an override conflicts with defaults—inspect the thrown `TestModuleValidationError` for precise hints.
- **"Unknown LLM strategy" errors** - Check that you're using one of the supported strategies: `'tool-calling'`, `'json-schema'`, or `'limited-context'`.
- **Missing preset errors** - Verify the scenario name exists in `TestModuleRegistry.getPresetNames()` (e.g., `combat`, `socialInteraction`, `exploration`).

#### Import and Path Issues

- **Cannot find module errors** - Verify import paths match the file structure:
  - `TestModuleBuilder` from `tests/common/testing/builders/testModuleBuilder.js`
  - `TestConfigurationFactory` from `tests/common/testConfigurationFactory.js` (NOT from builders/)
  - `createMockFacades` from `tests/common/facades/testingFacadeRegistrations.js`
- **Circular dependency warnings** - Test modules should import from `builders/`, not vice versa; facades should not import test modules.

#### Architecture Decision Points

- **When to use facades directly vs test modules**:
  - Use **Test Modules** for mod-level integration tests, AI turn execution, action workflows
  - Use **Facades directly** (`createMockFacades`) for low-level adapter tests, HTTP integration tests, or when you need precise control over individual service mocking
  - Use **Core Services** directly only for unit tests of individual service components
- **Low-level adapter tests** should stay on custom fixtures; module builders are for mod-level workflows.
- **Performance regressions** often trace back to redundant `.build()` calls—reuse test environments inside `beforeEach` where possible.

#### Debugging Test Module Issues

- **Facade methods not available** - Ensure you're accessing facades through `testEnv.facades.facadeName` after calling `.build()`
- **Mock responses not working** - Check that mock setup happens after environment build and before test execution
- **Event bus not firing** - Verify that `createMockFacades` was called with proper mock function creator (e.g., `jest.fn`)

## Configuration Factory Reference

The configuration factory centralizes presets that module builders consume. The main factory class lives at [`tests/common/testConfigurationFactory.js`](../../tests/common/testConfigurationFactory.js) and imports validation and registry components from the `builders/` subdirectory.

### Core Factory APIs

- `createLLMConfig(strategy = 'tool-calling', overrides = {})` – Returns standardized LLM definitions for `'tool-calling'`, `'json-schema'`, or `'limited-context'` strategies.
- `createTestEnvironment(type, overrides = {})` – Produces complete environment payloads for `'turn-execution'`, `'action-processing'`, and `'prompt-generation'` scenarios, bundling actors, world data, mocks, and LLM settings.
- `createMockConfiguration(mockType, options = {})` – Generates reusable mock templates for `'llm-adapter'`, `'event-bus'`, and `'entity-manager'` (extend via overrides as needed).
- `getPresets()` – Exposes categorized helpers (`llm`, `environments`, `mocks`) for drop-in reuse across multiple suites.

### Quick Usage Patterns

```javascript
// Reuse a standardized LLM config
const llmConfig = TestConfigurationFactory.createLLMConfig('tool-calling', {
  contextTokenLimit: 4000,
});

// Seed a complete environment preset
const env = TestConfigurationFactory.createTestEnvironment('action-processing', {
  actors: [{ id: 'custom-actor' }],
});

// Reference presets directly
const presets = TestConfigurationFactory.getPresets();
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withStandardLLM('json-schema')
  .withTestActors(['ai-actor'])
  .withWorld(presets.environments.turnExecution().world)
  .build();
```

### Additional Utilities

- `createTestConfiguration()` – Allocates a temp directory and returns `{ pathConfiguration, tempDir, cleanup }` for file-heavy scenarios.
- `createTestFiles(pathConfiguration)` – Seeds canonical config and prompt files within a `TestPathConfiguration` instance.
- `createTestModule(moduleType)` – Shortcut that instantiates module builders (`turnExecution`, `actionProcessing`, `entityManagement`, `llmTesting`).
- `createScenario(scenario)` – Loads prebuilt scenarios such as `'combat'` or `'socialInteraction'` for integration-style tests.
- `migrateToTestModule(legacyConfig)` – Applies legacy fixture data onto modern builders, easing gradual transitions.

### Factory vs Builder Clarification

**TestConfigurationFactory** (the class):
- Located at `tests/common/testConfigurationFactory.js`
- Provides **static methods** for creating LLM configs, test environments, and mock configurations
- Used internally by test modules to get standardized presets
- Can be used directly when you need just configuration objects without full test environment setup

**TestModuleBuilder** (the pattern entry point):
- Located at `tests/common/testing/builders/testModuleBuilder.js`
- Provides **fluent API** for building complete test environments
- Uses `TestConfigurationFactory` internally to get presets
- Returns fully configured test module instances with facades and utilities

**When to use each**:
```javascript
// Use TestConfigurationFactory directly for configuration objects
const llmConfig = TestConfigurationFactory.createLLMConfig('tool-calling');

// Use TestModuleBuilder for complete test environments (recommended)
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withMockLLM({ strategy: 'tool-calling' })
  .build();
```

### Factory + Builder Workflow

1. Use factory presets to fetch consistent defaults.
2. Pass presets into builder methods (e.g., `.withStandardLLM()` or `.withEnvironmentPreset()`).
3. Override only the pieces your test cares about, keeping the rest aligned with canonical fixtures.

## Quick Reference Checklist

- Start with this guide for any new mod test or migration.
- Prefer module builders for everything above low-level adapter tests.
- Leverage the configuration factory to avoid duplicating LLM and environment data.
- Update cross-references in other documentation to point here when describing mod testing standards.

By keeping architecture, migration steps, and configuration guidance in one place, teams can evolve mod tests quickly without losing the consistency benefits of the Test Module Pattern.
