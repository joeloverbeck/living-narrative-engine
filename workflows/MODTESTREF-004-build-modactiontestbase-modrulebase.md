# MODTESTREF-004: Build ModActionTestBase & ModRuleTestBase

## Overview

Create base classes for mod action and rule tests that integrate all infrastructure components (ModTestHandlerFactory, ModEntityBuilder, ModAssertionHelpers) to provide a unified testing framework. These base classes will eliminate setup duplication and establish consistent patterns for all mod integration tests.

## Problem Statement

### Current Test Structure Issues

Each mod test file manually orchestrates multiple setup operations:

```javascript
// Repeated in every test file
function createHandlers(entityManager, eventBus, logger) {
  // 30+ lines of handler creation
}

describe('mod:action integration', () => {
  let testEnv;
  
  beforeEach(() => {
    // 20+ lines of test environment setup
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(ruleFile.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });
    
    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([{ ...ruleFile, actions: expanded }]),
      getConditionDefinition: jest.fn((id) => 
        id === 'mod:event-is-action-specific' ? conditionFile : undefined
      ),
    };
    
    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [{ ...ruleFile, actions: expanded }],
      dataRegistry,
    });
  });
  
  it('should execute action successfully', async () => {
    // Manual entity setup
    // Manual action dispatch
    // Manual assertions
  });
});
```

### Architectural Problems

- **No Inheritance**: Each test starts from scratch
- **Inconsistent Setup**: Variations in environment configuration
- **Manual Integration**: Each test manually wires together infrastructure components
- **Pattern Drift**: Copy-paste leads to diverging patterns over time
- **Missing Standards**: No enforced patterns for test structure

### Impact

- **960+ lines** of repeated setup code (20 lines × 48 files)
- **Inconsistent test quality** due to manual setup variations
- **High maintenance burden** when infrastructure changes
- **Barrier to entry** for new mod test development

## Technical Requirements

### Base Class Architecture

**File Locations**:
- `tests/common/mods/ModActionTestBase.js` - Base class for action tests
- `tests/common/mods/ModRuleTestBase.js` - Base class for rule tests

**Dependencies**:
```javascript
// Infrastructure components
import { ModTestHandlerFactory } from './ModTestHandlerFactory.js';
import { ModEntityBuilder } from './ModEntityBuilder.js';
import { ModAssertionHelpers } from './ModAssertionHelpers.js';

// Test environment
import { createRuleTestEnvironment } from '../engine/systemLogicTestEnv.js';

// Utilities
import { expandMacros } from '../../src/logic/macroExpander.js';
import logSuccessMacro from '../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';

// Constants
import { ATTEMPT_ACTION_ID } from '../../src/constants/eventIds.js';

// Validation
import { assertNonBlankString, assertPresent } from '../../src/utils/validationCore.js';
```

### ModActionTestBase Design

