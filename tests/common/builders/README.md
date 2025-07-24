# Test Module Pattern API Reference

The Test Module Pattern provides a fluent API for creating and configuring test environments in the Living Narrative Engine. This reference documents all available modules, methods, and usage patterns.

## Table of Contents

- [Overview](#overview)
- [TestModuleBuilder](#testmodulebuilder)
- [Test Modules](#test-modules)
  - [TurnExecutionTestModule](#turnexecutiontestmodule)
  - [ActionProcessingTestModule](#actionprocessingtestmodule)
  - [EntityManagementTestModule](#entitymanagementtestmodule)
  - [LLMTestingModule](#llmtestingmodule)
- [Preset Scenarios](#preset-scenarios)
- [Common Patterns](#common-patterns)
- [Migration Guide](#migration-guide)

## Overview

The Test Module Pattern reduces test setup complexity by 70-80% compared to direct facade usage:

```javascript
// BEFORE: 20+ lines of facade setup
const facades = createMockFacades({}, jest.fn);
const testEnvironment =
  await facades.turnExecutionFacade.initializeTestEnvironment({
    actors: [{ id: 'test-actor', name: 'Test Actor' }],
    // ... many more configuration options
  });

// AFTER: 5 lines with fluent API
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withMockLLM({ strategy: 'tool-calling' })
  .withTestActors([{ id: 'test-actor', name: 'Test Actor' }])
  .withWorld({ name: 'Test World' })
  .build();
```

## TestModuleBuilder

The main entry point for creating test modules.

### Static Methods

#### `forTurnExecution()`

Creates a module for complete turn execution testing.

```javascript
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withMockLLM({ strategy: 'tool-calling' })
  .withTestActors(['ai-actor'])
  .build();
```

#### `forActionProcessing()`

Creates a module for action discovery and processing testing.

```javascript
const testEnv = await TestModuleBuilder.forActionProcessing()
  .forActor('test-actor')
  .withAvailableActions(['move', 'look', 'take'])
  .build();
```

#### `forEntityManagement()`

Creates a module for entity lifecycle testing.

```javascript
const testEnv = await TestModuleBuilder.forEntityManagement()
  .withWorld({ name: 'Test World' })
  .withEntities(['actor', 'item', 'location'])
  .build();
```

#### `forLLMTesting()`

Creates a module for AI decision-making and prompt testing.

```javascript
const testEnv = await TestModuleBuilder.forLLMTesting()
  .withStrategy('tool-calling')
  .withMockResponses({ default: { actionId: 'core:wait' } })
  .build();
```

### Preset Scenarios

Access pre-configured scenarios via `TestModuleBuilder.scenarios`:

```javascript
const combatEnv = await TestModuleBuilder.scenarios
  .combat()
  .withCustomFacades({
    /* overrides */
  })
  .build();

const socialEnv = await TestModuleBuilder.scenarios.socialInteraction().build();

const explorationEnv = await TestModuleBuilder.scenarios.exploration().build();
```

## Test Modules

### TurnExecutionTestModule

For testing complete AI turn execution flows.

#### Configuration Methods

##### `withMockLLM(options)`

Configure the mock LLM service.

```javascript
.withMockLLM({
  strategy: 'tool-calling', // or 'json-schema'
  fastMode: false,
  tokenLimits: { input: 4000, output: 1000 }
})
```

##### `withTestActors(actors)`

Add test actors to the environment.

```javascript
// Simple actor IDs
.withTestActors(['ai-actor', 'player-actor'])

// Detailed actor configurations
.withTestActors([
  { id: 'ai-actor', name: 'Elara the Bard', type: 'core:actor' },
  { id: 'player-actor', name: 'Hero', type: 'core:actor' }
])
```

##### `withWorld(options)`

Configure the test world.

```javascript
.withWorld({
  name: 'Test World',
  createConnections: true,
  locations: ['tavern', 'market', 'forest']
})
```

##### `withPerformanceTracking(options)`

Enable performance monitoring.

```javascript
.withPerformanceTracking({
  enabled: true,
  thresholds: {
    turnExecution: 100,    // ms
    actionDiscovery: 50,   // ms
    eventProcessing: 20    // ms
  }
})
```

##### `withCustomFacades(facades)`

Override specific facades.

```javascript
.withCustomFacades({
  actionService: customActionServiceMock,
  entityService: customEntityServiceMock
})
```

#### Test Environment Methods

After building, the test environment provides:

```javascript
// Execute an AI turn
const result = await testEnv.executeAITurn(
  'ai-actor',
  {
    situation: 'combat scenario',
  },
  {
    validateOnly: false,
  }
);

// Access facades
testEnv.facades.turnExecutionFacade.setupMocks({
  aiResponses: { 'ai-actor': mockDecision },
  actionResults: { 'ai-actor': availableActions },
});

// Get performance metrics
const metrics = testEnv.getPerformanceMetrics();

// Clean up
await testEnv.cleanup();
```

### ActionProcessingTestModule

For testing action discovery and processing without full turn execution.

#### Configuration Methods

##### `forActor(actorId)`

Set the actor for action processing.

```javascript
.forActor('test-actor')
```

##### `withAvailableActions(actions)`

Configure available actions.

```javascript
// Simple action IDs
.withAvailableActions(['move', 'look', 'take'])

// Detailed configurations
.withAvailableActions([
  { id: 'move', requiresTarget: true },
  { id: 'look', alwaysAvailable: true }
])
```

##### `withMockDiscovery(options)`

Configure mock discovery behavior.

```javascript
.withMockDiscovery({
  returnEmpty: false,
  customLogic: (actorId, context) => {
    // Custom discovery logic
    return actions;
  },
  byContext: {
    'combat': ['attack', 'defend'],
    'exploration': ['move', 'look']
  }
})
```

##### `withValidationRules(options)`

Configure validation behavior.

```javascript
.withValidationRules({
  alwaysValid: false,
  requireTarget: true,
  customRules: {
    'move': (action, context) => {
      return action.targets?.direction != null;
    }
  }
})
```

### EntityManagementTestModule

For testing entity creation, modification, and lifecycle.

#### Configuration Methods

##### `withWorld(options)`

Configure the test world.

```javascript
.withWorld({
  name: 'Entity Test World',
  description: 'A world for entity testing',
  initialLocation: 'spawn-point'
})
```

##### `withEntities(definitions)`

Add entities to the test environment.

```javascript
// Simple entity types
.withEntities(['actor', 'item', 'location'])

// Detailed entity configurations
.withEntities([
  {
    type: 'actor',
    id: 'test-actor',
    components: {
      'core:position': { location: 'tavern' },
      'core:inventory': { items: [] }
    }
  }
])
```

##### `withComponents(definitions)`

Configure component schemas and defaults.

```javascript
.withComponents({
  'core:health': {
    schema: { /* JSON Schema */ },
    defaults: { current: 100, max: 100 }
  }
})
```

### LLMTestingModule

For testing AI decision-making and prompt generation.

#### Configuration Methods

##### `withStrategy(strategy)`

Set the LLM strategy.

```javascript
.withStrategy('tool-calling') // or 'json-schema'
```

##### `withMockResponses(responses)`

Configure mock AI responses.

```javascript
.withMockResponses({
  'default': { actionId: 'core:wait' },
  'combat': { actionId: 'core:attack', target: 'enemy' },
  'actor-123': { actionId: 'core:move', direction: 'north' }
})
```

##### `withPromptTemplate(name, template)`

Add custom prompt templates.

```javascript
.withPromptTemplate('decision', 'As {{name}}, choose from: {{actions}}')
.withPromptTemplate('dialogue', 'Respond as {{character}} to: {{input}}')
```

##### `withTokenLimits(limits)`

Configure token limits.

```javascript
.withTokenLimits({
  input: 4000,
  output: 1000
})
```

##### `withValidation(enabled)`

Enable/disable response validation.

```javascript
.withValidation(true)
```

## Common Patterns

### Pattern 1: Basic Test Setup

```javascript
describe('My Feature Test', () => {
  let testEnv;

  beforeEach(async () => {
    testEnv = await TestModuleBuilder.forTurnExecution()
      .withMockLLM({ strategy: 'tool-calling' })
      .withTestActors(['test-actor'])
      .withWorld({ name: 'Test World' })
      .build();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  test('should execute turn successfully', async () => {
    const result = await testEnv.executeAITurn('test-actor');
    expect(result.success).toBe(true);
  });
});
```

### Pattern 2: Multi-Actor Testing

```javascript
const multiActorEnv = await TestModuleBuilder.forTurnExecution()
  .withMockLLM({ strategy: 'tool-calling' })
  .withTestActors(['ai-actor-1', 'ai-actor-2', 'player'])
  .withWorld({ name: 'Multi-Actor World' })
  .build();

// Execute turns for each actor
for (const actorId of ['ai-actor-1', 'ai-actor-2']) {
  const result = await multiActorEnv.executeAITurn(actorId);
  expect(result.success).toBe(true);
}
```

### Pattern 3: Performance Testing

```javascript
const perfEnv = await TestModuleBuilder.forTurnExecution()
  .withMockLLM({ strategy: 'tool-calling', fastMode: true })
  .withTestActors(['test-actor'])
  .withPerformanceTracking({
    thresholds: {
      turnExecution: 100,
      actionDiscovery: 50,
    },
  })
  .build();

// Run performance test
const startTime = Date.now();
for (let i = 0; i < 100; i++) {
  await perfEnv.executeAITurn('test-actor');
}
const duration = Date.now() - startTime;

const metrics = perfEnv.getPerformanceMetrics();
console.log('Average turn time:', metrics.turnExecution.avg);
```

### Pattern 4: Custom Mocking

```javascript
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withMockLLM({ strategy: 'tool-calling' })
  .withTestActors(['test-actor'])
  .build();

// Setup custom mocks
testEnv.facades.turnExecutionFacade.setupMocks({
  aiResponses: {
    'test-actor': {
      actionId: 'core:move',
      targets: { direction: 'north' },
      speech: 'Heading north!',
      thoughts: 'Time to explore.',
    },
  },
  actionResults: {
    'test-actor': [
      { actionId: 'core:move', name: 'Move', available: true },
      { actionId: 'core:look', name: 'Look Around', available: true },
    ],
  },
  validationResults: {
    'test-actor:core:move': {
      success: true,
      validatedAction: {
        actionId: 'core:move',
        actorId: 'test-actor',
        targets: { direction: 'north' },
      },
    },
  },
});
```

## Migration Guide

### From Direct Facade Usage

Before:

```javascript
const facades = createMockFacades({}, jest.fn);
const turnExecutionFacade = facades.turnExecutionFacade;
const testEnvironment = await turnExecutionFacade.initializeTestEnvironment({
  actors: [{ id: 'ai-actor', name: 'Test Actor' }],
  llmStrategy: 'tool-calling',
  world: { name: 'Test World' },
});
```

After:

```javascript
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withMockLLM({ strategy: 'tool-calling' })
  .withTestActors([{ id: 'ai-actor', name: 'Test Actor' }])
  .withWorld({ name: 'Test World' })
  .build();
```

### From Custom Test Beds

Some tests may need to keep their custom test beds if they:

- Test low-level adapter functionality
- Require direct HTTP request/response mocking
- Need access to internal implementation details

Example:

```javascript
// LLMAdapterIntegration keeps its custom test bed because it tests
// low-level HTTP adapter functionality that the Test Module Pattern
// doesn't expose
const testBed = new LLMAdapterTestBed();
await testBed.initialize();
```

### Best Practices

1. **Use the appropriate module** - Choose the most specific module for your test needs
2. **Keep tests focused** - Don't over-configure if you only need basic functionality
3. **Leverage presets** - Use scenario presets for common test patterns
4. **Clean up properly** - Always call `cleanup()` in `afterEach`
5. **Mock strategically** - Only mock what you need to test

### Validation

All test modules include built-in validation:

```javascript
// This will throw TestModuleValidationError if configuration is invalid
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withMockLLM({ strategy: 'invalid-strategy' }) // Error!
  .build();
```

Check validation before building:

```javascript
const module = TestModuleBuilder.forTurnExecution().withMockLLM({
  strategy: 'tool-calling',
});

const validation = module.validate();
if (!validation.valid) {
  console.error('Invalid configuration:', validation.errors);
}
```
