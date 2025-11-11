# ENTLIFWOR-005: Implement Entity Definition Caching

**Priority**: MEDIUM
**Estimated Impact**: 5-8% performance improvement (0.3-0.5 seconds saved)
**Estimated Effort**: 1 hour
**Risk Level**: Low
**Depends On**: ENTLIFWOR-001 (required for shared test fixture pattern)

## Problem Statement

The EntityWorkflowTestBed creates entity definitions on-demand using `ensureEntityDefinitionExists()`. When using the shared test fixture pattern (ENTLIFWOR-001), the test bed is reused across all tests, but entity definitions are still checked and potentially recreated for each test.

**Current Pattern** (`entityWorkflowTestBed.js:491-518`):
```javascript
async ensureEntityDefinitionExists(definitionId, customDefinition = null) {
  // Check if definition already exists
  try {
    const existingDef = this.registry.get('entityDefinitions', definitionId);
    if (existingDef) {
      return; // Early return if exists
    }
  } catch (error) {
    // Definition doesn't exist, we'll create it
  }

  // Create a basic entity definition
  const definition = customDefinition
    ? createEntityDefinition(customDefinition.id, customDefinition.components)
    : createEntityDefinition(definitionId, { /* ... */ });

  this.registry.store('entityDefinitions', definitionId, definition);
}
```

**Problems**:
1. Registry lookup on every call (even when cached)
2. Try-catch overhead for flow control
3. No class-level cache for frequently-used definitions
4. Multiple tests use the same definitions repeatedly

**Impact**: 20+ definition checks per test × 12 tests = ~300-500ms overhead

## Solution

Implement class-level caching for entity definitions to eliminate redundant registry lookups and creation operations.

### Strategy

1. **Class-level cache**: Static Map shared across all instances
2. **Fast path**: Check cache before registry
3. **Automatic invalidation**: Clear cache on cleanup (optional)
4. **Test isolation**: Ensure cache doesn't break test isolation

## Implementation Steps

### Step 1: Add Static Definition Cache

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js`

Add a static cache at the class level:

```javascript
export class EntityWorkflowTestBed extends BaseTestBed {
  /**
   * Static cache for entity definitions shared across test instances.
   * This cache is preserved across tests when using the shared fixture pattern.
   *
   * @type {Map<string, object>}
   * @private
   * @static
   */
  static #definitionCache = new Map();

  /**
   * Flag to enable/disable definition caching.
   * Useful for debugging test isolation issues.
   *
   * @type {boolean}
   * @static
   */
  static enableDefinitionCache = true;

  constructor(options = {}) {
    super();

    // Event monitoring configuration
    this.eventMonitoringOptions = {
      monitorAll: options.monitorAll ?? false,
      specificEvents: options.specificEvents ?? [],
      deepClonePayloads: options.deepClonePayloads ?? false,
      enablePerformanceTracking: options.enablePerformanceTracking ?? true,
    };

    // ... rest of constructor
  }

  // ... rest of class
}
```

### Step 2: Refactor ensureEntityDefinitionExists with Caching

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js:491-518`

Update the method to use the cache:

```javascript
/**
 * Ensure an entity definition exists in the registry.
 * Uses class-level caching for improved performance.
 *
 * @param {string} definitionId - Entity definition ID
 * @param {object} [customDefinition] - Custom definition data
 * @returns {Promise<void>}
 */
async ensureEntityDefinitionExists(definitionId, customDefinition = null) {
  assertNonBlankString(definitionId, 'definitionId');

  // Fast path: Check class-level cache first
  if (EntityWorkflowTestBed.enableDefinitionCache &&
      EntityWorkflowTestBed.#definitionCache.has(definitionId)) {
    // Definition is cached - verify it's also in registry
    // (in case registry was cleared but cache wasn't)
    try {
      const registryDef = this.registry.get('entityDefinitions', definitionId);
      if (registryDef) {
        return; // Cache hit AND registry has it - fast return
      }
    } catch (error) {
      // Registry doesn't have it - restore from cache
      const cachedDef = EntityWorkflowTestBed.#definitionCache.get(definitionId);
      this.registry.store('entityDefinitions', definitionId, cachedDef);
      this.logger?.debug(`Restored entity definition from cache: ${definitionId}`);
      return;
    }
  }

  // Slow path: Check registry (not in cache)
  try {
    const existingDef = this.registry.get('entityDefinitions', definitionId);
    if (existingDef) {
      // Found in registry but not cache - update cache
      if (EntityWorkflowTestBed.enableDefinitionCache) {
        EntityWorkflowTestBed.#definitionCache.set(definitionId, existingDef);
      }
      return;
    }
  } catch (error) {
    // Definition doesn't exist - will create below
  }

  // Create new definition
  const definition = customDefinition
    ? createEntityDefinition(customDefinition.id, customDefinition.components)
    : createEntityDefinition(definitionId, {
        'core:name': {
          text: `Test Entity ${definitionId}`,
        },
        'core:description': {
          text: `Test entity created for ${definitionId}`,
        },
      });

  // Store in registry
  this.registry.store('entityDefinitions', definitionId, definition);

  // Store in cache
  if (EntityWorkflowTestBed.enableDefinitionCache) {
    EntityWorkflowTestBed.#definitionCache.set(definitionId, definition);
  }

  this.logger?.debug(`Created and cached entity definition: ${definitionId}`);
}
```

