// src/tests/turns/states/processingCommandState.enterState.test.js

import {
  describe,
  expect,
  jest,
  beforeEach,
  it,
  afterEach,
} from '@jest/globals';
import { ProcessingCommandState } from '../../../../src/turns/states/processingCommandState.js';
import { TurnIdleState } from '../../../../src/turns/states/turnIdleState.js';
import TurnDirectiveStrategyResolver from '../../../../src/turns/strategies/turnDirectiveStrategyResolver.js';
import TurnDirective from '../../../../src/turns/constants/turnDirectives.js';
import { ProcessingGuard } from '../../../../src/turns/states/helpers/processingGuard.js';
import { ProcessingExceptionHandler } from '../../../../src/turns/states/helpers/processingExceptionHandler.js';

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

const mockCommandProcessor = {
  processCommand: jest.fn(),
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

let mockTurnContext;
let mockHandler;

jest.mock(
  '../../../../src/turns/strategies/turnDirectiveStrategyResolver.js',
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

  beforeEach(() => {
    jest.clearAllMocks();
    actor = new MockActor('testActor');

    mockTurnAction = {
      actionDefinitionId: defaultActionDefinitionId,
      commandString: commandString,
      resolvedParameters: { param1: 'value1' },
      speech: 'This is the speech from the turn action.',
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
            '../../../../src/turns/states/turnEndingState.js'
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
            processingState.isProcessing &&
            oldState === processingState
          ) {
            processingState.finishProcessing();
          }
          return Promise.resolve();
        }),
      getChosenAction: jest.fn().mockReturnValue(mockTurnAction),
      // FIX: Add the missing mock for getDecisionMeta
      getDecisionMeta: jest.fn().mockReturnValue({
        speech: 'Mocked speech content from decision meta.',
        thoughts: 'Mocked thoughts.',
        notes: [],
      }),
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
      resetStateAndResources: jest.fn(function (reason) {
        mockHandler._resetTurnStateAndResources(reason);
      }),
      requestIdleStateTransition: jest.fn().mockResolvedValue(undefined),
      getLogger: jest.fn().mockReturnValue(mockLogger),
      _currentState: null,
    };

    TurnDirectiveStrategyResolver.resolveStrategy.mockReturnValue(
      mockTurnDirectiveStrategy
    );
    processingState = new ProcessingCommandState({
      handler: mockHandler,
      commandProcessor: mockCommandProcessor,
      commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
      commandString: commandString,
      turnAction: mockTurnAction,
      directiveResolver: TurnDirectiveStrategyResolver.default,
    });
    mockHandler._currentState = processingState;

    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockSafeEventDispatcher.dispatch.mockClear();
    mockTurnContext.endTurn.mockClear();

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe('enterState', () => {
    it('should log entry, set _isProcessing to true, and initiate _processCommandInternal', async () => {
      const specificActionForThisTest = {
        actionDefinitionId: 'testActionEnter',
        commandString: 'specific command for enter test',
        resolvedParameters: {},
      };
      const specificCommandString = specificActionForThisTest.commandString;

      // mockTurnContext.getChosenAction.mockReturnValueOnce(specificActionForThisTest); // This is no longer strictly needed

      mockCommandProcessor.dispatchAction.mockResolvedValue({
        success: true,
        errorResult: null,
      });
      mockCommandOutcomeInterpreter.interpret.mockReturnValue(
        TurnDirective.END_TURN_SUCCESS
      );

      // Create a local state for this specific test
      const localProcessingState = new ProcessingCommandState({
        handler: mockHandler,
        commandProcessor: mockCommandProcessor,
        commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
        commandString: specificCommandString,
        turnAction: specificActionForThisTest,
        directiveResolver: TurnDirectiveStrategyResolver.default,
      });

      let resolveProcessInternal;
      const processInternalPromise = new Promise((resolve) => {
        resolveProcessInternal = resolve;
      });

      const processCommandInternalSpy = jest
        .spyOn(localProcessingState, '_processCommandInternal') // Spy on the local instance
        .mockImplementation(async () => {
          resolveProcessInternal();
          if (
            localProcessingState &&
            typeof localProcessingState.finishProcessing === 'function'
          ) {
            localProcessingState.finishProcessing();
          }
          return Promise.resolve();
        });

      const enterStatePromise = localProcessingState.enterState(
        mockHandler,
        null
      ); // Call on local instance

      await processInternalPromise;
      await enterStatePromise;

      // Log from AbstractTurnState's enterState
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `ProcessingCommandState: Entered. Actor: ${actor.getId()}. Previous state: None.`
      );
      // Log from ProcessingCommandState's enterState (about actor and command)
      // This log is generated by ProcessingWorkflow's _logActionDetails
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `ProcessingCommandState: Actor ${actor.getId()} processing action. ID: "${specificActionForThisTest.actionDefinitionId}"`
        )
      );

      // This log is generated by ProcessingWorkflow's _validateActor
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `ProcessingCommandState: Entering with command: "${specificCommandString}" for actor: ${actor.getId()}`
      );

      expect(processCommandInternalSpy).toHaveBeenCalledWith(
        mockTurnContext,
        actor,
        specificActionForThisTest,
        localProcessingState._exceptionHandler
      );

      await new Promise(process.nextTick);
      expect(localProcessingState.isProcessing).toBe(false); // Check the local state
    }, 10000);

    it('should handle null turn context on entry and use handler reset', async () => {
      mockHandler.getTurnContext.mockReturnValueOnce(null);
      const processCommandInternalSpy = jest
        .spyOn(processingState, '_processCommandInternal')
        .mockResolvedValue(undefined);
      await processingState.enterState(mockHandler, null);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'ProcessingCommandState: No ITurnContext available. Resetting to idle.'
      );
      expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith(
        `critical-no-context-${processingState.getStateName()}`
      );
      expect(mockHandler.requestIdleStateTransition).toHaveBeenCalled();
      expect(processCommandInternalSpy).not.toHaveBeenCalled();
      expect(processingState.isProcessing).toBe(false);
    });

    it('should use constructor-passed ITurnAction if it exists, overriding context action', async () => {
      const specificTurnAction = {
        actionDefinitionId: 'overrideAction',
        commandString: 'custom cmd for override',
        speech: 'Override speech.',
      };
      const customProcessingState = new ProcessingCommandState({
        handler: mockHandler,
        commandProcessor: mockCommandProcessor,
        commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
        commandString: specificTurnAction.commandString,
        turnAction: specificTurnAction,
        directiveResolver: TurnDirectiveStrategyResolver.default,
      });
      mockTurnContext.getChosenAction = jest
        .fn()
        .mockReturnValue({ actionDefinitionId: 'contextAction' });
      mockHandler.getTurnContext = jest.fn().mockReturnValue(mockTurnContext);

      const processInternalSpy = jest
        .spyOn(customProcessingState, '_processCommandInternal')
        .mockResolvedValue(undefined);

      await customProcessingState.enterState(mockHandler, null);
      await new Promise((resolve) => process.nextTick(resolve));

      expect(processInternalSpy).toHaveBeenCalledWith(
        expect.objectContaining({ getActor: expect.any(Function) }),
        actor,
        specificTurnAction,
        customProcessingState._exceptionHandler
      );
    });

    it('should prioritize ITurnAction from turnContext.getChosenAction() if constructor-passed action is null', async () => {
      // This test creates a state with turnAction: null to test fallback logic.
      // Ensure all other dependencies are provided.
      const stateWithNullAction = new ProcessingCommandState({
        handler: mockHandler, // from outer beforeEach
        commandProcessor: mockCommandProcessor, // from outer beforeEach
        commandOutcomeInterpreter: mockCommandOutcomeInterpreter, // from outer beforeEach
        commandString: commandString, // from outer beforeEach (or a specific one if needed)
        turnAction: null, // Specific for this test case
        directiveResolver: TurnDirectiveStrategyResolver.default, // Changed this line
      });
      // mockHandler._currentState = stateWithNullAction; // Set if necessary for the test flow

      const chosenActionFromContext = {
        actionDefinitionId: 'contextChoiceAction',
      };
      mockTurnContext.getChosenAction = jest
        .fn()
        .mockReturnValue(chosenActionFromContext);
      mockHandler.getTurnContext = jest.fn().mockReturnValue(mockTurnContext);

      const processInternalSpy = jest
        .spyOn(stateWithNullAction, '_processCommandInternal')
        .mockResolvedValue(undefined);

      // console.log('stateWithNullAction in test:', stateWithNullAction);

      await stateWithNullAction.enterState(mockHandler, null);
      await new Promise((resolve) => process.nextTick(resolve));

      // ... assertions, e.g.:
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `ProcessingCommandState: No turnAction passed via constructor. Retrieving from turnContext.getChosenAction() for actor ${actor.getId()}.`
      );
      expect(processInternalSpy).toHaveBeenCalledWith(
        expect.objectContaining({ getActor: expect.any(Function) }),
        actor,
        chosenActionFromContext, // Should use the action from context
        stateWithNullAction._exceptionHandler
      );
    });

    it('should use injected factories for guard and exception handler', () => {
      expect(processingState._processingGuard).toBeInstanceOf(ProcessingGuard);
      expect(processingState._exceptionHandler).toBeInstanceOf(
        ProcessingExceptionHandler
      );
    });

    it('uses provided processing workflow factory in enterState', async () => {
      const actor = new MockActor('wfactor');
      mockTurnContext.getActor.mockReturnValue(actor);
      mockTurnContext.getChosenAction.mockReturnValue({
        actionDefinitionId: 'a',
        commandString: 'cmd',
      });
      mockCommandOutcomeInterpreter.interpret.mockReturnValue(
        TurnDirective.END_TURN_SUCCESS
      );
      const mockWorkflow = { run: jest.fn().mockResolvedValue(undefined) };
      const wfFactory = jest.fn(() => mockWorkflow);

      const state = new ProcessingCommandState({
        handler: mockHandler,
        commandProcessor: mockCommandProcessor,
        commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
        commandString: 'cmd',
        turnAction: { actionDefinitionId: 'a', commandString: 'cmd' },
        directiveResolver: TurnDirectiveStrategyResolver.default,
        processingWorkflowFactory: wfFactory,
      });

      await state.enterState(mockHandler, null);

      expect(wfFactory).toHaveBeenCalled();
      expect(mockWorkflow.run).toHaveBeenCalledWith(mockHandler, null);
    });
  });
});
