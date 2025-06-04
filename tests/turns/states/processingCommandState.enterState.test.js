// src/tests/core/turns/states/processingCommandState.enterState.test.js

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
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
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

const mockCommandProcessor = {
  processCommand: jest.fn(),
};

const mockCommandOutcomeInterpreter = {
  interpret: jest.fn(),
};

const mockSafeEventDispatcher = {
  dispatchSafely: jest.fn(),
};

const mockTurnDirectiveStrategy = {
  execute: jest.fn().mockResolvedValue(undefined),
  constructor: { name: 'MockTurnDirectiveStrategy' },
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

  beforeEach(() => {
    jest.clearAllMocks();
    actor = new MockActor('testActor');

    mockTurnAction = {
      actionDefinitionId: defaultActionDefinitionId,
      commandString: commandString,
      resolvedParameters: { param1: 'value1' },
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

    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockSafeEventDispatcher.dispatchSafely.mockClear();
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
      mockTurnContext.getChosenAction.mockReturnValueOnce(
        specificActionForThisTest
      );
      mockCommandProcessor.processCommand.mockResolvedValue({
        success: true,
        turnEnded: false,
      });
      mockCommandOutcomeInterpreter.interpret.mockReturnValue(
        TurnDirective.END_TURN_SUCCESS
      );

      let resolveProcessInternal;
      const processInternalPromise = new Promise((resolve) => {
        resolveProcessInternal = resolve;
      });

      const processCommandInternalSpy = jest
        .spyOn(processingState, '_processCommandInternal')
        .mockImplementation(async () => {
          resolveProcessInternal();
          processingState['_isProcessing'] = false;
          return Promise.resolve();
        });

      const enterStatePromise = processingState.enterState(mockHandler, null);

      await processInternalPromise;
      await enterStatePromise;

      // Log from AbstractTurnState's enterState
      expect(mockLogger.info).toHaveBeenCalledWith(
        `ProcessingCommandState: Entered. Actor: ${actor.getId()}. Previous state: None.`
      );
      // Log from ProcessingCommandState's enterState (about actor and command)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `ProcessingCommandState: Actor ${actor.getId()} processing action.`
        )
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `ProcessingCommandState: Entering with command: "null" for actor: ${actor.getId()}`
      );

      expect(processCommandInternalSpy).toHaveBeenCalledWith(
        mockTurnContext,
        actor,
        specificActionForThisTest
      );

      await new Promise(process.nextTick);
      expect(processingState['_isProcessing']).toBe(false);
    }, 10000);

    it('should handle null turn context on entry and use handler reset', async () => {
      mockHandler.getTurnContext.mockReturnValueOnce(null);
      const processCommandInternalSpy = jest
        .spyOn(processingState, '_processCommandInternal')
        .mockResolvedValue(undefined);
      await processingState.enterState(mockHandler, null);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'ProcessingCommandState: Turn context is null on enter. Attempting to reset and idle.'
      );
      expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith(
        `critical-no-context-${processingState.getStateName()}`
      );
      expect(mockHandler._transitionToState).toHaveBeenCalledWith(
        expect.any(TurnIdleState)
      );
      expect(processCommandInternalSpy).not.toHaveBeenCalled();
      expect(processingState['_isProcessing']).toBe(false);
    });

    it('should use constructor-passed ITurnAction if it exists, overriding context action', async () => {
      const constructorAction = {
        actionDefinitionId: 'constructorAction',
        commandString: 'from_constructor',
        resolvedParameters: { cons: 1 },
      };
      const stateWithConstructorAction = new ProcessingCommandState(
        mockHandler,
        constructorAction.commandString,
        constructorAction
      );
      mockHandler._currentState = stateWithConstructorAction;

      const processInternalSpy = jest
        .spyOn(stateWithConstructorAction, '_processCommandInternal')
        .mockResolvedValue(undefined);
      mockLogger.debug.mockClear();
      mockLogger.info.mockClear();

      await stateWithConstructorAction.enterState(mockHandler, null);
      await new Promise((resolve) => process.nextTick(resolve));

      expect(mockTurnContext.getChosenAction).not.toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining(
          `No turnAction passed via constructor. Retrieving from turnContext.getChosenAction()`
        )
      );
      expect(processInternalSpy).toHaveBeenCalledWith(
        mockTurnContext,
        actor,
        constructorAction
      );
    });

    it('should prioritize ITurnAction from turnContext.getChosenAction() if constructor-passed action is null', async () => {
      const contextAction = {
        actionDefinitionId: 'contextAction',
        commandString: 'from_context',
        resolvedParameters: { ctx: 1 },
      };
      mockTurnContext.getChosenAction.mockReturnValueOnce(contextAction);
      const processInternalSpy = jest
        .spyOn(processingState, '_processCommandInternal')
        .mockResolvedValue(undefined);

      await processingState.enterState(mockHandler, null);
      await new Promise((resolve) => process.nextTick(resolve));

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `ProcessingCommandState: No turnAction passed via constructor. Retrieving from turnContext.getChosenAction() for actor ${actor.getId()}.`
      );
      expect(processInternalSpy).toHaveBeenCalledWith(
        mockTurnContext,
        actor,
        contextAction
      );
    });
  });
});
