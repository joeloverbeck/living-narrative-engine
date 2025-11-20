# AWAEXTTURENDSTAROB-014: Add Configuration Property-Based Tests

## Metadata
- **Ticket ID:** AWAEXTTURENDSTAROB-014
- **Phase:** 3 - Robustness (Optional Future Enhancement)
- **Priority:** Low
- **Estimated Effort:** 2-3 hours
- **Dependencies:**
  - AWAEXTTURENDSTAROB-012 (must complete first)
  - Requires `npm install --save-dev fast-check`

## Objective

Create property-based tests for `TimeoutConfiguration` using fast-check to verify configuration invariants hold for all possible inputs. This provides mathematical confidence that validation and configuration logic is correct across the entire input space.

## Prerequisites

### Install fast-check
```bash
npm install --save-dev fast-check
```

## Files to Create

### New Test File
- `tests/property/turns/states/awaitingExternalTurnEndState.configuration.property.test.js` (NEW)

Note: Tests TimeoutConfiguration via AwaitingExternalTurnEndState usage, as that's the integration point.

## Test Structure Required

### File Organization
```javascript
import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import AwaitingExternalTurnEndState from '../../../../src/turns/states/awaitingExternalTurnEndState.js';
import TimeoutConfiguration from '../../../../src/turns/config/timeoutConfiguration.js';
import { TestEnvironmentProvider } from '../../../../src/environment/TestEnvironmentProvider.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

describe('AwaitingExternalTurnEndState - Configuration Properties', () => {
  describe('Valid Timeout Properties', () => {
    // Property 1
  });

  describe('Invalid Timeout Properties', () => {
    // Property 2
  });

  describe('Provider Properties', () => {
    // Property 3
  });

  describe('Environment Object Properties', () => {
    // Property 4
  });
});
```

## Required Property Tests (Minimum 4)

### Property 1: All Valid Timeouts Are Accepted
```javascript
it('should accept any positive finite timeout value', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 100_000 }), // Arbitrary valid timeout
      (timeoutMs) => {
        // Arrange
        const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
        const mockEventBus = {
          dispatch: jest.fn(),
          subscribe: jest.fn(() => 'subscription-id'),
        };

        // Act - Create state with arbitrary valid timeout
        const state = new AwaitingExternalTurnEndState({
          context: { actorId: 'test-actor', turn: { id: 'test-turn' } },
          logger: mockLogger,
          eventBus: mockEventBus,
          endTurn: jest.fn(),
          timeoutMs, // Arbitrary positive finite timeout
        });

        // Assert - All valid timeouts accepted
        expect(state).toBeDefined();
        expect(typeof state).toBe('object');

        // Verify timeout is stored correctly (via mock setTimeout if desired)
        // Property: ∀ timeoutMs ∈ ℕ⁺, configuration succeeds
      }
    ),
    { numRuns: 100 } // Test 100 random valid timeouts
  );
});
```

### Property 2: All Invalid Timeouts Are Rejected
```javascript
it('should reject any invalid timeout value', () => {
  // Test negative numbers
  fc.assert(
    fc.property(
      fc.integer({ max: 0 }), // Arbitrary non-positive integer
      (timeoutMs) => {
        // Act & Assert
        expect(() => {
          new AwaitingExternalTurnEndState({
            context: { actorId: 'test', turn: { id: 'test' } },
            logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
            eventBus: {
              dispatch: jest.fn(),
              subscribe: jest.fn(() => 'sub'),
            },
            endTurn: jest.fn(),
            timeoutMs, // Arbitrary non-positive timeout
          });
        }).toThrow(InvalidArgumentError);

        // Property: ∀ timeoutMs ≤ 0, validation fails
      }
    ),
    { numRuns: 50 }
  );

  // Test special invalid values
  fc.assert(
    fc.property(
      fc.constantFrom(NaN, Infinity, -Infinity), // Special invalid values
      (timeoutMs) => {
        expect(() => {
          new AwaitingExternalTurnEndState({
            context: { actorId: 'test', turn: { id: 'test' } },
            logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
            eventBus: {
              dispatch: jest.fn(),
              subscribe: jest.fn(() => 'sub'),
            },
            endTurn: jest.fn(),
            timeoutMs,
          });
        }).toThrow(InvalidArgumentError);

        // Property: ∀ timeoutMs ∈ {NaN, ±∞}, validation fails
      }
    ),
    { numRuns: 30 } // 10 runs per constant
  );
});
```

