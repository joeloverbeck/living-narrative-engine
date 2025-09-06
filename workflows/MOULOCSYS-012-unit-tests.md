# MOULOCSYS-012: Create Comprehensive Unit Tests

**Phase**: Testing & Validation  
**Priority**: High  
**Complexity**: High  
**Dependencies**: All implementation tickets (MOULOCSYS-001 through MOULOCSYS-011)  
**Estimated Time**: 8-10 hours

## Summary

Create comprehensive unit test suites for all mouth engagement system components, including handlers, utilities, conditions, and component schemas. Ensure >95% code coverage and thorough edge case testing for the entire mouth locking system.

## Technical Requirements

### Test Files to Create

1. `tests/unit/logic/operationHandlers/lockMouthEngagementHandler.test.js` 
2. `tests/unit/logic/operationHandlers/unlockMouthEngagementHandler.test.js`
3. `tests/unit/utils/mouthEngagementUtils.test.js`
4. `tests/unit/mods/core/conditions/actorMouthAvailable.test.js`
5. `tests/unit/schemas/mouthEngagement.schema.test.js`
6. `tests/unit/mods/core/components/mouthEngagement.test.js`

### Testing Architecture

#### Test Structure Pattern
```javascript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('ComponentName - Feature Group', () => {
  let testBed;
  let mockDependency1;
  let mockDependency2;

  beforeEach(() => {
    testBed = createTestBed();
    mockDependency1 = testBed.createMock('dep1', ['method1', 'method2']);
    mockDependency2 = testBed.createMock('dep2', ['methodA', 'methodB']);
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Feature Category', () => {
    it('should handle expected case', () => {
      // Arrange
      // Act  
      // Assert
    });

    it('should handle edge case', () => {
      // Test edge cases
    });

    it('should handle error case', () => {
      // Test error scenarios
    });
  });
});
```

### Coverage Requirements

#### Code Coverage Targets
- **Line Coverage**: >95%
- **Branch Coverage**: >90%
- **Function Coverage**: 100%
- **Statement Coverage**: >95%

#### Test Categories Required
- **Happy Path**: Expected successful operations
- **Edge Cases**: Boundary conditions and unusual inputs
- **Error Cases**: Failed operations and invalid inputs
- **Integration Points**: Mocking and dependency validation

### Unit Test Suites

#### 1. LockMouthEngagementHandler Tests

File: `tests/unit/logic/operationHandlers/lockMouthEngagementHandler.test.js`

```javascript
describe('LockMouthEngagementHandler', () => {
  describe('Constructor', () => {
    it('should validate required dependencies');
    it('should validate dependency methods');
    it('should extend BaseOperationHandler');
  });

  describe('Parameter Validation', () => {
    it('should reject missing parameters');
    it('should reject invalid actor_id types');
    it('should reject empty actor_id');
    it('should reject non-existent entities');
  });

  describe('Anatomy-Based Execution', () => {
    it('should lock mouth in anatomy entity');
    it('should handle multiple mouth parts');
    it('should create component if missing');
    it('should update existing component');
    it('should handle entities without mouths');
  });

  describe('Legacy Entity Execution', () => {
    it('should lock direct entity component');
    it('should create component if missing');
    it('should preserve forcedOverride flag');
  });

  describe('Event Dispatching', () => {
    it('should dispatch success event on lock');
    it('should dispatch error event on failure');
    it('should include correct event payload');
  });

  describe('Error Handling', () => {
    it('should handle component update failures');
    it('should handle utility function errors');
    it('should not throw on async errors');
  });
});
```

#### 2. UnlockMouthEngagementHandler Tests

File: `tests/unit/logic/operationHandlers/unlockMouthEngagementHandler.test.js`

```javascript
describe('UnlockMouthEngagementHandler', () => {
  describe('Idempotent Operations', () => {
    it('should handle already unlocked mouths');
    it('should unlock multiple times safely');
    it('should not error on missing component');
  });

  describe('Success Scenarios', () => {
    it('should unlock locked mouth');
    it('should unlock all mouth parts');
    it('should dispatch unlock event');
  });

  describe('Component State Management', () => {
    it('should preserve forcedOverride when unlocking');
    it('should maintain other component properties');
    it('should create component in unlocked state if missing');
  });
});
```

