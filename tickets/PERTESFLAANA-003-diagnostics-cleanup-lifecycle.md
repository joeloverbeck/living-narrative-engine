# PERTESFLAANA-003: Implement Actor Diagnostics Cleanup Lifecycle

**Reference**: [Performance Test Flakiness Analysis](../docs/analysis/performance-test-flakiness-analysis.md)

## Summary

Implement automatic cleanup of actor diagnostic data in both `GoapController` and `GoapPlanner` when actors are no longer active. The system already has cleanup methods (`clearActorDiagnostics`) but they are never called, causing diagnostic maps to accumulate indefinitely.

## Problem Statement

Diagnostic maps in both `GoapController` and `GoapPlanner` accumulate data indefinitely:

**GoapController** (lines 108-114):
- `#taskLibraryDiagnostics`
- `#goalPathDiagnostics` 
- `#effectFailureTelemetry`

**GoapPlanner** (lines 109-115):
- `#goalPathDiagnostics`
- `#goalPathNormalizationCache`
- `#effectFailureTelemetry`

While `clearActorDiagnostics()` methods exist, they depend on external callers that never invoke them. This contributes to the memory leak observed in performance tests.

## Files Expected to Touch

### Modified Files
- `src/goap/controllers/goapController.js`
  - Add automatic cleanup call after `decideTurn()` completion
  - Consider adding lifecycle hook for actor removal
  
- `src/goap/planner/goapPlanner.js`
  - Add cleanup call after planning session
  - Coordinate with controller cleanup

### Test Files
- `tests/unit/goap/controllers/goapController.test.js`
  - Verify automatic cleanup after decideTurn()
  
- `tests/unit/goap/planner/goapPlanner.test.js`
  - Verify cleanup after planning
  
- `tests/performance/goap/numericPlanning.performance.test.js`
  - Verify reduced memory growth from diagnostics cleanup

## Out of Scope

**DO NOT CHANGE**:
- Bounded cache implementation (separate ticket: PERTESFLAANA-001)
- Failure array pruning (separate ticket: PERTESFLAANA-002)
- Diagnostic data collection logic
- Planning algorithm or heuristics
- Event bus integration
- Test thresholds or timing assertions
- Any files outside `src/goap/` and corresponding tests

## Implementation Details

### Option 1: Cleanup After Each Turn (RECOMMENDED)

Add cleanup to `GoapController#decideTurn()`:

```javascript
async decideTurn(actor, world, availableGoals = null) {
  try {
    // ... existing planning logic ...
    
    return plan;
  } finally {
    // Always clean up diagnostics after turn, even on error
    if (actor?.id) {
      this.clearActorDiagnostics(actor.id);
      
      // Also clean planner diagnostics if accessible
      if (this.#planner?.clearActorDiagnostics) {
        this.#planner.clearActorDiagnostics(actor.id);
      }
    }
  }
}
```

**Pros:**
- Automatic cleanup on every turn
- No external coordination needed
- Predictable memory usage
- Works with existing test infrastructure

**Cons:**
- Loses diagnostic data between turns (acceptable for production)
- Slight overhead per turn (~1ms)

### Option 2: Lifecycle Hook System (FUTURE ENHANCEMENT)

Create explicit lifecycle management:

```javascript
class GoapController {
  /**
   * Called when an actor is removed from the game.
   * Cleans up all resources associated with the actor.
   */
  removeActor(actorId) {
    this.clearActorDiagnostics(actorId);
    this.#deleteActorPlan(actorId);
    this.#failedGoals.delete(actorId);
    this.#failedTasks.delete(actorId);
    
    if (this.#planner?.clearActorDiagnostics) {
      this.#planner.clearActorDiagnostics(actorId);
    }
  }
}
```

**Use Option 1 for this ticket.** Option 2 can be future work if needed.

### Configuration

Make cleanup behavior configurable:

```javascript
constructor({
  // ... existing params ...
  cleanupDiagnosticsAfterTurn = true, // Enable/disable automatic cleanup
}) {
  // ... existing init ...
  this.#cleanupDiagnosticsAfterTurn = cleanupDiagnosticsAfterTurn;
}
```

This allows disabling cleanup for debugging/development while keeping production clean.

## Acceptance Criteria

### Specific Tests That Must Pass

1. **Unit Tests** (`tests/unit/goap/controllers/goapController.test.js`):
   - ✅ Should clear diagnostics after successful turn
   - ✅ Should clear diagnostics after failed turn (error path)
   - ✅ Should not fail if actor has no diagnostics
   - ✅ Should respect cleanupDiagnosticsAfterTurn configuration
   - ✅ Should clean both controller and planner diagnostics

2. **Unit Tests** (`tests/unit/goap/planner/goapPlanner.test.js`):
   - ✅ clearActorDiagnostics() removes all actor data
   - ✅ clearActorDiagnostics() handles non-existent actor gracefully

3. **Performance Tests** (`tests/performance/goap/numericPlanning.performance.test.js`):
   - ✅ Diagnostic maps don't grow unbounded over 1000 iterations
   - ✅ Memory leak test shows reduced growth
   - ✅ Memory stability test shows improvement

4. **Integration Tests**:
   - ✅ All existing GOAP integration tests must pass
   - ✅ `npm run test:integration -- tests/integration/goap/`

5. **System Tests**:
   - ✅ Full test suite: `npm run test:ci`
   - ✅ Linting: `npx eslint src/goap/controllers/goapController.js src/goap/planner/goapPlanner.js`

