# AWAEXTTURENDSTAROB-005: Add Environment Configuration Unit Tests

## Metadata
- **Ticket ID:** AWAEXTTURENDSTAROB-005
- **Phase:** 1 - Minimal Change
- **Priority:** High
- **Estimated Effort:** 2-3 hours
- **Dependencies:** AWAEXTTURENDSTAROB-001, 002, 003 (all must complete first)

## Objective

Create comprehensive unit tests for environment-based timeout configuration, explicit overrides, and validation logic. This provides complete coverage of the new configuration behavior and serves as regression prevention.

## Files to Create

### New Test File
- `tests/unit/turns/states/awaitingExternalTurnEndState.environmentConfig.test.js` (NEW)

## Test Structure Required

### File Organization
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import AwaitingExternalTurnEndState from '../../../../src/turns/states/awaitingExternalTurnEndState.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

describe('AwaitingExternalTurnEndState - Environment Configuration', () => {
  let testBed;
  let originalNodeEnv;

  beforeEach(() => {
    testBed = createTestBed();
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    testBed.cleanup();
  });

  describe('Environment-Based Default Timeouts', () => {
    // Tests 1-4
  });

  describe('Explicit Timeout Override', () => {
    // Tests 5-6
  });

  describe('Invalid Timeout Validation', () => {
    // Tests 7-10
  });
});
```

## Required Test Cases (Minimum 10)

### Group 1: Environment-Based Default Timeouts

#### Test 1: Production Environment Uses 30s Timeout
```javascript
it('should use 30-second timeout in production environment', () => {
  // Arrange
  process.env.NODE_ENV = 'production';
  const mockSetTimeout = jest.fn((fn, ms) => 'timeout-id');
  const deps = testBed.createStateBasics({
    setTimeoutFn: mockSetTimeout,
  });

  // Act
  const state = new AwaitingExternalTurnEndState(deps);
  state.enterState();

  // Assert
  expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 30_000);
  expect(mockSetTimeout).toHaveBeenCalledTimes(1);
});
```

#### Test 2: Development Environment Uses 3s Timeout
```javascript
it('should use 3-second timeout in development environment', () => {
  // Arrange
  process.env.NODE_ENV = 'development';
  const mockSetTimeout = jest.fn((fn, ms) => 'timeout-id');
  const deps = testBed.createStateBasics({
    setTimeoutFn: mockSetTimeout,
  });

  // Act
  const state = new AwaitingExternalTurnEndState(deps);
  state.enterState();

  // Assert
  expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 3_000);
});
```

#### Test 3: Test Environment Uses 3s Timeout (Development)
```javascript
it('should use 3-second timeout in test environment', () => {
  // Arrange
  process.env.NODE_ENV = 'test';
  const mockSetTimeout = jest.fn((fn, ms) => 'timeout-id');
  const deps = testBed.createStateBasics({
    setTimeoutFn: mockSetTimeout,
  });

  // Act
  const state = new AwaitingExternalTurnEndState(deps);
  state.enterState();

  // Assert
  expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 3_000);
  // Note: Test environment treated as development
});
```

#### Test 4: Undefined NODE_ENV Uses 30s Timeout (Fail-Safe)
```javascript
it('should use 30-second timeout when NODE_ENV is undefined', () => {
  // Arrange
  delete process.env.NODE_ENV; // Simulate missing environment variable
  const mockSetTimeout = jest.fn((fn, ms) => 'timeout-id');
  const deps = testBed.createStateBasics({
    setTimeoutFn: mockSetTimeout,
  });

  // Act
  const state = new AwaitingExternalTurnEndState(deps);
  state.enterState();

  // Assert
  expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 30_000);
  // Fail-safe to production timeout
});
```

### Group 2: Explicit Timeout Override

#### Test 5: Explicit Timeout Overrides Production Default
```javascript
it('should use explicit timeout over production default', () => {
  // Arrange
  process.env.NODE_ENV = 'production';
  const mockSetTimeout = jest.fn((fn, ms) => 'timeout-id');
  const deps = testBed.createStateBasics({
    timeoutMs: 5_000, // Explicit override
    setTimeoutFn: mockSetTimeout,
  });

  // Act
  const state = new AwaitingExternalTurnEndState(deps);
  state.enterState();

  // Assert
  expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 5_000);
  // NOT 30_000 (production default ignored)
});
```

#### Test 6: Explicit Timeout Overrides Development Default
```javascript
it('should use explicit timeout over development default', () => {
  // Arrange
  process.env.NODE_ENV = 'development';
  const mockSetTimeout = jest.fn((fn, ms) => 'timeout-id');
  const deps = testBed.createStateBasics({
    timeoutMs: 10_000, // Explicit override
    setTimeoutFn: mockSetTimeout,
  });

  // Act
  const state = new AwaitingExternalTurnEndState(deps);
  state.enterState();

  // Assert
  expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 10_000);
  // NOT 3_000 (development default ignored)
});
```

### Group 3: Invalid Timeout Validation

#### Test 7: NaN Timeout Throws InvalidArgumentError
```javascript
it('should throw InvalidArgumentError when timeoutMs is NaN', () => {
  // Arrange
  const deps = testBed.createStateBasics({
    timeoutMs: NaN,
  });

  // Act & Assert
  expect(() => {
    new AwaitingExternalTurnEndState(deps);
  }).toThrow(InvalidArgumentError);

  expect(() => {
    new AwaitingExternalTurnEndState(deps);
  }).toThrow(/timeoutMs must be a positive finite number.*NaN/);
});
```

#### Test 8: Negative Timeout Throws InvalidArgumentError
```javascript
it('should throw InvalidArgumentError when timeoutMs is negative', () => {
  // Arrange
  const deps = testBed.createStateBasics({
    timeoutMs: -1000,
  });

  // Act & Assert
  expect(() => {
    new AwaitingExternalTurnEndState(deps);
  }).toThrow(InvalidArgumentError);

  expect(() => {
    new AwaitingExternalTurnEndState(deps);
  }).toThrow(/timeoutMs must be a positive finite number.*-1000/);
});
```

#### Test 9: Infinity Timeout Throws InvalidArgumentError
```javascript
it('should throw InvalidArgumentError when timeoutMs is Infinity', () => {
  // Arrange
  const deps = testBed.createStateBasics({
    timeoutMs: Infinity,
  });

  // Act & Assert
  expect(() => {
    new AwaitingExternalTurnEndState(deps);
  }).toThrow(InvalidArgumentError);

  expect(() => {
    new AwaitingExternalTurnEndState(deps);
  }).toThrow(/timeoutMs must be a positive finite number.*Infinity/);
});
```

#### Test 10: Zero Timeout Throws InvalidArgumentError
```javascript
it('should throw InvalidArgumentError when timeoutMs is zero', () => {
  // Arrange
  const deps = testBed.createStateBasics({
    timeoutMs: 0,
  });

  // Act & Assert
  expect(() => {
    new AwaitingExternalTurnEndState(deps);
  }).toThrow(InvalidArgumentError);

  expect(() => {
    new AwaitingExternalTurnEndState(deps);
  }).toThrow(/timeoutMs must be a positive finite number.*0/);
});
```

## Out of Scope

### Must NOT Include
- Environment provider injection tests (Phase 2, Ticket 008)
- Property-based tests (Phase 3, Ticket 014)
- Integration tests (covered in other tickets)
- Timer function validation tests (can add if desired, but covered by Ticket 003)
- Timeout firing tests (integration concern)
- Resource cleanup tests (existing unit tests)

### Must NOT Change
- Existing unit test files
- Test helpers in `/tests/common/`
- Production code (tests only)

## Acceptance Criteria

### AC1: All 10 Test Cases Implemented
```javascript
// GIVEN: Test file with all 10 required test cases
// WHEN: npm run test:unit -- environmentConfig.test.js
// THEN:
//   ✓ All 10 tests pass
//   ✓ Each test follows AAA pattern (Arrange, Act, Assert)
//   ✓ Each test is focused on single behavior
```

### AC2: High Code Coverage
```javascript
// GIVEN: Test suite execution with coverage
// WHEN: Coverage report generated
// THEN:
//   ✓ Configuration logic coverage > 95%
//   ✓ Timeout resolution coverage 100%
//   ✓ Validation logic coverage 100%
//   ✓ No uncovered branches in timeout config
```

### AC3: Uses TestBed Helpers
```javascript
// GIVEN: Test file implementation
// WHEN: Code review performed
// THEN:
//   ✓ Uses createTestBed() from /tests/common/
//   ✓ Uses testBed.createStateBasics() or similar
//   ✓ Uses testBed.cleanup() in afterEach
//   ✓ Follows project test patterns
```

### AC4: Environment Management Correct
```javascript
// GIVEN: All tests in suite
// WHEN: Tests run in sequence
// THEN:
//   ✓ Each test stores original NODE_ENV
//   ✓ Each test restores NODE_ENV after
//   ✓ No environment leakage between tests
//   ✓ Tests can run in any order
```

### AC5: Clear Test Names and Structure
```javascript
// GIVEN: Test file code
// WHEN: Developer reads test
// THEN:
//   ✓ Test names describe exact behavior
//   ✓ Three describe blocks for organization
//   ✓ Comments explain non-obvious setup
//   ✓ Assertions include helpful messages
```

### AC6: Fast Execution
```javascript
// GIVEN: Test suite
// WHEN: npm run test:unit -- environmentConfig.test.js
// THEN:
//   ✓ All tests complete in < 500ms
//   ✓ No real setTimeout calls
//   ✓ All timers are mocked
```

## Invariants

### Test Quality Standards (Must Meet)
1. **Isolation**: Each test independent, no shared state
2. **Fast**: No real timers, all mocked
3. **Clear**: Descriptive names, AAA pattern
4. **Complete**: All configuration paths tested

### Coverage Requirements (Must Achieve)
1. **Branches**: >95% for configuration logic
2. **Functions**: 100% for timeout resolution
3. **Lines**: >95% for validation
4. **Edge Cases**: All invalid inputs tested

### Project Standards (Must Follow)
1. **TestBed Usage**: Use project test helpers
2. **Mock Patterns**: jest.fn() for dependencies
3. **Import Style**: ES6 imports, .js extensions
4. **Error Testing**: Test both throw and message

## Testing Commands

### Development
```bash
# Run this test file only
npm run test:unit -- environmentConfig.test.js

