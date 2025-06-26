import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { AwaitingActorDecisionState } from '../../../../src/turns/states/awaitingActorDecisionState.js';

const makeLogger = () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeContext = (actor = null, logger = makeLogger()) => ({
  getLogger: () => logger,
  getActor: () => actor,
  endTurn: jest.fn().mockResolvedValue(undefined),
});

describe('AwaitingActorDecisionState destroy helpers', () => {
  let logger;
  let ctx;
  let handler;
  let state;

  beforeEach(() => {
    logger = makeLogger();
    ctx = makeContext(null, logger);
    handler = { _isDestroying: false, _isDestroyed: false };
    state = new AwaitingActorDecisionState(handler);
  });

  test('logs warning when no actor in context', async () => {
    await state._handleDestroyCleanup(handler, ctx, logger, null);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('N/A_in_context')
    );
    expect(ctx.endTurn).not.toHaveBeenCalled();
  });

  test('logs debug when handler already destroying', async () => {
    handler._isDestroying = true;
    const actor = { id: 'a1' };
    await state._handleDestroyCleanup(handler, ctx, logger, actor);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('already being destroyed')
    );
    expect(ctx.endTurn).not.toHaveBeenCalled();
  });

  test('ends turn when active actor present', async () => {
    const actor = { id: 'a1' };
    await state._handleDestroyCleanup(handler, ctx, logger, actor);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Ending turn via turnContext')
    );
    expect(ctx.endTurn).toHaveBeenCalledWith(expect.any(Error));
  });
});
