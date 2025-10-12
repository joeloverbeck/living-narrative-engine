import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

var mockAlgorithms;

const createCacheInstance = () => ({
  hasCacheForRoot: jest.fn().mockReturnValue(false),
  buildCache: jest.fn().mockResolvedValue(undefined),
  invalidateCacheForRoot: jest.fn(),
  has: jest.fn().mockReturnValue(false),
  get: jest.fn().mockReturnValue(undefined),
  size: jest.fn().mockReturnValue(0),
  validateCache: jest.fn().mockReturnValue({ valid: true, issues: [] }),
});

const createQueryCacheInstance = () => ({
  getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
  cacheFindPartsByType: jest.fn(),
  getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
  cacheGetAllParts: jest.fn(),
  invalidateRoot: jest.fn(),
});

const cacheInstances = [];
const queryCacheInstances = [];

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => ({
  __esModule: true,
  AnatomyCacheManager: jest.fn().mockImplementation(() => {
    const instance = createCacheInstance();
    cacheInstances.push(instance);
    return instance;
  }),
}));

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => ({
  __esModule: true,
  AnatomyQueryCache: jest.fn().mockImplementation(() => {
    const instance = createQueryCacheInstance();
    queryCacheInstances.push(instance);
    return instance;
  }),
}));

jest.mock('../../../src/anatomy/anatomyGraphAlgorithms.js', () => {
  mockAlgorithms = {
    getSubgraph: jest.fn(),
    findPartsByType: jest.fn(),
    getAnatomyRoot: jest.fn(),
    getPath: jest.fn(),
    getAllParts: jest.fn(),
  };

  return {
    __esModule: true,
    AnatomyGraphAlgorithms: mockAlgorithms,
  };
});

