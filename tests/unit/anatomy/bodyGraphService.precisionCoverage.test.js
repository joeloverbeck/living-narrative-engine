/**
 * @file Targeted coverage tests for BodyGraphService ensuring cache and traversal helpers
 * execute across their edge branches.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

describe('BodyGraphService precision coverage', () => {
  let mockEntityManager;
  let mockLogger;
  let mockEventDispatcher;
  let mockQueryCache;
  let createService;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn(),
      removeComponent: jest.fn().mockResolvedValue(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(),
    };

    mockQueryCache = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };

    createService = () =>
      new BodyGraphService({
        entityManager: mockEntityManager,
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
        queryCache: mockQueryCache,
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requires all constructor dependencies', () => {
    expect(
      () =>
        new BodyGraphService({
          logger: mockLogger,
          eventDispatcher: mockEventDispatcher,
          queryCache: mockQueryCache,
        })
    ).toThrow('entityManager is required');

    expect(
      () =>
        new BodyGraphService({
          entityManager: mockEntityManager,
          eventDispatcher: mockEventDispatcher,
          queryCache: mockQueryCache,
        })
    ).toThrow('logger is required');

    expect(
      () =>
        new BodyGraphService({
          entityManager: mockEntityManager,
          logger: mockLogger,
          queryCache: mockQueryCache,
        })
    ).toThrow('eventDispatcher is required');
  });

  it('creates a default query cache when none is provided', () => {
    const cacheSpy = jest
      .spyOn(AnatomyGraphAlgorithms, 'findPartsByType')
      .mockReturnValue(['part-1']);
    const result = new BodyGraphService({
      entityManager: mockEntityManager,
      logger: mockLogger,
      eventDispatcher: mockEventDispatcher,
    }).findPartsByType('root-1', 'arm');

    expect(cacheSpy).toHaveBeenCalledWith(
      'root-1',
      'arm',
      expect.any(AnatomyCacheManager)
    );
    expect(result).toEqual(['part-1']);
  });

  it('builds adjacency cache when no cache exists for a root', async () => {
    const hasCacheSpy = jest
      .spyOn(AnatomyCacheManager.prototype, 'hasCacheForRoot')
      .mockReturnValue(false);
    const buildCacheSpy = jest
      .spyOn(AnatomyCacheManager.prototype, 'buildCache')
      .mockResolvedValue();

    const service = createService();
    await service.buildAdjacencyCache('actor-root');

    expect(hasCacheSpy).toHaveBeenCalledWith('actor-root');
    expect(buildCacheSpy).toHaveBeenCalledWith('actor-root', mockEntityManager);
  });

  it('returns cached parts when present for findPartsByType and bypasses graph work', () => {
    const service = createService();
    mockQueryCache.getCachedFindPartsByType.mockReturnValue(['arm-1', 'arm-2']);
    const graphSpy = jest.spyOn(AnatomyGraphAlgorithms, 'findPartsByType');

    const result = service.findPartsByType('actor-root', 'arm');

    expect(result).toEqual(['arm-1', 'arm-2']);
    expect(graphSpy).not.toHaveBeenCalled();
  });

  it('performs graph lookups when findPartsByType cache misses', () => {
    const service = createService();
    const graphSpy = jest
      .spyOn(AnatomyGraphAlgorithms, 'findPartsByType')
      .mockReturnValue(['leg-1']);

    const result = service.findPartsByType('actor-root', 'leg');

    expect(graphSpy).toHaveBeenCalledWith(
      'actor-root',
      'leg',
      expect.any(AnatomyCacheManager)
    );
    expect(mockQueryCache.cacheFindPartsByType).toHaveBeenCalledWith(
      'actor-root',
      'leg',
      ['leg-1']
    );
    expect(result).toEqual(['leg-1']);
  });

  it('falls back to blueprint root when actor is not cached and stores results', () => {
    const service = createService();
    jest.spyOn(AnatomyCacheManager.prototype, 'has').mockReturnValue(false);
    jest.spyOn(AnatomyCacheManager.prototype, 'size').mockReturnValue(0);
    const graphSpy = jest
      .spyOn(AnatomyGraphAlgorithms, 'getAllParts')
      .mockReturnValue(['root', 'limb']);

    const result = service.getAllParts({ body: { root: 'blueprint-root' } }, 'actor-1');

    expect(graphSpy).toHaveBeenCalledWith(
      'blueprint-root',
      expect.any(AnatomyCacheManager),
      mockEntityManager
    );
    expect(mockQueryCache.cacheGetAllParts).toHaveBeenCalledWith('blueprint-root', [
      'root',
      'limb',
    ]);
    expect(result).toEqual(['root', 'limb']);
  });

  it('uses direct root property and returns cached all parts', () => {
    const service = createService();
    mockQueryCache.getCachedGetAllParts.mockReturnValueOnce(['cached-1', 'cached-2']);
    const graphSpy = jest.spyOn(AnatomyGraphAlgorithms, 'getAllParts');

    const result = service.getAllParts({ root: 'direct-root' }, null);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      "BodyGraphService.getAllParts: Found root ID in bodyComponent.root: direct-root"
    );
    expect(result).toEqual(['cached-1', 'cached-2']);
    expect(graphSpy).not.toHaveBeenCalled();
  });

  it('uses the actor entity as cache root when available', () => {
    const service = createService();
    jest.spyOn(AnatomyCacheManager.prototype, 'has').mockImplementation((entityId) => entityId === 'actor-1');
    jest.spyOn(AnatomyCacheManager.prototype, 'size').mockReturnValue(2);
    const graphSpy = jest
      .spyOn(AnatomyGraphAlgorithms, 'getAllParts')
      .mockReturnValue(['actor-1', 'arm']);

    const result = service.getAllParts({ body: { root: 'blueprint-root' } }, 'actor-1');

    expect(graphSpy).toHaveBeenCalledWith(
      'actor-1',
      expect.any(AnatomyCacheManager),
      mockEntityManager
    );
    expect(mockQueryCache.getCachedGetAllParts).toHaveBeenCalledWith('actor-1');
    expect(mockQueryCache.cacheGetAllParts).toHaveBeenCalledWith('actor-1', [
      'actor-1',
      'arm',
    ]);
    expect(result).toEqual(['actor-1', 'arm']);
  });

  it('returns empty list when no body component is provided', () => {
    const service = createService();

    const result = service.getAllParts(undefined);

    expect(result).toEqual([]);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'BodyGraphService.getAllParts: No bodyComponent provided'
    );
  });

  it('returns empty list when component has no root information', () => {
    const service = createService();

    const result = service.getAllParts({});

    expect(result).toEqual([]);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'BodyGraphService.getAllParts: No root ID found in bodyComponent'
    );
  });

  it('detects parts with non-empty component data while skipping empty objects', () => {
    const service = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['arm-1', 'arm-2']);
    mockEntityManager.getComponentData.mockImplementation((entityId) =>
      entityId === 'arm-1' ? {} : { equipped: true }
    );

    expect(service.hasPartWithComponent({}, 'equipment:slot')).toBe(true);
  });

  it('returns false from hasPartWithComponent when only empty objects are found', () => {
    const service = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['arm-1']);
    mockEntityManager.getComponentData.mockReturnValue({});

    expect(service.hasPartWithComponent({}, 'equipment:slot')).toBe(false);
  });

  it('locates nested component values using dot notation', () => {
    const service = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['arm-1']);
    mockEntityManager.getComponentData.mockReturnValue({ stats: { grip: { strength: 5 } } });

    expect(
      service.hasPartWithComponentValue({}, 'stats:hand', 'stats.grip.strength', 5)
    ).toEqual({ found: true, partId: 'arm-1' });
  });

  it('returns not found when nested value is missing', () => {
    const service = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['arm-1']);
    mockEntityManager.getComponentData.mockReturnValue({ stats: {} });

    expect(
      service.hasPartWithComponentValue({}, 'stats:hand', 'stats.grip.strength', 5)
    ).toEqual({ found: false });
  });

  it('getBodyGraph validates entity id input', async () => {
    const service = createService();

    await expect(service.getBodyGraph('')).rejects.toBeInstanceOf(InvalidArgumentError);
    await expect(service.getBodyGraph(42)).rejects.toBeInstanceOf(InvalidArgumentError);
  });

  it('getBodyGraph throws when anatomy component is missing', async () => {
    const service = createService();
    mockEntityManager.getComponentData.mockResolvedValueOnce(null);

    await expect(service.getBodyGraph('actor-1')).rejects.toThrow(
      'Entity actor-1 has no anatomy:body component'
    );
  });

  it('getBodyGraph returns helpers wired to cache data', async () => {
    const service = createService();
    jest
      .spyOn(AnatomyCacheManager.prototype, 'hasCacheForRoot')
      .mockReturnValue(true);
    jest
      .spyOn(AnatomyCacheManager.prototype, 'get')
      .mockImplementation((entityId) =>
        entityId === 'hand-1' ? { children: ['finger-1'] } : { children: [] }
      );
    const getAllPartsSpy = jest
      .spyOn(service, 'getAllParts')
      .mockReturnValue(['torso-1', 'hand-1']);
    mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
      if (componentId === 'anatomy:body') {
        return Promise.resolve({ body: { root: 'torso-blueprint' } });
      }
      return null;
    });

    const graph = await service.getBodyGraph('actor-1');
    const partIds = graph.getAllPartIds();

    expect(getAllPartsSpy).toHaveBeenCalledWith({ body: { root: 'torso-blueprint' } }, 'actor-1');
    expect(partIds).toEqual(['torso-1', 'hand-1']);
    expect(graph.getConnectedParts('hand-1')).toEqual(['finger-1']);
    expect(graph.getConnectedParts('torso-1')).toEqual([]);
  });

  it('getAnatomyData validates inputs and returns null without anatomy', async () => {
    const service = createService();

    await expect(service.getAnatomyData('')).rejects.toBeInstanceOf(InvalidArgumentError);

    mockEntityManager.getComponentData.mockResolvedValueOnce(null);
    const result = await service.getAnatomyData('actor-1');

    expect(result).toBeNull();
  });

  it('getAnatomyData returns recipe information when available', async () => {
    const service = createService();
    mockEntityManager.getComponentData.mockResolvedValueOnce({ recipeId: 'recipe-9' });

    const result = await service.getAnatomyData('actor-1');

    expect(result).toEqual({ recipeId: 'recipe-9', rootEntityId: 'actor-1' });
  });

  it('validateCache delegates to the cache manager', () => {
    const service = createService();
    jest
      .spyOn(AnatomyCacheManager.prototype, 'validateCache')
      .mockReturnValue('validated');

    expect(service.validateCache()).toBe('validated');
  });

  it('hasCache proxies to cache manager', () => {
    const service = createService();
    jest
      .spyOn(AnatomyCacheManager.prototype, 'hasCacheForRoot')
      .mockReturnValue(true);

    expect(service.hasCache('actor-root')).toBe(true);
  });

  it('getChildren and getParent expose cached relationships', () => {
    const service = createService();
    jest.spyOn(AnatomyCacheManager.prototype, 'get').mockImplementation((entityId) =>
      entityId === 'arm-1' ? { children: ['hand-1'], parentId: 'torso-1' } : undefined
    );

    expect(service.getChildren('arm-1')).toEqual(['hand-1']);
    expect(service.getChildren('unknown')).toEqual([]);
    expect(service.getParent('arm-1')).toBe('torso-1');
    expect(service.getParent('unknown')).toBeNull();
  });

  it('getAncestors walks parent links until the root', () => {
    const service = createService();
    const nodes = {
      'finger-1': { parentId: 'hand-1' },
      'hand-1': { parentId: 'arm-1' },
      'arm-1': { parentId: 'torso-1' },
      'torso-1': { parentId: null },
    };
    jest
      .spyOn(AnatomyCacheManager.prototype, 'get')
      .mockImplementation((entityId) => nodes[entityId]);

    expect(service.getAncestors('finger-1')).toEqual([
      'hand-1',
      'arm-1',
      'torso-1',
    ]);
  });

  it('getAllDescendants omits the starting node', () => {
    const service = createService();
    jest
      .spyOn(AnatomyGraphAlgorithms, 'getSubgraph')
      .mockReturnValue(['torso-1', 'arm-1', 'hand-1']);

    expect(service.getAllDescendants('torso-1')).toEqual(['arm-1', 'hand-1']);
  });

  it('getAnatomyRoot and getPath proxy directly to algorithms', () => {
    const service = createService();
    jest
      .spyOn(AnatomyGraphAlgorithms, 'getAnatomyRoot')
      .mockReturnValue('actor-root');
    jest.spyOn(AnatomyGraphAlgorithms, 'getPath').mockReturnValue(['from', 'mid', 'to']);

    expect(service.getAnatomyRoot('hand-1')).toBe('actor-root');
    expect(service.getPath('hand-1', 'torso-1')).toEqual(['from', 'mid', 'to']);
  });

  it('detachPart throws when the entity lacks a joint component', async () => {
    const service = createService();
    mockEntityManager.getComponentData.mockReturnValue(undefined);

    await expect(service.detachPart('arm-1')).rejects.toThrow(
      "Entity 'arm-1' has no joint component - cannot detach"
    );
  });

  it('detachPart without cascade removes only the specified entity and skips subgraph lookup', async () => {
    const service = createService();
    mockEntityManager.getComponentData.mockReturnValue({ parentId: 'torso-1', socketId: 'shoulder' });
    const subgraphSpy = jest.spyOn(AnatomyGraphAlgorithms, 'getSubgraph');
    jest
      .spyOn(AnatomyGraphAlgorithms, 'getAnatomyRoot')
      .mockReturnValue(null);

    const result = await service.detachPart('arm-1', { cascade: false, reason: 'test' });

    expect(subgraphSpy).not.toHaveBeenCalled();
    expect(mockEntityManager.removeComponent).toHaveBeenCalledWith('arm-1', 'anatomy:joint');
    expect(mockQueryCache.invalidateRoot).not.toHaveBeenCalled();
    expect(result).toEqual({ detached: ['arm-1'], parentId: 'torso-1', socketId: 'shoulder' });
  });

  it('detaches with cascade and invalidates caches when root is located', async () => {
    const service = createService();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(123456);
    mockEntityManager.getComponentData.mockReturnValue({ parentId: 'torso-1', socketId: 'shoulder' });
    jest
      .spyOn(AnatomyGraphAlgorithms, 'getSubgraph')
      .mockReturnValue(['arm-1', 'hand-1']);
    const invalidateSpy = jest.spyOn(
      AnatomyCacheManager.prototype,
      'invalidateCacheForRoot'
    );
    jest
      .spyOn(AnatomyGraphAlgorithms, 'getAnatomyRoot')
      .mockReturnValue('actor-root');

    const result = await service.detachPart('arm-1', { cascade: true, reason: 'combat' });

    expect(invalidateSpy).toHaveBeenCalledWith('actor-root');
    expect(mockQueryCache.invalidateRoot).toHaveBeenCalledWith('actor-root');
    expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedCount: 2,
        timestamp: 123456,
        reason: 'combat',
      })
    );
    expect(result).toEqual({
      detached: ['arm-1', 'hand-1'],
      parentId: 'torso-1',
      socketId: 'shoulder',
    });

    nowSpy.mockRestore();
  });
});
