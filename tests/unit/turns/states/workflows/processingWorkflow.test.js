import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { ProcessingWorkflow } from '../../../../../src/turns/states/workflows/processingWorkflow.js';
import { ProcessingGuard } from '../../../../../src/turns/states/helpers/processingGuard.js';

describe('ProcessingWorkflow.run', () => {
  let logger;
  let action;
  let ctx;
  let handler;
  let state;
  let workflow;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    action = { actionDefinitionId: 'act1', commandString: 'cmd' };
    ctx = {
      getLogger: () => logger,
      getActor: () => ({ id: 'actor1' }),
      getChosenAction: jest.fn(() => action),
      getDecisionMeta: jest.fn(() => ({})),
      getSafeEventDispatcher: () => ({ dispatch: jest.fn() }),
    };
    handler = {
      getTurnContext: jest.fn(() => ctx),
      getLogger: () => logger,
    };
    state = {
      _flag: false,
      _setProcessing(val) {
        this._flag = val;
      },
      get isProcessing() {
        return this._flag;
      },
      _handler: handler,
      getStateName: () => 'ProcessingCommandState',
      _getTurnContext: jest.fn(() => ctx),
      _ensureContext: jest.fn(async () => ctx),
      _logStateTransition: jest.fn(),
      _dispatchSpeech: jest.fn().mockResolvedValue(undefined),
      _processCommandInternal: jest.fn(async () => {
        state.finishProcessing();
      }),
      finishProcessing: jest.fn(),
    };
    state._processingGuard = new ProcessingGuard(state);
    state.startProcessing = function () {
      this._processingGuard.start();
    };
    state.finishProcessing = function () {
      this._processingGuard.finish();
    };
    const customHandler = {
      handle: jest.fn(async () => {
        state._processingGuard.finish();
      }),
    };
    workflow = new ProcessingWorkflow(
      state,
      'cmd',
      null,
      (a) => {
        state.action = a;
      },
      customHandler
    );
  });

  test('processes action successfully', async () => {
    await workflow.run(handler, null);
    expect(state._processCommandInternal).toHaveBeenCalledWith(
      ctx,
      { id: 'actor1' },
      action,
      workflow._exceptionHandler
    );
    expect(state.isProcessing).toBe(false);
  });

  test('handles errors from internal processing', async () => {
    state._processCommandInternal.mockImplementation(async () => {
      throw new Error('fail');
    });
    await workflow.run(handler, null);
    expect(workflow._exceptionHandler.handle).toHaveBeenCalled();
    expect(state.isProcessing).toBe(false);
  });

  test('aborts when already processing', async () => {
    state.startProcessing();
    await workflow.run(handler, null);
    expect(state._processCommandInternal).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
    expect(state.isProcessing).toBe(true);
  });
});

