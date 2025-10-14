import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

const mockAlgorithms = {
  getSubgraph: jest.fn(),
  findPartsByType: jest.fn(),
  getAnatomyRoot: jest.fn(),
  getPath: jest.fn(),
  getAllParts: jest.fn(),
};

let mockCacheInstance;
let mockQueryCacheInstance;

jest.mock('../../../src/anatomy/anatomyGraphAlgorithms.js', () => ({
  __esModule: true,
  AnatomyGraphAlgorithms: mockAlgorithms,
}));

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => ({
  __esModule: true,
  AnatomyCacheManager: jest.fn().mockImplementation(() => mockCacheInstance),
}));

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => ({
  __esModule: true,
  AnatomyQueryCache: jest.fn().mockImplementation(() => mockQueryCacheInstance),
}));

let BodyGraphService;
let LIMB_DETACHED_EVENT_ID;
let AnatomyCacheManager;
let AnatomyQueryCache;

beforeAll(async () => {
  ({ BodyGraphService, LIMB_DETACHED_EVENT_ID } = await import(
    '../../../src/anatomy/bodyGraphService.js'
  ));
  ({ AnatomyCacheManager } = await import(
    '../../../src/anatomy/anatomyCacheManager.js'
  ));
  ({ AnatomyQueryCache } = await import(
    '../../../src/anatomy/cache/AnatomyQueryCache.js'
  ));
});

let mockEntityManager;
let mockLogger;
let mockEventDispatcher;

const createService = (overrides = {}) =>
  new BodyGraphService({
    entityManager: mockEntityManager,
    logger: mockLogger,
    eventDispatcher: mockEventDispatcher,
    queryCache: mockQueryCacheInstance,
    ...overrides,
  });

beforeEach(() => {
  jest.clearAllMocks();

  mockCacheInstance = {
    hasCacheForRoot: jest.fn().mockReturnValue(false),
    buildCache: jest.fn().mockResolvedValue(undefined),
    invalidateCacheForRoot: jest.fn(),
    has: jest.fn().mockReturnValue(false),
    get: jest.fn(),
    size: jest.fn().mockReturnValue(0),
    validateCache: jest.fn().mockReturnValue({ valid: true, issues: [] }),
  };
  AnatomyCacheManager.mockImplementation(() => mockCacheInstance);

  mockQueryCacheInstance = {
    getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
    cacheFindPartsByType: jest.fn(),
    getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
    cacheGetAllParts: jest.fn(),
    invalidateRoot: jest.fn(),
  };
  AnatomyQueryCache.mockImplementation(() => mockQueryCacheInstance);

  Object.values(mockAlgorithms).forEach((fn) => fn.mockReset());
  mockAlgorithms.getSubgraph.mockReturnValue(['part-1', 'part-2']);
  mockAlgorithms.findPartsByType.mockReturnValue(['arm']);
  mockAlgorithms.getAnatomyRoot.mockReturnValue('root-entity');
  mockAlgorithms.getPath.mockReturnValue(['from', 'via', 'to']);
  mockAlgorithms.getAllParts.mockReturnValue(['root-entity', 'arm']);

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
});

