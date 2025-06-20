import { describe, test, expect, jest } from '@jest/globals';
import { ProcessingCommandState } from '../../../../../src/turns/states/processingCommandState.js';
import { ProcessingGuard } from '../../../../../src/turns/states/helpers/processingGuard.js';
import { handleProcessingException } from '../../../../../src/turns/states/helpers/handleProcessingException.js';

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
    const owner = { _isProcessing: false };
    const guard = new ProcessingGuard(owner);
    guard.start();
    expect(owner._isProcessing).toBe(true);
    guard.finish();
    expect(owner._isProcessing).toBe(false);
  });

  test('finish via handleProcessingException clears flag when processing interrupted', async () => {
    const handler = makeHandler();
    const ctx = makeTurnCtx();
    const state = new ProcessingCommandState(handler, null, null);
    state._isProcessing = true;
    await handleProcessingException(state, ctx, new Error('boom'), 'actor1');
    expect(state._isProcessing).toBe(false);
  });
});
