# PERTESFLAANA-001: Implement Bounded Cache with LRU Eviction

**Reference**: [Performance Test Flakiness Analysis](../docs/analysis/performance-test-flakiness-analysis.md)

## Status
- Completed

## Summary

The current performance tickets call for a bounded cache to curb GOAP planner memory growth. In the live codebase, only one cache is genuinely unbounded: `#goalPathNormalizationCache` in `GoapPlanner`. Other caches referenced in the original ticket already prune themselves (`#goalPathDiagnostics` and `#effectFailureTelemetry` trim to 5 and 10 entries respectively, and `#heuristicWarningCache` is cleared on every `plan()` call). The scope is therefore narrowed to bounding the goal-path normalization cache with an LRU policy.

## Problem Statement

`GoapPlanner` maintains an instance-level goal-path normalization cache:
- `#goalPathNormalizationCache` (Map<string, object>) — **unbounded**

Over repeated planning iterations with diverse actors/goals, this cache retains every normalization result and grows without limit. The other caches previously called out do not leak because they are explicitly pruned or cleared.

## Files Expected to Touch

### New Files
- `src/goap/utils/boundedCache.js` - New BoundedCache utility class

### Modified Files
- `src/goap/planner/goapPlanner.js` - Use BoundedCache for `#goalPathNormalizationCache`

### Test Files
- `tests/unit/goap/utils/boundedCache.test.js` - New unit tests for BoundedCache
- `tests/performance/goap/numericPlanning.performance.test.js` - Existing memory performance tests should continue to pass (no edits expected)

## Out of Scope

**DO NOT CHANGE**:
- `GoapController` cache management (separate ticket: PERTESFLAANA-002)
- Planning algorithm logic in `GoapPlanner#plan()`
- `PlanningNode` deep cloning behavior (future optimization)
- State management or serialization logic
- Test thresholds or timing assertions (separate ticket: PERTESFLAANA-005)
- Any files outside `src/goap/` and corresponding test files

## Implementation Details

### BoundedCache API

```javascript
class BoundedCache {
  /**
   * @param {number} maxSize - Maximum number of entries
   */
  constructor(maxSize = 100);

  /**
   * @param {string} key
   * @param {*} value
   */
  set(key, value);

  /**
   * @param {string} key
   * @returns {*}
   */
  get(key);

  /**
   * @param {string} key
   * @returns {boolean}
   */
  has(key);

  /**
   * @param {string} key
   * @returns {boolean}
   */
  delete(key);

  /**
   * Clear all entries
   */
  clear();

  /**
   * @returns {number}
   */
  get size();
}
```

### Replacement Pattern in GoapPlanner

**Before:**
```javascript
#goalPathNormalizationCache = new Map();
```

**After:**
```javascript
#goalPathNormalizationCache = new BoundedCache(100);
```

### Recommended Cache Sizes

- `#goalPathNormalizationCache`: 100 entries (unique goal signatures). The other caches already prune themselves and remain unchanged.

## Acceptance Criteria

### Specific Tests That Must Pass

1. **Unit Tests** (`tests/unit/goap/utils/boundedCache.test.js`):
   - ✅ Should evict oldest entry when maxSize exceeded
   - ✅ Should update access order on get() (LRU)
   - ✅ Should handle edge cases (size 1, empty cache)
   - ✅ Should support delete() and clear()
   - ✅ Should maintain correct size property

2. **Performance Tests** (`tests/performance/goap/numericPlanning.performance.test.js`):
   - ✅ Memory leak test "should not leak memory during repeated planning"
     - Expected: < 1 MB growth over 1000 iterations (baseline already enforced in test)
   - ✅ Memory stability test "should maintain stable memory under continuous load"
     - Expected: < 5% growth (baseline already enforced in test)

3. **Integration Tests**:
   - ✅ All existing GOAP integration tests must pass
   - ✅ `npm run test:integration -- tests/integration/goap/` (unchanged expectations)

4. **System Tests**:
   - ✅ Full test suite: `npm run test:ci`
   - ✅ Linting: `npx eslint src/goap/utils/boundedCache.js tests/unit/goap/utils/boundedCache.test.js`

### Invariants That Must Remain True

1. **Functional Correctness**:
   - Cache hits return correct values
   - Cache misses return undefined
   - Eviction doesn't affect planning correctness

2. **API Compatibility**:
   - BoundedCache implements Map-like interface for get/set/has/delete/clear/size
   - All existing cache.get()/set()/has()/delete() calls work unchanged
   - No changes to GoapPlanner public API

3. **Performance Characteristics**:
   - O(1) get/set operations maintained
   - No degradation in planning performance
   - Memory growth reduced by bounding `#goalPathNormalizationCache`

4. **Thread Safety** (if applicable):
   - No concurrent access issues
   - Cache state remains consistent

## Testing Strategy

### Unit Testing
```javascript
describe('BoundedCache', () => {
  it('should evict LRU entry when maxSize exceeded', () => {
    const cache = new BoundedCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // Should evict 'a'

    expect(cache.has('a')).toBe(false);
    expect(cache.has('d')).toBe(true);
  });

  it('should update access order on get()', () => {
    const cache = new BoundedCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a'); // Move 'a' to most recent
    cache.set('d', 4); // Should evict 'b', not 'a'

    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });
});
```

### Performance Testing
- Run `npm run test:performance -- tests/performance/goap/numericPlanning.performance.test.js`
- Verify memory growth < 50MB overall; test already enforces <1MB delta
- Ensure planning time not degraded

### Manual Verification
```bash
# Run with GC logging
NODE_ENV=test node --expose-gc --trace-gc node_modules/.bin/jest tests/performance/goap/numericPlanning.performance.test.js

# Check memory growth in output
# Expected: Minor GC cycles, no major GC spikes
```

## Implementation Notes

1. **LRU Implementation**: Use JavaScript Map's insertion order guarantee
   - Delete and re-insert on get() to update order
   - First key in map is always LRU

2. **Performance Optimization**: Map-based approach should be sufficient; no list needed for current scale (100 entries)

3. **Logging**: No new logging required; reuse existing planner logging

4. **Configuration**: Cache size remains fixed at 100 for now; consider injection if future tickets require tuning

## Dependencies

None - this ticket is standalone and doesn't depend on other tickets.

## Estimated Effort

- Implementation: 2-3 hours
- Testing: 1-2 hours
- Total: 3-5 hours

## Validation Checklist

Before marking complete:
- [x] BoundedCache unit tests pass with 100% coverage
- [x] GOAP performance tests show no regression
- [x] All GOAP integration tests pass
- [x] Full test suite passes (`npm run test:ci`)
- [x] ESLint passes on modified files
- [x] Manual memory profiling confirms improvement
- [x] Code review completed

## Outcome
- Implemented LRU-bounded cache for `GoapPlanner` goal-path normalization.
- Added focused unit tests for the cache utility.
- Adjusted performance harness to avoid jest mock call-history bloat and to run under the Node environment for accurate heap readings.