describe('BodyGraphService focused coverage', () => {
  describe('constructor validation', () => {
    it('throws when entityManager is missing', () => {
      expect(
        () =>
          new BodyGraphService({
            logger: mockLogger,
            eventDispatcher: mockEventDispatcher,
            queryCache: mockQueryCacheInstance,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('throws when logger is missing', () => {
      expect(
        () =>
          new BodyGraphService({
            entityManager: mockEntityManager,
            eventDispatcher: mockEventDispatcher,
            queryCache: mockQueryCacheInstance,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('throws when eventDispatcher is missing', () => {
      expect(
        () =>
          new BodyGraphService({
            entityManager: mockEntityManager,
            logger: mockLogger,
            queryCache: mockQueryCacheInstance,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('creates default caches when query cache not provided', () => {
      const service = new BodyGraphService({
        entityManager: mockEntityManager,
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
      });

      expect(AnatomyCacheManager).toHaveBeenCalledWith({ logger: mockLogger });
      expect(AnatomyQueryCache).toHaveBeenCalledWith({ logger: mockLogger });

      const result = service.findPartsByType('root', 'torso');
      expect(result).toEqual(['arm']);
      expect(mockQueryCacheInstance.cacheFindPartsByType).toHaveBeenCalledWith(
        'root',
        'torso',
        ['arm']
      );
    });

    it('respects provided query cache instance', () => {
      const providedQueryCache = {
        getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
        cacheFindPartsByType: jest.fn(),
        getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
        cacheGetAllParts: jest.fn(),
        invalidateRoot: jest.fn(),
      };

      const service = createService({ queryCache: providedQueryCache });

      expect(AnatomyQueryCache).not.toHaveBeenCalled();

      mockAlgorithms.findPartsByType.mockReturnValue(['hand']);
      service.findPartsByType('root', 'hand');
      expect(providedQueryCache.cacheFindPartsByType).toHaveBeenCalledWith(
        'root',
        'hand',
        ['hand']
      );
    });
  });

  describe('buildAdjacencyCache', () => {
    it('builds cache when missing', async () => {
      const service = createService();
      mockCacheInstance.hasCacheForRoot.mockReturnValue(false);

      await service.buildAdjacencyCache('actor-1');

      expect(mockCacheInstance.hasCacheForRoot).toHaveBeenCalledWith('actor-1');
      expect(mockCacheInstance.buildCache).toHaveBeenCalledWith(
        'actor-1',
        mockEntityManager
      );
    });

    it('skips building when cache exists', async () => {
      const service = createService();
      mockCacheInstance.hasCacheForRoot.mockReturnValue(true);

      await service.buildAdjacencyCache('actor-1');

      expect(mockCacheInstance.buildCache).not.toHaveBeenCalled();
    });
  });

  describe('detachPart', () => {
    it('detaches part with cascade and invalidates caches', async () => {
      const service = createService();
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (component === 'anatomy:joint') {
          return { parentId: 'torso-1', socketId: 'shoulder' };
        }
        return null;
      });
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(123456789);

      const result = await service.detachPart('arm-1');

      expect(mockAlgorithms.getSubgraph).toHaveBeenCalledWith(
        'arm-1',
        mockCacheInstance
      );
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'arm-1',
        'anatomy:joint'
      );
      expect(mockCacheInstance.invalidateCacheForRoot).toHaveBeenCalledWith(
        'root-entity'
      );
      expect(mockQueryCacheInstance.invalidateRoot).toHaveBeenCalledWith(
        'root-entity'
      );
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedEntityId: 'arm-1',
          parentEntityId: 'torso-1',
          socketId: 'shoulder',
          detachedCount: 2,
          reason: 'manual',
          timestamp: 123456789,
        })
      );
      expect(result).toEqual({
        detached: ['part-1', 'part-2'],
        parentId: 'torso-1',
        socketId: 'shoulder',
      });

      nowSpy.mockRestore();
    });

    it('supports non-cascading detach without cache invalidation', async () => {
      const service = createService();
      mockAlgorithms.getAnatomyRoot.mockReturnValueOnce(null);
      mockEntityManager.getComponentData.mockReturnValue({
        parentId: 'torso-1',
        socketId: 'shoulder',
      });

      const result = await service.detachPart('arm-1', {
        cascade: false,
        reason: 'auto',
      });

      expect(mockAlgorithms.getSubgraph).not.toHaveBeenCalled();
      expect(mockCacheInstance.invalidateCacheForRoot).not.toHaveBeenCalled();
      expect(mockQueryCacheInstance.invalidateRoot).not.toHaveBeenCalled();
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({ detachedCount: 1, reason: 'auto' })
      );
      expect(result.detached).toEqual(['arm-1']);
    });

    it('throws when part lacks joint component', async () => {
      const service = createService();
      mockEntityManager.getComponentData.mockReturnValue(undefined);

      await expect(service.detachPart('arm-1')).rejects.toThrow(InvalidArgumentError);
    });
  });

  describe('findPartsByType', () => {
    it('returns cached results when available', () => {
      const service = createService();
      mockQueryCacheInstance.getCachedFindPartsByType.mockReturnValue(['cached']);

      const result = service.findPartsByType('root-1', 'hand');

      expect(result).toEqual(['cached']);
      expect(mockAlgorithms.findPartsByType).not.toHaveBeenCalled();
    });

    it('queries algorithms and caches result when not cached', () => {
      const service = createService();
      mockQueryCacheInstance.getCachedFindPartsByType.mockReturnValue(undefined);
      mockAlgorithms.findPartsByType.mockReturnValue(['computed']);

      const result = service.findPartsByType('root-1', 'hand');

      expect(result).toEqual(['computed']);
      expect(mockQueryCacheInstance.cacheFindPartsByType).toHaveBeenCalledWith(
        'root-1',
        'hand',
        ['computed']
      );
    });
  });

  describe('graph lookups', () => {
    it('delegates to algorithms for root and path queries', () => {
      const service = createService();

      expect(service.getAnatomyRoot('part-1')).toBe('root-entity');
      expect(mockAlgorithms.getAnatomyRoot).toHaveBeenCalledWith(
        'part-1',
        mockCacheInstance,
        mockEntityManager
      );

      expect(service.getPath('from', 'to')).toEqual(['from', 'via', 'to']);
      expect(mockAlgorithms.getPath).toHaveBeenCalledWith(
        'from',
        'to',
        mockCacheInstance
      );
    });

    it('handles getAllParts lookup scenarios', () => {
      const service = createService();

      expect(service.getAllParts(null)).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'BodyGraphService.getAllParts: No bodyComponent provided'
      );

      expect(service.getAllParts({ body: {} })).toEqual([]);

      mockCacheInstance.has.mockReturnValue(false);
      mockAlgorithms.getAllParts.mockReturnValueOnce(['root', 'child']);
      const blueprintResult = service.getAllParts(
        { body: { root: 'blueprint-root' } },
        'actor-1'
      );
      expect(blueprintResult).toEqual(['root', 'child']);
      expect(mockAlgorithms.getAllParts).toHaveBeenCalledWith(
        'blueprint-root',
        mockCacheInstance,
        mockEntityManager
      );
      expect(mockQueryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith(
        'blueprint-root',
        ['root', 'child']
      );

      mockCacheInstance.has.mockImplementation((id) => id === 'actor-1');
      mockAlgorithms.getAllParts.mockReturnValueOnce(['actor-1', 'child']);
      const actorResult = service.getAllParts(
        { body: { root: 'blueprint-root' } },
        'actor-1'
      );
      expect(actorResult).toEqual(['actor-1', 'child']);
      expect(mockAlgorithms.getAllParts).toHaveBeenCalledWith(
        'actor-1',
        mockCacheInstance,
        mockEntityManager
      );
      expect(mockQueryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith(
        'actor-1',
        ['actor-1', 'child']
      );

      mockQueryCacheInstance.getCachedGetAllParts.mockReturnValueOnce(['cached']);
      const cachedResult = service.getAllParts({ root: 'direct-root' });
      expect(cachedResult).toEqual(['cached']);
      expect(mockAlgorithms.getAllParts).not.toHaveBeenCalledWith(
        'direct-root',
        mockCacheInstance,
        mockEntityManager
      );
    });
  });

  describe('component search helpers', () => {
    it('detects parts with a specific component', () => {
      const service = createService();
      const getAllPartsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['p1', 'p2']);

      mockEntityManager.getComponentData.mockImplementation((id) => {
        if (id === 'p1') return null;
        if (id === 'p2') return { exists: true };
        return undefined;
      });

      expect(
        service.hasPartWithComponent({ body: { root: 'root' } }, 'component')
      ).toBe(true);

      getAllPartsSpy.mockRestore();
    });

    it('returns false when no part has a meaningful component', () => {
      const service = createService();
      const getAllPartsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['p1', 'p2']);

      mockEntityManager.getComponentData
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({});

      expect(
        service.hasPartWithComponent({ body: { root: 'root' } }, 'component')
      ).toBe(false);

      getAllPartsSpy.mockRestore();
    });

    it('finds component values using nested property paths', () => {
      const service = createService();
      const getAllPartsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['p1']);

      mockEntityManager.getComponentData.mockReturnValue({
        stats: { health: { current: 10 } },
      });

      expect(
        service.hasPartWithComponentValue(
          { body: { root: 'root' } },
          'component',
          'stats.health.current',
          10
        )
      ).toEqual({ found: true, partId: 'p1' });

      getAllPartsSpy.mockRestore();
    });

    it('returns not found when nested value is missing', () => {
      const service = createService();
      const getAllPartsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['p1']);

      mockEntityManager.getComponentData.mockReturnValue({
        stats: { health: {} },
      });

      expect(
        service.hasPartWithComponentValue(
          { body: { root: 'root' } },
          'component',
          'stats.health.current',
          10
        )
      ).toEqual({ found: false });

      getAllPartsSpy.mockRestore();
    });
  });

  describe('getBodyGraph', () => {
    it('validates entity identifier', async () => {
      const service = createService();
      await expect(service.getBodyGraph(null)).rejects.toThrow(InvalidArgumentError);
    });

    it('throws when anatomy:body component is missing', async () => {
      const service = createService();
      mockEntityManager.getComponentData.mockResolvedValueOnce(null);

      await expect(service.getBodyGraph('actor-1')).rejects.toThrow(
        /has no anatomy:body component/
      );
    });

    it('returns helper accessors for body graph', async () => {
      const service = createService();
      mockEntityManager.getComponentData.mockResolvedValueOnce({
        body: { root: 'blueprint-root' },
      });
      mockCacheInstance.hasCacheForRoot.mockReturnValue(false);
      mockCacheInstance.get.mockImplementation((id) => {
        if (id === 'part-child') {
          return { children: ['grandchild'] };
        }
        return { children: ['part-child'] };
      });
      const getAllPartsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['actor-1', 'part-child']);

      const graph = await service.getBodyGraph('actor-1');

      expect(mockCacheInstance.buildCache).toHaveBeenCalledWith(
        'actor-1',
        mockEntityManager
      );
      expect(graph.getAllPartIds()).toEqual(['actor-1', 'part-child']);
      expect(graph.getConnectedParts('part-child')).toEqual(['grandchild']);

      getAllPartsSpy.mockRestore();
    });
  });

  describe('getAnatomyData', () => {
    it('validates identifier and returns null when missing component', async () => {
      const service = createService();
      await expect(service.getAnatomyData('')).rejects.toThrow(InvalidArgumentError);

      mockEntityManager.getComponentData.mockResolvedValueOnce(null);
      await expect(service.getAnatomyData('actor-1')).resolves.toBeNull();
    });

    it('returns recipe and root information', async () => {
      const service = createService();
      mockEntityManager.getComponentData.mockResolvedValueOnce({ recipeId: 'recipe-1' });

      await expect(service.getAnatomyData('actor-1')).resolves.toEqual({
        recipeId: 'recipe-1',
        rootEntityId: 'actor-1',
      });

      mockEntityManager.getComponentData.mockResolvedValueOnce({});
      await expect(service.getAnatomyData('actor-2')).resolves.toEqual({
        recipeId: null,
        rootEntityId: 'actor-2',
      });
    });
  });

  describe('cache helpers', () => {
    it('exposes cache inspection utilities', () => {
      const service = createService();
      const nodes = {
        root: { children: ['child'] },
        child: { parentId: 'parent', children: ['grandchild'] },
        parent: { parentId: 'grandparent', children: [] },
        grandparent: { parentId: null, children: [] },
      };
      mockCacheInstance.get.mockImplementation((id) => nodes[id]);
      mockCacheInstance.hasCacheForRoot.mockReturnValue(true);
      mockAlgorithms.getSubgraph.mockReturnValue(['root', 'child', 'grandchild']);

      expect(service.validateCache()).toEqual({ valid: true, issues: [] });
      expect(service.hasCache('root')).toBe(true);
      expect(service.getChildren('child')).toEqual(['grandchild']);
      expect(service.getChildren('missing')).toEqual([]);
      expect(service.getParent('child')).toBe('parent');
      expect(service.getParent('missing')).toBeNull();
      expect(service.getAncestors('child')).toEqual(['parent', 'grandparent']);
      expect(service.getAllDescendants('root')).toEqual(['child', 'grandchild']);
      expect(mockAlgorithms.getSubgraph).toHaveBeenCalledWith('root', mockCacheInstance);
    });
  });
});