describe('ProcessingWorkflow._validateExecutionPreconditions', () => {
  let logger;
  let action;
  let ctx;
  let handler;
  let state;
  let workflow;
  let mockExceptionHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    action = { actionDefinitionId: 'act1', commandString: 'cmd' };
    ctx = {
      getLogger: () => logger,
      getActor: () => ({ id: 'actor1' }),
      getChosenAction: jest.fn(() => action),
      getDecisionMeta: jest.fn(() => ({})),
      getSafeEventDispatcher: () => ({ dispatch: jest.fn() }),
    };
    handler = {
      getTurnContext: jest.fn(() => ctx),
      getLogger: () => logger,
    };
    state = {
      _flag: false,
      _setProcessing(val) {
        this._flag = val;
      },
      get isProcessing() {
        return this._flag;
      },
      _handler: handler,
      getStateName: () => 'ProcessingCommandState',
      _getTurnContext: jest.fn(() => ctx),
      _ensureContext: jest.fn(async () => ctx),
      _logStateTransition: jest.fn(),
      _dispatchSpeech: jest.fn().mockResolvedValue(undefined),
      _processCommandInternal: jest.fn(async () => {
        state.finishProcessing();
      }),
      finishProcessing: jest.fn(),
    };

    mockExceptionHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
    };

    workflow = new ProcessingWorkflow(
      state,
      'cmd',
      null,
      (a) => {
        state.action = a;
      },
      mockExceptionHandler
    );
  });

  test('returns false when turnCtx is null', async () => {
    const result = await workflow._validateExecutionPreconditions(
      null,
      { id: 'actor1' },
      action
    );

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'ProcessingCommandState: Invalid turn context.'
    );
    expect(mockExceptionHandler.handle).toHaveBeenCalledWith(
      null,
      expect.any(Error),
      'actor1'
    );

    const errorArg = mockExceptionHandler.handle.mock.calls[0][1];
    expect(errorArg.message).toBe('Invalid context');
  });

  test('returns false when turnCtx is undefined', async () => {
    const result = await workflow._validateExecutionPreconditions(
      undefined,
      { id: 'actor1' },
      action
    );

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'ProcessingCommandState: Invalid turn context.'
    );
    expect(mockExceptionHandler.handle).toHaveBeenCalledWith(
      undefined,
      expect.any(Error),
      'actor1'
    );
  });

  test('returns false when actor is null', async () => {
    const result = await workflow._validateExecutionPreconditions(
      ctx,
      null,
      action
    );

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'ProcessingCommandState: Invalid actor.'
    );
    expect(mockExceptionHandler.handle).toHaveBeenCalledWith(
      ctx,
      expect.any(Error),
      'actor1'
    );

    const errorArg = mockExceptionHandler.handle.mock.calls[0][1];
    expect(errorArg.message).toBe('Invalid actor');
  });

  test('returns false when actor is undefined', async () => {
    const result = await workflow._validateExecutionPreconditions(
      ctx,
      undefined,
      action
    );

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'ProcessingCommandState: Invalid actor.'
    );
    expect(mockExceptionHandler.handle).toHaveBeenCalledWith(
      ctx,
      expect.any(Error),
      'actor1'
    );
  });

  test('returns false when actor has no id and context has no actor', async () => {
    const contextWithNoActor = {
      ...ctx,
      getActor: () => null,
    };

    const result = await workflow._validateExecutionPreconditions(
      contextWithNoActor,
      null,
      action
    );

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'ProcessingCommandState: Invalid actor.'
    );
    expect(mockExceptionHandler.handle).toHaveBeenCalledWith(
      contextWithNoActor,
      expect.any(Error),
      'N/A'
    );
  });

  test('returns false when turnAction is null', async () => {
    const result = await workflow._validateExecutionPreconditions(
      ctx,
      { id: 'actor1' },
      null
    );

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'ProcessingCommandState: Invalid turnAction.'
    );
    expect(mockExceptionHandler.handle).toHaveBeenCalledWith(
      ctx,
      expect.any(Error),
      'actor1'
    );

    const errorArg = mockExceptionHandler.handle.mock.calls[0][1];
    expect(errorArg.message).toBe('Invalid action');
  });

  test('returns false when turnAction is undefined', async () => {
    const result = await workflow._validateExecutionPreconditions(
      ctx,
      { id: 'actor1' },
      undefined
    );

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'ProcessingCommandState: Invalid turnAction.'
    );
    expect(mockExceptionHandler.handle).toHaveBeenCalledWith(
      ctx,
      expect.any(Error),
      'actor1'
    );
  });

  test('returns true when all parameters are valid', async () => {
    const result = await workflow._validateExecutionPreconditions(
      ctx,
      { id: 'actor1' },
      action
    );

    expect(result).toBe(true);
    expect(logger.error).not.toHaveBeenCalled();
    expect(mockExceptionHandler.handle).not.toHaveBeenCalled();
  });
});

