// tests/turns/states/awaitingPlayerInputState.test.js
// ****** CORRECTED FILE ******

/**
 * @file Unit tests for AwaitingActorDecisionState.
 * Verifies its interaction with ITurnContext, IActorTurnStrategy, and state transitions.
 * Ticket: PTH-REFACTOR-003.5.7 (Unit Tests for AwaitingActorDecisionState - Responsibility Shift)
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

// Module to be tested
import { AwaitingActorDecisionState } from '../../../src/turns/states/awaitingActorDecisionState.js';

// Dependencies to be mocked or spied upon
import { AbstractTurnState } from '../../../src/turns/states/abstractTurnState.js';

// --- Mocks & Test Utilities ---

const mockLogger = {
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  createChild: jest.fn(() => mockLogger),
  createChildLogger: jest.fn(() => mockLogger),
};

const createMockActor = (id = 'test-actor-awaiting') => ({
  id: id,
  name: `MockAwaitingActor-${id}`,
  hasComponent: jest.fn(),
});

const createMockTurnAction = (
  commandString = 'mock action',
  actionDefinitionId = 'mock:action_id_123',
  resolvedParameters = {}
) => ({
  commandString: commandString,
  actionDefinitionId: actionDefinitionId,
  resolvedParameters: resolvedParameters,
});

const createMockActorTurnStrategy = () => ({
  decideAction: jest.fn(),
});

// MODIFIED: Updated the mock context to use the new transition methods.
const createMockTurnContext = (
  actor,
  loggerInstance = mockLogger,
  strategy
) => {
  const mockContext = {
    getActor: jest.fn().mockReturnValue(actor),
    getLogger: jest.fn().mockReturnValue(loggerInstance),
    getStrategy: jest.fn().mockReturnValue(strategy),
    setChosenAction: jest.fn(),
    // NEW: Mock the new intent-based transition method.
    requestProcessingCommandStateTransition: jest
      .fn()
      .mockResolvedValue(undefined),
    endTurn: jest.fn(),
    getChosenAction: jest.fn(),
    isValid: jest.fn().mockReturnValue(true),
    getCommandProcessor: jest.fn(),
    getCommandOutcomeInterpreter: jest.fn(),
    getPlayerPromptService: jest.fn(),
    getSubscriptionManager: jest.fn(),
    getGame: jest.fn(),
    getSafeEventDispatcher: jest.fn(),
    getTurnEndPort: jest.fn(),
    isAwaitingExternalEvent: jest.fn().mockReturnValue(false),
    setAwaitingExternalEvent: jest.fn(),
  };
  return mockContext;
};

// MODIFIED: Updated the mock handler to include the new transition method.
const createMockBaseTurnHandler = (loggerInstance = mockLogger) => {
  const handlerMock = {
    getLogger: jest.fn().mockReturnValue(loggerInstance),
    getTurnContext: jest.fn().mockReturnValue(null),
    _transitionToState: jest.fn().mockResolvedValue(undefined),
    _resetTurnStateAndResources: jest.fn(),
    resetStateAndResources: jest.fn(function (reason) {
      handlerMock._resetTurnStateAndResources(reason);
    }),
    getCurrentActor: jest.fn().mockReturnValue(null),
    // NEW: Add the new transition method used for recovery.
    requestIdleStateTransition: jest.fn().mockResolvedValue(undefined),
    _currentState: null,
  };
  return handlerMock;
};

// --- Test Suite ---
describe('AwaitingActorDecisionState (PTH-REFACTOR-003.5.7)', () => {
  let mockHandler;
  let awaitingPlayerInputState;
  let testActor;
  let mockTestTurnContext;
  let mockTestStrategy;
  let mockPreviousState;

  let superEnterSpy;
  let superExitSpy;
  let superDestroySpy;
  let superHandleTurnEndedEventSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    testActor = createMockActor('player1');
    mockTestStrategy = createMockActorTurnStrategy();
    mockHandler = createMockBaseTurnHandler(mockLogger);
    mockTestTurnContext = createMockTurnContext(
      testActor,
      mockLogger,
      mockTestStrategy
    );
    mockPreviousState = null;

    mockHandler.getTurnContext.mockReturnValue(mockTestTurnContext);
    mockHandler.getCurrentActor.mockReturnValue(testActor);

    awaitingPlayerInputState = new AwaitingActorDecisionState(mockHandler);
    mockHandler._currentState = awaitingPlayerInputState;

    superEnterSpy = jest
      .spyOn(AbstractTurnState.prototype, 'enterState')
      .mockResolvedValue(undefined);
    superExitSpy = jest
      .spyOn(AbstractTurnState.prototype, 'exitState')
      .mockResolvedValue(undefined);
    superDestroySpy = jest
      .spyOn(AbstractTurnState.prototype, 'destroy')
      .mockResolvedValue(undefined);
    superHandleTurnEndedEventSpy = jest
      .spyOn(AbstractTurnState.prototype, 'handleTurnEndedEvent')
      .mockResolvedValue(undefined);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    consoleErrorSpy.mockRestore();
  });

  test('constructor should correctly store the handler and call super', () => {
    expect(awaitingPlayerInputState._handler).toBe(mockHandler);
  });

  test('getStateName should return "AwaitingActorDecisionState"', () => {
    expect(awaitingPlayerInputState.getStateName()).toBe(
      'AwaitingActorDecisionState'
    );
  });

  describe('enterState', () => {
    test('should call strategy.decideAction, setChosenAction, and transition to ProcessingCommandState on success', async () => {
      const mockAction = createMockTurnAction('look around', 'core:observe');
      // The strategy can now return a decision object with `action` and `extractedData`
      mockTestStrategy.decideAction.mockResolvedValue({ action: mockAction });

      await awaitingPlayerInputState.enterState(mockHandler, mockPreviousState);

      expect(superEnterSpy).toHaveBeenCalledWith(
        mockHandler,
        mockPreviousState
      );
      expect(mockTestTurnContext.getLogger).toHaveBeenCalled();
      expect(mockTestTurnContext.getActor).toHaveBeenCalled();
      expect(mockTestTurnContext.getStrategy).toHaveBeenCalled();
      expect(mockTestStrategy.decideAction).toHaveBeenCalledWith(
        mockTestTurnContext
      );
      expect(mockTestTurnContext.setChosenAction).toHaveBeenCalledWith(
        mockAction
      );
      // MODIFIED: Check that the new, specific transition method was called.
      expect(
        mockTestTurnContext.requestProcessingCommandStateTransition
      ).toHaveBeenCalledWith(mockAction.commandString, mockAction);
    });

    test('should use actionDefinitionId for transition if commandString is null on ITurnAction', async () => {
      const mockActionNoCmdString = createMockTurnAction(
        null,
        'core:special_ability'
      );
      mockTestStrategy.decideAction.mockResolvedValue({
        action: mockActionNoCmdString,
      });
      await awaitingPlayerInputState.enterState(mockHandler, mockPreviousState);
      // MODIFIED: Check the new method.
      expect(
        mockTestTurnContext.requestProcessingCommandStateTransition
      ).toHaveBeenCalledWith(
        mockActionNoCmdString.actionDefinitionId,
        mockActionNoCmdString
      );
    });

    test('should use actionDefinitionId for transition if commandString is an empty string on ITurnAction', async () => {
      const mockActionEmptyCmdString = createMockTurnAction(
        '',
        'core:another_ability'
      );
      mockTestStrategy.decideAction.mockResolvedValue({
        action: mockActionEmptyCmdString,
      });
      await awaitingPlayerInputState.enterState(mockHandler, mockPreviousState);
      // MODIFIED: Check the new method.
      expect(
        mockTestTurnContext.requestProcessingCommandStateTransition
      ).toHaveBeenCalledWith(
        mockActionEmptyCmdString.actionDefinitionId,
        mockActionEmptyCmdString
      );
    });

    test('should NOT call getCommandProcessor or getCommandOutcomeInterpreter during enterState', async () => {
      const mockAction = createMockTurnAction(
        'do something',
        'core:do_something'
      );
      mockTestStrategy.decideAction.mockResolvedValue({ action: mockAction });

      await awaitingPlayerInputState.enterState(mockHandler, mockPreviousState);

      expect(mockTestTurnContext.getCommandProcessor).not.toHaveBeenCalled();
      expect(
        mockTestTurnContext.getCommandOutcomeInterpreter
      ).not.toHaveBeenCalled();
    });

    // --- ERROR HANDLING ---
    test('should reset and transition to TurnIdleState if ITurnContext is not available', async () => {
      mockHandler.getTurnContext.mockReturnValue(null);
      const specificHandlerLogger = { ...mockLogger, error: jest.fn() };
      mockHandler.getLogger.mockReturnValue(specificHandlerLogger);

      await awaitingPlayerInputState.enterState(mockHandler, mockPreviousState);

      expect(superEnterSpy).toHaveBeenCalledWith(
        mockHandler,
        mockPreviousState
      );
      expect(specificHandlerLogger.error).toHaveBeenCalledWith(
        'AwaitingActorDecisionState: No ITurnContext available. Resetting to idle.'
      );
      expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith(
        'critical-no-context-AwaitingActorDecisionState'
      );
      // MODIFIED: Assert that the new abstract transition method on the handler was called.
      expect(mockHandler.requestIdleStateTransition).toHaveBeenCalled();
      expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
    });

    test('should end turn if actor is not found in ITurnContext', async () => {
      mockTestTurnContext.getActor.mockReturnValue(null);
      await awaitingPlayerInputState.enterState(mockHandler, mockPreviousState);
      expect(superEnterSpy).toHaveBeenCalledWith(
        mockHandler,
        mockPreviousState
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'AwaitingActorDecisionState: No actor found in TurnContext. Ending turn.'
      );
      expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(
        expect.any(Error)
      );
      expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(
        'No actor in context during AwaitingActorDecisionState.'
      );
      expect(
        mockTestTurnContext.requestProcessingCommandStateTransition
      ).not.toHaveBeenCalled();
    });

    test('should end turn if turnContext.getStrategy is not a function', async () => {
      mockTestTurnContext.getStrategy = undefined;
      await awaitingPlayerInputState.enterState(mockHandler, mockPreviousState);
      expect(superEnterSpy).toHaveBeenCalledWith(
        mockHandler,
        mockPreviousState
      );
      const expectedErrorMsg = `AwaitingActorDecisionState: turnContext.getStrategy() is not a function for actor ${testActor.id}.`;
      expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
      expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(
        expect.any(Error)
      );
      expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(
        expectedErrorMsg
      );
    });

    test('should end turn if turnContext.getStrategy returns null', async () => {
      mockTestTurnContext.getStrategy.mockReturnValue(null);
      await awaitingPlayerInputState.enterState(mockHandler, mockPreviousState);
      expect(superEnterSpy).toHaveBeenCalledWith(
        mockHandler,
        mockPreviousState
      );
      const expectedErrorMsg = `AwaitingActorDecisionState: No valid IActorTurnStrategy found for actor ${testActor.id} or strategy is malformed (missing decideAction).`;
      expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg, {
        strategyReceived: null,
      });
      expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(
        expect.any(Error)
      );
      expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(
        expectedErrorMsg
      );
    });

    test('should end turn if strategy from getStrategy() is malformed (missing decideAction)', async () => {
      const malformedStrategy = { name: 'MalformedStrategy' };
      mockTestTurnContext.getStrategy.mockReturnValue(malformedStrategy);
      await awaitingPlayerInputState.enterState(mockHandler, mockPreviousState);
      expect(superEnterSpy).toHaveBeenCalledWith(
        mockHandler,
        mockPreviousState
      );
      const expectedErrorMsg = `AwaitingActorDecisionState: No valid IActorTurnStrategy found for actor ${testActor.id} or strategy is malformed (missing decideAction).`;
      expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg, {
        strategyReceived: malformedStrategy,
      });
      expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(
        expect.any(Error)
      );
      expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(
        expectedErrorMsg
      );
    });

    test('should end turn if strategy.decideAction throws an error', async () => {
      const strategyError = new Error('Strategy decision failed spectacularly');
      mockTestStrategy.decideAction.mockRejectedValue(strategyError);
      await awaitingPlayerInputState.enterState(mockHandler, mockPreviousState);
      expect(superEnterSpy).toHaveBeenCalledWith(
        mockHandler,
        mockPreviousState
      );
      const expectedLogMessage = `${awaitingPlayerInputState.getStateName()}: Error during action decision, storage, or transition for actor ${testActor.id}: ${strategyError.message}`;
      expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMessage, {
        originalError: strategyError,
      });
      expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(
        expect.any(Error)
      );
      const endTurnError = mockTestTurnContext.endTurn.mock.calls[0][0];
      expect(endTurnError.message).toBe(expectedLogMessage);
      expect(endTurnError.cause).toBe(strategyError);
    });

    test('should end turn if strategy.decideAction returns null', async () => {
      mockTestStrategy.decideAction.mockResolvedValue(null);
      await awaitingPlayerInputState.enterState(mockHandler, mockPreviousState);
      expect(superEnterSpy).toHaveBeenCalledWith(
        mockHandler,
        mockPreviousState
      );
      expect(mockLogger.warn).toHaveBeenCalled(); // The code now warns for invalid actions
      expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(
        expect.any(Error)
      );
    });

    test('should end turn if strategy.decideAction returns ITurnAction without actionDefinitionId', async () => {
      const invalidAction = {
        commandString: 'invalid',
        resolvedParameters: {},
      };
      mockTestStrategy.decideAction.mockResolvedValue({
        action: invalidAction,
      });
      await awaitingPlayerInputState.enterState(mockHandler, mockPreviousState);
      expect(superEnterSpy).toHaveBeenCalledWith(
        mockHandler,
        mockPreviousState
      );
      const expectedWarnMsg = `AwaitingActorDecisionState: Strategy for actor ${testActor.id} returned an invalid or null ITurnAction (must have actionDefinitionId).`;
      expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarnMsg, {
        receivedAction: invalidAction,
      });
      expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(
        expect.any(Error)
      );
      expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(
        expectedWarnMsg
      );
    });

    test('should end turn if requestTransition fails', async () => {
      const mockAction = createMockTurnAction(
        'test_action',
        'core:test_action'
      );
      mockTestStrategy.decideAction.mockResolvedValue({ action: mockAction });
      const transitionError = new Error('Transition failed miserably');
      // MODIFIED: Mock the new method to reject.
      mockTestTurnContext.requestProcessingCommandStateTransition.mockRejectedValue(
        transitionError
      );

      await awaitingPlayerInputState.enterState(mockHandler, mockPreviousState);

      expect(superEnterSpy).toHaveBeenCalledWith(
        mockHandler,
        mockPreviousState
      );
      expect(mockTestTurnContext.setChosenAction).toHaveBeenCalledWith(
        mockAction
      );
      const expectedLogMessage = `${awaitingPlayerInputState.getStateName()}: Error during action decision, storage, or transition for actor ${testActor.id}: ${transitionError.message}`;
      expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMessage, {
        originalError: transitionError,
      });
      expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(
        expect.any(Error)
      );
      const endTurnError = mockTestTurnContext.endTurn.mock.calls[0][0];
      expect(endTurnError.message).toBe(expectedLogMessage);
      expect(endTurnError.cause).toBe(transitionError);
    });

    test('should log warning but still transition if turnContext.setChosenAction is missing', async () => {
      const mockAction = createMockTurnAction('action', 'core:action');
      mockTestStrategy.decideAction.mockResolvedValue({ action: mockAction });

      // MODIFIED: The new transition method must exist on the custom context.
      const contextWithoutSetChosenAction = {
        ...mockTestTurnContext,
        setChosenAction: undefined,
        requestProcessingCommandStateTransition: jest
          .fn()
          .mockResolvedValue(undefined),
      };
      mockHandler.getTurnContext.mockReturnValue(contextWithoutSetChosenAction);

      await awaitingPlayerInputState.enterState(mockHandler, mockPreviousState);

      expect(superEnterSpy).toHaveBeenCalledWith(
        mockHandler,
        mockPreviousState
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `AwaitingActorDecisionState: ITurnContext.setChosenAction() not found. Cannot store action in context.`
      );
      // MODIFIED: Check the new method on the custom context object.
      expect(
        contextWithoutSetChosenAction.requestProcessingCommandStateTransition
      ).toHaveBeenCalledWith(mockAction.commandString, mockAction);
      expect(contextWithoutSetChosenAction.endTurn).not.toHaveBeenCalled();
    });
  });

  describe('handleSubmittedCommand (Stub Behavior)', () => {
    test('should log a warning and end turn if called with valid context', async () => {
      const command = 'unexpected direct command';
      await awaitingPlayerInputState.handleSubmittedCommand(
        mockHandler,
        command,
        testActor
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `AwaitingActorDecisionState: handleSubmittedCommand was called directly for actor ${testActor.id} with command "${command}". This is unexpected in the new strategy-driven workflow. Ending turn.`
        )
      );
      expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(
        expect.any(Error)
      );
      expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toMatch(
        `Unexpected direct command submission to AwaitingActorDecisionState for actor ${testActor.id}. Input should be strategy-driven.`
      );
    });

    test('should reset and transition to TurnIdleState if context is missing when called', async () => {
      mockHandler.getTurnContext.mockReturnValue(null);
      const specificHandlerLogger = { ...mockLogger, error: jest.fn() };
      mockHandler.getLogger.mockReturnValue(specificHandlerLogger);
      const command = 'cmd_no_context';

      await awaitingPlayerInputState.handleSubmittedCommand(
        mockHandler,
        command,
        testActor
      );

      expect(specificHandlerLogger.error).toHaveBeenCalledWith(
        'AwaitingActorDecisionState: No ITurnContext available. Resetting to idle.'
      );
      expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith(
        'no-context-submission-AwaitingActorDecisionState'
      );
      // MODIFIED: Check that the new handler method was called for recovery.
      expect(mockHandler.requestIdleStateTransition).toHaveBeenCalled();
      expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
    });

    test('should log critical error to console if handler is null/invalid when context is missing', async () => {
      const originalHandlerRef = awaitingPlayerInputState._handler;
      awaitingPlayerInputState._handler = null;

      const command = 'cmd_no_handler';
      await awaitingPlayerInputState.handleSubmittedCommand(
        null,
        command,
        testActor
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'AwaitingActorDecisionState: No ITurnContext available. Resetting to idle.'
      );
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL - No ITurnContext or handler methods')
      );

      awaitingPlayerInputState._handler = originalHandlerRef;
    });
  });

  describe('exitState', () => {
    let mockNextState;

    beforeEach(() => {
      mockNextState = null;
    });

    test('should call super.exitState and log debug message', async () => {
      await awaitingPlayerInputState.exitState(mockHandler, mockNextState);

      expect(superExitSpy).toHaveBeenCalledWith(mockHandler, mockNextState);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AwaitingActorDecisionState: ExitState cleanup (if any) specific to AwaitingActorDecisionState complete.'
      );
    });

    test('should use handler logger for debug message if context is null during exit', async () => {
      mockHandler.getTurnContext.mockReturnValue(null);
      const handlerOnlyLogger = { ...mockLogger, debug: jest.fn() };
      mockHandler.getLogger.mockReturnValue(handlerOnlyLogger);

      await awaitingPlayerInputState.exitState(mockHandler, mockNextState);

      expect(superExitSpy).toHaveBeenCalledWith(mockHandler, mockNextState);
      expect(handlerOnlyLogger.debug).toHaveBeenCalledWith(
        'AwaitingActorDecisionState: ExitState cleanup (if any) specific to AwaitingActorDecisionState complete.'
      );
    });
  });

  describe('handleTurnEndedEvent', () => {
    let eventPayloadForCurrentActor;
    let eventPayloadForOtherActor;
    let eventPayloadWithError;

    beforeEach(() => {
      eventPayloadForCurrentActor = {
        entityId: testActor.id,
        success: true,
        error: null,
      };
      eventPayloadForOtherActor = {
        entityId: 'other-player',
        success: true,
        error: null,
      };
      eventPayloadWithError = {
        entityId: testActor.id,
        success: false,
        error: new Error('Turn ended badly'),
      };
    });

    test('should end turn via ITurnContext if event is for current actor', async () => {
      await awaitingPlayerInputState.handleTurnEndedEvent(
        mockHandler,
        eventPayloadForCurrentActor
      );
      expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(null);
      expect(superHandleTurnEndedEventSpy).not.toHaveBeenCalled();
    });

    test('should end turn via ITurnContext with error if event is for current actor and has error', async () => {
      await awaitingPlayerInputState.handleTurnEndedEvent(
        mockHandler,
        eventPayloadWithError
      );
      expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(
        eventPayloadWithError.error
      );
      expect(superHandleTurnEndedEventSpy).not.toHaveBeenCalled();
    });

    test('should call super.handleTurnEndedEvent if event is not for current actor', async () => {
      await awaitingPlayerInputState.handleTurnEndedEvent(
        mockHandler,
        eventPayloadForOtherActor
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `AwaitingActorDecisionState: core:turn_ended event for actor ${eventPayloadForOtherActor.entityId} is not for current context actor ${testActor.id}. Deferring to superclass.`
        )
      );
      expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
      expect(superHandleTurnEndedEventSpy).toHaveBeenCalledWith(
        mockHandler,
        eventPayloadForOtherActor
      );
    });

    test('should call super.handleTurnEndedEvent if no actor in context', async () => {
      mockTestTurnContext.getActor.mockReturnValue(null);
      await awaitingPlayerInputState.handleTurnEndedEvent(
        mockHandler,
        eventPayloadForCurrentActor
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `AwaitingActorDecisionState: core:turn_ended event for actor ${eventPayloadForCurrentActor.entityId} is not for current context actor undefined. Deferring to superclass.`
        )
      );
      expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
      expect(superHandleTurnEndedEventSpy).toHaveBeenCalledWith(
        mockHandler,
        eventPayloadForCurrentActor
      );
    });

    test('should call super.handleTurnEndedEvent and use handler logger if no context', async () => {
      mockHandler.getTurnContext.mockReturnValue(null);
      const specificHandlerLogger = {
        ...mockLogger,
        warn: jest.fn(),
        debug: jest.fn(),
      };
      mockHandler.getLogger.mockReturnValue(specificHandlerLogger);

      await awaitingPlayerInputState.handleTurnEndedEvent(
        mockHandler,
        eventPayloadForCurrentActor
      );

      const expectedPayloadString = JSON.stringify(eventPayloadForCurrentActor);
      expect(specificHandlerLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `AwaitingActorDecisionState: handleTurnEndedEvent received but no turn context. Payload: ${expectedPayloadString}. Deferring to superclass.`
        )
      );
      expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
      expect(superHandleTurnEndedEventSpy).toHaveBeenCalledWith(
        mockHandler,
        eventPayloadForCurrentActor
      );
    });
  });

  describe('destroy', () => {
    test('should end turn via context and call super.destroy if context and actor exist', async () => {
      mockHandler._isDestroying = false;
      mockHandler._isDestroyed = false;

      await awaitingPlayerInputState.destroy(mockHandler);

      const expectedErrorMessage = `Turn handler destroyed while actor ${testActor.id} was in AwaitingActorDecisionState.`;
      expect(mockTestTurnContext.endTurn).toHaveBeenCalledWith(
        expect.any(Error)
      );
      expect(mockTestTurnContext.endTurn.mock.calls[0][0].message).toBe(
        expectedErrorMessage
      );
      expect(superDestroySpy).toHaveBeenCalledWith(mockHandler);
    });

    test('should log warning and call super.destroy if context exists but no actor in context', async () => {
      mockTestTurnContext.getActor.mockReturnValue(null);
      await awaitingPlayerInputState.destroy(mockHandler);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        `AwaitingActorDecisionState: Handler destroyed. Actor ID from context: N/A_in_context. No specific turn to end via context if actor is missing.`
      );
      expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
      expect(superDestroySpy).toHaveBeenCalledWith(mockHandler);
    });

    test('should log warning and call super.destroy if context is missing', async () => {
      mockHandler.getTurnContext.mockReturnValue(null);
      const specificHandlerLogger = {
        ...mockLogger,
        warn: jest.fn(),
        info: jest.fn(),
      };
      mockHandler.getLogger.mockReturnValue(specificHandlerLogger);

      await awaitingPlayerInputState.destroy(mockHandler);

      expect(specificHandlerLogger.warn).toHaveBeenCalledWith(
        `AwaitingActorDecisionState: Handler destroyed. Actor ID from context: N/A_no_context. No specific turn to end via context if actor is missing.`
      );
      expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
      expect(superDestroySpy).toHaveBeenCalledWith(mockHandler);
    });

    test('should skip endTurn via context if handler is already destroying', async () => {
      mockHandler._isDestroying = true;

      await awaitingPlayerInputState.destroy(mockHandler);

      expect(mockTestTurnContext.endTurn).not.toHaveBeenCalled();
      expect(superDestroySpy).toHaveBeenCalledWith(mockHandler);
      mockHandler._isDestroying = false;
    });
  });

  describe('Inapplicable AbstractTurnState Methods', () => {
    const inapplicableMethods = [
      { name: 'startTurn', args: [mockHandler, testActor] },
      {
        name: 'processCommandResult',
        args: [mockHandler, testActor, {}, 'cmd'],
      },
      {
        name: 'handleDirective',
        args: [mockHandler, testActor, 'DIR_TEST', {}],
      },
    ];

    inapplicableMethods.forEach((methodInfo) => {
      test(`${methodInfo.name} should call super (which logs/throws by default)`, async () => {
        const superMethodImplSpy = jest
          .spyOn(AbstractTurnState.prototype, methodInfo.name)
          .mockImplementationOnce(async function (...args) {
            const stateName = this.getStateName
              ? this.getStateName()
              : 'AbstractState';
            const logger =
              args[0]?.getLogger?.() ?? this._handler?.getLogger?.() ?? console;
            logger.warn(
              `MockedAbstract.${methodInfo.name} called on ${stateName}`
            );
            throw new Error(
              `MockedAbstract.${methodInfo.name} called on ${stateName} and threw`
            );
          });

        await expect(
          awaitingPlayerInputState[methodInfo.name](...methodInfo.args)
        ).rejects.toThrow(
          `MockedAbstract.${methodInfo.name} called on AwaitingActorDecisionState and threw`
        );

        expect(superMethodImplSpy).toHaveBeenCalledWith(...methodInfo.args);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          `MockedAbstract.${methodInfo.name} called on AwaitingActorDecisionState`
        );
        superMethodImplSpy.mockRestore();
      });
    });
  });
});
