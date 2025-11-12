# ENTLIFWOR-001: Implement Shared Test Fixture Pattern

**Priority**: CRITICAL
**Estimated Impact**: 60-65% performance improvement (5-7 seconds saved)
**Estimated Effort**: 2-3 hours
**Risk Level**: Low (well-established testing pattern)

## Problem Statement

The EntityLifecycleWorkflow e2e test suite currently takes ~13 seconds to run 12 tests. The primary bottleneck is that each test recreates the entire dependency injection container, registering 40+ services, initializing schemas, and setting up the event bus from scratch.

**Current Pattern (SLOW)**:
```javascript
beforeEach(async () => {
  testBed = new EntityWorkflowTestBed();
  await testBed.initialize(); // 700-900ms per test × 12 = 8.4-10.8 seconds
});
```

This means:
- Full DI container configuration: 12 times
- All service registrations: 12 times
- Schema validator initialization: 12 times
- Event bus setup: 12 times
- Mod system loading: 12 times

## Solution

Implement the shared test fixture pattern using `beforeAll` to create the test bed once for the entire suite, with lightweight state cleanup between individual tests.

**Target Pattern (FAST)**:
```javascript
beforeAll(async () => {
  sharedTestBed = new EntityWorkflowTestBed();
  await sharedTestBed.initialize(); // 700-900ms ONCE for entire suite
});

beforeEach(() => {
  sharedTestBed.clearRecordedData(); // ~1-2ms per test
});

afterAll(async () => {
  await sharedTestBed.cleanup();
});
```

## Implementation Steps

### Step 1: Modify EntityWorkflowTestBed for State Management

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js`

Add a method to clear transient state without destroying the container:

```javascript
/**
 * Clear transient state between tests without destroying the container.
 * This enables test isolation while reusing the expensive initialization.
 *
 * @returns {void}
 */
