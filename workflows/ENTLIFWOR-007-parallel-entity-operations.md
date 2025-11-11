# ENTLIFWOR-007: Parallelize Independent Entity Operations

**Priority**: LOW
**Estimated Impact**: 2-4% performance improvement (0.1-0.3 seconds saved)
**Estimated Effort**: 30 minutes
**Risk Level**: Low
**Depends On**: None

## Problem Statement

Several tests in the EntityLifecycleWorkflow suite perform entity operations (creation, removal) sequentially using for-loops, even when these operations are independent and could safely run in parallel.

**Current Pattern** (`EntityLifecycleWorkflow.e2e.test.js:264-280`):
```javascript
// Create multiple entities sequentially
for (const entityId of entityIds) {
  await testBed.createTestEntity(definitionId, {
    instanceId: entityId,
  });
}

// Remove multiple entities sequentially
for (const entityId of entityIds) {
  const result = await testBed.removeTestEntity(entityId);
  expect(result).toBe(true);
}
```

**Impact**: Sequential operations waste time waiting for each to complete before starting the next:
- 3 sequential creations @ 40ms each = 120ms (could be 40ms parallel)
- 3 sequential removals @ 30ms each = 90ms (could be 30ms parallel)
- Savings: ~140ms per affected test

**Affected Tests**:
1. "should handle multiple entity removals in sequence" (lines 253-291)
2. Test cleanup operations in `beforeEach` (various)

## Solution

Use `Promise.all()` to parallelize independent operations while maintaining safety for dependent operations.

### Strategy

1. **Identify safe parallelization**: Operations with no interdependencies
2. **Preserve ordering**: Keep sequential for operations that depend on previous results
3. **Error handling**: Use `Promise.allSettled()` for cleanup operations
4. **Test safety**: Ensure no race conditions introduced

## Implementation Steps

### Step 1: Update "Multiple Removals" Test

**File**: `tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js:253-291`

Replace sequential removals with parallel:

```javascript
it('should handle multiple entity removals in sequence', async () => {
  // Arrange - Create multiple entities (can parallelize)
  const definitionId = 'test:batch_removal_entity';
  const entityIds = [
    'batch_removal_001',
    'batch_removal_002',
    'batch_removal_003',
  ];

  await testBed.ensureEntityDefinitionExists(definitionId);

  // Create entities in parallel (independent operations)
  await Promise.all(
    entityIds.map(entityId =>
      testBed.createTestEntity(definitionId, { instanceId: entityId })
    )
  );

  // Verify all entities exist (can parallelize verification)
  const verifications = await Promise.all(
    entityIds.map(entityId =>
      testBed.entityManager.getEntityInstance(entityId)
    )
  );

  verifications.forEach((entity, index) => {
    expect(entity).toBeDefined();
    expect(entity.id).toBe(entityIds[index]);
  });

  // Act - Remove all entities in parallel (independent operations)
  const results = await Promise.all(
    entityIds.map(entityId => testBed.removeTestEntity(entityId))
  );

  // Assert all removals succeeded
  results.forEach((result) => {
    expect(result).toBe(true);
  });

  // Verify all entities are removed (can parallelize)
  const postRemovalChecks = await Promise.all(
    entityIds.map(async (entityId) => {
      const entity = await testBed.entityManager.getEntityInstance(entityId);
      return { entityId, entity };
    })
  );

  postRemovalChecks.forEach(({ entityId, entity }) => {
    expect(entity).toBeUndefined();
    testBed.assertEntityRemoved(entityId);
  });

  // Validate repository consistency
  await testBed.assertRepositoryConsistency();
});
```

### Step 2: Update beforeEach Cleanup

**File**: `tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js`

If cleanup operations are present in `beforeEach`, parallelize them:

```javascript
beforeEach(async () => {
  // Lightweight state cleanup between tests
  testBed.clearTransientState();

  // Clean up any entities that might have been created
  // Use Promise.allSettled to handle errors gracefully
  const entityIds = testBed.entityManager.getEntityIds();

  if (entityIds.length > 0) {
    const cleanupResults = await Promise.allSettled(
      entityIds.map(entityId =>
        testBed.removeTestEntity(entityId, { expectSuccess: false })
      )
    );

    // Log any cleanup failures (shouldn't happen but good for debugging)
    cleanupResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(
          `Failed to cleanup entity ${entityIds[index]}:`,
          result.reason?.message
        );
      }
    });
  }
});
```

