import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { ProcessingExceptionHandler } from '../../../../../src/turns/states/helpers/processingExceptionHandler.js';

/**
 * Creates a basic state object with optional handler.
 *
 * @param {object} [handler]
 */
const makeState = (handler = {}) => ({
  getStateName: () => 'TestState',
  _handler: handler,
});

describe('ProcessingExceptionHandler.tryEndTurn', () => {
  let logger;

  beforeEach(() => {
    logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
  });

  test('returns true when endTurn succeeds', async () => {
    const turnCtx = { endTurn: jest.fn().mockResolvedValue(undefined) };
    const handler = new ProcessingExceptionHandler(makeState());
    const result = await handler.tryEndTurn(turnCtx, new Error('boom'), logger);
    expect(turnCtx.endTurn).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  test('returns true when endTurn fails but handler resets', async () => {
    const turnCtx = { endTurn: jest.fn().mockRejectedValue(new Error('fail')) };
    const state = makeState({
      resetStateAndResources: jest.fn().mockResolvedValue(undefined),
      requestIdleStateTransition: jest.fn().mockResolvedValue(undefined),
    });
    const handler = new ProcessingExceptionHandler(state);
    const result = await handler.tryEndTurn(turnCtx, new Error('boom'), logger);
    expect(turnCtx.endTurn).toHaveBeenCalled();
    expect(state._handler.resetStateAndResources).toHaveBeenCalled();
    expect(result).toBe(true);
  });
});

describe('ProcessingExceptionHandler.handle', () => {
  test('logs warning when end turn and reset both fail', async () => {
    const logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const turnCtx = {
      getLogger: () => logger,
      getSafeEventDispatcher: () => ({ dispatch: jest.fn() }),
    };
    const state = makeState();
    const handler = new ProcessingExceptionHandler(state);
    await handler.handle(turnCtx, new Error('boom'), 'actor1', true);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to end turn and handler reset was not performed'
      )
    );
  });
});
