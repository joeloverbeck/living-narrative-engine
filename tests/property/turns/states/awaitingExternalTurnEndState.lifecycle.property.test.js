/**
 * @file Property-based tests for AwaitingExternalTurnEndState lifecycle
 * Uses fast-check to verify lifecycle invariants hold for all possible inputs
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fc from 'fast-check';
import { AwaitingExternalTurnEndState } from '../../../../src/turns/states/awaitingExternalTurnEndState.js';
import { TestEnvironmentProvider } from '../../../../src/configuration/TestEnvironmentProvider.js';
import { TURN_ENDED_ID } from '../../../../src/constants/eventIds.js';

/**
 * Creates a minimal mock handler for state testing
 * @param {object} ctx - Turn context mock
 * @param {object} logger - Logger mock
 * @returns {object} Handler mock
 */
function createMockHandler(ctx, logger) {
  return {
    getLogger: () => logger,
    getTurnContext: () => ctx,
  };
}

/**
 * Creates a minimal mock context for state testing
 * @param {string} actorId - Actor ID
 * @param {object} eventBus - Event bus mock
 * @param {object} logger - Logger mock
 * @returns {object} Context mock
 */
function createMockContext(actorId, eventBus, logger) {
  return {
    getChosenActionId: () => 'test-action',
    getActor: () => ({ id: actorId }),
    getSafeEventDispatcher: () => eventBus,
    getLogger: () => logger,
    setAwaitingExternalEvent: jest.fn(),
    isAwaitingExternalEvent: () => true,
    endTurn: jest.fn(),
  };
}

