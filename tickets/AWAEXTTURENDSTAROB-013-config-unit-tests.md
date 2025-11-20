# AWAEXTTURENDSTAROB-013: Add TimeoutConfiguration Unit Tests

## Metadata
- **Ticket ID:** AWAEXTTURENDSTAROB-013
- **Phase:** 3 - Robustness (Optional Future Enhancement)
- **Priority:** Low
- **Estimated Effort:** 2 hours
- **Dependencies:** AWAEXTTURENDSTAROB-012 (must complete first)

## Objective

Create comprehensive unit tests for `TimeoutConfiguration` class, verifying all configuration scenarios, validation logic, and error handling. Achieves 100% coverage of the configuration class.

## Files to Create

### New Test File
- `tests/unit/turns/config/timeoutConfiguration.test.js` (NEW)

## Test Structure Required

### File Organization
```javascript
import { describe, it, expect } from '@jest/globals';
import TimeoutConfiguration from '../../../../src/turns/config/timeoutConfiguration.js';
import { TestEnvironmentProvider } from '../../../../src/environment/TestEnvironmentProvider.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

describe('TimeoutConfiguration', () => {
  describe('Environment-Based Configuration', () => {
    // Tests 1-2
  });

  describe('Explicit Timeout Override', () => {
    // Tests 3-4
  });

  describe('Invalid Timeout Validation', () => {
    // Tests 5-8
  });
});
```

## Required Test Cases (Minimum 8)

### Group 1: Environment-Based Configuration

#### Test 1: Production Environment
```javascript
it('should return 30-second timeout for production environment', () => {
  // Arrange
  const productionProvider = new TestEnvironmentProvider({ IS_PRODUCTION: true });
  const config = new TimeoutConfiguration({
    environmentProvider: productionProvider,
  });

  // Act
  const timeout = config.getTimeoutMs();

  // Assert
  expect(timeout).toBe(30_000);
});
```

#### Test 2: Development Environment
```javascript
it('should return 3-second timeout for development environment', () => {
  // Arrange
  const developmentProvider = new TestEnvironmentProvider({ IS_PRODUCTION: false });
  const config = new TimeoutConfiguration({
    environmentProvider: developmentProvider,
  });

  // Act
  const timeout = config.getTimeoutMs();

  // Assert
  expect(timeout).toBe(3_000);
});
```

### Group 2: Explicit Timeout Override

#### Test 3: Override Production Default
```javascript
it('should use explicit timeout over production default', () => {
  // Arrange
  const productionProvider = new TestEnvironmentProvider({ IS_PRODUCTION: true });
  const config = new TimeoutConfiguration({
    timeoutMs: 5_000,
    environmentProvider: productionProvider,
  });

  // Act
  const timeout = config.getTimeoutMs();

  // Assert
  expect(timeout).toBe(5_000); // Not 30_000
});
```

#### Test 4: Override Development Default
```javascript
it('should use explicit timeout over development default', () => {
  // Arrange
  const developmentProvider = new TestEnvironmentProvider({ IS_PRODUCTION: false });
  const config = new TimeoutConfiguration({
    timeoutMs: 10_000,
    environmentProvider: developmentProvider,
  });

  // Act
  const timeout = config.getTimeoutMs();

  // Assert
  expect(timeout).toBe(10_000); // Not 3_000
});
```

### Group 3: Invalid Timeout Validation

#### Test 5: NaN Timeout
```javascript
it('should throw InvalidArgumentError for NaN timeout', () => {
  // Arrange
  const config = new TimeoutConfiguration({ timeoutMs: NaN });

  // Act & Assert
  expect(() => config.getTimeoutMs()).toThrow(InvalidArgumentError);
  expect(() => config.getTimeoutMs()).toThrow(/timeoutMs must be a positive finite number.*NaN/);
});
```

#### Test 6: Negative Timeout
```javascript
it('should throw InvalidArgumentError for negative timeout', () => {
  // Arrange
  const config = new TimeoutConfiguration({ timeoutMs: -1000 });

  // Act & Assert
  expect(() => config.getTimeoutMs()).toThrow(InvalidArgumentError);
  expect(() => config.getTimeoutMs()).toThrow(/-1000/);
});
```

