import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GameStateRestorer from '../../../src/persistence/gameStateRestorer.js';
import { DefinitionNotFoundError } from '../../../src/errors/definitionNotFoundError.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

const makeLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/**
 *
 */
function makeRestorer() {
  const logger = makeLogger();
  const entityManager = { clearAll: jest.fn(), reconstructEntity: jest.fn() };
  const playtimeTracker = { setAccumulatedPlaytime: jest.fn() };
  const restorer = new GameStateRestorer({
    logger,
    entityManager,
    playtimeTracker,
  });
  return { restorer, logger, entityManager, playtimeTracker };
}

describe('GameStateRestorer.restoreGameState', () => {
  /** @type {{restorer: GameStateRestorer, logger: any, entityManager: any, playtimeTracker: any}} */
  let ctx;

  beforeEach(() => {
    ctx = makeRestorer();
  });

  it('restores entities and playtime', async () => {
    const data = {
      gameState: {
        entities: [
          { instanceId: 'e1', definitionId: 'core:player', components: {} },
        ],
      },
      metadata: { playtimeSeconds: 50 },
    };
    const res = await ctx.restorer.restoreGameState(data);
    expect(ctx.entityManager.clearAll).toHaveBeenCalled();
    expect(ctx.entityManager.reconstructEntity).toHaveBeenCalledWith({
      instanceId: 'e1',
      definitionId: 'core:player',
      overrides: {},
    });
    expect(ctx.playtimeTracker.setAccumulatedPlaytime).toHaveBeenCalledWith(50);
    expect(res.success).toBe(true);
  });

  it('dispatches system error and fails when definition is missing', async () => {
    const dispatcher = { dispatch: jest.fn() };
    ctx = {
      ...ctx,
      restorer: new GameStateRestorer({
        logger: ctx.logger,
        entityManager: ctx.entityManager,
        playtimeTracker: ctx.playtimeTracker,
        safeEventDispatcher: dispatcher,
      }),
    };
    ctx.entityManager.reconstructEntity.mockImplementation(() => {
      throw new DefinitionNotFoundError('missing:def');
    });
    const data = {
      gameState: {
        entities: [
          { instanceId: 'e1', definitionId: 'missing:def', overrides: {} },
        ],
      },
      metadata: {},
    };
    const res = await ctx.restorer.restoreGameState(data);
    expect(res.success).toBe(false);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('Definition'),
      })
    );
  });
});
