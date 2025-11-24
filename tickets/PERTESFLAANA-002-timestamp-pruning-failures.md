# PERTESFLAANA-002: Add Timestamp-Based Pruning for Failure Arrays

**Reference**: [Performance Test Flakiness Analysis](../docs/analysis/performance-test-flakiness-analysis.md)

## Summary

Implement automatic timestamp-based pruning for `#failedGoals` and `#failedTasks` arrays in `GoapController` to prevent unbounded memory growth. These arrays currently grow indefinitely with each goal/task failure, contributing to the memory leak identified in performance tests.

## Problem Statement

The `GoapController` maintains two instance-level maps with arrays that grow unbounded:
- `#failedGoals` (Map<string, Array<{reason, timestamp}>>) - Line 90
- `#failedTasks` (Map<string, Array<{reason, timestamp}>>) - Line 93

Each failure appends to these arrays without any cleanup mechanism. Over 1000 planning iterations with multiple failures per iteration, this contributes significantly to memory growth.

## Files Expected to Touch

### Modified Files
- `src/goap/controllers/goapController.js`
  - Lines to modify: 90-93 (add pruning logic)
  - Add new method: `#pruneOldFailures(map, maxAge)`
  - Add pruning calls in existing failure recording methods

### Test Files
- `tests/unit/goap/controllers/goapController.test.js`
  - Add tests for pruning behavior
- `tests/performance/goap/numericPlanning.performance.test.js`
  - Verify reduced memory growth

## Out of Scope

**DO NOT CHANGE**:
- `GoapPlanner` cache management (separate ticket: PERTESFLAANA-001)
- Goal/task selection logic
- Planning algorithm or heuristics
- Error reporting or logging mechanisms
- Any diagnostic maps (`#goalPathDiagnostics`, etc.) - covered by PERTESFLAANA-003
- Test thresholds or timing assertions
- Any files outside `src/goap/controllers/` and corresponding tests

## Implementation Details

### Pruning Method

```javascript
/**
 * Prune old failures from a failure tracking map.
 * Removes entries older than maxAge and deletes empty arrays.
 * 
 * @param {Map<string, Array<{reason, timestamp}>>} map - Failure map to prune
 * @param {number} maxAge - Maximum age in milliseconds (default: 1 hour)
 * @private
 */
#pruneOldFailures(map, maxAge = 3600000) {
  const now = Date.now();
  
  for (const [key, failures] of map.entries()) {
    const recent = failures.filter(f => now - f.timestamp < maxAge);
    
    if (recent.length === 0) {
      map.delete(key);
    } else if (recent.length < failures.length) {
      map.set(key, recent);
    }
  }
}
```

### Integration Points

**Call pruning in existing methods:**

1. After recording goal failure:
```javascript
#recordGoalFailure(actorId, goal, reason) {
  // ... existing logic ...
  
  // Prune old failures periodically
  this.#pruneOldFailures(this.#failedGoals);
}
```

2. After recording task failure:
```javascript
#recordTaskFailure(actorId, task, reason) {
  // ... existing logic ...
  
  // Prune old failures periodically
  this.#pruneOldFailures(this.#failedTasks);
}
```

### Configuration

Make pruning configurable via constructor options:

```javascript
constructor({
  // ... existing params ...
  failureRetentionMs = 3600000, // 1 hour default
}) {
  // ... existing init ...
  this.#failureRetentionMs = failureRetentionMs;
}
```

## Acceptance Criteria

### Specific Tests That Must Pass

1. **Unit Tests** (`tests/unit/goap/controllers/goapController.test.js`):
   - ✅ Should prune failures older than maxAge
   - ✅ Should retain failures within maxAge window
   - ✅ Should delete map entries with no recent failures
   - ✅ Should handle edge cases (empty map, all recent, all old)
   - ✅ Should not affect failure recording functionality
   - ✅ Should respect custom failureRetentionMs configuration

2. **Performance Tests** (`tests/performance/goap/numericPlanning.performance.test.js`):
   - ✅ Memory leak test shows reduced growth
   - ✅ Failure arrays don't grow unbounded over 1000 iterations
   - ✅ Memory stability test shows improvement

3. **Integration Tests**:
   - ✅ All existing GOAP integration tests must pass
   - ✅ `npm run test:integration -- tests/integration/goap/`

4. **System Tests**:
   - ✅ Full test suite: `npm run test:ci`
   - ✅ Linting: `npx eslint src/goap/controllers/goapController.js tests/unit/goap/controllers/goapController.test.js`

### Invariants That Must Remain True

1. **Functional Correctness**:
   - Recent failures still accessible for decision making
   - Failure recording behavior unchanged
   - Goal/task selection logic unaffected

