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

  it('exposes the entities iterator from the wrapped entity manager', () => {
    const entityIterator = Symbol('iterator');
    const entityManager = {
      get entities() {
        return entityIterator;
      },
    };
    const locationQueryService = { getEntitiesInLocation: jest.fn() };
    const adapter = new EntityManagerAdapter({
      entityManager,
      locationQueryService,
    });

    expect(adapter.entities).toBe(entityIterator);
  });

  it('uses locationQueryService for getEntitiesInLocation', () => {
    const entityManager = { clearAll: jest.fn() };
    const locationQueryService = {
      getEntitiesInLocation: jest.fn(() => new Set(['1'])),
    };
    const adapter = new EntityManagerAdapter({
      entityManager,
      locationQueryService,
    });

    const result = adapter.getEntitiesInLocation('loc1');

    expect(locationQueryService.getEntitiesInLocation).toHaveBeenCalledWith(
      'loc1'
    );
    expect(result).toEqual(new Set(['1']));
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
