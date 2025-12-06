import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';

const cacheManagerInstances = [];
const queryCacheInstances = [];

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => {
  return {
    AnatomyCacheManager: jest.fn().mockImplementation(({ logger }) => {
      const instance = {
        hasCacheForRoot: jest.fn().mockReturnValue(false),
        buildCache: jest.fn().mockResolvedValue(undefined),
        invalidateCacheForRoot: jest.fn(),
        has: jest.fn().mockReturnValue(false),
        get: jest.fn(),
        size: jest.fn().mockReturnValue(0),
        validateCache: jest.fn().mockReturnValue({ valid: true, issues: [] }),
      };
      instance.logger = logger;
      cacheManagerInstances.push(instance);
      return instance;
    }),
  };
});

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => {
  return {
    AnatomyQueryCache: jest.fn().mockImplementation(({ logger }) => {
      const instance = {
        invalidateRoot: jest.fn(),
        getCachedFindPartsByType: jest.fn(),
        cacheFindPartsByType: jest.fn(),
        getCachedGetAllParts: jest.fn(),
        cacheGetAllParts: jest.fn(),
      };
      instance.logger = logger;
      queryCacheInstances.push(instance);
      return instance;
    }),
  };
});

jest.mock('../../../src/anatomy/anatomyGraphAlgorithms.js', () => {
  return {
    AnatomyGraphAlgorithms: {
      getSubgraph: jest.fn(),
      findPartsByType: jest.fn(),
      getAnatomyRoot: jest.fn(),
      getPath: jest.fn(),
      getAllParts: jest.fn(),
    },
  };
});

const getLatestCacheManager = () => cacheManagerInstances.at(-1);
const getLatestQueryCache = () => queryCacheInstances.at(-1);

