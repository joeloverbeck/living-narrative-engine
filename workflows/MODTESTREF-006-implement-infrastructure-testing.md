# MODTESTREF-006: Implement Infrastructure Testing

## Overview

Create comprehensive testing for the mod test infrastructure to validate integration between all components (ModTestHandlerFactory, ModEntityBuilder, ModAssertionHelpers, ModActionTestBase, ModTestFixture) and ensure the new architecture works correctly before migration begins.

## Problem Statement

### Infrastructure Validation Needs

The mod test infrastructure consists of multiple interconnected components that must work together seamlessly:

1. **ModTestHandlerFactory** - Creates operation handlers
2. **ModEntityBuilder** - Creates test entities
3. **ModAssertionHelpers** - Validates test results
4. **ModActionTestBase/ModRuleTestBase** - Orchestrates test execution
5. **ModTestFixture** - Unifies everything into simple factory methods

### Critical Validation Requirements

- **Component Integration**: All components must work together without conflicts
- **Real-World Compatibility**: Infrastructure must work with actual mod files
- **Performance Validation**: No significant performance regression
- **Error Handling**: Robust error handling across all components
- **Edge Case Coverage**: Handle malformed data and edge cases gracefully

### Migration Risk Mitigation

Before migrating 48 existing test files, we need confidence that:

- New infrastructure produces identical test behavior
- All mod categories are supported correctly
- Edge cases and error scenarios work properly
- Performance is acceptable for large test suites

## Technical Requirements

### Test Structure Organization

**Directory Structure**:

```
tests/
├── unit/common/mods/           # Unit tests for each component
│   ├── ModTestHandlerFactory.test.js
│   ├── ModEntityBuilder.test.js
│   ├── ModAssertionHelpers.test.js
│   ├── ModActionTestBase.test.js
│   ├── ModRuleTestBase.test.js
│   └── ModTestFixture.test.js
├── integration/mods/infrastructure/    # Infrastructure integration tests
│   ├── componentIntegration.test.js
│   ├── realModIntegration.test.js
│   ├── performanceValidation.test.js
│   └── errorHandling.test.js
└── e2e/mods/infrastructure/           # End-to-end infrastructure tests
    ├── completeWorkflow.test.js
    └── migrationValidation.test.js
```

### Component Integration Tests

**File**: `tests/integration/mods/infrastructure/componentIntegration.test.js`

