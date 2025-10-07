import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  BodyGraphService,
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';

const mockCacheManagerFactory = jest.fn();
const mockQueryCacheFactory = jest.fn();

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => ({
  AnatomyCacheManager: jest.fn((...args) => mockCacheManagerFactory(...args)),
}));

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => ({
  AnatomyQueryCache: jest.fn((...args) => mockQueryCacheFactory(...args)),
}));

jest.mock('../../../src/anatomy/anatomyGraphAlgorithms.js', () => ({
  AnatomyGraphAlgorithms: {
    getSubgraph: jest.fn(),
    findPartsByType: jest.fn(),
    getAnatomyRoot: jest.fn(),
    getPath: jest.fn(),
    getAllParts: jest.fn(),
  },
}));

/** @returns {string} helper to match log text */
const expectStringContaining = (snippet) => expect.stringContaining(snippet);

describe('BodyGraphService exhaustive coverage', () => {
  let entityManager;
  let logger;
  let eventDispatcher;
  let cacheManager;
  let queryCache;

  const createService = (overrides = {}) =>
    new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
      ...overrides,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheManagerFactory.mockReset();
    mockQueryCacheFactory.mockReset();

    entityManager = {
      getComponentData: jest.fn().mockReturnValue(null),
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

    cacheManager = {
      hasCacheForRoot: jest.fn().mockReturnValue(false),
      buildCache: jest.fn().mockResolvedValue(undefined),
      invalidateCacheForRoot: jest.fn(),
      size: jest.fn().mockReturnValue(0),
      has: jest.fn().mockReturnValue(false),
      get: jest.fn(),
      validateCache: jest.fn().mockReturnValue({ ok: true }),
    };

    queryCache = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };

    mockCacheManagerFactory.mockImplementation(() => cacheManager);
    mockQueryCacheFactory.mockImplementation(() => queryCache);

    AnatomyGraphAlgorithms.getSubgraph.mockReset();
    AnatomyGraphAlgorithms.findPartsByType.mockReset();
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReset();
    AnatomyGraphAlgorithms.getPath.mockReset();
    AnatomyGraphAlgorithms.getAllParts.mockReset();

    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([]);
    AnatomyGraphAlgorithms.findPartsByType.mockReturnValue([]);
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue(null);
    AnatomyGraphAlgorithms.getPath.mockReturnValue([]);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue([]);
  });

  it('requires entityManager, logger, and eventDispatcher', () => {
    expect(() => new BodyGraphService({ logger, eventDispatcher })).toThrow(
      InvalidArgumentError
    );
    expect(() => new BodyGraphService({ entityManager, eventDispatcher })).toThrow(
      InvalidArgumentError
    );
    expect(() => new BodyGraphService({ entityManager, logger })).toThrow(
      InvalidArgumentError
    );
  });

  it('creates default cache dependencies when query cache not supplied', () => {
    const service = createService();

    expect(service).toBeInstanceOf(BodyGraphService);
    expect(mockCacheManagerFactory).toHaveBeenCalledWith({ logger });
    expect(mockQueryCacheFactory).toHaveBeenCalledWith({ logger });
  });

  it('accepts a custom query cache without constructing a default one', () => {
    const customQueryCache = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
      cacheFindPartsByType: jest.fn(),
    };

    AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['leg']);

    const service = createService({ queryCache: customQueryCache });
    const result = service.findPartsByType('root', 'leg');

    expect(mockQueryCacheFactory).not.toHaveBeenCalled();
    expect(result).toEqual(['leg']);
    expect(customQueryCache.getCachedFindPartsByType).toHaveBeenCalledWith(
      'root',
      'leg'
    );
    expect(customQueryCache.cacheFindPartsByType).toHaveBeenCalledWith(
      'root',
      'leg',
      ['leg']
    );
  });

  it('builds adjacency cache when missing', async () => {
    cacheManager.hasCacheForRoot.mockReturnValue(false);
    const service = createService();

    await service.buildAdjacencyCache('torso');

    expect(cacheManager.buildCache).toHaveBeenCalledWith('torso', entityManager);
  });

  it('skips cache rebuild when already present', async () => {
    cacheManager.hasCacheForRoot.mockReturnValue(true);
    const service = createService();

    await service.buildAdjacencyCache('torso');

    expect(cacheManager.buildCache).not.toHaveBeenCalled();
  });

  it('detaches parts with cascading removal and cache invalidation', async () => {
    const detachedParts = ['arm', 'hand'];
    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(detachedParts);
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-entity');

    entityManager.getComponentData.mockImplementation((id, componentId) => {
      if (componentId === 'anatomy:joint') {
        return { parentId: 'torso', socketId: 'shoulder' };
      }
      return null;
    });

    const service = createService();
    const result = await service.detachPart('arm', {
      cascade: true,
      reason: 'testing',
    });

    expect(entityManager.removeComponent).toHaveBeenCalledWith(
      'arm',
      'anatomy:joint'
    );
    expect(cacheManager.invalidateCacheForRoot).toHaveBeenCalledWith(
      'root-entity'
    );
    expect(queryCache.invalidateRoot).toHaveBeenCalledWith('root-entity');
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'arm',
        parentEntityId: 'torso',
        socketId: 'shoulder',
        detachedCount: detachedParts.length,
        reason: 'testing',
        timestamp: expect.any(Number),
      })
    );
    expect(result).toEqual({
      detached: detachedParts,
      parentId: 'torso',
      socketId: 'shoulder',
    });
  });

  it('supports non-cascading detachment without invalidating caches when no root found', async () => {
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue(null);
    entityManager.getComponentData.mockReturnValue({
      parentId: 'torso',
      socketId: 'finger-joint',
    });

    const service = createService();
    const result = await service.detachPart('finger', { cascade: false });

    expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
    expect(cacheManager.invalidateCacheForRoot).not.toHaveBeenCalled();
    expect(queryCache.invalidateRoot).not.toHaveBeenCalled();
    expect(result).toEqual({
      detached: ['finger'],
      parentId: 'torso',
      socketId: 'finger-joint',
    });
  });

  it('throws if a joint component is missing during detachment', async () => {
    entityManager.getComponentData.mockReturnValue(null);
    const service = createService();

    await expect(service.detachPart('unknown')).rejects.toThrow(
      InvalidArgumentError
    );
  });

  it('returns cached results when findPartsByType cache hits', () => {
    queryCache.getCachedFindPartsByType.mockReturnValue(['cached-arm']);
    const service = createService();

    const result = service.findPartsByType('root', 'arm');

    expect(result).toEqual(['cached-arm']);
    expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();
    expect(queryCache.cacheFindPartsByType).not.toHaveBeenCalled();
  });

  it('computes and caches findPartsByType when cache misses', () => {
    AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['leg']);
    const service = createService();

    const result = service.findPartsByType('root', 'leg');

    expect(AnatomyGraphAlgorithms.findPartsByType).toHaveBeenCalledWith(
      'root',
      'leg',
      cacheManager
    );
    expect(queryCache.cacheFindPartsByType).toHaveBeenCalledWith(
      'root',
      'leg',
      ['leg']
    );
    expect(result).toEqual(['leg']);
  });

  it('exposes anatomy root and path helpers', () => {
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-42');
    AnatomyGraphAlgorithms.getPath.mockReturnValue(['from', 'mid', 'to']);
    const service = createService();

    expect(service.getAnatomyRoot('hand')).toBe('root-42');
    expect(AnatomyGraphAlgorithms.getAnatomyRoot).toHaveBeenCalledWith(
      'hand',
      cacheManager,
      entityManager
    );
    expect(service.getPath('hand', 'torso')).toEqual(['from', 'mid', 'to']);
    expect(AnatomyGraphAlgorithms.getPath).toHaveBeenCalledWith(
      'hand',
      'torso',
      cacheManager
    );
  });

  it('returns empty list and logs when getAllParts receives no component', () => {
    const service = createService();

    const result = service.getAllParts(null);

    expect(result).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      expectStringContaining('No bodyComponent provided')
    );
  });

  it('derives parts from blueprint root when actor cache is missing', () => {
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['root', 'arm', 'leg']);
    cacheManager.has.mockReturnValue(false);
    cacheManager.size.mockReturnValue(1);
    const service = createService();

    const parts = service.getAllParts(
      { body: { root: 'blueprint-root' } },
      'actor-1'
    );

    expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
      'blueprint-root',
      cacheManager,
      entityManager
    );
    expect(queryCache.cacheGetAllParts).toHaveBeenCalledWith(
      'blueprint-root',
      ['root', 'arm', 'leg']
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expectStringContaining("Using blueprint root 'blueprint-root' as cache root")
    );
    expect(parts).toEqual(['root', 'arm', 'leg']);
  });

  it('prefers actor cache root and caches the computed result', () => {
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['actor', 'tail']);
    cacheManager.has.mockImplementation((id) => id === 'actor-1');
    cacheManager.size.mockReturnValue(2);
    const service = createService();

    const parts = service.getAllParts({ root: 'direct-root' }, 'actor-1');

    expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
      'actor-1',
      cacheManager,
      entityManager
    );
    expect(queryCache.cacheGetAllParts).toHaveBeenCalledWith('actor-1', [
      'actor',
      'tail',
    ]);
    expect(logger.debug).toHaveBeenCalledWith(
      expectStringContaining("Using actor entity 'actor-1' as cache root")
    );
    expect(parts).toEqual(['actor', 'tail']);
  });

  it('returns cached results for getAllParts without recomputing', () => {
    queryCache.getCachedGetAllParts.mockReturnValue(['cached-a', 'cached-b']);
    cacheManager.has.mockReturnValue(true);
    const service = createService();

    const parts = service.getAllParts({ root: 'direct-root' }, 'actor-1');

    expect(parts).toEqual(['cached-a', 'cached-b']);
    expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
  });

  it('detects part presence via hasPartWithComponent', () => {
    const service = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['p1', 'p2', 'p3']);

    entityManager.getComponentData.mockImplementation((id) => {
      if (id === 'p1') return null;
      if (id === 'p2') return {};
      return { equipped: true };
    });

    expect(service.hasPartWithComponent({}, 'component')).toBe(true);
    expect(entityManager.getComponentData).toHaveBeenCalledTimes(3);
  });

  it('returns false from hasPartWithComponent when nothing matches', () => {
    const service = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['p1', 'p2']);
    entityManager.getComponentData.mockReturnValue(null);

    expect(service.hasPartWithComponent({}, 'component')).toBe(false);
  });

  it('finds nested component value matches', () => {
    const service = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['p1', 'p2']);

    entityManager.getComponentData.mockImplementation((id) =>
      id === 'p1' ? { stats: { power: 5 } } : { stats: { power: 7 } }
    );

    const result = service.hasPartWithComponentValue(
      {},
      'component',
      'stats.power',
      7
    );

    expect(result).toEqual({ found: true, partId: 'p2' });
  });

  it('returns not-found result when component value does not match', () => {
    const service = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['p1']);
    entityManager.getComponentData.mockReturnValue({ stats: { power: 1 } });

    const result = service.hasPartWithComponentValue(
      {},
      'component',
      'stats.power',
      99
    );

    expect(result).toEqual({ found: false });
  });

  it('validates entity identifiers when retrieving body graphs', async () => {
    const service = createService();

    await expect(service.getBodyGraph('')).rejects.toThrow(InvalidArgumentError);
  });

  it('requires an anatomy:body component for getBodyGraph', async () => {
    entityManager.getComponentData.mockResolvedValueOnce(null);
    const service = createService();

    await expect(service.getBodyGraph('entity-1')).rejects.toThrow(
      "Entity entity-1 has no anatomy:body component"
    );
  });

  it('returns helper accessors when getBodyGraph succeeds', async () => {
    cacheManager.hasCacheForRoot.mockReturnValueOnce(false);
    cacheManager.has.mockImplementation((id) => id === 'actor-1');
    cacheManager.get.mockImplementation((id) => {
      if (id === 'actor-1') return { children: ['arm'] };
      if (id === 'arm') return { children: ['hand'] };
      if (id === 'hand') return { parentId: 'arm' };
      return undefined;
    });

    entityManager.getComponentData.mockImplementation((id, componentId) => {
      if (componentId === 'anatomy:body') {
        return Promise.resolve({ body: { root: 'blueprint-root' } });
      }
      return null;
    });

    AnatomyGraphAlgorithms.getAllParts.mockReturnValue([
      'actor-1',
      'arm',
      'hand',
    ]);

    const service = createService();
    const graph = await service.getBodyGraph('actor-1');

    expect(cacheManager.buildCache).toHaveBeenCalledWith('actor-1', entityManager);
    const partIds = graph.getAllPartIds();
    expect(Array.isArray(partIds)).toBe(true);
    expect(partIds).toEqual(['actor-1', 'arm', 'hand']);
    expect(graph.getConnectedParts('arm')).toEqual(['hand']);
  });

  it('validates entity identifiers when retrieving anatomy data', async () => {
    const service = createService();

    await expect(service.getAnatomyData(123)).rejects.toThrow(InvalidArgumentError);
  });

  it('returns null when anatomy data is unavailable', async () => {
    entityManager.getComponentData.mockResolvedValueOnce(null);
    const service = createService();

    const result = await service.getAnatomyData('actor-1');

    expect(result).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      expectStringContaining("Entity 'actor-1' has no anatomy:body component")
    );
  });

  it('returns recipe metadata when anatomy data exists', async () => {
    entityManager.getComponentData.mockResolvedValueOnce({ recipeId: 'recipe-9' });
    const service = createService();

    const result = await service.getAnatomyData('actor-9');

    expect(result).toEqual({ recipeId: 'recipe-9', rootEntityId: 'actor-9' });
  });

  it('proxies validation helpers to the cache and algorithms', () => {
    cacheManager.validateCache.mockReturnValue('validated');
    cacheManager.hasCacheForRoot.mockReturnValue(true);
    cacheManager.get.mockImplementation((id) => {
      if (id === 'child') return { parentId: 'parent', children: ['grandchild'] };
      if (id === 'parent') return { parentId: 'root', children: [] };
      if (id === 'root') return { parentId: null, children: [] };
      return undefined;
    });
    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([
      'root',
      'child',
      'grandchild',
    ]);

    const service = createService();

    expect(service.validateCache()).toBe('validated');
    expect(service.hasCache('root')).toBe(true);
    expect(service.getChildren('child')).toEqual(['grandchild']);
    expect(service.getChildren('missing')).toEqual([]);
    expect(service.getParent('child')).toBe('parent');
    expect(service.getParent('missing')).toBeNull();
    expect(service.getAncestors('child')).toEqual(['parent', 'root']);
    expect(service.getAllDescendants('root')).toEqual(['child', 'grandchild']);
  });
});