#### Test 7: Infinity Timeout
```javascript
it('should throw InvalidArgumentError for Infinity timeout', () => {
  // Arrange
  const config = new TimeoutConfiguration({ timeoutMs: Infinity });

  // Act & Assert
  expect(() => config.getTimeoutMs()).toThrow(InvalidArgumentError);
  expect(() => config.getTimeoutMs()).toThrow(/Infinity/);
});
```

#### Test 8: Zero Timeout
```javascript
it('should throw InvalidArgumentError for zero timeout', () => {
  // Arrange
  const config = new TimeoutConfiguration({ timeoutMs: 0 });

  // Act & Assert
  expect(() => config.getTimeoutMs()).toThrow(InvalidArgumentError);
  expect(() => config.getTimeoutMs()).toThrow(/0/);
});
```

## Additional Recommended Tests (Not Required But Valuable)

### Test 9: Provider Throws Error
```javascript
it('should fall back to production timeout when provider throws error', () => {
  // Arrange
  const mockLogger = { warn: jest.fn() };
  const errorProvider = {
    getEnvironment: () => { throw new Error('Provider failed'); }
  };
  const config = new TimeoutConfiguration({
    environmentProvider: errorProvider,
    logger: mockLogger,
  });

  // Act
  const timeout = config.getTimeoutMs();

  // Assert
  expect(timeout).toBe(30_000); // Fail-safe to production
  expect(mockLogger.warn).toHaveBeenCalledWith(
    expect.stringMatching(/Environment provider failed/),
    expect.any(Error)
  );
});
```

### Test 10: Provider Returns Malformed Data
```javascript
it('should fall back to production timeout when provider returns null', () => {
  // Arrange
  const malformedProvider = {
    getEnvironment: () => null
  };
  const config = new TimeoutConfiguration({
    environmentProvider: malformedProvider,
  });

  // Act
  const timeout = config.getTimeoutMs();

  // Assert
  expect(timeout).toBe(30_000); // env?.IS_PRODUCTION ?? true
});
```

### Test 11: Lazy Resolution and Caching
```javascript
it('should cache resolved timeout and not call provider again', () => {
  // Arrange
  const mockProvider = {
    getEnvironment: jest.fn(() => ({ IS_PRODUCTION: true }))
  };
  const config = new TimeoutConfiguration({
    environmentProvider: mockProvider,
  });

  // Act
  const timeout1 = config.getTimeoutMs();
  const timeout2 = config.getTimeoutMs();
  const timeout3 = config.getTimeoutMs();

  // Assert
  expect(timeout1).toBe(30_000);
  expect(timeout2).toBe(30_000);
  expect(timeout3).toBe(30_000);
  expect(mockProvider.getEnvironment).toHaveBeenCalledTimes(1); // Only once
});
```

### Test 12: No Provider Uses Default
```javascript
it('should use ProcessEnvironmentProvider by default when no provider given', () => {
  // Arrange
  const originalNodeEnv = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = 'production';

    const config = new TimeoutConfiguration({
      // No environmentProvider
    });

    // Act
    const timeout = config.getTimeoutMs();

    // Assert
    expect(timeout).toBe(30_000); // Uses real ProcessEnvironmentProvider
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
});
```

## Out of Scope

### Must NOT Include
- Integration tests (if needed, separate ticket)
- Property-based tests (Ticket 014)
- State lifecycle tests (existing tests)
- Performance tests
- Tests of ProcessEnvironmentProvider (test the configuration, not the provider)

### Must NOT Change
- TimeoutConfiguration implementation (test only)
- Other test files
- Production code beyond what's in Ticket 012

## Acceptance Criteria

### AC1: All 8 Required Tests Implemented
```javascript
// GIVEN: Test suite with minimum 8 test cases
// WHEN: npm run test:unit -- timeoutConfiguration.test.js
// THEN:
//   ✓ All tests pass
//   ✓ Each test focused on single behavior
//   ✓ Clear test names
```

### AC2: 100% Coverage Achieved
```javascript
// GIVEN: Test suite execution with coverage
// WHEN: Coverage report generated
// THEN:
//   ✓ Branches: 100%
//   ✓ Functions: 100%
//   ✓ Lines: 100%
//   ✓ Statements: 100%
```

