import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
const cacheManagerInstances = [];
const queryCacheInstances = [];
var mockAlgorithms;

const createCacheManagerMock = () => ({
  hasCacheForRoot: jest.fn().mockReturnValue(false),
  buildCache: jest.fn().mockResolvedValue(undefined),
  invalidateCacheForRoot: jest.fn(),
  get: jest.fn(),
  has: jest.fn().mockReturnValue(false),
  size: jest.fn().mockReturnValue(0),
  validateCache: jest.fn().mockReturnValue({ valid: true }),
});

const createQueryCacheMock = () => ({
  getCachedFindPartsByType: jest.fn(),
  cacheFindPartsByType: jest.fn(),
  invalidateRoot: jest.fn(),
  getCachedGetAllParts: jest.fn(),
  cacheGetAllParts: jest.fn(),
});

jest.mock('../../../src/anatomy/anatomyGraphAlgorithms.js', () => {
  mockAlgorithms = {
    getSubgraph: jest.fn(),
    findPartsByType: jest.fn(),
    getAnatomyRoot: jest.fn(),
    getPath: jest.fn(),
    getAllParts: jest.fn(),
  };
  return { AnatomyGraphAlgorithms: mockAlgorithms };
});

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => ({
  AnatomyCacheManager: jest.fn(() => {
    const instance = createCacheManagerMock();
    cacheManagerInstances.push(instance);
    return instance;
  }),
}));

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => ({
  AnatomyQueryCache: jest.fn(() => {
    const instance = createQueryCacheMock();
    queryCacheInstances.push(instance);
    return instance;
  }),
}));

import { BodyGraphService, LIMB_DETACHED_EVENT_ID } from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';

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

const createDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
});

const getLatestCacheManager = () => cacheManagerInstances.at(-1);
const getLatestQueryCache = () => queryCacheInstances.at(-1);

const createService = (overrides = {}) => {
  const entityManager = overrides.entityManager ?? createEntityManager();
  const logger = overrides.logger ?? createLogger();
  const eventDispatcher = overrides.eventDispatcher ?? createDispatcher();
  const queryCache = overrides.queryCache;

  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
    queryCache,
  });

  return {
    service,
    entityManager,
    logger,
    eventDispatcher,
    cacheManager: getLatestCacheManager(),
    queryCache: queryCache ?? getLatestQueryCache(),
  };
};

const resetAlgorithmMocks = () => {
  if (mockAlgorithms) {
    Object.values(mockAlgorithms).forEach((fn) => fn.mockReset());
  }
};

