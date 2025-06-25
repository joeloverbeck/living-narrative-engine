import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GameStateRestorer from '../../../src/persistence/gameStateRestorer.js';
import { DefinitionNotFoundError } from '../../../src/errors/definitionNotFoundError.js';

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
  const safeEventDispatcher = { dispatch: jest.fn() };
  const restorer = new GameStateRestorer({
    logger,
    entityManager,
    playtimeTracker,
    safeEventDispatcher,
  });
  return {
    restorer,
    logger,
    entityManager,
    playtimeTracker,
    safeEventDispatcher,
  };
}

describe('GameStateRestorer.restoreGameState', () => {
  /** @type {{restorer: GameStateRestorer, logger: any, entityManager: any, playtimeTracker: any, safeEventDispatcher: any}} */
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

  it('dispatches system error when definition is missing', async () => {
    const err = new DefinitionNotFoundError('missing:def');
    ctx.entityManager.reconstructEntity.mockImplementation(() => {
      throw err;
    });
    const data = {
      gameState: {
        entities: [{ instanceId: 'e1', definitionId: 'missing:def' }],
      },
      metadata: {},
    };
    const res = await ctx.restorer.restoreGameState(data);
    expect(res.success).toBe(false);
    expect(ctx.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      'core:system_error_occurred',
      expect.objectContaining({
        details: expect.objectContaining({
          instanceId: 'e1',
          definitionId: 'missing:def',
        }),
      })
    );
  });
});