**Purpose**: Validate that all infrastructure components work together correctly

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestHandlerFactory } from '../../../common/mods/ModTestHandlerFactory.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import { ModActionTestBase } from '../../../common/mods/ModActionTestBase.js';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('Mod Test Infrastructure Integration', () => {
  describe('Handler Factory Integration', () => {
    it('should create handlers that work with ModActionTestBase');
    it('should support all handler types (standard, positioning, intimacy)');
    it('should integrate with entity manager from test environment');
  });

  describe('Entity Builder Integration', () => {
    it('should create entities that work with handlers');
    it('should support all component types used by mod tests');
    it('should create valid entity relationships');
  });

  describe('Assertion Helpers Integration', () => {
    it('should validate events created by handler execution');
    it('should validate entities created by builder');
    it('should provide helpful error messages for failures');
  });

  describe('Base Class Integration', () => {
    it('should orchestrate all components correctly');
    it('should support inheritance and customization');
    it('should maintain consistent state across operations');
  });

  describe('Factory Integration', () => {
    it('should create working test instances for all categories');
    it('should auto-detect and configure components correctly');
    it('should handle file loading and configuration seamlessly');
  });
});
```

### Real Mod Integration Tests

**File**: `tests/integration/mods/infrastructure/realModIntegration.test.js`

**Purpose**: Validate infrastructure works with actual mod files from each category

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

// Import sample mod files from each category
import kissCheekRule from '../../../data/mods/intimacy/rules/kissRule.rule.json';
import eventIsActionKissCheek from '../../../data/mods/intimacy/conditions/eventIsActionKissCheek.condition.json';
import kneelBeforeRule from '../../../data/mods/positioning/rules/kneelRule.rule.json';
import eventIsActionKneel from '../../../data/mods/positioning/conditions/eventIsActionKneel.condition.json';
// Additional imports for all categories

describe('Real Mod Integration Testing', () => {
  describe('Intimacy Category Integration', () => {
    let test;

    beforeEach(() => {
      test = ModTestFixture.forAction('intimacy', 'kiss_cheek', {
        ruleFile: kissCheekRule,
        conditionFile: eventIsActionKissCheek,
      });
      test.beforeEach();
    });

    it('should execute intimate actions with real mod files', async () => {
      const { actor, target } = test.createCloseActors(['Alice', 'Bob']);
      test.resetWithEntities([actor, target]);

      await test.executeAction(actor.id, target.id);
      test.assertActionSuccess("Alice leans in to kiss Bob's cheek softly.");
    });

    it('should handle intimacy-specific component requirements');
    it('should validate intimacy-specific event patterns');
  });

  describe('Positioning Category Integration', () => {
    let test;

    beforeEach(() => {
      test = ModTestFixture.forAction('positioning', 'kneel_before', {
        ruleFile: kneelBeforeRule,
        conditionFile: eventIsActionKneel,
      });
      test.beforeEach();
    });

    it('should execute positioning actions with real mod files', async () => {
      const { actor, target } = test.createCloseActors(['Alice', 'Bob']);
      test.resetWithEntities([actor, target]);

      await test.executeAction(actor.id, target.id);
      test.assertActionSuccess();
      test.assertComponentAdded(actor.id, 'positioning:kneeling_before');
    });

    it('should handle positioning component additions');
    it('should validate positioning relationship changes');
  });

  // Similar test suites for sex, violence, exercise categories

  describe('Cross-Category Compatibility', () => {
    it('should support mixed category testing scenarios');
    it('should handle category transitions correctly');
    it('should maintain consistent behavior across categories');
  });
});
```

### Performance Validation Tests

**File**: `tests/integration/mods/infrastructure/performanceValidation.test.js`

**Purpose**: Ensure infrastructure doesn't introduce performance regressions

```javascript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { performance } from 'perf_hooks';

describe('Infrastructure Performance Validation', () => {
  let performanceData = {
    setupTimes: [],
    executionTimes: [],
    assertionTimes: [],
  };

  describe('Test Setup Performance', () => {
    it('should create test fixtures within acceptable time limits', () => {
      const iterations = 50;
      const setupTimes = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const test = ModTestFixture.forAction('intimacy', 'kiss_cheek');
        test.beforeEach();
        const endTime = performance.now();

        setupTimes.push(endTime - startTime);
      }

      const averageSetupTime =
        setupTimes.reduce((a, b) => a + b) / setupTimes.length;

      // Should be faster than 50ms on average
      expect(averageSetupTime).toBeLessThan(50);

      // No individual setup should take longer than 100ms
      expect(Math.max(...setupTimes)).toBeLessThan(100);
    });

    it('should create entities within acceptable time limits');
    it('should handle large entity sets efficiently');
  });

  describe('Test Execution Performance', () => {
    it('should execute actions within acceptable time limits');
    it('should handle multiple action executions efficiently');
    it('should scale linearly with test complexity');
  });

  describe('Assertion Performance', () => {
    it('should validate results within acceptable time limits');
    it('should handle large event sets efficiently');
    it('should maintain performance with complex assertions');
  });

  describe('Memory Usage Validation', () => {
    it('should not create memory leaks during repeated test execution');
    it('should clean up resources properly after test completion');
    it('should maintain stable memory usage across multiple tests');
  });
});
```

### Error Handling Tests

**File**: `tests/integration/mods/infrastructure/errorHandling.test.js`

**Purpose**: Validate robust error handling across all components