```javascript
class ModActionTestBase {
  constructor(config) {
    // Validates and stores configuration
    this.modId = config.modId;
    this.actionId = config.actionId;
    this.ruleFile = config.ruleFile;
    this.conditionFile = config.conditionFile;
    this.handlerType = config.handlerType || 'standard';
    this.customMacros = config.customMacros || {};
  }

  // Test environment setup
  setupTestEnvironment() {
    // Creates standardized test environment
    // Integrates handler factory, entity builder, assertion helpers
  }

  // Entity creation methods  
  createStandardActorTarget(names = ['Alice', 'Bob'], location = 'room1') {
    // Uses ModEntityBuilder to create standard entity pair
  }

  createCloseActors(names = ['Alice', 'Bob'], location = 'room1') {
    // Creates actors with closeness relationship
  }

  createActorWithAnatomy(name = 'Alice', location = 'room1') {
    // Creates actor with basic anatomy for sex/violence tests
  }

  // Action execution methods
  async executeAction(actorId, targetId, options = {}) {
    // Standardized action execution with event dispatch
  }

  async executeActionWithInput(actorId, input, options = {}) {
    // Action execution with custom input string
  }

  // Assertion methods (delegates to ModAssertionHelpers)
  assertActionSuccess(expectedMessage = null) {
    return ModAssertionHelpers.assertActionSuccess(this.testEnv.events, expectedMessage);
  }

  assertActionFailure(expectedError = null) {
    return ModAssertionHelpers.assertActionFailure(this.testEnv.events, expectedError);
  }

  assertComponentAdded(entityId, componentId, expectedData = null) {
    return ModAssertionHelpers.assertComponentAdded(
      this.testEnv.entityManager, 
      entityId, 
      componentId, 
      expectedData
    );
  }

  // Utility methods
  resetWithEntities(entities) {
    // Resets test environment with provided entities
  }

  getEvents() {
    return this.testEnv.events;
  }

  getEntityManager() {
    return this.testEnv.entityManager;
  }

  // Template method pattern
  beforeEach() {
    // Can be overridden by subclasses for custom setup
    this.setupTestEnvironment();
  }

  afterEach() {
    // Can be overridden by subclasses for cleanup
    // Default: no cleanup needed
  }
}
```

### ModRuleTestBase Design

```javascript
class ModRuleTestBase extends ModActionTestBase {
  constructor(config) {
    super(config);
    this.ruleId = config.ruleId || config.actionId;
  }

  // Rule-specific setup
  setupRuleTestEnvironment() {
    // Extends base setup with rule-specific configuration
    super.setupTestEnvironment();
    
    // Additional rule-specific setup if needed
  }

  // Rule execution methods
  async executeRuleDirectly(eventData) {
    // Direct rule execution for rule testing
  }

  async triggerRuleViaAction(actorId, targetId, options = {}) {
    // Triggers rule through action execution
    return this.executeAction(actorId, targetId, options);
  }

  // Rule-specific assertions
  assertRuleExecuted(expectedRuleId) {
    // Validates rule was executed successfully
  }

  assertRuleSkipped(expectedReason = null) {
    // Validates rule was skipped with reason
  }

  // Override template methods for rule-specific behavior
  beforeEach() {
    this.setupRuleTestEnvironment();
  }
}
```

### Configuration Object Interface

```javascript
const actionTestConfig = {
  modId: 'intimacy',                    // Required: mod identifier
  actionId: 'kiss_cheek',               // Required: action identifier  
  ruleFile: kissCheekRule,              // Required: rule definition JSON
  conditionFile: eventIsActionKissCheek, // Required: condition definition JSON
  handlerType: 'standard',              // Optional: 'standard', 'positioning', 'intimacy', 'custom'
  customMacros: {},                     // Optional: additional macros beyond core
  customHandlers: {},                   // Optional: additional operation handlers
  testCategory: 'intimacy'              // Optional: category for specialized behavior
};
```

### Implementation Details

**Constructor and Validation**:
```javascript
constructor(config) {
  assertPresent(config, 'Configuration object is required');
  assertNonBlankString(config.modId, 'Mod ID', 'ModActionTestBase constructor');
  assertNonBlankString(config.actionId, 'Action ID', 'ModActionTestBase constructor');
  assertPresent(config.ruleFile, 'Rule file is required');
  assertPresent(config.conditionFile, 'Condition file is required');

  this.modId = config.modId;
  this.actionId = config.actionId;
  this.ruleFile = config.ruleFile;
  this.conditionFile = config.conditionFile;
  this.handlerType = config.handlerType || 'standard';
  this.customMacros = { ...config.customMacros };
  this.customHandlers = { ...config.customHandlers };
  this.testCategory = config.testCategory;
}
```

