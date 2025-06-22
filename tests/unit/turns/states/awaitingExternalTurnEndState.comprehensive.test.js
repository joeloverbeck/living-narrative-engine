/**
 * @file Test suite for the AwaitingExternalTurnEndState class.
 * @see tests/turns/states/awaitingExternalTurnEndState.comprehensive.test.js
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { flushPromisesAndTimers } from '../../../common/turns/turnManagerTestBed.js';

// Use fake timers to control setTimeout/clearTimeout and advance time manually.
jest.useFakeTimers();
const TIMEOUT_MS = 10;

// --- Module Mocks ---

// Mocking TurnIdleState is necessary because the state under test creates
// a new instance of it for error recovery. This lets us verify that behavior.
jest.mock('../../../../src/turns/states/turnIdleState.js', () => ({
  TurnIdleState: jest.fn().mockImplementation((handler) => ({
    // Provide a mock getStateName for logging purposes during transitions.
    getStateName: () => 'MockedTurnIdleState',
    // Store the handler it was created with for verification.
    _handler: handler,
  })),
}));

// --- Imports ---

import { AwaitingExternalTurnEndState } from '../../../../src/turns/states/awaitingExternalTurnEndState.js';
import { TurnIdleState } from '../../../../src/turns/states/turnIdleState.js'; // This resolves to our mock above.
import {
  SYSTEM_ERROR_OCCURRED_ID,
  TURN_ENDED_ID,
} from '../../../../src/constants/eventIds.js';

// --- Test Helper Mocks ---

/**
 * Creates a mock ILogger with jest.fn() for all methods.
 *
 * @returns {jest.Mocked<import('../../../../src/interfaces/coreServices.js').ILogger>}
 */
const makeMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/**
 * Creates a mock SafeEventDispatcher.
 *
 * @returns {jest.Mocked<{subscribe: Function, dispatch: Function}>}
 */
const makeMockSafeEventDispatcher = () => ({
  subscribe: jest.fn(),
  dispatch: jest.fn(),
});

/**
 * Creates a mock ITurnContext.
 *
 * @param {string} [actorId] - The ID of the actor for this context.
 * @returns {jest.Mocked<any>} A fully mocked ITurnContext object.
 */
const makeMockTurnContext = (actorId = 'player1') => ({
  getActor: jest.fn().mockReturnValue({ id: actorId }),
  getLogger: jest.fn().mockReturnValue(makeMockLogger()),
  getSafeEventDispatcher: jest
    .fn()
    .mockReturnValue(makeMockSafeEventDispatcher()),
  setAwaitingExternalEvent: jest.fn(),
  isAwaitingExternalEvent: jest.fn().mockReturnValue(true), // Default to true for an active state.
  endTurn: jest.fn(),
  getChosenActionId: jest.fn(),
  getChosenAction: jest.fn(),
});

