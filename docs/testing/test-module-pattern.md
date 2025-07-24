# Test Module Pattern - Comprehensive Guide

## Overview

The Test Module Pattern is a sophisticated testing framework designed to dramatically simplify test setup and maintenance in the Living Narrative Engine. It provides a fluent API that reduces test setup complexity by 70-80% while improving test readability and maintainability.

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture](#architecture)
3. [Core Concepts](#core-concepts)
4. [Implementation Details](#implementation-details)
5. [Usage Patterns](#usage-patterns)
6. [Best Practices](#best-practices)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting](#troubleshooting)

## Introduction

### What is the Test Module Pattern?

The Test Module Pattern is a layer of abstraction built on top of the Service Facade Pattern. It provides:

- **Fluent API** for intuitive test configuration
- **Pre-configured scenarios** for common test cases
- **Intelligent defaults** that reduce boilerplate
- **Built-in validation** to catch configuration errors early
- **Performance tracking** for test optimization

### Why Use It?

Traditional test setup in complex systems often requires:

- Deep knowledge of internal APIs
- Extensive boilerplate code
- Manual mock configuration
- Complex dependency management

The Test Module Pattern addresses these issues by providing a declarative, builder-style API that handles the complexity internally.

### Example Comparison

**Before (Direct Facade Usage):**

```javascript
// 20+ lines of complex setup
const facades = createMockFacades({}, jest.fn);
const turnExecutionFacade = facades.turnExecutionFacade;
const actionService = facades.actionService;
const entityService = facades.entityService;
const llmService = facades.llmService;

// Configure each service manually
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

// More configuration...
```

**After (Test Module Pattern):**

```javascript
// 5 lines with clear intent
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withMockLLM({ strategy: 'tool-calling' })
  .withTestActors([{ id: 'test-actor', name: 'Test Actor' }])
  .withWorld({ name: 'Test World' })
  .build();
```

## Architecture

### Layered Design

```
┌─────────────────────────────────────┐
│         Test Module Pattern         │  <- Your tests use this
├─────────────────────────────────────┤
│      Service Facade Pattern         │  <- Simplifies services
├─────────────────────────────────────┤
│       Core Game Services            │  <- Actual implementation
└─────────────────────────────────────┘
```

### Component Structure

```
tests/common/builders/
├── testModuleBuilder.js           # Main entry point
├── modules/                       # Test module implementations
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
└── errors/                        # Custom error types
    └── testModuleValidationError.js
```

### Design Principles

1. **Builder Pattern**: Fluent API for intuitive configuration
2. **Composition over Inheritance**: Modules compose functionality
3. **Fail-Fast Validation**: Catch errors during configuration
4. **Sensible Defaults**: Work out-of-the-box for common cases
5. **Progressive Disclosure**: Simple API with advanced options

## Core Concepts

### Test Modules

Test modules are specialized builders for different testing scenarios:

- **TurnExecutionTestModule**: Complete AI turn execution
- **ActionProcessingTestModule**: Action discovery and validation
- **EntityManagementTestModule**: Entity lifecycle management
- **LLMTestingModule**: AI decision-making and prompts

### Fluent API

The pattern uses method chaining for configuration:

```javascript
const testEnv = await TestModuleBuilder.forTurnExecution() // Select module type
  .withMockLLM(options) // Configure LLM
  .withTestActors(actors) // Add actors
  .withWorld(worldConfig) // Set up world
  .withCustomFacades(overrides) // Optional overrides
  .build(); // Create environment
```

### Validation System

Built-in validation ensures configurations are valid:

```javascript
// This throws TestModuleValidationError
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withMockLLM({ strategy: 'invalid-strategy' })
  .build();

// Check validation manually
const validation = module.validate();
if (!validation.valid) {
  console.error(validation.errors);
}
```

### Performance Tracking

Modules can track performance metrics:

```javascript
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withPerformanceTracking({
    thresholds: {
      turnExecution: 100,
      actionDiscovery: 50,
    },
  })
  .build();

// After tests
const metrics = testEnv.getPerformanceMetrics();
```

## Implementation Details

### Module Lifecycle

1. **Creation**: Module instantiated via factory method
2. **Configuration**: Fluent methods build configuration
3. **Validation**: Configuration validated before build
4. **Building**: Services created and configured
5. **Usage**: Test environment ready for testing
6. **Cleanup**: Resources released after tests

### Configuration Management

Each module maintains internal configuration:

```javascript
class TurnExecutionTestModule {
  #config = {
    llmStrategy: 'tool-calling',
    actors: [],
    world: null,
    performance: { enabled: false },
    facades: {},
  };

  withMockLLM(options) {
    this.#config.llmStrategy = options.strategy;
    // Merge other options...
    return this; // Enable chaining
  }
}
```

### Facade Integration

Modules wrap the Service Facade Pattern:

```javascript
async build() {
  // Create facades
  const facades = createMockFacades(
    this.#config.facades,
    this.#mockFn
  );

  // Configure based on module settings
  this.#configureLLM(facades.llmService);
  this.#createActors(facades.entityService);
  this.#setupWorld(facades.worldService);

  // Return test environment
  return {
    facades,
    // Convenience methods
    executeAITurn: (actorId) => {
      return facades.turnExecutionFacade.executeAITurn(actorId);
    },
    cleanup: async () => {
      await facades.cleanup();
    }
  };
}
```

## Usage Patterns

### Basic Test Structure

```javascript
describe('Feature Test', () => {
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

  test('should perform action', async () => {
    const result = await testEnv.executeAITurn('test-actor');
    expect(result.success).toBe(true);
  });
});
```

### Using Preset Scenarios

```javascript
describe('Combat Scenario', () => {
  let testEnv;

  beforeEach(async () => {
    // Use pre-configured combat scenario
    testEnv = await TestModuleBuilder.scenarios
      .combat()
      .withCustomFacades({
        /* overrides */
      })
      .build();
  });

  test('should handle combat turn', async () => {
    const result = await testEnv.executeAITurn('fighter');
    expect(result.aiDecision.actionId).toMatch(/attack|defend/);
  });
});
```

### Advanced Configuration

```javascript
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withMockLLM({
    strategy: 'json-schema',
    parameters: { temperature: 0.7 },
    tokenLimits: { input: 2000, output: 500 },
  })
  .withTestActors([
    {
      id: 'hero',
      name: 'Brave Knight',
      type: 'core:actor',
      components: {
        'core:health': { current: 100, max: 100 },
        'core:inventory': { items: ['sword', 'shield'] },
      },
    },
  ])
  .withWorld({
    name: 'Adventure World',
    locations: ['castle', 'forest', 'dungeon'],
    createConnections: true,
  })
  .withPerformanceTracking({
    enabled: true,
    captureCallStacks: true,
  })
  .build();
```

### Custom Mock Setup

```javascript
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withMockLLM({ strategy: 'tool-calling' })
  .withTestActors(['ai-actor'])
  .build();

// Configure specific mocks after building
testEnv.facades.turnExecutionFacade.setupMocks({
  aiResponses: {
    'ai-actor': {
      actionId: 'core:custom-action',
      speech: 'Custom response',
    },
  },
});
```

## Best Practices

### 1. Choose the Right Module

Select the most specific module for your needs:

```javascript
// For full turn execution
TestModuleBuilder.forTurnExecution();

// For action testing only
TestModuleBuilder.forActionProcessing();

// For entity management
TestModuleBuilder.forEntityManagement();

// For LLM/AI testing
TestModuleBuilder.forLLMTesting();
```

### 2. Use Minimal Configuration

Start with defaults and add only what you need:

```javascript
// Good - minimal configuration
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withTestActors(['test-actor'])
  .build();

// Avoid - over-configuration
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withMockLLM({
    /* many options */
  })
  .withTestActors([
    /* complex setup */
  ])
  .withWorld({
    /* extensive config */
  })
  .withPerformanceTracking({
    /* all options */
  })
  .withCustomFacades({
    /* overrides */
  })
  .build();
```

### 3. Leverage Type Safety

Use TypeScript or JSDoc for better IDE support:

```javascript
/**
 * @type {import('./testModuleBuilder').TestEnvironment}
 */
let testEnv;
```

### 4. Clean Up Properly

Always clean up in afterEach:

```javascript
afterEach(async () => {
  if (testEnv) {
    await testEnv.cleanup();
    testEnv = null;
  }
});
```

### 5. Use Descriptive Test Names

```javascript
describe('TurnExecutionTestModule', () => {
  describe('when actor has no available actions', () => {
    test('should handle gracefully with error message', async () => {
      // Test implementation
    });
  });
});
```

## Performance Considerations

### Module Creation Overhead

Module creation is lightweight, but avoid creating in loops:

```javascript
// Bad - creates module in loop
for (const actor of actors) {
  const testEnv = await TestModuleBuilder.forTurnExecution()
    .withTestActors([actor])
    .build();
  // ...
}

// Good - reuse module
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withTestActors(actors)
  .build();

for (const actor of actors) {
  await testEnv.executeAITurn(actor);
}
```

### Mock Configuration

Configure mocks once when possible:

```javascript
beforeEach(async () => {
  testEnv = await TestModuleBuilder.forTurnExecution()
    .withMockLLM({ strategy: 'tool-calling' })
    .build();

  // Configure all mocks once
  testEnv.facades.turnExecutionFacade.setupMocks({
    aiResponses: allResponses,
    actionResults: allActions,
  });
});
```

### Performance Tracking

Use performance tracking to identify bottlenecks:

```javascript
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withPerformanceTracking({
    thresholds: {
      turnExecution: 50,
      warnOnly: true, // Don't fail, just warn
    },
  })
  .build();
```

## Troubleshooting

### Common Issues

#### 1. Module Not Found

```javascript
// Error: TestModuleBuilder.forSomething is not a function
```

**Solution**: Check available modules in TestModuleBuilder

#### 2. Validation Errors

```javascript
// Error: TestModuleValidationError: Invalid configuration
```

**Solution**: Check validation before building:

```javascript
const validation = module.validate();
console.log(validation.errors);
```

#### 3. Missing Methods

```javascript
// Error: testEnv.someMethod is not a function
```

**Solution**: Check the module's returned test environment API

#### 4. Cleanup Issues

```javascript
// Warning: Test did not clean up properly
```

**Solution**: Ensure cleanup() is called in afterEach

### Debugging Tips

1. **Enable Verbose Logging**:

```javascript
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withDebugMode(true)
  .build();
```

2. **Inspect Configuration**:

```javascript
const module = TestModuleBuilder.forTurnExecution();
console.log(module.getConfiguration());
```

3. **Check Facade Access**:

```javascript
// Access underlying facades for debugging
console.log(testEnv.facades.turnExecutionFacade);
```

### When to Use Custom Test Beds

Some scenarios require custom test beds instead of the Test Module Pattern:

1. **Low-level adapter testing** (e.g., LLMAdapterIntegration)
2. **Direct HTTP mocking requirements**
3. **Access to internal implementation details**
4. **Legacy test compatibility**

Example:

```javascript
// Custom test bed for low-level testing
const testBed = new CustomTestBed();
await testBed.initialize();
// Direct access to internals
testBed.internalService.someMethod();
```

## Conclusion

The Test Module Pattern represents a significant improvement in test maintainability and developer experience. By providing a fluent, validated, and intelligent testing API, it enables developers to write more reliable tests with less effort.

Key takeaways:

- Reduces test setup by 70-80%
- Provides clear, readable test configuration
- Includes built-in validation and performance tracking
- Supports both simple and complex test scenarios
- Maintains flexibility through facade access

For specific API documentation, see the [API Reference](../../tests/common/builders/README.md).