**Test Environment Setup**:
```javascript
setupTestEnvironment() {
  const macros = {
    'core:logSuccessAndEndTurn': logSuccessMacro,
    ...this.customMacros
  };
  
  const expanded = expandMacros(this.ruleFile.actions, {
    get: (type, id) => (type === 'macros' ? macros[id] : undefined),
  });

  const dataRegistry = {
    getAllSystemRules: jest
      .fn()
      .mockReturnValue([{ ...this.ruleFile, actions: expanded }]),
    getConditionDefinition: jest.fn((id) => {
      if (id === `${this.modId}:event-is-action-${this.actionId}`) {
        return this.conditionFile;
      }
      return undefined;
    }),
  };

  const createHandlers = this.createHandlersFunction();

  this.testEnv = createRuleTestEnvironment({
    createHandlers,
    entities: [],
    rules: [{ ...this.ruleFile, actions: expanded }],
    dataRegistry,
  });
}
```

**Handler Creation Integration**:
```javascript
createHandlersFunction() {
  switch (this.handlerType) {
    case 'positioning':
      return ModTestHandlerFactory.createPositioningHandlers.bind(ModTestHandlerFactory);
    case 'intimacy':
      return ModTestHandlerFactory.createIntimacyHandlers.bind(ModTestHandlerFactory);
    case 'custom':
      return (entityManager, eventBus, logger) => {
        const baseHandlers = ModTestHandlerFactory.createStandardHandlers(entityManager, eventBus, logger);
        return { ...baseHandlers, ...this.customHandlers };
      };
    default:
      return ModTestHandlerFactory.createStandardHandlers.bind(ModTestHandlerFactory);
  }
}
```

**Entity Creation Integration**:
```javascript
createStandardActorTarget(names = ['Alice', 'Bob'], location = 'room1') {
  const { actor, target } = ModEntityBuilder.createActorTargetPair(names[0], names[1], location);
  return { actor, target };
}

createCloseActors(names = ['Alice', 'Bob'], location = 'room1') {
  const actor = new ModEntityBuilder('actor1')
    .withName(names[0])
    .atLocation(location)
    .closeToEntity('target1')
    .build();
    
  const target = new ModEntityBuilder('target1')  
    .withName(names[1])
    .atLocation(location)
    .closeToEntity('actor1')
    .build();
    
  return { actor, target };
}
```

**Action Execution**:
```javascript
async executeAction(actorId, targetId, options = {}) {
  const {
    actionId = this.actionId,
    originalInput = `${this.actionId} ${targetId}`,
    eventName = 'core:attempt_action',
    ...additionalOptions
  } = options;

  await this.testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
    eventName,
    actorId,
    actionId: `${this.modId}:${actionId}`,
    targetId,
    originalInput,
    ...additionalOptions
  });

  return this.testEnv.events;
}
```

### Usage Patterns

**Before (manual setup in each test file)**:
```javascript
function createHandlers(entityManager, eventBus, logger) {
  // 30+ lines repeated in every file
}

describe('intimacy:kiss_cheek action integration', () => {
  let testEnv;
  
  beforeEach(() => {
    // 20+ lines of setup
  });
  
  it('should execute kiss cheek action successfully', async () => {
    testEnv.reset([/* manual entity creation */]);
    await testEnv.eventBus.dispatch(/* manual dispatch */);
    /* manual assertions */
  });
});
```

**After (base class usage)**:
```javascript
import { ModActionTestBase } from '../common/mods/ModActionTestBase.js';
import kissCheekRule from '../../data/mods/intimacy/rules/kissRule.rule.json';
import eventIsActionKissCheek from '../../data/mods/intimacy/conditions/eventIsActionKissCheek.condition.json';

class KissCheekActionTest extends ModActionTestBase {
  constructor() {
    super({
      modId: 'intimacy',
      actionId: 'kiss_cheek',
      ruleFile: kissCheekRule,
      conditionFile: eventIsActionKissCheek,
      handlerType: 'intimacy',
      testCategory: 'intimacy'
    });
  }
}

describe('intimacy:kiss_cheek action integration', () => {
  let test;
  
  beforeEach(() => {
    test = new KissCheekActionTest();
    test.beforeEach();
  });
  
  it('should execute kiss cheek action successfully', async () => {
    const { actor, target } = test.createCloseActors(['Alice', 'Bob']);
    test.resetWithEntities([actor, target]);
    
    await test.executeAction(actor.id, target.id);
    test.assertActionSuccess("Alice leans in to kiss Bob's cheek softly.");
  });
});
```

