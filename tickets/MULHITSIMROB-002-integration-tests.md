# MULHITSIMROB-002: Add Integration Tests for MultiHitSimulator

## Summary

Add integration tests to verify MultiHitSimulator workflows including full simulation cycles, stop behavior, consecutive runs, and focus mode targeting.

## Background

The `MultiHitSimulator` class orchestrates damage simulation with external dependencies (`DamageExecutionService`, `ISafeEventDispatcher`). Integration tests verify that these components work together correctly in realistic scenarios.

**Reference**: `specs/multi-hit-simulator-robustness.md` lines 354-362

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `tests/integration/domUI/damage-simulator/multiHitSimulatorWorkflow.integration.test.js` | CREATE | New integration test file |

## Out of Scope

- NOT modifying `src/domUI/damage-simulator/MultiHitSimulator.js`
- NOT modifying `tests/unit/domUI/damage-simulator/MultiHitSimulator.test.js`
- NOT modifying existing integration tests:
  - `tests/integration/domUI/damage-simulator/damageSimulatorEventValidation.integration.test.js`
  - `tests/integration/domUI/damage-simulator/entityLoading.integration.test.js`
- NOT modifying `DamageExecutionService` or other production code
- NOT adding DOM mocking (integration tests use real behavior where possible)

## Implementation Details

### Test 1: Full Simulation Workflow

```javascript
describe('Full simulation workflow', () => {
  it('should complete Configure -> Run -> Events -> UI update cycle', async () => {
    // 1. Create simulator with mock dependencies
    // 2. Configure with valid config (hitCount: 5, delay: 10ms)
    // 3. Run simulation
    // 4. Verify: PROGRESS events emitted (5 total)
    // 5. Verify: COMPLETE event emitted with correct results
    // 6. Verify: UI update methods called (if applicable)
  });
});
```

### Test 2: Stop During Execution

```javascript
describe('Stop during execution', () => {
  it('should emit STOPPED event with partial results and clean up', async () => {
    // 1. Configure with hitCount: 10, delay: 50ms
    // 2. Start run()
    // 3. After 2-3 hits, call stop()
    // 4. Verify: STOPPED event emitted (not COMPLETE)
    // 5. Verify: results.completed === false
    // 6. Verify: results.hitsExecuted < 10
    // 7. Verify: isRunning() returns false after stop
    // 8. Verify: No pending timers (cleanup complete)
  });
});
```

### Test 3: Multiple Consecutive Runs

```javascript
describe('Multiple consecutive runs', () => {
  it('should reset state between runs and maintain consistency', async () => {
    // 1. Configure and run simulation (hitCount: 3)
    // 2. Wait for completion
    // 3. Configure and run again (hitCount: 5)
    // 4. Verify: Second run completes with correct hitCount
    // 5. Verify: Progress resets to 0 at start of second run
    // 6. Verify: Round-robin index resets between runs
    // 7. Verify: No cross-contamination of results
  });
});
```

### Test 4: Focus Mode End-to-End

```javascript
describe('Focus mode with real parts', () => {
  it('should consistently target the specified part', async () => {
    // 1. Create mock parts array with 5 distinct part IDs
    // 2. Configure with targetMode: 'focus', focusPartId: 'part-3'
    // 3. Run simulation (hitCount: 10)
    // 4. Verify: All 10 hits target 'part-3'
    // 5. Verify: results.partHitCounts['part-3'] === 10
    // 6. Verify: No other parts in partHitCounts
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

- [ ] Full simulation workflow test passes
- [ ] Stop during execution test passes
- [ ] Multiple consecutive runs test passes
- [ ] Focus mode end-to-end test passes
- [ ] All existing unit tests (94) still pass
- [ ] All existing integration tests still pass

### Invariants That Must Remain True

- Simulation completes successfully when not stopped
- Stop cancels simulation and emits correct event
- State fully resets between runs
- Focus mode targets only the specified part

### Quality Requirements

- Tests should be deterministic (no flaky behavior)
- Tests should complete in < 5 seconds total
- Use `jest.useFakeTimers()` for timer-dependent tests

## Test File Template

```javascript
/**
 * @file Integration tests for MultiHitSimulator workflow scenarios
 * Tests end-to-end behavior including events, state, and multi-run consistency.
 * @see specs/multi-hit-simulator-robustness.md
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import MultiHitSimulator from '../../../../src/domUI/damage-simulator/MultiHitSimulator.js';

// Helper to create realistic mock dependencies
function createIntegrationTestDependencies() {
  const events = [];
  const mockEventBus = {
    dispatch: jest.fn((type, payload) => {
      events.push({ type, payload, timestamp: Date.now() });
    }),
  };

  const mockExecutionService = {
    getTargetableParts: jest.fn(() => [
      { id: 'part-1', name: 'Head', weight: 1 },
      { id: 'part-2', name: 'Torso', weight: 2 },
      { id: 'part-3', name: 'Arms', weight: 1 },
    ]),
    applyDamage: jest.fn(async () => ({
      success: true,
      damageDealt: 10,
      effects: [],
    })),
  };

  return { mockEventBus, mockExecutionService, events };
}

describe('MultiHitSimulator - Integration Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Full simulation workflow', () => { /* ... */ });
  describe('Stop during execution', () => { /* ... */ });
  describe('Multiple consecutive runs', () => { /* ... */ });
  describe('Focus mode end-to-end', () => { /* ... */ });
});
```

## Verification Commands

```bash
# Run new integration tests only
NODE_ENV=test npx jest tests/integration/domUI/damage-simulator/multiHitSimulatorWorkflow.integration.test.js --no-coverage --verbose

# Verify existing integration tests still pass
NODE_ENV=test npx jest tests/integration/domUI/damage-simulator/ --no-coverage --silent

# Verify unit tests unaffected
NODE_ENV=test npx jest tests/unit/domUI/damage-simulator/MultiHitSimulator.test.js --no-coverage --silent
```

## Dependencies

- **Blocks**: None
- **Blocked by**: None
- **Related**: MULHITSIMROB-001 (property tests), MULHITSIMROB-003 (CI coverage)

## Estimated Effort

Small - focused integration test file following existing patterns in `tests/integration/domUI/damage-simulator/`.

## Reference Files

- Pattern: `tests/integration/domUI/damage-simulator/entityLoading.integration.test.js`
- Pattern: `tests/integration/domUI/damage-simulator/damageSimulatorEventValidation.integration.test.js`
- Source: `src/domUI/damage-simulator/MultiHitSimulator.js`
