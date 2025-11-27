/**
 * @file Test suite for the AwaitingExternalTurnEndState class.
 *
 * This tests the Promise.race-based implementation that uses AbortController
 * for deterministic "first wins" behavior between event reception and timeout.
 *
 * @see src/turns/states/awaitingExternalTurnEndState.js
 * @see src/turns/utils/cancellablePrimitives.js
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { expectNoDispatch } from '../../../common/engine/dispatchTestUtils.js';

const TIMEOUT_MS = 100;

// --- Module Mocks ---

// Mocking TurnIdleState is necessary because the state under test creates
// a new instance of it for error recovery. This lets us verify that behavior.
jest.mock('../../../../src/turns/states/turnIdleState.js', () => ({
  TurnIdleState: jest.fn().mockImplementation((handler) => ({
    getStateName: () => 'MockedTurnIdleState',
    _handler: handler,
  })),
}));

// --- Imports ---

import { AwaitingExternalTurnEndState } from '../../../../src/turns/states/awaitingExternalTurnEndState.js';
import '../../../../src/turns/states/turnIdleState.js';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  TURN_ENDED_ID,
} from '../../../../src/constants/eventIds.js';

// --- Test Helper Mocks ---

/**
 * Creates a mock ILogger with jest.fn() for all methods.
 *
 * @returns {jest.Mocked<import('../../../../src/interfaces/coreServices.js').ILogger>} Mock logger
 */
const makeMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/**
 * Creates a mock SafeEventDispatcher that captures subscribers and allows manual event dispatch.
 *
 * @returns {object} Mock dispatcher with subscribe, dispatch, and test helpers
 */
const makeMockSafeEventDispatcher = () => {
  const subscribers = new Map();

  return {
    subscribe: jest.fn((eventId, callback) => {
      if (!subscribers.has(eventId)) {
        subscribers.set(eventId, new Set());
      }
      subscribers.get(eventId).add(callback);
      // Return unsubscribe function
      return jest.fn(() => {
        subscribers.get(eventId)?.delete(callback);
      });
    }),
    dispatch: jest.fn(),
    // Test helper to manually trigger events
    _triggerEvent: (eventId, event) => {
      const callbacks = subscribers.get(eventId);
      if (callbacks) {
        callbacks.forEach((cb) => cb(event));
      }
    },
    _getSubscribers: () => subscribers,
  };
};

/**
 * Creates a mock ITurnContext.
 *
 * @param {string} [actorId] - The ID of the actor for this context.
 * @returns {jest.Mocked<any>} Mock turn context
 */
const makeMockTurnContext = (actorId = 'player1') => ({
  getActor: jest.fn().mockReturnValue({ id: actorId }),
  getLogger: jest.fn().mockReturnValue(makeMockLogger()),
  getSafeEventDispatcher: jest.fn().mockReturnValue(makeMockSafeEventDispatcher()),
  setAwaitingExternalEvent: jest.fn(),
  isAwaitingExternalEvent: jest.fn().mockReturnValue(true),
  endTurn: jest.fn(),
  getChosenActionId: jest.fn(),
  getChosenAction: jest.fn(),
});

/**
 * Creates a mock BaseTurnHandler.
 *
 * @returns {jest.Mocked<any>} Mock handler
 */
const makeMockTurnHandler = () => ({
  _transitionToState: jest.fn(),
  getLogger: jest.fn().mockReturnValue(makeMockLogger()),
  getTurnContext: jest.fn(),
  _resetTurnStateAndResources: jest.fn(),
  resetStateAndResources: jest.fn(function (reason) {
    this._resetTurnStateAndResources(reason);
  }),
  requestIdleStateTransition: jest.fn().mockResolvedValue(undefined),
});

/**
 * Helper to flush all pending promises and timers.
 * Required because the Promise.race pattern interleaves microtasks with timers.
 *
 * @returns {Promise<void>}
 */
