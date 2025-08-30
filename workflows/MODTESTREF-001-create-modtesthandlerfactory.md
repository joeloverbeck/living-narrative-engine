# MODTESTREF-001: Create ModTestHandlerFactory

## Overview

Create a centralized factory for mod test operation handlers to eliminate massive code duplication across 48 test files. Currently each test file contains identical 30+ line `createHandlers` functions, resulting in 1,440+ lines of duplicated code.

## Problem Statement

### Current Duplication

Every mod integration test file contains nearly identical handler creation code:

```javascript
function createHandlers(entityManager, eventBus, logger) {
  const safeDispatcher = {
    dispatch: jest.fn((eventType, payload) => {
      eventBus.dispatch(eventType, payload);
      return Promise.resolve(true);
    }),
  };

  return {
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    GET_NAME: new GetNameHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    GET_TIMESTAMP: new GetTimestampHandler({ logger }),
    DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
      dispatcher: eventBus,
      logger,
      addPerceptionLogEntryHandler: { execute: jest.fn() },
    }),
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
    END_TURN: new EndTurnHandler({
      safeEventDispatcher: safeDispatcher,
      logger,
    }),
    SET_VARIABLE: new SetVariableHandler({ logger }),
  };
}
```

### Variations Identified

- **ADD_COMPONENT Handler**: Some positioning tests include this handler for component addition during execution
- **Handler Ordering**: Inconsistent ordering between files causes maintenance issues
- **Missing Handlers**: Some intimacy tests omit `SET_VARIABLE` handler
- **Copy-Paste Errors**: Manual duplication leads to inconsistencies

### Impact

- **48 test files** with identical handler creation patterns
- **1,440 lines** of duplicated code (30 lines × 48 files)
- **Maintenance nightmare**: Changes to handlers require updating every file
- **Inconsistency risk**: Manual updates lead to copy-paste errors

## Technical Requirements

### Core Infrastructure

**File Location**: `tests/common/mods/ModTestHandlerFactory.js`

**Dependencies**:
```javascript
// Operation Handlers
import { QueryComponentHandler } from '../../src/entities/components/operations/queryComponentHandler.js';
import { GetNameHandler } from '../../src/entities/components/operations/getNameHandler.js';
import { GetTimestampHandler } from '../../src/entities/components/operations/getTimestampHandler.js';
import { DispatchPerceptibleEventHandler } from '../../src/entities/components/operations/dispatchPerceptibleEventHandler.js';
import { DispatchEventHandler } from '../../src/entities/components/operations/dispatchEventHandler.js';
import { EndTurnHandler } from '../../src/entities/components/operations/endTurnHandler.js';
import { SetVariableHandler } from '../../src/entities/components/operations/setVariableHandler.js';
import { AddComponentHandler } from '../../src/entities/components/operations/addComponentHandler.js';
```

### Factory Interface Design

```javascript
class ModTestHandlerFactory {
  /**
   * Creates standard handler set for basic mod tests
   * Includes: QUERY_COMPONENT, GET_NAME, GET_TIMESTAMP, DISPATCH_PERCEPTIBLE_EVENT, 
   *          DISPATCH_EVENT, END_TURN, SET_VARIABLE
   */
  static createStandardHandlers(entityManager, eventBus, logger) {
    // Implementation
  }

  /**
   * Creates handler set with ADD_COMPONENT for positioning tests
   * Includes all standard handlers + ADD_COMPONENT
   */
  static createPositioningHandlers(entityManager, eventBus, logger) {
    // Implementation
  }

  /**
   * Creates handler set for intimacy tests (may omit SET_VARIABLE)
   * Configurable based on intimacy test requirements
   */
  static createIntimacyHandlers(entityManager, eventBus, logger, includeSetVariable = false) {
    // Implementation
  }

  /**
   * Creates fully customizable handler set
   * Allows specifying exactly which handlers to include
   */
  static createCustomHandlers(entityManager, eventBus, logger, options = {}) {
    // Implementation with options:
    // - includeAddComponent: boolean
    // - includeSetVariable: boolean
    // - additionalHandlers: object
  }

  /**
   * Internal method to create safe event dispatcher
   * Used by all handler creation methods
   */
  static #createSafeDispatcher(eventBus) {
    // Private implementation
  }
}
```

### Implementation Details

**Safe Event Dispatcher Pattern**:
```javascript
static #createSafeDispatcher(eventBus) {
  return {
    dispatch: jest.fn((eventType, payload) => {
      eventBus.dispatch(eventType, payload);
      return Promise.resolve(true);
    }),
  };
}
```

**Standard Handler Configuration**:
- **QUERY_COMPONENT**: Entity component queries
- **GET_NAME**: Entity name retrieval  
- **GET_TIMESTAMP**: Timestamp operations
- **DISPATCH_PERCEPTIBLE_EVENT**: User-perceivable event dispatch
- **DISPATCH_EVENT**: General event dispatch
- **END_TURN**: Turn completion handling
- **SET_VARIABLE**: Variable assignment (optional for intimacy)

**Additional Handlers for Positioning**:
- **ADD_COMPONENT**: Dynamic component addition during action execution

### Error Handling

```javascript
static createStandardHandlers(entityManager, eventBus, logger) {
  if (!entityManager) {
    throw new Error('ModTestHandlerFactory: entityManager is required');
  }
  if (!eventBus) {
    throw new Error('ModTestHandlerFactory: eventBus is required');
  }
  if (!logger) {
    throw new Error('ModTestHandlerFactory: logger is required');
  }
  
  // Implementation continues...
}
```

### Usage Patterns

