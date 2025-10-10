import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyGraphService, LIMB_DETACHED_EVENT_ID } from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';

const mockCreateCacheManager = jest.fn();
const mockCreateQueryCache = jest.fn();

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => {
  const { jest: jestMock } = require('@jest/globals');
  const factorySpy = jestMock.fn((deps) => mockCreateCacheManager(deps));
  return { AnatomyCacheManager: factorySpy };
});

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => {
  const { jest: jestMock } = require('@jest/globals');
  const factorySpy = jestMock.fn((deps) => mockCreateQueryCache(deps));
  return { AnatomyQueryCache: factorySpy };
});

jest.mock('../../../src/anatomy/anatomyGraphAlgorithms.js', () => {
  const { jest: jestMock } = require('@jest/globals');
  return {
    AnatomyGraphAlgorithms: {
      getSubgraph: jestMock.fn(),
      findPartsByType: jestMock.fn(),
      getAnatomyRoot: jestMock.fn(),
      getPath: jestMock.fn(),
      getAllParts: jestMock.fn(),
    },
  };
});

/** @returns {ReturnType<typeof setupDependencies>} */
let dependencies;

const setupDependencies = () => {
  const cacheManagerInstance = {
    hasCacheForRoot: jest.fn(),
    buildCache: jest.fn(),
    invalidateCacheForRoot: jest.fn(),
    has: jest.fn(),
    size: jest.fn(),
    get: jest.fn(),
    validateCache: jest.fn(),
  };
  const queryCacheInstance = {
    getCachedFindPartsByType: jest.fn(),
    cacheFindPartsByType: jest.fn(),
    getCachedGetAllParts: jest.fn(),
    cacheGetAllParts: jest.fn(),
    invalidateRoot: jest.fn(),
  };

  mockCreateCacheManager.mockReturnValue(cacheManagerInstance);
  mockCreateQueryCache.mockReturnValue(queryCacheInstance);

  const entityManager = {
    getComponentData: jest.fn(),
    removeComponent: jest.fn(),
  };
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const eventDispatcher = {
    dispatch: jest.fn().mockResolvedValue(undefined),
  };

  return {
    cacheManagerInstance,
    queryCacheInstance,
    entityManager,
    logger,
    eventDispatcher,
  };
};

const createService = (overrides = {}) =>
  new BodyGraphService({
    entityManager: dependencies.entityManager,
    logger: dependencies.logger,
    eventDispatcher: dependencies.eventDispatcher,
    ...overrides,
  });

