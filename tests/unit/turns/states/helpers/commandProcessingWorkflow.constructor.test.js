import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CommandProcessingWorkflow } from '../../../../../src/turns/states/helpers/commandProcessingWorkflow.js';
import { ProcessingExceptionHandler } from '../../../../../src/turns/states/helpers/processingExceptionHandler.js';

describe('CommandProcessingWorkflow constructor', () => {
  let state;
  let commandProcessor;
  let commandOutcomeInterpreter;
  let directiveStrategyResolver;
  let exceptionHandler;
  let logger;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    state = {
      _handler: {
        getLogger: () => logger,
        getCurrentState: jest.fn(() => state),
      },
      _getTurnContext: jest.fn(),
      getStateName: () => 'TestState',
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
      handle: jest.fn(),
    };
  });

  it('should throw error when commandProcessor is missing', () => {
    expect(() => {
      new CommandProcessingWorkflow({
        state,
        commandProcessor: null,
        commandOutcomeInterpreter,
        directiveStrategyResolver,
      });
    }).toThrow('CommandProcessingWorkflow: commandProcessor is required.');
  });

  it('should throw error when commandProcessor is undefined', () => {
    expect(() => {
      new CommandProcessingWorkflow({
        state,
        commandOutcomeInterpreter,
        directiveStrategyResolver,
      });
    }).toThrow('CommandProcessingWorkflow: commandProcessor is required.');
  });

  it('should throw error when commandOutcomeInterpreter is missing', () => {
    expect(() => {
      new CommandProcessingWorkflow({
        state,
        commandProcessor,
        commandOutcomeInterpreter: null,
        directiveStrategyResolver,
      });
    }).toThrow(
      'CommandProcessingWorkflow: commandOutcomeInterpreter is required.'
    );
  });

  it('should throw error when commandOutcomeInterpreter is undefined', () => {
    expect(() => {
      new CommandProcessingWorkflow({
        state,
        commandProcessor,
        directiveStrategyResolver,
      });
    }).toThrow(
      'CommandProcessingWorkflow: commandOutcomeInterpreter is required.'
    );
  });

  it('should throw error when directiveStrategyResolver is missing', () => {
    expect(() => {
      new CommandProcessingWorkflow({
        state,
        commandProcessor,
        commandOutcomeInterpreter,
        directiveStrategyResolver: null,
      });
    }).toThrow(
      'CommandProcessingWorkflow: directiveStrategyResolver is required.'
    );
  });

  it('should throw error when directiveStrategyResolver is undefined', () => {
    expect(() => {
      new CommandProcessingWorkflow({
        state,
        commandProcessor,
        commandOutcomeInterpreter,
      });
    }).toThrow(
      'CommandProcessingWorkflow: directiveStrategyResolver is required.'
    );
  });

  it('should create instance with all required dependencies', () => {
    const workflow = new CommandProcessingWorkflow({
      state,
      commandProcessor,
      commandOutcomeInterpreter,
      directiveStrategyResolver,
    });

    expect(workflow).toBeInstanceOf(CommandProcessingWorkflow);
    expect(workflow._state).toBe(state);
    expect(workflow._commandProcessor).toBe(commandProcessor);
    expect(workflow._commandOutcomeInterpreter).toBe(commandOutcomeInterpreter);
    expect(workflow._directiveStrategyResolver).toBe(directiveStrategyResolver);
  });

  it('should create default exceptionHandler when not provided', () => {
    const workflow = new CommandProcessingWorkflow({
      state,
      commandProcessor,
      commandOutcomeInterpreter,
      directiveStrategyResolver,
    });

    expect(workflow._exceptionHandler).toBeInstanceOf(
      ProcessingExceptionHandler
    );
  });

  it('should use provided exceptionHandler when given', () => {
    const workflow = new CommandProcessingWorkflow({
      state,
      commandProcessor,
      commandOutcomeInterpreter,
      directiveStrategyResolver,
      exceptionHandler,
    });

    expect(workflow._exceptionHandler).toBe(exceptionHandler);
  });

  it('should store optional service modules when provided', () => {
    const commandDispatcher = { dispatch: jest.fn() };
    const resultInterpreter = { interpret: jest.fn() };
    const directiveExecutor = { execute: jest.fn() };

    const workflow = new CommandProcessingWorkflow({
      state,
      commandProcessor,
      commandOutcomeInterpreter,
      directiveStrategyResolver,
      commandDispatcher,
      resultInterpreter,
      directiveExecutor,
    });

    expect(workflow._commandDispatcher).toBe(commandDispatcher);
    expect(workflow._resultInterpreter).toBe(resultInterpreter);
    expect(workflow._directiveExecutor).toBe(directiveExecutor);
  });
});