```javascript
import { describe, it, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('Infrastructure Error Handling', () => {
  describe('File Loading Error Handling', () => {
    it('should provide helpful errors when mod files are missing', () => {
      expect(() => {
        ModTestFixture.forAction('nonexistent', 'invalid_action');
      }).toThrow(/Could not load rule file/);
    });

    it('should handle malformed JSON files gracefully', () => {
      expect(() => {
        ModTestFixture.forAction('test', 'malformed', {
          ruleFile: '{ invalid json }',
          conditionFile: validCondition,
        });
      }).toThrow(/Invalid rule file format/);
    });

    it('should validate required file structure');
    it('should provide suggestions for common file location issues');
  });

  describe('Configuration Error Handling', () => {
    it('should validate required configuration parameters', () => {
      expect(() => {
        ModTestFixture.forAction('', 'action_id');
      }).toThrow(/Mod ID.*required/);

      expect(() => {
        ModTestFixture.forAction('mod_id', '');
      }).toThrow(/Action ID.*required/);
    });

    it('should handle invalid handler types gracefully');
    it('should validate entity configuration parameters');
    it('should provide clear messages for configuration mistakes');
  });

  describe('Runtime Error Handling', () => {
    it('should handle entity creation failures', async () => {
      const test = ModTestFixture.forAction('intimacy', 'kiss_cheek');
      test.beforeEach();

      // Try to create entity with invalid configuration
      expect(() => {
        test.createActorWithAnatomy('', ''); // Empty parameters
      }).toThrow(/Entity name.*required/);
    });

    it('should handle action execution failures gracefully', async () => {
      const test = ModTestFixture.forAction('intimacy', 'kiss_cheek');
      test.beforeEach();

      const { actor, target } = test.createCloseActors();
      test.resetWithEntities([actor, target]);

      // Try to execute action with invalid parameters
      await expect(async () => {
        await test.executeAction('', target.id); // Empty actor ID
      }).rejects.toThrow(/Actor ID.*required/);
    });

    it('should handle assertion failures with helpful messages');
    it('should maintain test environment consistency after errors');
  });

  describe('Edge Case Handling', () => {
    it('should handle empty entity arrays');
    it('should handle missing event arrays');
    it('should handle circular entity relationships');
    it('should handle extremely large data sets');
  });
});
```

### End-to-End Workflow Tests

**File**: `tests/e2e/mods/infrastructure/completeWorkflow.test.js`

