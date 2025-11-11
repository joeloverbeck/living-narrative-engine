# ENTLIFWOR-002: Implement Lazy Event Monitoring System

**Priority**: HIGH
**Estimated Impact**: 15-20% performance improvement (1-2 seconds saved)
**Estimated Effort**: 1-2 hours
**Risk Level**: Low
**Depends On**: ENTLIFWOR-001 (for maximum benefit)

## Problem Statement

The EntityWorkflowTestBed currently subscribes to ALL events (`'*'` wildcard) and performs expensive operations on every event, even when tests only need specific events.

**Current Overhead** (per test):
```javascript
const allEventsSubscription = this.eventBus.subscribe('*', (event) => {
  this.events.push({
    timestamp: Date.now(),
    type: event.type,
    payload: JSON.parse(JSON.stringify(event.payload)), // EXPENSIVE: Deep clone
  });
});
```

**Problems**:
1. Subscribes to ALL events including irrelevant ones
2. Deep clones every payload via JSON.parse(JSON.stringify())
3. Creates 4 separate subscriptions for every test
4. Wastes ~150-250ms per test on unnecessary event processing

**Example**: A test that only verifies entity creation still captures and processes:
- System initialization events
- Schema validation events
- Registry update events
- Component mutation events
- All other system events

## Solution

Implement a lazy, opt-in event monitoring system that only captures events when explicitly requested by tests.

### Design Principles

1. **Lazy by Default**: Don't monitor events unless requested
2. **Selective Monitoring**: Only subscribe to events tests actually need
3. **Efficient Storage**: Avoid expensive operations (deep clones) unless necessary
4. **Backward Compatible**: Existing tests continue working with minimal changes

## Implementation Steps

### Step 1: Add Event Monitoring Configuration

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js`

Add configuration options to the constructor:

```javascript
constructor(options = {}) {
  super();

  // Event monitoring configuration
  this.eventMonitoringOptions = {
    monitorAll: options.monitorAll ?? false, // Default: don't monitor all events
    specificEvents: options.specificEvents ?? [], // Only monitor these event types
    deepClonePayloads: options.deepClonePayloads ?? false, // Default: shallow clone
    enablePerformanceTracking: options.enablePerformanceTracking ?? true,
  };

  // Core services
  this.container = null;
  this.entityManager = null;
  this.eventBus = null;
  this.registry = null;
  this.logger = null;
  this.validator = null;

  // Event monitoring
  this.events = [];
  this.entityEvents = [];
  this.componentEvents = [];
  this.eventSubscriptions = [];

  // Entity tracking
  this.createdEntities = new Set();
  this.removedEntities = new Set();

  // Performance tracking
  this.performanceMetrics = new Map();
}
```

### Step 2: Refactor setupEventMonitoring to be Lazy

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js`

Replace the current `setupEventMonitoring()` method:

```javascript
/**
 * Set up event monitoring based on configuration.
 * Only subscribes to events that tests actually need.
 *
 * @private
 */
setupEventMonitoring() {
  const { monitorAll, specificEvents, deepClonePayloads } = this.eventMonitoringOptions;

  // Helper to safely clone event data
  const clonePayload = (payload) => {
    if (!payload) return null;
    if (!deepClonePayloads) {
      // Shallow clone is much faster and sufficient for most tests
      return { ...payload };
    }
    // Deep clone only when explicitly requested
    try {
      return JSON.parse(JSON.stringify(payload));
    } catch (error) {
      this.logger?.warn('Failed to deep clone event payload:', error);
      return { ...payload }; // Fallback to shallow clone
    }
  };

  // Option 1: Monitor all events (only if explicitly requested)
  if (monitorAll) {
    const allEventsSubscription = this.eventBus.subscribe('*', (event) => {
      this.events.push({
        timestamp: Date.now(),
        type: event.type,
        payload: clonePayload(event.payload),
      });
    });
    this.eventSubscriptions.push(allEventsSubscription);
    this.logger?.debug('Event monitoring: ALL events (monitorAll=true)');
  }

  // Option 2: Monitor specific events only
  else if (specificEvents.length > 0) {
    specificEvents.forEach((eventType) => {
      const subscription = this.eventBus.subscribe(eventType, (event) => {
        this.events.push({
          timestamp: Date.now(),
          type: event.type,
          payload: clonePayload(event.payload),
        });
      });
      this.eventSubscriptions.push(subscription);
    });
    this.logger?.debug(`Event monitoring: Specific events [${specificEvents.join(', ')}]`);
  }

  // Option 3: No general event monitoring (fastest)
  else {
    this.logger?.debug('Event monitoring: Disabled (best performance)');
  }

  // ALWAYS monitor entity lifecycle events (these are needed for test assertions)
  this._setupEntityLifecycleMonitoring();
}

/**
 * Set up monitoring for entity lifecycle events.
 * These are always monitored because entity tests depend on them.
 *
 * @private
 */
_setupEntityLifecycleMonitoring() {
  const { deepClonePayloads } = this.eventMonitoringOptions;

  // Monitor entity created events
  const entityCreatedSubscription = this.eventBus.subscribe(
    'core:entity_created',
    (event) => {
      this.entityEvents.push({
        type: 'ENTITY_CREATED',
        entityId: event.payload.entity?.id,
        definitionId: event.payload.definitionId,
        timestamp: Date.now(),
        payload: event.payload, // Don't clone - not needed for assertions
      });

      if (event.payload.entity?.id) {
        this.createdEntities.add(event.payload.entity.id);
      }
    }
  );
  this.eventSubscriptions.push(entityCreatedSubscription);

  // Monitor entity removed events
  const entityRemovedSubscription = this.eventBus.subscribe(
    'core:entity_removed',
    (event) => {
      this.entityEvents.push({
        type: 'ENTITY_REMOVED',
        entityId: event.payload.instanceId,
        timestamp: Date.now(),
        payload: event.payload, // Don't clone - not needed for assertions
      });

      const entityId = event.payload.instanceId;
      if (entityId) {
        this.removedEntities.add(entityId);
        this.createdEntities.delete(entityId);
      }
    }
  );
  this.eventSubscriptions.push(entityRemovedSubscription);

  // Only monitor component events if explicitly requested
  if (this.eventMonitoringOptions.monitorComponentEvents ?? false) {
    this._setupComponentEventMonitoring();
  }
}

/**
 * Set up monitoring for component mutation events.
 * Only called if explicitly enabled via options.
 *
 * @private
 */
_setupComponentEventMonitoring() {
  const componentAddedSubscription = this.eventBus.subscribe(
    'core:component_added',
    (event) => {
      this.componentEvents.push({
        type: 'COMPONENT_ADDED',
        entityId: event.payload.entity?.id,
        componentId: event.payload.componentTypeId,
        componentData: event.payload.componentData,
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

### Step 3: Update clearTransientState to Clear Event Arrays

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js`

Ensure the new `clearTransientState()` method clears event arrays:

```javascript
clearTransientState() {
  // Clear event tracking (but keep subscriptions active)
  this.events = [];
  this.entityEvents = [];
  this.componentEvents = [];

  // Clear entity tracking
  this.createdEntities.clear();
  this.removedEntities.clear();

  // Clear performance metrics
  this.performanceMetrics.clear();

  this.logger?.debug('EntityWorkflowTestBed transient state cleared');
}
```

### Step 4: Update Tests to Use Lazy Monitoring (Optional)

**File**: `tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js`

Most tests don't need to change because entity lifecycle events are always monitored. However, if a test needs access to all events:

```javascript
describe('Event-Heavy Test Suite', () => {
  let testBed;

  beforeAll(async () => {
    // Enable specific event monitoring for this suite
    testBed = new EntityWorkflowTestBed({
      monitorAll: false, // Don't monitor ALL events
      specificEvents: ['core:system_error_occurred'], // Only these
      deepClonePayloads: false, // Shallow clone is faster
    });
    await testBed.initialize();
  });

  // ... tests
});
```

### Step 5: Add Runtime Configuration Method

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js`

Allow tests to enable/disable monitoring at runtime:

```javascript
/**
 * Enable monitoring for specific events.
 * Useful when a test needs to verify events that aren't monitored by default.
 *
 * @param {string[]} eventTypes - Event types to monitor
 * @returns {Function} Unsubscribe function to stop monitoring
 */
