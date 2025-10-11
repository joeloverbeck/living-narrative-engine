import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => {
  const instances = [];
  const createCacheManagerInstance = () => ({
    hasCacheForRoot: jest.fn().mockReturnValue(false),
    buildCache: jest.fn().mockResolvedValue(undefined),
    invalidateCacheForRoot: jest.fn(),
    get: jest.fn(),
    has: jest.fn().mockReturnValue(false),
    size: jest.fn().mockReturnValue(0),
    validateCache: jest.fn().mockReturnValue({ valid: true }),
  });

  const AnatomyCacheManager = jest.fn(() => {
    const instance = createCacheManagerInstance();
    instances.push(instance);
    return instance;
  });

  AnatomyCacheManager.__instances = instances;

  return {
    AnatomyCacheManager,
  };
});

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => {
  const instances = [];
  const createQueryCacheInstance = () => ({
    getCachedFindPartsByType: jest.fn(),
    cacheFindPartsByType: jest.fn(),
    getCachedGetAllParts: jest.fn(),
    cacheGetAllParts: jest.fn(),
    invalidateRoot: jest.fn(),
  });

  const AnatomyQueryCache = jest.fn(() => {
    const instance = createQueryCacheInstance();
    instances.push(instance);
    return instance;
  });

  AnatomyQueryCache.__instances = instances;

  return {
    AnatomyQueryCache,
  };
});

jest.mock('../../../src/anatomy/anatomyGraphAlgorithms.js', () => {
  const anatomyGraphAlgorithmsMock = {
    getSubgraph: jest.fn(),
    findPartsByType: jest.fn(),
    getAllParts: jest.fn(),
    getAnatomyRoot: jest.fn(),
    getPath: jest.fn(),
  };

  return {
    AnatomyGraphAlgorithms: anatomyGraphAlgorithmsMock,
  };
});

import {
  BodyGraphService,
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';

const noopLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
});

const buildQueryCacheDouble = () => ({
  getCachedFindPartsByType: jest.fn(),
  cacheFindPartsByType: jest.fn(),
  getCachedGetAllParts: jest.fn(),
  cacheGetAllParts: jest.fn(),
  invalidateRoot: jest.fn(),
});