### Step 3: Add Helper Method for Batch Operations

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js`

Add a convenience method for parallel entity operations:

```javascript
/**
 * Create multiple test entities in parallel.
 * Use this when entities are independent and can be created concurrently.
 *
 * @param {string} definitionId - Entity definition ID
 * @param {Array<string>} instanceIds - Array of instance IDs to create
 * @param {object} [options] - Creation options
 * @returns {Promise<Array<object>>} Created entities
 */
async createTestEntitiesParallel(definitionId, instanceIds, options = {}) {
  assertNonBlankString(definitionId, 'definitionId');
  assertPresent(instanceIds, 'instanceIds must be provided');

  if (!Array.isArray(instanceIds)) {
    throw new Error('instanceIds must be an array');
  }

  this.logger?.debug(
    `Creating ${instanceIds.length} entities in parallel (definition: ${definitionId})`
  );

  const startTime = performance.now();

  try {
    const entities = await Promise.all(
      instanceIds.map(instanceId =>
        this.createTestEntity(definitionId, {
          ...options,
          instanceId,
        })
      )
    );

    const endTime = performance.now();
    this.recordPerformanceMetric(
      'parallel_entity_creation',
      endTime - startTime
    );

    this.logger?.debug(
      `Created ${entities.length} entities in parallel in ${(endTime - startTime).toFixed(2)}ms`
    );

    return entities;
  } catch (error) {
    const endTime = performance.now();
    this.recordPerformanceMetric(
      'parallel_entity_creation_failed',
      endTime - startTime
    );
    throw error;
  }
}

/**
 * Remove multiple test entities in parallel.
 * Use this when entities are independent and can be removed concurrently.
 *
 * @param {Array<string>} entityIds - Entity IDs to remove
 * @param {object} [options] - Removal options
 * @param {boolean} [options.expectSuccess=true] - Whether removals should succeed
 * @param {boolean} [options.useAllSettled=false] - Use allSettled for error tolerance
 * @returns {Promise<Array<boolean>|Array<object>>} Removal results
 */
async removeTestEntitiesParallel(entityIds, options = {}) {
  assertPresent(entityIds, 'entityIds must be provided');

  if (!Array.isArray(entityIds)) {
    throw new Error('entityIds must be an array');
  }

  const { expectSuccess = true, useAllSettled = false } = options;

  this.logger?.debug(`Removing ${entityIds.length} entities in parallel`);

  const startTime = performance.now();

  try {
    // Use allSettled for error-tolerant cleanup, or Promise.all for strict validation
    const removalPromises = entityIds.map(entityId =>
      this.removeTestEntity(entityId, { expectSuccess })
    );

    const results = useAllSettled
      ? await Promise.allSettled(removalPromises)
      : await Promise.all(removalPromises);

    const endTime = performance.now();
    this.recordPerformanceMetric(
      'parallel_entity_removal',
      endTime - startTime
    );

    this.logger?.debug(
      `Removed ${entityIds.length} entities in parallel in ${(endTime - startTime).toFixed(2)}ms`
    );

    return results;
  } catch (error) {
    const endTime = performance.now();
    this.recordPerformanceMetric(
      'parallel_entity_removal_failed',
      endTime - startTime
    );
    throw error;
  }
}
```

### Step 4: Update Affected Tests to Use Helpers

**File**: `tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js`

Simplify tests using the new helpers:

```javascript
it('should handle multiple entity removals in sequence', async () => {
  // Arrange
  const definitionId = 'test:batch_removal_entity';
  const entityIds = [
    'batch_removal_001',
    'batch_removal_002',
    'batch_removal_003',
  ];

  await testBed.ensureEntityDefinitionExists(definitionId);

  // Create entities in parallel
  const entities = await testBed.createTestEntitiesParallel(
    definitionId,
    entityIds
  );

  // Verify all entities exist
  expect(entities).toHaveLength(entityIds.length);
  entities.forEach((entity, index) => {
    expect(entity).toBeDefined();
    expect(entity.id).toBe(entityIds[index]);
  });

  // Act - Remove all entities in parallel
  const results = await testBed.removeTestEntitiesParallel(entityIds);

  // Assert all removals succeeded
  expect(results).toHaveLength(entityIds.length);
  results.forEach((result) => {
    expect(result).toBe(true);
  });

  // Verify all entities are removed
  for (const entityId of entityIds) {
    const entity = await testBed.entityManager.getEntityInstance(entityId);
    expect(entity).toBeUndefined();
    testBed.assertEntityRemoved(entityId);
  }

  // Validate repository consistency
  await testBed.assertRepositoryConsistency();
});
```

### Step 5: Document Parallelization Guidelines

**File**: Add JSDoc to helper methods

```javascript
/**
 * PARALLELIZATION GUIDELINES
 *
 * When to parallelize:
 * - Creating multiple independent entities
 * - Removing multiple independent entities
 * - Verifying multiple entity states
 * - Cleanup operations (use allSettled for error tolerance)
 *
 * When NOT to parallelize:
 * - Operations with dependencies (e.g., create parent, then children)
 * - Operations that share state (e.g., modifying same entity)
 * - Operations requiring specific ordering
 * - Operations that depend on previous results
 *
 * Example - Safe to parallelize:
 *   await Promise.all([
 *     createEntity('entity1'),
 *     createEntity('entity2'),
 *     createEntity('entity3'),
 *   ]);
 *
 * Example - NOT safe to parallelize:
 *   const parent = await createEntity('parent');
 *   const child = await createEntity('child', { parentId: parent.id });
 */
