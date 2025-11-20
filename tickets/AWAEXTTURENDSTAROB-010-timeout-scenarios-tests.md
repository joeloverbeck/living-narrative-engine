# AWAEXTTURENDSTAROB-010: Add Timeout Scenarios Integration Tests

## Metadata
- **Ticket ID:** AWAEXTTURENDSTAROB-010
- **Phase:** 2 - Standard Patterns
- **Priority:** Medium
- **Estimated Effort:** 2-3 hours
- **Dependencies:** AWAEXTTURENDSTAROB-007 (must complete first)

## Objective

Create end-to-end integration tests that verify timeout behavior works correctly with different configurations, including timeout firing, event arrival preventing timeout, and resource cleanup at scale.

## Files to Create

### New Test File
- `tests/integration/turns/states/awaitingExternalTurnEndState.timeoutScenarios.integration.test.js` (NEW)

## Test Structure Required

### File Organization
```javascript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import AwaitingExternalTurnEndState from '../../../../src/turns/states/awaitingExternalTurnEndState.js';
import { TestEnvironmentProvider } from '../../../../src/environment/TestEnvironmentProvider.js';
import { TURN_ENDED_ID, SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/events/eventIds.js';

describe('AwaitingExternalTurnEndState - Timeout Scenarios Integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Timeout Firing Scenarios', () => {
    // Tests 1-2
  });

  describe('Event Arrival Scenarios', () => {
    // Test 3
  });

  describe('Resource Cleanup at Scale', () => {
    // Test 4
  });
});
```

## Required Test Cases (Minimum 4)

### Test 1: Production Timeout Fires at 30 Seconds
```javascript
it('should fire timeout at 30 seconds with production configuration', () => {
  // Arrange
  const productionProvider = new TestEnvironmentProvider({ IS_PRODUCTION: true });
  const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  const mockEventBus = {
    dispatch: jest.fn(),
    subscribe: jest.fn(() => 'subscription-id'),
  };
  const mockEndTurn = jest.fn();
  const mockContext = {
    actorId: 'test-actor',
    turn: { id: 'test-turn' },
  };

  const state = new AwaitingExternalTurnEndState({
    context: mockContext,
    logger: mockLogger,
    eventBus: mockEventBus,
    endTurn: mockEndTurn,
    environmentProvider: productionProvider,
    // Use real setTimeout/clearTimeout (faked by Jest)
  });

  // Act
  state.enterState();

  // Advance timers to 30 seconds
  jest.advanceTimersByTime(30_000);

  // Assert
  expect(mockEventBus.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: SYSTEM_ERROR_OCCURRED_ID,
      payload: expect.objectContaining({
        error: expect.stringMatching(/timeout/i),
      }),
    })
  );
  expect(mockEndTurn).toHaveBeenCalledWith(
    expect.objectContaining({
      code: 'TURN_END_TIMEOUT',
    })
  );
});
```

### Test 2: Development Timeout Fires at 3 Seconds
```javascript
it('should fire timeout at 3 seconds with development configuration', () => {
  // Arrange
  const developmentProvider = new TestEnvironmentProvider({ IS_PRODUCTION: false });
  const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  const mockEventBus = {
    dispatch: jest.fn(),
    subscribe: jest.fn(() => 'subscription-id'),
  };
  const mockEndTurn = jest.fn();
  const mockContext = {
    actorId: 'dev-actor',
    turn: { id: 'dev-turn' },
  };

  const state = new AwaitingExternalTurnEndState({
    context: mockContext,
    logger: mockLogger,
    eventBus: mockEventBus,
    endTurn: mockEndTurn,
    environmentProvider: developmentProvider,
  });

  // Act
  state.enterState();

  // Advance timers to 3 seconds (NOT 30 seconds)
  jest.advanceTimersByTime(3_000);

  // Assert
  expect(mockEventBus.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: SYSTEM_ERROR_OCCURRED_ID,
    })
  );
  expect(mockEndTurn).toHaveBeenCalledWith(
    expect.objectContaining({
      code: 'TURN_END_TIMEOUT',
    })
  );

  // Verify timeout fired at 3s, not 30s
  // Advance to 30s - should not trigger again
  jest.advanceTimersByTime(27_000); // Total 30s
  expect(mockEndTurn).toHaveBeenCalledTimes(1); // Only once, at 3s
});
```

