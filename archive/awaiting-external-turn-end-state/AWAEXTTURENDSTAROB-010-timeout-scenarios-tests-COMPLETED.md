# AWAEXTTURENDSTAROB-010: Add Timeout Scenarios Integration Tests

## Metadata

- **Ticket ID:** AWAEXTTURENDSTAROB-010
- **Phase:** 2 - Standard Patterns
- **Priority:** Medium
- **Estimated Effort:** 2-3 hours
- **Dependencies:** AWAEXTTURENDSTAROB-007 (must complete first)
- **Status:** ✅ COMPLETED

## Objective

Create end-to-end integration tests that verify timeout behavior works correctly with different configurations, including timeout firing, event arrival preventing timeout, and resource cleanup at scale.

## Files to Create

### New Test File

- `tests/integration/turns/states/awaitingExternalTurnEndState.timeoutScenarios.integration.test.js` (NEW)

## CORRECTED ASSUMPTIONS (Updated after code review)

### Constructor Pattern

```javascript
// ✅ CORRECT: Handler-based pattern with options object
const handler = new TestTurnHandler({ logger, dispatcher });
const state = new AwaitingExternalTurnEndState(handler, {
  timeoutMs: 5_000, // Optional override
  environmentProvider: testProvider, // Optional DI
  setTimeoutFn: customSetTimeout, // Optional DI (for testing)
  clearTimeoutFn: customClearTimeout, // Optional DI (for testing)
});

// ❌ INCORRECT (from original ticket):
// new AwaitingExternalTurnEndState({ context, logger, eventBus, ... })
```

### Import Paths

```javascript
// ✅ CORRECT imports
import { TURN_ENDED_ID } from '../../../../src/constants/eventIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/systemEventIds.js';

// ❌ INCORRECT (from original ticket):
// import { TURN_ENDED_ID } from '../../../../src/events/eventIds.js';
```

### Event Structure

```javascript
// ✅ CORRECT: Events have { type, payload } structure
const turnEndedEvent = {
  type: TURN_ENDED_ID,
  payload: {
    entityId: 'actor-id',
    error: null,
  },
};

// Dispatch via eventBus
await eventBus.dispatch(TURN_ENDED_ID, { entityId: 'actor-id', error: null });

// ❌ INCORRECT (from original ticket):
// Direct payload access without type wrapper
```

### Test Setup Pattern

```javascript
// ✅ CORRECT: Use TestTurnHandler + TurnContext pattern
const logger = createMockLogger();
const eventBus = createEventBus({ captureEvents: true });
const safeDispatcher = new SafeEventDispatcher({
  validatedEventDispatcher: eventBus,
  logger,
});
const handler = new TestTurnHandler({ logger, dispatcher: safeDispatcher });
const onEndTurn = jest.fn();

const context = new TurnContext({
  actor: { id: 'test-actor' },
  logger,
  services: {
    safeEventDispatcher: safeDispatcher,
    turnEndPort: { signalTurnEnd: jest.fn() },
    entityManager: {
      getComponentData: jest.fn(),
      getEntityInstance: jest.fn(),
    },
  },
  strategy: {
    decideAction: jest.fn(),
    getMetadata: jest.fn(() => ({})),
    dispose: jest.fn(),
  },
  onEndTurnCallback: onEndTurn,
  handlerInstance: handler,
  onSetAwaitingExternalEventCallback: jest.fn(),
});

handler.setTurnContext(context);
```

### Timeout Configuration

```javascript
// ✅ CORRECT: Environment-based defaults
// Production: 30_000ms (30 seconds) - DEFAULT_TIMEOUT_PRODUCTION
// Development: 3_000ms (3 seconds) - DEFAULT_TIMEOUT_DEVELOPMENT
// Custom: Specify via options.timeoutMs

// Use TestEnvironmentProvider for DI
const productionProvider = new TestEnvironmentProvider({ IS_PRODUCTION: true });
const developmentProvider = new TestEnvironmentProvider({
  IS_PRODUCTION: false,
});
```

## Test Structure Required

### File Organization

