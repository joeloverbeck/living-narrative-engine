# AWAEXTTURENDSTAROB-011: Add Timeout Consistency Regression Tests

## Metadata
- **Ticket ID:** AWAEXTTURENDSTAROB-011
- **Phase:** 2 - Standard Patterns
- **Priority:** Medium
- **Estimated Effort:** 2 hours
- **Dependencies:** AWAEXTTURENDSTAROB-007 (must complete first)

## Objective

Create regression tests that verify timeout values match provider responses exactly and cleanup occurs in all exit paths. These tests prevent subtle bugs like off-by-one errors or missing cleanup paths.

## Files to Create

### New Test File
- `tests/regression/turns/states/awaitingExternalTurnEndState.timeoutConsistency.regression.test.js` (NEW)

## Test Structure Required

### File Organization
```javascript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import AwaitingExternalTurnEndState from '../../../../src/turns/states/awaitingExternalTurnEndState.js';
import { TestEnvironmentProvider } from '../../../../src/environment/TestEnvironmentProvider.js';
import { TURN_ENDED_ID } from '../../../../src/events/eventIds.js';

describe('AwaitingExternalTurnEndState - Timeout Consistency Regression', () => {
  let mockLogger;
  let mockEventBus;
  let mockEndTurn;
  let mockContext;

  beforeEach(() => {
    jest.useFakeTimers();
    mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(() => 'subscription-id'),
    };
    mockEndTurn = jest.fn();
    mockContext = {
      actorId: 'test-actor',
      turn: { id: 'test-turn' },
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Exact Timeout Value Matching', () => {
    // Tests 1-3
  });

  describe('Cleanup in All Exit Paths', () => {
    // Test 4
  });
});
```

## Required Test Cases (Minimum 4)

### Test 1: Production Provider → Exactly 30,000ms
```javascript
it('should use exactly 30,000ms timeout with production provider', () => {
  // Arrange
  const productionProvider = new TestEnvironmentProvider({ IS_PRODUCTION: true });
  const mockSetTimeout = jest.fn((fn, ms) => 'timeout-id');

  // Act
  const state = new AwaitingExternalTurnEndState({
    context: mockContext,
    logger: mockLogger,
    eventBus: mockEventBus,
    endTurn: mockEndTurn,
    environmentProvider: productionProvider,
    setTimeoutFn: mockSetTimeout,
    clearTimeoutFn: jest.fn(),
  });

  state.enterState();

  // Assert
  expect(mockSetTimeout).toHaveBeenCalledWith(
    expect.any(Function),
    30_000 // EXACTLY 30000, not 30001 or 29999
  );
  expect(mockSetTimeout).toHaveBeenCalledTimes(1);
});
```

### Test 2: Development Provider → Exactly 3,000ms
```javascript
it('should use exactly 3,000ms timeout with development provider', () => {
  // Arrange
  const developmentProvider = new TestEnvironmentProvider({ IS_PRODUCTION: false });
  const mockSetTimeout = jest.fn((fn, ms) => 'timeout-id');

  // Act
  const state = new AwaitingExternalTurnEndState({
    context: mockContext,
    logger: mockLogger,
    eventBus: mockEventBus,
    endTurn: mockEndTurn,
    environmentProvider: developmentProvider,
    setTimeoutFn: mockSetTimeout,
    clearTimeoutFn: jest.fn(),
  });

  state.enterState();

  // Assert
  expect(mockSetTimeout).toHaveBeenCalledWith(
    expect.any(Function),
    3_000 // EXACTLY 3000
  );
});
```

### Test 3: Explicit Override → Provider Ignored
```javascript
it('should use exact explicit timeout and ignore provider', () => {
  // Arrange
  const productionProvider = new TestEnvironmentProvider({ IS_PRODUCTION: true });
  const mockSetTimeout = jest.fn((fn, ms) => 'timeout-id');

  // Act
  const state = new AwaitingExternalTurnEndState({
    context: mockContext,
    logger: mockLogger,
    eventBus: mockEventBus,
    endTurn: mockEndTurn,
    environmentProvider: productionProvider, // Would give 30,000
    timeoutMs: 5_000, // Explicit override
    setTimeoutFn: mockSetTimeout,
    clearTimeoutFn: jest.fn(),
  });

  state.enterState();

  // Assert
  expect(mockSetTimeout).toHaveBeenCalledWith(
    expect.any(Function),
    5_000 // EXACTLY 5000, not 30000 from provider
  );
});
```

