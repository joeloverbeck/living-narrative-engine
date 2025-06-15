// tests/turns/states/turnEndingState.test.js
// --- FILE START ---

/**
 * @file Unit tests for TurnEndingState.
 * Verifies its use of ITurnContext for accessing services like ILogger and ITurnEndPort,
 * and its interaction with BaseTurnHandler for resource resetting and state transitions.
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
import { TurnEndingState } from '../../../src/turns/states/turnEndingState.js';

// Dependencies
import { TurnIdleState } from '../../../src/turns/states/turnIdleState.js';
import { AbstractTurnState } from '../../../src/turns/states/abstractTurnState.js';
import { DISPLAY_ERROR_ID } from '../../../src/constants/eventIds.js';

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
    signalNormalApparentTermination: jest.fn(),
    destroy: jest.fn(async () => {
      handlerMock._isDestroyed = true;
      handlerMock._resetTurnStateAndResources('destroy-handler');
      if (!(handlerMock._currentState instanceof TurnIdleState)) {
        await handlerMock._transitionToState(new TurnIdleState(handlerMock));
      }
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

      it('should call ITurnEndPort.notifyTurnEnded with correct parameters via ITurnContext', () => {
        expect(testTurnContext.getTurnEndPort).toHaveBeenCalled();
        expect(mockTurnEndPortInstance.notifyTurnEnded).toHaveBeenCalledWith(
          actorId,
          true
        );
      });

      it('should call handler.signalNormalApparentTermination if function exists and context actor matches', () => {
        expect(mockHandler.signalNormalApparentTermination).toHaveBeenCalled();
      });

      it('should call handler._resetTurnStateAndResources', () => {
        expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith(
          `enterState-TurnEndingState-actor-${actorId}`
        );
      });

      it('should request idle state transition via context', () => {
        expect(testTurnContext.requestIdleStateTransition).toHaveBeenCalled();
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

      it('should call ITurnEndPort.notifyTurnEnded with the error status (false) via ITurnContext', () => {
        expect(mockTurnEndPortInstance.notifyTurnEnded).toHaveBeenCalledWith(
          actorId,
          false
        );
      });

      it('should still call handler.signalNormalApparentTermination', () => {
        expect(mockHandler.signalNormalApparentTermination).toHaveBeenCalled();
      });

      it('should call handler._resetTurnStateAndResources and request idle transition via context', () => {
        expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
        expect(testTurnContext.requestIdleStateTransition).toHaveBeenCalled();
      });
    });

    describe('ITurnContext Missing on Handler', () => {
      beforeEach(async () => {
        mockHandler._TEST_setCurrentTurnContext(null);
        mockHandler._TEST_setCurrentActor(null);

        turnEndingState = createTestState(actorId, null);
        await turnEndingState.enterState(mockHandler, null);
      });

      it('should NOT call ITurnEndPort.notifyTurnEnded and log a warning', () => {
        expect(mockTurnEndPortInstance.notifyTurnEnded).not.toHaveBeenCalled();
        expect(mockSystemLogger.warn).toHaveBeenCalledWith(
          `TurnEndingState: TurnEndPort not notified for actor ${actorId}. Reason: ITurnContext not available.`
        );
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

      it('should NOT call ITurnEndPort.notifyTurnEnded and log warning', () => {
        expect(mockTurnEndPortInstance.notifyTurnEnded).not.toHaveBeenCalled();
        expect(mockContextSpecificLogger.warn).toHaveBeenCalledWith(
          `TurnEndingState: TurnEndPort not notified for actor ${actorId}. Reason: ITurnContext actor mismatch (context: ${differentActorId}, target: ${actorId}).`
        );
      });

      it('should NOT call handler.signalNormalApparentTermination due to actor mismatch', () => {
        expect(
          mockHandler.signalNormalApparentTermination
        ).not.toHaveBeenCalled();
        expect(mockContextSpecificLogger.debug).toHaveBeenCalledWith(
          `TurnEndingState: Normal apparent termination not signaled. Context actor ('${differentActorId}') vs target actor ('${actorId}') mismatch or no context actor.`
        );
      });

      it('should call handler._resetTurnStateAndResources and request idle transition via context', () => {
        expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
        expect(mismatchedContext.requestIdleStateTransition).toHaveBeenCalled();
      });
    });

    it('should proceed with cleanup if ITurnEndPort.notifyTurnEnded throws an error', async () => {
      mockHandler._TEST_setCurrentTurnContext(testTurnContext);
      const notifyError = new Error('Notify Failed');
      mockTurnEndPortInstance.notifyTurnEnded.mockRejectedValueOnce(
        notifyError
      );

      turnEndingState = createTestState(actorId, null);
      await turnEndingState.enterState(mockHandler, null);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        DISPLAY_ERROR_ID,
        expect.objectContaining({
          message: `TurnEndingState: Failed notifying TurnEndPort for actor ${actorId}: ${notifyError.message}`,
        })
      );
      expect(mockHandler.signalNormalApparentTermination).toHaveBeenCalled();
      expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
      expect(testTurnContext.requestIdleStateTransition).toHaveBeenCalled();
    });

    it('should skip calling signalNormalApparentTermination if method does not exist, without error', async () => {
      mockHandler._TEST_setCurrentTurnContext(testTurnContext);
      delete mockHandler.signalNormalApparentTermination;

      turnEndingState = createTestState(actorId, null);
      await turnEndingState.enterState(mockHandler, null);

      expect(mockTurnEndPortInstance.notifyTurnEnded).toHaveBeenCalledWith(
        actorId,
        true
      );
      expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
      expect(testTurnContext.requestIdleStateTransition).toHaveBeenCalled();
      const signalLogFound = mockContextSpecificLogger.debug.mock.calls.some(
        (call) =>
          call[0].includes('Signaling normal apparent termination') ||
          call[0].includes('Normal apparent termination not signaled')
      );
      expect(signalLogFound).toBe(false);
    });
  });

  describe('destroy()', () => {
    beforeEach(() => {
      turnEndingState = createTestState(actorId, null);
      mockHandler._currentState = turnEndingState;
    });

    it('should call handler._resetTurnStateAndResources', async () => {
      await turnEndingState.destroy(mockHandler);
      expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith(
        `destroy-TurnEndingState-actor-${actorId}`
      );
    });

    it('should request idle transition via context if handler._currentState is not TurnIdleState and not itself', async () => {
      const someOtherState = {
        getStateName: () => 'SomeOtherState',
        constructor: { name: 'SomeOtherState' },
      };
      mockHandler._currentState = someOtherState;

      await turnEndingState.destroy(mockHandler);
      expect(testTurnContext.requestIdleStateTransition).toHaveBeenCalled();
    });

    it('should NOT attempt self-transition if handler._currentState is itself during destroy', async () => {
      mockHandler._currentState = turnEndingState;
      mockHandler._transitionToState.mockClear();

      await turnEndingState.destroy(mockHandler);
      expect(mockContextSpecificLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Handler destroyed while in TurnEndingState')
      );
    });

    it('should log a warning and call super.destroy()', async () => {
      await turnEndingState.destroy(mockHandler);
      expect(mockContextSpecificLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Handler destroyed while in TurnEndingState for actor ${actorId}.`
        )
      );
      expect(superDestroySpy).toHaveBeenCalledWith(mockHandler);
    });

    it('should handle forced transition failure during destroy by logging an error', async () => {
      mockHandler._currentState = { getStateName: () => 'AnotherState' };
      const transitionError = new Error('Forced transition failed');
      testTurnContext.requestIdleStateTransition.mockRejectedValueOnce(
        transitionError
      );

      await turnEndingState.destroy(mockHandler);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        DISPLAY_ERROR_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            `Failed forced transition to TurnIdleState during destroy for actor ${actorId}: ${transitionError.message}`
          ),
        })
      );
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