### Step 3: Add Cache Management Methods

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js`

Add utility methods for cache management:

```javascript
/**
 * Clear the definition cache.
 * Useful for debugging or resetting state between test suites.
 *
 * @static
 */
static clearDefinitionCache() {
  EntityWorkflowTestBed.#definitionCache.clear();
  // Note: Console logger since this is a static method
  console.debug('EntityWorkflowTestBed: Definition cache cleared');
}

/**
 * Get cache statistics for monitoring and debugging.
 *
 * @returns {object} Cache statistics
 * @static
 */
static getDefinitionCacheStats() {
  return {
    size: EntityWorkflowTestBed.#definitionCache.size,
    enabled: EntityWorkflowTestBed.enableDefinitionCache,
    keys: Array.from(EntityWorkflowTestBed.#definitionCache.keys()),
  };
}

/**
 * Pre-warm the definition cache with commonly used definitions.
 * Call this in beforeAll() to frontload definition creation.
 *
 * @param {string[]} definitionIds - Definition IDs to pre-create
 * @returns {Promise<void>}
 */
async prewarmDefinitionCache(definitionIds) {
  this.logger?.debug(`Prewarming definition cache with ${definitionIds.length} definitions`);

  const startTime = performance.now();

  for (const definitionId of definitionIds) {
    await this.ensureEntityDefinitionExists(definitionId);
  }

  const endTime = performance.now();
  this.logger?.debug(`Definition cache prewarmed in ${(endTime - startTime).toFixed(2)}ms`);
}
```

### Step 4: Update clearTransientState (Don't Clear Cache)

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js`

Ensure `clearTransientState()` does NOT clear the definition cache:

```javascript
/**
 * Clear transient state between tests without destroying the container.
 * This enables test isolation while reusing the expensive initialization.
 *
 * NOTE: Definition cache is NOT cleared - it's shared across tests.
 *
 * @returns {void}
 */
clearTransientState() {
  // Clear event tracking
  this.clearRecordedData();

  // Clear entity tracking
  this.createdEntities.clear();
  this.removedEntities.clear();

  // Clear performance metrics
  this.performanceMetrics.clear();

  // DO NOT clear definition cache - it's shared and improves performance
  // To clear cache manually: EntityWorkflowTestBed.clearDefinitionCache()

  this.logger?.debug('EntityWorkflowTestBed transient state cleared');
}
```

### Step 5: Update cleanup to Optionally Clear Cache

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js`

Add option to clear cache on full cleanup:

```javascript
/**
 * Clean up resources after tests.
 *
 * @param {object} [options] - Cleanup options
 * @param {boolean} [options.clearDefinitionCache=false] - Whether to clear static cache
 * @returns {Promise<void>}
 */
async cleanup(options = {}) {
  const { clearDefinitionCache = false } = options;

  // Unsubscribe from all event subscriptions
  for (const subscription of this.eventSubscriptions) {
    if (typeof subscription === 'function') {
      subscription();
    }
  }
  this.eventSubscriptions = [];

  // Clean up any remaining test entities
  for (const entityId of this.createdEntities) {
    if (!this.removedEntities.has(entityId)) {
      try {
        await this.removeTestEntity(entityId, { expectSuccess: false });
      } catch (error) {
        this.logger?.warn(
          `Failed to cleanup test entity ${entityId}: ${error.message}`
        );
      }
    }
  }

  // Clear tracking sets
  this.createdEntities.clear();
  this.removedEntities.clear();

  // Clear recorded data
  this.clearRecordedData();

  // Optionally clear definition cache
  if (clearDefinitionCache) {
    EntityWorkflowTestBed.clearDefinitionCache();
  }

  if (this.logger && typeof this.logger.debug === 'function') {
    this.logger.debug('EntityWorkflowTestBed cleanup completed');
  }

  await super.cleanup();
}
```

### Step 6: Optional - Prewarm Cache in Test Suite

**File**: `tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js`

Optionally prewarm cache with commonly used definitions:

```javascript
describe('Entity Lifecycle E2E Workflow', () => {
  let testBed;

  beforeAll(async () => {
    testBed = new EntityWorkflowTestBed();
    await testBed.initialize();

    // Optional: Prewarm cache with commonly used definitions
    await testBed.prewarmDefinitionCache([
      'test:basic_entity',
      'test:basic_validation_entity',
      'test:event_entity',
      'test:concurrent_entity_1',
      'test:concurrent_entity_2',
      'test:concurrent_entity_3',
      'test:removable_entity',
      'test:event_removal_entity',
      'test:batch_removal_entity',
      'test:consistency_entity',
      'test:concurrent_ops_entity',
      'test:integrity_entity',
      'test:lifecycle_tracking_entity',
    ]);
  });

  // ... rest of tests
});
```

## Validation Criteria

### Performance Requirements

- [ ] Entity definition creation reduced by 80%+
- [ ] Test suite runs 0.3-0.5 seconds faster
- [ ] Cache hit rate ≥ 90% for repeated definitions

### Functional Requirements

- [ ] All 12 tests pass without modification
- [ ] Entity creation works correctly
- [ ] No test isolation issues
- [ ] Cache persists across tests in shared fixture

### Code Quality Requirements

- [ ] Clear cache management API
- [ ] Debugging helpers for troubleshooting
- [ ] No breaking changes to existing tests
- [ ] Consistent with project coding standards

## Testing Instructions

1. **Run full test suite** and verify performance:
   ```bash
   NODE_ENV=test npx jest tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js --no-coverage
   ```

2. **Verify cache statistics** (add temporary logging):
   ```javascript
   afterAll(() => {
     const stats = EntityWorkflowTestBed.getDefinitionCacheStats();
     console.log('Definition cache stats:', stats);
   });
   ```

3. **Test cache isolation** by disabling cache:
   ```javascript
   beforeAll(async () => {
     EntityWorkflowTestBed.enableDefinitionCache = false; // Disable
     testBed = new EntityWorkflowTestBed();
     await testBed.initialize();
   });

   afterAll(() => {
     EntityWorkflowTestBed.enableDefinitionCache = true; // Re-enable
   });
   ```

4. **Verify no test isolation issues**:
   ```bash
   NODE_ENV=test npx jest tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js --randomize
   ```

## Performance Measurement

Add temporary logging to measure cache effectiveness:

```javascript
async ensureEntityDefinitionExists(definitionId, customDefinition = null) {
  const startTime = performance.now();
  let cacheHit = false;

  if (EntityWorkflowTestBed.#definitionCache.has(definitionId)) {
    cacheHit = true;
  }

  // ... rest of method

  const endTime = performance.now();
  const duration = endTime - startTime;

  console.log(`Definition ${definitionId}: ${cacheHit ? 'CACHE HIT' : 'CACHE MISS'} (${duration.toFixed(2)}ms)`);
}
```

Expected results:
- **Cache hit**: ~0.5-1ms (registry lookup only)
- **Cache miss**: ~15-25ms (creation + storage)
- **Cache hit rate**: 85-95% after warmup
- **Total savings**: ~300-500ms per test suite

## Rollback Plan

If issues arise:
1. Disable caching: `EntityWorkflowTestBed.enableDefinitionCache = false`
2. Keep cache infrastructure (useful for future optimization)
3. Investigate specific test isolation issues
4. Consider per-test-suite caches instead of global

## Success Metrics

- **Performance**: 0.3-0.5 seconds faster test execution
- **Cache Efficiency**: ≥90% cache hit rate
- **Quality**: 100% test pass rate, no test isolation issues

## Dependencies

- **Required**: ENTLIFWOR-001 (shared test fixture pattern)
  - Without shared fixture, cache provides minimal benefit

## Follow-up Work

- Apply caching pattern to other test beds
- Implement cache warming for test suites
- Document caching patterns in testing guide
- Consider LRU cache with size limits for large test suites

## References

- Current method: `tests/e2e/entities/common/entityWorkflowTestBed.js:491-518`
- Entity definition factory: `tests/common/entities/entityFactories.js`
- Related: ENTLIFWOR-001 (shared test fixture)
