# AWAEXTTURENDSTAROB-006: Add Module-Level Evaluation Regression Test

## Metadata
- **Ticket ID:** AWAEXTTURENDSTAROB-006
- **Phase:** 1 - Minimal Change
- **Priority:** Medium
- **Estimated Effort:** 2 hours
- **Dependencies:** AWAEXTTURENDSTAROB-001 (must complete first)

## Objective

Create regression tests that prevent return to module-level constant evaluation patterns. These tests verify that environment changes are respected without module isolation, proving the fix works and preventing future regressions.

## Files to Create

### New Test File
- `tests/regression/turns/states/awaitingExternalTurnEndState.environmentDetection.regression.test.js` (NEW)

## Test Structure Required

### File Organization
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AwaitingExternalTurnEndState from '../../../../src/turns/states/awaitingExternalTurnEndState.js';

describe('AwaitingExternalTurnEndState - Environment Detection Regression', () => {
  let originalNodeEnv;
  let mockSetTimeout;
  let mockClearTimeout;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    mockSetTimeout = jest.fn((fn, ms) => `timeout-${ms}`);
    mockClearTimeout = jest.fn();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('No Module-Level Constant Evaluation', () => {
    // Tests 1-2
  });

  describe('Jest Environment Compatibility', () => {
    // Test 3
  });

  describe('Browser Environment Handling', () => {
    // Test 4
  });
});
```

## Required Test Cases (Minimum 4)

### Test 1: Multiple Instances with Different Environments (No Isolation)
```javascript
it('should respect environment changes between instances without module isolation', () => {
  // Arrange - Create first instance in production
  process.env.NODE_ENV = 'production';
  const mockLogger1 = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  const mockEventBus1 = {
    dispatch: jest.fn(),
    subscribe: jest.fn(() => 'sub-1'),
  };

  const state1 = new AwaitingExternalTurnEndState({
    context: { actorId: 'actor1', turn: { id: 'turn1' } },
    logger: mockLogger1,
    eventBus: mockEventBus1,
    endTurn: jest.fn(),
    setTimeoutFn: mockSetTimeout,
    clearTimeoutFn: mockClearTimeout,
  });

  state1.enterState();

  // Assert first instance uses production timeout
  expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 30_000);

  // Act - Change environment and create second instance
  process.env.NODE_ENV = 'development';
  mockSetTimeout.mockClear(); // Clear previous calls

  const mockLogger2 = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  const mockEventBus2 = {
    dispatch: jest.fn(),
    subscribe: jest.fn(() => 'sub-2'),
  };

  const state2 = new AwaitingExternalTurnEndState({
    context: { actorId: 'actor2', turn: { id: 'turn2' } },
    logger: mockLogger2,
    eventBus: mockEventBus2,
    endTurn: jest.fn(),
    setTimeoutFn: mockSetTimeout,
    clearTimeoutFn: mockClearTimeout,
  });

  state2.enterState();

  // Assert second instance uses development timeout
  expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 3_000);

  // Verify no module-level constant was used
  // (If module-level constant existed, both would use same timeout)
});
```

### Test 2: Jest Environment Works Without Module Isolation
```javascript
it('should work correctly in Jest test environment without jest.isolateModulesAsync', () => {
  // Arrange - Set Jest default test environment
  process.env.NODE_ENV = 'test';

  const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  const mockEventBus = {
    dispatch: jest.fn(),
    subscribe: jest.fn(() => 'subscription-id'),
  };

  // Act - Create state directly (no isolation wrapper)
  const state = new AwaitingExternalTurnEndState({
    context: { actorId: 'test-actor', turn: { id: 'test-turn' } },
    logger: mockLogger,
    eventBus: mockEventBus,
    endTurn: jest.fn(),
    setTimeoutFn: mockSetTimeout,
    clearTimeoutFn: mockClearTimeout,
  });

  state.enterState();

  // Assert - Test environment treated as development (3s timeout)
  expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 3_000);

  // Verify no jest.isolateModulesAsync needed
  // Verify no cache busting required
  // (This test itself proves both by running successfully)
});
```

### Test 3: Browser Environment (No process global)
```javascript
it('should default to production timeout in browser environment without process global', () => {
  // Arrange - Simulate browser environment
  const originalProcess = global.process;
  delete global.process; // Remove Node.js process global

  try {
    const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
    const mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(() => 'subscription-id'),
    };

    // Act - Create state without process global
    const state = new AwaitingExternalTurnEndState({
      context: { actorId: 'browser-actor', turn: { id: 'browser-turn' } },
      logger: mockLogger,
      eventBus: mockEventBus,
      endTurn: jest.fn(),
      setTimeoutFn: mockSetTimeout,
      clearTimeoutFn: mockClearTimeout,
    });

    state.enterState();

    // Assert - Falls back to production timeout (fail-safe)
    expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 30_000);

    // Verify no reference errors
    // Verify graceful degradation to safe default
  } finally {
    // Cleanup - Restore process global
    global.process = originalProcess;
  }
});
```

### Test 4: Multiple Instances with Alternating Environments
```javascript
it('should create multiple instances with alternating environment configs correctly', () => {
  // Arrange - Create array to track timeouts
  const timeouts = [];
  const localMockSetTimeout = jest.fn((fn, ms) => {
    timeouts.push(ms);
    return `timeout-${ms}`;
  });

  // Act - Create 5 instances alternating between production and development
  for (let i = 0; i < 5; i++) {
    process.env.NODE_ENV = i % 2 === 0 ? 'production' : 'development';

    const state = new AwaitingExternalTurnEndState({
      context: { actorId: `actor-${i}`, turn: { id: `turn-${i}` } },
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
      eventBus: {
        dispatch: jest.fn(),
        subscribe: jest.fn(() => `sub-${i}`),
      },
      endTurn: jest.fn(),
      setTimeoutFn: localMockSetTimeout,
      clearTimeoutFn: mockClearTimeout,
    });

    state.enterState();
  }

  // Assert - Verify alternating pattern
  expect(timeouts).toEqual([
    30_000, // 0: production
    3_000,  // 1: development
    30_000, // 2: production
    3_000,  // 3: development
    30_000, // 4: production
  ]);

  // Verify each instance gets correct environment-based timeout
  // Verify no single module-level constant used for all
});
```

## Out of Scope

### Must NOT Include
- Timer consistency tests (Ticket 011)
- Environment provider tests (Phase 2)
- Property-based tests (Phase 3)
- Timeout firing tests (integration tests)
- Performance benchmarks
- Memory leak detection (separate concern)

### Must NOT Change
- Existing regression test files
- Production code (tests only)
- Test utilities

## Acceptance Criteria

### AC1: All 4 Test Cases Pass
```javascript
// GIVEN: Regression test suite with 4 test cases
// WHEN: npm run test:regression -- environmentDetection.regression.test.js
// THEN:
//   ✓ All 4 tests pass
//   ✓ Test completes in < 1 second
//   ✓ No real timers used
```

### AC2: Proves No Module-Level Evaluation
```javascript
// GIVEN: Test 1 (multiple instances with environment changes)
// WHEN: Executed successfully
// THEN:
//   ✓ First instance uses production timeout
//   ✓ Second instance uses development timeout
//   ✓ No jest.isolateModulesAsync used
//   ✓ No cache busting required
//   ✓ Environment change respected
```

### AC3: Jest Compatibility Verified
```javascript
// GIVEN: Test 2 (Jest environment test)
// WHEN: Executed in Jest test environment
// THEN:
//   ✓ NODE_ENV=test works correctly
//   ✓ No module isolation needed
//   ✓ Test passes without complex workarounds
```

### AC4: Browser Environment Handled
```javascript
// GIVEN: Test 3 (browser simulation)
// WHEN: process global deleted
// THEN:
//   ✓ No reference errors thrown
//   ✓ Defaults to production timeout
//   ✓ State remains functional
//   ✓ Graceful degradation works
```

### AC5: Prevents Regression
```javascript
// GIVEN: Any future code changes to AwaitingExternalTurnEndState
// WHEN: Tests run after changes
// THEN:
//   ✓ If module-level constants reintroduced, Test 1 fails
//   ✓ If environment detection removed, Test 4 fails
//   ✓ If browser compatibility broken, Test 3 fails
//   ✓ Regression immediately detected
```

## Invariants

### Regression Prevention (Must Enforce)
1. **No Module Caching**: Tests prove module cache doesn't affect behavior
2. **Environment Respect**: Environment changes between instances work
3. **No Isolation Needed**: jest.isolateModulesAsync not required
4. **Browser Compatible**: Works without Node.js globals

### Test Quality (Must Maintain)
1. **Fast**: All tests complete in <1 second
2. **Isolated**: Each test independent
3. **Clear**: Test names explain regression being prevented
4. **Reproducible**: Tests deterministic, no flakiness

### Project Standards (Must Follow)
1. **Regression Directory**: Tests in /tests/regression/
2. **Mock Timers**: No real setTimeout/clearTimeout
3. **AAA Pattern**: Arrange, Act, Assert structure
4. **Cleanup**: Restore globals in finally blocks

## Testing Commands

### Development
```bash
# Run regression test file
npm run test:regression -- environmentDetection.regression.test.js

