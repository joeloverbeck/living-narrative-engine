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

// --- Mocks & Test Utilities ---

const mockSystemLogger = {
  // A general logger for handler if context logger isn't available
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  createChild: jest.fn(() => mockSystemLogger),
};

const mockContextSpecificLogger = {
  // Logger specifically provided by a context
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
    // Add other ITurnContext methods as needed, with default mocks
    isValid: jest.fn().mockReturnValue(true), // Assume valid by default
    endTurn: jest.fn(),
    requestTransition: jest.fn(),
    setAwaitingExternalEvent: jest.fn(),
    isAwaitingExternalEvent: jest.fn(),
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
    signalNormalApparentTermination: jest.fn(), // Standard spy
    destroy: jest.fn(async () => {
      // Simplified mock destroy
      handlerMock._isDestroyed = true;
      handlerMock._resetTurnStateAndResources('destroy-handler');
      if (!(handlerMock._currentState instanceof TurnIdleState)) {
        // Correctly use the real TurnIdleState for type checking if it's not fully mocked out
        await handlerMock._transitionToState(new TurnIdleState(handlerMock));
      }
    }),

    // Helper for tests to set context and actor
    _TEST_setCurrentTurnContext(context) {
      handlerMock._currentTurnContext = context;
      if (context) {
        handlerMock._currentActor = context.getActor();
      } else {
        handlerMock._currentActor = null;
      }
    },
    _TEST_setCurrentActor(actor) {
      handlerMock._currentActor = actor;
    },
  };
  // Initial state for handler (can be overwritten by tests)
  handlerMock._currentState = new TurnIdleState(handlerMock);
  return handlerMock;
};