describe('BodyGraphService targeted coverage improvements', () => {
  beforeEach(() => {
    cacheManagerInstances.length = 0;
    queryCacheInstances.length = 0;
    jest.clearAllMocks();
    resetAlgorithmMocks();
  });

  it('validates constructor dependencies and respects a provided query cache', () => {
    const logger = createLogger();
    const dispatcher = createDispatcher();
    const constructWithoutEntityManager = () =>
      new BodyGraphService({ logger, eventDispatcher: dispatcher });
    const constructWithoutLogger = () =>
      new BodyGraphService({ entityManager: createEntityManager(), eventDispatcher: dispatcher });
    const constructWithoutDispatcher = () =>
      new BodyGraphService({ entityManager: createEntityManager(), logger });

    expect(constructWithoutEntityManager).toThrow(InvalidArgumentError);
    expect(constructWithoutEntityManager).toThrow('entityManager is required');
    expect(constructWithoutLogger).toThrow(InvalidArgumentError);
    expect(constructWithoutLogger).toThrow('logger is required');
    expect(constructWithoutDispatcher).toThrow(InvalidArgumentError);
    expect(constructWithoutDispatcher).toThrow('eventDispatcher is required');

    const customCache = { custom: true };
    const { cacheManager } = createService({ queryCache: customCache });
    expect(AnatomyQueryCache).not.toHaveBeenCalled();
    expect(cacheManager).toBeDefined();
  });

  it('builds adjacency caches only when missing', async () => {
    const { service, entityManager, cacheManager } = createService();
    cacheManager.hasCacheForRoot.mockReturnValueOnce(false).mockReturnValue(true);

    await service.buildAdjacencyCache('actor-1');
    expect(cacheManager.buildCache).toHaveBeenCalledWith('actor-1', entityManager);

    await service.buildAdjacencyCache('actor-1');
    expect(cacheManager.buildCache).toHaveBeenCalledTimes(1);
  });

  it('detaches parts with cascade and refreshes caches', async () => {
    const { service, entityManager, cacheManager, queryCache, eventDispatcher, logger } = createService();
    entityManager.getComponentData.mockImplementation((id, component) => {
      if (component === 'anatomy:joint' && id === 'arm-1') {
        return { parentId: 'torso-1', socketId: 'shoulder' };
      }
      return null;
    });
    mockAlgorithms.getSubgraph.mockReturnValue(['arm-1', 'hand-1']);
    mockAlgorithms.getAnatomyRoot.mockReturnValue('root-7');

    const result = await service.detachPart('arm-1', { cascade: true, reason: 'test-case' });

    expect(entityManager.removeComponent).toHaveBeenCalledWith('arm-1', 'anatomy:joint');
    expect(cacheManager.invalidateCacheForRoot).toHaveBeenCalledWith('root-7');
    expect(queryCache.invalidateRoot).toHaveBeenCalledWith('root-7');
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'arm-1',
        parentEntityId: 'torso-1',
        socketId: 'shoulder',
        detachedCount: 2,
        reason: 'test-case',
        timestamp: expect.any(Number),
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      "BodyGraphService: Detached 2 entities from parent 'torso-1'"
    );
    expect(result).toEqual({ detached: ['arm-1', 'hand-1'], parentId: 'torso-1', socketId: 'shoulder' });
  });

  it('detaches only the target when cascade is disabled', async () => {
    const { service, entityManager } = createService();
    entityManager.getComponentData.mockReturnValue({ parentId: 'torso-9', socketId: 'hip' });

    const result = await service.detachPart('leg-1', { cascade: false });

    expect(mockAlgorithms.getSubgraph).not.toHaveBeenCalled();
    expect(result.detached).toEqual(['leg-1']);
  });

  it('rejects detaching parts without joint data', async () => {
    const { service, entityManager } = createService();
    entityManager.getComponentData.mockReturnValue(null);

    await expect(service.detachPart('unknown')).rejects.toThrow(
      "Entity 'unknown' has no joint component - cannot detach"
    );
  });

  it('uses cached results for findPartsByType and records fresh queries', () => {
    const { service, cacheManager, queryCache } = createService();
    queryCache.getCachedFindPartsByType.mockReturnValue(['cached-hand']);

    expect(service.findPartsByType('root-1', 'hand')).toEqual(['cached-hand']);
    expect(mockAlgorithms.findPartsByType).not.toHaveBeenCalled();

    queryCache.getCachedFindPartsByType.mockReturnValueOnce(undefined);
    mockAlgorithms.findPartsByType.mockReturnValue(['fresh-leg']);

    const fresh = service.findPartsByType('root-1', 'leg');
    expect(mockAlgorithms.findPartsByType).toHaveBeenCalledWith('root-1', 'leg', cacheManager);
    expect(queryCache.cacheFindPartsByType).toHaveBeenCalledWith('root-1', 'leg', ['fresh-leg']);
    expect(fresh).toEqual(['fresh-leg']);
  });

  it('handles missing body components and missing roots gracefully', () => {
    const { service, logger } = createService();
    expect(service.getAllParts(undefined)).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      'BodyGraphService.getAllParts: No bodyComponent provided'
    );

    logger.debug.mockClear();
    expect(service.getAllParts({})).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      'BodyGraphService.getAllParts: No root ID found in bodyComponent'
    );
  });

  it('fetches all parts, caches results, and logs cache root decisions', () => {
    const { service, cacheManager, queryCache, entityManager, logger } = createService();
    queryCache.getCachedGetAllParts.mockReturnValueOnce(undefined);
    mockAlgorithms.getAllParts.mockReturnValue(['part-a', 'part-b']);
    cacheManager.size.mockReturnValue(1);

    const result = service.getAllParts({ body: { root: 'blueprint-root' } });
    expect(mockAlgorithms.getAllParts).toHaveBeenCalledWith('blueprint-root', cacheManager, entityManager);
    expect(queryCache.cacheGetAllParts).toHaveBeenCalledWith('blueprint-root', ['part-a', 'part-b']);
    expect(result).toEqual(['part-a', 'part-b']);
    expect(logger.debug).toHaveBeenCalledWith(
      "BodyGraphService: Using blueprint root 'blueprint-root' as cache root (actor 'null' not in cache, cache size: 1)"
    );
  });

  it('supports direct body components with root field', () => {
    const { service, cacheManager, queryCache, entityManager, logger } = createService();
    cacheManager.size.mockReturnValue(0);
    cacheManager.has.mockReturnValue(false);
    queryCache.getCachedGetAllParts.mockReturnValue(undefined);
    mockAlgorithms.getAllParts.mockReturnValue(['direct']);

    const result = service.getAllParts({ root: 'direct-root' });

    expect(mockAlgorithms.getAllParts).toHaveBeenCalledWith(
      'direct-root',
      cacheManager,
      entityManager
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "BodyGraphService.getAllParts: Found root ID in bodyComponent.root: direct-root"
    );
    expect(result).toEqual(['direct']);
  });

  it('prefers actor cache roots and reuses cached query results', () => {
    const { service, cacheManager, queryCache, entityManager, logger } = createService();
    cacheManager.has.mockImplementation((id) => id === 'actor-77');
    cacheManager.size.mockReturnValue(4);
    queryCache.getCachedGetAllParts.mockReturnValueOnce(undefined).mockReturnValueOnce(['cached']);
    mockAlgorithms.getAllParts.mockReturnValue(['primary']);

    const first = service.getAllParts({ body: { root: 'blue-root' } }, 'actor-77');
    expect(mockAlgorithms.getAllParts).toHaveBeenCalledWith('actor-77', cacheManager, entityManager);
    expect(queryCache.cacheGetAllParts).toHaveBeenCalledWith('actor-77', ['primary']);
    expect(logger.debug).toHaveBeenCalledWith(
      "BodyGraphService: Using actor entity 'actor-77' as cache root instead of blueprint root 'blue-root' (cache size: 4)"
    );

    const second = service.getAllParts({ body: { root: 'blue-root' } }, 'actor-77');
    expect(second).toEqual(['cached']);
  });

  it('detects parts with specific components and values', () => {
    const { service, entityManager } = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['p1', 'p2']);
    entityManager.getComponentData.mockImplementation((id, component) => {
      if (component === 'component-x' && id === 'p1') {
        return {};
      }
      if (component === 'component-x' && id === 'p2') {
        return { enabled: true };
      }
      if (component === 'component-y' && id === 'p2') {
        return { stats: { locked: true } };
      }
      return null;
    });

    expect(service.hasPartWithComponent({}, 'component-x')).toBe(true);
    expect(
      service.hasPartWithComponentValue({}, 'component-y', 'stats.locked', true)
    ).toEqual({ found: true, partId: 'p2' });
    expect(
      service.hasPartWithComponentValue({}, 'component-y', 'stats.locked', false)
    ).toEqual({ found: false });
    expect(service.hasPartWithComponent({}, 'component-z')).toBe(false);
  });

  it('validates body graph retrieval and exposes traversal helpers', async () => {
    const { service, entityManager, cacheManager } = createService();
    cacheManager.hasCacheForRoot.mockReturnValue(true);
    entityManager.getComponentData.mockImplementation((id, component) => {
      if (component === 'anatomy:body' && id === 'actor-1') {
        return { body: { root: 'root-node' } };
      }
      return null;
    });
    cacheManager.get.mockImplementation((id) => {
      if (id === 'root-node') {
        return { children: ['child-1'], parentId: null };
      }
      if (id === 'child-1') {
        return { children: ['child-2'], parentId: 'root-node' };
      }
      if (id === 'child-2') {
        return { children: [], parentId: 'child-1' };
      }
      return undefined;
    });
    mockAlgorithms.getAllParts.mockReturnValue(['root-node', 'child-1', 'child-2']);
    mockAlgorithms.getPath.mockReturnValue(['child-1', 'root-node']);

    const graph = await service.getBodyGraph('actor-1');
    expect(cacheManager.hasCacheForRoot).toHaveBeenCalledWith('actor-1');
    expect(graph.getAllPartIds()).toEqual(['root-node', 'child-1', 'child-2']);
    expect(graph.getConnectedParts('child-1')).toEqual(['child-2']);
    expect(graph.getConnectedParts('missing')).toEqual([]);
    expect(service.getPath('child-1', 'root-node')).toEqual(['child-1', 'root-node']);
  });

  it('throws descriptive errors for invalid body graph queries', async () => {
    const { service, entityManager } = createService();
    await expect(service.getBodyGraph('')).rejects.toThrow(
      'Entity ID is required and must be a string'
    );

    entityManager.getComponentData.mockReturnValue(null);
    await expect(service.getBodyGraph('actor-2')).rejects.toThrow(
      'Entity actor-2 has no anatomy:body component'
    );
  });

  it('returns anatomy data and logs missing components', async () => {
    const { service, entityManager, logger } = createService();
    await expect(service.getAnatomyData('')).rejects.toThrow(
      'Entity ID is required and must be a string'
    );

    entityManager.getComponentData.mockReturnValueOnce(null);
    const missing = await service.getAnatomyData('actor-2');
    expect(missing).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      "BodyGraphService.getAnatomyData: Entity 'actor-2' has no anatomy:body component"
    );

    entityManager.getComponentData.mockReturnValue({ recipeId: 'recipe-9' });
    const data = await service.getAnatomyData('actor-3');
    expect(data).toEqual({ recipeId: 'recipe-9', rootEntityId: 'actor-3' });
  });

  it('proxies cache validation and lookup helpers', () => {
    const { service, cacheManager } = createService();
    cacheManager.validateCache.mockReturnValue({ valid: false, issues: ['x'] });
    cacheManager.hasCacheForRoot.mockReturnValue(true);
    cacheManager.get.mockImplementation((id) => {
      if (id === 'node-1') {
        return { children: ['node-2'], parentId: 'root-1' };
      }
      if (id === 'node-2') {
        return { children: [], parentId: 'node-1' };
      }
      return undefined;
    });
    mockAlgorithms.getSubgraph.mockReturnValue(['node-1', 'node-2', 'node-3']);

    expect(service.validateCache()).toEqual({ valid: false, issues: ['x'] });
    expect(service.hasCache('root-1')).toBe(true);
    expect(service.getChildren('node-1')).toEqual(['node-2']);
    expect(service.getChildren('missing')).toEqual([]);
    expect(service.getParent('node-1')).toEqual('root-1');
    expect(service.getParent('missing')).toBeNull();
    expect(service.getAncestors('node-2')).toEqual(['node-1', 'root-1']);
    expect(service.getAllDescendants('node-1')).toEqual(['node-2', 'node-3']);
  });
});
