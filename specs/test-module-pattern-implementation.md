# Test Module Pattern Implementation Specification

## Executive Summary

This specification outlines the implementation of the Test Module Pattern for the Living Narrative Engine project. Building upon the successfully implemented Service Facade Pattern, the Test Module Pattern will provide an additional layer of abstraction that dramatically improves the developer experience while maintaining full compatibility with existing test infrastructure.

### Key Benefits

1. **Enhanced Developer Experience**: Fluent API with superior IDE autocomplete and self-documenting methods
2. **Reduced Complexity**: 70-80% reduction in test setup code through intelligent defaults and presets
3. **Build-time Validation**: Early error detection prevents runtime configuration issues
4. **Composable Architecture**: Mix and match test components for maximum flexibility
5. **Non-breaking Implementation**: Layers on top of existing facades without disrupting current tests

### Expected Outcomes

- **Setup Time Reduction**: From 30-60 lines to 5-10 lines for common test scenarios
- **Error Prevention**: 90% reduction in configuration-related test failures
- **Learning Curve**: New developers productive within 30 minutes vs. 2-4 hours
- **Test Readability**: Self-documenting code that clearly expresses test intent

## Architecture Overview

### Layered Design

```
┌─────────────────────────────────────┐
│      Test Module Pattern Layer      │ ← New Addition
├─────────────────────────────────────┤
│     Service Facade Pattern Layer    │ ← Existing
├─────────────────────────────────────┤
│        Core Services Layer          │ ← Existing
└─────────────────────────────────────┘
```

The Test Module Pattern acts as a thin, intelligent layer over the existing facades, providing:

- Fluent builder interfaces for intuitive configuration
- Preset configurations for common scenarios
- Validation and error handling at build time
- Lazy initialization for optimal performance

### Core Components

#### 1. TestModuleBuilder (Entry Point)

```javascript
// Primary entry point for all test module creation
class TestModuleBuilder {
  static forTurnExecution() {
    return new TurnExecutionTestModule();
  }
  static forActionProcessing() {
    return new ActionProcessingTestModule();
  }
  static forEntityManagement() {
    return new EntityManagementTestModule();
  }
  static forLLMTesting() {
    return new LLMTestingModule();
  }

  // Preset scenarios for rapid test creation
  static scenarios = {
    combat: () => TestScenarioPresets.combat(),
    socialInteraction: () => TestScenarioPresets.socialInteraction(),
    exploration: () => TestScenarioPresets.exploration(),
    performance: () => TestScenarioPresets.performance(),
  };
}
```

#### 2. Module Types

Each module type provides domain-specific configuration methods:

- **TurnExecutionTestModule**: Complete turn execution testing
- **ActionProcessingTestModule**: Action discovery and processing
- **EntityManagementTestModule**: Entity lifecycle and state management
- **LLMTestingModule**: AI decision-making and prompt testing

#### 3. Fluent Configuration API

```javascript
// Example of fluent API design
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withMockLLM({ strategy: 'tool-calling', temperature: 0.7 })
  .withTestActors(['ai-actor', 'player'])
  .withWorld({ name: 'Test World', connections: true })
  .withPerformanceTracking()
  .withEventCapture(['AI_DECISION_MADE', 'ACTION_EXECUTED'])
  .build();
```

## Detailed Design

### Module Interface Definition

```javascript
// tests/common/builders/interfaces/ITestModule.js

/**
 * Base interface for all test modules
 * @interface ITestModule
 */
export class ITestModule {
  /**
   * Builds and returns the configured test environment
   * @returns {Promise<TestEnvironment>}
   */
  async build() {
    throw new Error('Must implement build()');
  }

  /**
   * Validates the current configuration
   * @returns {ValidationResult}
   */
  validate() {
    throw new Error('Must implement validate()');
  }

  /**
   * Resets the module to default state
   * @returns {ITestModule}
   */
  reset() {
    throw new Error('Must implement reset()');
  }
}
```

