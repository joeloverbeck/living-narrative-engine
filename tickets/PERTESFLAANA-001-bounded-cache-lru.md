# PERTESFLAANA-001: Implement Bounded Cache with LRU Eviction

**Reference**: [Performance Test Flakiness Analysis](../docs/analysis/performance-test-flakiness-analysis.md)

## Summary

Implement a bounded cache utility with LRU (Least Recently Used) eviction to prevent unbounded memory growth in GOAP planner caches. This addresses the memory leak identified in the performance test analysis where caches grow indefinitely across planning sessions.

## Problem Statement

The `GoapPlanner` maintains several instance-level caches that grow unbounded:
- `#goalPathNormalizationCache` (Map<string, object>)
- `#goalPathDiagnostics` (Map<string, object>)
- `#effectFailureTelemetry` (Map<string, object>)
- `#heuristicWarningCache` (Set<string>)

Over 1000 planning iterations, these caches contribute ~10-20KB per iteration to memory growth, resulting in 220MB total growth in performance tests.

## Files Expected to Touch

### New Files
- `src/goap/utils/boundedCache.js` - New BoundedCache utility class

### Modified Files
- `src/goap/planner/goapPlanner.js` - Replace Map instances with BoundedCache
  - Lines to modify: 109, 112, 115, 118
  
### Test Files
- `tests/unit/goap/utils/boundedCache.test.js` - New unit tests for BoundedCache
- `tests/performance/goap/numericPlanning.performance.test.js` - Verify memory leak fix
  - Lines to verify: 662-845 (memory leak tests)

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

- `#goalPathNormalizationCache`: 100 entries (unique goal signatures)
- `#goalPathDiagnostics`: 50 entries (active actors)
- `#effectFailureTelemetry`: 200 entries (effect tracking)
- `#heuristicWarningCache`: 100 entries (warning deduplication)

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
     - Expected: < 1 MB growth over 1000 iterations (currently 220MB)
   - ✅ Memory stability test "should maintain stable memory under continuous load"
     - Expected: < 5% growth (currently 15.3%)

3. **Integration Tests**:
   - ✅ All existing GOAP integration tests must pass
   - ✅ `npm run test:integration -- tests/integration/goap/`

4. **System Tests**:
   - ✅ Full test suite: `npm run test:ci`
   - ✅ Linting: `npx eslint src/goap/utils/boundedCache.js tests/unit/goap/utils/boundedCache.test.js`

### Invariants That Must Remain True

1. **Functional Correctness**:
   - Cache hits return correct values
   - Cache misses return undefined
   - Eviction doesn't affect planning correctness

2. **API Compatibility**:
   - BoundedCache implements Map-like interface
   - All existing cache.get()/set()/has()/delete() calls work unchanged
   - No changes to GoapPlanner public API

3. **Performance Characteristics**:
   - O(1) get/set operations maintained
   - No degradation in planning performance
   - Memory growth reduced by >80% (target: <50MB for 1000 iterations)

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
- Verify memory growth < 50MB (down from 220MB)
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

2. **Performance Optimization**: Consider using a doubly-linked list for O(1) updates if Map operations prove slow

3. **Logging**: Add debug logging for evictions (use existing logger infrastructure)

4. **Configuration**: Make cache sizes configurable via dependency injection if needed

## Dependencies

None - this ticket is standalone and doesn't depend on other tickets.

## Estimated Effort

- Implementation: 2-3 hours
- Testing: 1-2 hours
- Total: 3-5 hours

## Validation Checklist

Before marking complete:
- [ ] BoundedCache unit tests pass with 100% coverage
- [ ] GOAP performance tests show <50MB memory growth
- [ ] All GOAP integration tests pass
- [ ] Full test suite passes (`npm run test:ci`)
- [ ] ESLint passes on modified files
- [ ] Manual memory profiling confirms improvement
- [ ] Code review completed