### Test 3: Event Arrival Prevents Timeout
```javascript
it('should clear timeout when turn end event arrives before timeout', () => {
  // Arrange
  const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  let turnEndedCallback;
  const mockEventBus = {
    dispatch: jest.fn(),
    subscribe: jest.fn((eventType, callback) => {
      if (eventType === TURN_ENDED_ID) {
        turnEndedCallback = callback;
      }
      return 'subscription-id';
    }),
  };
  const mockEndTurn = jest.fn();
  const mockContext = {
    actorId: 'test-actor',
    turn: { id: 'test-turn' },
  };

  const state = new AwaitingExternalTurnEndState({
    context: mockContext,
    logger: mockLogger,
    eventBus: mockEventBus,
    endTurn: mockEndTurn,
    timeoutMs: 5_000, // 5 second timeout
  });

  // Act
  state.enterState();

  // Advance time by 2 seconds (before 5s timeout)
  jest.advanceTimersByTime(2_000);

  // Simulate turn end event arriving
  turnEndedCallback({
    type: TURN_ENDED_ID,
    payload: { actorId: 'test-actor' },
  });

  // Advance time past original timeout
  jest.advanceTimersByTime(5_000); // Total 7s, past 5s timeout

  // Assert
  expect(mockEndTurn).not.toHaveBeenCalled();
  // Turn already ended via event, timeout should not fire
  expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(
    expect.objectContaining({
      type: SYSTEM_ERROR_OCCURRED_ID,
    })
  );
  // Timeout was cleared when event arrived
});
```

### Test 4: Resource Cleanup at Scale (100 Instances)
```javascript
it('should clean up resources correctly across 100 state instances', () => {
  // Arrange
  const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  const subscriptionIds = new Set();
  let subscriptionCount = 0;
  const mockEventBus = {
    dispatch: jest.fn(),
    subscribe: jest.fn((eventType, callback) => {
      const id = `subscription-${subscriptionCount++}`;
      subscriptionIds.add(id);
      return id;
    }),
    unsubscribe: jest.fn((id) => {
      subscriptionIds.delete(id);
    }),
  };

  const states = [];

  // Act - Create 100 instances
  for (let i = 0; i < 100; i++) {
    const state = new AwaitingExternalTurnEndState({
      context: { actorId: `actor-${i}`, turn: { id: `turn-${i}` } },
      logger: mockLogger,
      eventBus: mockEventBus,
      endTurn: jest.fn(),
      timeoutMs: 1_000, // 1 second timeout
    });

    state.enterState();
    states.push(state);
  }

  // Assert - 100 subscriptions created
  expect(subscriptionCount).toBe(100);
  expect(subscriptionIds.size).toBe(100);

  // Act - Destroy all instances
  states.forEach(state => state.destroy());

  // Assert - All subscriptions cleaned up
  expect(subscriptionIds.size).toBe(0);
  expect(mockEventBus.unsubscribe).toHaveBeenCalledTimes(100);

  // Advance timers past timeout - no orphan timers should fire
  jest.advanceTimersByTime(2_000);

  // No timeout callbacks should fire (all cleared by destroy)
  const errorDispatches = mockEventBus.dispatch.mock.calls.filter(
    call => call[0]?.type === SYSTEM_ERROR_OCCURRED_ID
  );
  expect(errorDispatches.length).toBe(0);
});
```

## Out of Scope

### Must NOT Include
- Timeout consistency tests (Ticket 011)
- Property-based tests (Phase 3)
- Performance benchmarks (beyond basic scale test)
- Memory leak detection (separate concern, Test 4 just verifies cleanup)
- Provider-specific tests (Ticket 009)
- Unit-level timer tests (existing unit tests)

### Must NOT Change
- Production code (already updated in Ticket 007)
- Timer implementations
- Event handling logic
- Other test files

## Acceptance Criteria

### AC1: All 4 Test Cases Pass
```javascript
// GIVEN: Integration test suite with 4 test cases
// WHEN: npm run test:integration -- timeoutScenarios.integration.test.js
// THEN:
//   ✓ All tests pass
//   ✓ Tests use fake timers (jest.useFakeTimers)
//   ✓ Tests complete quickly (<2 seconds total)
```

### AC2: Production Timeout Verified End-to-End
```javascript
// GIVEN: Test 1 with production configuration
// WHEN: Fake timers advanced to 30 seconds
// THEN:
//   ✓ Timeout callback fires exactly at 30s
//   ✓ SYSTEM_ERROR_OCCURRED event dispatched
//   ✓ endTurn called with TURN_END_TIMEOUT
//   ✓ Cleanup completes successfully
```