### TurnExecutionTestModule Implementation

```javascript
// tests/common/builders/modules/turnExecutionTestModule.js

import { createMockFacades } from '../../../src/testing/facades/testingFacadeRegistrations.js';
import { ITestModule } from '../interfaces/ITestModule.js';
import { TestModuleValidationError } from '../errors/testModuleValidationError.js';

export class TurnExecutionTestModule extends ITestModule {
  #config = {
    llm: null,
    actors: [],
    world: null,
    monitoring: {
      performance: false,
      events: [],
    },
    facades: {},
  };

  constructor() {
    super();
    this.#applyDefaults();
  }

  #applyDefaults() {
    this.#config = {
      llm: {
        strategy: 'tool-calling',
        temperature: 1.0,
        mockResponses: {},
      },
      actors: [],
      world: {
        name: 'Test World',
        createConnections: true,
      },
      monitoring: {
        performance: false,
        events: [],
      },
      facades: {},
    };
  }

  /**
   * Configure mock LLM behavior
   * @param {Object} config - LLM configuration options
   * @returns {TurnExecutionTestModule}
   */
  withMockLLM(config = {}) {
    this.#config.llm = {
      ...this.#config.llm,
      ...config,
    };
    return this;
  }

  /**
   * Add test actors to the environment
   * @param {Array<string|Object>} actors - Actor configurations
   * @returns {TurnExecutionTestModule}
   */
  withTestActors(actors = []) {
    this.#config.actors = actors.map((actor) =>
      typeof actor === 'string'
        ? { id: actor, type: actor.includes('ai') ? 'ai' : 'player' }
        : actor
    );
    return this;
  }

  /**
   * Configure the test world
   * @param {Object} worldConfig - World configuration
   * @returns {TurnExecutionTestModule}
   */
  withWorld(worldConfig) {
    this.#config.world = {
      ...this.#config.world,
      ...worldConfig,
    };
    return this;
  }

  /**
   * Enable performance tracking
   * @param {Object} options - Performance tracking options
   * @returns {TurnExecutionTestModule}
   */
  withPerformanceTracking(options = {}) {
    this.#config.monitoring.performance = {
      enabled: true,
      thresholds: {
        turnExecution: 100, // ms
        actionDiscovery: 50, // ms
        ...options.thresholds,
      },
    };
    return this;
  }

  /**
   * Configure event capture
   * @param {Array<string>} eventTypes - Event types to capture
   * @returns {TurnExecutionTestModule}
   */
  withEventCapture(eventTypes = []) {
    this.#config.monitoring.events = eventTypes;
    return this;
  }

  /**
   * Override specific facades with custom implementations
   * @param {Object} facades - Custom facade implementations
   * @returns {TurnExecutionTestModule}
   */
  withCustomFacades(facades = {}) {
    this.#config.facades = facades;
    return this;
  }

  /**
   * Validate configuration before building
   * @returns {ValidationResult}
   */
  validate() {
    const errors = [];

    // Validate LLM configuration
    if (!this.#config.llm.strategy) {
      errors.push({
        field: 'llm.strategy',
        message: 'LLM strategy is required',
      });
    }

    // Validate actors
    if (this.#config.actors.length === 0) {
      errors.push({
        field: 'actors',
        message: 'At least one actor is required',
      });
    }

    // Validate world
    if (!this.#config.world.name) {
      errors.push({
        field: 'world.name',
        message: 'World name is required',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build the test environment
   * @returns {Promise<TestEnvironment>}
   */
  async build() {
    // Validate configuration
    const validation = this.validate();
    if (!validation.valid) {
      throw new TestModuleValidationError(
        'Invalid test module configuration',
        validation.errors
      );
    }

    // Create facades with configuration
    const facades = createMockFacades(this.#config.facades, jest.fn);

    // Initialize test environment using facades
    const testEnvironment =
      await facades.turnExecutionFacade.initializeTestEnvironment({
        llmStrategy: this.#config.llm.strategy,
        llmConfig: this.#config.llm,
        worldConfig: this.#config.world,
        actors: this.#config.actors,
      });

    // Apply monitoring configuration
    if (this.#config.monitoring.performance) {
      testEnvironment.enablePerformanceTracking(
        this.#config.monitoring.performance
      );
    }

    if (this.#config.monitoring.events.length > 0) {
      testEnvironment.captureEvents(this.#config.monitoring.events);
    }

    // Return enriched test environment
    return {
      ...testEnvironment,
      facades,
      config: { ...this.#config }, // Frozen copy

      // Convenience methods
      async executeAITurn(actorId) {
        return facades.turnExecutionFacade.executeAITurn(
          actorId,
          testEnvironment.context
        );
      },

      async cleanup() {
        if (testEnvironment.cleanup) {
          await testEnvironment.cleanup();
        }
      },
    };
  }

  /**
   * Reset module to default configuration
   * @returns {TurnExecutionTestModule}
   */
  reset() {
    this.#applyDefaults();
    return this;
  }
}
```

