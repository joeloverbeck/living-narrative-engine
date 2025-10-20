# Mod Testing Guide

## Overview

The Mod Testing Guide consolidates everything needed to adopt the Test Module Pattern across mod suites. It explains how the fluent builder architecture composes with standardized configuration factories and provides a step-by-step migration workflow so legacy facade-based tests can transition smoothly.

- **Test Module Pattern architecture** – Understand the builder surface area, module registry, and validation flows that power mod fixtures.
- **Migration workflow** – Follow a consistent, five-step process (decision tree included) to replace direct facade setup with module builders.
- **Configuration factory usage** – Reuse standardized LLM, environment, and mock presets to keep test data consistent across suites.

Use this guide as the canonical reference for all new and migrated mod tests.

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

Builders, modules, presets, validation, and registry components live under `tests/common/testing/builders/`:

```
tests/common/testing/builders/
├── testModuleBuilder.js           # Primary entry point
├── modules/                       # Specialized module implementations
│   ├── turnExecutionTestModule.js
│   ├── actionProcessingTestModule.js
│   ├── entityManagementTestModule.js
│   └── llmTestingModule.js
├── presets/                       # Pre-configured scenarios
│   └── testScenarioPresets.js
├── validation/                    # Configuration validation
│   └── testModuleValidator.js
├── interfaces/                    # Type definitions
│   └── ITestModule.js
├── errors/                        # Custom error types
│   └── testModuleValidationError.js
└── testModuleRegistry.js          # Preset registration and lookup
```

### Core Concepts

- **Builder selection** – Choose the right module through `TestModuleBuilder.forTurnExecution()`, `.forActionProcessing()`, `.forEntityManagement()`, or `.forLLMTesting()` depending on the scenario.
- **Fluent configuration** – Chain builder methods such as `.withMockLLM()`, `.withTestActors()`, `.withWorld()`, and `.withCustomFacades()` before calling `.build()`.
- **Fail-fast validation** – Builders perform validation through `testModuleValidator.js` and surface `TestModuleValidationError` when configuration drift occurs.
- **Sensible defaults** – Presets and standard mocks keep common actor, world, and LLM setups short while remaining customizable through overrides.

### Quick Example

```javascript
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withMockLLM({ strategy: 'tool-calling' })
  .withTestActors([{ id: 'test-actor', name: 'Test Actor' }])
  .withWorld({ name: 'Test World' })
  .build();
```

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

- **Validation errors** usually mean a required builder method is missing or an override conflicts with defaults—inspect the thrown `TestModuleValidationError` for precise hints.
- **Low-level adapter tests** should stay on custom fixtures; module builders are for mod-level workflows.
- **Performance regressions** often trace back to redundant `.build()` calls—reuse test environments inside `beforeEach` where possible.

## Configuration Factory Reference

The configuration factory centralizes presets that module builders consume. It lives at [`tests/common/testing/builders/testConfigurationFactory.js`](../../tests/common/testing/builders/testConfigurationFactory.js) with a runtime mirror at [`tests/common/testConfigurationFactory.js`](../../tests/common/testConfigurationFactory.js).

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