describe('ProcessingWorkflow._executeAction validation failure scenarios', () => {
  let logger;
  let action;
  let ctx;
  let handler;
  let state;
  let workflow;
  let mockExceptionHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    action = { actionDefinitionId: 'act1', commandString: 'cmd' };
    ctx = {
      getLogger: () => logger,
      getActor: () => ({ id: 'actor1' }),
      getChosenAction: jest.fn(() => action),
      getDecisionMeta: jest.fn(() => ({})),
      getSafeEventDispatcher: () => ({ dispatch: jest.fn() }),
    };
    handler = {
      getTurnContext: jest.fn(() => ctx),
      getLogger: () => logger,
    };
    state = {
      _flag: false,
      _setProcessing(val) {
        this._flag = val;
      },
      get isProcessing() {
        return this._flag;
      },
      _handler: handler,
      getStateName: () => 'ProcessingCommandState',
      _getTurnContext: jest.fn(() => ctx),
      _ensureContext: jest.fn(async () => ctx),
      _logStateTransition: jest.fn(),
      _dispatchSpeech: jest.fn().mockResolvedValue(undefined),
      _processCommandInternal: jest.fn(async () => {
        state.finishProcessing();
      }),
      finishProcessing: jest.fn(),
    };

    mockExceptionHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
    };

    workflow = new ProcessingWorkflow(
      state,
      'cmd',
      null,
      (a) => {
        state.action = a;
      },
      mockExceptionHandler
    );
  });

  test('does not execute action when validation fails for null context', async () => {
    await workflow._executeAction(null, { id: 'actor1' }, action);

    expect(state._processCommandInternal).not.toHaveBeenCalled();
    expect(mockExceptionHandler.handle).toHaveBeenCalledWith(
      null,
      expect.any(Error),
      'actor1'
    );
  });

  test('does not execute action when validation fails for null actor', async () => {
    await workflow._executeAction(ctx, null, action);

    expect(state._processCommandInternal).not.toHaveBeenCalled();
    expect(mockExceptionHandler.handle).toHaveBeenCalledWith(
      ctx,
      expect.any(Error),
      'actor1'
    );
  });

  test('does not execute action when validation fails for null action', async () => {
    await workflow._executeAction(ctx, { id: 'actor1' }, null);

    expect(state._processCommandInternal).not.toHaveBeenCalled();
    expect(mockExceptionHandler.handle).toHaveBeenCalledWith(
      ctx,
      expect.any(Error),
      'actor1'
    );
  });

  test('executes action when all validations pass', async () => {
    await workflow._executeAction(ctx, { id: 'actor1' }, action);

    expect(state._processCommandInternal).toHaveBeenCalledWith(
      ctx,
      { id: 'actor1' },
      action,
      mockExceptionHandler
    );
  });
});

describe('ProcessingWorkflow additional coverage scenarios', () => {
  let logger;
  let action;
  let ctx;
  let handler;
  let state;
  let workflow;
  let mockExceptionHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    action = { actionDefinitionId: 'act1', commandString: 'cmd' };
    ctx = {
      getLogger: () => logger,
      getActor: () => ({ id: 'actor1' }),
      getChosenAction: jest.fn(() => action),
      getDecisionMeta: jest.fn(() => ({})),
      getSafeEventDispatcher: () => ({ dispatch: jest.fn() }),
    };
    handler = {
      getTurnContext: jest.fn(() => ctx),
      getLogger: () => logger,
    };
    state = {
      _flag: false,
      _setProcessing(val) {
        this._flag = val;
      },
      get isProcessing() {
        return this._flag;
      },
      _handler: handler,
      getStateName: () => 'ProcessingCommandState',
      _getTurnContext: jest.fn(() => ctx),
      _ensureContext: jest.fn(async () => ctx),
      _logStateTransition: jest.fn(),
      _dispatchSpeech: jest.fn().mockResolvedValue(undefined),
      _processCommandInternal: jest.fn(async () => {
        state.finishProcessing();
      }),
      finishProcessing: jest.fn(),
    };

    mockExceptionHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
    };

    workflow = new ProcessingWorkflow(
      state,
      'cmd',
      null,
      (a) => {
        state.action = a;
      },
      mockExceptionHandler
    );
  });

  test('handles error when _fetchActionFromContext throws', async () => {
    const error = new Error('Context fetch error');
    ctx.getChosenAction.mockImplementation(() => {
      throw error;
    });

    const result = await workflow._fetchActionFromContext(ctx);

    expect(result).toBe(null);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error retrieving ITurnAction from context'),
      expect.any(Error)
    );
    expect(mockExceptionHandler.handle).toHaveBeenCalled();
  });

  test('validates resolved action with missing actionDefinitionId', async () => {
    const invalidAction = { someOtherProperty: 'value' };

    const result = await workflow._validateResolvedAction(
      invalidAction,
      'actor1'
    );

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('missing or empty actionDefinitionId'),
      expect.objectContaining({ receivedAction: invalidAction })
    );
  });

  test('validates resolved action with empty actionDefinitionId', async () => {
    const invalidAction = { actionDefinitionId: '' };

    const result = await workflow._validateResolvedAction(
      invalidAction,
      'actor1'
    );

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('missing or empty actionDefinitionId'),
      expect.objectContaining({ receivedAction: invalidAction })
    );
  });

  test('handles case when no turnAction is available from context', async () => {
    ctx.getChosenAction.mockReturnValue(null);

    const result = await workflow._obtainTurnAction(ctx, { id: 'actor1' });

    expect(result).toBe(null);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('No ITurnAction available')
    );
  });
});