#### 3. MouthEngagementUtils Tests

File: `tests/unit/utils/mouthEngagementUtils.test.js`

```javascript
describe('mouthEngagementUtils', () => {
  describe('updateMouthEngagementLock', () => {
    describe('Input Validation', () => {
      it('should throw for null entityManager');
      it('should throw for invalid entityId');
      it('should throw for non-boolean locked');
    });

    describe('Anatomy-Based Updates', () => {
      it('should update single mouth part');
      it('should update multiple mouth parts');
      it('should return null for no mouth parts');
      it('should handle complex body structures');
    });

    describe('Legacy Updates', () => {
      it('should update existing component');
      it('should create component if missing');
      it('should clone component properly');
    });
  });

  describe('isMouthLocked', () => {
    it('should return true for locked anatomy mouths');
    it('should return false for unlocked anatomy mouths'); 
    it('should return true for locked legacy components');
    it('should return false for missing components');
    it('should handle invalid inputs gracefully');
  });

  describe('getMouthParts', () => {
    it('should return all mouth parts with details');
    it('should return empty array for no mouths');
    it('should include engagement component data');
    it('should handle missing engagement components');
  });
});
```

#### 4. Actor Mouth Available Condition Tests

File: `tests/unit/mods/core/conditions/actorMouthAvailable.test.js`

```javascript
describe('actor-mouth-available Condition', () => {
  describe('Mouth Available Cases', () => {
    it('should return true when mouth is unlocked');
    it('should return true when no engagement component exists');
    it('should handle multiple mouth parts correctly');
    it('should handle anatomy-based entities');
  });

  describe('Mouth Unavailable Cases', () => {
    it('should return false when mouth is locked');
    it('should return false when no mouth exists');
    it('should return false for entities without anatomy');
  });

  describe('Edge Cases', () => {
    it('should handle malformed engagement components');
    it('should handle circular anatomy references');
    it('should handle missing anatomy components');
  });

  describe('Performance', () => {
    it('should complete evaluation in <10ms');
    it('should not create unnecessary objects');
    it('should cache anatomy lookups efficiently');
  });
});
```

#### 5. Schema Validation Tests

File: `tests/unit/schemas/mouthEngagement.schema.test.js`

```javascript
describe('Mouth Engagement Schemas', () => {
  describe('Component Schema', () => {
    it('should validate correct mouth engagement data');
    it('should reject invalid field types');
    it('should reject additional properties');  
    it('should require locked field');
    it('should allow optional forcedOverride');
    it('should validate default values');
  });

  describe('Operation Schemas', () => {
    it('should validate LOCK_MOUTH_ENGAGEMENT operation');
    it('should validate UNLOCK_MOUTH_ENGAGEMENT operation');
    it('should reject missing actor_id');
    it('should reject invalid actor_id format');
    it('should reject additional parameters');
  });

  describe('Schema Compliance', () => {
    it('should extend base schemas correctly');
    it('should follow naming conventions'); 
    it('should include proper descriptions');
    it('should validate against JSON Schema Draft-07');
  });
});
```

#### 6. Component Registration Tests

File: `tests/unit/mods/core/components/mouthEngagement.test.js`

```javascript
describe('Mouth Engagement Component', () => {
  describe('Component Registration', () => {
    it('should register with entity system');
    it('should validate against component schema');
    it('should be creatable by entity manager');
    it('should follow naming conventions');
  });

  describe('Component Usage', () => {
    it('should work with addComponent');
    it('should work with getComponentData'); 
    it('should work with removeComponent');
    it('should serialize/deserialize correctly');
  });

  describe('Default Values', () => {
    it('should initialize with locked: false');
    it('should initialize with forcedOverride: false');
    it('should accept custom values');
    it('should validate field types');
  });
});
```

## Test Implementation Strategy

### Mock Objects and Test Doubles

