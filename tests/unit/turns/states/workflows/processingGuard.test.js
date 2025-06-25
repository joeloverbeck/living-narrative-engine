import { describe, test, expect, jest } from '@jest/globals';
import { ProcessingCommandState } from '../../../../../src/turns/states/processingCommandState.js';
import { ProcessingGuard } from '../../../../../src/turns/states/helpers/processingGuard.js';
import { ProcessingExceptionHandler } from '../../../../../src/turns/states/helpers/processingExceptionHandler.js';

const mockLogger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
const makeHandler = () => ({
  getLogger: () => mockLogger,
  resetStateAndResources: jest.fn(),
  requestIdleStateTransition: jest.fn(),
  _currentState: null,
});
const makeTurnCtx = () => ({
  getLogger: () => mockLogger,
  getActor: () => ({ id: 'actor1' }),
  getSafeEventDispatcher: () => ({
    dispatch: jest.fn().mockResolvedValue(undefined),
  }),
  endTurn: jest.fn().mockResolvedValue(undefined),
});

describe('ProcessingGuard', () => {
  test('start and finish toggle flag on owner', () => {
    const owner = {
      _flag: false,
      _setProcessing(val) {
        this._flag = val;
      },
      get isProcessing() {
        return this._flag;
      },
    };
    const guard = new ProcessingGuard(owner);
    guard.start();
    expect(owner.isProcessing).toBe(true);
    guard.finish();
    expect(owner.isProcessing).toBe(false);
  });

  test('finish via handleProcessingException clears flag when processing interrupted', async () => {
    const handler = makeHandler();
    const ctx = makeTurnCtx();
    const state = new ProcessingCommandState(handler, null, null);
    state.startProcessing();
    const exceptionHandler = new ProcessingExceptionHandler(state);
    await exceptionHandler.handle(ctx, new Error('boom'), 'actor1');
    expect(state.isProcessing).toBe(false);
  });

  test('private processing flag cannot be modified externally', () => {
    const state = new ProcessingCommandState(makeHandler(), null, null);
    expect('_isProcessing' in state).toBe(false);
    state.startProcessing();
    expect(state.isProcessing).toBe(true);
    // Attempt to set nonexistent public property should not affect actual state
    state._isProcessing = false;
    expect(state.isProcessing).toBe(true);
    state.finishProcessing();
    expect(state.isProcessing).toBe(false);
  });
});