```javascript
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { AwaitingExternalTurnEndState } from '../../../../src/turns/states/awaitingExternalTurnEndState.js';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import { TestEnvironmentProvider } from '../../../../src/configuration/TestEnvironmentProvider.js';
import { TURN_ENDED_ID } from '../../../../src/constants/eventIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/systemEventIds.js';
import { createEventBus } from '../../../common/mockFactories/eventBus.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

class TestTurnHandler {
  constructor({ logger, dispatcher }) {
    this._logger = logger;
    this._dispatcher = dispatcher;
    this.resetStateAndResources = jest.fn();
    this.requestIdleStateTransition = jest.fn();
  }
  setTurnContext(ctx) {
    this._context = ctx;
  }
  getTurnContext() {
    return this._context;
  }
  getLogger() {
    return this._logger;
  }
  getSafeEventDispatcher() {
    return this._dispatcher;
  }
}

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
it('should fire timeout at 30 seconds with production configuration', async () => {
  // Arrange
  const productionProvider = new TestEnvironmentProvider({
    IS_PRODUCTION: true,
  });
  const logger = createMockLogger();
  const eventBus = createEventBus({ captureEvents: true });
  const safeDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher: eventBus,
    logger,
  });
  const handler = new TestTurnHandler({ logger, dispatcher: safeDispatcher });
  const onEndTurn = jest.fn();

  const context = new TurnContext({
    actor: { id: 'test-actor' },
    logger,
    services: {
      safeEventDispatcher: safeDispatcher,
      turnEndPort: { signalTurnEnd: jest.fn() },
      entityManager: {
        getComponentData: jest.fn(),
        getEntityInstance: jest.fn(),
      },
    },
    strategy: {
      decideAction: jest.fn(),
      getMetadata: jest.fn(() => ({})),
      dispose: jest.fn(),
    },
    onEndTurnCallback: onEndTurn,
    handlerInstance: handler,
    onSetAwaitingExternalEventCallback: jest.fn(),
  });

  handler.setTurnContext(context);

  const state = new AwaitingExternalTurnEndState(handler, {
    environmentProvider: productionProvider,
  });

  // Act
  await state.enterState(handler, null);

  // Advance timers to 30 seconds
  await jest.advanceTimersByTimeAsync(30_000);

  // Assert
  const systemErrors = eventBus.events.filter(
    (event) => event.eventType === SYSTEM_ERROR_OCCURRED_ID
  );
  expect(systemErrors).toHaveLength(1);
  expect(systemErrors[0].payload.details.actorId).toBe('test-actor');

  expect(onEndTurn).toHaveBeenCalledTimes(1);
  const timeoutError = onEndTurn.mock.calls[0][0];
  expect(timeoutError).toBeInstanceOf(Error);
  expect(timeoutError.code).toBe('TURN_END_TIMEOUT');
  expect(timeoutError.message).toContain('30000');
});
```

### Test 2: Development Timeout Fires at 3 Seconds

```javascript
it('should fire timeout at 3 seconds with development configuration', async () => {
  // Arrange
  const developmentProvider = new TestEnvironmentProvider({
    IS_PRODUCTION: false,
  });
  const logger = createMockLogger();
  const eventBus = createEventBus({ captureEvents: true });
  const safeDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher: eventBus,
    logger,
  });
  const handler = new TestTurnHandler({ logger, dispatcher: safeDispatcher });
  const onEndTurn = jest.fn();

  const context = new TurnContext({
    actor: { id: 'dev-actor' },
    logger,
    services: {
      safeEventDispatcher: safeDispatcher,
      turnEndPort: { signalTurnEnd: jest.fn() },
      entityManager: {
        getComponentData: jest.fn(),
        getEntityInstance: jest.fn(),
      },
    },
    strategy: {
      decideAction: jest.fn(),
      getMetadata: jest.fn(() => ({})),
      dispose: jest.fn(),
    },
    onEndTurnCallback: onEndTurn,
    handlerInstance: handler,
    onSetAwaitingExternalEventCallback: jest.fn(),
  });

  handler.setTurnContext(context);

  const state = new AwaitingExternalTurnEndState(handler, {
    environmentProvider: developmentProvider,
  });

  // Act
  await state.enterState(handler, null);

  // Advance timers to 3 seconds (NOT 30 seconds)
  await jest.advanceTimersByTimeAsync(3_000);

  // Assert
  expect(onEndTurn).toHaveBeenCalledTimes(1);
  const timeoutError = onEndTurn.mock.calls[0][0];
  expect(timeoutError).toBeInstanceOf(Error);
  expect(timeoutError.code).toBe('TURN_END_TIMEOUT');

  // Verify timeout fired at 3s, not 30s
  // Advance to 30s - should not trigger again
  await jest.advanceTimersByTimeAsync(27_000); // Total 30s
  expect(onEndTurn).toHaveBeenCalledTimes(1); // Only once, at 3s
});
```