const flushPromisesAndTimers = async () => {
  // Flush microtask queue multiple times to handle nested promises
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

// --- Test Suite ---

describe('AwaitingExternalTurnEndState', () => {
  let mockHandler;
  let mockTurnContext;
  let mockLogger;
  let mockEventDispatcher;
  let state;

  beforeEach(() => {
    jest.useFakeTimers();

    mockHandler = makeMockTurnHandler();
    mockTurnContext = makeMockTurnContext('player-1');

    mockLogger = makeMockLogger();
    mockHandler.getLogger.mockReturnValue(mockLogger);
    mockTurnContext.getLogger.mockReturnValue(mockLogger);

    mockEventDispatcher = makeMockSafeEventDispatcher();
    mockTurnContext.getSafeEventDispatcher.mockReturnValue(mockEventDispatcher);

    mockHandler.getTurnContext.mockReturnValue(mockTurnContext);

    state = new AwaitingExternalTurnEndState(mockHandler, {
      timeoutMs: TIMEOUT_MS,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  // --- Basic State Properties ---
  test('getStateName should return the correct state name', () => {
    expect(state.getStateName()).toBe('AwaitingExternalTurnEndState');
  });

  // --- enterState ---
  describe('enterState', () => {
    test('should log an error and transition to idle if no turn context is available', async () => {
      // Arrange
      mockHandler.getTurnContext.mockReturnValue(null);

      // Act
      await state.enterState(mockHandler, null);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'AwaitingExternalTurnEndState: No ITurnContext available. Resetting to idle.'
      );
      expect(mockHandler.requestIdleStateTransition).toHaveBeenCalledTimes(1);
    });

    test('should set up subscription and mark context as awaiting on successful entry', async () => {
      // Arrange
      mockTurnContext.getActor.mockReturnValue({ id: 'actor-alpha' });

      // Act - don't await because enterState now blocks until event/timeout
      const enterPromise = state.enterState(mockHandler, null);

      // Allow microtasks to run - need to flush multiple times for nested promises
      await flushPromisesAndTimers();

      // Assert - check that setup happened
      expect(mockEventDispatcher.subscribe).toHaveBeenCalledWith(
        TURN_ENDED_ID,
        expect.any(Function)
      );
      expect(mockTurnContext.setAwaitingExternalEvent).toHaveBeenCalledWith(
        true,
        'actor-alpha'
      );

      // Cleanup - trigger timeout to complete the promise
      jest.advanceTimersByTime(TIMEOUT_MS);
      await flushPromisesAndTimers();
      await enterPromise;
    });

    test('should log error if dispatcher is not available', async () => {
      // Arrange
      mockTurnContext.getSafeEventDispatcher.mockReturnValue(null);

      // Act
      await state.enterState(mockHandler, null);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('No dispatcher available')
      );
    });

    test.each([
      [
        'getChosenActionId',
        () => {
          mockTurnContext.getChosenActionId.mockReturnValue('action-from-id');
        },
        'action-from-id',
      ],
      [
        'getChosenAction',
        () => {
          mockTurnContext.getChosenAction.mockReturnValue({
            actionDefinitionId: 'action-from-def',
          });
        },
        'action-from-def',
      ],
      ['fallback', () => {}, 'unknown-action'],
    ])(
      'should resolve awaitingActionId using %s',
      async (caseName, setupFn, expectedActionId) => {
        // Arrange
        setupFn();

        // Act - start enterState
        const enterPromise = state.enterState(mockHandler, null);

        // Flush promises to allow state setup
        await flushPromisesAndTimers();

        // Trigger timeout to complete
        jest.advanceTimersByTime(TIMEOUT_MS);
        await flushPromisesAndTimers();
        await enterPromise;

        // Assert - check the actionId in the dispatched error
        expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
        const dispatchPayload = mockEventDispatcher.dispatch.mock.calls[0][1];
        expect(dispatchPayload.details.actionId).toBe(expectedActionId);
      }
    );
  });

  // --- Event Wins Race ---
  describe('Event Wins Race', () => {
    test('should end the turn with null error when success event is received before timeout', async () => {
      // Arrange
      const successEvent = { payload: { entityId: 'player-1', success: true } };

      // Act - start enterState
      const enterPromise = state.enterState(mockHandler, null);

      // Wait for subscription to be set up
      await flushPromisesAndTimers();

      // Trigger the event (simulating rule dispatching turn_ended)
      mockEventDispatcher._triggerEvent(TURN_ENDED_ID, successEvent);

      // Wait for enterState to complete
      await flushPromisesAndTimers();
      await enterPromise;

      // Assert
      expect(mockTurnContext.endTurn).toHaveBeenCalledTimes(1);
      expect(mockTurnContext.endTurn).toHaveBeenCalledWith(null);
      // Should have cleaned up awaiting flag
      expect(mockTurnContext.setAwaitingExternalEvent).toHaveBeenCalledWith(
        false,
        'player-1'
      );
    });

    test('should end the turn with error when failure event is received before timeout', async () => {
      // Arrange
      const failureError = new Error('Action failed externally');
      const failureEvent = {
        payload: { entityId: 'player-1', success: false, error: failureError },
      };

      // Act
      const enterPromise = state.enterState(mockHandler, null);
      await flushPromisesAndTimers();

      mockEventDispatcher._triggerEvent(TURN_ENDED_ID, failureEvent);
      await flushPromisesAndTimers();
      await enterPromise;

      // Assert
      expect(mockTurnContext.endTurn).toHaveBeenCalledTimes(1);
      expect(mockTurnContext.endTurn).toHaveBeenCalledWith(failureError);
    });

    test('should ignore events for other actors', async () => {
      // Arrange
      const eventForOtherActor = { payload: { entityId: 'not-our-actor' } };
      const eventForUs = { payload: { entityId: 'player-1', success: true } };

      // Act
      const enterPromise = state.enterState(mockHandler, null);
      await flushPromisesAndTimers();

      // Send event for wrong actor (should be ignored)
      mockEventDispatcher._triggerEvent(TURN_ENDED_ID, eventForOtherActor);

      // Then send event for correct actor
      mockEventDispatcher._triggerEvent(TURN_ENDED_ID, eventForUs);
      await flushPromisesAndTimers();
      await enterPromise;

      // Assert - should only have called endTurn once (for our actor)
      expect(mockTurnContext.endTurn).toHaveBeenCalledTimes(1);
      expect(mockTurnContext.endTurn).toHaveBeenCalledWith(null);
    });
  });

  // --- Timeout Wins Race ---
  describe('Timeout Wins Race', () => {
    test('should dispatch error and end turn with timeout error when no event received', async () => {
      // Arrange
      mockTurnContext.getChosenActionId.mockReturnValue('test-action');

      // Act
      const enterPromise = state.enterState(mockHandler, null);

      // Flush to allow state setup
      await flushPromisesAndTimers();

      // Advance time past timeout
      jest.advanceTimersByTime(TIMEOUT_MS);
      await flushPromisesAndTimers();
      await enterPromise;

      // Assert - error was dispatched
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: `No rule ended the turn for actor player-1 after action 'test-action'. The engine timed out after ${TIMEOUT_MS} ms.`,
          details: {
            code: 'TURN_END_TIMEOUT',
            actorId: 'player-1',
            actionId: 'test-action',
          },
        }
      );

      // Assert - turn was ended with error
      expect(mockTurnContext.endTurn).toHaveBeenCalledTimes(1);
      const endTurnError = mockTurnContext.endTurn.mock.calls[0][0];
      expect(endTurnError).toBeInstanceOf(Error);
      expect(endTurnError.code).toBe('TURN_END_TIMEOUT');
      expect(endTurnError.message).toContain(`timed out after ${TIMEOUT_MS} ms`);
    });

    test('should not dispatch error if event arrives just before timeout', async () => {
      // Arrange
      const successEvent = { payload: { entityId: 'player-1', success: true } };

      // Act
      const enterPromise = state.enterState(mockHandler, null);
      await flushPromisesAndTimers();

      // Advance time but not past timeout
      jest.advanceTimersByTime(TIMEOUT_MS - 1);
      await flushPromisesAndTimers();

      // Event arrives just in time
      mockEventDispatcher._triggerEvent(TURN_ENDED_ID, successEvent);
      await flushPromisesAndTimers();
      await enterPromise;

      // Assert - no error dispatched
      expectNoDispatch(mockEventDispatcher.dispatch);
      expect(mockTurnContext.endTurn).toHaveBeenCalledWith(null);
    });
  });

  // --- Cleanup on Exit/Destroy ---
  describe('Cleanup', () => {
    test('exitState should abort pending promises and clear awaiting flag', async () => {
      // Arrange - start enterState but don't let it complete
      const enterPromise = state.enterState(mockHandler, null);
      await flushPromisesAndTimers();

      // Get internal state to verify abort controller was created
      const internalState = state.getInternalStateForTest();
      expect(internalState.abortController).not.toBeNull();

      // Act - exit the state before event/timeout
      await state.exitState(mockHandler, null);

      // Flush any remaining microtasks
      await flushPromisesAndTimers();

      // The enterPromise will resolve (not reject) because AbortError is caught internally
      await expect(enterPromise).resolves.toBeUndefined();

      // Assert
      expect(mockTurnContext.setAwaitingExternalEvent).toHaveBeenCalledWith(
        false,
        'player-1'
      );
      expect(state.getInternalStateForTest().abortController).toBeNull();
    });

    test('destroy should abort pending promises and clear awaiting flag', async () => {
      // Arrange
      const enterPromise = state.enterState(mockHandler, null);
      await flushPromisesAndTimers();

      // Act
      await state.destroy(mockHandler);
      await flushPromisesAndTimers();
      await expect(enterPromise).resolves.toBeUndefined();

      // Assert
      expect(mockTurnContext.setAwaitingExternalEvent).toHaveBeenCalledWith(
        false,
        'player-1'
      );
      expect(state.getInternalStateForTest().abortController).toBeNull();
    });

    test('cleanup should be idempotent', async () => {
      // Arrange
      const enterPromise = state.enterState(mockHandler, null);
      await flushPromisesAndTimers();

      // Act - cleanup multiple times
      await state.exitState(mockHandler, null);
      await flushPromisesAndTimers();
      await enterPromise;

      // After exitState, isAwaitingExternalEvent should have been set to false
      // Simulate that by having the mock return false after cleanup
      mockTurnContext.isAwaitingExternalEvent.mockReturnValue(false);

      // Reset call count to verify subsequent calls don't increment
      const callCount = mockTurnContext.setAwaitingExternalEvent.mock.calls.length;

      await state.destroy(mockHandler);

      // Assert - no additional setAwaitingExternalEvent calls
      // (because isAwaitingExternalEvent returns false after first cleanup)
      expect(mockTurnContext.setAwaitingExternalEvent.mock.calls.length).toBe(
        callCount
      );
    });
  });

  // --- Internal State ---
  describe('Internal State', () => {
    test('getInternalStateForTest returns expected fields', () => {
      const internalState = state.getInternalStateForTest();
      expect(internalState).toHaveProperty('abortController');
      expect(internalState).toHaveProperty('awaitingActionId');
    });

    test('internal state is reset after exit', async () => {
      // Arrange
      mockTurnContext.getChosenActionId.mockReturnValue('some-action');
      const enterPromise = state.enterState(mockHandler, null);
      await flushPromisesAndTimers();

      // Act
      await state.exitState(mockHandler, null);
      await flushPromisesAndTimers();
      await enterPromise;

      // Assert
      expect(state.getInternalStateForTest()).toEqual({
        abortController: null,
        awaitingActionId: 'unknown-action',
      });
    });

    test('internal state is reset after destroy', async () => {
      // Arrange
      mockTurnContext.getChosenActionId.mockReturnValue('some-action');
      const enterPromise = state.enterState(mockHandler, null);
      await flushPromisesAndTimers();

      // Act
      await state.destroy(mockHandler);
      await flushPromisesAndTimers();
      await enterPromise;

      // Assert
      expect(state.getInternalStateForTest()).toEqual({
        abortController: null,
        awaitingActionId: 'unknown-action',
      });
    });
  });

  // --- Ignored Actions ---
  describe('Ignored Actions', () => {
    test('handleSubmittedCommand should be a no-op', async () => {
      // Act
      await state.handleSubmittedCommand();

      // Assert
      expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
      expect(mockHandler._transitionToState).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  // --- Constructor Validation ---
  describe('Constructor Validation', () => {
    test('should throw InvalidArgumentError when timeoutMs is NaN', () => {
      const { InvalidArgumentError } = require('../../../../src/errors/invalidArgumentError.js');
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, {
          timeoutMs: NaN,
        });
      }).toThrow(InvalidArgumentError);

      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, {
          timeoutMs: NaN,
        });
      }).toThrow(/timeoutMs must be a positive finite number.*NaN/);
    });

    test('should throw InvalidArgumentError when timeoutMs is negative', () => {
      const { InvalidArgumentError } = require('../../../../src/errors/invalidArgumentError.js');
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, {
          timeoutMs: -1000,
        });
      }).toThrow(InvalidArgumentError);

      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, {
          timeoutMs: -1000,
        });
      }).toThrow(/timeoutMs must be a positive finite number.*-1000/);
    });

    test('should throw InvalidArgumentError when timeoutMs is Infinity', () => {
      const { InvalidArgumentError } = require('../../../../src/errors/invalidArgumentError.js');
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, {
          timeoutMs: Infinity,
        });
      }).toThrow(InvalidArgumentError);

      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, {
          timeoutMs: Infinity,
        });
      }).toThrow(/timeoutMs must be a positive finite number.*Infinity/);
    });

    test('should throw InvalidArgumentError when timeoutMs is zero', () => {
      const { InvalidArgumentError } = require('../../../../src/errors/invalidArgumentError.js');
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, {
          timeoutMs: 0,
        });
      }).toThrow(InvalidArgumentError);

      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, {
          timeoutMs: 0,
        });
      }).toThrow(/timeoutMs must be a positive finite number.*0/);
    });
  });
});