**Purpose**: Validate complete testing workflows from start to finish

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('Complete Infrastructure Workflow', () => {
  describe('Standard Action Workflow', () => {
    it('should execute complete action test workflow', async () => {
      // Create test fixture
      const test = ModTestFixture.forAction('intimacy', 'kiss_cheek');
      test.beforeEach();

      // Create entities
      const { actor, target } = test.createCloseActors(['Alice', 'Bob']);
      test.resetWithEntities([actor, target]);

      // Execute action
      await test.executeAction(actor.id, target.id);

      // Validate results
      test.assertActionSuccess("Alice leans in to kiss Bob's cheek softly.");

      // Validate event sequence
      const events = test.getEvents();
      expect(events).toBeDefined();
      expect(events.length).toBeGreaterThan(0);

      // Validate entity state
      const entityManager = test.getEntityManager();
      expect(entityManager).toBeDefined();

      // Complete workflow succeeded
      expect(true).toBe(true); // Workflow completed without errors
    });

    it('should handle multi-step action sequences');
    it('should support complex entity relationships');
    it('should validate complete event workflows');
  });

  describe('Error Recovery Workflow', () => {
    it('should recover gracefully from action failures', async () => {
      const test = ModTestFixture.forAction('intimacy', 'kiss_cheek');
      test.beforeEach();

      // Create entities without closeness (should fail)
      const actor = new test.ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .build();
      const target = new test.ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room2')
        .build();
      test.resetWithEntities([actor, target]);

      // Execute action (should fail due to distance)
      await test.executeAction(actor.id, target.id);

      // Validate failure is handled correctly
      test.assertActionFailure();

      // Test environment should still be usable
      const events = test.getEvents();
      expect(events).toBeDefined();
    });

    it('should maintain test consistency after failures');
    it('should provide useful debugging information');
  });

  describe('Category-Specific Workflows', () => {
    it('should execute positioning workflows correctly', async () => {
      const test = ModTestFixture.forPositioningAction('kneel_before');
      test.beforeEach();

      const { actor, target } = test.createCloseActors();
      test.resetWithEntities([actor, target]);

      await test.executeAction(actor.id, target.id);

      test.assertActionSuccess();
      test.assertComponentAdded(actor.id, 'positioning:kneeling_before');
    });

    // Similar tests for other categories
  });
});
```

### Migration Validation Tests

**File**: `tests/e2e/mods/infrastructure/migrationValidation.test.js`

**Purpose**: Validate that new infrastructure produces identical results to existing tests

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { createRuleTestEnvironment } from '../../../common/engine/systemLogicTestEnv.js';

// Import existing test files for comparison
import kissCheekRule from '../../../data/mods/intimacy/rules/kissRule.rule.json';
import eventIsActionKissCheek from '../../../data/mods/intimacy/conditions/eventIsActionKissCheek.condition.json';

describe('Migration Validation', () => {
  describe('Behavior Compatibility', () => {
    it('should produce identical results to existing manual test', async () => {
      // Create old-style test environment manually
      const oldStyleTest = createOldStyleTest();

      // Create new infrastructure test
      const newTest = ModTestFixture.forAction('intimacy', 'kiss_cheek', {
        ruleFile: kissCheekRule,
        conditionFile: eventIsActionKissCheek,
      });
      newTest.beforeEach();

      // Execute same test scenario with both approaches
      const oldResult = await executeOldStyleTest(oldStyleTest);
      const newResult = await executeNewStyleTest(newTest);

      // Compare results
      expect(normalizeEvents(newResult.events)).toEqual(
        normalizeEvents(oldResult.events)
      );
      expect(newResult.entities).toEqual(oldResult.entities);
    });

    it('should handle all existing test patterns correctly');
    it('should maintain event ordering and timing');
    it('should preserve entity state management');
  });

  describe('Performance Comparison', () => {
    it('should perform comparably to existing manual tests', async () => {
      const iterations = 10;

      // Measure old approach
      const oldTimes = await measureOldStylePerformance(iterations);

      // Measure new approach
      const newTimes = await measureNewStylePerformance(iterations);

      const oldAverage = oldTimes.reduce((a, b) => a + b) / oldTimes.length;
      const newAverage = newTimes.reduce((a, b) => a + b) / newTimes.length;

      // New approach should be no more than 20% slower
      expect(newAverage).toBeLessThan(oldAverage * 1.2);
    });
  });

  describe('Edge Case Compatibility', () => {
    it('should handle edge cases identically to existing tests');
    it('should maintain error handling behavior');
    it('should preserve validation logic');
  });
});

// Helper functions for comparison testing
function createOldStyleTest() {
  // Recreate old manual test setup
}

async function executeOldStyleTest(testEnv) {
  // Execute test using old manual patterns
}

async function executeNewStyleTest(test) {
  // Execute test using new infrastructure
}

function normalizeEvents(events) {
  // Normalize events for comparison (remove timestamps, etc.)
}
```

## Implementation Steps

### Step 1: Create Unit Test Suite

1. Create comprehensive unit tests for each infrastructure component
2. Ensure 100% coverage for all public methods and interfaces
3. Test edge cases and error conditions thoroughly
4. Validate parameter validation and error messages

### Step 2: Implement Integration Tests

1. Create component integration tests for all infrastructure interactions
2. Test real mod file integration with samples from each category
3. Validate error handling across component boundaries
4. Test configuration propagation and customization

### Step 3: Add Performance Validation

1. Create performance benchmarks for all major operations
2. Set acceptable performance thresholds based on existing test performance
3. Add memory usage monitoring and leak detection
4. Test scalability with large numbers of tests and entities