/**
 * Creates a mock BaseTurnHandler.
 *
 * @returns {jest.Mocked<any>} A fully mocked BaseTurnHandler object.
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

// --- Test Suite ---

describe('AwaitingExternalTurnEndState', () => {
  let mockHandler;
  let mockTurnContext;
  let mockLogger;
  let mockEventDispatcher;
  let state;

  // Store the listener passed to dispatcher.subscribe to simulate events.
  let turnEndedEventListener;
  // Store the unsubscribe function returned by dispatcher.subscribe.
  let mockUnsubscribeFn;

  // --- FIX: Add spies for global timer functions ---
  let setTimeoutSpy;
  let clearTimeoutSpy;

  beforeEach(() => {
    // Spy on global timers before each test to allow for assertions.
    setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    mockHandler = makeMockTurnHandler();
    mockTurnContext = makeMockTurnContext('player-1');

    // --- FIX: Unify the logger instance ---
    // This single logger will be used by both handler and context mocks.
    mockLogger = makeMockLogger();
    mockHandler.getLogger.mockReturnValue(mockLogger);
    mockTurnContext.getLogger.mockReturnValue(mockLogger);

    mockEventDispatcher = mockTurnContext.getSafeEventDispatcher();

    // Link the handler and context.
    mockHandler.getTurnContext.mockReturnValue(mockTurnContext);

    // Setup the event dispatcher mock to capture the listener and return a mock unsubscribe function.
    mockUnsubscribeFn = jest.fn();
    mockEventDispatcher.subscribe.mockImplementation((eventId, listener) => {
      if (eventId === TURN_ENDED_ID) {
        turnEndedEventListener = listener;
      }
      return mockUnsubscribeFn;
    });

    state = new AwaitingExternalTurnEndState(mockHandler, TIMEOUT_MS);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clear any pending timers to prevent test bleed.
    jest.clearAllTimers();

    // --- FIX: Restore original timer functions ---
    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
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
      // This uses the handler's logger, which we've mocked.

      // Act
      await state.enterState(mockHandler, null);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'AwaitingExternalTurnEndState: No ITurnContext available. Resetting to idle.'
      );
      expect(mockHandler.requestIdleStateTransition).toHaveBeenCalledTimes(1);
    });

    test('should set up guards and subscribe to events on successful entry', async () => {
      // Arrange
      mockTurnContext.getActor.mockReturnValue({ id: 'actor-alpha' });

      // Act
      await state.enterState(mockHandler, null);

      // Assert
      // 1. Subscribes to the turn ended event.
      expect(mockEventDispatcher.subscribe).toHaveBeenCalledWith(
        TURN_ENDED_ID,
        expect.any(Function)
      );

      // 2. Marks the context as awaiting an event.
      expect(mockTurnContext.setAwaitingExternalEvent).toHaveBeenCalledWith(
        true,
        'actor-alpha'
      );

      // 3. Sets a timeout with the provided value.
      expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
      expect(setTimeoutSpy).toHaveBeenCalledWith(
        expect.any(Function),
        TIMEOUT_MS
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

        // Act
        await state.enterState(mockHandler, null);
        // Manually trigger timeout to check the actionId in the generated error message.
        await flushPromisesAndTimers();

        // Assert
        expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
        const dispatchPayload = mockEventDispatcher.dispatch.mock.calls[0][1];
        expect(dispatchPayload.details.actionId).toBe(expectedActionId);
      }
    );
  });

  // --- handleTurnEndedEvent ---
  describe('handleTurnEndedEvent', () => {
    beforeEach(async () => {
      // Enter the state to set everything up.
      await state.enterState(mockHandler, null);
    });

    test('should do nothing if the context is lost', async () => {
      // Arrange
      mockHandler.getTurnContext.mockReturnValue(null);

      // Act
      await state.handleTurnEndedEvent(mockHandler, {
        payload: { entityId: 'player-1' },
      });

      // Assert
      expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
    });

    test('should ignore events for other actors', async () => {
      // Arrange
      const eventForOtherActor = { payload: { entityId: 'not-our-actor' } };

      // Act
      await state.handleTurnEndedEvent(mockHandler, eventForOtherActor);

      // Assert
      expect(clearTimeoutSpy).not.toHaveBeenCalled();
      expect(mockUnsubscribeFn).not.toHaveBeenCalled();
      expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
    });

    test('should end the turn with a null error when a valid success event is received', async () => {
      // Arrange
      const successEvent = { payload: { entityId: 'player-1', success: true } };

      // Act
      await state.handleTurnEndedEvent(mockHandler, successEvent);

      // Assert
      // Guards should be cleared.
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
      expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1);
      expect(mockTurnContext.setAwaitingExternalEvent).toHaveBeenCalledWith(
        false,
        'player-1'
      );

      // Turn should end successfully (with a null error).
      expect(mockTurnContext.endTurn).toHaveBeenCalledTimes(1);
      expect(mockTurnContext.endTurn).toHaveBeenCalledWith(null);
    });

    test('should end the turn with an error object when a valid failure event is received', async () => {
      // Arrange
      const failureError = new Error('Action failed externally');
      const failureEvent = {
        payload: { entityId: 'player-1', success: false, error: failureError },
      };

      // Act
      await state.handleTurnEndedEvent(mockHandler, failureEvent);

      // Assert
      // Guards should be cleared.
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
      expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1);
      expect(mockTurnContext.setAwaitingExternalEvent).toHaveBeenCalledWith(
        false,
        'player-1'
      );

      // Turn should end with the provided error.
      expect(mockTurnContext.endTurn).toHaveBeenCalledTimes(1);
      expect(mockTurnContext.endTurn).toHaveBeenCalledWith(failureError);
    });
  });

  // --- Timeout Behavior ---
  describe('Timeout Behavior', () => {
    beforeEach(async () => {
      // Enter the state to set up the timeout.
      mockTurnContext.getChosenActionId.mockReturnValue('test-action');
      await state.enterState(mockHandler, null);
    });

    test('should do nothing if timeout fires after state has been cleaned up', async () => {
      // Arrange
      // Simulate cleanup (e.g., a turn_ended event was received first).
      mockTurnContext.isAwaitingExternalEvent.mockReturnValue(false);

      // Act
      await flushPromisesAndTimers();

      // Assert
      expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
      expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
    });

    test('should dispatch an error and end the turn when timeout fires', async () => {
      // Arrange
      expect(setTimeoutSpy).toHaveBeenCalledTimes(1);

      // Act
      await flushPromisesAndTimers();

      // Assert
      // 1. A display error event is dispatched.
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

      // 2. The turn is ended with a timeout error.
      expect(mockTurnContext.endTurn).toHaveBeenCalledTimes(1);
      const endTurnError = mockTurnContext.endTurn.mock.calls[0][0];
      expect(endTurnError).toBeInstanceOf(Error);
      expect(endTurnError.code).toBe('TURN_END_TIMEOUT');
      expect(endTurnError.message).toContain(
        `timed out after ${TIMEOUT_MS} ms`
      );
    });

    test('should recover if endTurn throws an error during timeout handling', async () => {
      // Arrange
      const endTurnFailure = new Error('Failed to end turn');
      mockTurnContext.endTurn.mockImplementation(() => {
        throw endTurnFailure;
      });

      // Act
      await flushPromisesAndTimers();

      // Assert
      // It still attempts to end the turn.
      expect(mockTurnContext.endTurn).toHaveBeenCalledTimes(1);

      // It logs the recovery error. This now checks the unified logger.
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('failed to end turn after timeout'),
        endTurnFailure
      );

      // It triggers the handler's recovery mechanism.
      expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith(
        'timeout-recovery'
      );
      expect(mockHandler.requestIdleStateTransition).toHaveBeenCalledTimes(1);
    });
  });

  // --- Cleanup ---
  describe('Cleanup', () => {
    beforeEach(async () => {
      await state.enterState(mockHandler, null);
      // Verify setup occurred.
      expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
      expect(mockEventDispatcher.subscribe).toHaveBeenCalledTimes(1);
      expect(mockTurnContext.setAwaitingExternalEvent).toHaveBeenCalledWith(
        true,
        'player-1'
      );
    });

    test('exitState should call #clearGuards', async () => {
      // Act
      await state.exitState(mockHandler, null);

      // Assert
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
      expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1);
      expect(mockTurnContext.setAwaitingExternalEvent).toHaveBeenCalledWith(
        false,
        'player-1'
      );
    });

    test('destroy should call #clearGuards', async () => {
      // Act
      await state.destroy(mockHandler);

      // Assert
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
      expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1);
      expect(mockTurnContext.setAwaitingExternalEvent).toHaveBeenCalledWith(
        false,
        'player-1'
      );
    });

    test('#clearGuards should be idempotent', async () => {
      // Act
      await state.exitState(mockHandler, null); // First call to clearGuards.

      // Assert first call worked as expected.
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
      expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1);
      expect(mockTurnContext.setAwaitingExternalEvent).toHaveBeenCalledTimes(2); // true on enter, false on exit.

      // Act again (e.g., destroy is called after exit).
      await state.destroy(mockHandler);

      // Assert - counters should not increment further because guards are now null/undefined.
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
      expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1);
    });
  });

  // --- Ignored Actions ---
  describe('Ignored Actions', () => {
    test('handleSubmittedCommand should be a no-op', async () => {
      // Act
      // This method is intentionally empty, so we just call it.
      await state.handleSubmittedCommand();

      // Assert
      // Check that no core logic was triggered.
      expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
      expect(mockHandler._transitionToState).not.toHaveBeenCalled();
      // The overridden method is empty, so it shouldn't call the superclass method which logs an error.
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});