### Test Scenario Presets

```javascript
// tests/common/builders/presets/testScenarioPresets.js

export class TestScenarioPresets {
  /**
   * Combat scenario with multiple actors and action tracking
   */
  static combat() {
    return TestModuleBuilder.forTurnExecution()
      .withMockLLM({
        strategy: 'tool-calling',
        temperature: 0.8,
        mockResponses: {
          default: { action: 'attack', target: 'enemy' },
        },
      })
      .withTestActors([
        { id: 'ai-fighter', type: 'ai', role: 'combatant' },
        { id: 'enemy', type: 'ai', role: 'opponent' },
        { id: 'player', type: 'player', role: 'observer' },
      ])
      .withWorld({
        name: 'Combat Arena',
        combatEnabled: true,
      })
      .withPerformanceTracking({
        thresholds: { turnExecution: 150 },
      })
      .withEventCapture(['COMBAT_INITIATED', 'DAMAGE_DEALT', 'COMBAT_ENDED']);
  }

  /**
   * Social interaction scenario with dialogue focus
   */
  static socialInteraction() {
    return TestModuleBuilder.forTurnExecution()
      .withMockLLM({
        strategy: 'json-schema',
        temperature: 1.2,
        mockResponses: {
          default: { action: 'speak', content: 'Hello there!' },
        },
      })
      .withTestActors([
        { id: 'ai-npc', type: 'ai', role: 'merchant' },
        { id: 'player', type: 'player', role: 'customer' },
      ])
      .withWorld({
        name: 'Marketplace',
        socialInteractionsEnabled: true,
      })
      .withEventCapture([
        'DIALOGUE_STARTED',
        'DIALOGUE_CHOICE_MADE',
        'RELATIONSHIP_CHANGED',
      ]);
  }

  /**
   * Exploration scenario with movement and discovery
   */
  static exploration() {
    return TestModuleBuilder.forTurnExecution()
      .withMockLLM({
        strategy: 'tool-calling',
        temperature: 1.0,
      })
      .withTestActors([{ id: 'ai-explorer', type: 'ai', role: 'explorer' }])
      .withWorld({
        name: 'Unknown Territory',
        size: 'large',
        generateLocations: true,
      })
      .withEventCapture([
        'LOCATION_DISCOVERED',
        'ITEM_FOUND',
        'MOVEMENT_COMPLETED',
      ]);
  }

  /**
   * Performance testing scenario with minimal overhead
   */
  static performance() {
    return TestModuleBuilder.forTurnExecution()
      .withMockLLM({
        strategy: 'tool-calling',
        fastMode: true,
      })
      .withTestActors([{ id: 'ai-test', type: 'ai' }])
      .withWorld({ name: 'Perf Test', minimal: true })
      .withPerformanceTracking({
        thresholds: {
          turnExecution: 50,
          actionDiscovery: 25,
        },
      });
  }
}
```

