import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CommandProcessingWorkflow } from '../../../../../src/turns/states/helpers/commandProcessingWorkflow.js';
import { ProcessingExceptionHandler } from '../../../../../src/turns/states/helpers/processingExceptionHandler.js';
import { ServiceLookupError } from '../../../../../src/turns/states/helpers/getServiceFromContext.js';
import { finishProcessing } from '../../../../../src/turns/states/helpers/processingErrorUtils.js';

jest.mock(
  '../../../../../src/turns/states/helpers/processingErrorUtils.js',
  () => ({
    finishProcessing: jest.fn(),
  })
);

describe('CommandProcessingWorkflow - Coverage Tests', () => {
  let state;
  let commandProcessor;
  let commandOutcomeInterpreter;
  let directiveStrategyResolver;
  let exceptionHandler;
  let logger;
  let turnContext;
  let actor;
  let turnAction;
  let workflow;

  beforeEach(() => {
    jest.clearAllMocks();

    logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    actor = {
      id: 'test-actor-id',
      name: 'Test Actor',
    };

    turnContext = {
      getLogger: jest.fn(() => logger),
      getActor: jest.fn(() => actor),
    };

    state = {
      _handler: {
        getLogger: () => logger,
        getCurrentState: jest.fn(() => state),
      },
      _getTurnContext: jest.fn(() => turnContext),
      getStateName: jest.fn(() => 'TestState'),
      isProcessing: true,
    };

    commandProcessor = {
      dispatchAction: jest.fn(),
    };

    commandOutcomeInterpreter = {
      interpret: jest.fn(),
    };

    directiveStrategyResolver = {
      resolveStrategy: jest.fn(),
    };

    exceptionHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
    };

    turnAction = {
      actionDefinitionId: 'test-action',
      commandString: 'test command',
    };

    workflow = new CommandProcessingWorkflow({
      state,
      commandProcessor,
      commandOutcomeInterpreter,
      directiveStrategyResolver,
      exceptionHandler,
    });
  });

  describe('Context validation failure after dispatch', () => {
    it('should handle when context becomes invalid after dispatch (actor ID mismatch)', async () => {
      // Setup successful dispatch
      commandProcessor.dispatchAction.mockResolvedValue({
        success: true,
        data: 'test',
      });

      // Make context invalid after dispatch - different actor
      const differentActor = { id: 'different-actor-id' };
      const invalidContext = {
        getLogger: () => logger,
        getActor: () => differentActor,
      };
      state._getTurnContext.mockReturnValue(invalidContext);

      await workflow.processCommand(turnContext, actor, turnAction);

      // Should detect context mismatch and handle error
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Context validation failed after dispatch'),
        expect.objectContaining({
          phase: 'command_processing_dispatch',
          actorId: 'test-actor-id',
          currentActorId: 'different-actor-id',
        })
      );
      expect(exceptionHandler.handle).toHaveBeenCalledWith(
        invalidContext, // Uses the invalidContext since it's valid for the different actor
        expect.objectContaining({
          message: 'Context invalid/changed after action dispatch.',
        }),
        'test-actor-id',
        false
      );
    });

    it('should handle when _getTurnContext returns invalid context (no getActor function)', async () => {
      commandProcessor.dispatchAction.mockResolvedValue({
        success: true,
        data: 'test',
      });

      // Return invalid context after dispatch
      state._getTurnContext.mockReturnValue({
        getLogger: () => logger,
        // Missing getActor function
      });

      await workflow.processCommand(turnContext, actor, turnAction);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Context validation failed after dispatch'),
        expect.any(Object)
      );
      expect(exceptionHandler.handle).toHaveBeenCalled();
    });

    it('should handle when context is null after dispatch', async () => {
      commandProcessor.dispatchAction.mockResolvedValue({
        success: true,
        data: 'test',
      });

      state._getTurnContext.mockReturnValue(null);

      await workflow.processCommand(turnContext, actor, turnAction);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Context validation failed after dispatch'),
        expect.any(Object)
      );
      expect(exceptionHandler.handle).toHaveBeenCalled();
    });
  });

  describe('DirectiveExecutor service tests', () => {
    let commandDispatcher;
    let resultInterpreter;
    let directiveExecutor;

    beforeEach(() => {
      commandDispatcher = {
        dispatch: jest.fn(),
        validateContextAfterDispatch: jest.fn(),
      };

      resultInterpreter = {
        interpret: jest.fn(),
      };

      directiveExecutor = {
        execute: jest.fn(),
      };

      workflow = new CommandProcessingWorkflow({
        state,
        commandProcessor,
        commandOutcomeInterpreter,
        directiveStrategyResolver,
        exceptionHandler,
        commandDispatcher,
        resultInterpreter,
        directiveExecutor,
      });
    });

    it('should handle when processing flag becomes false after directive execution', async () => {
      // Setup successful dispatch and interpretation
      commandDispatcher.dispatch.mockResolvedValue({
        turnContext: turnContext,
        commandResult: { success: true },
      });
      commandDispatcher.validateContextAfterDispatch.mockReturnValue(true);
      resultInterpreter.interpret.mockResolvedValue({
        directiveType: 'test-directive',
      });

      // Execute directive successfully but processing becomes false
      directiveExecutor.execute.mockImplementation(() => {
        state.isProcessing = false;
        return Promise.resolve({ executed: true });
      });

      await workflow.processCommand(turnContext, actor, turnAction);

      expect(logger.debug).toHaveBeenCalledWith(
        'TestState: Processing flag false after directive strategy for test-actor-id.'
      );
      expect(finishProcessing).not.toHaveBeenCalled();
    });

    it('should handle when state changes after directive execution', async () => {
      const newState = {
        getStateName: () => 'NewState',
      };

      commandDispatcher.dispatch.mockResolvedValue({
        turnContext: turnContext,
        commandResult: { success: true },
      });
      commandDispatcher.validateContextAfterDispatch.mockReturnValue(true);
      resultInterpreter.interpret.mockResolvedValue({
        directiveType: 'test-directive',
      });

      // State changes after directive execution
      directiveExecutor.execute.mockImplementation(() => {
        state._handler.getCurrentState.mockReturnValue(newState);
        return Promise.resolve({ executed: true });
      });

      await workflow.processCommand(turnContext, actor, turnAction);

      expect(logger.debug).toHaveBeenCalledWith(
        'TestState: Directive strategy executed for test-actor-id, state changed from TestState to NewState.'
      );
      expect(finishProcessing).toHaveBeenCalledWith(state);
    });

    it('should handle when state remains the same after directive execution', async () => {
      commandDispatcher.dispatch.mockResolvedValue({
        turnContext: turnContext,
        commandResult: { success: true },
      });
      commandDispatcher.validateContextAfterDispatch.mockReturnValue(true);
      resultInterpreter.interpret.mockResolvedValue({
        directiveType: 'test-directive',
      });

      directiveExecutor.execute.mockResolvedValue({ executed: true });

      await workflow.processCommand(turnContext, actor, turnAction);

      expect(logger.debug).toHaveBeenCalledWith(
        'TestState: Directive strategy executed for test-actor-id, state remains TestState.'
      );
      expect(finishProcessing).toHaveBeenCalledWith(state);
    });
  });

  describe('Error handling in processCommand', () => {
    it('should handle errors when _getTurnContext returns null', async () => {
      // Mock dispatchAction to return a valid result
      const dispatchResult = {
        activeTurnCtx: turnContext,
        commandResult: { success: true },
      };

      // Mock _dispatchAction to return the result successfully
      jest.spyOn(workflow, '_dispatchAction').mockResolvedValue(dispatchResult);

      // Mock _interpretCommandResult to throw an error that won't be caught internally
      jest.spyOn(workflow, '_interpretCommandResult').mockImplementation(() => {
        throw new Error('Test error after dispatch');
      });

      // Make _getTurnContext return null to test line 510
      state._getTurnContext.mockReturnValue(null);

      await workflow.processCommand(turnContext, actor, turnAction);

      expect(logger.error).toHaveBeenCalledWith(
        'Error in command processing workflow',
        expect.objectContaining({
          phase: 'command_processing_workflow',
          error: 'Test error after dispatch',
          actorId: 'test-actor-id',
        })
      );
      expect(exceptionHandler.handle).toHaveBeenCalledWith(
        turnContext, // Should fallback to original context
        expect.any(Error),
        'test-actor-id'
      );
    });

    it('should get logger from context when available', async () => {
      const dispatchResult = {
        activeTurnCtx: turnContext,
        commandResult: { success: true },
      };

      jest.spyOn(workflow, '_dispatchAction').mockResolvedValue(dispatchResult);
      jest.spyOn(workflow, '_interpretCommandResult').mockImplementation(() => {
        throw new Error('Test error for logger');
      });

      // Make context valid with logger
      const mockLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };
      const validContext = {
        getLogger: jest.fn(() => mockLogger),
        getActor: jest.fn(() => actor),
      };
      state._getTurnContext.mockReturnValue(validContext);

      await workflow.processCommand(turnContext, actor, turnAction);

      // Should use the logger from the valid context (lines 536-537)
      expect(validContext.getLogger).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error in command processing workflow',
        expect.any(Object)
      );
    });

    it('should handle non-Error objects being thrown', async () => {
      const nonErrorObject = {
        message: 'Non-error object',
        customProp: 'test',
      };

      const dispatchResult = {
        activeTurnCtx: turnContext,
        commandResult: { success: true },
      };

      jest.spyOn(workflow, '_dispatchAction').mockResolvedValue(dispatchResult);
      jest.spyOn(workflow, '_interpretCommandResult').mockImplementation(() => {
        throw nonErrorObject;
      });

      await workflow.processCommand(turnContext, actor, turnAction);

      expect(logger.error).toHaveBeenCalledWith(
        'Error in command processing workflow',
        expect.objectContaining({
          phase: 'command_processing_workflow',
          error: 'Non-error object',
          errorType: 'Object',
        })
      );
      expect(exceptionHandler.handle).toHaveBeenCalledWith(
        turnContext,
        expect.objectContaining({
          message: 'Non-error object',
        }),
        'test-actor-id'
      );
    });

    it('should handle non-Error objects with stack trace', async () => {
      const nonErrorWithStack = {
        message: 'Non-error with stack',
        stack: 'fake stack trace',
      };

      const dispatchResult = {
        activeTurnCtx: turnContext,
        commandResult: { success: true },
      };

      jest.spyOn(workflow, '_dispatchAction').mockResolvedValue(dispatchResult);
      jest.spyOn(workflow, '_interpretCommandResult').mockImplementation(() => {
        throw nonErrorWithStack;
      });

      await workflow.processCommand(turnContext, actor, turnAction);

      expect(exceptionHandler.handle).toHaveBeenCalledWith(
        turnContext,
        expect.objectContaining({
          message: 'Non-error with stack',
          stack: 'fake stack trace',
        }),
        'test-actor-id'
      );
    });

    it('should handle when context has invalid actor after error', async () => {
      const testError = new Error('Test error');

      const dispatchResult = {
        activeTurnCtx: turnContext,
        commandResult: { success: true },
      };

      jest.spyOn(workflow, '_dispatchAction').mockResolvedValue(dispatchResult);
      jest.spyOn(workflow, '_interpretCommandResult').mockImplementation(() => {
        throw testError;
      });

      // Make context return no actor
      const invalidContext = {
        getLogger: () => logger,
        getActor: () => null,
      };
      state._getTurnContext.mockReturnValue(invalidContext);

      await workflow.processCommand(turnContext, actor, turnAction);

      expect(exceptionHandler.handle).toHaveBeenCalledWith(
        invalidContext,
        testError,
        'test-actor-id' // Should use original actor ID
      );
    });
  });

  describe('Finally block coverage', () => {
    it('should warn and finish processing when isProcessing is still true at the end', async () => {
      // Setup to throw error but keep isProcessing true
      commandProcessor.dispatchAction.mockRejectedValue(
        new Error('Test error')
      );
      state.isProcessing = true;
      state._handler.getCurrentState.mockReturnValue(state);

      await workflow.processCommand(turnContext, actor, turnAction);

      expect(logger.warn).toHaveBeenCalledWith(
        'TestState: isProcessing was unexpectedly true at the end of _processCommandInternal for test-actor-id. Forcing to false.'
      );
      expect(finishProcessing).toHaveBeenCalledWith(state);
    });

    it('should use fallback logger when context is invalid in finally block', async () => {
      commandProcessor.dispatchAction.mockRejectedValue(
        new Error('Test error')
      );
      state.isProcessing = true;
      state._handler.getCurrentState.mockReturnValue(state);

      // Make _getTurnContext return invalid context
      state._getTurnContext.mockReturnValue(null);

      await workflow.processCommand(turnContext, actor, turnAction);

      // Should still log warning using original context logger
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('isProcessing was unexpectedly true')
      );
      expect(finishProcessing).toHaveBeenCalledWith(state);
    });
  });

  describe('Error context creation', () => {
    it('should create comprehensive error context with all fields', async () => {
      const testError = new Error('Test error with context');
      testError.stack = 'Test stack trace';

      const dispatchResult = {
        activeTurnCtx: turnContext,
        commandResult: { success: true },
      };

      jest.spyOn(workflow, '_dispatchAction').mockResolvedValue(dispatchResult);
      jest.spyOn(workflow, '_interpretCommandResult').mockImplementation(() => {
        throw testError;
      });

      await workflow.processCommand(turnContext, actor, turnAction);

      expect(logger.error).toHaveBeenCalledWith(
        'Error in command processing workflow',
        expect.objectContaining({
          phase: 'command_processing_workflow',
          error: 'Test error with context',
          stack: 'Test stack trace',
          actorId: 'test-actor-id',
          stateName: 'TestState',
          timestamp: expect.any(Number),
          actionId: 'test-action',
          commandString: 'test command',
          errorType: 'Error',
        })
      );
    });

    it('should create error context with additional fields through dispatch error', async () => {
      const dispatchError = new Error('Dispatch error');
      dispatchError.stack = 'Dispatch stack';

      commandProcessor.dispatchAction.mockRejectedValue(dispatchError);

      await workflow.processCommand(turnContext, actor, turnAction);

      // This tests line 106 - _createErrorContext with additionalContext
      expect(logger.error).toHaveBeenCalledWith(
        'Error during action dispatch',
        expect.objectContaining({
          phase: 'command_processing_dispatch',
          error: 'Dispatch error',
          stack: 'Dispatch stack',
          actorId: 'test-actor-id',
          stateName: 'TestState',
          timestamp: expect.any(Number),
          actionId: 'test-action',
          commandString: 'test command',
        })
      );
    });
  });
});
