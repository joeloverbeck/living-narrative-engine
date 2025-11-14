# ENTLIFWOR-006: Add Conditional Repository Consistency Checks

**Priority**: LOW
**Estimated Impact**: 3-5% performance improvement (0.2-0.4 seconds saved)
**Estimated Effort**: 30-45 minutes
**Risk Level**: Very Low
**Depends On**: None

## Problem Statement

The EntityWorkflowTestBed performs comprehensive repository consistency checks that iterate through all entities, validate retrievability, and check for orphaned entities. These checks are valuable for integration tests but add unnecessary overhead for simple unit-style tests.

**Current Usage** (`EntityLifecycleWorkflow.e2e.test.js`):
- Called 4 times explicitly via `assertRepositoryConsistency()`
- Each call iterates through ALL entities in the system
- Performs registry lookups, retrievals, and validation
- Takes ~50-100ms per call depending on entity count

**Impact**: 4 explicit calls + overhead = ~200-400ms

**Problems**:
1. Simple tests don't need exhaustive consistency checks
2. Checks scale linearly with entity count (O(n) complexity)
3. No way to skip checks for trivial tests
4. Always performs full validation even for single-entity tests

## Solution

Add conditional consistency checking that intelligently skips or simplifies validation based on test complexity and entity count.

### Strategy

1. **Smart defaults**: Skip for simple scenarios (≤ 3 entities)
2. **Explicit control**: Allow tests to force full validation
3. **Fast path**: Basic checks only for small test cases
4. **Backward compatible**: Default behavior can match current (opt-in optimization)

## Implementation Steps

### Step 1: Add Consistency Check Options

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js`

Update the `validateRepositoryConsistency()` method signature:

```javascript
/**
 * Validate repository consistency after entity operations.
 *
 * @param {object} [options] - Validation options
 * @param {boolean} [options.skipIfSimple=true] - Skip full validation for simple scenarios
 * @param {number} [options.simpleThreshold=3] - Entity count threshold for "simple" test
 * @param {boolean} [options.quickCheck=false] - Perform only basic validation
 * @param {boolean} [options.forceFullValidation=false] - Force full validation regardless
 * @returns {Promise<object>} Consistency validation results
 */
async validateRepositoryConsistency(options = {}) {
  const {
    skipIfSimple = true,
    simpleThreshold = 3,
    quickCheck = false,
    forceFullValidation = false,
  } = options;

  const entityIds = this.entityManager.getEntityIds();
  const entityCount = entityIds.length;

  // Initialize results
  const results = {
    isConsistent: true,
    issues: [],
    entityCount,
    validationType: 'none',
    skipped: false,
    skipReason: null,
  };

  // Early return for simple scenarios (unless forced)
  if (!forceFullValidation && skipIfSimple && entityCount <= simpleThreshold) {
    results.skipped = true;
    results.skipReason = `Entity count (${entityCount}) below threshold (${simpleThreshold})`;
    results.validationType = 'skipped';

    this.logger?.debug(
      `Repository consistency check skipped: ${results.skipReason}`
    );

    return results;
  }

  // Quick check: Just verify entity count matches expectations
  if (quickCheck && !forceFullValidation) {
    results.validationType = 'quick';

    // Basic sanity check: no negative counts, tracking sets reasonable
    if (entityCount < 0) {
      results.isConsistent = false;
      results.issues.push('Negative entity count detected');
    }

    if (this.createdEntities.size > entityCount + this.removedEntities.size) {
      results.isConsistent = false;
      results.issues.push(
        `Created entities (${this.createdEntities.size}) exceeds expected based on current count (${entityCount}) and removed (${this.removedEntities.size})`
      );
    }

    this.logger?.debug(
      `Repository quick consistency check: ${results.isConsistent ? 'PASSED' : 'FAILED'}`
    );

    return results;
  }

  // Full validation (current implementation)
  results.validationType = 'full';

  try {
    // Validate each entity can be retrieved and has consistent data
    for (const entityId of entityIds) {
      try {
        const entity = await this.entityManager.getEntityInstance(entityId);
        if (!entity) {
          results.issues.push(
            `Entity ${entityId} in ID list but not retrievable`
          );
          results.isConsistent = false;
        } else if (entity.id !== entityId) {
          results.issues.push(
            `Entity ID mismatch: expected ${entityId}, got ${entity.id}`
          );
          results.isConsistent = false;
        }
      } catch (error) {
        results.issues.push(
          `Error retrieving entity ${entityId}: ${error.message}`
        );
        results.isConsistent = false;
      }
    }

    // Check for orphaned entities in created tracking
    for (const entityId of this.createdEntities) {
      if (
        !this.removedEntities.has(entityId) &&
        !entityIds.includes(entityId)
      ) {
        results.issues.push(
          `Entity ${entityId} tracked as created but missing from repository`
        );
        results.isConsistent = false;
      }
    }

    this.logger?.debug(
      `Repository full consistency check: ${results.isConsistent ? 'PASSED' : 'FAILED'} (${results.issues.length} issues)`
    );
  } catch (error) {
    results.isConsistent = false;
    results.issues.push(
      `Repository consistency check failed: ${error.message}`
    );
  }

  return results;
}
```

### Step 2: Update assertRepositoryConsistency Wrapper

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js`

