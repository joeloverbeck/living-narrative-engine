# AWAEXTTURENDSTAROB-009: Add Environment Provider Integration Tests

## Metadata
- **Ticket ID:** AWAEXTTURENDSTAROB-009
- **Phase:** 2 - Standard Patterns
- **Priority:** Medium
- **Estimated Effort:** 2 hours
- **Dependencies:** AWAEXTTURENDSTAROB-007 (must complete first)

## Objective

Create integration tests that verify `environmentProvider` parameter works correctly with real provider implementations (`ProcessEnvironmentProvider`, `TestEnvironmentProvider`), including error handling and edge cases.

## Files to Create

### New Test File
- `tests/integration/turns/states/awaitingExternalTurnEndState.environmentProvider.integration.test.js` (NEW)

## Test Structure Required

### File Organization
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import AwaitingExternalTurnEndState from '../../../../src/turns/states/awaitingExternalTurnEndState.js';
import { ProcessEnvironmentProvider } from '../../../../src/environment/ProcessEnvironmentProvider.js';
import { TestEnvironmentProvider } from '../../../../src/environment/TestEnvironmentProvider.js';

describe('AwaitingExternalTurnEndState - Environment Provider Integration', () => {
  let mockSetTimeout;
  let mockClearTimeout;
  let mockLogger;
  let mockEventBus;
  let mockEndTurn;
  let mockContext;

  beforeEach(() => {
    mockSetTimeout = jest.fn((fn, ms) => `timeout-${ms}`);
    mockClearTimeout = jest.fn();
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
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

  describe('ProcessEnvironmentProvider Integration', () => {
    // Test 1
  });

  describe('TestEnvironmentProvider Integration', () => {
    // Test 2
  });

  describe('Provider Error Handling', () => {
    // Tests 3-4
  });
});
```

## Required Test Cases (Minimum 4)

### Test 1: ProcessEnvironmentProvider with Real NODE_ENV
```javascript
it('should use ProcessEnvironmentProvider to detect real environment', () => {
  // Arrange
  const realProvider = new ProcessEnvironmentProvider();
  const originalNodeEnv = process.env.NODE_ENV;

  try {
    // Set known environment
    process.env.NODE_ENV = 'production';

    // Act
    const state = new AwaitingExternalTurnEndState({
      context: mockContext,
      logger: mockLogger,
      eventBus: mockEventBus,
      endTurn: mockEndTurn,
      environmentProvider: realProvider, // Real provider
      setTimeoutFn: mockSetTimeout,
      clearTimeoutFn: mockClearTimeout,
    });

    state.enterState();

    // Assert
    expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 30_000);
    // ProcessEnvironmentProvider correctly detects production environment
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
});
```

### Test 2: TestEnvironmentProvider with Custom Configuration
```javascript
it('should use TestEnvironmentProvider for isolated test configuration', () => {
  // Arrange - Custom test timeout (5 seconds)
  const customTestProvider = new TestEnvironmentProvider({
    IS_PRODUCTION: false, // Development mode
  });

  // Act
  const state = new AwaitingExternalTurnEndState({
    context: mockContext,
    logger: mockLogger,
    eventBus: mockEventBus,
    endTurn: mockEndTurn,
    environmentProvider: customTestProvider,
    setTimeoutFn: mockSetTimeout,
    clearTimeoutFn: mockClearTimeout,
  });

  state.enterState();

  // Assert
  expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 3_000);
  // TestEnvironmentProvider provides isolated, predictable configuration
  // No dependency on system environment variables
});
```

### Test 3: Provider Throws Error - Graceful Fallback
```javascript
it('should gracefully handle provider throwing error with fallback to production timeout', () => {
  // Arrange - Provider that always throws
  const errorProvider = {
    getEnvironment: () => {
      throw new Error('Environment detection failed');
    },
  };

  // Act
  const state = new AwaitingExternalTurnEndState({
    context: mockContext,
    logger: mockLogger,
    eventBus: mockEventBus,
    endTurn: mockEndTurn,
    environmentProvider: errorProvider,
    setTimeoutFn: mockSetTimeout,
    clearTimeoutFn: mockClearTimeout,
  });

  state.enterState();

  // Assert
  expect(mockLogger.warn).toHaveBeenCalledWith(
    expect.stringMatching(/Environment provider failed/),
    expect.any(Error)
  );
  expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 30_000);
  // Falls back to production timeout (safe default)
  // State remains functional despite provider error
});
```

### Test 4: Provider Returns Malformed Data
```javascript
it('should handle provider returning invalid structure with fallback', () => {
  // Arrange - Provider returns invalid data
  const malformedProvider = {
    getEnvironment: () => null, // Invalid: should return object with IS_PRODUCTION
  };

  // Act
  const state = new AwaitingExternalTurnEndState({
    context: mockContext,
    logger: mockLogger,
    eventBus: mockEventBus,
    endTurn: mockEndTurn,
    environmentProvider: malformedProvider,
    setTimeoutFn: mockSetTimeout,
    clearTimeoutFn: mockClearTimeout,
  });

  state.enterState();

  // Assert
  expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 30_000);
  // Null-ish coalescing in #resolveDefaultTimeout handles null
  // Defaults to production timeout via IS_PRODUCTION ?? true
});
```

## Out of Scope

### Must NOT Include
- Timeout firing tests (Ticket 010)
- Timeout consistency tests (Ticket 011)
- Property-based tests (Phase 3)
- Provider implementation tests (test the providers themselves)
- Performance tests
- Memory leak tests

### Must NOT Change
- Provider implementations (ProcessEnvironmentProvider, TestEnvironmentProvider)
- `IEnvironmentProvider` interface
- Production code beyond what Ticket 007 already changed
- Other test files

## Acceptance Criteria

### AC1: All 4 Test Cases Pass
```javascript
// GIVEN: Integration test suite with 4 test cases
// WHEN: npm run test:integration -- environmentProvider.integration.test.js
// THEN:
//   ✓ All tests pass
//   ✓ Tests complete in < 1 second
//   ✓ No flakiness or intermittent failures
```

### AC2: ProcessEnvironmentProvider Integration Verified
```javascript
// GIVEN: Test 1 using real ProcessEnvironmentProvider
// WHEN: Test executed
// THEN:
//   ✓ Real provider instantiated and used
//   ✓ Provider detects actual NODE_ENV
//   ✓ Correct timeout based on real environment
//   ✓ No mocking of provider internals
```

### AC3: TestEnvironmentProvider Isolation Verified
```javascript
// GIVEN: Test 2 using TestEnvironmentProvider
// WHEN: Test executed
// THEN:
//   ✓ Test isolated from system environment
//   ✓ Provider configuration controls timeout
//   ✓ Predictable, repeatable results
//   ✓ No side effects on global state
```

### AC4: Error Handling Verified
```javascript
// GIVEN: Tests 3-4 with failing/invalid providers
// WHEN: Tests executed
// THEN:
//   ✓ Errors caught and logged
//   ✓ State defaults to production timeout
//   ✓ No constructor errors thrown
//   ✓ State remains functional
```

### AC5: Demonstrates DI Pattern Correctly
```javascript
// GIVEN: All integration tests
// WHEN: Code review performed
// THEN:
//   ✓ Tests inject providers via constructor
//   ✓ Tests verify behavior with different providers
//   ✓ Tests demonstrate substitutability (IEnvironmentProvider)
//   ✓ Pattern matches project's DI conventions
```

## Invariants

### Provider Integration Guarantees (Must Verify)
1. **ProcessEnvironmentProvider Works**: Real provider integrates correctly
2. **TestEnvironmentProvider Works**: Test provider provides isolation
3. **Error Tolerance**: Provider failures don't crash state
4. **Safe Defaults**: Invalid/failing providers use production timeout

### Test Quality Standards (Must Maintain)
1. **Integration Level**: Tests use real provider instances
2. **Fast**: All tests complete in <1 second
3. **Isolated**: Tests don't affect each other
4. **Clear**: Tests demonstrate provider usage patterns

### State Lifecycle Invariants (Must Maintain)
1. **Functional After Error**: Provider error doesn't prevent state creation
2. **Resource Cleanup**: Provider errors don't leak resources
3. **Timeout Set**: Timeout always set, even with provider errors

## Testing Commands

### Development
```bash
# Run integration test file
npm run test:integration -- environmentProvider.integration.test.js

