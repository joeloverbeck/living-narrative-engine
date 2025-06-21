import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { ProcessingWorkflow } from '../../../../../src/turns/states/workflows/processingWorkflow.js';
import { ProcessingGuard } from '../../../../../src/turns/states/helpers/processingGuard.js';
import { handleProcessingException } from '../../../../../src/turns/states/helpers/handleProcessingException.js';

jest.mock(
  '../../../../../src/turns/states/helpers/handleProcessingException.js',
  () => {
    const fn = jest.fn(async (state) => {
      if (state?._processingGuard) {
        state._processingGuard.finish();
      } else if (state) {
        state._isProcessing = false;
      }
    });
    return { __esModule: true, handleProcessingException: fn, default: fn };
  }
);

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
      _isProcessing: false,
      _handler: handler,
      getStateName: () => 'ProcessingCommandState',
      _getTurnContext: jest.fn(() => ctx),
      _ensureContext: jest.fn(async () => ctx),
      _resolveLogger: jest.fn(() => logger),
      _dispatchSpeech: jest.fn().mockResolvedValue(undefined),
      _processCommandInternal: jest.fn(async () => {
        state._processingGuard.finish();
      }),
    };
    state._processingGuard = new ProcessingGuard(state);
    workflow = new ProcessingWorkflow(state, 'cmd', null, (a) => {
      state.action = a;
    });
  });

  test('processes action successfully', async () => {
    await workflow.run(handler, null);
    expect(state._processCommandInternal).toHaveBeenCalledWith(
      ctx,
      { id: 'actor1' },
      action
    );
    expect(state._isProcessing).toBe(false);
  });

  test('handles errors from internal processing', async () => {
    state._processCommandInternal.mockImplementation(async () => {
      throw new Error('fail');
    });
    await workflow.run(handler, null);
    expect(handleProcessingException).toHaveBeenCalled();
    expect(state._isProcessing).toBe(false);
  });

  test('aborts when already processing', async () => {
    state._isProcessing = true;
    await workflow.run(handler, null);
    expect(state._processCommandInternal).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
    expect(state._isProcessing).toBe(true);
  });
});