### Test 3: Event Arrival Prevents Timeout

```javascript
it('should clear timeout when turn end event arrives before timeout', async () => {
  // Arrange
  const logger = createMockLogger();
  const eventBus = createEventBus({ captureEvents: true });
  const safeDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher: eventBus,
    logger,
  });
  const handler = new TestTurnHandler({ logger, dispatcher: safeDispatcher });
  const onEndTurn = jest.fn();

  const context = new TurnContext({
    actor: { id: 'test-actor' },
    logger,
    services: {
      safeEventDispatcher: safeDispatcher,
      turnEndPort: { signalTurnEnd: jest.fn() },
      entityManager: {
        getComponentData: jest.fn(),
        getEntityInstance: jest.fn(),
      },
    },
    strategy: {
      decideAction: jest.fn(),
      getMetadata: jest.fn(() => ({})),
      dispose: jest.fn(),
    },
    onEndTurnCallback: onEndTurn,
    handlerInstance: handler,
    onSetAwaitingExternalEventCallback: jest.fn(),
  });

  handler.setTurnContext(context);

  const state = new AwaitingExternalTurnEndState(handler, {
    timeoutMs: 5_000, // 5 second timeout
  });

  // Act
  await state.enterState(handler, null);

  // Advance time by 2 seconds (before 5s timeout)
  await jest.advanceTimersByTimeAsync(2_000);

  // Simulate turn end event arriving
  await eventBus.dispatch(TURN_ENDED_ID, {
    entityId: 'test-actor',
    error: null,
  });

  // Advance time past original timeout
  await jest.advanceTimersByTimeAsync(5_000); // Total 7s, past 5s timeout

  // Assert
  expect(onEndTurn).toHaveBeenCalledTimes(1); // Called by event, not timeout

  // No timeout error should be dispatched
  const systemErrors = eventBus.events.filter(
    (event) => event.eventType === SYSTEM_ERROR_OCCURRED_ID
  );
  expect(systemErrors).toHaveLength(0);

  // Verify turn ended via event, not timeout
  expect(onEndTurn).toHaveBeenCalledWith(null); // No error from event
});
```

### Test 4: Resource Cleanup at Scale (100 Instances)

```javascript
it('should clean up resources correctly across 100 state instances', async () => {
  // Arrange
  const logger = createMockLogger();
  const eventBus = createEventBus({ captureEvents: true });
  const safeDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher: eventBus,
    logger,
  });

  const states = [];
  const handlers = [];
  const contexts = [];

  // Act - Create 100 instances
  for (let i = 0; i < 100; i++) {
    const handler = new TestTurnHandler({ logger, dispatcher: safeDispatcher });
    const onEndTurn = jest.fn();

    const context = new TurnContext({
      actor: { id: `actor-${i}` },
      logger,
      services: {
        safeEventDispatcher: safeDispatcher,
        turnEndPort: { signalTurnEnd: jest.fn() },
        entityManager: {
          getComponentData: jest.fn(),
          getEntityInstance: jest.fn(),
        },
      },
      strategy: {
        decideAction: jest.fn(),
        getMetadata: jest.fn(() => ({})),
        dispose: jest.fn(),
      },
      onEndTurnCallback: onEndTurn,
      handlerInstance: handler,
      onSetAwaitingExternalEventCallback: jest.fn(),
    });

    handler.setTurnContext(context);

    const state = new AwaitingExternalTurnEndState(handler, {
      timeoutMs: 1_000, // 1 second timeout
    });

    await state.enterState(handler, null);

    states.push(state);
    handlers.push(handler);
    contexts.push(context);
  }

  // Assert - 100 subscriptions created
  expect(eventBus.listenerCount(TURN_ENDED_ID)).toBe(100);

  // Verify all contexts are awaiting
  contexts.forEach((ctx) => {
    expect(ctx.isAwaitingExternalEvent()).toBe(true);
  });

  // Act - Destroy all instances
  for (let i = 0; i < 100; i++) {
    await states[i].destroy(handlers[i]);
  }

  // Assert - All subscriptions cleaned up
  expect(eventBus.listenerCount(TURN_ENDED_ID)).toBe(0);

  // All contexts should no longer be awaiting
  contexts.forEach((ctx) => {
    expect(ctx.isAwaitingExternalEvent()).toBe(false);
  });

  // Advance timers past timeout - no orphan timers should fire
  await jest.advanceTimersByTimeAsync(2_000);

  // No timeout callbacks should fire (all cleared by destroy)
  const systemErrors = eventBus.events.filter(
    (event) => event.eventType === SYSTEM_ERROR_OCCURRED_ID
  );
  expect(systemErrors.length).toBe(0);
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
//   ✓ onEndTurn called with TURN_END_TIMEOUT error
//   ✓ Cleanup completes successfully
```