```

## Validation Criteria

### Performance Requirements

- [ ] Parallel operations complete faster than sequential
- [ ] Test suite runs 0.1-0.3 seconds faster overall
- [ ] No increase in resource usage (memory, CPU)

### Functional Requirements

- [ ] All 12 tests pass with parallelization
- [ ] No race conditions introduced
- [ ] No flaky tests
- [ ] Proper error handling maintained

### Code Quality Requirements

- [ ] Clear documentation on when to parallelize
- [ ] Consistent error handling
- [ ] No breaking changes to test API
- [ ] Follows project coding standards

## Testing Instructions

1. **Run full test suite** with parallelization:
   ```bash
   NODE_ENV=test npx jest tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js --no-coverage
   ```

2. **Run affected test specifically**:
   ```bash
   NODE_ENV=test npx jest tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js -t "should handle multiple entity removals"
   ```

3. **Test for race conditions** (run 10 times):
   ```bash
   for i in {1..10}; do
     echo "Run $i"
     NODE_ENV=test npx jest tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js --no-coverage --silent
   done
   ```

4. **Verify performance improvement** (add logging):
   ```javascript
   const startTime = performance.now();
   await testBed.createTestEntitiesParallel(definitionId, entityIds);
   const endTime = performance.now();
   console.log(`Parallel creation: ${(endTime - startTime).toFixed(2)}ms`);
   ```

## Performance Measurement

Expected results for 3 entity operations:

**Sequential** (current):
- Create 3: 40ms + 40ms + 40ms = 120ms
- Remove 3: 30ms + 30ms + 30ms = 90ms
- Total: 210ms

**Parallel** (optimized):
- Create 3: max(40ms, 40ms, 40ms) = 40ms (70% faster)
- Remove 3: max(30ms, 30ms, 30ms) = 30ms (70% faster)
- Total: 70ms (67% faster)

Overall impact: ~140ms saved per affected test

## Rollback Plan

If issues arise:
1. Revert to sequential operations
2. Keep helper methods (useful for future)
3. Investigate specific race conditions
4. Add delays or synchronization if needed

## Success Metrics

- **Performance**: 0.1-0.3 seconds faster test execution
- **Parallelization**: 2-3 tests using parallel operations
- **Quality**: 100% test pass rate, no flakiness

## Dependencies

None. Can be implemented independently.

## Follow-up Work

- Apply parallelization to other test suites
- Document parallelization patterns in testing guide
- Consider transaction-based testing for more complex scenarios
- Add parallel execution metrics to test reports

## References

- Affected test: `tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js:253-291`
- Promise.all: [MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all)
- Promise.allSettled: [MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)
- Related: Concurrent operation patterns in production code
