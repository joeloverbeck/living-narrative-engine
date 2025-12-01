import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { ProcessingWorkflow } from '../../../../../src/turns/states/workflows/processingWorkflow.js';

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
      enterState: jest.fn(), // Add mock for AbstractTurnState.prototype.enterState
    };
    // Create a mock processing guard
    state._processingGuard = {
      start: jest.fn(() => {
        state._flag = true;
      }),
      finish: jest.fn(() => {
        state._flag = false;
      }),
    };
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

  test('halts processing while awaiting external event', async () => {
    ctx.isAwaitingExternalEvent = () => true;

    await workflow.run(handler, null);

    expect(state._processCommandInternal).not.toHaveBeenCalled();
    expect(state._processingGuard.finish).toHaveBeenCalled();
  });

  test('aborts when already processing', async () => {
    state.startProcessing();
    await workflow.run(handler, null);
    expect(state._processCommandInternal).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
    expect(state.isProcessing).toBe(true);
  });

  test('handles case when no actor is present at start', async () => {
    // Lines 100-108 coverage
    const ctxWithNoActor = {
      ...ctx,
      getActor: () => null,
    };
    state._ensureContext.mockResolvedValue(ctxWithNoActor);

    await workflow.run(handler, null);

    expect(workflow._exceptionHandler.handle).toHaveBeenCalledWith(
      ctxWithNoActor,
      expect.objectContaining({
        message: 'No actor present at the start of command processing.',
      }),
      'NoActorOnEnter'
    );
    expect(state._processCommandInternal).not.toHaveBeenCalled();
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

    // Create a mock processing guard
    state._processingGuard = {
      start: jest.fn(() => {
        state._flag = true;
      }),
      finish: jest.fn(() => {
        state._flag = false;
      }),
    };
    state.startProcessing = function () {
      this._processingGuard.start();
    };
    state.finishProcessing = function () {
      this._processingGuard.finish();
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

  test('logs warning with N/A when actor is null during already processing check', async () => {
    // Line 52 coverage - when turnCtx?.getActor()?.id returns null
    const ctxWithNullActor = {
      ...ctx,
      getActor: () => null,
    };
    state._ensureContext.mockResolvedValue(ctxWithNullActor);
    state.startProcessing();

    await workflow.run(handler, null);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Actor: N/A. Aborting re-entry.')
    );
  });

  test('uses N/A for actor ID when actor is null in _fetchActionFromContext', async () => {
    // Line 129 coverage
    const ctxWithNullActor = {
      ...ctx,
      getActor: () => null,
      getChosenAction: jest.fn(() => action),
    };

    await workflow._fetchActionFromContext(ctxWithNullActor);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('for actor N/A.')
    );
  });

  test('falls back to constructor commandString in _logActionDetails', async () => {
    // Line 197 coverage
    const actionWithoutCommandString = {
      actionDefinitionId: 'act1',
      // No commandString property
    };

    workflow._logActionDetails(actionWithoutCommandString, 'actor1');

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('CommandString: "cmd".')
    );
  });

  test('handles missing getDecisionMeta method', async () => {
    // Line 241 coverage
    const ctxWithoutDecisionMeta = {
      ...ctx,
      getDecisionMeta: undefined,
    };

    await workflow._dispatchSpeechIfNeeded(ctxWithoutDecisionMeta, {
      id: 'actor1',
    });

    expect(state._dispatchSpeech).toHaveBeenCalledWith(
      ctxWithoutDecisionMeta,
      { id: 'actor1' },
      {}
    );
  });

  test('uses N/A for actor ID when actor is null in validation error', async () => {
    // Line 288 coverage
    const result = await workflow._validateExecutionPreconditions(
      null,
      null,
      action
    );

    expect(result).toBe(false);
    expect(mockExceptionHandler.handle).toHaveBeenCalledWith(
      null,
      expect.any(Error),
      'N/A'
    );
  });
});

describe('ProcessingWorkflow._handleProcessError edge cases', () => {
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

  test('handles case when _getTurnContext returns null and falls back to original context', async () => {
    // Line 325 coverage - state._getTurnContext() returns null
    state._getTurnContext.mockReturnValue(null);
    const error = new Error('Test error');

    await workflow._handleProcessError(ctx, { id: 'actor1' }, error);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Uncaught error from _processCommandInternal scope'
      ),
      error
    );
    expect(mockExceptionHandler.handle).toHaveBeenCalledWith(
      ctx, // Falls back to original context
      error,
      'actor1'
    );
  });

  test('uses getLogger fallback when currentTurnCtx has no getLogger method', async () => {
    // Line 327-328 coverage
    const ctxWithoutGetLogger = {
      getActor: () => ({ id: 'actor2' }),
      // No getLogger method
    };
    state._getTurnContext.mockReturnValue(ctxWithoutGetLogger);
    const error = new Error('Test error');

    await workflow._handleProcessError(ctx, { id: 'actor1' }, error);

    // Should use fallback logger from getLogger util
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Uncaught error from _processCommandInternal scope'
      ),
      error
    );
    expect(mockExceptionHandler.handle).toHaveBeenCalledWith(
      ctxWithoutGetLogger,
      error,
      'actor2'
    );
  });

  test('falls back to actor.id when currentTurnCtx has no actor', async () => {
    // Line 333-334 coverage
    const ctxWithoutActor = {
      getLogger: () => logger,
      getActor: () => null,
    };
    state._getTurnContext.mockReturnValue(ctxWithoutActor);
    const error = new Error('Test error');

    await workflow._handleProcessError(ctx, { id: 'fallbackActor' }, error);

    expect(mockExceptionHandler.handle).toHaveBeenCalledWith(
      ctxWithoutActor,
      error,
      'fallbackActor' // Falls back to passed actor.id
    );
  });

  test('handles all edge cases together - null _getTurnContext falls back to turnCtx', async () => {
    // Lines 325-336 coverage
    state._getTurnContext.mockReturnValue(null);
    const error = new Error('Test error');
    const passedActor = { id: 'passedActorId' };

    await workflow._handleProcessError(ctx, passedActor, error);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Uncaught error from _processCommandInternal scope'
      ),
      error
    );
    expect(mockExceptionHandler.handle).toHaveBeenCalledWith(
      ctx, // Falls back to original context since _getTurnContext() returns null
      error,
      'actor1' // Uses ctx.getActor().id since currentTurnCtxForCatch is ctx (not null)
    );
  });

  test('uses currentTurnCtx actor when available', async () => {
    // Lines 333-334 - normal case where currentTurnCtx has actor
    const ctxWithDifferentActor = {
      getLogger: () => logger,
      getActor: () => ({ id: 'differentActor' }),
    };
    state._getTurnContext.mockReturnValue(ctxWithDifferentActor);
    const error = new Error('Test error');

    await workflow._handleProcessError(ctx, { id: 'originalActor' }, error);

    expect(mockExceptionHandler.handle).toHaveBeenCalledWith(
      ctxWithDifferentActor,
      error,
      'differentActor' // Uses current context's actor
    );
  });
});
