import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CommandProcessingWorkflow } from '../../../../../src/turns/states/helpers/commandProcessingWorkflow.js';

describe('CommandProcessingWorkflow error handling', () => {
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

  describe('_dispatchAction error handling', () => {
    it('should handle dispatch errors and call exception handler', async () => {
      const dispatchError = new Error('Dispatch failed');
      commandProcessor.dispatchAction.mockRejectedValueOnce(dispatchError);

      const workflow = new CommandProcessingWorkflow({
        state,
        commandProcessor,
        commandOutcomeInterpreter,
        directiveStrategyResolver,
        exceptionHandler,
      });

      const turnAction = {
        actionDefinitionId: 'action1',
        commandString: 'test command',
      };

      const result = await workflow._dispatchAction(turnCtx, actor, turnAction);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Error during action dispatch',
        expect.objectContaining({
          phase: 'command_processing_dispatch',
          error: 'Dispatch failed',
          stack: expect.any(String),
          actorId: 'actor1',
          stateName: 'TestState',
          timestamp: expect.any(Number),
          actionId: 'action1',
          commandString: 'test command',
        })
      );
      expect(exceptionHandler.handle).toHaveBeenCalledWith(
        turnCtx,
        dispatchError,
        'actor1'
      );
    });
  });

  describe('_interpretCommandResult error handling', () => {
    it('should handle missing commandOutcomeInterpreter', async () => {
      const workflow = new CommandProcessingWorkflow({
        state,
        commandProcessor,
        commandOutcomeInterpreter,
        directiveStrategyResolver,
        exceptionHandler,
      });

      workflow._commandOutcomeInterpreter = null;

      const commandResult = { success: true };
      const result = await workflow._interpretCommandResult(
        turnCtx,
        'actor1',
        commandResult
      );

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Error during result interpretation',
        expect.objectContaining({
          phase: 'command_processing_interpretation',
          error: 'Command outcome interpreter not available',
          actorId: 'actor1',
          commandSuccess: true,
        })
      );
      expect(exceptionHandler.handle).toHaveBeenCalledWith(
        turnCtx,
        expect.objectContaining({
          message: 'Command outcome interpreter not available',
        }),
        'actor1'
      );
    });

    it('should handle invalid directive type returned', async () => {
      commandOutcomeInterpreter.interpret.mockResolvedValueOnce(null);

      const workflow = new CommandProcessingWorkflow({
        state,
        commandProcessor,
        commandOutcomeInterpreter,
        directiveStrategyResolver,
        exceptionHandler,
      });

      const commandResult = { success: false, error: 'Command failed' };
      const result = await workflow._interpretCommandResult(
        turnCtx,
        'actor1',
        commandResult
      );

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Error during result interpretation',
        expect.objectContaining({
          phase: 'command_processing_interpretation',
          error: 'Invalid directive type returned: null',
          commandSuccess: false,
          commandError: 'Command failed',
        })
      );
    });
  });

  describe('_executeDirectiveStrategy error handling', () => {
    it('should handle missing directiveStrategyResolver', async () => {
      const workflow = new CommandProcessingWorkflow({
        state,
        commandProcessor,
        commandOutcomeInterpreter,
        directiveStrategyResolver,
        exceptionHandler,
      });

      workflow._directiveStrategyResolver = null;

      const commandResult = { success: true };
      await workflow._executeDirectiveStrategy(
        turnCtx,
        'TEST_DIRECTIVE',
        commandResult
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Error during directive execution',
        expect.objectContaining({
          phase: 'command_processing_execution',
          error: 'Directive strategy resolver not available',
          actorId: 'actor1',
          directiveType: 'TEST_DIRECTIVE',
        })
      );
      expect(exceptionHandler.handle).toHaveBeenCalledWith(
        turnCtx,
        expect.objectContaining({
          message: 'Directive strategy resolver not available',
        }),
        'actor1'
      );
    });

    it('should handle strategy execution errors', async () => {
      const executionError = new Error('Strategy execution failed');
      const strategy = {
        execute: jest.fn().mockRejectedValueOnce(executionError),
        constructor: { name: 'TestStrategy' },
      };
      directiveStrategyResolver.resolveStrategy.mockReturnValueOnce(strategy);

      const workflow = new CommandProcessingWorkflow({
        state,
        commandProcessor,
        commandOutcomeInterpreter,
        directiveStrategyResolver,
        exceptionHandler,
      });

      const commandResult = { success: true };
      await workflow._executeDirectiveStrategy(
        turnCtx,
        'TEST_DIRECTIVE',
        commandResult
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Error during directive execution',
        expect.objectContaining({
          phase: 'command_processing_execution',
          error: 'Strategy execution failed',
          directiveType: 'TEST_DIRECTIVE',
          commandSuccess: true,
        })
      );
      expect(exceptionHandler.handle).toHaveBeenCalledWith(
        turnCtx,
        executionError,
        'actor1'
      );
    });
  });

  describe('processCommand error handling', () => {
    it('should handle non-Error objects in catch block', async () => {
      const workflow = new CommandProcessingWorkflow({
        state,
        commandProcessor,
        commandOutcomeInterpreter,
        directiveStrategyResolver,
        exceptionHandler,
      });

      const nonErrorObject = {
        message: 'Custom error object',
        stack: 'Custom stack trace',
        constructor: { name: 'CustomError' },
      };

      jest
        .spyOn(workflow, '_dispatchAction')
        .mockRejectedValueOnce(nonErrorObject);

      const turnAction = {
        actionDefinitionId: 'action1',
        commandString: 'test command',
      };

      await workflow.processCommand(turnCtx, actor, turnAction);

      expect(logger.error).toHaveBeenCalledWith(
        'Error in command processing workflow',
        expect.objectContaining({
          phase: 'command_processing_workflow',
          error: 'Custom error object',
          stack: 'Custom stack trace',
          errorType: 'CustomError',
        })
      );

      expect(exceptionHandler.handle).toHaveBeenCalledWith(
        turnCtx,
        expect.objectContaining({
          message: 'Custom error object',
          stack: 'Custom stack trace',
        }),
        'actor1'
      );
    });

    it('should handle non-Error objects without message', async () => {
      const workflow = new CommandProcessingWorkflow({
        state,
        commandProcessor,
        commandOutcomeInterpreter,
        directiveStrategyResolver,
        exceptionHandler,
      });

      const nonErrorObject = 'String error';

      jest
        .spyOn(workflow, '_dispatchAction')
        .mockRejectedValueOnce(nonErrorObject);

      const turnAction = {
        actionDefinitionId: 'action1',
        commandString: 'test command',
      };

      await workflow.processCommand(turnCtx, actor, turnAction);

      expect(exceptionHandler.handle).toHaveBeenCalledWith(
        turnCtx,
        expect.objectContaining({
          message: 'String error',
        }),
        'actor1'
      );
    });

    it('should use fallback context when current context is invalid', async () => {
      const workflow = new CommandProcessingWorkflow({
        state,
        commandProcessor,
        commandOutcomeInterpreter,
        directiveStrategyResolver,
        exceptionHandler,
      });

      const invalidCtx = null;
      state._getTurnContext.mockReturnValueOnce(invalidCtx);

      jest
        .spyOn(workflow, '_dispatchAction')
        .mockRejectedValueOnce(new Error('Test error'));

      const turnAction = {
        actionDefinitionId: 'action1',
        commandString: 'test command',
      };

      await workflow.processCommand(turnCtx, actor, turnAction);

      expect(exceptionHandler.handle).toHaveBeenCalledWith(
        turnCtx, // Uses original turnCtx as fallback
        expect.any(Error),
        'actor1'
      );
    });
  });
});
