/**
 * @file Test suite for ProcessingCommandState.
 * @see tests/turns/states/processingCommandState.test.js
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  it,
  afterEach,
} from '@jest/globals';
import { ProcessingCommandState } from '../../../src/turns/states/processingCommandState.js';
import { TurnIdleState } from '../../../src/turns/states/turnIdleState.js';
import TurnDirectiveStrategyResolver from '../../../src/turns/strategies/turnDirectiveStrategyResolver.js';
import TurnDirective from '../../../src/turns/constants/turnDirectives.js';
import { AwaitingPlayerInputState } from '../../../src/turns/states/awaitingPlayerInputState.js';
import { AwaitingExternalTurnEndState } from '../../../src/turns/states/awaitingExternalTurnEndState.js';

// Mock Actor class (simplified)
class MockActor {
  constructor(id = 'actor123') {
    this._id = id;
  }

  getId() {
    return this._id;
  }

  get id() {
    return this._id;
  }
}

// Mock implementations
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  createChildLogger: jest.fn().mockReturnThis(),
};

// CORRECTED: The mock now uses dispatchAction, reflecting the SUT changes.
const mockCommandProcessor = {
  dispatchAction: jest.fn(),
};

const mockCommandOutcomeInterpreter = {
  interpret: jest.fn(),
};

const mockSafeEventDispatcher = {
  dispatch: jest.fn(),
};

const mockTurnDirectiveStrategy = {
  execute: jest.fn().mockResolvedValue(undefined),
  constructor: { name: 'MockTurnDirectiveStrategy' },
};

const mockEndTurnSuccessStrategy = {
  execute: jest.fn().mockImplementation(async (turnContext) => {
    turnContext.endTurn(null);
  }),
  constructor: { name: 'MockEndTurnSuccessStrategy' },
};

const mockEndTurnFailureStrategy = {
  execute: jest
    .fn()
    .mockImplementation(async (turnContext, directive, cmdResult) => {
      turnContext.endTurn(
        cmdResult?.error || new Error('Failure strategy executed')
      );
    }),
  constructor: { name: 'MockEndTurnFailureStrategy' },
};

const mockRepromptStrategy = {
  execute: jest.fn().mockImplementation(async (turnContext) => {
    await turnContext.requestTransition(AwaitingPlayerInputState, []);
  }),
  constructor: { name: 'MockRepromptStrategy' },
};

const mockWaitForEventStrategy = {
  execute: jest.fn().mockImplementation(async (turnContext) => {
    await turnContext.requestTransition(AwaitingExternalTurnEndState, []);
  }),
  constructor: { name: 'MockWaitForEventStrategy' },
};

let mockTurnContext;
let mockHandler;

jest.mock(
  '../../../src/turns/strategies/turnDirectiveStrategyResolver.js',
  () => ({
    __esModule: true,
    default: {
      resolveStrategy: jest.fn(),
    },
  })
);

describe('ProcessingCommandState', () => {
  let processingState;
  const commandString = 'do something';
  const defaultActionDefinitionId = 'testAction';
  let actor;
  let consoleErrorSpy;
  let consoleWarnSpy;
  let mockTurnAction;
  // NEW: Mocks for the new `dispatchAction` flow
  let mockSuccessfulDispatchResult;
  let mockFailedDispatchResult;
  let expectedInterpreterPayloadSuccess;
  let expectedInterpreterPayloadFailure;

  beforeEach(() => {
    jest.clearAllMocks();
    actor = new MockActor('testActor');

    mockTurnAction = {
      actionDefinitionId: defaultActionDefinitionId,
      commandString: commandString,
      resolvedParameters: { param1: 'value1' },
    };

    // NEW: Define results from the mocked dispatchAction call
    mockSuccessfulDispatchResult = {
      success: true,
      errorResult: undefined,
    };

    mockFailedDispatchResult = {
      success: false,
      errorResult: {
        error: 'CommandProcFailure',
        internalError: 'Detailed CommandProcFailure',
      },
    };

    // NEW: Define expected payloads for the outcome interpreter/strategies,
    // which are constructed inside the SUT.
    expectedInterpreterPayloadSuccess = {
      success: true,
      turnEnded: false,
      originalInput:
        mockTurnAction.commandString || mockTurnAction.actionDefinitionId,
      actionResult: { actionId: mockTurnAction.actionDefinitionId },
      error: undefined,
      internalError: undefined,
    };

    expectedInterpreterPayloadFailure = {
      success: false,
      turnEnded: true,
      originalInput:
        mockTurnAction.commandString || mockTurnAction.actionDefinitionId,
      actionResult: { actionId: mockTurnAction.actionDefinitionId },
      error: mockFailedDispatchResult.errorResult.error,
      internalError: mockFailedDispatchResult.errorResult.internalError,
    };

    mockTurnContext = {
      getLogger: jest.fn().mockReturnValue(mockLogger),
      getActor: jest.fn().mockReturnValue(actor),
      getCommandProcessor: jest.fn().mockReturnValue(mockCommandProcessor),
      getCommandOutcomeInterpreter: jest
        .fn()
        .mockReturnValue(mockCommandOutcomeInterpreter),
      getSafeEventDispatcher: jest
        .fn()
        .mockReturnValue(mockSafeEventDispatcher),
      endTurn: jest.fn().mockImplementation((_err) => {
        if (
          mockHandler._currentState === processingState ||
          mockHandler._currentState?.constructor?.name ===
            'ProcessingCommandState'
        ) {
          const TurnEndingStateActual = jest.requireActual(
            '../../../src/turns/states/turnEndingState.js'
          ).TurnEndingState;
          const currentActorForEndTurn = mockTurnContext.getActor
            ? mockTurnContext.getActor()?.id || 'unknownFromEndTurn'
            : 'unknownNoGetActor';
          const turnEndingState = new TurnEndingStateActual(
            mockHandler,
            currentActorForEndTurn,
            _err
          );

          const oldState = mockHandler._currentState;
          if (oldState && typeof oldState.exitState === 'function') {
            Promise.resolve(
              oldState.exitState(mockHandler, turnEndingState)
            ).catch((e) =>
              mockLogger.debug(
                'Error in mock oldState.exitState (during endTurn mock):',
                e
              )
            );
          }
          mockHandler._currentState = turnEndingState;
          if (typeof turnEndingState.enterState === 'function') {
            Promise.resolve(
              turnEndingState.enterState(mockHandler, oldState)
            ).catch((e) =>
              mockLogger.debug(
                'Error in mock turnEndingState.enterState (during endTurn mock):',
                e
              )
            );
          }

          if (mockHandler._currentState === turnEndingState) {
            const oldEndingState = mockHandler._currentState;
            const idleState = new TurnIdleState(mockHandler);
            if (
              oldEndingState &&
              typeof oldEndingState.exitState === 'function'
            ) {
              Promise.resolve(
                oldEndingState.exitState(mockHandler, idleState)
              ).catch((e) =>
                mockLogger.debug(
                  'Error in mock oldEndingState.exitState (during endTurn mock):',
                  e
                )
              );
            }
            mockHandler._currentState = idleState;
            if (typeof idleState.enterState === 'function') {
              Promise.resolve(
                idleState.enterState(mockHandler, oldEndingState)
              ).catch((e) =>
                mockLogger.debug(
                  'Error in mock idleState.enterState (during endTurn mock):',
                  e
                )
              );
            }
          }
        }
        return Promise.resolve();
      }),
      isValid: jest.fn().mockReturnValue(true),
      requestTransition: jest
        .fn()
        .mockImplementation(async (NewStateClass, argsArray = []) => {
          const oldState = mockHandler._currentState;
          const newStateInstance = new NewStateClass(mockHandler, ...argsArray);

          if (oldState && typeof oldState.exitState === 'function') {
            await oldState.exitState(mockHandler, newStateInstance);
          }
          mockHandler._currentState = newStateInstance;
          if (
            newStateInstance &&
            typeof newStateInstance.enterState === 'function'
          ) {
            await newStateInstance.enterState(mockHandler, oldState);
          }
          if (
            processingState &&
            processingState['_isProcessing'] &&
            oldState === processingState
          ) {
            processingState['_isProcessing'] = false;
          }
          return Promise.resolve();
        }),
      getChosenAction: jest.fn().mockReturnValue(mockTurnAction),
      getTurnEndPort: jest.fn().mockReturnValue({ notifyTurnEnded: jest.fn() }),
      getSubscriptionManager: jest.fn().mockReturnValue({
        subscribeToTurnEnded: jest.fn(),
        unsubscribeAll: jest.fn(),
      }),
    };

    mockHandler = {
      getTurnContext: jest.fn().mockReturnValue(mockTurnContext),
      _transitionToState: jest.fn().mockImplementation(async (newState) => {
        const oldState = mockHandler._currentState;
        if (oldState && typeof oldState.exitState === 'function') {
          await oldState.exitState(mockHandler, newState);
        }
        mockHandler._currentState = newState;
        if (newState && typeof newState.enterState === 'function') {
          await newState.enterState(mockHandler, oldState);
        }
      }),
      _resetTurnStateAndResources: jest.fn(),
      getLogger: jest.fn().mockReturnValue(mockLogger),
      _currentState: null,
    };

    TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValue(
      mockTurnDirectiveStrategy
    );
    processingState = new ProcessingCommandState(mockHandler, null, null);
    mockHandler._currentState = processingState;

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe('_processCommandInternal (Successful Flows and Service Interactions)', () => {
    beforeEach(() => {
      // CORRECTED: Mock the new dispatchAction method.
      mockCommandProcessor.dispatchAction
        .mockReset()
        .mockResolvedValue(mockSuccessfulDispatchResult);
      mockCommandOutcomeInterpreter.interpret
        .mockReset()
        .mockReturnValue(TurnDirective.END_TURN_SUCCESS);
      TurnDirectiveStrategyResolver.resolveStrategy
        .mockReset()
        .mockReturnValue(mockEndTurnSuccessStrategy);
      mockEndTurnSuccessStrategy.execute.mockClear();
      mockEndTurnFailureStrategy.execute.mockClear();
      mockRepromptStrategy.execute.mockClear();
      mockWaitForEventStrategy.execute.mockClear();
      mockTurnContext.requestTransition.mockClear();
      mockTurnContext.endTurn.mockClear();

      mockTurnContext.getActor.mockReturnValue(actor);
      mockTurnContext.isValid.mockReturnValue(true);
      mockTurnContext.getChosenAction.mockReturnValue(mockTurnAction);
      processingState['_isProcessing'] = true;
    });

    it('should correctly call commandProcessor.dispatchAction with actor and turnAction object', async () => {
      await processingState['_processCommandInternal'](
        mockTurnContext,
        actor,
        mockTurnAction
      );
      expect(mockCommandProcessor.dispatchAction).toHaveBeenCalledTimes(1);
      expect(mockCommandProcessor.dispatchAction).toHaveBeenCalledWith(
        actor,
        mockTurnAction
      );
    });

    it('should call TurnDirectiveStrategyResolver.resolveStrategy with the directive from interpreter', async () => {
      mockCommandOutcomeInterpreter.interpret.mockReturnValueOnce(
        TurnDirective.RE_PROMPT
      );
      await processingState['_processCommandInternal'](
        mockTurnContext,
        actor,
        mockTurnAction
      );
      expect(
        TurnDirectiveStrategyResolver.resolveStrategy
      ).toHaveBeenCalledWith(TurnDirective.RE_PROMPT);
    });

    it('should execute the resolved ITurnDirectiveStrategy with correct parameters', async () => {
      TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValueOnce(
        mockRepromptStrategy
      );
      mockCommandOutcomeInterpreter.interpret.mockReturnValueOnce(
        TurnDirective.RE_PROMPT
      );
      await processingState['_processCommandInternal'](
        mockTurnContext,
        actor,
        mockTurnAction
      );
      // CORRECTED: The third argument is now the CommandResult-like object constructed by the SUT.
      expect(mockRepromptStrategy.execute).toHaveBeenCalledWith(
        mockTurnContext,
        TurnDirective.RE_PROMPT,
        expectedInterpreterPayloadSuccess
      );
    });

    it('should handle successful command processing leading to END_TURN_SUCCESS', async () => {
      await processingState['_processCommandInternal'](
        mockTurnContext,
        actor,
        mockTurnAction
      );
      // CORRECTED: The third argument is the correctly structured payload.
      expect(mockEndTurnSuccessStrategy.execute).toHaveBeenCalledWith(
        mockTurnContext,
        TurnDirective.END_TURN_SUCCESS,
        expectedInterpreterPayloadSuccess
      );
      await new Promise(process.nextTick);
      expect(processingState['_isProcessing']).toBe(false);
    });

    it('should handle failed command processing (CommandResult success:false) leading to END_TURN_FAILURE', async () => {
      // CORRECTED: Mock dispatchAction to return a failure object.
      mockCommandProcessor.dispatchAction.mockResolvedValue(
        mockFailedDispatchResult
      );
      mockCommandOutcomeInterpreter.interpret.mockReturnValue(
        TurnDirective.END_TURN_FAILURE
      );
      TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValue(
        mockEndTurnFailureStrategy
      );
      await processingState['_processCommandInternal'](
        mockTurnContext,
        actor,
        mockTurnAction
      );
      // CORRECTED: The third argument is now the failure payload.
      expect(mockEndTurnFailureStrategy.execute).toHaveBeenCalledWith(
        mockTurnContext,
        TurnDirective.END_TURN_FAILURE,
        expectedInterpreterPayloadFailure
      );
      await new Promise(process.nextTick);
      expect(processingState['_isProcessing']).toBe(false);
    });

    it('should handle RE_PROMPT directive and set _isProcessing to false due to transition', async () => {
      mockCommandOutcomeInterpreter.interpret.mockReturnValue(
        TurnDirective.RE_PROMPT
      );
      TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValue(
        mockRepromptStrategy
      );
      await processingState['_processCommandInternal'](
        mockTurnContext,
        actor,
        mockTurnAction
      );
      // CORRECTED: The third argument is the success payload.
      expect(mockRepromptStrategy.execute).toHaveBeenCalledWith(
        mockTurnContext,
        TurnDirective.RE_PROMPT,
        expectedInterpreterPayloadSuccess
      );
      expect(mockTurnContext.requestTransition).toHaveBeenCalledWith(
        AwaitingPlayerInputState,
        []
      );
      expect(processingState['_isProcessing']).toBe(false);
    });

    it('should handle WAIT_FOR_EVENT directive and set _isProcessing to false due to transition', async () => {
      mockCommandOutcomeInterpreter.interpret.mockReturnValue(
        TurnDirective.WAIT_FOR_EVENT
      );
      TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValue(
        mockWaitForEventStrategy
      );
      await processingState['_processCommandInternal'](
        mockTurnContext,
        actor,
        mockTurnAction
      );
      // CORRECTED: The third argument is the success payload.
      expect(mockWaitForEventStrategy.execute).toHaveBeenCalledWith(
        mockTurnContext,
        TurnDirective.WAIT_FOR_EVENT,
        expectedInterpreterPayloadSuccess
      );
      expect(mockTurnContext.requestTransition).toHaveBeenCalledWith(
        AwaitingExternalTurnEndState,
        []
      );
      expect(processingState['_isProcessing']).toBe(false);
    });

    it('should correctly manage _isProcessing flag if no transition occurs after strategy execution but turn ends', async () => {
      const nonTransitioningEndTurnStrategy = {
        execute: jest.fn().mockImplementation(async (tc) => {
          await tc.endTurn(null);
        }),
        constructor: { name: 'NonTransitioningEndTurnStrategy' },
      };
      mockCommandOutcomeInterpreter.interpret.mockReturnValue(
        TurnDirective.END_TURN_SUCCESS
      );
      TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValue(
        nonTransitioningEndTurnStrategy
      );

      processingState['_isProcessing'] = true;
      await processingState['_processCommandInternal'](
        mockTurnContext,
        actor,
        mockTurnAction
      );

      expect(nonTransitioningEndTurnStrategy.execute).toHaveBeenCalled();
      expect(mockTurnContext.requestTransition).not.toHaveBeenCalled();
      expect(mockTurnContext.endTurn).toHaveBeenCalledWith(null);
      expect(processingState['_isProcessing']).toBe(false);
    });

    it('should process ITurnAction by calling dispatchAction, regardless of whether commandString is present', async () => {
      const actionNoCommandString = {
        actionDefinitionId: 'actionWithoutCommandStr',
        resolvedParameters: { p: 1 },
      };
      // Create the expected payload for this specific action
      const expectedPayloadNoCommandStr = {
        success: true,
        turnEnded: false,
        originalInput: actionNoCommandString.actionDefinitionId, // Fallback
        actionResult: { actionId: actionNoCommandString.actionDefinitionId },
        error: undefined,
        internalError: undefined,
      };

      mockCommandOutcomeInterpreter.interpret.mockReturnValue(
        TurnDirective.END_TURN_SUCCESS
      );
      TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValue(
        mockEndTurnSuccessStrategy
      );
      mockCommandProcessor.dispatchAction.mockResolvedValue(
        mockSuccessfulDispatchResult
      );

      await processingState['_processCommandInternal'](
        mockTurnContext,
        actor,
        actionNoCommandString
      );

      // CORRECTED: Verify dispatchAction was called with the object.
      expect(mockCommandProcessor.dispatchAction).toHaveBeenCalledWith(
        actor,
        actionNoCommandString
      );
      // Verify the rest of the flow worked with the correct payload.
      expect(mockEndTurnSuccessStrategy.execute).toHaveBeenCalledWith(
        mockTurnContext,
        TurnDirective.END_TURN_SUCCESS,
        expectedPayloadNoCommandStr
      );
      await new Promise(process.nextTick);
      expect(processingState['_isProcessing']).toBe(false);
    });
  });

  // NOTE: Tests for enterState, exitState, and destroy are largely unaffected
  // as the core logic change was in the private _processCommandInternal method.
  // Minor corrections are included for robustness.

  describe('exitState', () => {
    beforeEach(() => {
      mockTurnContext.getActor.mockReturnValue(actor);
    });

    it('should set _isProcessing to false and log exit', async () => {
      processingState['_isProcessing'] = true; // Start as true
      const nextState = new TurnIdleState(mockHandler);
      await processingState.exitState(mockHandler, nextState);
      expect(processingState['_isProcessing']).toBe(false);
      // More robust check for the log message content
      const wasProcessingLog = mockLogger.debug.mock.calls.find((call) =>
        call[0].includes('Exiting for actor')
      );
      expect(wasProcessingLog[0]).toContain(
        `Exiting for actor ${actor.getId()} while _isProcessing was true (now false). Transitioning to TurnIdleState.`
      );
    });
  });

  describe('destroy', () => {
    let superDestroySpy;
    beforeEach(() => {
      mockTurnContext.getActor.mockReturnValue(actor);
      // Spy on the superclass's destroy method
      superDestroySpy = jest
        .spyOn(
          Object.getPrototypeOf(ProcessingCommandState.prototype),
          'destroy'
        )
        .mockResolvedValue(undefined);
    });

    afterEach(() => {
      superDestroySpy.mockRestore();
    });

    it('should set _isProcessing to false', async () => {
      processingState['_isProcessing'] = true;
      await processingState.destroy(mockHandler);
      expect(processingState['_isProcessing']).toBe(false);
    });

    it('should log destruction and call super.destroy', async () => {
      await processingState.destroy(mockHandler);
      const expectedActorIdForLog = actor.getId();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `ProcessingCommandState: Destroying for actor: ${expectedActorIdForLog}.`
        )
      );
      expect(superDestroySpy).toHaveBeenCalledWith(mockHandler);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `ProcessingCommandState: Destroy handling for actor ${expectedActorIdForLog} complete.`
        )
      );
    });
  });
});