# Run all regression tests for state
npm run test:regression -- awaitingExternalTurnEndState

# Run with verbose output
npm run test:regression -- environmentDetection.regression.test.js --verbose

# Run in watch mode
npm run test:regression -- environmentDetection.regression.test.js --watch
```

### Validation
```bash
# Verify fast execution
time npm run test:regression -- environmentDetection.regression.test.js
# Should complete in < 1 second

# Full regression suite
npm run test:regression

# Full test suite (unit + integration + regression)
npm run test:ci
```

## Implementation Notes

### Test 3 Critical Pattern (Browser Simulation)
```javascript
// CRITICAL: Always restore global.process
const originalProcess = global.process;
delete global.process;

try {
  // Test code here
} finally {
  global.process = originalProcess; // MUST restore
}
```

### Why These Tests Matter
1. **Test 1**: Proves fix works (environment changes respected)
2. **Test 2**: Proves Jest compatibility (no workarounds needed)
3. **Test 3**: Proves browser compatibility (no Node.js assumptions)
4. **Test 4**: Proves stability (multiple instances work correctly)

### Regression Scenarios Prevented
- Accidentally reintroducing module-level constants
- Breaking Jest test environment compatibility
- Breaking browser environment support
- Environment detection failing silently

## Definition of Done

- [ ] Test file created in /tests/regression/turns/states/
- [ ] All 4 required test cases implemented
- [ ] Test 1 verifies no module-level evaluation
- [ ] Test 2 verifies Jest compatibility
- [ ] Test 3 verifies browser environment handling
- [ ] Test 4 verifies multiple instances work
- [ ] All tests pass locally
- [ ] Tests complete in < 1 second
- [ ] Global restoration in finally blocks (Test 3)
- [ ] Clear test names explaining regression
- [ ] Code review completed
- [ ] Integrated with regression test suite
- [ ] npm run test:regression passes
