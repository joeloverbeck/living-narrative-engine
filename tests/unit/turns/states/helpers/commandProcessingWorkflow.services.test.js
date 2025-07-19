import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CommandProcessingWorkflow } from '../../../../../src/turns/states/helpers/commandProcessingWorkflow.js';
import * as errorUtils from '../../../../../src/turns/states/helpers/processingErrorUtils.js';

describe('CommandProcessingWorkflow with optional services', () => {
  let state;
  let commandProcessor;
  let commandOutcomeInterpreter;
  let directiveStrategyResolver;
  let exceptionHandler;
  let logger;
  let turnCtx;
  let actor;

  beforeEach(() => {
    jest.clearAllMocks();

    logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    actor = { id: 'actor1' };

    turnCtx = {
      getLogger: () => logger,
      getActor: () => actor,
    };

    state = {
      _flag: true,
      _setProcessing(v) {
        this._flag = v;
      },
      get isProcessing() {
        return this._flag;
      },
      _handler: {
        getCurrentState: jest.fn(() => state),
      },
      _getTurnContext: jest.fn(() => turnCtx),
      getStateName: () => 'TestState',
    };

    commandProcessor = {
      dispatchAction: jest.fn(async () => ({ success: true })),
    };

    commandOutcomeInterpreter = {
      interpret: jest.fn(async () => 'SOME_DIRECTIVE'),
    };

    directiveStrategyResolver = {
      resolveStrategy: jest.fn(() => ({
        execute: jest.fn(),
        constructor: { name: 'TestStrategy' },
      })),
    };

    exceptionHandler = {
      handle: jest.fn(),
    };
  });

  describe('commandDispatcher service', () => {
    it('should use commandDispatcher when provided', async () => {
      const commandDispatcher = {
        dispatch: jest.fn(async () => ({
          turnContext: turnCtx,
          commandResult: { success: true, data: 'test' },
        })),
        validateContextAfterDispatch: jest.fn(() => true),
      };

      const workflow = new CommandProcessingWorkflow({
        state,
        commandProcessor,
        commandOutcomeInterpreter,
        directiveStrategyResolver,
        exceptionHandler,
        commandDispatcher,
      });

      const turnAction = {
        actionDefinitionId: 'action1',
        commandString: 'test command',
      };

      const result = await workflow._dispatchAction(turnCtx, actor, turnAction);

      expect(commandDispatcher.dispatch).toHaveBeenCalledWith({
        turnContext: turnCtx,
        actor,
        turnAction,
        stateName: 'TestState',
      });

      expect(
        commandDispatcher.validateContextAfterDispatch
      ).toHaveBeenCalledWith({
        turnContext: turnCtx,
        expectedActorId: 'actor1',
        stateName: 'TestState',
      });

      expect(result).toEqual({
        activeTurnCtx: turnCtx,
        commandResult: { success: true, data: 'test' },
      });

      expect(commandProcessor.dispatchAction).not.toHaveBeenCalled();
    });

    it('should return null when commandDispatcher dispatch returns null', async () => {
      const commandDispatcher = {
        dispatch: jest.fn(async () => null),
        validateContextAfterDispatch: jest.fn(),
      };

      const workflow = new CommandProcessingWorkflow({
        state,
        commandProcessor,
        commandOutcomeInterpreter,
        directiveStrategyResolver,
        exceptionHandler,
        commandDispatcher,
      });

      const turnAction = {
        actionDefinitionId: 'action1',
        commandString: 'test command',
      };

      const result = await workflow._dispatchAction(turnCtx, actor, turnAction);

      expect(result).toBeNull();
      expect(
        commandDispatcher.validateContextAfterDispatch
      ).not.toHaveBeenCalled();
    });

    it('should return null when context validation fails', async () => {
      const commandDispatcher = {
        dispatch: jest.fn(async () => ({
          turnContext: turnCtx,
          commandResult: { success: true },
        })),
        validateContextAfterDispatch: jest.fn(() => false),
      };

      const workflow = new CommandProcessingWorkflow({
        state,
        commandProcessor,
        commandOutcomeInterpreter,
        directiveStrategyResolver,
        exceptionHandler,
        commandDispatcher,
      });

      const turnAction = {
        actionDefinitionId: 'action1',
        commandString: 'test command',
      };

      const result = await workflow._dispatchAction(turnCtx, actor, turnAction);

      expect(result).toBeNull();
    });
  });

  describe('resultInterpreter service', () => {
    it('should use resultInterpreter when provided', async () => {
      const resultInterpreter = {
        interpret: jest.fn(async () => ({ directiveType: 'CUSTOM_DIRECTIVE' })),
      };

      const workflow = new CommandProcessingWorkflow({
        state,
        commandProcessor,
        commandOutcomeInterpreter,
        directiveStrategyResolver,
        exceptionHandler,
        resultInterpreter,
      });

      const commandResult = { success: true, data: 'test' };
      const result = await workflow._interpretCommandResult(
        turnCtx,
        'actor1',
        commandResult
      );

      expect(resultInterpreter.interpret).toHaveBeenCalledWith({
        commandResult,
        turnContext: turnCtx,
        actorId: 'actor1',
        stateName: 'TestState',
      });

      expect(result).toEqual({ directiveType: 'CUSTOM_DIRECTIVE' });
      expect(commandOutcomeInterpreter.interpret).not.toHaveBeenCalled();
    });
  });

  describe('directiveExecutor service', () => {
    it('should use directiveExecutor when provided and handle successful execution', async () => {
      const directiveExecutor = {
        execute: jest.fn(async () => ({ executed: true })),
      };

      const finishSpy = jest.spyOn(errorUtils, 'finishProcessing');

      const workflow = new CommandProcessingWorkflow({
        state,
        commandProcessor,
        commandOutcomeInterpreter,
        directiveStrategyResolver,
        exceptionHandler,
        directiveExecutor,
      });

      const commandResult = { success: true };
      await workflow._executeDirectiveStrategy(
        turnCtx,
        'TEST_DIRECTIVE',
        commandResult
      );

      expect(directiveExecutor.execute).toHaveBeenCalledWith({
        turnContext: turnCtx,
        directiveType: 'TEST_DIRECTIVE',
        commandResult,
        stateName: 'TestState',
      });

      expect(directiveStrategyResolver.resolveStrategy).not.toHaveBeenCalled();
      expect(finishSpy).toHaveBeenCalledWith(state);
    });

    it('should handle when processing flag becomes false after execution', async () => {
      const directiveExecutor = {
        execute: jest.fn(async () => {
          state._setProcessing(false);
          return { executed: true };
        }),
      };

      const finishSpy = jest.spyOn(errorUtils, 'finishProcessing');

      const workflow = new CommandProcessingWorkflow({
        state,
        commandProcessor,
        commandOutcomeInterpreter,
        directiveStrategyResolver,
        exceptionHandler,
        directiveExecutor,
      });

      const commandResult = { success: true };
      await workflow._executeDirectiveStrategy(
        turnCtx,
        'TEST_DIRECTIVE',
        commandResult
      );

      expect(logger.debug).toHaveBeenCalledWith(
        'TestState: Processing flag false after directive strategy for actor1.'
      );
      expect(finishSpy).not.toHaveBeenCalled();
    });

    it('should handle when state changes after execution', async () => {
      const newState = { getStateName: () => 'NewState' };
      state._handler.getCurrentState.mockReturnValueOnce(newState);

      const directiveExecutor = {
        execute: jest.fn(async () => ({ executed: true })),
      };

      const finishSpy = jest.spyOn(errorUtils, 'finishProcessing');

      const workflow = new CommandProcessingWorkflow({
        state,
        commandProcessor,
        commandOutcomeInterpreter,
        directiveStrategyResolver,
        exceptionHandler,
        directiveExecutor,
      });

      const commandResult = { success: true };
      await workflow._executeDirectiveStrategy(
        turnCtx,
        'TEST_DIRECTIVE',
        commandResult
      );

      expect(logger.debug).toHaveBeenCalledWith(
        'TestState: Directive strategy executed for actor1, state changed from TestState to NewState.'
      );
      expect(finishSpy).toHaveBeenCalledWith(state);
    });

    it('should do nothing when directiveExecutor returns executed: false', async () => {
      const directiveExecutor = {
        execute: jest.fn(async () => ({ executed: false })),
      };

      const finishSpy = jest.spyOn(errorUtils, 'finishProcessing');

      const workflow = new CommandProcessingWorkflow({
        state,
        commandProcessor,
        commandOutcomeInterpreter,
        directiveStrategyResolver,
        exceptionHandler,
        directiveExecutor,
      });

      const commandResult = { success: true };
      await workflow._executeDirectiveStrategy(
        turnCtx,
        'TEST_DIRECTIVE',
        commandResult
      );

      expect(directiveExecutor.execute).toHaveBeenCalled();
      expect(finishSpy).not.toHaveBeenCalled();
      expect(logger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Directive strategy executed')
      );
    });
  });
});