#### EntityManager Mock
```javascript
const mockEntityManager = {
  hasEntity: jest.fn(),
  getComponentData: jest.fn(),
  addComponent: jest.fn(),
  removeComponent: jest.fn()
};
```

#### EventDispatcher Mock
```javascript
const mockEventDispatcher = {
  dispatch: jest.fn()
};
```

#### Logger Mock
```javascript
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};
```

### Test Data Factories

#### Actor Factory
```javascript
async function createTestActor(entityManager, options = {}) {
  const {
    hasMouth = true,
    mouthLocked = false,
    movementLocked = false,
    id = `test_actor_${Date.now()}`
  } = options;

  const actor = await entityManager.createEntity(id);
  
  if (hasMouth) {
    await setupActorMouth(entityManager, actor, { locked: mouthLocked });
  }
  
  if (movementLocked) {
    await entityManager.addComponent(actor, 'core:movement', { locked: true });
  }
  
  return actor;
}
```

#### Anatomy Factory
```javascript
async function createAnatomyBasedActor(entityManager, bodyType = 'humanoid') {
  const actor = await entityManager.createEntity(`anatomy_actor_${Date.now()}`);
  
  // Create body structure
  const torso = await entityManager.createEntity(`torso_${Date.now()}`);
  const mouth = await entityManager.createEntity(`mouth_${Date.now()}`);
  
  await entityManager.addComponent(mouth, 'anatomy:part', { subType: 'mouth' });
  await entityManager.addComponent(mouth, 'core:mouth_engagement', {
    locked: false,
    forcedOverride: false
  });
  
  await entityManager.addComponent(actor, 'anatomy:body', {
    body: {
      root: torso.id,
      parts: { mouth: mouth.id }
    }
  });
  
  return { actor, torso, mouth };
}
```

## Acceptance Criteria

### Code Coverage
- [ ] **Overall Coverage**: >95% line coverage across all components
- [ ] **Branch Coverage**: >90% decision point coverage
- [ ] **Function Coverage**: 100% function coverage
- [ ] **Statement Coverage**: >95% executable statement coverage

### Test Quality
- [ ] **Test Categories**: Happy path, edge cases, error cases covered
- [ ] **Mock Usage**: Proper mocking of dependencies
- [ ] **Async Handling**: Correct async/await patterns
- [ ] **Test Independence**: Each test runs independently
- [ ] **Clear Assertions**: Descriptive test names and assertions

### Performance Testing
- [ ] **Execution Speed**: Test suite completes in <30 seconds
- [ ] **Memory Usage**: No memory leaks in test runs
- [ ] **Parallel Execution**: Tests can run in parallel
- [ ] **Resource Cleanup**: Proper cleanup in afterEach hooks

### Integration with CI/CD
- [ ] **Jest Configuration**: Proper jest.config.unit.js setup
- [ ] **Coverage Reports**: Generate coverage reports
- [ ] **Failure Reporting**: Clear failure messages
- [ ] **Watch Mode**: Support for watch mode development

## Running Tests

### Test Execution Commands
```bash
# Run all unit tests
npm run test:unit

# Run mouth engagement tests only  
npm run test:unit -- --testPathPattern="mouth|engagement"

# Run with coverage
npm run test:unit -- --coverage

# Run specific test file
npm run test:unit tests/unit/utils/mouthEngagementUtils.test.js

# Watch mode for development
npm run test:unit -- --watch
```

### Coverage Analysis
```bash
# Generate detailed coverage report
npm run test:unit -- --coverage --coverageReporters=html

# Open coverage report
open coverage/lcov-report/index.html
```

## Definition of Done

- [ ] All 6 test files created and implemented
- [ ] >95% line coverage achieved
- [ ] >90% branch coverage achieved  
- [ ] 100% function coverage achieved
- [ ] All test categories implemented (happy path, edge cases, errors)
- [ ] Proper mock objects and test doubles used
- [ ] Test data factories created
- [ ] All tests passing consistently
- [ ] Performance requirements met (<30s execution)
- [ ] Integration with existing test infrastructure
- [ ] Coverage reports generated and reviewed
- [ ] Documentation for running and maintaining tests