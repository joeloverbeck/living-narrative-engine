import { describe, test, expect, jest } from '@jest/globals';
import { destroyCleanupStrategy } from '../../../../src/turns/states/helpers/destroyCleanupStrategy.js';

const makeLogger = () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeContext = (logger = makeLogger()) => ({
  endTurn: jest.fn().mockResolvedValue(undefined),
  getLogger: () => logger,
});

describe('destroyCleanupStrategy helpers', () => {
  test('noActor logs warning', () => {
    const logger = makeLogger();
    destroyCleanupStrategy.noActor(logger, 'TestState');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('N/A_in_context')
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('TestState')
    );
  });

  test('handlerDestroying logs debug', () => {
    const logger = makeLogger();
    const actor = { id: 'a1' };
    destroyCleanupStrategy.handlerDestroying(logger, actor, 'TestState');
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(`actor ${actor.id}`)
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('already being destroyed')
    );
  });

  test('activeActor ends turn', async () => {
    const logger = makeLogger();
    const actor = { id: 'a1' };
    const ctx = makeContext(logger);
    await destroyCleanupStrategy.activeActor(ctx, logger, actor, 'TestState');
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Ending turn via turnContext')
    );
    expect(ctx.endTurn).toHaveBeenCalledWith(expect.any(Error));
  });
});
