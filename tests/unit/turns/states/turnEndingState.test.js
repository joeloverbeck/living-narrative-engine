// tests/turns/states/turnEndingState.test.js
// --- FILE START ---

/**
 * @file Unit tests for TurnEndingState.
 *
 * TurnEndingState is now a TERMINAL STATE - it does not dispatch events or request
 * transitions. Instead, it performs cleanup and signals normal termination.
 * BaseTurnHandler.destroy() handles the turn-ended notification and the
 * transition back to Idle state.
 *
 * This design eliminates the race condition where the notification triggered
 * handler destruction mid-state-entry.
 *
 * Ticket: Refactor TurnEndingState to Use ITurnContext
 * Parent Epic: PTH-REFACTOR-001 (DecoupleHumanTurnHandler)
 * Related Ticket: PTH-REFACTOR-002 (Refactor Core Turn States to Utilize ITurnContext Exclusively)
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  test,
} from '@jest/globals';

// Module to be tested
import { TurnEndingState } from '../../../../src/turns/states/turnEndingState.js';

// Dependencies
import { TurnIdleState } from '../../../../src/turns/states/turnIdleState.js';
import { AbstractTurnState } from '../../../../src/turns/states/abstractTurnState.js';
import { safeDispatchError } from '../../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

// --- Mocks & Test Utilities ---

const mockSystemLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  createChild: jest.fn(() => mockSystemLogger),
};

const mockContextSpecificLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  createChild: jest.fn(() => mockContextSpecificLogger),
};

const createMockActor = (id = 'test-actor-ending-turn') => ({
  id: id,
  name: `MockEndingTurnActor-${id}`,
});

const mockTurnEndPortInstance = {
  notifyTurnEnded: jest.fn().mockResolvedValue(undefined),
};

const createMockTurnContext = (
  actor,
  loggerInstance = mockContextSpecificLogger,
  services = {}
) => {
  const defaultServices = {
    turnEndPort: mockTurnEndPortInstance,
    ...services,
  };
  const mockContext = {
    getActor: jest.fn().mockReturnValue(actor),
    getLogger: jest.fn().mockReturnValue(loggerInstance),
    getTurnEndPort: jest.fn().mockReturnValue(defaultServices.turnEndPort),
    isValid: jest.fn().mockReturnValue(true), // Assume valid by default
    endTurn: jest.fn(),
    requestTransition: jest.fn(),
    requestIdleStateTransition: jest.fn(), // Stub idle transition
    setAwaitingExternalEvent: jest.fn(),
    isAwaitingExternalEvent: jest.fn(),
    getSafeEventDispatcher: jest.fn(() => defaultServices.safeEventDispatcher),
    // ... other services
  };
  return mockContext;
};

const createMockBaseTurnHandler = (loggerInstance = mockSystemLogger) => {
  const handlerMock = {
    _currentState: null,
    _currentTurnContext: null,
    _currentActor: null,
    _isDestroyed: false,
    safeEventDispatcher: null,

    getLogger: jest.fn().mockReturnValue(loggerInstance),
    getTurnContext: jest.fn(() => handlerMock._currentTurnContext),
    getCurrentActor: jest.fn(() => handlerMock._currentActor),
    _transitionToState: jest.fn(async (newState) => {
      handlerMock._currentState = newState;
    }),
    _resetTurnStateAndResources: jest.fn((logContext) => {
      handlerMock._currentTurnContext = null;
      handlerMock._currentActor = null;
    }),
    resetStateAndResources: jest.fn((reason) => {
      handlerMock._resetTurnStateAndResources(reason);
    }),
    signalNormalApparentTermination: jest.fn(),
    destroy: jest.fn(async () => {
      handlerMock._isDestroyed = true;
      handlerMock._resetTurnStateAndResources('destroy-handler');
      if (!(handlerMock._currentState instanceof TurnIdleState)) {
        await handlerMock._transitionToState(new TurnIdleState(handlerMock));
      }
    }),
    getSafeEventDispatcher: jest.fn(function () {
      return this.safeEventDispatcher;
    }),
    getCurrentState: jest.fn(function () {
      return this._currentState;
    }),

    // Helpers for tests
    _TEST_setCurrentTurnContext(context) {
      handlerMock._currentTurnContext = context;
      handlerMock._currentActor = context ? context.getActor() : null;
    },
    _TEST_setCurrentActor(actor) {
      handlerMock._currentActor = actor;
    },
  };
  handlerMock._currentState = new TurnIdleState(handlerMock);
  return handlerMock;
};

// --- Test Suite ---
describe('TurnEndingState', () => {
  let mockHandler;
  let testActor;
  let testTurnContext;
  let turnEndingState;
  let mockSafeEventDispatcher;

  const actorId = 'endingActor123';
  const differentActorId = 'otherActor789';

  let superEnterSpy;
  let superExitSpy;
  let superDestroySpy;

  beforeEach(() => {
    jest.clearAllMocks();

    testActor = createMockActor(actorId);
    mockHandler = createMockBaseTurnHandler(mockSystemLogger);
    mockSafeEventDispatcher = { dispatch: jest.fn() };
    testTurnContext = createMockTurnContext(
      testActor,
      mockContextSpecificLogger,
      { safeEventDispatcher: mockSafeEventDispatcher }
    );

    mockHandler._TEST_setCurrentTurnContext(testTurnContext);
    mockHandler._TEST_setCurrentActor(testActor);

    superEnterSpy = jest
      .spyOn(AbstractTurnState.prototype, 'enterState')
      .mockResolvedValue(undefined);
    superExitSpy = jest
      .spyOn(AbstractTurnState.prototype, 'exitState')
      .mockResolvedValue(undefined);
    superDestroySpy = jest
      .spyOn(AbstractTurnState.prototype, 'destroy')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createTestState = (currentActorId = actorId, error = null) => {
    return new TurnEndingState(mockHandler, currentActorId, error);
  };

  describe('enterState()', () => {
    describe('Successful Turn End (Context Valid, Actor Match, No Error)', () => {
      beforeEach(async () => {
        mockHandler._TEST_setCurrentTurnContext(testTurnContext);
        mockHandler._TEST_setCurrentActor(testActor);

        turnEndingState = createTestState(actorId, null);
        await turnEndingState.enterState(mockHandler, null);
      });

      it('should call super.enterState', () => {
        expect(superEnterSpy).toHaveBeenCalledWith(mockHandler, null);
      });

      // NOTE: notifyTurnEnded has been moved to BaseTurnHandler.destroy()
      // to eliminate the race condition. It is no longer called in enterState.
      it('should NOT call ITurnEndPort.notifyTurnEnded (moved to BaseTurnHandler.destroy)', () => {
        expect(mockTurnEndPortInstance.notifyTurnEnded).not.toHaveBeenCalled();
      });

      it('should call handler.signalNormalApparentTermination if function exists and context actor matches', () => {
        expect(mockHandler.signalNormalApparentTermination).toHaveBeenCalled();
      });

      it('should call handler._resetTurnStateAndResources', () => {
        expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith(
          `enterState-TurnEndingState-actor-${actorId}`
        );
      });

      // NOTE: requestIdleStateTransition has been moved to BaseTurnHandler.destroy()
      // TurnEndingState is now a terminal state that awaits destruction.
      it('should NOT request idle state transition (now handled by BaseTurnHandler.destroy)', () => {
        expect(testTurnContext.requestIdleStateTransition).not.toHaveBeenCalled();
      });
    });

    describe('Turn End with Error (Context Valid, Actor Match)', () => {
      const error = new Error('Turn Failed Miserably');
      beforeEach(async () => {
        mockHandler._TEST_setCurrentTurnContext(testTurnContext);
        mockHandler._TEST_setCurrentActor(testActor);

        turnEndingState = createTestState(actorId, error);
        await turnEndingState.enterState(mockHandler, null);
      });

      // NOTE: notifyTurnEnded has been moved to BaseTurnHandler.destroy()
      it('should NOT call ITurnEndPort.notifyTurnEnded (moved to BaseTurnHandler.destroy)', () => {
        expect(mockTurnEndPortInstance.notifyTurnEnded).not.toHaveBeenCalled();
      });

      it('should still call handler.signalNormalApparentTermination', () => {
        expect(mockHandler.signalNormalApparentTermination).toHaveBeenCalled();
      });

      // NOTE: requestIdleStateTransition has been moved to BaseTurnHandler.destroy()
      it('should call handler._resetTurnStateAndResources but NOT request idle transition', () => {
        expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
        expect(testTurnContext.requestIdleStateTransition).not.toHaveBeenCalled();
      });
    });

    describe('ITurnContext Missing on Handler', () => {
      beforeEach(async () => {
        mockHandler._TEST_setCurrentTurnContext(null);
        mockHandler._TEST_setCurrentActor(null);

        turnEndingState = createTestState(actorId, null);
        await turnEndingState.enterState(mockHandler, null);
      });

      // NOTE: notifyTurnEnded is no longer called in enterState - moved to BaseTurnHandler.destroy()
      it('should NOT call ITurnEndPort.notifyTurnEnded (notification moved to destroy)', () => {
        expect(mockTurnEndPortInstance.notifyTurnEnded).not.toHaveBeenCalled();
      });

      it('should NOT call handler.signalNormalApparentTermination (as context actor cannot be confirmed)', () => {
        expect(
          mockHandler.signalNormalApparentTermination
        ).not.toHaveBeenCalled();
        expect(mockSystemLogger.debug).toHaveBeenCalledWith(
          `TurnEndingState: Normal apparent termination not signaled. Context actor ('None') vs target actor ('${actorId}') mismatch or no context actor.`
        );
      });

      it('should call handler._resetTurnStateAndResources (no direct _transitionToState)', () => {
        expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
        expect(mockHandler._transitionToState).not.toHaveBeenCalled();
      });
    });

    describe('ITurnContext Actor Mismatch', () => {
      let mismatchedContext;
      beforeEach(async () => {
        const mismatchedActor = createMockActor(differentActorId);
        mismatchedContext = createMockTurnContext(
          mismatchedActor,
          mockContextSpecificLogger,
          { safeEventDispatcher: mockSafeEventDispatcher }
        );
        mockHandler._TEST_setCurrentTurnContext(mismatchedContext);
        mockHandler._TEST_setCurrentActor(mismatchedActor);

        turnEndingState = createTestState(actorId, null);
        await turnEndingState.enterState(mockHandler, null);
      });

      // NOTE: notifyTurnEnded is no longer called in enterState - moved to BaseTurnHandler.destroy()
      it('should NOT call ITurnEndPort.notifyTurnEnded (notification moved to destroy)', () => {
        expect(mockTurnEndPortInstance.notifyTurnEnded).not.toHaveBeenCalled();
      });

      it('should NOT call handler.signalNormalApparentTermination due to actor mismatch', () => {
        expect(
          mockHandler.signalNormalApparentTermination
        ).not.toHaveBeenCalled();
        expect(mockContextSpecificLogger.debug).toHaveBeenCalledWith(
          `TurnEndingState: Normal apparent termination not signaled. Context actor ('${differentActorId}') vs target actor ('${actorId}') mismatch or no context actor.`
        );
      });

      // NOTE: requestIdleStateTransition is no longer called - now handled by BaseTurnHandler.destroy()
      it('should call handler._resetTurnStateAndResources but NOT request idle transition', () => {
        expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
        expect(mismatchedContext.requestIdleStateTransition).not.toHaveBeenCalled();
      });
    });

    // NOTE: This test no longer applies - notifyTurnEnded is now called in BaseTurnHandler.destroy()
    // The test verifies the simplified behavior where cleanup continues even without notification
    it('should proceed with cleanup without calling notifyTurnEnded (moved to BaseTurnHandler.destroy)', async () => {
      mockHandler._TEST_setCurrentTurnContext(testTurnContext);

      turnEndingState = createTestState(actorId, null);
      await turnEndingState.enterState(mockHandler, null);

      // notifyTurnEnded is not called in enterState anymore
      expect(mockTurnEndPortInstance.notifyTurnEnded).not.toHaveBeenCalled();
      expect(mockHandler.signalNormalApparentTermination).toHaveBeenCalled();
      expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
      // requestIdleStateTransition is not called in enterState anymore
      expect(testTurnContext.requestIdleStateTransition).not.toHaveBeenCalled();
    });

    it('should skip calling signalNormalApparentTermination if method does not exist, without error', async () => {
      mockHandler._TEST_setCurrentTurnContext(testTurnContext);
      delete mockHandler.signalNormalApparentTermination;

      turnEndingState = createTestState(actorId, null);
      await turnEndingState.enterState(mockHandler, null);

      // notifyTurnEnded is not called in enterState anymore
      expect(mockTurnEndPortInstance.notifyTurnEnded).not.toHaveBeenCalled();
      expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
      // requestIdleStateTransition is not called in enterState anymore
      expect(testTurnContext.requestIdleStateTransition).not.toHaveBeenCalled();
      const signalLogFound = mockContextSpecificLogger.debug.mock.calls.some(
        (call) =>
          call[0].includes('Signaling normal apparent termination') ||
          call[0].includes('Normal apparent termination not signaled')
      );
      expect(signalLogFound).toBe(false);
    });
  });

  describe('destroy()', () => {
    // NOTE: TurnEndingState.destroy() has been simplified.
    // Being destroyed while in TurnEndingState is now the expected flow.
    // BaseTurnHandler.destroy() handles the notification and transition to Idle.

    beforeEach(() => {
      turnEndingState = createTestState(actorId, null);
      mockHandler._currentState = turnEndingState;
    });

    // NOTE: The old test expected resetStateAndResources to be called in TurnEndingState.destroy()
    // This is no longer the case - cleanup is now simpler and handled by BaseTurnHandler.destroy()
    it('should NOT call handler._resetTurnStateAndResources (cleanup moved to BaseTurnHandler.destroy)', async () => {
      await turnEndingState.destroy(mockHandler);
      // The simplified destroy() only logs and calls super.destroy()
      // Resource cleanup is now handled by BaseTurnHandler.destroy()
      // We check that the state-specific resetStateAndResources is NOT called
      // (Though the handler's beforeEach may have called it)
      mockHandler._resetTurnStateAndResources.mockClear();
      await turnEndingState.destroy(mockHandler);
      expect(mockHandler._resetTurnStateAndResources).not.toHaveBeenCalled();
    });

    // NOTE: requestIdleStateTransition is no longer called from TurnEndingState.destroy()
    // This is now handled by BaseTurnHandler.destroy()
    it('should NOT request idle transition (now handled by BaseTurnHandler.destroy)', async () => {
      const someOtherState = {
        getStateName: () => 'SomeOtherState',
        constructor: { name: 'SomeOtherState' },
      };
      mockHandler._currentState = someOtherState;

      await turnEndingState.destroy(mockHandler);
      expect(testTurnContext.requestIdleStateTransition).not.toHaveBeenCalled();
    });

    // NOTE: The warning has been changed to debug - being destroyed in TurnEndingState is now expected
    it('should log debug (not warning) since being destroyed in TurnEndingState is now expected', async () => {
      mockHandler._currentState = turnEndingState;
      mockHandler._transitionToState.mockClear();

      await turnEndingState.destroy(mockHandler);
      expect(mockContextSpecificLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('TurnEndingState.destroy() called for actor')
      );
      // Should NOT log a warning anymore
      expect(mockContextSpecificLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Handler destroyed while in TurnEndingState')
      );
    });

    it('should log debug and call super.destroy()', async () => {
      await turnEndingState.destroy(mockHandler);
      expect(mockContextSpecificLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `TurnEndingState.destroy() called for actor ${actorId}.`
        )
      );
      expect(superDestroySpy).toHaveBeenCalledWith(mockHandler);
    });

    // NOTE: This test is no longer applicable - we don't call requestIdleStateTransition from destroy()
    it('should NOT dispatch errors for transition failures (transition moved to BaseTurnHandler)', async () => {
      mockHandler._currentState = { getStateName: () => 'AnotherState' };

      await turnEndingState.destroy(mockHandler);

      // safeDispatchError should not be called since we don't request transitions
      expect(safeDispatchError).not.toHaveBeenCalled();
    });
  });

  describe('exitState()', () => {
    it('should log using handler logger as context is expected to be cleared (TurnEndingState specific log)', async () => {
      mockHandler._TEST_setCurrentTurnContext(null);
      turnEndingState = createTestState(actorId, null);
      const nextState = new TurnIdleState(mockHandler);
      await turnEndingState.exitState(mockHandler, nextState);

      expect(mockSystemLogger.debug).toHaveBeenCalledWith(
        `TurnEndingState: Exiting for (intended) actor ${actorId}. Transitioning to TurnIdleState. ITurnContext should be null.`
      );
      expect(superExitSpy).toHaveBeenCalledWith(mockHandler, nextState);
    });
  });

  test('No directHumanTurnHandler private member access in source code', () => {
    const sourceCode = TurnEndingState.toString();
    const pthClassNameRegex = /(?<!\/\/\s*|\*\s*)\bHumanTurnHandler\b/;
    expect(sourceCode).not.toMatch(pthClassNameRegex);
  });
});

// --- FILE END ---
