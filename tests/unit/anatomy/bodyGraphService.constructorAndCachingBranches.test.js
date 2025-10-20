import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

describe('BodyGraphService focused coverage suite', () => {
  let mockEntityManager;
  let mockLogger;
  let mockEventDispatcher;
  let mockQueryCache;

  const createService = () =>
    new BodyGraphService({
      entityManager: mockEntityManager,
      logger: mockLogger,
      eventDispatcher: mockEventDispatcher,
      queryCache: mockQueryCache,
    });

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn(),
      removeComponent: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventDispatcher = {
      dispatch: jest.fn(),
    };

    mockQueryCache = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor validation', () => {
    it('throws when entityManager is missing', () => {
      expect(
        () =>
          new BodyGraphService({
            logger: mockLogger,
            eventDispatcher: mockEventDispatcher,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('throws when logger is missing', () => {
      expect(
        () =>
          new BodyGraphService({
            entityManager: mockEntityManager,
            eventDispatcher: mockEventDispatcher,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('throws when eventDispatcher is missing', () => {
      expect(
        () =>
          new BodyGraphService({
            entityManager: mockEntityManager,
            logger: mockLogger,
          })
      ).toThrow(InvalidArgumentError);
    });
  });

  describe('cache lifecycle helpers', () => {
    it('builds the adjacency cache only when necessary', async () => {
      const hasCacheSpy = jest
        .spyOn(AnatomyCacheManager.prototype, 'hasCacheForRoot')
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);
      const buildCacheSpy = jest
        .spyOn(AnatomyCacheManager.prototype, 'buildCache')
        .mockResolvedValue();

      const service = createService();
      await service.buildAdjacencyCache('root-1');
      await service.buildAdjacencyCache('root-1');

      expect(hasCacheSpy).toHaveBeenCalledWith('root-1');
      expect(buildCacheSpy).toHaveBeenCalledTimes(1);
      expect(buildCacheSpy).toHaveBeenCalledWith('root-1', mockEntityManager);
    });

    it('validates and queries cache metadata', () => {
      jest
        .spyOn(AnatomyCacheManager.prototype, 'validateCache')
        .mockReturnValue({ ok: true });
      jest
        .spyOn(AnatomyCacheManager.prototype, 'hasCacheForRoot')
        .mockReturnValue(true);
      jest
        .spyOn(AnatomyCacheManager.prototype, 'get')
        .mockImplementation((entityId) =>
          entityId === 'parent'
            ? { children: ['child'] }
            : entityId === 'child'
              ? { parentId: 'parent' }
              : undefined
        );

      const service = createService();

      expect(service.validateCache()).toEqual({ ok: true });
      expect(service.hasCache('root-9')).toBe(true);
      expect(service.getChildren('parent')).toEqual(['child']);
      expect(service.getChildren('missing')).toEqual([]);
      expect(service.getParent('child')).toBe('parent');
      expect(service.getParent('missing')).toBeNull();
      expect(service.getAncestors('child')).toEqual(['parent']);
    });
  });

  describe('detachPart', () => {
    it('detaches with cascade and dispatches events', async () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(42);
      const subgraphSpy = jest
        .spyOn(AnatomyGraphAlgorithms, 'getSubgraph')
        .mockReturnValue(['arm', 'hand']);
      const rootSpy = jest
        .spyOn(AnatomyGraphAlgorithms, 'getAnatomyRoot')
        .mockReturnValue('actor-root');
      jest
        .spyOn(AnatomyCacheManager.prototype, 'invalidateCacheForRoot')
        .mockImplementation(() => {});

      mockEntityManager.getComponentData.mockReturnValue({
        parentId: 'torso',
        socketId: 'shoulder',
      });
      mockEntityManager.removeComponent.mockResolvedValue();

      const service = createService();
      const result = await service.detachPart('arm', { cascade: true, reason: 'combat' });

      expect(subgraphSpy).toHaveBeenCalledWith('arm', expect.any(AnatomyCacheManager));
      expect(rootSpy).toHaveBeenCalledWith(
        'torso',
        expect.any(AnatomyCacheManager),
        mockEntityManager
      );
      expect(mockQueryCache.invalidateRoot).toHaveBeenCalledWith('actor-root');
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedCount: 2,
          reason: 'combat',
          timestamp: 42,
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "BodyGraphService: Detached 2 entities from parent 'torso'"
      );
      expect(result).toEqual({ detached: ['arm', 'hand'], parentId: 'torso', socketId: 'shoulder' });

      nowSpy.mockRestore();
    });

    it('supports non-cascading detaches and missing joint errors', async () => {
      jest
        .spyOn(AnatomyGraphAlgorithms, 'getSubgraph')
        .mockReturnValue(['arm', 'hand']);
      jest
        .spyOn(AnatomyGraphAlgorithms, 'getAnatomyRoot')
        .mockReturnValue(null);

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ parentId: 'torso', socketId: 'shoulder' })
        .mockReturnValueOnce(null);
      mockEntityManager.removeComponent.mockResolvedValue();

      const service = createService();
      const result = await service.detachPart('arm', { cascade: false });

      expect(result).toEqual({ detached: ['arm'], parentId: 'torso', socketId: 'shoulder' });
      await expect(service.detachPart('missing')).rejects.toThrow(
        "Entity 'missing' has no joint component"
      );
    });
  });

  describe('findPartsByType', () => {
    it('uses cached results when available and caches misses', () => {
      mockQueryCache.getCachedFindPartsByType.mockReturnValueOnce(['cached']);
      const findSpy = jest
        .spyOn(AnatomyGraphAlgorithms, 'findPartsByType')
        .mockReturnValue(['fresh']);

      const service = createService();
      expect(service.findPartsByType('root', 'arm')).toEqual(['cached']);
      expect(findSpy).not.toHaveBeenCalled();

      mockQueryCache.getCachedFindPartsByType.mockReturnValue(undefined);
      expect(service.findPartsByType('root', 'leg')).toEqual(['fresh']);
      expect(findSpy).toHaveBeenCalledWith(
        'root',
        'leg',
        expect.any(AnatomyCacheManager)
      );
      expect(mockQueryCache.cacheFindPartsByType).toHaveBeenCalledWith('root', 'leg', ['fresh']);
    });
  });

  describe('getAllParts', () => {
    it('handles missing components, blueprint roots, actor overrides, and caching', () => {
      const parts = ['root', 'arm', 'hand', 'finger', 'thumb', 'palm', 'wrist'];
      const cacheHasSpy = jest
        .spyOn(AnatomyCacheManager.prototype, 'has')
        .mockImplementation((id) => id === 'actor-1');
      const cacheSizeSpy = jest
        .spyOn(AnatomyCacheManager.prototype, 'size')
        .mockReturnValue(3);
      const getAllPartsSpy = jest
        .spyOn(AnatomyGraphAlgorithms, 'getAllParts')
        .mockReturnValue(parts);

      const service = createService();

      expect(service.getAllParts(null)).toEqual([]);
      expect(service.getAllParts({ body: {} })).toEqual([]);

      mockQueryCache.getCachedGetAllParts.mockReturnValueOnce(['cached']);
      expect(service.getAllParts({ root: 'blueprint-root' })).toEqual(['cached']);
      expect(getAllPartsSpy).not.toHaveBeenCalled();

      mockQueryCache.getCachedGetAllParts.mockReturnValue(undefined);
      const result = service.getAllParts({ body: { root: 'blueprint-root' } }, 'actor-1');
      expect(result).toEqual(parts);
      expect(mockQueryCache.cacheGetAllParts).toHaveBeenCalledWith('actor-1', parts);
      expect(
        mockLogger.debug.mock.calls.some(([message]) =>
          message.includes('AnatomyGraphAlgorithms.getAllParts returned 7 parts') &&
          message.includes('...')
        )
      ).toBe(true);

      cacheHasSpy.mockRestore();
      cacheSizeSpy.mockRestore();
      getAllPartsSpy.mockRestore();
    });
  });

  describe('component lookup helpers', () => {
    it('detects components and nested values correctly', () => {
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1', 'part-2']);

      mockEntityManager.getComponentData.mockImplementation((entityId) =>
        entityId === 'part-2' ? { equipped: true } : null
      );

      expect(service.hasPartWithComponent({ body: { root: 'root-1' } }, 'inventory:item')).toBe(
        true
      );

      mockEntityManager.getComponentData.mockImplementation(() => ({}));
      expect(service.hasPartWithComponent({ body: { root: 'root-1' } }, 'inventory:item')).toBe(
        false
      );

      mockEntityManager.getComponentData.mockImplementation((entityId) =>
        entityId === 'part-1' ? { stats: { health: { current: 5 } } } : null
      );

      const match = service.hasPartWithComponentValue(
        { body: { root: 'root-1' } },
        'stats:health',
        'stats.health.current',
        5
      );
      expect(match).toEqual({ found: true, partId: 'part-1' });

      mockEntityManager.getComponentData.mockReturnValue(null);
      const missing = service.hasPartWithComponentValue(
        { body: { root: 'root-1' } },
        'stats:health',
        'stats.health.current',
        10
      );
      expect(missing).toEqual({ found: false });
    });
  });

  describe('graph proxies', () => {
    it('delegates getAnatomyRoot, getPath, and getAllDescendants', () => {
      const rootSpy = jest
        .spyOn(AnatomyGraphAlgorithms, 'getAnatomyRoot')
        .mockReturnValue('root-1');
      const pathSpy = jest
        .spyOn(AnatomyGraphAlgorithms, 'getPath')
        .mockReturnValue(['root-1', 'arm']);
      const subgraphSpy = jest
        .spyOn(AnatomyGraphAlgorithms, 'getSubgraph')
        .mockReturnValue(['root-1', 'arm', 'hand']);

      const service = createService();
      expect(service.getAnatomyRoot('arm')).toBe('root-1');
      expect(rootSpy).toHaveBeenCalledWith(
        'arm',
        expect.any(AnatomyCacheManager),
        mockEntityManager
      );

      expect(service.getPath('root-1', 'arm')).toEqual(['root-1', 'arm']);
      expect(pathSpy).toHaveBeenCalledWith('root-1', 'arm', expect.any(AnatomyCacheManager));

      expect(service.getAllDescendants('root-1')).toEqual(['arm', 'hand']);
      expect(subgraphSpy).toHaveBeenCalledWith('root-1', expect.any(AnatomyCacheManager));
    });
  });

  describe('getBodyGraph', () => {
    it('validates inputs and exposes cached helpers', async () => {
      const hasCacheSpy = jest
        .spyOn(AnatomyCacheManager.prototype, 'hasCacheForRoot')
        .mockReturnValue(true);
      const getSpy = jest
        .spyOn(AnatomyCacheManager.prototype, 'get')
        .mockImplementation((entityId) =>
          entityId === 'part-1' ? { children: ['child'] } : undefined
        );

      mockEntityManager.getComponentData
        .mockResolvedValueOnce({ body: { root: 'root-1' } })
        .mockResolvedValueOnce(null);

      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1', 'child']);

      await expect(service.getBodyGraph('')).rejects.toThrow(InvalidArgumentError);
      const graph = await service.getBodyGraph('actor-1');
      expect(graph.getAllPartIds()).toEqual(['part-1', 'child']);
      expect(graph.getConnectedParts('part-1')).toEqual(['child']);
      expect(graph.getConnectedParts('unknown')).toEqual([]);
      await expect(service.getBodyGraph('actor-2')).rejects.toThrow(
        'has no anatomy:body component'
      );

      hasCacheSpy.mockRestore();
      getSpy.mockRestore();
    });
  });

  describe('getAnatomyData', () => {
    it('validates entity ids and returns recipe information', async () => {
      mockEntityManager.getComponentData
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ recipeId: 'recipe-1' });

      const service = createService();

      await expect(service.getAnatomyData(null)).rejects.toThrow(InvalidArgumentError);
      expect(await service.getAnatomyData('actor-1')).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "BodyGraphService.getAnatomyData: Entity 'actor-1' has no anatomy:body component"
      );

      const noRecipe = await service.getAnatomyData('actor-2');
      expect(noRecipe).toEqual({ recipeId: null, rootEntityId: 'actor-2' });

      const data = await service.getAnatomyData('actor-3');
      expect(data).toEqual({ recipeId: 'recipe-1', rootEntityId: 'actor-3' });
    });
  });
});
