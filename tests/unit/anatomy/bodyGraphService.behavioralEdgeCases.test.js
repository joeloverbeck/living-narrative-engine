import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => {
  const instances = [];
  const AnatomyCacheManager = jest.fn(() => {
    const instance = {
      hasCacheForRoot: jest.fn(),
      buildCache: jest.fn(() => Promise.resolve()),
      invalidateCacheForRoot: jest.fn(),
      get: jest.fn(),
      has: jest.fn(),
      size: jest.fn().mockReturnValue(0),
      validateCache: jest.fn(),
    };
    instances.push(instance);
    return instance;
  });

  AnatomyCacheManager.__instances = instances;

  return { AnatomyCacheManager };
});

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => {
  const instances = [];
  const AnatomyQueryCache = jest.fn(() => {
    const instance = {
      getCachedFindPartsByType: jest.fn(),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn(),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };
    instances.push(instance);
    return instance;
  });

  AnatomyQueryCache.__instances = instances;

  return { AnatomyQueryCache };
});

jest.mock('../../../src/anatomy/anatomyGraphAlgorithms.js', () => {
  const anatomyGraphAlgorithmsMock = {
    getSubgraph: jest.fn(),
    findPartsByType: jest.fn(),
    getAllParts: jest.fn(),
    getAnatomyRoot: jest.fn(),
    getPath: jest.fn(),
  };

  return { AnatomyGraphAlgorithms: anatomyGraphAlgorithmsMock };
});

import {
  BodyGraphService,
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';

const FIXED_TIMESTAMP = 17000;

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createEntityManager = () => ({
  getComponentData: jest.fn(),
  removeComponent: jest.fn().mockResolvedValue(undefined),
});

const createEventDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
});

const getLatestCacheManager = () => {
  const instances = AnatomyCacheManager.__instances;
  if (!instances.length) {
    throw new Error('Cache manager was not instantiated');
  }
  return instances[instances.length - 1];
};

const getLatestQueryCache = (provided) => {
  if (provided) {
    return provided;
  }
  const instances = AnatomyQueryCache.__instances;
  if (!instances.length) {
    throw new Error('Query cache was not instantiated');
  }
  return instances[instances.length - 1];
};

const createService = (overrides = {}) => {
  const entityManager = overrides.entityManager || createEntityManager();
  const logger = overrides.logger || createLogger();
  const eventDispatcher = overrides.eventDispatcher || createEventDispatcher();

  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
    queryCache: overrides.queryCache,
  });

  return {
    service,
    entityManager,
    logger,
    eventDispatcher,
    cacheManager: getLatestCacheManager(),
    queryCache: getLatestQueryCache(overrides.queryCache),
  };
};

let dateSpy;

beforeEach(() => {
  jest.clearAllMocks();
  AnatomyCacheManager.__instances.length = 0;
  AnatomyQueryCache.__instances.length = 0;
  Object.values(AnatomyGraphAlgorithms).forEach((fn) => fn.mockReset());
  dateSpy = jest.spyOn(Date, 'now').mockReturnValue(FIXED_TIMESTAMP);
});

afterEach(() => {
  dateSpy.mockRestore();
});

describe('BodyGraphService constructor validation', () => {
  it('throws when required dependencies are missing', () => {
    const entityManager = createEntityManager();
    const logger = createLogger();
    const eventDispatcher = createEventDispatcher();

    expect(() => new BodyGraphService({ logger, eventDispatcher })).toThrow(
      'entityManager is required'
    );

    expect(() => new BodyGraphService({ entityManager, eventDispatcher })).toThrow(
      'logger is required'
    );

    expect(() => new BodyGraphService({ entityManager, logger })).toThrow(
      'eventDispatcher is required'
    );
  });

  it('reuses a provided query cache instead of creating a new one', () => {
    const providedQueryCache = {
      getCachedFindPartsByType: jest.fn(),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn(),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };

    const { service } = createService({ queryCache: providedQueryCache });

    expect(AnatomyQueryCache.__instances).toHaveLength(0);

    AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['arm']);
    const result = service.findPartsByType('actor', 'limb');

    expect(result).toEqual(['arm']);
    expect(providedQueryCache.cacheFindPartsByType).toHaveBeenCalledWith(
      'actor',
      'limb',
      ['arm']
    );
  });
});