Update the assertion wrapper to pass through options:

```javascript
/**
 * Assert that repository is in a consistent state.
 *
 * @param {object} [options] - Validation options (see validateRepositoryConsistency)
 * @throws {Error} If repository is not consistent
 * @returns {Promise<void>}
 */
async assertRepositoryConsistency(options = {}) {
  const results = await this.validateRepositoryConsistency(options);

  // Skipped checks are considered passing
  if (results.skipped) {
    return;
  }

  if (!results.isConsistent) {
    throw new Error(
      `Repository consistency check failed (${results.validationType}): ${results.issues.join(', ')}`
    );
  }
}
```

### Step 3: Update Test Suite to Use Conditional Checks

**File**: `tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js`

Update tests to use smart defaults:

```javascript
describe('Repository Consistency Validation', () => {
  it('should maintain repository consistency during lifecycle operations', async () => {
    // ... test setup

    // This test creates 3 entities - use smart defaults (will skip full check)
    await testBed.assertRepositoryConsistency();

    // ... more operations

    // Final validation - force full check since this is a consistency test
    await testBed.assertRepositoryConsistency({ forceFullValidation: true });
  });

  it('should handle concurrent entity operations safely', async () => {
    // ... creates 8 entities (3 initial + 5 concurrent ops)

    // Auto-triggers full validation since entity count > 3
    await testBed.assertRepositoryConsistency();
  });

  it('should validate entity data integrity after lifecycle operations', async () => {
    // ... creates 1 entity

    // Skipped automatically (only 1 entity)
    // OR use quick check:
    await testBed.assertRepositoryConsistency({ quickCheck: true });
  });

  it('should track entity lifecycle events correctly throughout operations', async () => {
    // ... creates and removes 1 entity

    // This test is about events, not repository - skip expensive check
    await testBed.assertRepositoryConsistency({ skipIfSimple: true });
  });
});
```

### Step 4: Add Performance Tracking

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js`

Add optional performance tracking for consistency checks:

```javascript
async validateRepositoryConsistency(options = {}) {
  const startTime = performance.now();

  // ... all validation logic

  const endTime = performance.now();
  const duration = endTime - startTime;

  results.duration = duration;

  // Track performance metric
  this.recordPerformanceMetric('repository_consistency_check', duration);

  if (options.logPerformance ?? false) {
    this.logger?.info(
      `Repository consistency check (${results.validationType}): ${duration.toFixed(2)}ms - ${results.isConsistent ? 'PASS' : 'FAIL'}`
    );
  }

  return results;
}
```

### Step 5: Add Convenience Methods

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js`