// --- Test Suite ---
describe('TurnEndingState', () => {
  let mockHandler;
  let testActor;
  let testTurnContext;
  let turnEndingState; // Keep this for type, but instantiation within tests

  const actorId = 'endingActor123';
  const differentActorId = 'otherActor789';

  // Spies for superclass methods
  let superEnterSpy;
  let superExitSpy;
  let superDestroySpy;

  beforeEach(() => {
    jest.clearAllMocks(); // Clear all mocks

    testActor = createMockActor(actorId);
    mockHandler = createMockBaseTurnHandler(mockSystemLogger); // Handler uses system logger by default
    testTurnContext = createMockTurnContext(
      testActor,
      mockContextSpecificLogger
    ); // Context uses its own logger

    // Default setup: handler has a valid turn context for the actor whose turn is ending.
    mockHandler._TEST_setCurrentTurnContext(testTurnContext);
    mockHandler._TEST_setCurrentActor(testActor); // Should align with context

    // Spy on AbstractTurnState methods
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
    jest.restoreAllMocks(); // Restore original implementations
  });

  const createTestState = (currentActorId = actorId, error = null) => {
    return new TurnEndingState(mockHandler, currentActorId, error);
  };

  describe('Constructor', () => {
    it('should correctly store actorToEndId and turnError (null for success) via logging', () => {
      createTestState(actorId, null);
      expect(mockSystemLogger.debug).toHaveBeenCalledWith(
        `TurnEndingState constructed for target actor ${actorId}. Error: null.`
      );
    });

    it('should correctly store actorToEndId and turnError (Error instance) via logging', () => {
      const error = new Error('Test Error');
      createTestState(actorId, error);
      expect(mockSystemLogger.debug).toHaveBeenCalledWith(
        `TurnEndingState constructed for target actor ${actorId}. Error: "Test Error".`
      );
    });

    it('should use handler.getCurrentActor().id if actorToEndId is null, log error and warning', () => {
      mockHandler.getCurrentActor.mockReturnValueOnce({
        id: 'handlerFallbackId',
      });
      new TurnEndingState(mockHandler, null, null);

      expect(mockSystemLogger.error).toHaveBeenCalledWith(
        'TurnEndingState Constructor: actorToEndId must be provided.'
      );
      expect(mockSystemLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "TurnEndingState Constructor: actorToEndId was missing, fell back to 'handlerFallbackId'."
        )
      );
      expect(mockSystemLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `TurnEndingState constructed for target actor handlerFallbackId. Error: null.`
        )
      );
    });

    it('should use UNKNOWN_ACTOR_CONSTRUCTOR_FALLBACK if actorToEndId is undefined and handler.getCurrentActor() is null', () => {
      mockHandler.getCurrentActor.mockReturnValueOnce(null);
      new TurnEndingState(mockHandler, undefined, null);

      expect(mockSystemLogger.error).toHaveBeenCalledWith(
        'TurnEndingState Constructor: actorToEndId must be provided.'
      );
      expect(mockSystemLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "TurnEndingState Constructor: actorToEndId was missing, fell back to 'UNKNOWN_ACTOR_CONSTRUCTOR_FALLBACK'."
        )
      );
      expect(mockSystemLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `TurnEndingState constructed for target actor UNKNOWN_ACTOR_CONSTRUCTOR_FALLBACK. Error: null.`
        )
      );
    });
  });

  describe('enterState()', () => {
    describe('Successful Turn End (Context Valid, Actor Match, No Error)', () => {
      beforeEach(async () => {
        mockHandler._TEST_setCurrentTurnContext(testTurnContext);
        mockHandler._TEST_setCurrentActor(testActor);

        turnEndingState = createTestState(actorId, null); // turnError is null
        await turnEndingState.enterState(mockHandler, null);
      });

      it('should call super.enterState', () => {
        expect(superEnterSpy).toHaveBeenCalledWith(mockHandler, null);
      });

      it('should call ITurnEndPort.notifyTurnEnded with correct parameters via ITurnContext', () => {
        expect(testTurnContext.getTurnEndPort).toHaveBeenCalled();
        // Corrected expectation: second argument should be true (isSuccess)
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

      it('should transition to TurnIdleState', () => {
        expect(mockHandler._transitionToState).toHaveBeenCalledWith(
          expect.any(TurnIdleState)
        );
      });
    });

    describe('Turn End with Error (Context Valid, Actor Match)', () => {
      const error = new Error('Turn Failed Miserably');
      beforeEach(async () => {
        mockHandler._TEST_setCurrentTurnContext(testTurnContext);
        mockHandler._TEST_setCurrentActor(testActor);

        turnEndingState = createTestState(actorId, error); // turnError is an Error object
        await turnEndingState.enterState(mockHandler, null);
      });

      it('should call ITurnEndPort.notifyTurnEnded with the error status (false) via ITurnContext', () => {
        expect(mockTurnEndPortInstance.notifyTurnEnded).toHaveBeenCalledWith(
          actorId,
          false
        ); // isSuccess will be false
      });

      it('should still call handler.signalNormalApparentTermination', () => {
        expect(mockHandler.signalNormalApparentTermination).toHaveBeenCalled();
      });

      it('should call handler._resetTurnStateAndResources and transition to TurnIdleState', () => {
        expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
        expect(mockHandler._transitionToState).toHaveBeenCalledWith(
          expect.any(TurnIdleState)
        );
      });
    });

    describe('ITurnContext Missing on Handler', () => {
      beforeEach(async () => {
        mockHandler._TEST_setCurrentTurnContext(null); // No context
        mockHandler._TEST_setCurrentActor(null); // No actor on handler either

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

      it('should call handler._resetTurnStateAndResources and transition to TurnIdleState', () => {
        expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
        expect(mockHandler._transitionToState).toHaveBeenCalledWith(
          expect.any(TurnIdleState)
        );
      });
    });

    describe('ITurnContext Actor Mismatch', () => {
      let mismatchedContext;
      beforeEach(async () => {
        const mismatchedActor = createMockActor(differentActorId);
        mismatchedContext = createMockTurnContext(
          mismatchedActor,
          mockContextSpecificLogger
        );
        mockHandler._TEST_setCurrentTurnContext(mismatchedContext);
        mockHandler._TEST_setCurrentActor(mismatchedActor);

        turnEndingState = createTestState(actorId, null); // Ending turn for actorId
        await turnEndingState.enterState(mockHandler, null);
      });

      it('should NOT call ITurnEndPort.notifyTurnEnded and log warning', () => {
        expect(mockTurnEndPortInstance.notifyTurnEnded).not.toHaveBeenCalled();
        expect(mockContextSpecificLogger.warn).toHaveBeenCalledWith(
          // Uses context logger here
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

      it('should call handler._resetTurnStateAndResources and transition to TurnIdleState', () => {
        expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
        expect(mockHandler._transitionToState).toHaveBeenCalledWith(
          expect.any(TurnIdleState)
        );
      });
    });

    it('should proceed with cleanup if ITurnEndPort.notifyTurnEnded throws an error', async () => {
      mockHandler._TEST_setCurrentTurnContext(testTurnContext); // Valid context
      const notifyError = new Error('Notify Failed');
      mockTurnEndPortInstance.notifyTurnEnded.mockRejectedValueOnce(
        notifyError
      );

      turnEndingState = createTestState(actorId, null);
      await turnEndingState.enterState(mockHandler, null);

      expect(mockContextSpecificLogger.error).toHaveBeenCalledWith(
        `TurnEndingState: CRITICAL - TurnEndPort.notifyTurnEnded failed for actor ${actorId}: ${notifyError.message}`,
        notifyError
      );
      expect(mockHandler.signalNormalApparentTermination).toHaveBeenCalled(); // Should still be called
      expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
      expect(mockHandler._transitionToState).toHaveBeenCalledWith(
        expect.any(TurnIdleState)
      );
    });

    it('should skip calling signalNormalApparentTermination if method does not exist, without error', async () => {
      mockHandler._TEST_setCurrentTurnContext(testTurnContext);
      delete mockHandler.signalNormalApparentTermination; // Method does not exist

      turnEndingState = createTestState(actorId, null); // turnError is null
      await turnEndingState.enterState(mockHandler, null);

      // Corrected expectation: second argument should be true (isSuccess)
      expect(mockTurnEndPortInstance.notifyTurnEnded).toHaveBeenCalledWith(
        actorId,
        true
      );
      expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalled();
      expect(mockHandler._transitionToState).toHaveBeenCalledWith(
        expect.any(TurnIdleState)
      );
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

    it('should attempt to transition to TurnIdleState if handler._currentState is not TurnIdleState and not itself', async () => {
      const someOtherState = {
        getStateName: () => 'SomeOtherState',
        constructor: { name: 'SomeOtherState' },
      };
      mockHandler._currentState = someOtherState;

      await turnEndingState.destroy(mockHandler);
      expect(mockHandler._transitionToState).toHaveBeenCalledWith(
        expect.any(TurnIdleState)
      );
    });

    it('should NOT attempt self-transition if handler._currentState is itself during destroy', async () => {
      mockHandler._currentState = turnEndingState;
      mockHandler._transitionToState.mockClear();

      await turnEndingState.destroy(mockHandler);
      expect(mockSystemLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Handler destroyed while in TurnEndingState')
      );
    });

    it('should log a warning and call super.destroy()', async () => {
      await turnEndingState.destroy(mockHandler);
      expect(mockSystemLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Handler destroyed while in TurnEndingState for actor ${actorId}.`
        )
      );
      expect(superDestroySpy).toHaveBeenCalledWith(mockHandler);
    });

    it('should handle forced transition failure during destroy by logging an error', async () => {
      mockHandler._currentState = { getStateName: () => 'AnotherState' };
      const transitionError = new Error('Forced transition failed');
      mockHandler._transitionToState.mockRejectedValueOnce(transitionError);

      await turnEndingState.destroy(mockHandler);

      expect(mockSystemLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Failed forced transition to TurnIdleState during destroy for actor ${actorId}: ${transitionError.message}`
        ),
        transitionError
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
