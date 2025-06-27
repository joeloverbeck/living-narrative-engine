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
      _dispatchSpeech: jest.fn().mockResolvedValue(undefined),
      _processCommandInternal: jest.fn(async () => {
        state.finishProcessing();
      }),
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