describe('BodyGraphService agent coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(AnatomyGraphAlgorithms).forEach((fn) => fn.mockReset());
    dependencies = setupDependencies();
  });

  describe('constructor validation', () => {
    it('throws if entityManager is missing', () => {
      expect(
        () =>
          new BodyGraphService({
            logger: dependencies.logger,
            eventDispatcher: dependencies.eventDispatcher,
          }),
      ).toThrow(InvalidArgumentError);
    });

    it('throws if logger is missing', () => {
      expect(
        () =>
          new BodyGraphService({
            entityManager: dependencies.entityManager,
            eventDispatcher: dependencies.eventDispatcher,
          }),
      ).toThrow(InvalidArgumentError);
    });

    it('throws if eventDispatcher is missing', () => {
      expect(
        () =>
          new BodyGraphService({
            entityManager: dependencies.entityManager,
            logger: dependencies.logger,
          }),
      ).toThrow(InvalidArgumentError);
    });

    it('constructs cache and query services with provided logger', () => {
      createService({ queryCache: dependencies.queryCacheInstance });

      expect(AnatomyCacheManager).toHaveBeenCalledWith({
        logger: dependencies.logger,
      });
      expect(mockCreateCacheManager).toHaveBeenCalledTimes(1);
      expect(mockCreateQueryCache).not.toHaveBeenCalled();
    });

    it('falls back to a new query cache when not provided', () => {
      createService();

      expect(AnatomyQueryCache).toHaveBeenCalledWith({
        logger: dependencies.logger,
      });
      expect(mockCreateQueryCache).toHaveBeenCalledTimes(1);
    });
  });

  describe('buildAdjacencyCache', () => {
    it('skips building when cache already exists for root', async () => {
      dependencies.cacheManagerInstance.hasCacheForRoot.mockReturnValue(true);
      const service = createService();

      await service.buildAdjacencyCache('entity-root');

      expect(dependencies.cacheManagerInstance.buildCache).not.toHaveBeenCalled();
    });

    it('builds cache when missing for root', async () => {
      dependencies.cacheManagerInstance.hasCacheForRoot.mockReturnValue(false);
      const service = createService();

      await service.buildAdjacencyCache('entity-root');

      expect(dependencies.cacheManagerInstance.buildCache).toHaveBeenCalledWith(
        'entity-root',
        dependencies.entityManager,
      );
    });
  });

  describe('detachPart', () => {
    it('throws when the entity joint component is missing', async () => {
      const service = createService();
      dependencies.entityManager.getComponentData.mockReturnValueOnce(null);

      await expect(service.detachPart('hand-1')).rejects.toThrow(InvalidArgumentError);
      expect(dependencies.entityManager.removeComponent).not.toHaveBeenCalled();
    });

    it('detaches with cascade enabled and invalidates caches', async () => {
      const fixedNow = 1729;
      const originalNow = Date.now;
      Date.now = jest.fn(() => fixedNow);

      const service = createService();
      dependencies.entityManager.getComponentData
        .mockReturnValueOnce({ parentId: 'arm', socketId: 'shoulder' })
        .mockReturnValueOnce({});
      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['hand-1', 'finger-1']);
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('actor-root');

      const result = await service.detachPart('hand-1', { reason: 'injury' });

      expect(dependencies.entityManager.removeComponent).toHaveBeenCalledWith(
        'hand-1',
        'anatomy:joint',
      );
      expect(dependencies.cacheManagerInstance.invalidateCacheForRoot).toHaveBeenCalledWith(
        'actor-root',
      );
      expect(dependencies.queryCacheInstance.invalidateRoot).toHaveBeenCalledWith(
        'actor-root',
      );
      expect(dependencies.eventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedEntityId: 'hand-1',
          parentEntityId: 'arm',
          socketId: 'shoulder',
          detachedCount: 2,
          reason: 'injury',
          timestamp: fixedNow,
        }),
      );
      expect(dependencies.logger.info).toHaveBeenCalledWith(
        "BodyGraphService: Detached 2 entities from parent 'arm'",
      );
      expect(result).toEqual({
        detached: ['hand-1', 'finger-1'],
        parentId: 'arm',
        socketId: 'shoulder',
      });

      Date.now = originalNow;
    });

    it('supports detaching without cascade and skips cache invalidation when root missing', async () => {
      const service = createService();
      dependencies.entityManager.getComponentData
        .mockReturnValueOnce({ parentId: 'torso', socketId: 'socket-7' })
        .mockReturnValueOnce({});
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue(null);

      const result = await service.detachPart('arm-1', {
        cascade: false,
        reason: 'auto-prune',
      });

      expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
      expect(dependencies.cacheManagerInstance.invalidateCacheForRoot).not.toHaveBeenCalled();
      expect(dependencies.queryCacheInstance.invalidateRoot).not.toHaveBeenCalled();
      expect(result.detached).toEqual(['arm-1']);
      expect(result.parentId).toBe('torso');
    });
  });

  describe('query helpers', () => {
    it('returns cached results for findPartsByType', () => {
      dependencies.queryCacheInstance.getCachedFindPartsByType.mockReturnValue(['cached']);
      const service = createService();

      const result = service.findPartsByType('actor', 'hand');

      expect(result).toEqual(['cached']);
      expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();
    });

    it('queries and caches when findPartsByType cache miss occurs', () => {
      dependencies.queryCacheInstance.getCachedFindPartsByType.mockReturnValue(undefined);
      AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['left-hand']);
      const service = createService();

      const result = service.findPartsByType('actor', 'hand');

      expect(AnatomyGraphAlgorithms.findPartsByType).toHaveBeenCalledWith(
        'actor',
        'hand',
        dependencies.cacheManagerInstance,
      );
      expect(dependencies.queryCacheInstance.cacheFindPartsByType).toHaveBeenCalledWith(
        'actor',
        'hand',
        ['left-hand'],
      );
      expect(result).toEqual(['left-hand']);
    });

    it('delegates getAnatomyRoot and getPath to algorithms', () => {
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-99');
      AnatomyGraphAlgorithms.getPath.mockReturnValue(['a', 'b']);
      const service = createService();

      expect(service.getAnatomyRoot('child')).toBe('root-99');
      expect(service.getPath('a', 'b')).toEqual(['a', 'b']);
      expect(AnatomyGraphAlgorithms.getAnatomyRoot).toHaveBeenCalledWith(
        'child',
        dependencies.cacheManagerInstance,
        dependencies.entityManager,
      );
      expect(AnatomyGraphAlgorithms.getPath).toHaveBeenCalledWith(
        'a',
        'b',
        dependencies.cacheManagerInstance,
      );
    });
  });

  describe('getAllParts', () => {
    it('returns empty list when body component is missing', () => {
      const service = createService();

      expect(service.getAllParts(null)).toEqual([]);
    });

    it('returns cached parts when present for actor root', () => {
      const service = createService();
      dependencies.cacheManagerInstance.size.mockReturnValue(3);
      dependencies.cacheManagerInstance.has.mockReturnValue(true);
      dependencies.queryCacheInstance.getCachedGetAllParts.mockReturnValue(['cached-one']);

      const result = service.getAllParts({ body: { root: 'blueprint-root' } }, 'actor-1');

      expect(result).toEqual(['cached-one']);
      expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
    });

    it('queries algorithm when cache miss occurs and caches result', () => {
      const service = createService();
      dependencies.cacheManagerInstance.size.mockReturnValue(1);
      dependencies.cacheManagerInstance.has.mockReturnValueOnce(false);
      dependencies.queryCacheInstance.getCachedGetAllParts.mockReturnValueOnce(undefined);
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['arm', 'hand']);

      const result = service.getAllParts({ root: 'actor-root' });

      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'actor-root',
        dependencies.cacheManagerInstance,
        dependencies.entityManager,
      );
      expect(dependencies.queryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith(
        'actor-root',
        ['arm', 'hand'],
      );
      expect(result).toEqual(['arm', 'hand']);
    });
  });

  describe('component queries', () => {
    it('detects if any part has the requested component data', () => {
      const service = createService();
      const getAllPartsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['part-1', 'part-2', 'part-3']);
      dependencies.entityManager.getComponentData
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({})
        .mockReturnValueOnce({ equipped: true });

      const result = service.hasPartWithComponent({ body: { root: 'root' } }, 'inventory:slot');

      expect(result).toBe(true);
      expect(getAllPartsSpy).toHaveBeenCalled();
    });

    it('returns false when no component data is found on any part', () => {
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['only']);
      dependencies.entityManager.getComponentData.mockReturnValue(null);

      expect(service.hasPartWithComponent({ body: { root: 'root' } }, 'missing')).toBe(false);
    });

    it('locates part by nested component value when matched', () => {
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1']);
      dependencies.entityManager.getComponentData.mockReturnValue({
        stats: { health: 12 },
      });

      const result = service.hasPartWithComponentValue(
        { root: 'actor' },
        'anatomy:stats',
        'stats.health',
        12,
      );

      expect(result).toEqual({ found: true, partId: 'part-1' });
    });

    it('indicates no match when nested value differs', () => {
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1']);
      dependencies.entityManager.getComponentData.mockReturnValue({
        stats: { health: 20 },
      });

      const result = service.hasPartWithComponentValue(
        { root: 'actor' },
        'anatomy:stats',
        'stats.health',
        10,
      );

      expect(result).toEqual({ found: false });
    });
  });

  describe('getBodyGraph', () => {
    it('throws for invalid entity identifiers', async () => {
      const service = createService();

      await expect(service.getBodyGraph('')).rejects.toThrow(InvalidArgumentError);
      await expect(service.getBodyGraph(42)).rejects.toThrow(InvalidArgumentError);
    });

    it('throws when anatomy:body component missing', async () => {
      const service = createService();
      dependencies.entityManager.getComponentData.mockReturnValue(null);

      await expect(service.getBodyGraph('entity-1')).rejects.toThrow(
        "Entity entity-1 has no anatomy:body component",
      );
    });

    it('returns helper methods for interacting with the body graph', async () => {
      const service = createService();
      dependencies.cacheManagerInstance.hasCacheForRoot.mockReturnValue(true);
      dependencies.entityManager.getComponentData.mockReturnValue({
        body: { root: 'root-entity' },
      });
      dependencies.cacheManagerInstance.get.mockImplementation((id) => ({
        children: id === 'part-1' ? ['child-1'] : [],
        parentId: id === 'child-1' ? 'part-1' : null,
      }));
      dependencies.queryCacheInstance.getCachedGetAllParts.mockReturnValueOnce(undefined);
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['part-1', 'child-1']);

      const graph = await service.getBodyGraph('actor-1');
      const parts = graph.getAllPartIds();
      const children = graph.getConnectedParts('part-1');

      expect(parts).toEqual(['part-1', 'child-1']);
      expect(children).toEqual(['child-1']);
      expect(dependencies.cacheManagerInstance.get).toHaveBeenCalledWith('part-1');
    });
  });

  describe('getAnatomyData', () => {
    it('validates entity id input', async () => {
      const service = createService();

      await expect(service.getAnatomyData('')).rejects.toThrow(InvalidArgumentError);
    });

    it('returns null when anatomy component is absent', async () => {
      const service = createService();
      dependencies.entityManager.getComponentData.mockReturnValue(null);

      await expect(service.getAnatomyData('actor')).resolves.toBeNull();
      expect(dependencies.logger.debug).toHaveBeenCalledWith(
        "BodyGraphService.getAnatomyData: Entity 'actor' has no anatomy:body component",
      );
    });

    it('returns recipe metadata when anatomy component present', async () => {
      const service = createService();
      dependencies.entityManager.getComponentData.mockReturnValue({ recipeId: 'recipe-7' });

      await expect(service.getAnatomyData('actor')).resolves.toEqual({
        recipeId: 'recipe-7',
        rootEntityId: 'actor',
      });
    });
  });

  describe('cache accessors', () => {
    it('delegates validation, existence, and node lookups to cache manager', () => {
      const service = createService();
      dependencies.cacheManagerInstance.validateCache.mockReturnValue('validated');
      dependencies.cacheManagerInstance.hasCacheForRoot.mockReturnValue(true);
      dependencies.cacheManagerInstance.get
        .mockReturnValueOnce({ children: ['child-1'] })
        .mockReturnValueOnce({ parentId: 'parent-1' })
        .mockReturnValueOnce({ parentId: 'parent-2' })
        .mockReturnValueOnce(null);

      expect(service.validateCache()).toBe('validated');
      expect(service.hasCache('actor-root')).toBe(true);
      expect(service.getChildren('part-1')).toEqual(['child-1']);
      expect(service.getParent('part-2')).toBe('parent-1');
      expect(service.getAncestors('part-3')).toEqual(['parent-2']);
    });

    it('returns descendant ids excluding the root entity', () => {
      const service = createService();
      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['root', 'child-1', 'child-2']);

      expect(service.getAllDescendants('root')).toEqual(['child-1', 'child-2']);
      expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
        'root',
        dependencies.cacheManagerInstance,
      );
    });
  });
});