describe('BodyGraphService core behavior', () => {
  it('builds adjacency cache only when missing', async () => {
    const { service, cacheManager, entityManager } = createService();
    cacheManager.hasCacheForRoot.mockReturnValueOnce(false);

    await service.buildAdjacencyCache('root-1');

    expect(cacheManager.buildCache).toHaveBeenCalledWith(
      'root-1',
      entityManager
    );

    cacheManager.hasCacheForRoot.mockReturnValueOnce(true);
    await service.buildAdjacencyCache('root-1');

    expect(cacheManager.buildCache).toHaveBeenCalledTimes(1);
  });

  it('detaches parts with cascade and updates caches', async () => {
    const { service, cacheManager, queryCache, entityManager, eventDispatcher } =
      createService();

    entityManager.getComponentData.mockImplementation((entityId, componentId) => {
      if (componentId === 'anatomy:joint') {
        return { parentId: 'parent-1', socketId: 'socket-3' };
      }
      return null;
    });

    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([
      'part-1',
      'child-1',
      'child-2',
    ]);
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-1');

    const result = await service.detachPart('part-1', {
      cascade: true,
      reason: 'tests',
    });

    expect(entityManager.removeComponent).toHaveBeenCalledWith(
      'part-1',
      'anatomy:joint'
    );
    expect(cacheManager.invalidateCacheForRoot).toHaveBeenCalledWith('root-1');
    expect(queryCache.invalidateRoot).toHaveBeenCalledWith('root-1');
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'part-1',
        parentEntityId: 'parent-1',
        socketId: 'socket-3',
        detachedCount: 3,
        reason: 'tests',
        timestamp: FIXED_TIMESTAMP,
      })
    );
    expect(result).toEqual({
      detached: ['part-1', 'child-1', 'child-2'],
      parentId: 'parent-1',
      socketId: 'socket-3',
    });
  });

  it('supports non-cascading detach and validates joint presence', async () => {
    const { service, entityManager } = createService();

    entityManager.getComponentData.mockReturnValueOnce({
      parentId: 'parent-2',
      socketId: 'socket-4',
    });

    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-2');

    const result = await service.detachPart('part-2', { cascade: false });

    expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
    expect(result.detached).toEqual(['part-2']);

    entityManager.getComponentData.mockReturnValueOnce(null);

    await expect(service.detachPart('missing-joint')).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(service.detachPart('missing-joint')).rejects.toThrow(
      "Entity 'missing-joint' has no joint component - cannot detach"
    );
  });

  it('uses query cache when finding parts by type', () => {
    const { service, queryCache } = createService();

    queryCache.getCachedFindPartsByType.mockReturnValueOnce(['cached-arm']);

    expect(service.findPartsByType('actor', 'arm')).toEqual(['cached-arm']);
    expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();

    queryCache.getCachedFindPartsByType.mockReturnValueOnce(undefined);
    AnatomyGraphAlgorithms.findPartsByType.mockReturnValueOnce(['fresh-leg']);

    expect(service.findPartsByType('actor', 'leg')).toEqual(['fresh-leg']);
    expect(queryCache.cacheFindPartsByType).toHaveBeenCalledWith(
      'actor',
      'leg',
      ['fresh-leg']
    );
  });

  it('delegates to graph algorithms for root and path queries', () => {
    const { service, cacheManager, entityManager } = createService();

    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-id');
    expect(service.getAnatomyRoot('part-id')).toBe('root-id');
    expect(AnatomyGraphAlgorithms.getAnatomyRoot).toHaveBeenCalledWith(
      'part-id',
      cacheManager,
      entityManager
    );

    AnatomyGraphAlgorithms.getPath.mockReturnValue(['from', 'via', 'to']);
    expect(service.getPath('from', 'to')).toEqual(['from', 'via', 'to']);
    expect(AnatomyGraphAlgorithms.getPath).toHaveBeenCalledWith(
      'from',
      'to',
      cacheManager
    );
  });

  it('returns no parts when body component is missing', () => {
    const { service, logger } = createService();

    expect(service.getAllParts(null)).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      'BodyGraphService.getAllParts: No bodyComponent provided'
    );
  });

  it('gets parts using blueprint root when actor cache is unavailable', () => {
    const { service, cacheManager, queryCache, logger, entityManager } =
      createService();

    cacheManager.has.mockReturnValue(false);
    cacheManager.size.mockReturnValue(2);
    queryCache.getCachedGetAllParts.mockReturnValueOnce(undefined);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValueOnce(['root', 'arm']);

    const parts = service.getAllParts(
      { body: { root: 'blueprint-root' } },
      'actor-id'
    );

    expect(parts).toEqual(['root', 'arm']);
    expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
      'blueprint-root',
      cacheManager,
      entityManager
    );
    expect(queryCache.cacheGetAllParts).toHaveBeenCalledWith(
      'blueprint-root',
      ['root', 'arm']
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "BodyGraphService: Using blueprint root 'blueprint-root' as cache root (actor 'actor-id' not in cache, cache size: 2)"
    );
  });

  it('prefers actor cache when available and serves cached part lists', () => {
    const { service, cacheManager, queryCache } = createService();

    cacheManager.has.mockReturnValue(true);
    queryCache.getCachedGetAllParts.mockReturnValueOnce(['cached-part']);

    const parts = service.getAllParts(
      { body: { root: 'blueprint-root' } },
      'actor-id'
    );

    expect(parts).toEqual(['cached-part']);
    expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
    expect(queryCache.cacheGetAllParts).not.toHaveBeenCalled();
  });

  it('supports direct body structure roots', () => {
    const { service, cacheManager, queryCache, entityManager } = createService();

    cacheManager.has.mockReturnValue(false);
    queryCache.getCachedGetAllParts.mockReturnValueOnce(undefined);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValueOnce(['direct-root']);

    const parts = service.getAllParts({ root: 'direct-root' });

    expect(parts).toEqual(['direct-root']);
    expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
      'direct-root',
      cacheManager,
      entityManager
    );
  });

  it('checks for components and component values across all parts', () => {
    const { service, entityManager } = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1', 'part-2']);

    entityManager.getComponentData.mockImplementation((partId) => {
      if (partId === 'part-1') {
        return { info: 'present', attributes: { size: 'large' } };
      }
      if (partId === 'part-2') {
        return { attributes: { size: 'small' } };
      }
      return null;
    });

    expect(service.hasPartWithComponent({}, 'component')).toBe(true);

    expect(
      service.hasPartWithComponentValue({}, 'component', 'attributes.size', 'large')
    ).toEqual({ found: true, partId: 'part-1' });
    expect(
      service.hasPartWithComponentValue({}, 'component', 'attributes.size', 'medium')
    ).toEqual({ found: false });
  });

  it('builds body graph objects and exposes helper lookups', async () => {
    const { service, cacheManager, entityManager } = createService();

    entityManager.getComponentData.mockImplementation((entityId, componentId) => {
      if (componentId === 'anatomy:body') {
        return { body: { root: 'blueprint-root' } };
      }
      return null;
    });

    cacheManager.get.mockImplementation((id) => {
      if (id === 'part-1') {
        return { children: ['child-1'] };
      }
      if (id === 'child-1') {
        return { parentId: 'part-1', children: [] };
      }
      return undefined;
    });

    AnatomyGraphAlgorithms.getAllParts.mockReturnValueOnce(['actor-root', 'part-1']);
    AnatomyGraphAlgorithms.getSubgraph.mockReturnValueOnce(['part-1', 'child-1']);

    const graph = await service.getBodyGraph('actor-root');

    const getAllPartsSpy = jest
      .spyOn(service, 'getAllParts')
      .mockReturnValue(['actor-root', 'part-1', 'child-1']);

    expect(graph.getAllPartIds()).toEqual(['actor-root', 'part-1', 'child-1']);
    expect(getAllPartsSpy).toHaveBeenCalledWith(
      { body: { root: 'blueprint-root' } },
      'actor-root'
    );

    expect(graph.getConnectedParts('part-1')).toEqual(['child-1']);
  });

  it('validates anatomy body graph input arguments and missing body components', async () => {
    const { service, entityManager } = createService();

    await expect(service.getBodyGraph('')).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(service.getBodyGraph('')).rejects.toThrow(
      'Entity ID is required and must be a string'
    );
    await expect(service.getBodyGraph(42)).rejects.toThrow(InvalidArgumentError);
    await expect(service.getBodyGraph(42)).rejects.toThrow(
      'Entity ID is required and must be a string'
    );

    entityManager.getComponentData.mockReturnValueOnce(null);

    await expect(service.getBodyGraph('actor-root')).rejects.toThrow(
      'Entity actor-root has no anatomy:body component'
    );
  });

  it('retrieves anatomy metadata when available', async () => {
    const { service, entityManager, logger } = createService();

    await expect(service.getAnatomyData('')).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(service.getAnatomyData('')).rejects.toThrow(
      'Entity ID is required and must be a string'
    );

    entityManager.getComponentData.mockReturnValueOnce(null);
    expect(await service.getAnatomyData('actor')).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      "BodyGraphService.getAnatomyData: Entity 'actor' has no anatomy:body component"
    );

    entityManager.getComponentData.mockReturnValueOnce({ recipeId: 'recipe-1' });
    expect(await service.getAnatomyData('actor')).toEqual({
      recipeId: 'recipe-1',
      rootEntityId: 'actor',
    });
  });

  it('provides cache utilities for validation and traversal', () => {
    const { service, cacheManager } = createService();

    cacheManager.validateCache.mockReturnValue(true);
    cacheManager.hasCacheForRoot.mockReturnValue(true);
    cacheManager.get.mockImplementation((id) => {
      if (id === 'child') {
        return { parentId: 'parent', children: ['grandchild'] };
      }
      if (id === 'grandchild') {
        return { parentId: 'parent', children: [] };
      }
      if (id === 'parent') {
        return { parentId: null, children: ['child'] };
      }
      return undefined;
    });

    expect(service.validateCache()).toBe(true);
    expect(service.hasCache('root')).toBe(true);
    expect(service.getChildren('parent')).toEqual(['child']);
    expect(service.getParent('child')).toBe('parent');
    expect(service.getParent('missing')).toBeNull();
    expect(service.getAncestors('grandchild')).toEqual(['parent']);
  });

  it('lists descendants via graph algorithms', () => {
    const { service } = createService();
    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['root', 'child-1', 'child-2']);

    expect(service.getAllDescendants('root')).toEqual(['child-1', 'child-2']);
    expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
      'root',
      expect.anything()
    );
  });
});
