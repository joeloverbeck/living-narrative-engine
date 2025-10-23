import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  BodyGraphService,
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';

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

describe('BodyGraphService high reliability coverage', () => {
  /** @type {ReturnType<typeof createService>} */
  let service;
  let mockEntityManager;
  let mockLogger;
  let mockEventDispatcher;
  let mockCacheManager;
  let mockQueryCache;

  const createService = (overrides = {}) =>
    new BodyGraphService({
      entityManager: mockEntityManager,
      logger: mockLogger,
      eventDispatcher: mockEventDispatcher,
      ...overrides,
    });

  beforeEach(() => {
    jest.clearAllMocks();

    mockCacheManager = {
      hasCacheForRoot: jest.fn().mockReturnValue(false),
      buildCache: jest.fn().mockResolvedValue(undefined),
      invalidateCacheForRoot: jest.fn(),
      size: jest.fn().mockReturnValue(0),
      has: jest.fn().mockReturnValue(false),
      get: jest.fn(),
      validateCache: jest.fn().mockReturnValue(true),
    };
    AnatomyCacheManager.mockImplementation(() => mockCacheManager);

    mockQueryCache = {
      getCachedFindPartsByType: jest.fn(),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn(),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };
    AnatomyQueryCache.mockImplementation(() => mockQueryCache);

    mockEntityManager = {
      getComponentData: jest.fn(),
      removeComponent: jest.fn().mockResolvedValue(undefined),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
    };

    mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    service = createService();
  });

  it('validates constructor dependencies and initialises caches', () => {
    expect(() =>
      new BodyGraphService({ logger: mockLogger, eventDispatcher: mockEventDispatcher }),
    ).toThrow(InvalidArgumentError);
    expect(() =>
      new BodyGraphService({ entityManager: mockEntityManager, eventDispatcher: mockEventDispatcher }),
    ).toThrow(InvalidArgumentError);
    expect(() =>
      new BodyGraphService({ entityManager: mockEntityManager, logger: mockLogger }),
    ).toThrow(InvalidArgumentError);

    expect(AnatomyCacheManager).toHaveBeenCalledTimes(1);
    expect(AnatomyQueryCache).toHaveBeenCalledTimes(1);

    const externalQueryCache = { cacheFindPartsByType: jest.fn() };
    const customService = createService({ queryCache: externalQueryCache });
    expect(customService).toBeInstanceOf(BodyGraphService);
    expect(mockQueryCache.cacheFindPartsByType).not.toHaveBeenCalled();
  });

  it('builds adjacency caches conditionally', async () => {
    await service.buildAdjacencyCache('actor-1');
    expect(mockCacheManager.buildCache).toHaveBeenCalledWith('actor-1', mockEntityManager);

    mockCacheManager.buildCache.mockClear();
    mockCacheManager.hasCacheForRoot.mockReturnValue(true);
    await service.buildAdjacencyCache('actor-1');
    expect(mockCacheManager.buildCache).not.toHaveBeenCalled();
  });

  it('detaches parts with cascade support and cache invalidation', async () => {
    const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(42);
    mockEntityManager.getComponentData.mockReturnValue({ parentId: 'parent', socketId: 'socket' });
    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['limb', 'child']);
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-entity');

    const result = await service.detachPart('limb', { cascade: true, reason: 'damage' });

    expect(mockEntityManager.removeComponent).toHaveBeenCalledWith('limb', 'anatomy:joint');
    expect(mockCacheManager.invalidateCacheForRoot).toHaveBeenCalledWith('root-entity');
    expect(mockQueryCache.invalidateRoot).toHaveBeenCalledWith('root-entity');
    expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'limb',
        parentEntityId: 'parent',
        socketId: 'socket',
        detachedCount: 2,
        reason: 'damage',
        timestamp: 42,
      }),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      "BodyGraphService: Detached 2 entities from parent 'parent'",
    );
    expect(result).toEqual({ detached: ['limb', 'child'], parentId: 'parent', socketId: 'socket' });

    dateSpy.mockRestore();
  });

  it('throws when detaching without a joint component and respects cascade option', async () => {
    mockEntityManager.getComponentData.mockReturnValue(null);
    await expect(service.detachPart('missing')).rejects.toThrow(InvalidArgumentError);

    mockEntityManager.getComponentData.mockReturnValue({ parentId: 'parent', socketId: 'socket' });
    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['limb', 'child']);
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue(null);

    const result = await service.detachPart('limb', { cascade: false });
    expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
    expect(result).toEqual({ detached: ['limb'], parentId: 'parent', socketId: 'socket' });
  });

  it('performs cached and uncached part lookups', () => {
    mockQueryCache.getCachedFindPartsByType.mockReturnValue(['cached-part']);
    expect(service.findPartsByType('root', 'type')).toEqual(['cached-part']);
    expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();

    mockQueryCache.getCachedFindPartsByType.mockReturnValue(undefined);
    AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['fresh-part']);
    expect(service.findPartsByType('root', 'type')).toEqual(['fresh-part']);
    expect(mockQueryCache.cacheFindPartsByType).toHaveBeenCalledWith('root', 'type', ['fresh-part']);
  });

  it('collects all parts across blueprint and actor caches', () => {
    expect(service.getAllParts(null)).toEqual([]);

    const bodyComponent = { body: { root: 'blueprint-root' } };
    mockQueryCache.getCachedGetAllParts.mockReturnValueOnce(['cached']);
    expect(service.getAllParts(bodyComponent, 'actor-entity')).toEqual(['cached']);
    expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();

    mockQueryCache.getCachedGetAllParts.mockReturnValueOnce(undefined);
    mockCacheManager.has.mockReturnValueOnce(true);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValueOnce(['actor-part-a', 'actor-part-b']);
    expect(service.getAllParts(bodyComponent, 'actor-entity')).toEqual([
      'actor-part-a',
      'actor-part-b',
    ]);
    expect(mockQueryCache.cacheGetAllParts).toHaveBeenNthCalledWith(1, 'actor-entity', [
      'actor-part-a',
      'actor-part-b',
    ]);

    mockQueryCache.getCachedGetAllParts.mockReturnValueOnce(undefined);
    mockCacheManager.has.mockReturnValue(false);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['blueprint-part']);
    const directComponent = { root: 'blueprint-root' };
    expect(service.getAllParts(directComponent)).toEqual(['blueprint-part']);
    expect(mockQueryCache.cacheGetAllParts).toHaveBeenLastCalledWith('blueprint-root', [
      'blueprint-part',
    ]);
  });

  it('detects component presence across parts', () => {
    service.getAllParts = jest.fn().mockReturnValue(['part-1', 'part-2']);
    mockEntityManager.getComponentData
      .mockReturnValueOnce({ data: true })
      .mockReturnValueOnce(null);
    expect(service.hasPartWithComponent({}, 'component')).toBe(true);

    service.getAllParts = jest.fn().mockReturnValue(['part-1']);
    mockEntityManager.getComponentData.mockReturnValue(undefined);
    expect(service.hasPartWithComponent({}, 'component')).toBe(false);
  });

  it('evaluates nested component values when searching for matches', () => {
    service.getAllParts = jest.fn().mockReturnValue(['part-1']);
    mockEntityManager.getComponentData.mockReturnValue({ nested: { flag: 'yes' } });
    expect(
      service.hasPartWithComponentValue({}, 'component', 'nested.flag', 'yes'),
    ).toEqual({ found: true, partId: 'part-1' });

    mockEntityManager.getComponentData.mockReturnValue({ nested: { flag: 'no' } });
    expect(
      service.hasPartWithComponentValue({}, 'component', 'nested.flag', 'yes'),
    ).toEqual({ found: false });
  });

  it('produces body graph helpers and validates anatomy data access', async () => {
    await expect(service.getBodyGraph(0)).rejects.toThrow(InvalidArgumentError);

    mockEntityManager.getComponentData.mockResolvedValueOnce(null);
    await expect(service.getBodyGraph('missing-entity')).rejects.toThrow('anatomy:body');

    const bodyComponent = { body: { root: 'root' }, recipeId: 'recipe' };
    mockEntityManager.getComponentData
      .mockResolvedValueOnce(bodyComponent)
      .mockResolvedValueOnce(bodyComponent);
    const buildSpy = jest
      .spyOn(service, 'buildAdjacencyCache')
      .mockResolvedValue(undefined);
    service.getAllParts = jest.fn().mockReturnValue(['part-a', 'part-b']);
    mockCacheManager.get.mockReturnValue({ children: ['child-a'] });

    const graph = await service.getBodyGraph('entity-1');
    expect(buildSpy).toHaveBeenCalledWith('entity-1');
    expect(graph.getAllPartIds()).toEqual(['part-a', 'part-b']);
    expect(graph.getConnectedParts('entity-1')).toEqual(['child-a']);

    expect(await service.getAnatomyData('entity-1')).toEqual({
      recipeId: 'recipe',
      rootEntityId: 'entity-1',
    });

    mockEntityManager.getComponentData.mockResolvedValueOnce(null);
    expect(await service.getAnatomyData('entity-2')).toBeNull();

    await expect(service.getAnatomyData(7)).rejects.toThrow(InvalidArgumentError);
  });

  it('delegates simple cache queries and graph traversal helpers', () => {
    expect(service.validateCache()).toBe(true);
    mockCacheManager.hasCacheForRoot.mockReturnValue(true);
    expect(service.hasCache('root')).toBe(true);

    mockCacheManager.get.mockImplementation((id) => ({
      children: [`${id}-child`],
      parentId: id === 'root' ? null : 'root',
    }));

    expect(service.getChildren('node')).toEqual(['node-child']);
    expect(service.getParent('node')).toBe('root');

    const ancestorMap = new Map([
      ['node', { parentId: 'parent' }],
      ['parent', { parentId: 'grandparent' }],
      ['grandparent', { parentId: null }],
    ]);
    mockCacheManager.get.mockImplementation((id) => ancestorMap.get(id) || null);
    expect(service.getAncestors('node')).toEqual(['parent', 'grandparent']);

    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['node', 'child-1', 'child-2']);
    expect(service.getAllDescendants('node')).toEqual(['child-1', 'child-2']);
    expect(AnatomyGraphAlgorithms.getPath).not.toHaveBeenCalled();
  });
});