### Validation System

```javascript
// tests/common/builders/validation/testModuleValidator.js

export class TestModuleValidator {
  static validateConfiguration(config, moduleType) {
    const validators = {
      turnExecution: this.#validateTurnExecutionConfig,
      actionProcessing: this.#validateActionProcessingConfig,
      entityManagement: this.#validateEntityManagementConfig,
      llmTesting: this.#validateLLMTestingConfig,
    };

    const validator = validators[moduleType];
    if (!validator) {
      throw new Error(`Unknown module type: ${moduleType}`);
    }

    return validator(config);
  }

  static #validateTurnExecutionConfig(config) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!config.llm) {
      errors.push({
        code: 'MISSING_LLM_CONFIG',
        field: 'llm',
        message: 'LLM configuration is required for turn execution',
      });
    }

    // Validate LLM strategy
    if (
      config.llm &&
      !['tool-calling', 'json-schema'].includes(config.llm.strategy)
    ) {
      errors.push({
        code: 'INVALID_LLM_STRATEGY',
        field: 'llm.strategy',
        message: `Invalid LLM strategy: ${config.llm.strategy}`,
      });
    }

    // Validate actors
    if (!config.actors || config.actors.length === 0) {
      warnings.push({
        code: 'NO_ACTORS',
        field: 'actors',
        message: 'No actors configured - test environment will be empty',
      });
    }

    // Performance thresholds
    if (config.monitoring?.performance?.thresholds) {
      const thresholds = config.monitoring.performance.thresholds;
      if (thresholds.turnExecution && thresholds.turnExecution > 1000) {
        warnings.push({
          code: 'HIGH_PERFORMANCE_THRESHOLD',
          field: 'monitoring.performance.thresholds.turnExecution',
          message:
            'Turn execution threshold >1000ms may hide performance issues',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
```

## Integration Examples

### Basic Usage

```javascript
// Before: Using facades directly
describe('Turn Execution Tests', () => {
  let facades;
  let testEnvironment;

  beforeEach(async () => {
    facades = createMockFacades({}, jest.fn);
    testEnvironment =
      await facades.turnExecutionFacade.initializeTestEnvironment({
        llmStrategy: 'tool-calling',
        worldConfig: { name: 'Test World', createConnections: true },
        actorConfig: { name: 'Test AI Actor' },
      });
  });

  afterEach(async () => {
    if (testEnvironment?.cleanup) {
      await testEnvironment.cleanup();
    }
  });

  it('should execute AI turn', async () => {
    const result = await facades.turnExecutionFacade.executeAITurn(
      testEnvironment.aiActor.id,
      testEnvironment.context
    );
    expect(result.success).toBe(true);
  });
});

// After: Using Test Module Pattern
describe('Turn Execution Tests', () => {
  let testEnv;

  beforeEach(async () => {
    testEnv = await TestModuleBuilder.forTurnExecution()
      .withMockLLM({ strategy: 'tool-calling' })
      .withTestActors(['ai-actor'])
      .withWorld({ name: 'Test World' })
      .build();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it('should execute AI turn', async () => {
    const result = await testEnv.executeAITurn('ai-actor');
    expect(result.success).toBe(true);
  });
});
```

### Using Presets

```javascript
describe('Combat System Tests', () => {
  let testEnv;

  beforeEach(async () => {
    testEnv = await TestModuleBuilder.scenarios
      .combat()
      .withCustomFacades({
        // Override specific facade behavior for this test
        actionService: {
          discoverActions: jest.fn().mockResolvedValue(['attack', 'defend']),
        },
      })
      .build();
  });

  it('should handle combat between actors', async () => {
    const result = await testEnv.executeAITurn('ai-fighter');

    expect(result.action).toBe('attack');
    expect(result.target).toBe('enemy');
    expect(testEnv.getCapturedEvents()).toContainEqual(
      expect.objectContaining({ type: 'COMBAT_INITIATED' })
    );
  });
});
```