Add helper methods for common patterns:

```javascript
/**
 * Perform a quick repository sanity check.
 * Useful for tests that don't need full validation.
 *
 * @returns {Promise<void>}
 */
async assertRepositorySanity() {
  await this.assertRepositoryConsistency({ quickCheck: true });
}

/**
 * Force a full repository consistency check.
 * Useful for tests that explicitly validate repository behavior.
 *
 * @returns {Promise<void>}
 */
async assertRepositoryFullyConsistent() {
  await this.assertRepositoryConsistency({ forceFullValidation: true });
}

/**
 * Skip repository consistency check (explicit no-op).
 * Useful for documenting that a test intentionally skips validation.
 *
 * @returns {Promise<void>}
 */
async skipRepositoryConsistencyCheck() {
  this.logger?.debug('Repository consistency check explicitly skipped');
}
```

## Validation Criteria

### Performance Requirements

- [ ] Simple tests (≤3 entities) skip validation automatically
- [ ] Test suite runs 0.2-0.4 seconds faster
- [ ] No performance regression for complex tests

### Functional Requirements

- [ ] All 12 tests pass with smart defaults
- [ ] Complex tests still get full validation
- [ ] Tests can force full validation when needed
- [ ] Backward compatible (can match current behavior)

### Code Quality Requirements

- [ ] Clear API for controlling validation level
- [ ] Good default behavior (secure by default)
- [ ] Helpful convenience methods
- [ ] Well-documented options

## Testing Instructions

1. **Run full test suite** with smart defaults:
   ```bash
   NODE_ENV=test npx jest tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js --no-coverage
   ```

2. **Verify skipping logic** (add temporary logging):
   ```javascript
   const results = await testBed.validateRepositoryConsistency();
   console.log('Consistency check:', results);
   ```

3. **Test force validation**:
   ```javascript
   it('should force full validation', async () => {
     await testBed.createTestEntity('test:simple', { instanceId: 'simple_001' });

     // Should perform full check despite only 1 entity
     await testBed.assertRepositoryConsistency({ forceFullValidation: true });
   });
   ```

4. **Verify backward compatibility** by setting defaults to current behavior:
   ```javascript
   await testBed.assertRepositoryConsistency({
     skipIfSimple: false, // Never skip
     forceFullValidation: true, // Always full check
   });
   ```

## Performance Measurement

Add temporary logging to measure improvement:

```javascript
it('performance test', async () => {
  const results = await testBed.validateRepositoryConsistency({
    logPerformance: true
  });

  console.log(`Validation took ${results.duration.toFixed(2)}ms (${results.validationType})`);
});
```

Expected results:
- **Skipped check**: ~0.5-1ms (threshold comparison only)
- **Quick check**: ~5-10ms (basic sanity checks)
- **Full check (3 entities)**: ~50-80ms (current behavior)
- **Full check (10+ entities)**: ~150-250ms (current behavior)

Savings per test suite:
- Simple tests skip: ~50-80ms × 8 tests = ~400-640ms saved
- Complex tests unchanged: 0ms difference

## Rollback Plan

If issues arise:
1. Set defaults to force full validation:
   ```javascript
   skipIfSimple: false,
   forceFullValidation: true,
   ```
2. Keep new options API (useful for future)
3. Investigate specific test failures
4. Document cases where full validation is required

## Success Metrics

- **Performance**: 0.2-0.4 seconds faster test execution
- **Smart Behavior**: 70%+ of checks skipped or simplified
- **Quality**: 100% test pass rate, no missed consistency issues

## Dependencies

None. Can be implemented independently.

## Follow-up Work

- Apply conditional checking to other test beds
- Document when to use each validation level
- Consider async validation for parallel test execution
- Add metrics dashboard for consistency check performance

## References

- Current method: `tests/e2e/entities/common/entityWorkflowTestBed.js:685-749`
- Test usage: `tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js:189,308,336,391`
- Related: Performance testing patterns in `tests/performance/`
