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
    getAnatomyRoot: jest.fn(),
    getPath: jest.fn(),
    getAllParts: jest.fn(),
    findPartsByType: jest.fn(),
  },
}));

describe('BodyGraphService high fidelity coverage', () => {
  let mockCacheManager;
  let mockQueryCache;
  let mockEntityManager;
  let mockLogger;
  let mockEventDispatcher;
  let createService;

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
      getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
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

    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([]);
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-entity');
    AnatomyGraphAlgorithms.getPath.mockReturnValue(['from', 'to']);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue([]);
    AnatomyGraphAlgorithms.findPartsByType.mockReturnValue([]);

    createService = (overrides = {}) =>
      new BodyGraphService({
        entityManager: mockEntityManager,
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
        ...overrides,
      });
  });

  it('enforces constructor dependencies and wires default caches', () => {
    expect(() => new BodyGraphService({})).toThrow(
      new InvalidArgumentError('entityManager is required')
    );

    expect(
      () =>
        new BodyGraphService({
          entityManager: mockEntityManager,
        })
    ).toThrow(new InvalidArgumentError('logger is required'));

    expect(
      () =>
        new BodyGraphService({
          entityManager: mockEntityManager,
          logger: mockLogger,
        })
    ).toThrow(new InvalidArgumentError('eventDispatcher is required'));

    AnatomyCacheManager.mockClear();
    AnatomyQueryCache.mockClear();
    const service = createService();

    expect(service).toBeInstanceOf(BodyGraphService);
    expect(AnatomyCacheManager).toHaveBeenCalledWith({ logger: mockLogger });
    expect(AnatomyQueryCache).toHaveBeenCalledWith({ logger: mockLogger });
  });

  it('honors externally provided query cache', () => {
    const externalQueryCache = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(['cached']),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn().mockReturnValue(['all']),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };

    AnatomyQueryCache.mockClear();
    const service = createService({ queryCache: externalQueryCache });

    const result = service.findPartsByType('root', 'hand');
    expect(result).toEqual(['cached']);
    expect(externalQueryCache.getCachedFindPartsByType).toHaveBeenCalledWith(
      'root',
      'hand'
    );
    expect(AnatomyQueryCache).not.toHaveBeenCalled();
    expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();
  });
  describe('buildAdjacencyCache', () => {
    it('builds cache when missing', async () => {
      const service = createService();

      await service.buildAdjacencyCache('root-1');

      expect(mockCacheManager.buildCache).toHaveBeenCalledWith(
        'root-1',
        mockEntityManager
      );
    });

    it('skips building when cache exists', async () => {
      mockCacheManager.hasCacheForRoot.mockReturnValue(true);
      const service = createService();

      await service.buildAdjacencyCache('root-2');

      expect(mockCacheManager.buildCache).not.toHaveBeenCalled();
    });
  });

  describe('detachPart', () => {
    it('throws when the joint component is absent', async () => {
      mockEntityManager.getComponentData.mockReturnValue(undefined);
      const service = createService();

      await expect(service.detachPart('missing-joint')).rejects.toThrow(
        new InvalidArgumentError(
          "Entity 'missing-joint' has no joint component - cannot detach"
        )
      );
    });

    it('detaches cascaded parts and invalidates caches', async () => {
      mockEntityManager.getComponentData.mockReturnValue({
        parentId: 'parent-1',
        socketId: 'socket-9',
      });
      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([
        'part-main',
        'child-1',
      ]);
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-42');

      const service = createService();
      const result = await service.detachPart('part-main', { reason: 'damage' });

      expect(result).toEqual({
        detached: ['part-main', 'child-1'],
        parentId: 'parent-1',
        socketId: 'socket-9',
      });
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'part-main',
        'anatomy:joint'
      );
      expect(mockCacheManager.invalidateCacheForRoot).toHaveBeenCalledWith(
        'root-42'
      );
      expect(mockQueryCache.invalidateRoot).toHaveBeenCalledWith('root-42');
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedEntityId: 'part-main',
          parentEntityId: 'parent-1',
          socketId: 'socket-9',
          detachedCount: 2,
          reason: 'damage',
          timestamp: expect.any(Number),
        })
      );
    });

    it('supports non-cascading detach without cache invalidation when root missing', async () => {
      mockEntityManager.getComponentData.mockReturnValue({
        parentId: 'parent-2',
        socketId: 'socket-2',
      });
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue(null);

      const service = createService();
      const result = await service.detachPart('isolated-part', { cascade: false });

      expect(result).toEqual({
        detached: ['isolated-part'],
        parentId: 'parent-2',
        socketId: 'socket-2',
      });
      expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
      expect(mockCacheManager.invalidateCacheForRoot).not.toHaveBeenCalled();
      expect(mockQueryCache.invalidateRoot).not.toHaveBeenCalled();
    });
  });

  describe('graph queries and caching', () => {
    it('caches findPartsByType results per root and type', () => {
      const service = createService();

      mockQueryCache.getCachedFindPartsByType
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(['cached-arm']);
      AnatomyGraphAlgorithms.findPartsByType.mockReturnValueOnce([
        'fresh-arm',
      ]);

      const first = service.findPartsByType('root-x', 'arm');
      const second = service.findPartsByType('root-x', 'arm');

      expect(first).toEqual(['fresh-arm']);
      expect(second).toEqual(['cached-arm']);
      expect(AnatomyGraphAlgorithms.findPartsByType).toHaveBeenCalledWith(
        'root-x',
        'arm',
        mockCacheManager
      );
      expect(mockQueryCache.cacheFindPartsByType).toHaveBeenCalledWith(
        'root-x',
        'arm',
        ['fresh-arm']
      );
    });

    it('delegates anatomy root and path lookups to algorithms', () => {
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-77');
      AnatomyGraphAlgorithms.getPath.mockReturnValue(['a', 'b', 'c']);
      const service = createService();

      expect(service.getAnatomyRoot('node-1')).toBe('root-77');
      expect(service.getPath('from-1', 'to-1')).toEqual(['a', 'b', 'c']);
      expect(AnatomyGraphAlgorithms.getAnatomyRoot).toHaveBeenCalledWith(
        'node-1',
        mockCacheManager,
        mockEntityManager
      );
      expect(AnatomyGraphAlgorithms.getPath).toHaveBeenCalledWith(
        'from-1',
        'to-1',
        mockCacheManager
      );
    });
  });
  describe('getAllParts', () => {
    it('returns empty array when body component is missing', () => {
      const service = createService();

      expect(service.getAllParts(null)).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'BodyGraphService.getAllParts: No bodyComponent provided'
      );
    });

    it('returns empty array when no root can be resolved', () => {
      const service = createService();

      expect(service.getAllParts({ body: {} })).toEqual([]);
    });

    it('uses actor entity when cached and caches results', () => {
      mockCacheManager.size.mockReturnValue(3);
      mockCacheManager.has.mockImplementation((id) => id === 'actor-1');
      AnatomyGraphAlgorithms.getAllParts.mockReturnValueOnce([
        'actor-1',
        'arm-1',
        'hand-1',
        'finger-1',
        'finger-2',
        'finger-3',
      ]);

      const service = createService();
      const result = service.getAllParts({ body: { root: 'blueprint-1' } }, 'actor-1');

      expect(result).toHaveLength(6);
      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'actor-1',
        mockCacheManager,
        mockEntityManager
      );
      expect(mockQueryCache.cacheGetAllParts).toHaveBeenCalledWith(
        'actor-1',
        result
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "BodyGraphService: AnatomyGraphAlgorithms.getAllParts returned 6 parts"
        )
      );
    });

    it('falls back to blueprint root when actor cache is missing and returns cached results', () => {
      mockCacheManager.has.mockReturnValue(false);
      mockQueryCache.getCachedGetAllParts.mockReturnValue(['cached-root']);

      const service = createService();
      const result = service.getAllParts({ root: 'direct-root' }, 'actor-2');

      expect(result).toEqual(['cached-root']);
      expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "BodyGraphService: Using blueprint root 'direct-root' as cache root (actor 'actor-2' not in cache, cache size: 0)"
      );
    });
  });

  describe('component helpers', () => {
    it('detects parts containing a component', () => {
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1', 'part-2']);
      mockEntityManager.getComponentData.mockImplementation((id) =>
        id === 'part-2' ? { populated: true } : {}
      );

      expect(service.hasPartWithComponent({ root: 'root-x' }, 'component')).toBe(
        true
      );
    });

    it('returns false when component data is empty', () => {
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1']);
      mockEntityManager.getComponentData.mockReturnValue(undefined);

      expect(service.hasPartWithComponent({ root: 'root-x' }, 'component')).toBe(
        false
      );
    });

    it('finds parts by nested component value', () => {
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1', 'part-2']);
      mockEntityManager.getComponentData.mockImplementation((id) =>
        id === 'part-1'
          ? { stats: {} }
          : { stats: { health: 15 } }
      );

      expect(
        service.hasPartWithComponentValue(
          { root: 'root-x' },
          'component',
          'stats.health',
          15
        )
      ).toEqual({ found: true, partId: 'part-2' });
    });

    it('returns not found when nested value does not match', () => {
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1']);
      mockEntityManager.getComponentData.mockReturnValue({ stats: { health: 10 } });

      expect(
        service.hasPartWithComponentValue(
          { root: 'root-x' },
          'component',
          'stats.health',
          5
        )
      ).toEqual({ found: false });
    });

    it('returns not found when component data is null', () => {
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1']);
      mockEntityManager.getComponentData.mockReturnValue(null);

      expect(
        service.hasPartWithComponentValue(
          { root: 'root-x' },
          'component',
          'stats.health',
          5
        )
      ).toEqual({ found: false });
    });
  });
  describe('getBodyGraph', () => {
    it('validates the input entity identifier', async () => {
      const service = createService();

      await expect(service.getBodyGraph(null)).rejects.toThrow(
        new InvalidArgumentError('Entity ID is required and must be a string')
      );
    });

    it('throws when the anatomy body component is missing', async () => {
      const service = createService();
      mockEntityManager.getComponentData.mockResolvedValueOnce(null);

      await expect(service.getBodyGraph('actor-1')).rejects.toThrow(
        new Error("Entity actor-1 has no anatomy:body component")
      );
    });

    it('returns graph helpers when anatomy data exists', async () => {
      const service = createService();
      mockEntityManager.getComponentData.mockResolvedValueOnce({ root: 'root-1' });
      mockCacheManager.get.mockReturnValueOnce({ children: ['child-1'] });
      jest.spyOn(service, 'getAllParts').mockReturnValue(['actor-1', 'child-1']);

      const graph = await service.getBodyGraph('actor-1');

      expect(mockCacheManager.buildCache).toHaveBeenCalledWith(
        'actor-1',
        mockEntityManager
      );
      expect(graph.getAllPartIds()).toEqual(['actor-1', 'child-1']);
      expect(graph.getConnectedParts('actor-1')).toEqual(['child-1']);
    });
  });

  describe('getAnatomyData', () => {
    it('validates the entity identifier', async () => {
      const service = createService();

      await expect(service.getAnatomyData(undefined)).rejects.toThrow(
        new InvalidArgumentError('Entity ID is required and must be a string')
      );
    });

    it('returns null when anatomy body component is missing', async () => {
      const service = createService();
      mockEntityManager.getComponentData.mockResolvedValueOnce(null);

      await expect(service.getAnatomyData('actor-2')).resolves.toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "BodyGraphService.getAnatomyData: Entity 'actor-2' has no anatomy:body component"
      );
    });

    it('returns recipe data with null fallback', async () => {
      const service = createService();
      mockEntityManager.getComponentData
        .mockResolvedValueOnce({ recipeId: 'recipe-9' })
        .mockResolvedValueOnce({});

      await expect(service.getAnatomyData('actor-3')).resolves.toEqual({
        recipeId: 'recipe-9',
        rootEntityId: 'actor-3',
      });

      await expect(service.getAnatomyData('actor-4')).resolves.toEqual({
        recipeId: null,
        rootEntityId: 'actor-4',
      });
    });
  });

  describe('cache inspection helpers', () => {
    it('validates cache contents and proxies helper lookups', () => {
      mockCacheManager.hasCacheForRoot.mockReturnValue(true);
      mockCacheManager.get.mockImplementation((id) => {
        if (id === 'node-1') {
          return { children: ['child-1'] };
        }
        if (id === 'node-2') {
          return { parentId: 'parent-1' };
        }
        if (id === 'root-node') {
          return { parentId: null };
        }
        return null;
      });

      const service = createService();

      expect(service.validateCache()).toBe(true);
      expect(mockCacheManager.validateCache).toHaveBeenCalledWith(
        mockEntityManager
      );
      expect(service.hasCache('root-7')).toBe(true);
      expect(mockCacheManager.hasCacheForRoot).toHaveBeenCalledWith('root-7');
      expect(service.getChildren('node-1')).toEqual(['child-1']);
      expect(service.getChildren('unknown')).toEqual([]);
      expect(service.getParent('node-2')).toBe('parent-1');
      expect(service.getParent('root-node')).toBeNull();
    });

    it('walks ancestor chains using cached parent relationships', () => {
      const relationships = {
        'finger-1': { parentId: 'hand-1' },
        'hand-1': { parentId: 'arm-1' },
        'arm-1': { parentId: 'torso-1' },
        'torso-1': { parentId: null },
      };
      mockCacheManager.get.mockImplementation((id) => relationships[id] || null);

      const service = createService();

      expect(service.getAncestors('finger-1')).toEqual([
        'hand-1',
        'arm-1',
        'torso-1',
      ]);
    });

    it('returns all descendants from graph algorithms excluding the root', () => {
      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([
        'root-1',
        'child-1',
        'child-2',
      ]);
      const service = createService();

      expect(service.getAllDescendants('root-1')).toEqual(['child-1', 'child-2']);
      expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
        'root-1',
        mockCacheManager
      );
    });
  });
});