### Property 3: Provider Always Returns Valid Environment Object
```javascript
it('should handle any valid environment object from provider', () => {
  fc.assert(
    fc.property(
      fc.boolean(), // Arbitrary IS_PRODUCTION value
      (isProduction) => {
        // Arrange
        const testProvider = new TestEnvironmentProvider({ IS_PRODUCTION: isProduction });
        const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
        const mockEventBus = {
          dispatch: jest.fn(),
          subscribe: jest.fn(() => 'subscription-id'),
        };

        // Act
        const state = new AwaitingExternalTurnEndState({
          context: { actorId: 'test-actor', turn: { id: 'test-turn' } },
          logger: mockLogger,
          eventBus: mockEventBus,
          endTurn: jest.fn(),
          environmentProvider: testProvider,
        });

        // Assert
        expect(state).toBeDefined();

        // Verify correct timeout based on environment
        // Property: ∀ isProduction ∈ {true, false}, valid configuration
      }
    ),
    { numRuns: 100 }
  );
});
```

### Property 4: Timeout Configuration Is Deterministic
```javascript
it('should produce same timeout for same inputs (deterministic)', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 100_000 }), // Arbitrary timeout
      fc.boolean(), // Arbitrary IS_PRODUCTION
      (timeoutMs, isProduction) => {
        // Arrange
        const provider = new TestEnvironmentProvider({ IS_PRODUCTION: isProduction });

        // Act - Create two configurations with same inputs
        const config1 = new TimeoutConfiguration({
          timeoutMs,
          environmentProvider: provider,
        });

        const config2 = new TimeoutConfiguration({
          timeoutMs,
          environmentProvider: new TestEnvironmentProvider({ IS_PRODUCTION: isProduction }),
        });

        // Assert - Same inputs → same outputs
        const timeout1 = config1.getTimeoutMs();
        const timeout2 = config2.getTimeoutMs();

        expect(timeout1).toBe(timeout2);
        expect(timeout1).toBe(timeoutMs); // Explicit timeout always used

        // Property: ∀ (timeoutMs, env), f(timeoutMs, env) = f(timeoutMs, env) (deterministic)
      }
    ),
    { numRuns: 100 }
  );
});
```

## Out of Scope

### Must NOT Include
- State lifecycle property tests (Ticket 015)
- Integration-level properties
- Performance properties (separate concern)
- Fuzzing for security vulnerabilities

### Must NOT Change
- Production code
- Unit tests
- Integration tests

## Acceptance Criteria

### AC1: All 4 Property Tests Pass
```javascript
// GIVEN: Property test suite with 4 properties
// WHEN: npm run test:property -- configuration.property.test.js
// THEN:
//   ✓ All properties verified
//   ✓ 100+ test cases per property
//   ✓ No counterexamples found
```

### AC2: Valid Timeouts Property Verified
```javascript
// GIVEN: Property 1 with 100 random valid timeouts
// WHEN: Tests executed
// THEN:
//   ✓ All positive finite numbers accepted
//   ✓ Range: 1 to 100,000 ms
//   ✓ No valid timeout rejected
```

### AC3: Invalid Timeouts Property Verified
```javascript
// GIVEN: Property 2 with 80 random invalid timeouts
// WHEN: Tests executed
// THEN:
//   ✓ All non-positive integers rejected (50 cases)
//   ✓ All special values rejected (30 cases: NaN, ±Infinity)
//   ✓ InvalidArgumentError thrown for all
```