### AC3: Development Timeout Verified

```javascript
// GIVEN: Test 2 with development configuration
// WHEN: Fake timers advanced to 3 seconds
// THEN:
//   ✓ Timeout fires at 3s (not 30s)
//   ✓ Error event dispatched
//   ✓ onEndTurn called
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
//   ✓ onEndTurn called with null (turn ended via event)
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
await jest.advanceTimersByTimeAsync(30_000); // Advance 30 seconds instantly
```

### Event Dispatch Pattern

```javascript
// Dispatch turn ended event
await eventBus.dispatch(TURN_ENDED_ID, {
  entityId: 'actor-id',
  error: null,
});

// Check dispatched events
const systemErrors = eventBus.events.filter(
  (event) => event.eventType === SYSTEM_ERROR_OCCURRED_ID
);
```

### Scale Test Pattern

```javascript
// Track resource creation
const states = [];
const handlers = [];
const contexts = [];

// Create many instances
for (let i = 0; i < 100; i++) {
  const handler = new TestTurnHandler({ logger, dispatcher: safeDispatcher });
  const context = new TurnContext({
    /* ... */
  });
  handler.setTurnContext(context);
  const state = new AwaitingExternalTurnEndState(handler, { timeoutMs: 1_000 });
  await state.enterState(handler, null);

  states.push(state);
  handlers.push(handler);
  contexts.push(context);
}

// Verify resources created
expect(eventBus.listenerCount(TURN_ENDED_ID)).toBe(100);

// Cleanup
for (let i = 0; i < 100; i++) {
  await states[i].destroy(handlers[i]);
}

// Verify resources cleaned
expect(eventBus.listenerCount(TURN_ENDED_ID)).toBe(0);
```

## Definition of Done

- [x] Test file created in /tests/integration/turns/states/
- [x] All 4 required test cases implemented
- [x] Test 1 verifies production timeout (30s)
- [x] Test 2 verifies development timeout (3s)
- [x] Test 3 verifies event prevents timeout
- [x] Test 4 verifies cleanup at scale (100 instances)
- [x] All tests use fake timers
- [x] All tests pass locally
- [x] Tests complete in < 2 seconds
- [x] Clear test names describing scenarios
- [x] Code review completed
- [x] Integrated with integration test suite
- [x] npm run test:integration passes

## Outcome

**Implementation Status**: ✅ COMPLETE

**Files Created**:

- `tests/integration/turns/states/awaitingExternalTurnEndState.timeoutScenarios.integration.test.js`

**What Was Changed**:

1. Created comprehensive timeout scenarios integration test file with 4 test cases
2. All tests use fake timers for fast, deterministic execution
3. Tests verify production (30s) and development (3s) timeout configurations
4. Tests verify event arrival prevents timeout firing
5. Tests verify resource cleanup at scale (100 instances)

**Differences from Original Plan**:

1. **Constructor pattern corrected**: Updated from direct parameter injection to handler-based pattern
2. **Import paths corrected**: Fixed event ID import paths to match actual code structure
3. **Event structure corrected**: Updated to use `{ type, payload }` event structure with `eventBus.dispatch(type, payload)`
4. **Test setup pattern corrected**: Used actual `TestTurnHandler` and `TurnContext` pattern from existing tests
5. **Async timer advancement**: Used `jest.advanceTimersByTimeAsync()` for proper async handling
6. **Event bus verification**: Used `eventBus.listenerCount()` for subscription tracking instead of manual set

**Test Results**:

- All 4 test cases pass ✅
- Tests complete in <2 seconds ✅
- Fake timers used correctly ✅
- No production code changes needed ✅
- Integration test suite passes ✅
