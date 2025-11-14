# ENTLIFWOR-004: Remove Event Deep Cloning Overhead

**Priority**: MEDIUM
**Estimated Impact**: 8-12% performance improvement (0.5-0.8 seconds saved)
**Estimated Effort**: 30 minutes
**Risk Level**: Very Low
**Depends On**: ENTLIFWOR-002 (recommended, but not required)

## Problem Statement

The latest `EntityWorkflowTestBed` implementation already defaults to shallow cloning when event monitoring is enabled, and entity/component lifecycle events now push raw references for read-only assertions. However, the helper still exposes a `deepClonePayloads` option that reintroduces `JSON.parse(JSON.stringify())` cloning whenever a test enables it (either intentionally or by accident). Because that branch still exists in production code, the workflow continues to assume deep cloning always happens—an outdated assumption that no longer matches reality.

**Current Code** (`tests/e2e/entities/common/entityWorkflowTestBed.js:42-116, 268-317`):
```javascript
// Constructor defaults
this.eventMonitoringOptions = {
  monitorAll: options.monitorAll ?? false,
  specificEvents: options.specificEvents ?? [],
  deepClonePayloads: options.deepClonePayloads ?? false, // opt-in
  enablePerformanceTracking: options.enablePerformanceTracking ?? true,
  monitorComponentEvents: options.monitorComponentEvents ?? false,
};

// setupEventMonitoring()
const { monitorAll, specificEvents, deepClonePayloads } = this.eventMonitoringOptions;
const clonePayload = (payload) => {
  if (!payload) return null;
  if (!deepClonePayloads) {
    return { ...payload }; // shallow clone (default)
  }
  try {
    return JSON.parse(JSON.stringify(payload)); // only if deepClonePayloads=true
  } catch (error) {
    this.logger?.warn('Failed to deep clone event payload:', error);
    return { ...payload };
  }
};

if (monitorAll) {
  this.eventBus.subscribe('*', (event) => {
    this.events.push({
      timestamp: Date.now(),
      type: event.type,
      payload: clonePayload(event.payload),
    });
  });
}
```

**Impact**: Deep cloning is now opt-in rather than automatic, but it is still easy to flip on accidentally. When enabled, every monitored event (≈100 per test) still pays the same synchronous JSON-clone penalty, erasing 0.5-0.8 seconds of gains.

## Why Deep Cloning Was Used

Deep cloning was likely added to:
1. **Prevent mutation**: Ensure test doesn't accidentally modify event data
2. **Isolation**: Isolate test data from production code
3. **Snapshot safety**: Create independent copies for assertions

## Why It's Not Needed

1. **Read-only usage**: Tests only read event data, never modify it
2. **Test isolation**: Tests don't share state between each other
3. **Event immutability**: Event payloads are effectively immutable after dispatch
4. **Existing defaults already use shallow cloning**: Leaving the deep-clone branch around only invites regressions

## Solution

Remove the deep-clone branch entirely so general event monitoring always uses shallow clones, document the read-only expectations in the API, and verify that no tests rely on mutating event payloads. This ensures the workflow description matches current production behavior and prevents the performance regression from being reintroduced accidentally.

### Strategy

1. **Always shallow clone** monitored events (general event stream)
2. **Continue passing references** for entity/component lifecycle events (already isolated)
3. **Document read-only expectations** so tests never mutate returned objects

## Implementation Steps

### Step 1: Simplify Event Monitoring and Remove the Deep Clone Branch

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js`

Action items:
1. Remove the `deepClonePayloads` option from `eventMonitoringOptions`.
2. Delete the `JSON.parse(JSON.stringify(payload))` branch inside `clonePayload()` and always return a shallow clone (`payload ? { ...payload } : null`).
3. Keep entity/component lifecycle subscriptions untouched (they already push references and are read-only).

This aligns the workflow description with the actual implementation and prevents the expensive code path from being re-enabled.

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

### Step 3: Verify Tests Don't Enable Deep Cloning or Modify Event Data

**Files**: Review `tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js` and any helpers that instantiate the test bed.

Audit all tests to ensure they:
- Never pass `deepClonePayloads: true` (after Step 1, that option should not exist)
- Only read event data, never modify it

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

### Step 4: Provide Guidance for Rare Mutation Needs

If a test truly needs to mutate event data, instruct engineers to create local copies at the test site (e.g., `const mutable = JSON.parse(JSON.stringify(event.payload));`) instead of reintroducing cloning hooks back into the test bed. Document this guidance in the workflow notes or test comments rather than adding new helper APIs that could be misused globally.

## Validation Criteria

### Performance Requirements

- [ ] Event processing overhead reduced by 80%+ when compared to enabling deepClonePayloads
- [ ] Test suite runs 0.5-0.8 seconds faster (relative to deep clone enabled runs)
- [ ] No increase in memory usage

### Functional Requirements

- [ ] All 12 tests pass without modification
- [ ] Event assertions work correctly
- [ ] No test flakiness introduced
- [ ] `getEventsByType()` returns correct events

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

Expected results (when comparing a branch that forces deep cloning to the simplified implementation):
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

- Current event monitoring implementation: `tests/e2e/entities/common/entityWorkflowTestBed.js`
- Related ticket: ENTLIFWOR-002 (lazy event monitoring)
- JavaScript performance: [Shallow vs Deep Clone](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax)
