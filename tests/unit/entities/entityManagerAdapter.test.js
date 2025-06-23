import { describe, it, expect, jest } from '@jest/globals';
import { EntityManagerAdapter } from '../../../src/entities/entityManagerAdapter.js';
import GameStateRestorer from '../../../src/persistence/gameStateRestorer.js';

const makeLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('EntityManagerAdapter', () => {
  it('delegates clearAll to the wrapped entity manager', () => {
    const entityManager = { clearAll: jest.fn() };
    const locationQueryService = { getEntitiesInLocation: jest.fn() };
    const adapter = new EntityManagerAdapter({
      entityManager,
      locationQueryService,
    });

    adapter.clearAll();

    expect(entityManager.clearAll).toHaveBeenCalled();
  });

  it('is compatible with GameStateRestorer', () => {
    const entityManager = {
      clearAll: jest.fn(),
      reconstructEntity: jest.fn(),
    };
    const locationQueryService = { getEntitiesInLocation: jest.fn() };
    const adapter = new EntityManagerAdapter({
      entityManager,
      locationQueryService,
    });
    const playtimeTracker = { setAccumulatedPlaytime: jest.fn() };
    const logger = makeLogger();

    const restorer = new GameStateRestorer({
      logger,
      entityManager: adapter,
      playtimeTracker,
    });

    expect(restorer).toBeInstanceOf(GameStateRestorer);
  });
});
