import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GameStateRestorer from '../../src/persistence/gameStateRestorer.js';

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
});