enableEventMonitoring(eventTypes) {
  if (!Array.isArray(eventTypes) || eventTypes.length === 0) {
    throw new Error('eventTypes must be a non-empty array');
  }

  const subscriptions = eventTypes.map((eventType) => {
    return this.eventBus.subscribe(eventType, (event) => {
      this.events.push({
        timestamp: Date.now(),
        type: event.type,
        payload: { ...event.payload }, // Shallow clone
      });
    });
  });

  this.eventSubscriptions.push(...subscriptions);

  this.logger?.debug(`Enabled monitoring for: ${eventTypes.join(', ')}`);

  // Return unsubscribe function
  return () => {
    subscriptions.forEach((sub) => {
      const index = this.eventSubscriptions.indexOf(sub);
      if (index > -1) {
        this.eventSubscriptions.splice(index, 1);
      }
      if (typeof sub === 'function') {
        sub(); // Unsubscribe
      }
    });
  };
}
```

## Validation Criteria

### Performance Requirements

- [ ] Reduction in event processing overhead by 80%+
- [ ] Test suite runs 1-2 seconds faster
- [ ] No increase in memory usage

### Functional Requirements

- [ ] All existing tests pass without modification
- [ ] Entity lifecycle events are always captured (backward compatible)
- [ ] Tests can opt-in to additional event monitoring when needed
- [ ] Event assertions continue working (e.g., `assertEntityCreated()`)

### Code Quality Requirements

- [ ] Clear documentation for when to use each monitoring option
- [ ] No breaking changes to existing test API
- [ ] Consistent naming conventions
- [ ] Proper error handling for edge cases

## Testing Instructions

1. **Run the full test suite** and verify performance:
   ```bash
   NODE_ENV=test npx jest tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js --no-coverage
   ```

2. **Verify event assertions still work**:
   - Test: "should dispatch ENTITY_CREATED events with correct payload"
   - Test: "should dispatch ENTITY_REMOVED events and update indices"
   - Test: "should track entity lifecycle events correctly throughout operations"

3. **Verify getEventsByType() works** for tests that check specific events:
   ```bash
   NODE_ENV=test npx jest tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js -t "should handle removal of non-existent entities gracefully"
   ```

4. **Test custom event monitoring** (if implemented):
   ```javascript
   it('should capture custom events when explicitly enabled', async () => {
     const unsubscribe = testBed.enableEventMonitoring(['core:system_error_occurred']);

     // ... trigger error event

     const errorEvents = testBed.getEventsByType('core:system_error_occurred');
     expect(errorEvents.length).toBeGreaterThan(0);

     unsubscribe();
   });
   ```

## Performance Measurement

Add temporary logging to measure impact:

```javascript
setupEventMonitoring() {
  const startTime = performance.now();

  // ... setup logic

  const endTime = performance.now();
  this.logger?.info(`Event monitoring setup took ${(endTime - startTime).toFixed(2)}ms`);
}
```

Expected results:
- **Before**: Event monitoring setup + processing ~150-250ms per test
- **After**: Event monitoring setup + processing ~20-40ms per test
- **Savings**: ~110-210ms per test × 12 tests = 1.3-2.5 seconds

## Rollback Plan

If issues arise:
1. Set default `monitorAll: true` to restore previous behavior
2. Keep new code structure (better organized than before)
3. Investigate specific test failures
4. Gradually migrate tests to lazy monitoring

## Success Metrics

- **Performance**: 1-2 seconds faster test execution
- **Memory**: No increase in memory usage
- **Quality**: 100% test pass rate, no regressions

## Dependencies

- **Recommended**: Implement ENTLIFWOR-001 first (for maximum cumulative benefit)
- **Optional**: Can be implemented standalone

## Follow-up Work

- Apply lazy monitoring to other test beds
- Document pattern in `docs/testing/e2e-optimization-patterns.md`
- Consider extracting event monitoring to a reusable utility class

## References

- Test bed: `tests/e2e/entities/common/entityWorkflowTestBed.js:266-342`
- Event bus: `src/events/eventBus.js`
- Related: ENTLIFWOR-004 (removes deep cloning overhead)
