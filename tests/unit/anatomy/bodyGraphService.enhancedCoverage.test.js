import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  BodyGraphService,
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => ({
  AnatomyCacheManager: jest.fn(),
}));

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => ({
  AnatomyQueryCache: jest.fn(),
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

jest.mock('../../../src/anatomy/constants/anatomyConstants.js', () => ({
  ANATOMY_CONSTANTS: {
    LIMB_DETACHED_EVENT_ID: 'anatomy/limbDetached',
  },
}));

describe('BodyGraphService enhanced coverage', () => {
  let mockCacheManager;
  let mockQueryCache;
  let mockEntityManager;
  let mockLogger;
  let mockEventDispatcher;
  let createService;
  let cacheConstructorArgs;
  let queryCacheConstructorArgs;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCacheManager = {
      hasCacheForRoot: jest.fn().mockReturnValue(false),
      buildCache: jest.fn().mockResolvedValue(undefined),
      invalidateCacheForRoot: jest.fn(),
      get: jest.fn(),
      has: jest.fn().mockReturnValue(false),
      size: jest.fn().mockReturnValue(0),
      validateCache: jest.fn().mockReturnValue('cache-valid'),
    };

    mockQueryCache = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };

    AnatomyCacheManager.mockImplementation((args) => {
      cacheConstructorArgs = args;
      return mockCacheManager;
    });

    AnatomyQueryCache.mockImplementation((args) => {
      queryCacheConstructorArgs = args;
      return mockQueryCache;
    });

    AnatomyGraphAlgorithms.getSubgraph.mockReset();
    AnatomyGraphAlgorithms.findPartsByType.mockReset();
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReset();
    AnatomyGraphAlgorithms.getPath.mockReset();
    AnatomyGraphAlgorithms.getAllParts.mockReset();

    mockEntityManager = {
      getComponentData: jest.fn(),
      removeComponent: jest.fn().mockResolvedValue(undefined),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    createService = (overrides = {}) =>
      new BodyGraphService({
        entityManager: mockEntityManager,
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
        ...overrides,
      });
  });

  it('constructs cache and default query cache with logger', () => {
    createService();

    expect(AnatomyCacheManager).toHaveBeenCalledWith({ logger: mockLogger });
    expect(AnatomyQueryCache).toHaveBeenCalledWith({ logger: mockLogger });
    expect(cacheConstructorArgs).toEqual({ logger: mockLogger });
    expect(queryCacheConstructorArgs).toEqual({ logger: mockLogger });
  });

  it('throws when required dependencies are missing', () => {
    expect(
      () =>
        new BodyGraphService({
          logger: mockLogger,
          eventDispatcher: mockEventDispatcher,
        })
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new BodyGraphService({
          entityManager: mockEntityManager,
          eventDispatcher: mockEventDispatcher,
        })
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new BodyGraphService({
          entityManager: mockEntityManager,
          logger: mockLogger,
        })
    ).toThrow(InvalidArgumentError);
  });

  it('supports injecting a custom query cache implementation', () => {
    const customQueryCache = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(['cached-part']),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn(),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };

    const service = createService({ queryCache: customQueryCache });

    expect(AnatomyQueryCache).not.toHaveBeenCalled();
    const result = service.findPartsByType('root-1', 'limb');
    expect(result).toEqual(['cached-part']);
    expect(customQueryCache.getCachedFindPartsByType).toHaveBeenCalledWith(
      'root-1',
      'limb'
    );
  });

  it('builds adjacency cache when missing and skips when present', async () => {
    const service = createService();

    await service.buildAdjacencyCache('actor-1');
    expect(mockCacheManager.buildCache).toHaveBeenCalledWith(
      'actor-1',
      mockEntityManager
    );

    mockCacheManager.buildCache.mockClear();
    mockCacheManager.hasCacheForRoot.mockReturnValueOnce(true);

    await service.buildAdjacencyCache('actor-2');
    expect(mockCacheManager.buildCache).not.toHaveBeenCalled();
  });

  it('throws when detaching a part without a joint component', async () => {
    const service = createService();
    mockEntityManager.getComponentData.mockReturnValueOnce(null);

    await expect(service.detachPart('part-1')).rejects.toThrow(InvalidArgumentError);
    expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
  });

  it('detaches a part with cascade and invalidates caches', async () => {
    const service = createService();
    mockEntityManager.getComponentData.mockReturnValueOnce({
      parentId: 'parent-1',
      socketId: 'socket-7',
    });
    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['part-1', 'child-1']);
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-99');
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(42);

    const result = await service.detachPart('part-1', { reason: 'manual' });

    expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
      'part-1',
      'anatomy:joint'
    );
    expect(mockCacheManager.invalidateCacheForRoot).toHaveBeenCalledWith('root-99');
    expect(mockQueryCache.invalidateRoot).toHaveBeenCalledWith('root-99');
    expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'part-1',
        parentEntityId: 'parent-1',
        socketId: 'socket-7',
        detachedCount: 2,
        reason: 'manual',
        timestamp: 42,
      })
    );
    expect(result).toEqual({
      detached: ['part-1', 'child-1'],
      parentId: 'parent-1',
      socketId: 'socket-7',
    });

    nowSpy.mockRestore();
  });

  it('detaches without cascade and skips cache invalidation when no root', async () => {
    const service = createService();
    mockEntityManager.getComponentData.mockReturnValueOnce({
      parentId: 'parent-x',
      socketId: 'socket-x',
    });
    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['should-not-be-used']);
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue(null);

    const result = await service.detachPart('part-x', {
      cascade: false,
      reason: 'auto',
    });

    expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
    expect(mockCacheManager.invalidateCacheForRoot).not.toHaveBeenCalled();
    expect(mockQueryCache.invalidateRoot).not.toHaveBeenCalled();
    expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'part-x',
        detachedCount: 1,
        reason: 'auto',
      })
    );
    expect(result).toEqual({
      detached: ['part-x'],
      parentId: 'parent-x',
      socketId: 'socket-x',
    });
  });

  it('uses cached findPartsByType results when available', () => {
    const service = createService();
    mockQueryCache.getCachedFindPartsByType.mockReturnValueOnce(['cached']);

    const result = service.findPartsByType('root', 'arm');

    expect(result).toEqual(['cached']);
    expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();
  });

  it('computes findPartsByType results and caches them when missing', () => {
    const service = createService();
    mockQueryCache.getCachedFindPartsByType.mockReturnValueOnce(undefined);
    AnatomyGraphAlgorithms.findPartsByType.mockReturnValueOnce(['computed']);

    const result = service.findPartsByType('root-2', 'leg');

    expect(AnatomyGraphAlgorithms.findPartsByType).toHaveBeenCalledWith(
      'root-2',
      'leg',
      mockCacheManager
    );
    expect(mockQueryCache.cacheFindPartsByType).toHaveBeenCalledWith(
      'root-2',
      'leg',
      ['computed']
    );
    expect(result).toEqual(['computed']);
  });

  it('delegates to AnatomyGraphAlgorithms for root and path helpers', () => {
    const service = createService();
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValueOnce('root-id');
    AnatomyGraphAlgorithms.getPath.mockReturnValueOnce(['a', 'b']);

    expect(service.getAnatomyRoot('part-z')).toBe('root-id');
    expect(AnatomyGraphAlgorithms.getAnatomyRoot).toHaveBeenCalledWith(
      'part-z',
      mockCacheManager,
      mockEntityManager
    );

    expect(service.getPath('from', 'to')).toEqual(['a', 'b']);
    expect(AnatomyGraphAlgorithms.getPath).toHaveBeenCalledWith(
      'from',
      'to',
      mockCacheManager
    );
  });

  it('returns empty list of parts when body component missing or lacks root', () => {
    const service = createService();

    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({})).toEqual([]);
    expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
  });

  it('resolves parts using blueprint root when actor cache is absent', () => {
    const service = createService();
    mockCacheManager.has.mockReturnValueOnce(false);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValueOnce([
      'root',
      'child-1',
      'child-2',
      'child-3',
      'child-4',
      'child-5',
    ]);

    const result = service.getAllParts(
      { body: { root: 'blueprint-root' } },
      'actor-5'
    );

    expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
      'blueprint-root',
      mockCacheManager,
      mockEntityManager
    );
    expect(mockQueryCache.cacheGetAllParts).toHaveBeenCalledWith(
      'blueprint-root',
      ['root', 'child-1', 'child-2', 'child-3', 'child-4', 'child-5']
    );
    expect(result).toEqual([
      'root',
      'child-1',
      'child-2',
      'child-3',
      'child-4',
      'child-5',
    ]);
  });

  it('uses actor cache when available and respects query cache hits', () => {
    const service = createService();
    mockCacheManager.has.mockReturnValueOnce(true);
    mockQueryCache.getCachedGetAllParts.mockReturnValueOnce(['cached']);

    const result = service.getAllParts(
      { body: { root: 'blueprint-root' } },
      'actor-10'
    );

    expect(mockQueryCache.getCachedGetAllParts).toHaveBeenCalledWith('actor-10');
    expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
    expect(result).toEqual(['cached']);
  });

  it('supports body components that declare root directly', () => {
    const service = createService();
    mockCacheManager.has.mockReturnValueOnce(false);
    mockQueryCache.getCachedGetAllParts.mockReturnValueOnce(undefined);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValueOnce(['root-only']);

    const result = service.getAllParts({ root: 'direct-root' });

    expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
      'direct-root',
      mockCacheManager,
      mockEntityManager
    );
    expect(result).toEqual(['root-only']);
  });

  it('detects parts that contain a component', () => {
    const service = createService();
    jest
      .spyOn(service, 'getAllParts')
      .mockReturnValue(['part-a', 'part-b', 'part-c', 'part-d']);
    mockEntityManager.getComponentData
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({})
      .mockReturnValueOnce({ details: { active: true } });

    expect(service.hasPartWithComponent({}, 'component:id')).toBe(true);
    expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(4);
  });

  it('returns false when no part has the requested component', () => {
    const service = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-a']);
    mockEntityManager.getComponentData.mockReturnValueOnce({});

    expect(service.hasPartWithComponent({}, 'component:id')).toBe(false);
  });

  it('finds a part with a matching component value via path lookup', () => {
    const service = createService();
    jest
      .spyOn(service, 'getAllParts')
      .mockReturnValue(['part-a', 'part-b']);
    mockEntityManager.getComponentData
      .mockReturnValueOnce({ status: { condition: 'healthy' } })
      .mockReturnValueOnce({ status: { condition: 'injured' } });

    const result = service.hasPartWithComponentValue(
      {},
      'component:id',
      'status.condition',
      'healthy'
    );

    expect(result).toEqual({ found: true, partId: 'part-a' });
  });

  it('returns not found when component value is absent', () => {
    const service = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-a', 'part-b']);
    mockEntityManager.getComponentData
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ stats: {} });

    const result = service.hasPartWithComponentValue(
      {},
      'component:id',
      'stats.hp',
      100
    );

    expect(result).toEqual({ found: false });
  });

  it('validates body graph retrieval including cache build and helper methods', async () => {
    const service = createService();
    mockEntityManager.getComponentData.mockResolvedValueOnce({
      body: { root: 'root-42' },
    });
    const getAllPartsSpy = jest
      .spyOn(service, 'getAllParts')
      .mockReturnValue(['part-1', 'part-2']);
    mockCacheManager.get.mockImplementation((id) =>
      id === 'part-1' ? { children: ['child-x'] } : undefined
    );

    const graph = await service.getBodyGraph('actor-42');

    expect(mockCacheManager.buildCache).toHaveBeenCalledWith(
      'actor-42',
      mockEntityManager
    );
    const partIds = graph.getAllPartIds();
    expect(partIds).toEqual(['part-1', 'part-2']);
    expect(getAllPartsSpy).toHaveBeenCalledWith(
      { body: { root: 'root-42' } },
      'actor-42'
    );
    expect(graph.getConnectedParts('part-1')).toEqual(['child-x']);
    expect(graph.getConnectedParts('unknown')).toEqual([]);
  });

  it('throws when requesting a body graph with invalid arguments or missing component', async () => {
    const service = createService();
    await expect(service.getBodyGraph('')).rejects.toThrow(InvalidArgumentError);

    mockEntityManager.getComponentData.mockResolvedValueOnce(null);
    await expect(service.getBodyGraph('actor-1')).rejects.toThrow(
      /has no anatomy:body component/
    );
  });

  it('retrieves anatomy metadata and handles missing component', async () => {
    const service = createService();

    await expect(service.getAnatomyData(null)).rejects.toThrow(InvalidArgumentError);

    mockEntityManager.getComponentData.mockResolvedValueOnce(null);
    expect(await service.getAnatomyData('actor-7')).toBeNull();

    mockEntityManager.getComponentData
      .mockResolvedValueOnce({ recipeId: 'recipe-1' })
      .mockResolvedValueOnce({});

    await expect(service.getAnatomyData('actor-7')).resolves.toEqual({
      recipeId: 'recipe-1',
      rootEntityId: 'actor-7',
    });

    await expect(service.getAnatomyData('actor-7')).resolves.toEqual({
      recipeId: null,
      rootEntityId: 'actor-7',
    });
  });

  it('exposes cache inspection helpers', () => {
    const service = createService();
    mockCacheManager.validateCache.mockReturnValueOnce('validated');
    mockCacheManager.hasCacheForRoot.mockReturnValueOnce(true);
    mockCacheManager.get.mockImplementation((id) => {
      if (id === 'node-a') return { children: ['child-1'] };
      if (id === 'node-b') return { parentId: 'parent-1' };
      return null;
    });

    expect(service.validateCache()).toBe('validated');
    expect(service.hasCache('root-a')).toBe(true);
    expect(service.getChildren('node-a')).toEqual(['child-1']);
    expect(service.getChildren('missing')).toEqual([]);
    expect(service.getParent('node-b')).toEqual('parent-1');
    expect(service.getParent('missing')).toBeNull();
  });

  it('collects ancestors and descendants using cached relationships', () => {
    const service = createService();
    jest
      .spyOn(service, 'getParent')
      .mockReturnValueOnce('parent-1')
      .mockReturnValueOnce('grandparent-1')
      .mockReturnValueOnce(null);
    AnatomyGraphAlgorithms.getSubgraph.mockReturnValueOnce([
      'node',
      'child-1',
      'child-2',
    ]);

    expect(service.getAncestors('node')).toEqual(['parent-1', 'grandparent-1']);
    expect(service.getAllDescendants('node')).toEqual(['child-1', 'child-2']);
    expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
      'node',
      mockCacheManager
    );
  });
});
