# ENTLIFWOR-004: Remove Event Deep Cloning Overhead

**Priority**: MEDIUM
**Estimated Impact**: 8-12% performance improvement (0.5-0.8 seconds saved)
**Estimated Effort**: 30 minutes
**Risk Level**: Very Low
**Depends On**: ENTLIFWOR-002 (recommended, but not required)

## Problem Statement

The EntityWorkflowTestBed performs expensive deep cloning of all event payloads using `JSON.parse(JSON.stringify())`. This operation is:
- Computationally expensive
- Synchronous (blocks execution)
- Unnecessary for read-only test assertions
- Potentially problematic (can fail on circular references, functions, symbols)

**Current Code** (`entityWorkflowTestBed.js:272`):
```javascript
const allEventsSubscription = this.eventBus.subscribe('*', (event) => {
  this.events.push({
    timestamp: Date.now(),
    type: event.type,
    payload: JSON.parse(JSON.stringify(event.payload)), // EXPENSIVE
  });
});
```

**Impact**: Deep cloning ~100+ events per test × 12 tests = ~600ms wasted

## Why Deep Cloning Was Used

Deep cloning was likely added to:
1. **Prevent mutation**: Ensure test doesn't accidentally modify event data
2. **Isolation**: Isolate test data from production code
3. **Snapshot safety**: Create independent copies for assertions

## Why It's Not Needed

1. **Read-only usage**: Tests only read event data, never modify it
2. **Test isolation**: Tests don't share state between each other
3. **Event immutability**: Event payloads are effectively immutable after dispatch
4. **Modern alternatives**: Shallow cloning is sufficient for isolation

## Solution

Replace deep cloning with shallow cloning or direct references, depending on usage patterns.

### Strategy

1. **No cloning** for entity lifecycle events (already isolated)
2. **Shallow cloning** for general events (if mutation is a concern)
3. **Deep cloning** only when explicitly requested (opt-in)

## Implementation Steps

### Step 1: Remove Deep Cloning from Event Monitoring

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js:268-274`

If ENTLIFWOR-002 has been implemented, the deep cloning logic is already in `setupEventMonitoring()`. Update it:

```javascript
setupEventMonitoring() {
  const { monitorAll, specificEvents, deepClonePayloads } = this.eventMonitoringOptions;

  // Helper to safely clone event data
  const clonePayload = (payload) => {
    if (!payload) return null;

    // Default: Shallow clone (FAST and sufficient for read-only tests)
    if (!deepClonePayloads) {
      // Shallow clone - spreads top-level properties
      // This is 10-20x faster than JSON.parse/stringify
      return { ...payload };
    }

    // Deep clone only when explicitly requested (opt-in for special cases)
    try {
      return JSON.parse(JSON.stringify(payload));
    } catch (error) {
      this.logger?.warn('Failed to deep clone event payload:', error);
      return { ...payload }; // Fallback to shallow clone
    }
  };

  // ... rest of monitoring setup
}
```

If ENTLIFWOR-002 has NOT been implemented yet, directly update the current code:

```javascript
/**
 * Set up comprehensive event monitoring for entity operations
 */