### AC3: All Configuration Paths Tested
```javascript
// GIVEN: Test suite
// WHEN: Code review performed
// THEN:
//   ✓ Production environment tested
//   ✓ Development environment tested
//   ✓ Explicit override tested (both environments)
//   ✓ All invalid inputs tested
//   ✓ Error handling tested
```

### AC4: Tests Are Fast
```javascript
// GIVEN: Test suite
// WHEN: Tests executed
// THEN:
//   ✓ All tests complete in < 100ms
//   ✓ No real timers
//   ✓ No async operations (unless provider needs)
```

### AC5: Tests Follow Project Patterns
```javascript
// GIVEN: Test implementation
// WHEN: Code review performed
// THEN:
//   ✓ Uses jest.fn() for mocks
//   ✓ AAA pattern (Arrange, Act, Assert)
//   ✓ ES6 imports with .js extensions
//   ✓ Clear, descriptive test names
```

## Invariants

### Test Coverage Requirements (Must Achieve)
1. **100% Branches**: All conditional paths tested
2. **100% Functions**: All methods tested
3. **100% Lines**: All code lines executed
4. **100% Statements**: All statements covered

### Test Quality Standards (Must Maintain)
1. **Unit Level**: Tests only TimeoutConfiguration, mock dependencies
2. **Fast**: Complete in <100ms
3. **Isolated**: Each test independent
4. **Clear**: Test names describe behavior exactly

### Project Standards (Must Follow)
1. **Mock Patterns**: jest.fn() for dependencies
2. **Error Testing**: Test both throw and message
3. **Import Style**: ES6 imports
4. **File Location**: /tests/unit/turns/config/

## Testing Commands

### Development
```bash
# Run test file only
npm run test:unit -- timeoutConfiguration.test.js

# Run with coverage
npm run test:unit -- timeoutConfiguration.test.js --coverage

# Run with verbose output
npm run test:unit -- timeoutConfiguration.test.js --verbose

# Run in watch mode
npm run test:unit -- timeoutConfiguration.test.js --watch
```

### Coverage Verification
```bash
# Verify 100% coverage
npm run test:unit -- timeoutConfiguration.test.js --coverage --collectCoverageFrom='src/turns/config/timeoutConfiguration.js'

# Check coverage thresholds
npm run test:unit -- timeoutConfiguration.test.js --coverage --coverageThreshold='{"global":{"branches":100,"functions":100,"lines":100,"statements":100}}'
```

### Full Suite
```bash
# Run all unit tests
npm run test:unit

# Run all tests
npm run test:ci
```

## Implementation Notes

### Test File Template
```javascript
import { describe, it, expect } from '@jest/globals';
import TimeoutConfiguration from '../../../../src/turns/config/timeoutConfiguration.js';
import { TestEnvironmentProvider } from '../../../../src/environment/TestEnvironmentProvider.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

describe('TimeoutConfiguration', () => {
  describe('Group Name', () => {
    it('should do something specific', () => {
      // Arrange
      const config = new TimeoutConfiguration({...});

      // Act
      const result = config.getTimeoutMs();

      // Assert
      expect(result).toBe(expectedValue);
    });
  });
});
```

### Coverage Report Interpretation
```bash
# After running with --coverage:
# File                          | % Stmts | % Branch | % Funcs | % Lines
# ------------------------------|---------|----------|---------|--------
# timeoutConfiguration.js       |     100 |      100 |     100 |     100

# All should be 100%
```

### Validation Testing Pattern
```javascript
// Test validation thoroughly:
const invalidValues = [NaN, -1000, 0, Infinity, -Infinity];

invalidValues.forEach(value => {
  it(`should reject ${value}`, () => {
    const config = new TimeoutConfiguration({ timeoutMs: value });
    expect(() => config.getTimeoutMs()).toThrow(InvalidArgumentError);
  });
});
```

## Definition of Done

- [ ] Test file created at correct path
- [ ] All 8 required test cases implemented
- [ ] Bonus tests added (recommended: 9-12)
- [ ] All tests pass locally
- [ ] Coverage 100% for all metrics
- [ ] Tests complete in <100ms
- [ ] Clear, descriptive test names
- [ ] AAA pattern followed
- [ ] Mocks used appropriately
- [ ] Environment restoration in Test 12
- [ ] ESLint passes on test file
- [ ] Code review completed
- [ ] Integrated with unit test suite
- [ ] npm run test:unit passes