### AC4: Environment Provider Property Verified
```javascript
// GIVEN: Property 3 with 100 random boolean values
// WHEN: Tests executed
// THEN:
//   ✓ All valid environment objects accepted
//   ✓ Both true and false IS_PRODUCTION values work
//   ✓ Configuration succeeds for all
```

### AC5: Determinism Property Verified
```javascript
// GIVEN: Property 4 with 100 random input pairs
// WHEN: Same inputs used twice
// THEN:
//   ✓ Same outputs produced
//   ✓ Configuration is deterministic
//   ✓ No randomness in resolution
```

## Invariants

### Property Test Guarantees (Must Verify)
1. **Universal Quantification**: Properties hold for ALL inputs in domain
2. **No Counterexamples**: fast-check finds no violations
3. **High Confidence**: 100+ test cases per property
4. **Reproducible**: Seed-based for debugging failures

### Configuration Properties (Must Hold)
1. **Valid Acceptance**: ∀ valid timeout → accepted
2. **Invalid Rejection**: ∀ invalid timeout → rejected
3. **Provider Compatibility**: ∀ valid env → works
4. **Determinism**: ∀ inputs → same output always

### Test Quality Standards (Must Maintain)
1. **Property-Based**: Uses fast-check generators
2. **Fast**: All properties verified in <5 seconds
3. **Clear**: Property descriptions explain invariant
4. **Reproducible**: Uses seeds for failure reproduction

## Testing Commands

### Development
```bash
# Run property tests
npm run test:property -- configuration.property.test.js

# Run with verbose output
npm run test:property -- configuration.property.test.js --verbose

# Run with more test cases (slow but thorough)
# Modify numRuns in test file to 1000+

# Run with specific seed (for reproducing failures)
# fc.assert(..., { seed: 1234567890 })
```

### Validation
```bash
# Verify fast-check installed
npm list fast-check

# Run all property tests
npm run test:property

# Full test suite
npm run test:ci
```

## Implementation Notes

### fast-check Generators
```javascript
// Valid timeouts
fc.integer({ min: 1, max: 100_000 })

// Invalid timeouts
fc.integer({ max: 0 }) // Non-positive
fc.constantFrom(NaN, Infinity, -Infinity) // Special

// Environment values
fc.boolean() // IS_PRODUCTION

// Combined
fc.tuple(
  fc.integer({ min: 1, max: 100_000 }),
  fc.boolean()
) // (timeout, isProduction)
```

### Property Test Pattern
```javascript
fc.assert(
  fc.property(
    generator, // Input generator
    (input) => {
      // Act
      const result = functionUnderTest(input);

      // Assert - Verify property holds
      expect(result).toSatisfy(property);
    }
  ),
  { numRuns: 100, seed: Date.now() }
);
```

### Debugging Failed Properties
```javascript
// If property test fails, fast-check shows counterexample:
// Counterexample: [42, true]
// Shrunk counterexample: [1, true]

// Use seed to reproduce:
fc.assert(..., { seed: 1234567890 });
```

### Performance Considerations
```javascript
// Start with 100 runs per property
// Increase for critical properties
// Decrease if tests become too slow

{ numRuns: 100 } // Good default
{ numRuns: 1000 } // High confidence, slower
{ numRuns: 10 } // Quick smoke test
```

## Definition of Done

- [ ] fast-check installed (package.json)
- [ ] Test file created in /tests/property/turns/states/
- [ ] All 4 required properties implemented
- [ ] Property 1: Valid timeouts accepted (100 runs)
- [ ] Property 2: Invalid timeouts rejected (80 runs)
- [ ] Property 3: Provider compatibility (100 runs)
- [ ] Property 4: Determinism (100 runs)
- [ ] All properties pass without counterexamples
- [ ] Tests complete in <5 seconds
- [ ] Clear property descriptions
- [ ] Seed configuration for reproducibility
- [ ] Code review completed
- [ ] Integrated with property test suite
- [ ] npm run test:property passes