### Category-Specific Extensions

**Positioning Test Extension**:
```javascript
class ModPositioningTestBase extends ModActionTestBase {
  constructor(config) {
    super({ ...config, handlerType: 'positioning' });
  }
  
  createPositioningActors(names = ['Alice', 'Bob'], location = 'room1') {
    const { actor, target } = this.createCloseActors(names, location);
    // Add positioning-specific components
    return { actor, target };
  }
  
  assertPositionChanged(actorId, expectedPosition) {
    return this.assertComponentAdded(actorId, `positioning:${expectedPosition}`);
  }
}
```

**Intimacy Test Extension**:
```javascript
class ModIntimacyTestBase extends ModActionTestBase {
  constructor(config) {
    super({ ...config, handlerType: 'intimacy', testCategory: 'intimacy' });
  }
  
  createIntimatePartners(names = ['Alice', 'Bob'], location = 'room1') {
    return this.createCloseActors(names, location);
  }
  
  assertIntimateAction(actorName, targetName, actionDescription) {
    const expectedMessage = `${actorName} ${actionDescription} ${targetName}`;
    return this.assertActionSuccess(expectedMessage);
  }
}
```

## Implementation Steps

### Step 1: Create ModActionTestBase Structure
1. Create `tests/common/mods/ModActionTestBase.js`
2. Implement constructor with configuration validation
3. Add infrastructure component integration
4. Implement basic entity creation and action execution methods

### Step 2: Integrate Infrastructure Components
1. Integrate ModTestHandlerFactory for handler creation
2. Add ModEntityBuilder integration for entity creation
3. Wire in ModAssertionHelpers for assertion methods
4. Test integration with existing test infrastructure

### Step 3: Implement ModRuleTestBase Extension
1. Create `tests/common/mods/ModRuleTestBase.js` extending ModActionTestBase
2. Add rule-specific execution methods
3. Implement rule-specific assertion patterns
4. Test rule execution scenarios

### Step 4: Create Category-Specific Extensions
1. Implement ModPositioningTestBase with positioning-specific methods
2. Add ModIntimacyTestBase with intimacy-specific patterns
3. Create extension points for violence and exercise categories
4. Test category-specific functionality

### Step 5: Add Template Method Patterns
1. Implement beforeEach/afterEach template methods
2. Add hooks for custom setup and teardown
3. Create extension points for category-specific behavior
4. Document customization patterns

## Validation & Testing

### Unit Tests Required

**Files**: 
- `tests/unit/common/mods/ModActionTestBase.test.js`
- `tests/unit/common/mods/ModRuleTestBase.test.js`

**Test Coverage**:
```javascript
describe('ModActionTestBase', () => {
  describe('constructor', () => {
    it('should validate required configuration parameters');
    it('should set default values for optional parameters');
    it('should throw error for missing mod ID');
    it('should throw error for missing rule file');
  });

  describe('setupTestEnvironment', () => {
    it('should create test environment with correct configuration');
    it('should integrate handler factory correctly');
    it('should expand macros properly');
    it('should set up data registry with rule and condition');
  });

  describe('createStandardActorTarget', () => {
    it('should create actor and target entities');
    it('should use custom names when provided');
    it('should place entities in specified location');
  });

  describe('executeAction', () => {
    it('should dispatch action event with correct parameters');
    it('should use default action ID and input');
    it('should handle custom options');
    it('should return events array');
  });

  describe('assertion methods', () => {
    it('should delegate to ModAssertionHelpers correctly');
    it('should pass test environment references');
    it('should return assertion results');
  });

  describe('template methods', () => {
    it('should call setupTestEnvironment in beforeEach');
    it('should support customization through inheritance');
  });
});

describe('ModRuleTestBase', () => {
  describe('inheritance', () => {
    it('should extend ModActionTestBase correctly');
    it('should add rule-specific configuration');
  });

  describe('rule execution', () => {
    it('should support direct rule execution');
    it('should support rule execution via action');
  });

  describe('rule assertions', () => {
    it('should validate rule execution');
    it('should validate rule skipping scenarios');
  });
});
```