clearTransientState() {
  // Clear event tracking (events, entityEvents, componentEvents, performanceMetrics)
  this.clearRecordedData();

  // Clear entity tracking
  this.createdEntities.clear();
  this.removedEntities.clear();

  // DO NOT clear:
  // - this.container (expensive to rebuild)
  // - this.entityManager (expensive to rebuild)
  // - this.eventBus (expensive to rebuild)
  // - this.registry (expensive to rebuild)
  // - this.logger (expensive to rebuild)
  // - this.validator (expensive to rebuild)
  // - this.eventSubscriptions (keep these active)

  this.logger?.debug('EntityWorkflowTestBed transient state cleared');
}
```

### Step 2: Update Test Suite Structure

**File**: `tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js`

Replace the current test structure:

```javascript
describe('Entity Lifecycle E2E Workflow', () => {
  let testBed; // Changed from local to shared

  beforeAll(async () => {
    // Initialize ONCE for entire suite
    testBed = new EntityWorkflowTestBed();
    await testBed.initialize();
  });

  beforeEach(async () => {
    // Lightweight state cleanup between tests
    testBed.clearTransientState();

    // Clean up any entities that might have been created
    // (belt-and-suspenders approach for test isolation)
    const entityIds = testBed.entityManager.getEntityIds();
    for (const entityId of entityIds) {
      try {
        await testBed.removeTestEntity(entityId, { expectSuccess: false });
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  });

  afterAll(async () => {
    // Cleanup ONCE after entire suite
    if (testBed) {
      await testBed.cleanup();
    }
  });

  // All existing test cases remain unchanged
  describe('Entity Creation Workflow', () => {
    // ... tests
  });

  describe('Entity Removal Workflow', () => {
    // ... tests
  });

  describe('Repository Consistency Validation', () => {
    // ... tests
  });
});
```

### Step 3: Verify Test Isolation

After implementation, verify that tests remain properly isolated:

1. **Run tests individually** to ensure each can pass in isolation:
   ```bash
   NODE_ENV=test npx jest tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js -t "should create entity with proper definition resolution"
   ```

2. **Run tests in different orders** using `--testNamePattern`:
   ```bash
   NODE_ENV=test npx jest tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js --testNamePattern="removal.*creation"
   ```

3. **Check for state leakage** by adding temporary assertions:
   ```javascript
   beforeEach(() => {
     const entityIds = testBed.entityManager.getEntityIds();
     expect(entityIds.length).toBe(0); // Should be empty at start of each test
   });
   ```

### Step 4: Add Safety Guardrails

Add validation to ensure the shared fixture pattern is working correctly:

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js`

```javascript
/**
 * Verify that the test bed is in a clean state.
 * Useful for debugging test isolation issues.
 *
 * @throws {Error} If the test bed has unexpected state
 * @returns {void}
 */
verifyCleanState() {
  const issues = [];

  // Check for leftover entities
  const entityIds = this.entityManager.getEntityIds();
  if (entityIds.length > 0) {
    issues.push(`${entityIds.length} entities still exist: ${entityIds.join(', ')}`);
  }

  // Check for leftover event tracking
  if (this.events.length > 0) {
    issues.push(`${this.events.length} events still tracked`);
  }

  if (this.entityEvents.length > 0) {
    issues.push(`${this.entityEvents.length} entity events still tracked`);
  }

  if (this.componentEvents.length > 0) {
    issues.push(`${this.componentEvents.length} component events still tracked`);
  }

  // Check for leftover entity tracking
  if (this.createdEntities.size > 0) {
    issues.push(`${this.createdEntities.size} entities in createdEntities set`);
  }

  if (issues.length > 0) {
    throw new Error(`Test bed is not in clean state:\n  - ${issues.join('\n  - ')}`);
  }
}
```

Then call in `beforeEach` (optional, can be enabled for debugging):

```javascript
beforeEach(() => {
  testBed.clearTransientState();

  // Uncomment for debugging test isolation:
  // testBed.verifyCleanState();
});
```

## Validation Criteria

### Performance Requirements

- [ ] Test suite completes in ≤ 6 seconds (down from ~13 seconds)
- [ ] Average time per test ≤ 500ms (down from ~1080ms)
- [ ] Total initialization overhead ≤ 1 second (down from ~9 seconds)

### Functional Requirements

- [ ] All 12 tests pass without modification to test logic
- [ ] Tests can run individually and in isolation
- [ ] Tests can run in any order (Jest randomization)
- [ ] No state leakage between tests
- [ ] Repository starts empty at the beginning of each test

### Quality Requirements

- [ ] Tests maintain same assertions and coverage
- [ ] No flaky tests introduced
- [ ] Test failure messages remain clear and actionable
- [ ] Code follows existing patterns in test bed architecture

## Testing Instructions

1. **Run the full suite** and verify performance improvement:
   ```bash
   NODE_ENV=test npx jest tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js --no-coverage
   ```

2. **Run individual tests** to verify isolation:
   ```bash
   NODE_ENV=test npx jest tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js -t "should create entity with proper definition"
   NODE_ENV=test npx jest tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js -t "should remove entity and clean up"
   ```

3. **Run with seed randomization** to verify order independence:
   ```bash
   NODE_ENV=test npx jest tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js --randomize
   ```

4. **Check for memory leaks** (optional but recommended):
   ```bash
   NODE_ENV=test node --expose-gc ./node_modules/.bin/jest tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js
   ```

## Rollback Plan

If the shared fixture pattern causes issues:

1. Revert changes to `EntityLifecycleWorkflow.e2e.test.js`
2. Keep the new `clearTransientState()` method (useful for future optimization attempts)
3. Document the specific test isolation issue encountered
4. Consider alternative approaches (e.g., test suites with smaller scopes)

## Success Metrics

- **Before**: ~13 seconds for 12 tests
- **After**: ≤ 6 seconds for 12 tests
- **Improvement**: ≥50% reduction in test execution time
- **Test Quality**: 100% pass rate, no flakiness

## Dependencies

None. This ticket can be implemented independently.

## Follow-up Work

After this optimization is stable:
- Apply the same pattern to other e2e test suites
- Document the pattern in `docs/testing/e2e-optimization-patterns.md`
- Consider extracting `clearTransientState()` to a base class for reuse

## References

- Test file: `tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js`
- Test bed: `tests/e2e/entities/common/entityWorkflowTestBed.js`
- Jest documentation: [Setup and Teardown](https://jestjs.io/docs/setup-teardown)
- Related pattern: Integration test suites in `tests/integration/`