### AC3: Development Timeout Verified
```javascript
// GIVEN: Test 2 with development configuration
// WHEN: Fake timers advanced to 3 seconds
// THEN:
//   ✓ Timeout fires at 3s (not 30s)
//   ✓ Error event dispatched
//   ✓ endTurn called
//   ✓ Advancing to 30s doesn't fire timeout again
```

### AC4: Event Prevents Timeout
```javascript
// GIVEN: Test 3 with 5s timeout
// WHEN: Event arrives at 2s, timers advance to 7s
// THEN:
//   ✓ Timeout cleared when event arrives
//   ✓ No timeout callback fires past 5s
//   ✓ No error event dispatched
//   ✓ endTurn not called (turn ended via event)
```

### AC5: Scale Cleanup Verified
```javascript
// GIVEN: Test 4 with 100 instances
// WHEN: All instances created, entered, and destroyed
// THEN:
//   ✓ 100 subscriptions created
//   ✓ 100 subscriptions cleaned up
//   ✓ No orphan timers remain
//   ✓ No timeout callbacks fire after destroy
//   ✓ Memory stable (no leaks - verified by cleanup counts)
```

## Invariants

### Timeout Guarantees (Must Verify)
1. **Bounded Wait**: Turn ends within timeout period
2. **Cleanup After Fire**: Timeout callback clears its own ID
3. **No Orphan Timers**: Timer cleared in all exit paths
4. **Correct Duration**: Production=30s, Development=3s, Custom=specified

### Resource Cleanup Guarantees (Must Verify)
1. **Event Listener Cleanup**: Unsubscribe called for all subscriptions
2. **Timer Cleanup**: No timers remain after destroy
3. **Scale Stability**: Cleanup works for many instances
4. **No Double-Cleanup**: Cleanup safe to call multiple times

### Test Quality Standards (Must Maintain)
1. **Fake Timers**: All tests use jest.useFakeTimers
2. **Fast**: Tests complete in <2 seconds total
3. **Deterministic**: No race conditions, predictable results
4. **Clear**: Test names describe exact scenario

## Testing Commands

### Development
```bash
# Run timeout scenarios test
npm run test:integration -- timeoutScenarios.integration.test.js

# Run with verbose output
npm run test:integration -- timeoutScenarios.integration.test.js --verbose

# Run all state integration tests
npm run test:integration -- awaitingExternalTurnEndState

# Run in watch mode
npm run test:integration -- timeoutScenarios.integration.test.js --watch
```

### Validation
```bash
# Verify fast execution with fake timers
time npm run test:integration -- timeoutScenarios.integration.test.js
# Should complete in < 2 seconds

# Full integration suite
npm run test:integration

# Full test suite
npm run test:ci
```

## Implementation Notes

### Fake Timers Pattern
```javascript
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// In test:
jest.advanceTimersByTime(30_000); // Advance 30 seconds instantly
```

### Event Callback Capture Pattern
```javascript
let capturedCallback;
const mockEventBus = {
  subscribe: jest.fn((eventType, callback) => {
    if (eventType === TURN_ENDED_ID) {
      capturedCallback = callback;
    }
    return 'sub-id';
  }),
};

// Later: simulate event
capturedCallback({ type: TURN_ENDED_ID, payload: {...} });
```

### Scale Test Pattern
```javascript
// Track resource creation
const createdResources = new Set();

// Create many instances
for (let i = 0; i < 100; i++) {
  const state = createState();
  state.enterState();
  states.push(state);
}

// Verify resources created
expect(createdResources.size).toBe(100);

// Cleanup
states.forEach(s => s.destroy());

// Verify resources cleaned
expect(createdResources.size).toBe(0);
```

## Definition of Done

- [ ] Test file created in /tests/integration/turns/states/
- [ ] All 4 required test cases implemented
- [ ] Test 1 verifies production timeout (30s)
- [ ] Test 2 verifies development timeout (3s)
- [ ] Test 3 verifies event prevents timeout
- [ ] Test 4 verifies cleanup at scale (100 instances)
- [ ] All tests use fake timers
- [ ] All tests pass locally
- [ ] Tests complete in < 2 seconds
- [ ] Clear test names describing scenarios
- [ ] Code review completed
- [ ] Integrated with integration test suite
- [ ] npm run test:integration passes
