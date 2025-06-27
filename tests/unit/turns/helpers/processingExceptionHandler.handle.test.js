import { describe, test, expect, jest } from '@jest/globals';
import { ProcessingExceptionHandler } from '../../../../src/turns/states/helpers/processingExceptionHandler.js';

const createState = (logger, dispatcher) => {
  const state = {
    getStateName: () => 'TestState',
    isProcessing: true,
    finishProcessing: jest.fn(() => {
      state.isProcessing = false;
    }),
    _handler: {
      getLogger: jest.fn(() => logger),
      getSafeEventDispatcher: jest.fn(() => dispatcher),
    },
  };
  return state;
};

describe('ProcessingExceptionHandler.handle', () => {
  test('resets processing flags and ends the turn', async () => {
    const logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const dispatcher = { dispatch: jest.fn() };
    const turnCtx = {
      getLogger: jest.fn(() => logger),
      getSafeEventDispatcher: jest.fn(() => dispatcher),
      endTurn: jest.fn().mockResolvedValue(undefined),
      isAwaitingExternalEvent: jest.fn(() => true),
      setAwaitingExternalEvent: jest.fn(),
      getActor: jest.fn(() => ({ id: 'actor1' })),
    };

    const state = createState(logger, dispatcher);
    const handler = new ProcessingExceptionHandler(state);

    await handler.handle(turnCtx, new Error('boom'), 'actor1');

    expect(state.isProcessing).toBe(false);
    expect(state.finishProcessing).toHaveBeenCalled();
    expect(turnCtx.endTurn).toHaveBeenCalled();
  });
});
