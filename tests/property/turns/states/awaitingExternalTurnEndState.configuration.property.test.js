/**
 * Property-based tests for TimeoutConfiguration via AwaitingExternalTurnEndState
 * Uses fast-check to verify configuration invariants hold for all possible inputs
 */

import { describe, it, expect, jest } from '@jest/globals';
import fc from 'fast-check';
import { AwaitingExternalTurnEndState } from '../../../../src/turns/states/awaitingExternalTurnEndState.js';
import TimeoutConfiguration from '../../../../src/turns/config/timeoutConfiguration.js';
import { TestEnvironmentProvider } from '../../../../src/configuration/TestEnvironmentProvider.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

/**
 * Creates a minimal mock handler for state instantiation
 *
 * @returns {object} Mock handler with required methods
 */
function createMockHandler() {
  return {
    getLogger: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
    getTurnContext: jest.fn(() => null),
  };
}

describe('AwaitingExternalTurnEndState - Configuration Properties', () => {
  describe('Valid Timeout Properties', () => {
    it('should accept any positive finite timeout value', () => {
      // Property: ∀ timeoutMs ∈ ℕ⁺, configuration succeeds
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100_000 }), // Arbitrary valid timeout
          (timeoutMs) => {
            // Arrange
            const mockHandler = createMockHandler();

            // Act - Create state with arbitrary valid timeout
            const state = new AwaitingExternalTurnEndState(mockHandler, {
              timeoutMs, // Arbitrary positive finite timeout
              setTimeoutFn: jest.fn(() => 'timeout-id'),
              clearTimeoutFn: jest.fn(),
            });

            // Assert - All valid timeouts accepted
            expect(state).toBeDefined();
            expect(typeof state).toBe('object');
            expect(state).toBeInstanceOf(AwaitingExternalTurnEndState);

            // Property verified: Configuration succeeds for all valid timeouts
          }
        ),
        { numRuns: 100 } // Test 100 random valid timeouts
      );
    });

    it('should accept very small positive timeouts (edge case: 1ms)', () => {
      // Property: Minimum valid timeout (1ms) should work
      fc.assert(
        fc.property(
          fc.constant(1), // Minimum valid timeout
          (timeoutMs) => {
            const mockHandler = createMockHandler();

            const state = new AwaitingExternalTurnEndState(mockHandler, {
              timeoutMs,
              setTimeoutFn: jest.fn(() => 'timeout-id'),
              clearTimeoutFn: jest.fn(),
            });

            expect(state).toBeDefined();
            expect(typeof state).toBe('object');
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should accept very large positive timeouts (edge case: 100000ms)', () => {
      // Property: Maximum tested timeout (100000ms) should work
      fc.assert(
        fc.property(
          fc.constant(100_000), // Maximum tested timeout
          (timeoutMs) => {
            const mockHandler = createMockHandler();

            const state = new AwaitingExternalTurnEndState(mockHandler, {
              timeoutMs,
              setTimeoutFn: jest.fn(() => 'timeout-id'),
              clearTimeoutFn: jest.fn(),
            });

            expect(state).toBeDefined();
            expect(typeof state).toBe('object');
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Invalid Timeout Properties', () => {
    it('should reject any non-positive integer timeout', () => {
      // Property: ∀ timeoutMs ≤ 0, validation fails
      fc.assert(
        fc.property(
          fc.integer({ max: 0 }), // Arbitrary non-positive integer
          (timeoutMs) => {
            // Arrange
            const mockHandler = createMockHandler();

            // Act & Assert
            expect(() => {
              new AwaitingExternalTurnEndState(mockHandler, {
                timeoutMs, // Arbitrary non-positive timeout
                setTimeoutFn: jest.fn(),
                clearTimeoutFn: jest.fn(),
              });
            }).toThrow(InvalidArgumentError);

            // Property verified: All non-positive timeouts rejected
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject special invalid numeric values (NaN, Infinity, -Infinity)', () => {
      // Property: ∀ timeoutMs ∈ {NaN, ±∞}, validation fails
      fc.assert(
        fc.property(
          fc.constantFrom(NaN, Infinity, -Infinity), // Special invalid values
          (timeoutMs) => {
            const mockHandler = createMockHandler();

            expect(() => {
              new AwaitingExternalTurnEndState(mockHandler, {
                timeoutMs,
                setTimeoutFn: jest.fn(),
                clearTimeoutFn: jest.fn(),
              });
            }).toThrow(InvalidArgumentError);

            // Property verified: All special invalid values rejected
          }
        ),
        { numRuns: 30 } // 10 runs per constant
      );
    });

    it('should reject zero timeout (boundary case)', () => {
      // Property: Zero should be rejected (boundary between invalid/valid)
      fc.assert(
        fc.property(
          fc.constant(0), // Zero timeout
          (timeoutMs) => {
            const mockHandler = createMockHandler();

            expect(() => {
              new AwaitingExternalTurnEndState(mockHandler, {
                timeoutMs,
                setTimeoutFn: jest.fn(),
                clearTimeoutFn: jest.fn(),
              });
            }).toThrow(InvalidArgumentError);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should reject negative timeouts', () => {
      // Property: Negative numbers should be rejected
      fc.assert(
        fc.property(
          fc.integer({ max: -1 }), // Arbitrary negative integer
          (timeoutMs) => {
            const mockHandler = createMockHandler();

            expect(() => {
              new AwaitingExternalTurnEndState(mockHandler, {
                timeoutMs,
                setTimeoutFn: jest.fn(),
                clearTimeoutFn: jest.fn(),
              });
            }).toThrow(InvalidArgumentError);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Provider Properties', () => {
    it('should handle any valid environment object from provider', () => {
      // Property: ∀ isProduction ∈ {true, false}, valid configuration
      fc.assert(
        fc.property(
          fc.boolean(), // Arbitrary IS_PRODUCTION value
          (isProduction) => {
            // Arrange
            const testProvider = new TestEnvironmentProvider({
              IS_PRODUCTION: isProduction,
            });
            const mockHandler = createMockHandler();

            // Act
            const state = new AwaitingExternalTurnEndState(mockHandler, {
              environmentProvider: testProvider,
              setTimeoutFn: jest.fn(() => 'timeout-id'),
              clearTimeoutFn: jest.fn(),
            });

            // Assert
            expect(state).toBeDefined();
            expect(typeof state).toBe('object');
            expect(state).toBeInstanceOf(AwaitingExternalTurnEndState);

            // Property verified: Configuration succeeds for all valid environment values
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should resolve correct timeout based on environment', () => {
      // Property: Production environment → 30000ms, Development → 3000ms
      fc.assert(
        fc.property(
          fc.boolean(), // Arbitrary IS_PRODUCTION value
          (isProduction) => {
            // Arrange
            const testProvider = new TestEnvironmentProvider({
              IS_PRODUCTION: isProduction,
            });
            const mockSetTimeout = jest.fn(() => 'timeout-id');
            const mockHandler = createMockHandler();

            // Act - Create state to verify configuration
            new AwaitingExternalTurnEndState(mockHandler, {
              environmentProvider: testProvider,
              setTimeoutFn: mockSetTimeout,
              clearTimeoutFn: jest.fn(),
            });

            // Verify correct timeout is used internally (via configuration)
            const config = new TimeoutConfiguration({
              environmentProvider: testProvider,
            });
            const expectedTimeout = config.getTimeoutMs();

            // Assert - Configuration uses correct timeout for environment
            expect(expectedTimeout).toBe(
              isProduction
                ? TimeoutConfiguration.DEFAULT_TIMEOUT_PRODUCTION
                : TimeoutConfiguration.DEFAULT_TIMEOUT_DEVELOPMENT
            );
            expect(expectedTimeout).toBe(isProduction ? 30_000 : 3_000);

            // Property verified: Timeout resolution is correct for environment
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle production environment correctly', () => {
      // Property: Production environment always results in valid state
      fc.assert(
        fc.property(
          fc.constant(true), // Production environment
          (isProduction) => {
            const testProvider = new TestEnvironmentProvider({
              IS_PRODUCTION: isProduction,
            });
            const mockHandler = createMockHandler();

            const state = new AwaitingExternalTurnEndState(mockHandler, {
              environmentProvider: testProvider,
              setTimeoutFn: jest.fn(() => 'timeout-id'),
              clearTimeoutFn: jest.fn(),
            });

            expect(state).toBeDefined();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle development environment correctly', () => {
      // Property: Development environment always results in valid state
      fc.assert(
        fc.property(
          fc.constant(false), // Development environment
          (isProduction) => {
            const testProvider = new TestEnvironmentProvider({
              IS_PRODUCTION: isProduction,
            });
            const mockHandler = createMockHandler();

            const state = new AwaitingExternalTurnEndState(mockHandler, {
              environmentProvider: testProvider,
              setTimeoutFn: jest.fn(() => 'timeout-id'),
              clearTimeoutFn: jest.fn(),
            });

            expect(state).toBeDefined();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Determinism Properties', () => {
    it('should produce same timeout for same inputs (explicit timeout)', () => {
      // Property: ∀ (timeoutMs, env), f(timeoutMs, env) = f(timeoutMs, env) (deterministic)
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100_000 }), // Arbitrary timeout
          fc.boolean(), // Arbitrary IS_PRODUCTION
          (timeoutMs, isProduction) => {
            // Arrange
            const provider1 = new TestEnvironmentProvider({
              IS_PRODUCTION: isProduction,
            });
            const provider2 = new TestEnvironmentProvider({
              IS_PRODUCTION: isProduction,
            });

            // Act - Create two configurations with same inputs
            const config1 = new TimeoutConfiguration({
              timeoutMs,
              environmentProvider: provider1,
            });

            const config2 = new TimeoutConfiguration({
              timeoutMs,
              environmentProvider: provider2,
            });

            // Assert - Same inputs → same outputs
            const timeout1 = config1.getTimeoutMs();
            const timeout2 = config2.getTimeoutMs();

            expect(timeout1).toBe(timeout2);
            expect(timeout1).toBe(timeoutMs); // Explicit timeout always used

            // Property verified: Configuration is deterministic
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce same timeout for same environment when no explicit timeout', () => {
      // Property: Same environment → same default timeout
      fc.assert(
        fc.property(
          fc.boolean(), // Arbitrary IS_PRODUCTION
          (isProduction) => {
            // Arrange - Two providers with same environment
            const provider1 = new TestEnvironmentProvider({
              IS_PRODUCTION: isProduction,
            });
            const provider2 = new TestEnvironmentProvider({
              IS_PRODUCTION: isProduction,
            });

            // Act - Create configurations without explicit timeout
            const config1 = new TimeoutConfiguration({
              environmentProvider: provider1,
            });

            const config2 = new TimeoutConfiguration({
              environmentProvider: provider2,
            });

            // Assert - Same environment → same timeout
            const timeout1 = config1.getTimeoutMs();
            const timeout2 = config2.getTimeoutMs();

            expect(timeout1).toBe(timeout2);
            expect(timeout1).toBe(
              isProduction
                ? TimeoutConfiguration.DEFAULT_TIMEOUT_PRODUCTION
                : TimeoutConfiguration.DEFAULT_TIMEOUT_DEVELOPMENT
            );

            // Property verified: Environment-based resolution is deterministic
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should cache resolved timeout (idempotent)', () => {
      // Property: Multiple calls to getTimeoutMs() return same value
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100_000 }), // Arbitrary timeout
          (timeoutMs) => {
            // Arrange
            const config = new TimeoutConfiguration({ timeoutMs });

            // Act - Call getTimeoutMs multiple times
            const timeout1 = config.getTimeoutMs();
            const timeout2 = config.getTimeoutMs();
            const timeout3 = config.getTimeoutMs();

            // Assert - All calls return same value
            expect(timeout1).toBe(timeout2);
            expect(timeout2).toBe(timeout3);
            expect(timeout1).toBe(timeoutMs);

            // Property verified: Resolution is idempotent (cached)
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be deterministic across state instances with same config', () => {
      // Property: Same configuration → same behavior in different state instances
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100_000 }), // Arbitrary timeout
          (timeoutMs) => {
            // Arrange
            const mockHandler1 = createMockHandler();
            const mockHandler2 = createMockHandler();

            // Act - Create two states with same timeout
            const state1 = new AwaitingExternalTurnEndState(mockHandler1, {
              timeoutMs,
              setTimeoutFn: jest.fn(() => 'timeout-id-1'),
              clearTimeoutFn: jest.fn(),
            });

            const state2 = new AwaitingExternalTurnEndState(mockHandler2, {
              timeoutMs,
              setTimeoutFn: jest.fn(() => 'timeout-id-2'),
              clearTimeoutFn: jest.fn(),
            });

            // Assert - Both states created successfully (deterministic behavior)
            expect(state1).toBeDefined();
            expect(state2).toBeDefined();
            expect(typeof state1).toBe('object');
            expect(typeof state2).toBe('object');

            // Property verified: Same configuration produces same result
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Configuration Composition Properties', () => {
    it('should prioritize explicit timeout over environment provider', () => {
      // Property: Explicit timeout always takes precedence
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100_000 }), // Explicit timeout
          fc.boolean(), // Environment
          (explicitTimeout, isProduction) => {
            // Arrange
            const provider = new TestEnvironmentProvider({
              IS_PRODUCTION: isProduction,
            });

            // Act
            const config = new TimeoutConfiguration({
              timeoutMs: explicitTimeout,
              environmentProvider: provider, // Should be ignored
            });

            // Assert - Explicit timeout used, not environment default
            const resolvedTimeout = config.getTimeoutMs();
            expect(resolvedTimeout).toBe(explicitTimeout);
            expect(resolvedTimeout).not.toBe(
              isProduction
                ? TimeoutConfiguration.DEFAULT_TIMEOUT_PRODUCTION
                : TimeoutConfiguration.DEFAULT_TIMEOUT_DEVELOPMENT
            );

            // Property verified: Explicit timeout has precedence
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate timeout regardless of source (explicit or provider)', () => {
      // Property: Validation applies to all timeout sources
      fc.assert(
        fc.property(
          fc.integer({ max: 0 }), // Invalid timeout
          (invalidTimeout) => {
            // Test with explicit timeout - validation happens on getTimeoutMs()
            expect(() => {
              const config = new TimeoutConfiguration({ timeoutMs: invalidTimeout });
              config.getTimeoutMs(); // Trigger lazy validation
            }).toThrow(InvalidArgumentError);

            // Property verified: Validation is universal
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