**Before (48 files with duplication)**:
```javascript
function createHandlers(entityManager, eventBus, logger) {
  // 30+ lines repeated in every file
}
```

**After (centralized factory)**:
```javascript
import { ModTestHandlerFactory } from '../common/mods/ModTestHandlerFactory.js';

// Standard mod test
const handlers = ModTestHandlerFactory.createStandardHandlers(entityManager, eventBus, logger);

// Positioning test with ADD_COMPONENT
const handlers = ModTestHandlerFactory.createPositioningHandlers(entityManager, eventBus, logger);

// Custom configuration
const handlers = ModTestHandlerFactory.createCustomHandlers(entityManager, eventBus, logger, {
  includeAddComponent: true,
  includeSetVariable: false
});
```

## Implementation Steps

### Step 1: Create Base Factory Structure
1. Create `tests/common/mods/` directory
2. Create `ModTestHandlerFactory.js` with class definition
3. Import all required operation handlers
4. Implement private `#createSafeDispatcher` method

### Step 2: Implement Standard Handler Methods
1. Implement `createStandardHandlers` with core handler set
2. Add proper parameter validation and error handling
3. Ensure consistent handler ordering across all methods

### Step 3: Implement Specialized Variants
1. Implement `createPositioningHandlers` with ADD_COMPONENT
2. Implement `createIntimacyHandlers` with SET_VARIABLE option
3. Implement `createCustomHandlers` with full configurability

### Step 4: Add Documentation and Examples
1. Add comprehensive JSDoc comments for all methods
2. Create usage examples for each factory method
3. Document migration patterns for existing tests

### Step 5: Validation Testing
1. Create unit tests for factory methods
2. Test with sample entityManager, eventBus, logger mocks
3. Verify handler configurations match existing patterns
4. Test error handling for invalid parameters

## Validation & Testing

### Unit Tests Required

**File**: `tests/unit/common/mods/ModTestHandlerFactory.test.js`

**Test Coverage**:
```javascript
describe('ModTestHandlerFactory', () => {
  describe('createStandardHandlers', () => {
    it('should create all standard handlers with correct configuration');
    it('should throw error when entityManager is missing');
    it('should throw error when eventBus is missing');
    it('should throw error when logger is missing');
    it('should create safe dispatcher with mock dispatch method');
  });

  describe('createPositioningHandlers', () => {
    it('should create standard handlers plus ADD_COMPONENT handler');
    it('should configure ADD_COMPONENT handler correctly');
  });

  describe('createIntimacyHandlers', () => {
    it('should create handlers without SET_VARIABLE by default');
    it('should include SET_VARIABLE when explicitly requested');
  });

  describe('createCustomHandlers', () => {
    it('should create handlers based on options configuration');
    it('should handle empty options object');
    it('should combine standard and additional handlers');
  });

  describe('#createSafeDispatcher', () => {
    it('should create dispatcher with jest mock function');
    it('should dispatch events through provided eventBus');
    it('should return Promise.resolve(true) from dispatch');
  });
});
```

### Integration Testing
1. Test factory integration with `createRuleTestEnvironment`
2. Verify handlers work correctly with actual test scenarios
3. Validate no behavioral changes from existing handler creation

### Migration Validation
1. Replace handlers in one test file using new factory
2. Run existing test to ensure identical behavior
3. Compare handler objects between old and new approaches
4. Document any differences discovered

## Acceptance Criteria

### Functional Requirements
- [ ] Factory creates identical handler configurations to existing pattern
- [ ] All standard handlers (7) included in `createStandardHandlers`
- [ ] Positioning variant includes ADD_COMPONENT handler
- [ ] Intimacy variant supports optional SET_VARIABLE handler
- [ ] Custom variant supports full configuration flexibility
- [ ] Safe event dispatcher functions identically to existing pattern

### Quality Requirements  
- [ ] 100% unit test coverage for factory methods
- [ ] Integration tests demonstrate working handler configurations
- [ ] JSDoc documentation complete for all public methods
- [ ] Error handling for invalid parameters implemented
- [ ] Code follows project naming conventions and patterns

### Performance Requirements
- [ ] Factory method execution time under 10ms
- [ ] Memory usage comparable to manual handler creation
- [ ] No performance regression in test execution

### Migration Readiness
- [ ] Usage examples documented for each mod category
- [ ] Migration pattern documented for existing tests  
- [ ] Validation strategy confirmed with sample migration
- [ ] Backwards compatibility maintained during transition

## Success Metrics

### Code Reduction
- **Target**: Eliminate 1,440+ lines of duplicated handler creation code
- **Measurement**: Line count comparison before/after migration
- **Success**: >95% reduction in handler creation duplication

### Maintenance Improvement
- **Target**: Single location for handler configuration changes
- **Measurement**: Time to update handler patterns across tests
- **Success**: Update time reduced from hours to minutes

### Consistency Improvement  
- **Target**: Identical handler configurations across all mod tests
- **Measurement**: Handler configuration variance analysis
- **Success**: Zero variance in standard handler configurations

### Developer Experience
- **Target**: Simplified test setup for new mod tests
- **Measurement**: Developer feedback and new test creation time
- **Success**: 60%+ reduction in test setup time

## Next Steps

Upon completion, this factory will be ready for:
1. **MODTESTREF-002**: Integration with ModEntityBuilder
2. **MODTESTREF-004**: Usage in ModActionTestBase and ModRuleTestBase  
3. **MODTESTREF-007**: Migration of existing 48 test files
4. **Future**: Extension for new handler types and mod categories

This foundational infrastructure will eliminate the largest source of code duplication in the mod integration tests and provide a scalable pattern for handling the project's growth to thousands of mod test files.