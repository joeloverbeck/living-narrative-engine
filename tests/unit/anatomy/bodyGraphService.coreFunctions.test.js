/**
 * @file Comprehensive unit tests for BodyGraphService core behaviors
 * @see src/anatomy/bodyGraphService.js
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

describe('BodyGraphService core behaviors', () => {
  let service;
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
            queryCache: mockQueryCache,
          })
      ).toThrow('entityManager is required');
    });

    it('throws when logger is missing', () => {
      expect(
        () =>
          new BodyGraphService({
            entityManager: mockEntityManager,
            eventDispatcher: mockEventDispatcher,
            queryCache: mockQueryCache,
          })
      ).toThrow('logger is required');
    });

    it('throws when eventDispatcher is missing', () => {
      expect(
        () =>
          new BodyGraphService({
            entityManager: mockEntityManager,
            logger: mockLogger,
            queryCache: mockQueryCache,
          })
      ).toThrow('eventDispatcher is required');
    });

    it('creates a default query cache when not provided', () => {
      const cacheSpy = jest.spyOn(
        AnatomyQueryCache.prototype,
        'cacheFindPartsByType'
      );
      const findSpy = jest
        .spyOn(AnatomyGraphAlgorithms, 'findPartsByType')
        .mockReturnValue(['limb-1']);

      const serviceWithoutCache = new BodyGraphService({
        entityManager: mockEntityManager,
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
      });

      const result = serviceWithoutCache.findPartsByType('actor-root', 'arm');

      expect(findSpy).toHaveBeenCalled();
      expect(cacheSpy).toHaveBeenCalledWith('actor-root', 'arm', ['limb-1']);
      expect(result).toEqual(['limb-1']);
    });
  });

  describe('buildAdjacencyCache', () => {
    it('builds cache when no cache exists for the root', async () => {
      const hasCacheSpy = jest
        .spyOn(AnatomyCacheManager.prototype, 'hasCacheForRoot')
        .mockReturnValue(false);
      const buildCacheSpy = jest
        .spyOn(AnatomyCacheManager.prototype, 'buildCache')
        .mockResolvedValue();

      service = createService();
      await service.buildAdjacencyCache('root-123');

      expect(hasCacheSpy).toHaveBeenCalledWith('root-123');
      expect(buildCacheSpy).toHaveBeenCalledWith('root-123', mockEntityManager);
    });

    it('skips rebuilding when cache already exists', async () => {
      const hasCacheSpy = jest
        .spyOn(AnatomyCacheManager.prototype, 'hasCacheForRoot')
        .mockReturnValue(true);
      const buildCacheSpy = jest
        .spyOn(AnatomyCacheManager.prototype, 'buildCache')
        .mockResolvedValue();

      service = createService();
      await service.buildAdjacencyCache('root-789');

      expect(hasCacheSpy).toHaveBeenCalledWith('root-789');
      expect(buildCacheSpy).not.toHaveBeenCalled();
    });
  });

  describe('detachPart', () => {
    it('detaches a part with cascade, invalidates caches, and dispatches events', async () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000);
      const subgraphSpy = jest
        .spyOn(AnatomyGraphAlgorithms, 'getSubgraph')
        .mockReturnValue(['arm-1', 'hand-1']);
      const rootSpy = jest
        .spyOn(AnatomyGraphAlgorithms, 'getAnatomyRoot')
        .mockReturnValue('actor-root');
      const invalidateCacheSpy = jest
        .spyOn(AnatomyCacheManager.prototype, 'invalidateCacheForRoot')
        .mockImplementation(() => {});

      mockEntityManager.getComponentData.mockReturnValue({
        parentId: 'torso-1',
        socketId: 'shoulder',
      });
      mockEntityManager.removeComponent.mockResolvedValue();

      service = createService();
      const result = await service.detachPart('arm-1', {
        cascade: true,
        reason: 'combat',
      });

      expect(subgraphSpy).toHaveBeenCalled();
      expect(subgraphSpy.mock.calls[0][1]).toBeInstanceOf(AnatomyCacheManager);
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'arm-1',
        'anatomy:joint'
      );
      expect(rootSpy).toHaveBeenCalledWith(
        'torso-1',
        expect.any(AnatomyCacheManager),
        mockEntityManager
      );
      expect(invalidateCacheSpy).toHaveBeenCalledWith('actor-root');
      expect(mockQueryCache.invalidateRoot).toHaveBeenCalledWith('actor-root');
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedEntityId: 'arm-1',
          parentEntityId: 'torso-1',
          socketId: 'shoulder',
          detachedCount: 2,
          reason: 'combat',
          timestamp: 1700000000,
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "BodyGraphService: Detached 2 entities from parent 'torso-1'"
      );
      expect(result).toEqual({
        detached: ['arm-1', 'hand-1'],
        parentId: 'torso-1',
        socketId: 'shoulder',
      });

      nowSpy.mockRestore();
    });

    it('detaches only the specified part when cascade is disabled', async () => {
      const subgraphSpy = jest
        .spyOn(AnatomyGraphAlgorithms, 'getSubgraph')
        .mockReturnValue(['arm-1', 'hand-1']);
      jest
        .spyOn(AnatomyGraphAlgorithms, 'getAnatomyRoot')
        .mockReturnValue(null);
      const invalidateCacheSpy = jest
        .spyOn(AnatomyCacheManager.prototype, 'invalidateCacheForRoot')
        .mockImplementation(() => {});

      mockEntityManager.getComponentData.mockReturnValue({
        parentId: 'torso-2',
        socketId: 'socket-7',
      });
      mockEntityManager.removeComponent.mockResolvedValue();

      service = createService();
      const result = await service.detachPart('arm-1', { cascade: false });

      expect(subgraphSpy).not.toHaveBeenCalled();
      expect(invalidateCacheSpy).not.toHaveBeenCalled();
      expect(mockQueryCache.invalidateRoot).not.toHaveBeenCalled();
      expect(result).toEqual({
        detached: ['arm-1'],
        parentId: 'torso-2',
        socketId: 'socket-7',
      });
    });

    it('throws when no joint component is present on the part', async () => {
      mockEntityManager.getComponentData.mockReturnValue(null);
      service = createService();

      await expect(service.detachPart('arm-1')).rejects.toThrow(InvalidArgumentError);
    });
  });

  describe('findPartsByType', () => {
    it('returns cached results when present in query cache', () => {
      mockQueryCache.getCachedFindPartsByType.mockReturnValue(['arm-1']);
      const findSpy = jest.spyOn(AnatomyGraphAlgorithms, 'findPartsByType');

      service = createService();
      const result = service.findPartsByType('root-1', 'arm');

      expect(result).toEqual(['arm-1']);
      expect(findSpy).not.toHaveBeenCalled();
    });

    it('executes lookup and caches results when cache miss occurs', () => {
      const findSpy = jest
        .spyOn(AnatomyGraphAlgorithms, 'findPartsByType')
        .mockReturnValue(['leg-1', 'leg-2']);

      service = createService();
      const result = service.findPartsByType('root-2', 'leg');

      expect(findSpy).toHaveBeenCalledWith(
        'root-2',
        'leg',
        expect.any(AnatomyCacheManager)
      );
      expect(mockQueryCache.cacheFindPartsByType).toHaveBeenCalledWith(
        'root-2',
        'leg',
        ['leg-1', 'leg-2']
      );
      expect(result).toEqual(['leg-1', 'leg-2']);
    });
  });

  describe('getAllParts', () => {
    it('returns an empty array and logs when no body component is provided', () => {
      service = createService();
      const result = service.getAllParts(null);

      expect(result).toEqual([]);
      expect(
        mockLogger.debug.mock.calls.some(([message]) =>
          message.includes('No bodyComponent provided')
        )
      ).toBe(true);
    });

    it('uses bodyComponent.body.root when present and caches the result', () => {
      jest
        .spyOn(AnatomyGraphAlgorithms, 'getAllParts')
        .mockReturnValue(['root-3', 'child-1']);
      jest.spyOn(AnatomyCacheManager.prototype, 'size').mockReturnValue(5);
      jest.spyOn(AnatomyCacheManager.prototype, 'has').mockReturnValue(false);

      service = createService();
      const result = service.getAllParts({ body: { root: 'root-3' } });

      expect(result).toEqual(['root-3', 'child-1']);
      expect(mockQueryCache.cacheGetAllParts).toHaveBeenCalledWith(
        'root-3',
        ['root-3', 'child-1']
      );
      expect(
        mockLogger.debug.mock.calls.some(([message]) =>
          message.includes('bodyComponent.body.root')
        )
      ).toBe(true);
    });

    it('uses bodyComponent.root and prefers actor cache when available', () => {
      jest
        .spyOn(AnatomyGraphAlgorithms, 'getAllParts')
        .mockReturnValue(['actor-1', 'arm-1']);
      jest
        .spyOn(AnatomyCacheManager.prototype, 'has')
        .mockImplementation((entityId) => entityId === 'actor-1');
      jest.spyOn(AnatomyCacheManager.prototype, 'size').mockReturnValue(2);

      service = createService();
      const result = service.getAllParts({ root: 'blueprint-root' }, 'actor-1');

      expect(result).toEqual(['actor-1', 'arm-1']);
      expect(
        mockLogger.debug.mock.calls.some(([message]) =>
          message.includes("Using actor entity 'actor-1' as cache root")
        )
      ).toBe(true);
    });

    it('returns cached query results without invoking algorithms', () => {
      mockQueryCache.getCachedGetAllParts.mockReturnValue(['cached-1']);
      const getAllPartsSpy = jest.spyOn(AnatomyGraphAlgorithms, 'getAllParts');

      service = createService();
      const result = service.getAllParts({ body: { root: 'root-5' } });

      expect(result).toEqual(['cached-1']);
      expect(getAllPartsSpy).not.toHaveBeenCalled();
    });

    it('logs truncated previews when result set is large', () => {
      const manyParts = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
      jest
        .spyOn(AnatomyGraphAlgorithms, 'getAllParts')
        .mockReturnValue(manyParts);
      jest.spyOn(AnatomyCacheManager.prototype, 'size').mockReturnValue(3);
      jest.spyOn(AnatomyCacheManager.prototype, 'has').mockReturnValue(false);

      service = createService();
      service.getAllParts({ body: { root: 'root-6' } });

      expect(
        mockLogger.debug.mock.calls.some(([message]) =>
          message.includes("root 'root-6'") && message.includes('...')
        )
      ).toBe(true);
    });

    it('returns an empty array when no root ID can be determined', () => {
      service = createService();
      const result = service.getAllParts({ body: {} });

      expect(result).toEqual([]);
      expect(
        mockLogger.debug.mock.calls.some(([message]) =>
          message.includes('No root ID found')
        )
      ).toBe(true);
    });
  });

  describe('component lookup helpers', () => {
    it('detects when a component exists on any part', () => {
      service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1', 'part-2']);
      mockEntityManager.getComponentData
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({ equipped: true });

      const result = service.hasPartWithComponent(
        { body: { root: 'root-1' } },
        'inventory:item'
      );

      expect(result).toBe(true);
    });

    it('treats empty objects as missing components', () => {
      service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1']);
      mockEntityManager.getComponentData.mockReturnValue({});

      const result = service.hasPartWithComponent(
        { body: { root: 'root-1' } },
        'inventory:item'
      );

      expect(result).toBe(false);
    });

    it('returns the part ID when a nested component value matches', () => {
      service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1']);
      mockEntityManager.getComponentData.mockReturnValue({
        stats: {
          health: {
            current: 5,
          },
        },
      });

      const result = service.hasPartWithComponentValue(
        { body: { root: 'root-1' } },
        'stats:health',
        'stats.health.current',
        5
      );

      expect(result).toEqual({ found: true, partId: 'part-1' });
    });

    it('returns not found when nested component value is absent', () => {
      service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1']);
      mockEntityManager.getComponentData.mockReturnValue({ stats: {} });

      const result = service.hasPartWithComponentValue(
        { body: { root: 'root-1' } },
        'stats:health',
        'stats.health.current',
        10
      );

      expect(result).toEqual({ found: false });
    });

    it('ignores parts when component data is null while checking nested values', () => {
      service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-3']);
      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = service.hasPartWithComponentValue(
        { body: { root: 'root-2' } },
        'stats:health',
        'stats.health.current',
        7
      );

      expect(result).toEqual({ found: false });
    });
  });

  describe('graph proxy methods', () => {
    it('proxies getAnatomyRoot to AnatomyGraphAlgorithms', () => {
      const rootSpy = jest
        .spyOn(AnatomyGraphAlgorithms, 'getAnatomyRoot')
        .mockReturnValue('root-99');

      service = createService();
      const result = service.getAnatomyRoot('part-7');

      expect(rootSpy).toHaveBeenCalledWith(
        'part-7',
        expect.any(AnatomyCacheManager),
        mockEntityManager
      );
      expect(result).toBe('root-99');
    });

    it('proxies getPath to AnatomyGraphAlgorithms', () => {
      const pathSpy = jest
        .spyOn(AnatomyGraphAlgorithms, 'getPath')
        .mockReturnValue(['a', 'b', 'c']);

      service = createService();
      const result = service.getPath('a', 'c');

      expect(pathSpy).toHaveBeenCalledWith(
        'a',
        'c',
        expect.any(AnatomyCacheManager)
      );
      expect(result).toEqual(['a', 'b', 'c']);
    });
  });

  describe('getBodyGraph', () => {
    it('validates entity ID input', async () => {
      service = createService();
      await expect(service.getBodyGraph('')).rejects.toThrow(InvalidArgumentError);
    });

    it('throws when anatomy:body component is missing', async () => {
      mockEntityManager.getComponentData.mockResolvedValue(null);
      service = createService();

      await expect(service.getBodyGraph('actor-5')).rejects.toThrow(
        'has no anatomy:body component'
      );
    });

    it('returns helper methods that leverage cached data', async () => {
      mockEntityManager.getComponentData.mockResolvedValue({
        body: { root: 'blueprint-root' },
      });
      jest
        .spyOn(AnatomyCacheManager.prototype, 'hasCacheForRoot')
        .mockReturnValue(true);
      jest
        .spyOn(AnatomyCacheManager.prototype, 'get')
        .mockImplementation((entityId) => {
          if (entityId === 'part-1') {
            return { children: ['child-1'] };
          }
          if (entityId === 'no-children') {
            return {};
          }
          return undefined;
        });
      service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1', 'part-2']);

      const graph = await service.getBodyGraph('actor-5');

      expect(typeof graph.getAllPartIds).toBe('function');
      expect(graph.getAllPartIds()).toEqual(['part-1', 'part-2']);
      expect(graph.getConnectedParts('part-1')).toEqual(['child-1']);
      expect(graph.getConnectedParts('no-children')).toEqual([]);
      expect(graph.getConnectedParts('missing')).toEqual([]);
    });
  });

  describe('getAnatomyData', () => {
    it('validates entity ID input', async () => {
      service = createService();
      await expect(service.getAnatomyData(null)).rejects.toThrow(
        InvalidArgumentError
      );
      await expect(service.getAnatomyData(42)).rejects.toThrow(
        'Entity ID is required and must be a string'
      );
    });

    it('returns null and logs when anatomy component is missing', async () => {
      mockEntityManager.getComponentData.mockResolvedValue(null);

      service = createService();
      const result = await service.getAnatomyData('actor-1');

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "BodyGraphService.getAnatomyData: Entity 'actor-1' has no anatomy:body component"
      );
    });

    it('returns anatomy data when component exists', async () => {
      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human',
      });

      service = createService();
      const result = await service.getAnatomyData('actor-2');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "BodyGraphService.getAnatomyData: Getting anatomy data for entity 'actor-2'"
      );
      expect(result).toEqual({ recipeId: 'human', rootEntityId: 'actor-2' });
    });

    it('falls back to null recipeId when component omits the field', async () => {
      mockEntityManager.getComponentData.mockResolvedValue({});

      service = createService();
      const result = await service.getAnatomyData('actor-3');

      expect(result).toEqual({ recipeId: null, rootEntityId: 'actor-3' });
    });
  });

  describe('cache helpers', () => {
    it('proxies validateCache to the cache manager', () => {
      const validateSpy = jest
        .spyOn(AnatomyCacheManager.prototype, 'validateCache')
        .mockReturnValue(true);

      service = createService();
      const result = service.validateCache();

      expect(validateSpy).toHaveBeenCalledWith(mockEntityManager);
      expect(result).toBe(true);
    });

    it('reports whether a cache exists for a root entity', () => {
      const hasCacheSpy = jest
        .spyOn(AnatomyCacheManager.prototype, 'hasCacheForRoot')
        .mockReturnValue(true);

      service = createService();
      expect(service.hasCache('root-1')).toBe(true);
      expect(hasCacheSpy).toHaveBeenCalledWith('root-1');
    });

    it('retrieves children and parents from the cache', () => {
      jest.spyOn(AnatomyCacheManager.prototype, 'get').mockImplementation((entityId) => {
        if (entityId === 'parent-1') {
          return { children: ['child-1'] };
        }
        if (entityId === 'child-1') {
          return { parentId: 'parent-1' };
        }
        return undefined;
      });

      service = createService();
      expect(service.getChildren('parent-1')).toEqual(['child-1']);
      expect(service.getChildren('unknown')).toEqual([]);
      expect(service.getParent('child-1')).toEqual('parent-1');
      expect(service.getParent('missing')).toBeNull();
    });

    it('collects ancestor chain using getParent helper', () => {
      service = createService();
      jest.spyOn(service, 'getParent').mockImplementation((entityId) => {
        if (entityId === 'child-1') return 'parent-1';
        if (entityId === 'parent-1') return 'root-1';
        return null;
      });

      expect(service.getAncestors('child-1')).toEqual(['parent-1', 'root-1']);
    });

    it('returns descendants excluding the starting entity', () => {
      const subgraphSpy = jest
        .spyOn(AnatomyGraphAlgorithms, 'getSubgraph')
        .mockReturnValue(['root-1', 'child-1', 'child-2']);

      service = createService();
      expect(service.getAllDescendants('root-1')).toEqual(['child-1', 'child-2']);
      expect(subgraphSpy).toHaveBeenCalledWith(
        'root-1',
        expect.any(AnatomyCacheManager)
      );
    });
  });
});