setupEventMonitoring() {
  // Monitor all events for general tracking
  const allEventsSubscription = this.eventBus.subscribe('*', (event) => {
    this.events.push({
      timestamp: Date.now(),
      type: event.type,
      // Changed: Shallow clone instead of deep clone
      // This is sufficient because tests only read event data
      payload: event.payload ? { ...event.payload } : null,
    });
  });
  this.eventSubscriptions.push(allEventsSubscription);

  // Entity lifecycle events don't need cloning at all
  // (they're already isolated and immutable)
  const entityCreatedSubscription = this.eventBus.subscribe(
    'core:entity_created',
    (event) => {
      this.entityEvents.push({
        type: 'ENTITY_CREATED',
        entityId: event.payload.entity?.id,
        definitionId: event.payload.definitionId,
        timestamp: Date.now(),
        payload: event.payload, // No cloning needed - read-only
      });

      if (event.payload.entity?.id) {
        this.createdEntities.add(event.payload.entity.id);
      }
    }
  );
  this.eventSubscriptions.push(entityCreatedSubscription);

  const entityRemovedSubscription = this.eventBus.subscribe(
    'core:entity_removed',
    (event) => {
      this.entityEvents.push({
        type: 'ENTITY_REMOVED',
        entityId: event.payload.instanceId,
        timestamp: Date.now(),
        payload: event.payload, // No cloning needed - read-only
      });

      const entityId = event.payload.instanceId;
      if (entityId) {
        this.removedEntities.add(entityId);
        this.createdEntities.delete(entityId);
      }
    }
  );
  this.eventSubscriptions.push(entityRemovedSubscription);

  // Component events also don't need deep cloning
  const componentAddedSubscription = this.eventBus.subscribe(
    'core:component_added',
    (event) => {
      this.componentEvents.push({
        type: 'COMPONENT_ADDED',
        entityId: event.payload.entity?.id,
        componentId: event.payload.componentTypeId,
        componentData: event.payload.componentData, // No cloning needed
        timestamp: Date.now(),
      });
    }
  );
  this.eventSubscriptions.push(componentAddedSubscription);

  const componentRemovedSubscription = this.eventBus.subscribe(
    'core:component_removed',
    (event) => {
      this.componentEvents.push({
        type: 'COMPONENT_REMOVED',
        entityId: event.payload.entity?.id,
        componentId: event.payload.componentTypeId,
        timestamp: Date.now(),
      });
    }
  );
  this.eventSubscriptions.push(componentRemovedSubscription);
}
```

### Step 2: Add JSDoc Warning About Mutation

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js`

Add documentation to methods that return event data:

```javascript
/**
 * Get events of a specific type.
 *
 * IMPORTANT: Returned event objects use shallow cloning for performance.
 * Do not modify the returned objects - treat them as read-only.
 *
 * @param {string} eventType - Event type to filter
 * @returns {Array<object>} Matching events (read-only)
 */
getEventsByType(eventType) {
  return this.events.filter((event) => event.type === eventType);
}

/**
 * Get entity lifecycle events for a specific entity.
 *
 * IMPORTANT: Returned event objects are references to internal state.
 * Do not modify the returned objects - treat them as read-only.
 *
 * @param {string} entityId - Entity ID to filter
 * @returns {Array<object>} Entity lifecycle events (read-only)
 */
getEntityEvents(entityId) {
  return this.entityEvents.filter((event) => event.entityId === entityId);
}

/**
 * Get component mutation events for a specific entity.
 *
 * IMPORTANT: Returned event objects are references to internal state.
 * Do not modify the returned objects - treat them as read-only.
 *
 * @param {string} entityId - Entity ID to filter
 * @returns {Array<object>} Component mutation events (read-only)
 */
getComponentEvents(entityId) {
  return this.componentEvents.filter((event) => event.entityId === entityId);
}
```

### Step 3: Verify Tests Don't Modify Event Data

**File**: Review `tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js`

Audit all tests to ensure they only read event data, never modify it:

```bash
# Search for potential mutations
grep -n "entityEvents\|componentEvents\|getEventsByType\|getEntityEvents" tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js
```

Common patterns to look for:
- `event.payload.something = value` (mutation - BAD)
- `event.something = value` (mutation - BAD)
- `const { payload } = event` (destructuring - OK)
- `expect(event.payload.something).toBe(value)` (reading - OK)

If any mutations are found, they must be refactored to use local copies:
```javascript
// BAD - modifies event
const event = testBed.getEntityEvents(entityId)[0];
event.payload.modified = true;

// GOOD - creates local copy
const event = testBed.getEntityEvents(entityId)[0];
const localPayload = { ...event.payload, modified: true };
```