### Step 4: Implement End-to-End Testing

1. Create complete workflow tests that exercise entire infrastructure
2. Add migration validation tests that compare old vs new behavior
3. Test complex scenarios with multiple components and interactions
4. Validate error recovery and test environment consistency

### Step 5: Create Diagnostic and Debugging Tools

1. Add diagnostic utilities for troubleshooting infrastructure issues
2. Create test helpers for common testing scenarios
3. Add performance monitoring and reporting tools
4. Create documentation with troubleshooting guides

## Validation & Testing

### Test Coverage Requirements

- **Unit Tests**: 100% line coverage for all infrastructure components
- **Integration Tests**: All component interactions tested
- **Performance Tests**: All major operations benchmarked
- **Error Handling**: All error scenarios tested with meaningful messages
- **Real-World Tests**: Integration with actual mod files from all categories

### Success Criteria

**Functional Validation**:

- [ ] All infrastructure components work together without conflicts
- [ ] Real mod files execute correctly with new infrastructure
- [ ] All mod categories supported with appropriate customization
- [ ] Error handling provides actionable diagnostic information
- [ ] Performance is within acceptable thresholds (no more than 20% slower)

**Quality Validation**:

- [ ] Test coverage exceeds 95% for all infrastructure code
- [ ] Integration tests demonstrate real-world compatibility
- [ ] Performance tests validate scalability requirements
- [ ] Error tests confirm robust failure handling
- [ ] Documentation provides clear troubleshooting guidance

### Acceptance Criteria

**Migration Readiness**:

- [ ] Infrastructure produces identical behavior to existing manual tests
- [ ] All 48 existing test patterns can be reproduced with new infrastructure
- [ ] Performance is acceptable for large test suites
- [ ] Error handling is robust enough for production use
- [ ] Documentation supports developer onboarding

**Production Quality**:

- [ ] Zero critical bugs in infrastructure components
- [ ] Comprehensive test coverage with no gaps
- [ ] Performance meets or exceeds existing test performance
- [ ] Error messages provide clear guidance for resolution
- [ ] Infrastructure is ready for community use

## Success Metrics

### Infrastructure Reliability

- **Target**: Zero critical infrastructure bugs
- **Measurement**: Bug reports and test failure analysis
- **Success**: Infrastructure passes all validation tests consistently

### Performance Validation

- **Target**: No more than 20% performance degradation
- **Measurement**: Benchmark comparison with existing manual tests
- **Success**: All operations within acceptable performance thresholds

### Developer Confidence

- **Target**: High developer confidence in infrastructure reliability
- **Measurement**: Developer feedback and infrastructure adoption rate
- **Success**: Developers prefer new infrastructure over manual test creation

### Migration Readiness

- **Target**: Infrastructure ready for large-scale migration
- **Measurement**: Successful reproduction of all existing test behaviors
- **Success**: All 48 test files can be migrated without behavior changes

## Integration Points

### Pre-Migration Validation

- **MODTESTREF-001-005**: Validates integration of all previous infrastructure work
- Must confirm all components work together before migration begins

### Migration Support

- **MODTESTREF-007**: Provides confidence and validation tools for migration process
- Infrastructure testing results inform migration strategy and risk assessment

### Future Foundation

- **Community Mods**: Infrastructure testing ensures platform ready for community use
- **Automated Testing**: Foundation for future automated test generation and validation

## Next Steps

Upon completion, this testing infrastructure will:

1. **Validate Migration Readiness**: Confirm infrastructure is ready for MODTESTREF-007
2. **Provide Debugging Tools**: Support migration process with diagnostic utilities
3. **Establish Quality Standards**: Set benchmarks for future infrastructure development
4. **Enable Community Confidence**: Demonstrate infrastructure reliability for community use

This comprehensive testing effort will provide the confidence needed to proceed with migrating 48 existing test files and establish the foundation for scaling to thousands of mod tests as the project grows.