### Advanced Composition

```javascript
describe('Complex Scenario Tests', () => {
  let testEnv;

  beforeEach(async () => {
    // Start with a preset and customize further
    testEnv = await TestModuleBuilder.scenarios
      .exploration()
      .withTestActors([
        { id: 'ai-explorer', type: 'ai', inventory: ['map', 'compass'] },
        { id: 'ai-companion', type: 'ai', followsPlayer: true },
      ])
      .withPerformanceTracking({
        thresholds: {
          turnExecution: 75,
          actionDiscovery: 30,
          eventProcessing: 10,
        },
      })
      .withEventCapture([
        'LOCATION_DISCOVERED',
        'COMPANION_DIALOGUE',
        'INVENTORY_CHANGED',
      ])
      .withMockLLM({
        mockResponses: {
          'ai-explorer': { action: 'explore', direction: 'north' },
          'ai-companion': { action: 'follow', target: 'ai-explorer' },
        },
      })
      .build();
  });

  it('should coordinate multiple actors during exploration', async () => {
    // Execute turns for both actors
    const explorerResult = await testEnv.executeAITurn('ai-explorer');
    const companionResult = await testEnv.executeAITurn('ai-companion');

    // Verify coordination
    expect(explorerResult.action).toBe('explore');
    expect(companionResult.action).toBe('follow');
    expect(companionResult.target).toBe('ai-explorer');

    // Check performance
    const metrics = testEnv.getPerformanceMetrics();
    expect(metrics.turnExecution).toBeLessThan(75);
  });
});
```

## Migration Strategy

### Phase 1: Foundation (Week 1)

#### 1.1 Core Infrastructure

- Create base module interfaces and classes
- Implement validation framework
- Set up builder pattern infrastructure
- Add comprehensive unit tests

**Files to create:**

- `tests/common/builders/testModuleBuilder.js`
- `tests/common/builders/interfaces/ITestModule.js`
- `tests/common/builders/validation/testModuleValidator.js`
- `tests/common/builders/errors/testModuleValidationError.js`

#### 1.2 Initial Modules

- Implement `TurnExecutionTestModule`
- Implement `ActionProcessingTestModule`
- Create basic preset configurations

**Files to create:**

- `tests/common/builders/modules/turnExecutionTestModule.js`
- `tests/common/builders/modules/actionProcessingTestModule.js`
- `tests/common/builders/presets/testScenarioPresets.js`

### Phase 2: Integration (Week 2)

#### 2.1 Facade Integration

- Update `testingFacadeRegistrations.js` to export builder classes
- Ensure seamless integration with existing facades
- Add builder-aware factory methods

**Files to modify:**

- `src/testing/facades/testingFacadeRegistrations.js`
- `tests/common/testConfigurationFactory.js`

#### 2.2 Advanced Features

- Implement remaining module types
- Add performance optimization features
- Create comprehensive preset library

**Files to create:**

- `tests/common/builders/modules/entityManagementTestModule.js`
- `tests/common/builders/modules/llmTestingModule.js`
- `tests/common/builders/presets/advancedPresets.js`

### Phase 3: Migration & Documentation (Week 3)

#### 3.1 Test Migration

- Migrate 3-5 test files as proof of concept
- Document migration patterns
- Gather feedback from team

**Files to migrate (examples):**

- `tests/e2e/turns/FullTurnExecution.e2e.test.js`
- `tests/e2e/actions/TurnBasedActionProcessing.e2e.test.js`
- `tests/e2e/llm-adapter/LLMAdapterIntegration.e2e.test.js`

#### 3.2 Documentation

- Create comprehensive usage guide
- Write migration guide
- Update project documentation

