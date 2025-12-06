import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import BodyGraphService from '../../../src/anatomy/bodyGraphService.js';
import { SimpleEntityManager } from '../../common/entities/index.js';

/**
 * @description Creates a logger whose methods are Jest spies.
 * @returns {{debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock}}
 */
function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * @description Creates a query cache implementation that records interactions.
 * @returns {{
 *  getCachedFindPartsByType: jest.Mock,
 *  cacheFindPartsByType: jest.Mock,
 *  getCachedGetAllParts: jest.Mock,
 *  cacheGetAllParts: jest.Mock,
 *  invalidateRoot: jest.Mock
 * }}
 */
function createInstrumentedQueryCache() {
  const typeCache = new Map();
  const partsCache = new Map();

  return {
    getCachedFindPartsByType: jest.fn((rootId, partType) =>
      typeCache.get(`${rootId}:::${partType}`)
    ),
    cacheFindPartsByType: jest.fn((rootId, partType, result) => {
      typeCache.set(`${rootId}:::${partType}`, result);
    }),
    getCachedGetAllParts: jest.fn((rootId) => partsCache.get(rootId)),
    cacheGetAllParts: jest.fn((rootId, result) => {
      partsCache.set(rootId, result);
    }),
    invalidateRoot: jest.fn((rootId) => {
      partsCache.delete(rootId);
      for (const key of [...typeCache.keys()]) {
        if (key.startsWith(`${rootId}:::`)) {
          typeCache.delete(key);
        }
      }
    }),
  };
}

/**
 * @description Creates an event dispatcher mock with an async dispatch method.
 * @returns {{dispatch: jest.Mock<Promise<boolean>>}}
 */
function createEventDispatcher() {
  return {
    dispatch: jest.fn().mockResolvedValue(true),
  };
}

describe('BodyGraphService cache miss coverage integration', () => {
  const ids = {
    actor: 'coverage-actor',
    torso: 'coverage-torso',
    leftArm: 'coverage-left-arm',
    rightArm: 'coverage-right-arm',
    leftHand: 'coverage-left-hand',
  };

  /** @type {SimpleEntityManager} */
  let entityManager;
  let logger;
  let eventDispatcher;

  /**
   * @description Seeds a minimal humanoid anatomy graph for coverage scenarios.
   * @returns {Promise<void>}
   */
  const seedAnatomy = async () => {
    await entityManager.addComponent(ids.actor, 'anatomy:body', {
      recipeId: 'coverage:humanoid',
      body: { root: ids.torso },
    });

    await entityManager.addComponent(ids.torso, 'anatomy:part', {
      partType: 'torso',
      subType: 'torso',
    });
    await entityManager.addComponent(ids.torso, 'anatomy:joint', {
      parentId: ids.actor,
      socketId: 'core',
    });

    await entityManager.addComponent(ids.leftArm, 'anatomy:part', {
      partType: 'limb',
      subType: 'arm',
    });
    await entityManager.addComponent(ids.leftArm, 'anatomy:joint', {
      parentId: ids.torso,
      socketId: 'left_shoulder',
    });

    await entityManager.addComponent(ids.rightArm, 'anatomy:part', {
      partType: 'limb',
      subType: 'arm',
    });
    await entityManager.addComponent(ids.rightArm, 'anatomy:joint', {
      parentId: ids.torso,
      socketId: 'right_shoulder',
    });

    await entityManager.addComponent(ids.leftHand, 'anatomy:part', {
      partType: 'extremity',
      subType: 'hand',
    });
    await entityManager.addComponent(ids.leftHand, 'anatomy:joint', {
      parentId: ids.leftArm,
      socketId: 'left_wrist',
    });
  };

  beforeEach(async () => {
    entityManager = new SimpleEntityManager();
    logger = createMockLogger();
    eventDispatcher = createEventDispatcher();
    await seedAnatomy();
  });

  it('records cache population when findPartsByType performs an uncached query', async () => {
    const queryCache = createInstrumentedQueryCache();
    const service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
      queryCache,
    });

    await service.buildAdjacencyCache(ids.actor);

    const arms = service.findPartsByType(ids.actor, 'arm');

    expect(queryCache.getCachedFindPartsByType).toHaveBeenCalledWith(
      ids.actor,
      'arm'
    );
    expect(Array.isArray(arms)).toBe(true);
    expect(arms).toEqual(expect.arrayContaining([ids.leftArm, ids.rightArm]));
    expect(queryCache.cacheFindPartsByType).toHaveBeenCalledWith(
      ids.actor,
      'arm',
      arms
    );
  });

  it('reads direct body structures and caches aggregated parts', async () => {
    const queryCache = createInstrumentedQueryCache();
    const service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
      queryCache,
    });

    await service.buildAdjacencyCache(ids.actor);

    const directStructure = { root: ids.torso };
    const firstResult = service.getAllParts(directStructure);

    expect(queryCache.getCachedGetAllParts).toHaveBeenCalledWith(ids.torso);
    expect(firstResult).toEqual(
      expect.arrayContaining([
        ids.torso,
        ids.leftArm,
        ids.rightArm,
        ids.leftHand,
      ])
    );
    expect(queryCache.cacheGetAllParts).toHaveBeenCalledWith(
      ids.torso,
      firstResult
    );

    const secondResult = service.getAllParts(directStructure);
    expect(queryCache.getCachedGetAllParts).toHaveBeenLastCalledWith(ids.torso);
    expect(secondResult).toBe(firstResult);
    expect(queryCache.cacheGetAllParts).toHaveBeenCalledTimes(1);

    expect(
      logger.debug.mock.calls.some(([message]) =>
        message?.includes('bodyComponent.root')
      )
    ).toBe(true);
  });
});