# Run with verbose output
npm run test:integration -- environmentProvider.integration.test.js --verbose

# Run all state integration tests
npm run test:integration -- awaitingExternalTurnEndState

# Run in watch mode
npm run test:integration -- environmentProvider.integration.test.js --watch
```

### Validation
```bash
# Verify fast execution
time npm run test:integration -- environmentProvider.integration.test.js
# Should complete in < 1 second

# Full integration suite
npm run test:integration

# Full test suite
npm run test:ci
```

## Implementation Notes

### ProcessEnvironmentProvider Test Pattern
```javascript
// Arrange
const realProvider = new ProcessEnvironmentProvider();
const originalNodeEnv = process.env.NODE_ENV;

try {
  process.env.NODE_ENV = 'production'; // Set known value

  // Act
  const state = new AwaitingExternalTurnEndState({
    environmentProvider: realProvider,
    ...
  });

  // Assert
  // Verify behavior
} finally {
  process.env.NODE_ENV = originalNodeEnv; // Always restore
}
```

### Error Provider Test Pattern
```javascript
// Arrange
const errorProvider = {
  getEnvironment: () => {
    throw new Error('Test error');
  },
};

// Act & Assert
const state = new AwaitingExternalTurnEndState({
  environmentProvider: errorProvider,
  ...
});

// Should not throw, should use fallback
```

### Malformed Data Test Pattern
```javascript
// Test various invalid returns:
// - null
// - undefined
// - {} (missing IS_PRODUCTION)
// - { IS_PRODUCTION: "not-a-boolean" }
// - { wrongProperty: true }

// All should fail-safe to production timeout
```

## Definition of Done

- [ ] Test file created in /tests/integration/turns/states/
- [ ] All 4 required test cases implemented
- [ ] Test 1 verifies ProcessEnvironmentProvider integration
- [ ] Test 2 verifies TestEnvironmentProvider isolation
- [ ] Test 3 verifies error handling (provider throws)
- [ ] Test 4 verifies malformed data handling
- [ ] All tests pass locally
- [ ] Tests complete in < 1 second
- [ ] Environment restoration in Test 1 (finally block)
- [ ] Clear test names describing scenarios
- [ ] Code review completed
- [ ] Integrated with integration test suite
- [ ] npm run test:integration passes
