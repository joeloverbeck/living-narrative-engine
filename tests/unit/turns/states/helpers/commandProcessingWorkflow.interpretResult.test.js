import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CommandProcessingWorkflow } from '../../../../../src/turns/states/helpers/commandProcessingWorkflow.js';

describe('CommandProcessingWorkflow _interpretCommandResult', () => {
  let state;
  let commandProcessor;
  let commandOutcomeInterpreter;
  let directiveStrategyResolver;
  let exceptionHandler;
  let logger;
  let turnCtx;
  let actor;
  let workflow;

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

    workflow = new CommandProcessingWorkflow({
      state,
      commandProcessor,
      commandOutcomeInterpreter,
      directiveStrategyResolver,
      exceptionHandler,
    });
  });

  it('should successfully interpret command result and return directive', async () => {
    const commandResult = { success: true, data: 'test data' };

    const result = await workflow._interpretCommandResult(
      turnCtx,
      'actor1',
      commandResult
    );

    expect(commandOutcomeInterpreter.interpret).toHaveBeenCalledWith(
      commandResult,
      turnCtx
    );
    expect(result).toEqual({ directiveType: 'SOME_DIRECTIVE' });
    expect(logger.debug).toHaveBeenCalledWith(
      'TestState: Actor actor1 - Dispatch result interpreted to directive: SOME_DIRECTIVE'
    );
  });

  it('should handle different directive types', async () => {
    commandOutcomeInterpreter.interpret.mockResolvedValueOnce(
      'CUSTOM_DIRECTIVE'
    );
    const commandResult = { success: false, error: 'Command failed' };

    const result = await workflow._interpretCommandResult(
      turnCtx,
      'actor1',
      commandResult
    );

    expect(result).toEqual({ directiveType: 'CUSTOM_DIRECTIVE' });
    expect(logger.debug).toHaveBeenCalledWith(
      'TestState: Actor actor1 - Dispatch result interpreted to directive: CUSTOM_DIRECTIVE'
    );
  });

  it('should handle interpretation errors gracefully', async () => {
    const interpretError = new Error('Interpretation failed');
    commandOutcomeInterpreter.interpret.mockRejectedValueOnce(interpretError);
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
        error: 'Interpretation failed',
        stack: expect.any(String),
        actorId: 'actor1',
        stateName: 'TestState',
        timestamp: expect.any(Number),
        commandSuccess: true,
        commandError: undefined,
      })
    );
    expect(exceptionHandler.handle).toHaveBeenCalledWith(
      turnCtx,
      interpretError,
      'actor1'
    );
  });

  it('should handle non-string directive types', async () => {
    commandOutcomeInterpreter.interpret.mockResolvedValueOnce(123);
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
        error: 'Invalid directive type returned: 123',
        commandSuccess: true,
      })
    );
  });

  it('should handle empty string directive type', async () => {
    commandOutcomeInterpreter.interpret.mockResolvedValueOnce('');
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
        error: 'Invalid directive type returned: ',
      })
    );
  });

  it('should handle undefined directive type', async () => {
    commandOutcomeInterpreter.interpret.mockResolvedValueOnce(undefined);
    const commandResult = { success: false, error: 'Failed command' };

    const result = await workflow._interpretCommandResult(
      turnCtx,
      'actor1',
      commandResult
    );

    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'Error during result interpretation',
      expect.objectContaining({
        error: 'Invalid directive type returned: undefined',
        commandSuccess: false,
        commandError: 'Failed command',
      })
    );
  });

  it('should create comprehensive error context on failure', async () => {
    const interpretError = new Error('Complex error');
    commandOutcomeInterpreter.interpret.mockRejectedValueOnce(interpretError);
    const commandResult = {
      success: false,
      error: 'Command error message',
      data: { some: 'data' },
    };

    await workflow._interpretCommandResult(turnCtx, 'actor1', commandResult);

    expect(logger.error).toHaveBeenCalledWith(
      'Error during result interpretation',
      expect.objectContaining({
        phase: 'command_processing_interpretation',
        error: 'Complex error',
        stack: expect.any(String),
        actorId: 'actor1',
        stateName: 'TestState',
        timestamp: expect.any(Number),
        commandSuccess: false,
        commandError: 'Command error message',
      })
    );
  });
});