### Step 4: Add Optional Deep Clone Helper

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js`

For rare cases where deep cloning is genuinely needed:

```javascript
/**
 * Deep clone an event payload for safe mutation.
 * Use this only when you need to modify event data in tests.
 *
 * @param {object} event - Event object to clone
 * @returns {object} Deep cloned event
 * @throws {Error} If cloning fails (circular references, etc.)
 */
deepCloneEvent(event) {
  try {
    return JSON.parse(JSON.stringify(event));
  } catch (error) {
    this.logger?.error('Failed to deep clone event:', error);
    throw new Error(`Cannot deep clone event: ${error.message}`);
  }
}
```

Usage in tests (if needed):
```javascript
const event = testBed.getEntityEvents(entityId)[0];
const clonedEvent = testBed.deepCloneEvent(event);
clonedEvent.payload.canModifySafely = true;
```

## Validation Criteria

### Performance Requirements

- [ ] Event processing overhead reduced by 80%+
- [ ] Test suite runs 0.5-0.8 seconds faster
- [ ] No increase in memory usage

### Functional Requirements

- [ ] All 12 tests pass without modification
- [ ] Event assertions work correctly
- [ ] No test flakiness introduced
- [ ] getEventsByType() returns correct events

### Code Quality Requirements

- [ ] Clear documentation about mutation restrictions
- [ ] JSDoc warnings on all event accessor methods
- [ ] No breaking changes to test API
- [ ] Consistent with project coding standards

## Testing Instructions

1. **Run full test suite** and verify performance:
   ```bash
   NODE_ENV=test npx jest tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js --no-coverage
   ```

2. **Verify event assertions still work**:
   - Test: "should dispatch ENTITY_CREATED events with correct payload"
   - Test: "should track entity lifecycle events correctly"

3. **Run tests multiple times** to check for flakiness:
   ```bash
   for i in {1..5}; do
     echo "Run $i"
     NODE_ENV=test npx jest tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js --no-coverage --silent
   done
   ```

4. **Memory check** (optional):
   ```bash
   NODE_ENV=test node --expose-gc ./node_modules/.bin/jest tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js
   ```

## Performance Measurement

Add temporary logging to measure improvement:

```javascript
setupEventMonitoring() {
  let cloneCount = 0;
  let totalCloneTime = 0;

  const allEventsSubscription = this.eventBus.subscribe('*', (event) => {
    const startTime = performance.now();

    this.events.push({
      timestamp: Date.now(),
      type: event.type,
      payload: event.payload ? { ...event.payload } : null,
    });

    const endTime = performance.now();
    cloneCount++;
    totalCloneTime += (endTime - startTime);
  });

  // Log at end of test
  process.on('exit', () => {
    console.log(`Cloned ${cloneCount} events in ${totalCloneTime.toFixed(2)}ms`);
  });
}
```

Expected results:
- **Before**: ~5-8ms per deep clone × 100 events = 500-800ms
- **After**: ~0.1-0.2ms per shallow clone × 100 events = 10-20ms
- **Savings**: ~480-780ms per test suite

## Rollback Plan

If issues arise:
1. Revert to deep cloning: `JSON.parse(JSON.stringify(event.payload))`
2. Investigate specific test failures
3. Identify which tests actually need deep cloning
4. Apply deep cloning selectively only where needed

## Success Metrics

- **Performance**: 0.5-0.8 seconds faster test execution
- **Memory**: Slight reduction in memory usage (fewer temporary objects)
- **Quality**: 100% test pass rate, no flakiness

## Dependencies

- **Recommended**: Implement after ENTLIFWOR-002 (lazy event monitoring)
- **Optional**: Can be implemented standalone

## Follow-up Work

- Apply shallow cloning pattern to other test beds
- Document "read-only event data" pattern in testing guide
- Consider making event objects immutable using Object.freeze()

## References

- Current deep cloning: `tests/e2e/entities/common/entityWorkflowTestBed.js:272`
- Related ticket: ENTLIFWOR-002 (lazy event monitoring)
- JavaScript performance: [Shallow vs Deep Clone](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax)