import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import {
  BodyGraphService,
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';

const buildCustomQueryCache = () => ({
  getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
  cacheFindPartsByType: jest.fn(),
  getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
  cacheGetAllParts: jest.fn(),
  invalidateRoot: jest.fn(),
});

describe('BodyGraphService instrumentation coverage', () => {
  let entityManager;
  let logger;
  let eventDispatcher;

  const createService = (overrides = {}) => {
    const deps = {
      entityManager,
      logger,
      eventDispatcher,
      ...overrides,
    };

    const service = new BodyGraphService(deps);
    const cacheInstance = cacheInstances.at(-1);
    const queryCacheInstance =
      overrides.queryCache !== undefined
        ? overrides.queryCache
        : queryCacheInstances.at(-1);

    return {
      service,
      cacheInstance,
      queryCacheInstance,
      deps,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    cacheInstances.length = 0;
    queryCacheInstances.length = 0;

    AnatomyCacheManager.mockImplementation(() => {
      const instance = createCacheInstance();
      cacheInstances.push(instance);
      return instance;
    });

    AnatomyQueryCache.mockImplementation(() => {
      const instance = createQueryCacheInstance();
      queryCacheInstances.push(instance);
      return instance;
    });

    Object.values(mockAlgorithms).forEach((fn) => fn.mockReset());

    entityManager = {
      getComponentData: jest.fn(),
      removeComponent: jest.fn().mockResolvedValue(undefined),
      getEntityInstance: jest.fn(),
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

  describe('constructor behaviour', () => {
    it('wires dependencies and exposes constants', () => {
      const { cacheInstance, queryCacheInstance } = createService();

      expect(cacheInstance).toBeDefined();
      expect(queryCacheInstance).toBeDefined();
      expect(AnatomyCacheManager).toHaveBeenCalledWith({ logger });
      expect(AnatomyQueryCache).toHaveBeenCalledWith({ logger });
      expect(LIMB_DETACHED_EVENT_ID).toBe('anatomy:limb_detached');
    });

    it('throws descriptive errors when mandatory dependencies are missing', () => {
      expect(
        () => new BodyGraphService({ logger, eventDispatcher })
      ).toThrow(new InvalidArgumentError('entityManager is required'));

      expect(
        () => new BodyGraphService({ entityManager, eventDispatcher })
      ).toThrow(new InvalidArgumentError('logger is required'));

      expect(() => new BodyGraphService({ entityManager, logger })).toThrow(
        new InvalidArgumentError('eventDispatcher is required')
      );
    });

    it('uses a provided query cache without instantiating a new one', () => {
      const customQueryCache = buildCustomQueryCache();
      const { queryCacheInstance } = createService({
        queryCache: customQueryCache,
      });

      expect(queryCacheInstance).toBe(customQueryCache);
      expect(AnatomyQueryCache).not.toHaveBeenCalled();
    });
  });

  it('builds adjacency caches only when missing', async () => {
    const { service, cacheInstance } = createService();
    cacheInstance.hasCacheForRoot
      .mockReturnValueOnce(false)
      .mockReturnValue(true);

    await service.buildAdjacencyCache('actor-1');
    await service.buildAdjacencyCache('actor-1');

    expect(cacheInstance.buildCache).toHaveBeenCalledTimes(1);
    expect(cacheInstance.buildCache).toHaveBeenCalledWith(
      'actor-1',
      entityManager
    );
  });

  it('throws when attempting to detach a part without joint data', async () => {
    const { service } = createService();
    entityManager.getComponentData.mockReturnValueOnce(undefined);

    await expect(service.detachPart('arm-1')).rejects.toThrow(
      new InvalidArgumentError(
        "Entity 'arm-1' has no joint component - cannot detach"
      )
    );
  });

  it('detaches parts with cascade and invalidates caches appropriately', async () => {
    const { service, cacheInstance, queryCacheInstance } = createService();

    entityManager.getComponentData.mockImplementation((_, componentId) => {
      if (componentId === 'anatomy:joint') {
        return { parentId: 'torso-1', socketId: 'shoulder' };
      }
      return null;
    });

    mockAlgorithms.getSubgraph.mockReturnValue(['arm-1', 'hand-1']);
    mockAlgorithms.getAnatomyRoot.mockReturnValue('root-1');
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(424242);

    const result = await service.detachPart('arm-1', {
      cascade: true,
      reason: 'auto',
    });

    expect(mockAlgorithms.getSubgraph).toHaveBeenCalledWith(
      'arm-1',
      cacheInstance
    );
    expect(entityManager.removeComponent).toHaveBeenCalledWith(
      'arm-1',
      'anatomy:joint'
    );
    expect(cacheInstance.invalidateCacheForRoot).toHaveBeenCalledWith(
      'root-1'
    );
    expect(queryCacheInstance.invalidateRoot).toHaveBeenCalledWith('root-1');
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      {
        detachedEntityId: 'arm-1',
        parentEntityId: 'torso-1',
        socketId: 'shoulder',
        detachedCount: 2,
        reason: 'auto',
        timestamp: 424242,
      }
    );
    expect(logger.info).toHaveBeenCalledWith(
      "BodyGraphService: Detached 2 entities from parent 'torso-1'"
    );
    expect(result).toEqual({
      detached: ['arm-1', 'hand-1'],
      parentId: 'torso-1',
      socketId: 'shoulder',
    });

    nowSpy.mockRestore();
  });

  it('supports detaching without cascade', async () => {
    const { service } = createService();

    entityManager.getComponentData.mockImplementation((_, componentId) => {
      if (componentId === 'anatomy:joint') {
        return { parentId: 'torso-2', socketId: 'hip' };
      }
      return null;
    });

    mockAlgorithms.getAnatomyRoot.mockReturnValue('root-2');

    const result = await service.detachPart('leg-1', {
      cascade: false,
      reason: 'manual',
    });

    expect(mockAlgorithms.getSubgraph).not.toHaveBeenCalled();
    expect(result.detached).toEqual(['leg-1']);
  });

  it('returns cached results when available for findPartsByType', () => {
    const { service, queryCacheInstance } = createService();
    queryCacheInstance.getCachedFindPartsByType.mockReturnValue(['cached-arm']);

    const result = service.findPartsByType('root-1', 'arm');

    expect(result).toEqual(['cached-arm']);
    expect(mockAlgorithms.findPartsByType).not.toHaveBeenCalled();
  });

  it('computes and caches findPartsByType results when missing', () => {
    const { service, cacheInstance, queryCacheInstance } = createService();
    mockAlgorithms.findPartsByType.mockReturnValue(['fresh-leg']);

    const result = service.findPartsByType('root-1', 'leg');

    expect(mockAlgorithms.findPartsByType).toHaveBeenCalledWith(
      'root-1',
      'leg',
      cacheInstance
    );
    expect(queryCacheInstance.cacheFindPartsByType).toHaveBeenCalledWith(
      'root-1',
      'leg',
      ['fresh-leg']
    );
    expect(result).toEqual(['fresh-leg']);
  });

  it('delegates simple graph lookups', () => {
    const { service, cacheInstance } = createService();
    mockAlgorithms.getAnatomyRoot.mockReturnValue('root-node');
    mockAlgorithms.getPath.mockReturnValue(['a', 'b']);

    expect(service.getAnatomyRoot('child')).toBe('root-node');
    expect(mockAlgorithms.getAnatomyRoot).toHaveBeenCalledWith(
      'child',
      cacheInstance,
      entityManager
    );

    expect(service.getPath('from', 'to')).toEqual(['a', 'b']);
    expect(mockAlgorithms.getPath).toHaveBeenCalledWith(
      'from',
      'to',
      cacheInstance
    );
  });

  describe('getAllParts', () => {
    it('returns an empty list when no body component is provided', () => {
      const { service } = createService();

      expect(service.getAllParts(null)).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith(
        'BodyGraphService.getAllParts: No bodyComponent provided'
      );
    });

    it('uses the blueprint root when the actor is not cached', () => {
      const { service, cacheInstance, queryCacheInstance } = createService();
      const bodyComponent = { body: { root: 'blueprint-root' } };

      mockAlgorithms.getAllParts.mockReturnValue(['part-a']);
      cacheInstance.has.mockReturnValue(false);

      const result = service.getAllParts(bodyComponent, 'actor-missing');

      expect(mockAlgorithms.getAllParts).toHaveBeenCalledWith(
        'blueprint-root',
        cacheInstance,
        entityManager
      );
      expect(queryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith(
        'blueprint-root',
        ['part-a']
      );
      expect(result).toEqual(['part-a']);
      expect(logger.debug).toHaveBeenCalledWith(
        "BodyGraphService: Using blueprint root 'blueprint-root' as cache root (actor 'actor-missing' not in cache, cache size: 0)"
      );
    });

    it('prefers the actor root when it is cached', () => {
      const { service, cacheInstance, queryCacheInstance } = createService();
      const bodyComponent = { body: { root: 'blueprint-root' } };

      cacheInstance.has.mockReturnValue(true);
      cacheInstance.size.mockReturnValue(3);
      mockAlgorithms.getAllParts.mockReturnValue(['actor-part']);

      const result = service.getAllParts(bodyComponent, 'actor-1');

      expect(mockAlgorithms.getAllParts).toHaveBeenCalledWith(
        'actor-1',
        cacheInstance,
        entityManager
      );
      expect(queryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith(
        'actor-1',
        ['actor-part']
      );
      expect(result).toEqual(['actor-part']);
      expect(logger.debug).toHaveBeenCalledWith(
        "BodyGraphService: Using actor entity 'actor-1' as cache root instead of blueprint root 'blueprint-root' (cache size: 3)"
      );
    });

    it('returns cached parts immediately when query cache has a hit', () => {
      const { service, queryCacheInstance } = createService();
      const bodyComponent = { body: { root: 'cached-root' } };

      queryCacheInstance.getCachedGetAllParts.mockReturnValue(['cached']);

      expect(service.getAllParts(bodyComponent)).toEqual(['cached']);
      expect(mockAlgorithms.getAllParts).not.toHaveBeenCalled();
    });
  });

  describe('component inspection helpers', () => {
    const bodyComponent = { body: { root: 'body-root' } };

    it('detects the presence of a component on any part', () => {
      const { service } = createService();
      mockAlgorithms.getAllParts.mockReturnValue(['part-1', 'part-2']);
      entityManager.getComponentData.mockImplementation((id) => {
        if (id === 'part-1') return {};
        if (id === 'part-2') return { present: true };
        return null;
      });

      expect(service.hasPartWithComponent(bodyComponent, 'component:x')).toBe(
        true
      );
    });

    it('returns false when no component data is found', () => {
      const { service } = createService();
      mockAlgorithms.getAllParts.mockReturnValue(['part-1']);
      entityManager.getComponentData.mockReturnValue(null);

      expect(service.hasPartWithComponent(bodyComponent, 'component:x')).toBe(
        false
      );
    });

    it('finds a nested component value', () => {
      const { service } = createService();
      mockAlgorithms.getAllParts.mockReturnValue(['part-1', 'part-2']);
      entityManager.getComponentData.mockImplementation((id) => {
        if (id === 'part-1') return { stats: { health: 5 } };
        if (id === 'part-2') return { stats: { health: 10 } };
        return null;
      });

      expect(
        service.hasPartWithComponentValue(
          bodyComponent,
          'component:stats',
          'stats.health',
          10
        )
      ).toEqual({ found: true, partId: 'part-2' });
    });

    it('returns an object indicating no match when value not found', () => {
      const { service } = createService();
      mockAlgorithms.getAllParts.mockReturnValue(['part-1']);
      entityManager.getComponentData.mockReturnValue({ stats: { health: 5 } });

      expect(
        service.hasPartWithComponentValue(
          bodyComponent,
          'component:stats',
          'stats.health',
          10
        )
      ).toEqual({ found: false });
    });
  });

  describe('body graph access', () => {
    it('validates the entity identifier', async () => {
      const { service } = createService();

      await expect(service.getBodyGraph(null)).rejects.toThrow(
        new InvalidArgumentError('Entity ID is required and must be a string')
      );
    });

    it('throws when no anatomy:body component exists', async () => {
      const asyncEntityManager = {
        getComponentData: jest.fn().mockResolvedValue(null),
        removeComponent: jest.fn(),
        getEntityInstance: jest.fn(),
      };

      const { service } = createService({ entityManager: asyncEntityManager });

      await expect(service.getBodyGraph('actor-1')).rejects.toThrow(
        new Error('Entity actor-1 has no anatomy:body component')
      );
    });

    it('returns helper functions for exploring the body graph', async () => {
      const bodyComponent = { body: { root: 'body-root' }, recipeId: 'recipe-9' };
      const asyncEntityManager = {
        getComponentData: jest.fn().mockResolvedValue(bodyComponent),
        removeComponent: jest.fn(),
        getEntityInstance: jest.fn(),
      };

      const { service, cacheInstance } = createService({
        entityManager: asyncEntityManager,
      });

      mockAlgorithms.getAllParts.mockReturnValue(['part-1', 'part-2']);
      cacheInstance.get.mockImplementation((id) =>
        id === 'part-1' ? { children: ['part-2'] } : undefined
      );

      const graph = await service.getBodyGraph('actor-1');

      expect(cacheInstance.buildCache).toHaveBeenCalledWith(
        'actor-1',
        asyncEntityManager
      );
      expect(graph.getAllPartIds()).toEqual(['part-1', 'part-2']);
      expect(graph.getConnectedParts('part-1')).toEqual(['part-2']);
      expect(graph.getConnectedParts('unknown')).toEqual([]);
    });
  });

  describe('anatomy data access', () => {
    it('validates the entity identifier', async () => {
      const { service } = createService();

      await expect(service.getAnatomyData(undefined)).rejects.toThrow(
        new InvalidArgumentError('Entity ID is required and must be a string')
      );
    });

    it('returns null when no anatomy component exists', async () => {
      const asyncEntityManager = {
        getComponentData: jest.fn().mockResolvedValue(null),
        removeComponent: jest.fn(),
        getEntityInstance: jest.fn(),
      };

      const { service } = createService({ entityManager: asyncEntityManager });

      await expect(service.getAnatomyData('actor-2')).resolves.toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        "BodyGraphService.getAnatomyData: Entity 'actor-2' has no anatomy:body component"
      );
    });

    it('returns recipe metadata when anatomy data is available', async () => {
      const asyncEntityManager = {
        getComponentData: jest
          .fn()
          .mockResolvedValue({ recipeId: 'recipe-123' }),
        removeComponent: jest.fn(),
        getEntityInstance: jest.fn(),
      };

      const { service } = createService({ entityManager: asyncEntityManager });

      await expect(service.getAnatomyData('actor-3')).resolves.toEqual({
        recipeId: 'recipe-123',
        rootEntityId: 'actor-3',
      });
    });
  });

  it('delegates cache validation and existence checks', () => {
    const { service, cacheInstance } = createService();
    cacheInstance.validateCache.mockReturnValue({ valid: true });
    cacheInstance.hasCacheForRoot.mockReturnValue(true);

    expect(service.validateCache()).toEqual({ valid: true });
    expect(cacheInstance.validateCache).toHaveBeenCalledWith(entityManager);
    expect(service.hasCache('root-1')).toBe(true);
    expect(cacheInstance.hasCacheForRoot).toHaveBeenCalledWith('root-1');
  });

  it('provides helpers for navigating parent/child relationships', () => {
    const { service, cacheInstance } = createService();
    cacheInstance.get.mockImplementation((id) =>
      id === 'child-1' ? { children: ['grandchild'], parentId: 'root' } : null
    );

    expect(service.getChildren('child-1')).toEqual(['grandchild']);
    expect(service.getChildren('unknown')).toEqual([]);
    expect(service.getParent('child-1')).toBe('root');
    expect(service.getParent('orphan')).toBeNull();
  });

  it('walks ancestor chains correctly', () => {
    const { service, cacheInstance } = createService();
    const nodes = new Map([
      ['hand', { parentId: 'arm' }],
      ['arm', { parentId: 'torso' }],
      ['torso', { parentId: null }],
    ]);
    cacheInstance.get.mockImplementation((id) => nodes.get(id) || null);

    expect(service.getAncestors('hand')).toEqual(['arm', 'torso']);
    expect(service.getAncestors('torso')).toEqual([]);
  });

  it('returns all descendants using the graph algorithms', () => {
    const { service, cacheInstance } = createService();
    mockAlgorithms.getSubgraph.mockReturnValue(['root', 'child-1', 'child-2']);

    expect(service.getAllDescendants('root')).toEqual(['child-1', 'child-2']);
    expect(mockAlgorithms.getSubgraph).toHaveBeenCalledWith(
      'root',
      cacheInstance
    );
  });
});