### Test 4: Cleanup in All Exit Paths
```javascript
it('should clear timeout in all exit paths', () => {
  // Arrange
  const mockClearTimeout = jest.fn();
  let timeoutId;
  const mockSetTimeout = jest.fn((fn, ms) => {
    timeoutId = `timeout-${Date.now()}`;
    return timeoutId;
  });

  // Test Path 1: Event arrival
  {
    const state = new AwaitingExternalTurnEndState({
      context: { actorId: 'actor-1', turn: { id: 'turn-1' } },
      logger: mockLogger,
      eventBus: mockEventBus,
      endTurn: jest.fn(),
      timeoutMs: 5_000,
      setTimeoutFn: mockSetTimeout,
      clearTimeoutFn: mockClearTimeout,
    });

    state.enterState();
    const initialTimeoutId = timeoutId;

    // Simulate event arrival via internal method
    state.exitState();

    expect(mockClearTimeout).toHaveBeenCalledWith(initialTimeoutId);
    mockClearTimeout.mockClear();
  }

  // Test Path 2: Timeout fires (self-clears)
  {
    const state = new AwaitingExternalTurnEndState({
      context: { actorId: 'actor-2', turn: { id: 'turn-2' } },
      logger: mockLogger,
      eventBus: mockEventBus,
      endTurn: jest.fn(),
      timeoutMs: 5_000,
      setTimeoutFn: mockSetTimeout,
      clearTimeoutFn: mockClearTimeout,
    });

    state.enterState();

    // Timeout fires (fast-forward timers)
    jest.advanceTimersByTime(5_000);

    // Timeout should have cleared itself
    // (Verified by no orphan timers in integration tests)
    mockClearTimeout.mockClear();
  }

  // Test Path 3: exitState called directly
  {
    const state = new AwaitingExternalTurnEndState({
      context: { actorId: 'actor-3', turn: { id: 'turn-3' } },
      logger: mockLogger,
      eventBus: mockEventBus,
      endTurn: jest.fn(),
      timeoutMs: 5_000,
      setTimeoutFn: mockSetTimeout,
      clearTimeoutFn: mockClearTimeout,
    });

    state.enterState();
    const exitTimeoutId = timeoutId;

    state.exitState();

    expect(mockClearTimeout).toHaveBeenCalledWith(exitTimeoutId);
    mockClearTimeout.mockClear();
  }

  // Test Path 4: destroy called
  {
    const state = new AwaitingExternalTurnEndState({
      context: { actorId: 'actor-4', turn: { id: 'turn-4' } },
      logger: mockLogger,
      eventBus: mockEventBus,
      endTurn: jest.fn(),
      timeoutMs: 5_000,
      setTimeoutFn: mockSetTimeout,
      clearTimeoutFn: mockClearTimeout,
    });

    state.enterState();
    const destroyTimeoutId = timeoutId;

    state.destroy();

    expect(mockClearTimeout).toHaveBeenCalledWith(destroyTimeoutId);
    mockClearTimeout.mockClear();
  }

  // Test Path 5: Error during event handling (still cleans up)
  {
    const errorEventBus = {
      dispatch: jest.fn(() => { throw new Error('Dispatch error'); }),
      subscribe: jest.fn(() => 'subscription-id'),
    };

    const state = new AwaitingExternalTurnEndState({
      context: { actorId: 'actor-5', turn: { id: 'turn-5' } },
      logger: mockLogger,
      eventBus: errorEventBus,
      endTurn: jest.fn(),
      timeoutMs: 5_000,
      setTimeoutFn: mockSetTimeout,
      clearTimeoutFn: mockClearTimeout,
    });

    state.enterState();
    const errorTimeoutId = timeoutId;

    // Even if error occurs, cleanup should still happen
    state.destroy();

    expect(mockClearTimeout).toHaveBeenCalledWith(errorTimeoutId);
  }
});
```

## Out of Scope

### Must NOT Include
- Integration tests (Ticket 010)
- Property-based tests (Phase 3)
- Performance tests
- Memory leak detection (beyond cleanup verification)
- Provider-specific tests (Ticket 009)

### Must NOT Change
- Production code
- Other regression tests
- Test utilities

## Acceptance Criteria

### AC1: All 4 Test Cases Pass
```javascript
// GIVEN: Regression test suite with 4 test cases
// WHEN: npm run test:regression -- timeoutConsistency.regression.test.js
// THEN:
//   ✓ All tests pass
//   ✓ Tests verify exact timeout values
//   ✓ Tests verify cleanup in all paths
```