2. **API Compatibility**:
   - No changes to public GoapController API
   - Constructor maintains backward compatibility (new param optional)
   - Failure tracking methods signatures unchanged

3. **Performance Characteristics**:
   - Pruning is O(n) where n = number of actors with failures
   - No degradation in planning performance
   - Pruning overhead < 1ms per call

4. **Data Integrity**:
   - Pruning doesn't remove failures incorrectly
   - Timestamp-based filtering is accurate
   - No race conditions with concurrent planning

## Testing Strategy

### Unit Testing

```javascript
describe('GoapController - Failure Pruning', () => {
  let controller;
  
  beforeEach(() => {
    controller = new GoapController({
      // ... required deps ...
      failureRetentionMs: 1000, // 1 second for testing
    });
  });
  
  it('should prune failures older than retention period', () => {
    const actorId = 'actor1';
    const goal = { type: 'GATHER_GOLD', target: 100 };
    
    // Record old failure
    controller['#recordGoalFailure'](actorId, goal, 'test reason');
    
    // Wait for retention period
    jest.advanceTimersByTime(1100);
    
    // Record new failure (triggers pruning)
    controller['#recordGoalFailure'](actorId, goal, 'new reason');
    
    // Verify old failure pruned
    const failures = controller['#failedGoals'].get(actorId);
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toBe('new reason');
  });
  
  it('should retain recent failures', () => {
    const actorId = 'actor1';
    const goal = { type: 'GATHER_GOLD', target: 100 };
    
    // Record multiple recent failures
    controller['#recordGoalFailure'](actorId, goal, 'reason 1');
    jest.advanceTimersByTime(500); // Within retention
    controller['#recordGoalFailure'](actorId, goal, 'reason 2');
    
    // Verify both retained
    const failures = controller['#failedGoals'].get(actorId);
    expect(failures).toHaveLength(2);
  });
  
  it('should delete empty entries after pruning', () => {
    const actorId = 'actor1';
    const goal = { type: 'GATHER_GOLD', target: 100 };
    
    // Record old failure
    controller['#recordGoalFailure'](actorId, goal, 'test reason');
    
    // Wait for retention period
    jest.advanceTimersByTime(1100);
    
    // Trigger pruning (via any failure recording)
    controller['#recordGoalFailure']('actor2', goal, 'trigger');
    
    // Verify actor1 entry deleted
    expect(controller['#failedGoals'].has(actorId)).toBe(false);
  });
});
```

### Performance Testing

Add specific assertions for failure array sizes:

```javascript
it('should not grow failure arrays unbounded', async () => {
  const setup = await setupGoapPerformanceTest();
  
  // Force failures by setting impossible goals
  const impossibleGoal = { type: 'IMPOSSIBLE', target: 999999 };
  
  let maxFailureCount = 0;
  
  for (let i = 0; i < 1000; i++) {
    await setup.controller.decideTurn(setup.actor, setup.world, [impossibleGoal]);
    
    // Check failure array size
    const failures = setup.controller['#failedGoals'].get(setup.actor.id) || [];
    maxFailureCount = Math.max(maxFailureCount, failures.length);
  }
  
  // Should not exceed retention window even with 1000 failures
  // With 1-hour retention and failures every 10ms, max should be ~360 entries
  expect(maxFailureCount).toBeLessThan(500);
});
```

### Manual Verification

```bash
# Run performance tests with GC logging
NODE_ENV=test node --expose-gc --trace-gc node_modules/.bin/jest tests/performance/goap/numericPlanning.performance.test.js

# Verify failure arrays don't grow indefinitely
# Add temporary logging in test to track array sizes
```

## Implementation Notes

1. **Pruning Frequency**: Prune on every failure recording (low overhead, ensures bounds)

2. **Retention Period**: Default 1 hour provides good balance between debugging and memory usage

3. **Alternative Approach**: Could use periodic pruning (setInterval), but increases complexity

4. **Memory Impact**: Each failure entry is ~100 bytes (reason string + timestamp). With 1-hour retention and 1 failure/second, max growth = 360KB per actor

5. **Logging**: Add debug logging for pruning operations (number of entries removed)

## Dependencies

None - this ticket is standalone and can be implemented independently of other tickets.

## Estimated Effort

- Implementation: 1-2 hours
- Testing: 1-2 hours
- Total: 2-4 hours

## Validation Checklist

Before marking complete:
- [ ] Pruning method implemented with configurable retention
- [ ] Unit tests pass with 100% coverage for pruning logic
- [ ] Performance tests show bounded failure array growth
- [ ] All GOAP integration tests pass
- [ ] Full test suite passes (`npm run test:ci`)
- [ ] ESLint passes on modified files
- [ ] Manual verification of memory impact
- [ ] Code review completed