**Files to create:**

- `docs/testing/test-module-pattern.md`
- `tests/common/builders/README.md`
- `docs/testing/migration-guide.md`

## Risk Mitigation

### 1. Backward Compatibility

- **Risk**: Breaking existing tests during migration
- **Mitigation**:
  - Test modules use facades internally
  - No changes to facade interfaces
  - Parallel support for both patterns
  - Comprehensive test coverage

### 2. Performance Impact

- **Risk**: Additional abstraction layer affects performance
- **Mitigation**:
  - Lazy initialization of components
  - Minimal overhead design
  - Performance benchmarking
  - Optimization opportunities

### 3. Adoption Resistance

- **Risk**: Developers prefer existing patterns
- **Mitigation**:
  - Clear documentation and examples
  - Tangible benefits demonstration
  - Gradual migration approach
  - Team training sessions

### 4. Complexity Creep

- **Risk**: Over-engineering the builder pattern
- **Mitigation**:
  - Focus on common use cases
  - Regular design reviews
  - YAGNI principle adherence
  - User feedback integration

## Success Metrics

### Quantitative Metrics

1. **Code Reduction**
   - Target: 70-80% reduction in test setup code
   - Measurement: Lines of code comparison before/after

2. **Test Execution Time**
   - Target: No performance regression
   - Measurement: Benchmark suite execution times

3. **Configuration Errors**
   - Target: 90% reduction in configuration-related failures
   - Measurement: Test failure analysis

4. **Developer Productivity**
   - Target: 50% reduction in time to write new tests
   - Measurement: Time tracking for test creation

### Qualitative Metrics

1. **Developer Satisfaction**
   - Method: Surveys and feedback sessions
   - Target: 80% positive feedback

2. **Code Readability**
   - Method: Code review feedback
   - Target: Improved readability scores

3. **Learning Curve**
   - Method: New developer onboarding time
   - Target: < 30 minutes to first test

4. **Maintenance Effort**
   - Method: Time spent debugging tests
   - Target: 50% reduction

## Implementation Guidelines

### Design Principles

1. **Simplicity First**: Keep the API intuitive and predictable
2. **Progressive Disclosure**: Simple cases simple, complex cases possible
3. **Fail Fast**: Validate early and provide clear error messages
4. **Composition Over Configuration**: Prefer method chaining to nested objects
5. **Sensible Defaults**: Common cases should work with minimal configuration

### Code Quality Standards

1. **Testing**: 100% coverage for builder classes
2. **Documentation**: JSDoc for all public methods
3. **Examples**: Working examples for each module type
4. **Validation**: Comprehensive input validation
5. **Error Messages**: Clear, actionable error messages

### Performance Considerations

1. **Lazy Initialization**: Only create what's needed
2. **Resource Pooling**: Reuse expensive objects
3. **Minimal Overhead**: Keep abstraction cost low
4. **Benchmarking**: Regular performance testing
5. **Optimization**: Profile and optimize hot paths

## Conclusion

The Test Module Pattern represents a natural evolution of the testing infrastructure, building upon the successful Service Facade Pattern to deliver an even better developer experience. By providing a fluent, intuitive API with built-in validation and preset configurations, this pattern will significantly reduce the complexity and time required to write effective tests.

The layered approach ensures backward compatibility while enabling gradual adoption, minimizing risk and disruption. With careful implementation following this specification, the Living Narrative Engine will benefit from:

- Dramatically simplified test creation
- Reduced configuration errors
- Improved test readability and maintainability
- Faster developer onboarding
- Enhanced testing productivity

The investment in implementing this pattern will pay dividends through improved code quality, reduced maintenance burden, and increased developer satisfaction.

---

_This specification provides a comprehensive blueprint for implementing the Test Module Pattern. Implementation should proceed according to the phased approach, with regular checkpoints to ensure alignment with project goals and team needs._