describe('AwaitingExternalTurnEndState - Lifecycle Properties', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('enterState Properties', () => {
    it('should always create exactly one timeout when enterState called', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100_000 }), // Arbitrary timeout
          fc.boolean(), // Arbitrary IS_PRODUCTION
          fc.string({ minLength: 1, maxLength: 50 }), // Arbitrary actor ID
          async (timeoutMs, isProduction, actorId) => {
            // Arrange
            const mockLogger = {
              info: jest.fn(),
              warn: jest.fn(),
              error: jest.fn(),
              debug: jest.fn(),
            };
            const mockEventBus = {
              dispatch: jest.fn(),
              subscribe: jest.fn(() => jest.fn()), // Return unsubscribe function
            };
            const mockSetTimeout = jest.fn(() => 'timeout-id');
            const mockClearTimeout = jest.fn();

            const mockCtx = createMockContext(actorId, mockEventBus, mockLogger);
            const mockHandler = createMockHandler(mockCtx, mockLogger);

            const state = new AwaitingExternalTurnEndState(mockHandler, {
              timeoutMs,
              environmentProvider: new TestEnvironmentProvider({ IS_PRODUCTION: isProduction }),
              setTimeoutFn: mockSetTimeout,
              clearTimeoutFn: mockClearTimeout,
            });

            // Act
            await state.enterState(mockHandler, null);

            // Assert - Property: ∀ valid inputs, enterState creates exactly 1 timeout
            expect(mockSetTimeout).toHaveBeenCalledTimes(1);
            expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), timeoutMs);

            // Cleanup
            await state.destroy(mockHandler);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('exitState Properties', () => {
    it('should always clear timeout and unsubscribe when exitState called', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100_000 }), // Arbitrary timeout
          fc.string({ minLength: 1, maxLength: 50 }), // Actor ID
          fc.string({ minLength: 1, maxLength: 50 }), // Subscription ID
          async (timeoutMs, actorId, subscriptionId) => {
            // Arrange
            const mockLogger = {
              info: jest.fn(),
              warn: jest.fn(),
              error: jest.fn(),
              debug: jest.fn(),
            };
            const timeoutIdValue = `timeout-${Math.random()}`;
            const unsubscribeFn = jest.fn();
            const mockEventBus = {
              dispatch: jest.fn(),
              subscribe: jest.fn(() => unsubscribeFn),
            };
            const mockSetTimeout = jest.fn(() => timeoutIdValue);
            const mockClearTimeout = jest.fn();

            const mockCtx = createMockContext(actorId, mockEventBus, mockLogger);
            const mockHandler = createMockHandler(mockCtx, mockLogger);

            const state = new AwaitingExternalTurnEndState(mockHandler, {
              timeoutMs,
              setTimeoutFn: mockSetTimeout,
              clearTimeoutFn: mockClearTimeout,
            });

            await state.enterState(mockHandler, null);

            // Act
            await state.exitState(mockHandler, null);

            // Assert - Property: ∀ states, exitState clears timeout AND unsubscribes
            expect(mockClearTimeout).toHaveBeenCalledWith(timeoutIdValue);
            expect(unsubscribeFn).toHaveBeenCalled();

            // Property: After exitState, no resources remain active
            expect(mockClearTimeout).toHaveBeenCalledTimes(1);
            expect(unsubscribeFn).toHaveBeenCalledTimes(1);

            // Cleanup
            await state.destroy(mockHandler);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('destroy Properties', () => {
    it('should be idempotent - multiple destroy calls safe', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100_000 }), // Timeout
          fc.integer({ min: 1, max: 10 }), // Number of destroy calls
          async (timeoutMs, destroyCallCount) => {
            // Arrange
            const mockLogger = {
              info: jest.fn(),
              warn: jest.fn(),
              error: jest.fn(),
              debug: jest.fn(),
            };
            const unsubscribeFn = jest.fn();
            const mockEventBus = {
              dispatch: jest.fn(),
              subscribe: jest.fn(() => unsubscribeFn),
            };
            const mockClearTimeout = jest.fn();

            const mockCtx = createMockContext('test-actor', mockEventBus, mockLogger);
            const mockHandler = createMockHandler(mockCtx, mockLogger);

            const state = new AwaitingExternalTurnEndState(mockHandler, {
              timeoutMs,
              setTimeoutFn: jest.fn(() => 'timeout-id'),
              clearTimeoutFn: mockClearTimeout,
            });

            await state.enterState(mockHandler, null);

            // Act - Call destroy multiple times
            for (let i = 0; i < destroyCallCount; i++) {
              await state.destroy(mockHandler);
            }

            // Assert - Property: ∀ n ≥ 1, calling destroy n times = calling once
            // Cleanup should occur exactly once, not n times
            expect(mockClearTimeout).toHaveBeenCalledTimes(1);
            expect(unsubscribeFn).toHaveBeenCalledTimes(1);

            // No errors thrown on subsequent calls
            await expect(state.destroy(mockHandler)).resolves.not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Cleanup Resilience Properties', () => {
    it('should safely handle falsy resource IDs during cleanup', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(null), // Timeout ID falsy values
            fc.constant(undefined),
            fc.constant(''),
            fc.constant(0),
            fc.constant(false)
          ),
          fc.oneof(
            fc.constant(null), // Subscription function falsy values
            fc.constant(undefined),
            fc.constant(''),
            fc.constant(0),
            fc.constant(false)
          ),
          async (corruptedTimeoutId, corruptedUnsubscribeFn) => {
            // Arrange - Create state with falsy resource IDs
            const mockLogger = {
              info: jest.fn(),
              warn: jest.fn(),
              error: jest.fn(),
              debug: jest.fn(),
            };
            const mockEventBus = {
              dispatch: jest.fn(),
              subscribe: jest.fn(() => corruptedUnsubscribeFn),
            };
            const mockSetTimeout = jest.fn(() => corruptedTimeoutId);
            const mockClearTimeout = jest.fn();

            const mockCtx = createMockContext('test-actor', mockEventBus, mockLogger);
            const mockHandler = createMockHandler(mockCtx, mockLogger);

            const state = new AwaitingExternalTurnEndState(mockHandler, {
              timeoutMs: 5_000,
              setTimeoutFn: mockSetTimeout,
              clearTimeoutFn: mockClearTimeout,
            });

            await state.enterState(mockHandler, null);

            // Act & Assert - Property: ∀ falsy IDs, cleanup never throws
            await expect(state.exitState(mockHandler, null)).resolves.not.toThrow();
            await expect(state.destroy(mockHandler)).resolves.not.toThrow();

            // Property verified: Falsy guards prevent cleanup calls, no exceptions
            // This tests the defensive "if (id)" checks in #clearGuards
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('State Transitions Are Always Valid (Bonus Property 5)', () => {
    it('should enforce valid state transitions for all sequences', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.oneof(fc.constant('enter'), fc.constant('exit'), fc.constant('destroy')),
            { minLength: 1, maxLength: 10 }
          ),
          async (transitionSequence) => {
            // Arrange
            const mockLogger = {
              info: jest.fn(),
              warn: jest.fn(),
              error: jest.fn(),
              debug: jest.fn(),
            };
            const mockEventBus = {
              dispatch: jest.fn(),
              subscribe: jest.fn(() => jest.fn()),
            };

            const mockCtx = createMockContext('test-actor', mockEventBus, mockLogger);
            const mockHandler = createMockHandler(mockCtx, mockLogger);

            const state = new AwaitingExternalTurnEndState(mockHandler, {
              timeoutMs: 5_000,
              setTimeoutFn: jest.fn(() => 'timeout-id'),
              clearTimeoutFn: jest.fn(),
            });

            // Act - Execute transition sequence
            for (const transition of transitionSequence) {
              if (transition === 'enter') {
                await state.enterState(mockHandler, null);
              } else if (transition === 'exit') {
                await state.exitState(mockHandler, null);
              } else if (transition === 'destroy') {
                await state.destroy(mockHandler);
              }
            }

            // Assert - No invalid transitions cause errors
            // All sequences should be safe (idempotent operations)
            await expect(state.destroy(mockHandler)).resolves.not.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Resource Count Invariant (Bonus Property 6)', () => {
    it('should maintain resource count invariant across lifecycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100_000 }),
          async (timeoutMs) => {
            // Arrange - Track resource creation/cleanup
            let timeoutCount = 0;
            let subscriptionCount = 0;

            const mockLogger = {
              info: jest.fn(),
              warn: jest.fn(),
              error: jest.fn(),
              debug: jest.fn(),
            };
            const mockEventBus = {
              dispatch: jest.fn(),
              subscribe: jest.fn(() => {
                subscriptionCount++;
                return () => {
                  subscriptionCount--;
                };
              }),
            };
            const mockSetTimeout = jest.fn(() => {
              timeoutCount++;
              return `timeout-${timeoutCount}`;
            });
            const mockClearTimeout = jest.fn(() => {
              timeoutCount--;
            });

            const mockCtx = createMockContext('test-actor', mockEventBus, mockLogger);
            const mockHandler = createMockHandler(mockCtx, mockLogger);

            const state = new AwaitingExternalTurnEndState(mockHandler, {
              timeoutMs,
              setTimeoutFn: mockSetTimeout,
              clearTimeoutFn: mockClearTimeout,
            });

            // Act
            await state.enterState(mockHandler, null);
            await state.destroy(mockHandler);

            // Assert - Property: Created resources = Cleaned resources
            expect(timeoutCount).toBe(0); // All timers cleared
            expect(subscriptionCount).toBe(0); // All subscriptions removed

            // Invariant: No resource leaks
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