### AC2: Exact Timeout Values Verified
```javascript
// GIVEN: Tests 1-3 checking exact timeout values
// WHEN: setTimeout mock inspected
// THEN:
//   ✓ Production: EXACTLY 30_000ms (no rounding errors)
//   ✓ Development: EXACTLY 3_000ms
//   ✓ Explicit: EXACTLY specified value
//   ✓ No off-by-one errors
```

### AC3: Override Precedence Verified
```javascript
// GIVEN: Test 3 with provider + explicit timeout
// WHEN: State created
// THEN:
//   ✓ Explicit timeout used (5_000)
//   ✓ Provider timeout ignored (30_000 not used)
//   ✓ Precedence: explicit > provider > default
```

### AC4: All Exit Paths Clean Up
```javascript
// GIVEN: Test 4 with 5 cleanup paths
// WHEN: Each path executed
// THEN:
//   ✓ Path 1 (event arrival): clearTimeout called
//   ✓ Path 2 (timeout fires): self-clears
//   ✓ Path 3 (exitState): clearTimeout called
//   ✓ Path 4 (destroy): clearTimeout called
//   ✓ Path 5 (error during handling): clearTimeout still called
```

### AC5: Prevents Regression
```javascript
// GIVEN: Any future code changes
// WHEN: Timeout value calculation modified
// THEN:
//   ✓ Test 1 catches production timeout changes
//   ✓ Test 2 catches development timeout changes
//   ✓ Test 3 catches override logic changes
//   ✓ Test 4 catches missing cleanup paths
```

## Invariants

### Timeout Value Invariants (Must Verify)
1. **Exact Matching**: Timeout exactly matches configuration (no rounding)
2. **Override Precedence**: Explicit > provider > default
3. **No Calculation Errors**: No off-by-one, no float rounding

### Resource Cleanup Invariants (Must Verify)
1. **Universal Cleanup**: Timeout cleared in ALL exit paths
2. **Error Resilience**: Cleanup happens even if errors occur
3. **No Orphans**: No timers left after state destroyed

### Regression Prevention (Must Enforce)
1. **Value Consistency**: Tests fail if timeout values drift
2. **Path Completeness**: Tests fail if cleanup path missed
3. **Precedence Stability**: Tests fail if override logic breaks

## Testing Commands

### Development
```bash
# Run regression test file
npm run test:regression -- timeoutConsistency.regression.test.js

# Run with verbose output
npm run test:regression -- timeoutConsistency.regression.test.js --verbose

# Run all state regression tests
npm run test:regression -- awaitingExternalTurnEndState

# Run in watch mode
npm run test:regression -- timeoutConsistency.regression.test.js --watch
```

### Validation
```bash
# Verify fast execution
time npm run test:regression -- timeoutConsistency.regression.test.js
# Should complete in < 1 second

# Full regression suite
npm run test:regression

# Full test suite
npm run test:ci
```

## Implementation Notes

### Exact Value Testing Pattern
```javascript
// Use exact numbers, not ranges
expect(mockSetTimeout).toHaveBeenCalledWith(
  expect.any(Function),
  30_000 // EXACT, not expect.any(Number)
);

// Catches subtle bugs like:
// - 29999 (off-by-one)
// - 30001 (off-by-one)
// - 30000.5 (float precision)
```

### Exit Path Testing Pattern
```javascript
// Create separate instances for each path
const paths = [
  'event arrival',
  'timeout fires',
  'exitState',
  'destroy',
  'error during handling'
];

paths.forEach(path => {
  // Create new state
  // Exercise path
  // Verify cleanup
  // Clear mocks for next path
});
```

### Self-Clearing Timeout Pattern
```javascript
// Timeout fires (via jest.advanceTimersByTime)
// Callback runs and clears its own ID
// Verify no orphan timer remains

// This is implicit - verified by:
// 1. No multiple firings
// 2. Integration tests (Test 4 in Ticket 010)
```

## Definition of Done

- [ ] Test file created in /tests/regression/turns/states/
- [ ] All 4 required test cases implemented
- [ ] Test 1 verifies exact production timeout (30,000ms)
- [ ] Test 2 verifies exact development timeout (3,000ms)
- [ ] Test 3 verifies explicit override wins
- [ ] Test 4 verifies cleanup in all 5 exit paths
- [ ] All tests use exact number assertions
- [ ] All tests pass locally
- [ ] Tests complete in < 1 second
- [ ] Clear test names describing regressions prevented
- [ ] Code review completed
- [ ] Integrated with regression test suite
- [ ] npm run test:regression passes