describe('BodyGraphService targeted integration coverage', () => {
  /** @type {{ getComponentData: jest.Mock, removeComponent: jest.Mock }} */
  let entityManager;
  /** @type {{ debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock }} */
  let logger;
  /** @type {{ dispatch: jest.Mock }} */
  let eventDispatcher;
  /** @type {Map<string, any>} */
  let components;

  const componentKey = (entityId, componentId) =>
    `${entityId}:::${componentId}`;

  const setComponent = (entityId, componentId, value) => {
    components.set(componentKey(entityId, componentId), value);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    cacheManagerInstances.length = 0;
    queryCacheInstances.length = 0;
    components = new Map();

    entityManager = {
      getComponentData: jest.fn((entityId, componentId) => {
        return components.get(componentKey(entityId, componentId)) ?? null;
      }),
      removeComponent: jest.fn().mockResolvedValue(undefined),
    };

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    eventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };
  });

  const createService = (overrides = {}) => {
    return new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
      ...overrides,
    });
  };

  describe('constructor validation', () => {
    it('throws when entityManager is missing', () => {
      expect(() => new BodyGraphService({ logger, eventDispatcher })).toThrow(
        InvalidArgumentError
      );
    });

    it('throws when logger is missing', () => {
      expect(
        () => new BodyGraphService({ entityManager, eventDispatcher })
      ).toThrow(InvalidArgumentError);
    });

    it('throws when eventDispatcher is missing', () => {
      expect(() => new BodyGraphService({ entityManager, logger })).toThrow(
        InvalidArgumentError
      );
    });

    it('uses provided query cache without creating a new one', () => {
      const providedCache = {
        invalidateRoot: jest.fn(),
        getCachedFindPartsByType: jest.fn().mockReturnValue([]),
        cacheFindPartsByType: jest.fn(),
        getCachedGetAllParts: jest.fn(),
        cacheGetAllParts: jest.fn(),
      };

      const service = createService({ queryCache: providedCache });
      service.findPartsByType('root-1', 'arm');

      expect(AnatomyQueryCache).not.toHaveBeenCalled();
      expect(providedCache.getCachedFindPartsByType).toHaveBeenCalledWith(
        'root-1',
        'arm'
      );
    });

    it('creates a default query cache when none is provided', () => {
      createService();
      expect(AnatomyQueryCache).toHaveBeenCalledTimes(1);
      expect(getLatestQueryCache()).toBeDefined();
    });
  });

  describe('adjacency cache management', () => {
    it('builds cache when none exists for the root', async () => {
      const service = createService();
      const cacheManager = getLatestCacheManager();
      cacheManager.hasCacheForRoot.mockReturnValue(false);

      await service.buildAdjacencyCache('root-entity');

      expect(cacheManager.buildCache).toHaveBeenCalledWith(
        'root-entity',
        entityManager
      );
    });

    it('skips rebuilding cache when it already exists', async () => {
      const service = createService();
      const cacheManager = getLatestCacheManager();
      cacheManager.hasCacheForRoot.mockReturnValue(true);

      await service.buildAdjacencyCache('root-entity');

      expect(cacheManager.buildCache).not.toHaveBeenCalled();
    });
  });

  describe('detachPart', () => {
    it('throws when the target part lacks a joint', async () => {
      const service = createService();

      await expect(service.detachPart('arm-1')).rejects.toThrow(
        InvalidArgumentError
      );
      expect(entityManager.getComponentData).toHaveBeenCalledWith(
        'arm-1',
        'anatomy:joint'
      );
    });

    it('detaches a part with cascade semantics', async () => {
      const service = createService();
      const cacheManager = getLatestCacheManager();
      const queryCache = getLatestQueryCache();

      setComponent('arm-1', 'anatomy:joint', {
        parentId: 'torso-1',
        socketId: 'left-shoulder',
      });

      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['arm-1', 'hand-1']);
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('actor-9');
      const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(123456);

      const result = await service.detachPart('arm-1', { reason: 'surgery' });

      expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
        'arm-1',
        cacheManager
      );
      expect(entityManager.removeComponent).toHaveBeenCalledWith(
        'arm-1',
        'anatomy:joint'
      );
      expect(cacheManager.invalidateCacheForRoot).toHaveBeenCalledWith(
        'actor-9'
      );
      expect(queryCache.invalidateRoot).toHaveBeenCalledWith('actor-9');
      expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedEntityId: 'arm-1',
          parentEntityId: 'torso-1',
          socketId: 'left-shoulder',
          detachedCount: 2,
          reason: 'surgery',
          timestamp: 123456,
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        "BodyGraphService: Detached 2 entities from parent 'torso-1'"
      );
      expect(result).toEqual({
        detached: ['arm-1', 'hand-1'],
        parentId: 'torso-1',
        socketId: 'left-shoulder',
      });

      dateNowSpy.mockRestore();
    });

    it('detaches only the specified part when cascade is disabled', async () => {
      const service = createService();
      const cacheManager = getLatestCacheManager();
      const queryCache = getLatestQueryCache();

      setComponent('arm-1', 'anatomy:joint', {
        parentId: 'torso-1',
        socketId: 'left-shoulder',
      });

      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('actor-42');

      const result = await service.detachPart('arm-1', {
        cascade: false,
        reason: 'injury',
      });

      expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
      expect(cacheManager.invalidateCacheForRoot).toHaveBeenCalledWith(
        'actor-42'
      );
      expect(queryCache.invalidateRoot).toHaveBeenCalledWith('actor-42');
      expect(result).toEqual({
        detached: ['arm-1'],
        parentId: 'torso-1',
        socketId: 'left-shoulder',
      });
    });
  });

  describe('findPartsByType', () => {
    it('returns cached results when available', () => {
      const service = createService();
      const queryCache = getLatestQueryCache();
      queryCache.getCachedFindPartsByType.mockReturnValue(['cached-arm']);

      const result = service.findPartsByType('root-1', 'arm');

      expect(result).toEqual(['cached-arm']);
      expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();
      expect(queryCache.cacheFindPartsByType).not.toHaveBeenCalled();
    });

    it('queries algorithms and caches results when not cached', () => {
      const service = createService();
      const queryCache = getLatestQueryCache();
      queryCache.getCachedFindPartsByType.mockReturnValue(undefined);
      AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['arm-1']);

      const result = service.findPartsByType('root-1', 'arm');

      expect(AnatomyGraphAlgorithms.findPartsByType).toHaveBeenCalledWith(
        'root-1',
        'arm',
        getLatestCacheManager()
      );
      expect(queryCache.cacheFindPartsByType).toHaveBeenCalledWith(
        'root-1',
        'arm',
        ['arm-1']
      );
      expect(result).toEqual(['arm-1']);
    });
  });

  describe('delegation helpers', () => {
    it('getAnatomyRoot delegates to algorithms', () => {
      const service = createService();
      const cacheManager = getLatestCacheManager();
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-entity');

      const result = service.getAnatomyRoot('hand-1');

      expect(result).toBe('root-entity');
      expect(AnatomyGraphAlgorithms.getAnatomyRoot).toHaveBeenCalledWith(
        'hand-1',
        cacheManager,
        entityManager
      );
    });

    it('getPath delegates to algorithms', () => {
      const service = createService();
      const cacheManager = getLatestCacheManager();
      AnatomyGraphAlgorithms.getPath.mockReturnValue(['arm-1', 'torso-1']);

      const result = service.getPath('arm-1', 'torso-1');

      expect(result).toEqual(['arm-1', 'torso-1']);
      expect(AnatomyGraphAlgorithms.getPath).toHaveBeenCalledWith(
        'arm-1',
        'torso-1',
        cacheManager
      );
    });
  });

  describe('getAllParts', () => {
    it('returns an empty array when no body component is provided', () => {
      const service = createService();

      const result = service.getAllParts(null);

      expect(result).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith(
        'BodyGraphService.getAllParts: No bodyComponent provided'
      );
    });

    it('returns cached results when query cache has an entry', () => {
      const service = createService();
      const queryCache = getLatestQueryCache();
      queryCache.getCachedGetAllParts.mockReturnValue(['cached-part']);

      const result = service.getAllParts(
        { body: { root: 'root-1' } },
        'actor-1'
      );

      expect(result).toEqual(['cached-part']);
      expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
    });

    it('uses actor entity as cache root when available', () => {
      const service = createService();
      const cacheManager = getLatestCacheManager();
      const queryCache = getLatestQueryCache();
      cacheManager.has.mockImplementation((entityId) => entityId === 'actor-1');
      cacheManager.size.mockReturnValue(5);
      queryCache.getCachedGetAllParts.mockReturnValue(undefined);
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['actor-1', 'hand-1']);

      const result = service.getAllParts(
        { body: { root: 'blueprint-root' } },
        'actor-1'
      );

      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'actor-1',
        cacheManager,
        entityManager
      );
      expect(queryCache.cacheGetAllParts).toHaveBeenCalledWith('actor-1', [
        'actor-1',
        'hand-1',
      ]);
      expect(result).toEqual(['actor-1', 'hand-1']);
    });

    it('falls back to blueprint root when actor is missing from cache', () => {
      const service = createService();
      const cacheManager = getLatestCacheManager();
      const queryCache = getLatestQueryCache();
      cacheManager.has.mockReturnValue(false);
      queryCache.getCachedGetAllParts.mockReturnValue(undefined);
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['blueprint-root']);

      const result = service.getAllParts({ root: 'blueprint-root' }, 'actor-1');

      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'blueprint-root',
        cacheManager,
        entityManager
      );
      expect(queryCache.cacheGetAllParts).toHaveBeenCalledWith(
        'blueprint-root',
        ['blueprint-root']
      );
      expect(result).toEqual(['blueprint-root']);
    });
  });

  describe('component queries', () => {
    it('hasPartWithComponent returns true when any part has data', () => {
      const service = createService();
      const parts = ['part-1', 'part-2', 'part-3'];
      const getAllPartsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(parts);

      entityManager.getComponentData.mockImplementation((entityId) => {
        if (entityId === 'part-1') return null;
        if (entityId === 'part-2') return {};
        return { state: 'active' };
      });

      const result = service.hasPartWithComponent(
        { body: { root: 'root-1' } },
        'component:test'
      );

      expect(result).toBe(true);
      expect(entityManager.getComponentData).toHaveBeenCalledTimes(3);
      getAllPartsSpy.mockRestore();
    });

    it('hasPartWithComponent returns false when no part has data', () => {
      const service = createService();
      const getAllPartsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['part-1', 'part-2']);

      entityManager.getComponentData.mockReturnValue(null);

      const result = service.hasPartWithComponent(
        { body: { root: 'root-1' } },
        'component:test'
      );

      expect(result).toBe(false);
      expect(entityManager.getComponentData).toHaveBeenCalledTimes(2);
      getAllPartsSpy.mockRestore();
    });

    it('hasPartWithComponentValue identifies matching nested property', () => {
      const service = createService();
      const getAllPartsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['part-1']);

      entityManager.getComponentData.mockReturnValue({
        posture: { state: 'raised' },
      });

      const result = service.hasPartWithComponentValue(
        { body: { root: 'root-1' } },
        'anatomy:status',
        'posture.state',
        'raised'
      );

      expect(result).toEqual({ found: true, partId: 'part-1' });
      getAllPartsSpy.mockRestore();
    });

    it('hasPartWithComponentValue returns not found when value mismatches', () => {
      const service = createService();
      const getAllPartsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['part-1', 'part-2']);

      entityManager.getComponentData.mockImplementation((entityId) => {
        if (entityId === 'part-1') return { posture: { state: 'lowered' } };
        return { posture: { state: 'neutral' } };
      });

      const result = service.hasPartWithComponentValue(
        { body: { root: 'root-1' } },
        'anatomy:status',
        'posture.state',
        'raised'
      );

      expect(result).toEqual({ found: false });
      getAllPartsSpy.mockRestore();
    });
  });

  describe('getBodyGraph', () => {
    it('throws when entity id is invalid', async () => {
      const service = createService();

      await expect(service.getBodyGraph('')).rejects.toThrow(
        InvalidArgumentError
      );
    });

    it('throws when entity has no anatomy:body component', async () => {
      const service = createService();

      await expect(service.getBodyGraph('actor-1')).rejects.toThrow(
        'Entity actor-1 has no anatomy:body component'
      );
    });

    it('returns helper API when anatomy data is present', async () => {
      const service = createService();
      const cacheManager = getLatestCacheManager();
      setComponent('actor-1', 'anatomy:body', { body: { root: 'root-1' } });
      cacheManager.hasCacheForRoot.mockReturnValue(false);
      const getAllPartsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['root-1', 'hand-1']);
      cacheManager.get.mockImplementation((entityId) => {
        if (entityId === 'root-1') {
          return { children: ['hand-1'] };
        }
        if (entityId === 'hand-1') {
          return { children: [] };
        }
        return undefined;
      });

      const graph = await service.getBodyGraph('actor-1');

      expect(cacheManager.buildCache).toHaveBeenCalledWith(
        'actor-1',
        entityManager
      );
      expect(graph.getAllPartIds()).toEqual(['root-1', 'hand-1']);
      expect(graph.getConnectedParts('root-1')).toEqual(['hand-1']);
      expect(graph.getConnectedParts('unknown')).toEqual([]);
      getAllPartsSpy.mockRestore();
    });
  });

  describe('getAnatomyData', () => {
    it('throws when entity id is invalid', async () => {
      const service = createService();

      await expect(service.getAnatomyData(null)).rejects.toThrow(
        InvalidArgumentError
      );
    });

    it('returns null when anatomy component is missing', async () => {
      const service = createService();

      const result = await service.getAnatomyData('actor-1');

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        "BodyGraphService.getAnatomyData: Entity 'actor-1' has no anatomy:body component"
      );
    });

    it('returns recipe and root data when present', async () => {
      const service = createService();
      setComponent('actor-1', 'anatomy:body', { recipeId: 'recipe-7' });

      const result = await service.getAnatomyData('actor-1');

      expect(result).toEqual({ recipeId: 'recipe-7', rootEntityId: 'actor-1' });
    });
  });

  describe('cache querying helpers', () => {
    it('validateCache delegates to cache manager', () => {
      const service = createService();
      const cacheManager = getLatestCacheManager();
      const expected = { valid: true, issues: [] };
      cacheManager.validateCache.mockReturnValue(expected);

      const result = service.validateCache();

      expect(result).toBe(expected);
      expect(cacheManager.validateCache).toHaveBeenCalledWith(entityManager);
    });

    it('hasCache checks cache presence for root', () => {
      const service = createService();
      const cacheManager = getLatestCacheManager();
      cacheManager.hasCacheForRoot.mockReturnValue(true);

      expect(service.hasCache('root-1')).toBe(true);
      expect(cacheManager.hasCacheForRoot).toHaveBeenCalledWith('root-1');
    });

    it('getChildren reads children from cache entries', () => {
      const service = createService();
      const cacheManager = getLatestCacheManager();
      cacheManager.get.mockImplementation((entityId) => {
        if (entityId === 'torso-1') {
          return { children: ['arm-1', 'arm-2'] };
        }
        return undefined;
      });

      expect(service.getChildren('torso-1')).toEqual(['arm-1', 'arm-2']);
      expect(service.getChildren('unknown')).toEqual([]);
    });

    it('getParent reads parent information from cache', () => {
      const service = createService();
      const cacheManager = getLatestCacheManager();
      cacheManager.get.mockImplementation((entityId) => {
        if (entityId === 'hand-1') {
          return { parentId: 'arm-1' };
        }
        return undefined;
      });

      expect(service.getParent('hand-1')).toBe('arm-1');
      expect(service.getParent('orphan')).toBeNull();
    });

    it('getAncestors walks up the cache hierarchy', () => {
      const service = createService();
      const cacheManager = getLatestCacheManager();
      cacheManager.get.mockImplementation((entityId) => {
        if (entityId === 'hand-1') return { parentId: 'arm-1' };
        if (entityId === 'arm-1') return { parentId: 'torso-1' };
        if (entityId === 'torso-1') return { parentId: null };
        return undefined;
      });

      const result = service.getAncestors('hand-1');

      expect(result).toEqual(['arm-1', 'torso-1']);
    });

    it('getAllDescendants filters out the root entity', () => {
      const service = createService();
      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([
        'torso-1',
        'arm-1',
        'hand-1',
      ]);

      const result = service.getAllDescendants('torso-1');

      expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
        'torso-1',
        getLatestCacheManager()
      );
      expect(result).toEqual(['arm-1', 'hand-1']);
    });
  });
});