# Run with watch mode
npm run test:unit -- environmentConfig.test.js --watch

# Run with coverage
npm run test:unit -- environmentConfig.test.js --coverage

# Run all state unit tests
npm run test:unit -- awaitingExternalTurnEndState
```

### Validation
```bash
# Verify coverage thresholds
npm run test:unit -- environmentConfig.test.js --coverage --coverageThreshold='{"global":{"branches":95,"functions":100,"lines":95}}'

# Run with verbose output
npm run test:unit -- environmentConfig.test.js --verbose

# Full unit test suite
npm run test:unit
```

## Additional Test Ideas (Optional)

### Bonus Test Cases (Not Required, But Recommended)
```javascript
// 11. Non-number timeout (string)
it('should throw when timeoutMs is a string', () => {
  expect(() => {
    new AwaitingExternalTurnEndState({ timeoutMs: "3000", ... });
  }).toThrow(/timeoutMs must be a positive finite number.*string/);
});

// 12. Timer function validation (if not covered elsewhere)
it('should throw when setTimeoutFn is not a function', () => {
  expect(() => {
    new AwaitingExternalTurnEndState({ setTimeoutFn: "invalid", ... });
  }).toThrow(/setTimeoutFn must be a function/);
});

// 13. Multiple environment changes in same test
it('should respect environment changes between instances', () => {
  process.env.NODE_ENV = 'production';
  const state1 = new AwaitingExternalTurnEndState({...});

  process.env.NODE_ENV = 'development';
  const state2 = new AwaitingExternalTurnEndState({...});

  state1.enterState();
  state2.enterState();

  // Verify state1 uses 30s, state2 uses 3s
});
```

## Definition of Done

- [ ] Test file created at correct path
- [ ] All 10 required test cases implemented
- [ ] Uses `createTestBed()` helper
- [ ] Environment management in beforeEach/afterEach
- [ ] All tests pass locally
- [ ] Coverage >95% for configuration logic
- [ ] Coverage 100% for timeout resolution
- [ ] Tests run in <500ms
- [ ] ESLint passes on test file
- [ ] Code review completed
- [ ] Integrated with existing test suite
- [ ] npm run test:unit passes completely