describe('BodyGraphService targeted coverage', () => {
  let entityManager;
  let logger;
  let eventDispatcher;
  let service;
  let cacheManager;
  let queryCache;

  const instantiateService = (overrides = {}) => {
    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
      ...overrides,
    });
    cacheManager = AnatomyCacheManager.__instances.at(-1);
    queryCache =
      overrides.queryCache !== undefined
        ? overrides.queryCache
        : AnatomyQueryCache.__instances.at(-1);
    return service;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    AnatomyCacheManager.__instances.length = 0;
    AnatomyCacheManager.mockClear();
    AnatomyQueryCache.__instances.length = 0;
    AnatomyQueryCache.mockClear();
    AnatomyGraphAlgorithms.getSubgraph.mockReset();
    AnatomyGraphAlgorithms.findPartsByType.mockReset();
    AnatomyGraphAlgorithms.getAllParts.mockReset();
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReset();
    AnatomyGraphAlgorithms.getPath.mockReset();

    entityManager = {
      getComponentData: jest.fn(),
      removeComponent: jest.fn().mockResolvedValue(undefined),
    };

    logger = noopLogger();
    eventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };
  });

  describe('constructor validation', () => {
    it('requires the entity manager dependency', () => {
      expect(
        () =>
          new BodyGraphService({
            logger,
            eventDispatcher,
          })
      ).toThrow(new InvalidArgumentError('entityManager is required'));
    });

    it('requires the logger dependency', () => {
      expect(
        () =>
          new BodyGraphService({
            entityManager,
            eventDispatcher,
          })
      ).toThrow(new InvalidArgumentError('logger is required'));
    });

    it('requires the event dispatcher dependency', () => {
      expect(
        () =>
          new BodyGraphService({
            entityManager,
            logger,
          })
      ).toThrow(new InvalidArgumentError('eventDispatcher is required'));
    });

    it('prefers an injected query cache implementation when provided', () => {
      const injectedQueryCache = buildQueryCacheDouble();

      instantiateService({ queryCache: injectedQueryCache });

      expect(AnatomyQueryCache).not.toHaveBeenCalled();
      expect(queryCache).toBe(injectedQueryCache);
    });
  });

  describe('cache building', () => {
    it('builds the adjacency cache only when no cache exists', async () => {
      instantiateService();

      cacheManager.hasCacheForRoot
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      await service.buildAdjacencyCache('root-node');
      await service.buildAdjacencyCache('root-node');

      expect(cacheManager.buildCache).toHaveBeenCalledTimes(1);
      expect(cacheManager.buildCache).toHaveBeenCalledWith(
        'root-node',
        entityManager,
      );
    });
  });

  describe('detaching parts', () => {
    it('detaches cascading parts and invalidates related caches', async () => {
      instantiateService();

      entityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === 'anatomy:joint' && entityId === 'part-1') {
          return { parentId: 'torso', socketId: 'shoulder' };
        }
        return undefined;
      });

      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['part-1', 'child-1']);
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-entity');

      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(424242);

      const result = await service.detachPart('part-1', {
        cascade: true,
        reason: 'injury',
      });

      expect(entityManager.removeComponent).toHaveBeenCalledWith(
        'part-1',
        'anatomy:joint',
      );
      expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
        'part-1',
        cacheManager,
      );
      expect(cacheManager.invalidateCacheForRoot).toHaveBeenCalledWith(
        'root-entity',
      );
      expect(queryCache.invalidateRoot).toHaveBeenCalledWith('root-entity');
      expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        {
          detachedEntityId: 'part-1',
          parentEntityId: 'torso',
          socketId: 'shoulder',
          detachedCount: 2,
          reason: 'injury',
          timestamp: 424242,
        },
      );
      expect(logger.info).toHaveBeenCalledWith(
        "BodyGraphService: Detached 2 entities from parent 'torso'",
      );
      expect(result).toEqual({
        detached: ['part-1', 'child-1'],
        parentId: 'torso',
        socketId: 'shoulder',
      });

      nowSpy.mockRestore();
    });

    it('supports non-cascading detaches without cache invalidation when no root exists', async () => {
      instantiateService();

      entityManager.getComponentData.mockReturnValue({
        parentId: 'torso-2',
        socketId: 'hip',
      });
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue(null);

      const result = await service.detachPart('part-2', { cascade: false });

      expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
      expect(cacheManager.invalidateCacheForRoot).not.toHaveBeenCalled();
      expect(queryCache.invalidateRoot).not.toHaveBeenCalled();
      expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedEntityId: 'part-2',
          parentEntityId: 'torso-2',
          socketId: 'hip',
          detachedCount: 1,
          reason: 'manual',
        }),
      );
      expect(result).toEqual({
        detached: ['part-2'],
        parentId: 'torso-2',
        socketId: 'hip',
      });
    });

    it('throws a descriptive error when the target has no joint component', async () => {
      instantiateService();

      entityManager.getComponentData.mockReturnValue(undefined);

      await expect(service.detachPart('missing-joint')).rejects.toThrow(
        new InvalidArgumentError(
          "Entity 'missing-joint' has no joint component - cannot detach",
        ),
      );
    });
  });

  describe('querying the graph structure', () => {
    it('leverages cached results when finding parts by type', () => {
      instantiateService();

      queryCache.getCachedFindPartsByType.mockReturnValueOnce(['cached']);

      expect(service.findPartsByType('root', 'arm')).toEqual(['cached']);
      expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();

      queryCache.getCachedFindPartsByType.mockReturnValueOnce(undefined);
      AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['arm-1']);

      expect(service.findPartsByType('root', 'arm')).toEqual(['arm-1']);
      expect(AnatomyGraphAlgorithms.findPartsByType).toHaveBeenCalledWith(
        'root',
        'arm',
        cacheManager,
      );
      expect(queryCache.cacheFindPartsByType).toHaveBeenCalledWith(
        'root',
        'arm',
        ['arm-1'],
      );
    });

    it('delegates to anatomy graph algorithms for root and path lookups', () => {
      instantiateService();

      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-99');
      expect(service.getAnatomyRoot('part-3')).toBe('root-99');
      expect(AnatomyGraphAlgorithms.getAnatomyRoot).toHaveBeenCalledWith(
        'part-3',
        cacheManager,
        entityManager,
      );

      AnatomyGraphAlgorithms.getPath.mockReturnValue(['leg', 'foot']);
      expect(service.getPath('torso', 'foot')).toEqual(['leg', 'foot']);
      expect(AnatomyGraphAlgorithms.getPath).toHaveBeenCalledWith(
        'torso',
        'foot',
        cacheManager,
      );
    });

    it('returns an empty array when no body component is provided', () => {
      instantiateService();

      const result = service.getAllParts(undefined);

      expect(result).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith(
        'BodyGraphService.getAllParts: No bodyComponent provided',
      );
    });

    it('returns an empty array when the component lacks a root identifier', () => {
      instantiateService();

      logger.debug.mockClear();
      const result = service.getAllParts({});

      expect(result).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith(
        'BodyGraphService.getAllParts: No root ID found in bodyComponent',
      );
    });

    it('returns cached part lists when available', () => {
      instantiateService();

      queryCache.getCachedGetAllParts.mockReturnValueOnce(['cached-root']);

      const result = service.getAllParts({ root: 'torso' });

      expect(result).toEqual(['cached-root']);
      expect(queryCache.cacheGetAllParts).not.toHaveBeenCalled();
    });

    it('uses the blueprint root when no actor cache entry exists', () => {
      instantiateService();

      queryCache.getCachedGetAllParts.mockReturnValueOnce(undefined);
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['torso', 'arm']);

      const result = service.getAllParts({ body: { root: 'blueprint-root' } });

      expect(result).toEqual(['torso', 'arm']);
      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'blueprint-root',
        cacheManager,
        entityManager,
      );
      expect(queryCache.cacheGetAllParts).toHaveBeenCalledWith(
        'blueprint-root',
        ['torso', 'arm'],
      );
    });

    it('prefers the actor cache entry when available', () => {
      instantiateService();

      queryCache.getCachedGetAllParts.mockReturnValueOnce(undefined);
      cacheManager.has.mockReturnValueOnce(true);
      cacheManager.size.mockReturnValueOnce(2);
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['actor', 'arm']);

      const result = service.getAllParts({ root: 'blueprint-root' }, 'actor-1');

      expect(result).toEqual(['actor', 'arm']);
      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'actor-1',
        cacheManager,
        entityManager,
      );
      expect(queryCache.cacheGetAllParts).toHaveBeenCalledWith(
        'actor-1',
        ['actor', 'arm'],
      );
    });

    it('falls back to the blueprint root when the actor is not cached', () => {
      instantiateService();

      queryCache.getCachedGetAllParts.mockReturnValueOnce(undefined);
      cacheManager.has.mockReturnValueOnce(false);
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['root', 'arm']);

      const result = service.getAllParts({ root: 'blueprint-root' }, 'actor-missing');

      expect(result).toEqual(['root', 'arm']);
      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'blueprint-root',
        cacheManager,
        entityManager,
      );
    });

    it('detects the presence of components across all parts', () => {
      instantiateService();

      const getAllPartsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['part-a', 'part-b', 'part-c']);

      entityManager.getComponentData
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({})
        .mockReturnValueOnce({ equipped: true });

      expect(
        service.hasPartWithComponent({ root: 'root-entity' }, 'custom:flag'),
      ).toBe(true);

      entityManager.getComponentData.mockReset();
      getAllPartsSpy.mockReturnValue(['part-a']);
      entityManager.getComponentData.mockReturnValue(null);

      expect(
        service.hasPartWithComponent({ root: 'root-entity' }, 'missing:comp'),
      ).toBe(false);

      getAllPartsSpy.mockRestore();
    });

    it('checks nested component values correctly', () => {
      instantiateService();

      const getAllPartsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['part-1', 'part-2']);

      entityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId !== 'custom:stats') return null;
        if (entityId === 'part-1') return { info: { hp: 10 } };
        if (entityId === 'part-2') return { info: { hp: 5 } };
        return null;
      });

      expect(
        service.hasPartWithComponentValue(
          { root: 'root' },
          'custom:stats',
          'info.hp',
          10,
        ),
      ).toEqual({ found: true, partId: 'part-1' });
      expect(
        service.hasPartWithComponentValue(
          { root: 'root' },
          'custom:stats',
          'info.hp',
          20,
        ),
      ).toEqual({ found: false });

      getAllPartsSpy.mockRestore();
    });
  });

  describe('body graph accessors', () => {
    it('validates input when retrieving the body graph', async () => {
      instantiateService();

      await expect(service.getBodyGraph(undefined)).rejects.toThrow(
        new InvalidArgumentError('Entity ID is required and must be a string'),
      );
    });

    it('throws when the entity lacks an anatomy:body component', async () => {
      instantiateService();

      entityManager.getComponentData.mockReturnValue(undefined);

      await expect(service.getBodyGraph('actor-1')).rejects.toThrow(
        new Error('Entity actor-1 has no anatomy:body component'),
      );
    });

    it('returns helper functions wired to cache-backed lookups', async () => {
      instantiateService();

      const bodyComponent = { root: 'root-entity' };
      entityManager.getComponentData.mockReturnValue(bodyComponent);

      const buildCacheSpy = jest
        .spyOn(service, 'buildAdjacencyCache')
        .mockResolvedValue(undefined);
      const getAllPartsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['part-1', 'part-2']);
      cacheManager.get.mockReturnValue({ children: ['child-1'] });

      const graph = await service.getBodyGraph('actor-1');

      expect(buildCacheSpy).toHaveBeenCalledWith('actor-1');
      const partIds = graph.getAllPartIds();
      expect(getAllPartsSpy).toHaveBeenCalledWith(bodyComponent, 'actor-1');
      expect(partIds).toEqual(['part-1', 'part-2']);
      expect(graph.getConnectedParts('part-1')).toEqual(['child-1']);

      buildCacheSpy.mockRestore();
      getAllPartsSpy.mockRestore();
    });

    it('validates anatomy data lookups and returns rich metadata', async () => {
      instantiateService();

      await expect(service.getAnatomyData(null)).rejects.toThrow(
        new InvalidArgumentError('Entity ID is required and must be a string'),
      );

      entityManager.getComponentData.mockReturnValue(null);
      logger.debug.mockClear();
      expect(await service.getAnatomyData('actor-1')).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        "BodyGraphService.getAnatomyData: Entity 'actor-1' has no anatomy:body component",
      );

      entityManager.getComponentData.mockReturnValue({ recipeId: 'recipe-9' });
      expect(await service.getAnatomyData('actor-1')).toEqual({
        recipeId: 'recipe-9',
        rootEntityId: 'actor-1',
      });

      entityManager.getComponentData.mockReturnValue({});
      expect(await service.getAnatomyData('actor-2')).toEqual({
        recipeId: null,
        rootEntityId: 'actor-2',
      });
    });

    it('exposes cache inspection helpers', () => {
      instantiateService();

      cacheManager.validateCache.mockReturnValue({ valid: false, issues: ['bad'] });
      cacheManager.hasCacheForRoot.mockReturnValue(true);
      cacheManager.get
        .mockReturnValueOnce({ children: ['child-1'] })
        .mockReturnValueOnce({ parentId: 'parent-1' });

      expect(service.validateCache()).toEqual({ valid: false, issues: ['bad'] });
      expect(service.hasCache('root-x')).toBe(true);
      expect(service.getChildren('node-1')).toEqual(['child-1']);
      expect(service.getParent('node-2')).toBe('parent-1');
    });

    it('walks ancestor chains and descendant subgraphs', () => {
      instantiateService();

      cacheManager.get.mockImplementation((entityId) => {
        if (entityId === 'child') return { parentId: 'parent' };
        if (entityId === 'parent') return { parentId: 'grandparent' };
        if (entityId === 'grandparent') return { parentId: null };
        return null;
      });

      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([
        'root',
        'child-1',
        'child-2',
      ]);

      expect(service.getAncestors('child')).toEqual(['parent', 'grandparent']);
      expect(service.getAllDescendants('root')).toEqual(['child-1', 'child-2']);
      expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
        'root',
        cacheManager,
      );
    });
  });
});