### Integration Testing
1. Test base classes with actual mod rule and condition files
2. Verify integration with all infrastructure components works correctly
3. Test category-specific extensions with real mod scenarios
4. Validate template method customization patterns

### Migration Testing
1. Convert sample test file to use base class
2. Verify identical behavior between old and new approaches
3. Test performance impact of base class usage
4. Validate all mod categories work with base classes

## Acceptance Criteria

### Functional Requirements
- [ ] Base classes eliminate setup duplication across mod tests
- [ ] Infrastructure component integration works seamlessly
- [ ] Entity creation patterns standardized and consistent
- [ ] Action execution methods support all mod categories
- [ ] Assertion methods provide comprehensive validation
- [ ] Template method pattern supports customization

### Quality Requirements
- [ ] 100% unit test coverage for base class methods
- [ ] Integration tests validate real-world usage scenarios
- [ ] JSDoc documentation complete for all public methods
- [ ] Error handling comprehensive with helpful messages
- [ ] Performance comparable to manual test setup

### Usability Requirements
- [ ] Configuration object clear and self-documenting
- [ ] Method names intuitive and consistent
- [ ] Extension patterns straightforward for new categories
- [ ] Template methods support common customization needs

### Compatibility Requirements
- [ ] Works with existing test infrastructure without changes
- [ ] Supports all current mod categories (exercise, sex, positioning, violence, intimacy)
- [ ] Maintains backward compatibility during migration
- [ ] Extensible for future mod categories

## Success Metrics

### Code Reduction
- **Target**: Eliminate 960+ lines of repeated setup code
- **Measurement**: Line count comparison in test setup sections
- **Success**: >80% reduction in manual setup code

### Consistency Improvement
- **Target**: Standardized test patterns across all mod categories
- **Measurement**: Pattern variance analysis across test files
- **Success**: >95% consistency in test structure patterns

### Development Speed
- **Target**: Faster new mod test creation
- **Measurement**: Time to create new mod test from scratch
- **Success**: 70%+ reduction in test development time

### Maintenance Improvement
- **Target**: Single location for test pattern updates
- **Measurement**: Time to update test patterns across all tests
- **Success**: Update time reduced from days to hours

## Integration Points

### Infrastructure Dependencies
- **MODTESTREF-001**: Uses ModTestHandlerFactory for handler creation
- **MODTESTREF-002**: Uses ModEntityBuilder for entity creation
- **MODTESTREF-003**: Uses ModAssertionHelpers for validation

### Migration Integration
- **MODTESTREF-007**: Provides base classes for migrating existing tests
- Base classes must support all patterns found in existing 48 test files

### Future Extensions
- **New Mod Categories**: Base classes must be extensible for new categories
- **Community Mods**: Patterns must be clear for community mod test development

## Next Steps

Upon completion, these base classes will be ready for:
1. **MODTESTREF-005**: Integration with ModTestFixture factory for unified test creation
2. **MODTESTREF-007**: Migration of all 48 existing test files to use base classes
3. **MODTESTREF-008**: Documentation of base class usage patterns and best practices
4. **Future**: Extension for new mod categories and specialized test scenarios

These base classes will provide the foundational inheritance structure that unifies all mod integration tests and enables consistent, maintainable test development across the entire project.