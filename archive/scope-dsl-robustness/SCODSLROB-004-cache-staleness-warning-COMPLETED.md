# SCODSLROB-004: Cache Staleness Warning

## Status: COMPLETED

## Summary
Add warning when entity cache is used without EventBus invalidation setup. Track whether `setupEntityCacheInvalidation()` was called and warn on first cache hit if not.

## File List

### Files to Modify
1. `src/scopeDsl/core/entityHelpers.js`
   - Add module-level flag `eventBusConnected`
   - Set flag in `setupEntityCacheInvalidation()`
   - Check flag on cache hit and warn if not set
   - Throttle warnings to once per minute

### Out of Scope
- NO changes to cache eviction logic
- NO changes to invalidation logic
- NO changes to createEvaluationContext signature
- NO changes to test cleanup patterns
- NO breaking changes to exported API

## Implementation Details

### Add Module-Level State
```javascript
// Add near other module state (lines 22-26, after fallbackWarningTimestamps)
let eventBusConnected = false;
let stalenessWarningLastLogged = 0;
const STALENESS_WARNING_THROTTLE_MS = 60000; // 1 minute
```

### Update setupEntityCacheInvalidation
```javascript
export function setupEntityCacheInvalidation(eventBus) {
  // ... existing idempotency check ...

  eventBusConnected = true; // ADD THIS LINE

  // ... existing subscription logic ...
}
```

### Update Cache Hit Logic
```javascript
// In the cache hit path for string items (around lines 321-332)
// AND for object items with ID (around lines 371-374)
// Add warning logic after cacheHits++ increment in each location
if (entityCache.has(cacheKey)) {
  entity = entityCache.get(cacheKey);
  cacheHits++;
  notifyCacheEvent(cacheEventsHandler, 'hit', cacheKey, runtimeLogger);

  // Warn if EventBus not connected
  if (!eventBusConnected) {
    const now = Date.now();
    if (now - stalenessWarningLastLogged > STALENESS_WARNING_THROTTLE_MS) {
      stalenessWarningLastLogged = now;
      console.warn(
        '[SCOPE_4001] Entity cache in use without EventBus invalidation setup. ' +
        'Call setupEntityCacheInvalidation(eventBus) to enable automatic invalidation. ' +
        'Stale cache entries may cause incorrect scope resolution.'
      );
    }
  }
  // Continue with trace logging if needed...
}
```

### Update clearEntityCache
```javascript
export function clearEntityCache() {
  entityCache.clear();
  cacheHits = 0;
  cacheMisses = 0;
  // Reset warning state so it warns again after cache clear
  stalenessWarningLastLogged = 0;
  // Note: Do NOT reset eventBusConnected - that reflects actual setup state
}
```

## Acceptance Criteria

### Tests That Must Pass
1. All existing tests in `tests/unit/scopeDsl/core/entityHelpers.test.js`
2. All existing tests in `tests/unit/scopeDsl/core/entityHelpers.setupEntityCacheInvalidation.test.js`
3. All existing tests in `tests/integration/scopeDsl/entityHelpers.cacheIntegration.test.js`
4. New test: `tests/unit/scopeDsl/core/entityHelpers.stalenessWarning.test.js`
   - "should warn on cache hit when EventBus not connected"
   - "should NOT warn when EventBus is connected"
   - "should throttle warnings to once per minute"
   - "should reset warning throttle after clearEntityCache"
   - "should NOT reset eventBusConnected after clearEntityCache"

### Invariants That Must Remain True
- Cache behavior unchanged (warning is advisory only)
- Production code using setupEntityCacheInvalidation() sees no warnings
- Tests that call clearEntityCache() in beforeEach continue to work

## Outcome

### What Was Changed
1. **`src/scopeDsl/core/entityHelpers.js`**:
   - Added module-level state: `eventBusConnected`, `stalenessWarningLastLogged`, `STALENESS_WARNING_THROTTLE_MS`
   - Added helper function `warnIfEventBusNotConnected()` for DRY warning logic
   - Updated `setupEntityCacheInvalidation()` to set `eventBusConnected = true`
   - Added `warnIfEventBusNotConnected()` calls to both cache hit paths (string items and object items with ID)
   - Updated `clearEntityCache()` to reset `stalenessWarningLastLogged` but preserve `eventBusConnected`

2. **`tests/unit/scopeDsl/core/entityHelpers.stalenessWarning.test.js`** (NEW):
   - 6 tests covering all acceptance criteria
   - Tests for warning on cache hit without EventBus
   - Tests for no warning when EventBus connected
   - Tests for throttling (once per minute)
   - Tests for throttle reset after clearEntityCache
   - Tests that eventBusConnected survives clearEntityCache
   - Tests for object items with ID cache hit path

### Differences from Original Plan
- Ticket line numbers updated: Cache hit logic is at lines 348-360 and 399-403 (not ~130 as originally stated)
- Added helper function `warnIfEventBusNotConnected()` instead of duplicating warning code in two locations
- Added additional test for object items with ID cache hit path (not explicitly mentioned in original acceptance criteria but follows from the implementation)

### Test Results
- All 386 entityHelpers-related tests pass
- New test file: 6 tests, all passing
- All existing tests continue to work without modification