### Invariants That Must Remain True

1. **Functional Correctness**:
   - Planning logic unaffected
   - Error handling preserved
   - Diagnostic data available within single turn

2. **API Compatibility**:
   - No changes to public GoapController API
   - No changes to public GoapPlanner API
   - Constructor maintains backward compatibility

3. **Performance Characteristics**:
   - Cleanup overhead < 1ms per turn
   - No degradation in planning performance
   - Memory growth from diagnostics eliminated

4. **Debugging Capability**:
   - Can disable cleanup for development/debugging
   - Diagnostic collection logic unchanged
   - clearActorDiagnostics() still accessible for manual calls

## Testing Strategy

### Unit Testing

```javascript
describe('GoapController - Diagnostics Cleanup', () => {
  it('should clear diagnostics after successful turn', async () => {
    const controller = createTestController();
    const actor = createTestActor('actor1');
    const world = createTestWorld();
    
    // Populate diagnostics
    controller['#taskLibraryDiagnostics'].set(actor.id, { data: 'test' });
    controller['#goalPathDiagnostics'].set(actor.id, { data: 'test' });
    
    // Execute turn
    await controller.decideTurn(actor, world);
    
    // Verify cleanup
    expect(controller['#taskLibraryDiagnostics'].has(actor.id)).toBe(false);
    expect(controller['#goalPathDiagnostics'].has(actor.id)).toBe(false);
  });
  
  it('should clear diagnostics even on error', async () => {
    const controller = createTestController();
    const actor = createTestActor('actor1');
    const world = createTestWorld();
    
    // Populate diagnostics
    controller['#taskLibraryDiagnostics'].set(actor.id, { data: 'test' });
    
    // Mock planner to throw error
    controller['#planner'].plan = jest.fn().mockRejectedValue(new Error('test error'));
    
    // Execute turn (should fail)
    await expect(controller.decideTurn(actor, world)).rejects.toThrow();
    
    // Verify cleanup still happened
    expect(controller['#taskLibraryDiagnostics'].has(actor.id)).toBe(false);
  });
  
  it('should respect cleanupDiagnosticsAfterTurn config', async () => {
    const controller = createTestController({
      cleanupDiagnosticsAfterTurn: false,
    });
    const actor = createTestActor('actor1');
    const world = createTestWorld();
    
    // Populate diagnostics
    controller['#taskLibraryDiagnostics'].set(actor.id, { data: 'test' });
    
    // Execute turn
    await controller.decideTurn(actor, world);
    
    // Verify no cleanup
    expect(controller['#taskLibraryDiagnostics'].has(actor.id)).toBe(true);
  });
});
```

### Performance Testing

Add specific assertions for diagnostic map sizes:

```javascript
it('should not grow diagnostic maps unbounded', async () => {
  const setup = await setupGoapPerformanceTest();
  
  let maxDiagnosticSize = 0;
  
  for (let i = 0; i < 1000; i++) {
    await setup.controller.decideTurn(setup.actor, setup.world);
    
    // Check diagnostic map sizes
    const controllerDiagSize = setup.controller['#taskLibraryDiagnostics'].size;
    const plannerDiagSize = setup.planner['#goalPathDiagnostics'].size;
    
    maxDiagnosticSize = Math.max(maxDiagnosticSize, controllerDiagSize, plannerDiagSize);
  }
  
  // With cleanup, should stay at 0 or 1 (current actor only)
  expect(maxDiagnosticSize).toBeLessThanOrEqual(1);
});
```

### Manual Verification

```bash
# Run performance tests with diagnostic logging
NODE_ENV=test node --expose-gc node_modules/.bin/jest tests/performance/goap/numericPlanning.performance.test.js --verbose

# Add temporary logging to track diagnostic sizes
# Expected: Maps stay empty or contain only current actor
```

## Implementation Notes

1. **Cleanup Timing**: Use try-finally to ensure cleanup happens even on error

2. **Access to Planner**: Controller already has reference to planner via DI, can call cleanup directly

3. **Coordination**: Controller cleanup should also trigger planner cleanup for the same actor

4. **Configuration**: Default to enabled for production, allow disabling for debugging

5. **Logging**: Add debug logging for cleanup operations (optional, low priority)

6. **Memory Impact**: Eliminating diagnostic accumulation should reduce memory growth by ~5-10KB per iteration

## Dependencies

None - this ticket is standalone. However, combining with PERTESFLAANA-001 and PERTESFLAANA-002 will provide the maximum memory leak reduction.

## Estimated Effort

- Implementation: 1-2 hours
- Testing: 1 hour
- Total: 2-3 hours

## Validation Checklist

Before marking complete:
- [ ] Automatic cleanup implemented in decideTurn()
- [ ] Cleanup works on both success and error paths
- [ ] Configuration option for disabling cleanup
- [ ] Unit tests pass with 100% coverage for cleanup logic
- [ ] Performance tests show diagnostic maps stay bounded
- [ ] All GOAP integration tests pass
- [ ] Full test suite passes (`npm run test:ci`)
- [ ] ESLint passes on modified files
- [ ] Manual verification of memory impact
- [ ] Code review completed

## Future Enhancements

Consider for future tickets (not this one):
- Lifecycle hook system for actor removal
- Configurable cleanup strategies (per-turn vs periodic)
- Diagnostic data retention for multi-turn analysis
- Export diagnostics before cleanup for debugging tools
