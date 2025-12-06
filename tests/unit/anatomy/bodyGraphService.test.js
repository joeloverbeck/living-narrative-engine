import {
  BodyGraphService,
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { ANATOMY_CONSTANTS } from '../../../src/anatomy/constants/anatomyConstants.js';

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => ({
  AnatomyCacheManager: jest.fn(),
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

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => ({
  AnatomyQueryCache: jest.fn(),
}));

const createComponentData = (overrides = {}) => ({
  parentId: 'parent-entity',
  socketId: 'socket-1',
  ...overrides,
});

describe('BodyGraphService', () => {
  let mockEntityManager;
  let mockLogger;
  let mockEventDispatcher;
  let mockCacheManager;
  let mockQueryCache;
  let createService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCacheManager = {
      hasCacheForRoot: jest.fn(),
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

    createService = (overrides = {}) =>
      new BodyGraphService({
        entityManager: mockEntityManager,
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
        ...overrides,
      });
  });

  describe('constructor', () => {
    it('throws when required dependencies are missing', () => {
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
    });

    it('uses provided query cache when supplied', () => {
      const externalQueryCache = {
        getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
        cacheFindPartsByType: jest.fn(),
        cacheGetAllParts: jest.fn(),
        getCachedGetAllParts: jest.fn(),
        invalidateRoot: jest.fn(),
      };

      AnatomyGraphAlgorithms.findPartsByType.mockReturnValue([]);

      const service = createService({ queryCache: externalQueryCache });

      expect(AnatomyQueryCache).not.toHaveBeenCalled();
      service.findPartsByType('root', 'type');
      expect(externalQueryCache.getCachedFindPartsByType).toHaveBeenCalledWith(
        'root',
        'type'
      );
      expect(externalQueryCache.cacheFindPartsByType).toHaveBeenCalledWith(
        'root',
        'type',
        []
      );
    });
  });

  describe('buildAdjacencyCache', () => {
    it('builds cache when it does not exist', async () => {
      mockCacheManager.hasCacheForRoot.mockReturnValue(false);

      const service = createService();
      await service.buildAdjacencyCache('root');

      expect(mockCacheManager.buildCache).toHaveBeenCalledWith(
        'root',
        mockEntityManager
      );
    });

    it('does not rebuild cache when it already exists', async () => {
      mockCacheManager.hasCacheForRoot.mockReturnValue(true);

      const service = createService();
      await service.buildAdjacencyCache('root');

      expect(mockCacheManager.buildCache).not.toHaveBeenCalled();
    });
  });

  describe('detachPart', () => {
    beforeEach(() => {
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-entity');
      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['part-1', 'part-2']);
    });

    it('throws when joint component is missing', async () => {
      mockEntityManager.getComponentData.mockReturnValue(null);

      const service = createService();

      await expect(service.detachPart('part-id')).rejects.toThrow(
        new InvalidArgumentError(
          "Entity 'part-id' has no joint component - cannot detach"
        )
      );
    });

    it('detaches part with cascade and invalidates caches', async () => {
      mockEntityManager.getComponentData.mockReturnValue(createComponentData());

      const service = createService();
      const result = await service.detachPart('part-id');

      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'part-id',
        'anatomy:joint'
      );
      expect(mockCacheManager.invalidateCacheForRoot).toHaveBeenCalledWith(
        'root-entity'
      );
      expect(mockQueryCache.invalidateRoot).toHaveBeenCalledWith('root-entity');
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        ANATOMY_CONSTANTS.LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedEntityId: 'part-id',
          parentEntityId: 'parent-entity',
          socketId: 'socket-1',
          detachedCount: 2,
          reason: 'manual',
        })
      );
      expect(result).toEqual({
        detached: ['part-1', 'part-2'],
        parentId: 'parent-entity',
        socketId: 'socket-1',
      });
    });

    it('supports non-cascading detachment', async () => {
      mockEntityManager.getComponentData.mockReturnValue(createComponentData());

      const service = createService();
      const result = await service.detachPart('part-id', {
        cascade: false,
        reason: 'testing',
      });

      expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
      expect(result.detached).toEqual(['part-id']);
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({ reason: 'testing', detachedCount: 1 })
      );
    });

    it('skips cache invalidation when anatomy root cannot be resolved', async () => {
      mockEntityManager.getComponentData.mockReturnValue(createComponentData());
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue(null);
      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['part-id']);

      const service = createService();
      await service.detachPart('part-id');

      expect(mockCacheManager.invalidateCacheForRoot).not.toHaveBeenCalled();
      expect(mockQueryCache.invalidateRoot).not.toHaveBeenCalled();
    });
  });

  describe('findPartsByType', () => {
    it('returns cached results when available', () => {
      mockQueryCache.getCachedFindPartsByType.mockReturnValue(['cached']);

      const service = createService();
      const result = service.findPartsByType('root', 'type');

      expect(result).toEqual(['cached']);
      expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();
    });

    it('queries algorithms and caches results when not cached', () => {
      AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['computed']);
      mockQueryCache.getCachedFindPartsByType.mockReturnValue(undefined);

      const service = createService();
      const result = service.findPartsByType('root', 'type');

      expect(AnatomyGraphAlgorithms.findPartsByType).toHaveBeenCalledWith(
        'root',
        'type',
        mockCacheManager
      );
      expect(mockQueryCache.cacheFindPartsByType).toHaveBeenCalledWith(
        'root',
        'type',
        ['computed']
      );
      expect(result).toEqual(['computed']);
    });
  });

  it('delegates getAnatomyRoot and getPath to algorithms', () => {
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root');
    AnatomyGraphAlgorithms.getPath.mockReturnValue(['a', 'b']);

    const service = createService();

    expect(service.getAnatomyRoot('part')).toBe('root');
    expect(AnatomyGraphAlgorithms.getAnatomyRoot).toHaveBeenCalledWith(
      'part',
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

  describe('getAllParts', () => {
    it('returns empty array when component is missing', () => {
      const service = createService();

      expect(service.getAllParts(null)).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'BodyGraphService.getAllParts: No bodyComponent provided'
      );
    });

    it('returns cached result when available', () => {
      mockQueryCache.getCachedGetAllParts.mockReturnValue(['a', 'b']);
      mockCacheManager.size.mockReturnValue(2);
      mockCacheManager.has.mockReturnValue(false);

      const service = createService();
      const result = service.getAllParts(
        { body: { root: 'root-id' } },
        'actor-1'
      );

      expect(result).toEqual(['a', 'b']);
      expect(mockQueryCache.cacheGetAllParts).not.toHaveBeenCalled();
    });

    it('uses actor entity when present in cache', () => {
      mockQueryCache.getCachedGetAllParts.mockReturnValue(undefined);
      mockCacheManager.has.mockReturnValue(true);
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['actor-part']);

      const service = createService();
      const result = service.getAllParts(
        { body: { root: 'blueprint-root' } },
        'actor-entity'
      );

      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'actor-entity',
        mockCacheManager,
        mockEntityManager
      );
      expect(mockQueryCache.cacheGetAllParts).toHaveBeenCalledWith(
        'actor-entity',
        ['actor-part']
      );
      expect(result).toEqual(['actor-part']);
    });

    it('falls back to blueprint root when actor not cached', () => {
      mockQueryCache.getCachedGetAllParts.mockReturnValue(undefined);
      mockCacheManager.has.mockReturnValue(false);
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['bp-part']);

      const service = createService();
      const result = service.getAllParts({ root: 'bp-root' }, 'actor-entity');

      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'bp-root',
        mockCacheManager,
        mockEntityManager
      );
      expect(result).toEqual(['bp-part']);
    });

    it('returns empty array when no root could be resolved', () => {
      const service = createService();
      const result = service.getAllParts({ foo: 'bar' });

      expect(result).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'BodyGraphService.getAllParts: No root ID found in bodyComponent'
      );
    });

    it('logs truncated summaries for large anatomy graphs', () => {
      mockQueryCache.getCachedGetAllParts.mockReturnValue(undefined);
      mockCacheManager.has.mockReturnValue(false);
      mockCacheManager.size.mockReturnValue(2);
      const largeResult = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(largeResult);

      const service = createService();
      mockLogger.debug.mockClear();

      const result = service.getAllParts({ root: 'bp-root' }, 'actor-1');

      expect(result).toEqual(largeResult);
      const summaryLog = mockLogger.debug.mock.calls
        .map((call) => call[0])
        .find((message) =>
          message?.startsWith(
            'BodyGraphService.getAllParts: AnatomyGraphAlgorithms returned'
          )
        );
      expect(summaryLog).toContain('...');
    });
  });

  describe('component queries', () => {
    it('detects parts with specific component', () => {
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1', 'part-2']);

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ some: 'data' })
        .mockReturnValueOnce(null);

      expect(
        service.hasPartWithComponent({ body: { root: 'root' } }, 'component')
      ).toBe(true);
    });

    it('returns false when no component data is found', () => {
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1']);

      mockEntityManager.getComponentData.mockReturnValue({});

      expect(
        service.hasPartWithComponent({ body: { root: 'root' } }, 'component')
      ).toBe(false);
    });

    it('finds component by nested value', () => {
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1', 'part-2']);

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ stats: { hp: 10 } })
        .mockReturnValueOnce({ stats: { hp: 5 } });

      expect(
        service.hasPartWithComponentValue(
          { body: { root: 'root' } },
          'component',
          'stats.hp',
          5
        )
      ).toEqual({ found: true, partId: 'part-2' });
    });

    it('returns not found when value does not match', () => {
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1']);
      mockEntityManager.getComponentData.mockReturnValue({ stats: { hp: 10 } });

      expect(
        service.hasPartWithComponentValue(
          { body: { root: 'root' } },
          'component',
          'stats.hp',
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
          { body: { root: 'root' } },
          'component',
          'stats.hp',
          10
        )
      ).toEqual({ found: false });
    });

    it('treats missing nested component values as undefined', () => {
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1']);
      mockEntityManager.getComponentData.mockReturnValue({ stats: {} });

      expect(
        service.hasPartWithComponentValue(
          { body: { root: 'root' } },
          'component',
          'stats.hp',
          5
        )
      ).toEqual({ found: false });
    });
  });

  describe('getBodyGraph', () => {
    it('validates entityId', async () => {
      const service = createService();

      await expect(service.getBodyGraph()).rejects.toThrow(
        new InvalidArgumentError('Entity ID is required and must be a string')
      );
    });

    it('throws when anatomy component is missing', async () => {
      mockEntityManager.getComponentData.mockResolvedValue(null);
      const service = createService();

      await expect(service.getBodyGraph('entity')).rejects.toThrow(
        new Error('Entity entity has no anatomy:body component')
      );
    });

    it('returns graph helpers when anatomy exists', async () => {
      mockEntityManager.getComponentData.mockResolvedValue({
        body: { root: 'root-1' },
      });
      mockCacheManager.get.mockImplementation((id) =>
        id === 'entity' ? { children: ['child-1'] } : undefined
      );
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1']);

      const graph = await service.getBodyGraph('entity');

      expect(mockCacheManager.buildCache).toHaveBeenCalledWith(
        'entity',
        mockEntityManager
      );
      expect(graph.getAllPartIds()).toEqual(['part-1']);
      expect(graph.getConnectedParts('entity')).toEqual(['child-1']);
      expect(graph.getConnectedParts('missing')).toEqual([]);
    });
  });

  describe('getAnatomyData', () => {
    it('validates entityId input', async () => {
      const service = createService();

      await expect(service.getAnatomyData()).rejects.toThrow(
        new InvalidArgumentError('Entity ID is required and must be a string')
      );
    });

    it('returns null when body component is missing', async () => {
      mockEntityManager.getComponentData.mockResolvedValue(null);
      const service = createService();

      await expect(service.getAnatomyData('entity')).resolves.toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "BodyGraphService.getAnatomyData: Entity 'entity' has no anatomy:body component"
      );
    });

    it('returns recipe data when body component exists', async () => {
      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'recipe-1',
      });
      const service = createService();

      await expect(service.getAnatomyData('entity')).resolves.toEqual({
        recipeId: 'recipe-1',
        rootEntityId: 'entity',
      });
    });

    it('defaults missing recipe identifiers to null', async () => {
      mockEntityManager.getComponentData.mockResolvedValue({});
      const service = createService();

      await expect(service.getAnatomyData('entity')).resolves.toEqual({
        recipeId: null,
        rootEntityId: 'entity',
      });
    });
  });

  it('validates and exposes cache helpers', () => {
    const service = createService();

    service.validateCache();
    expect(mockCacheManager.validateCache).toHaveBeenCalledWith(
      mockEntityManager
    );

    service.hasCache('root');
    expect(mockCacheManager.hasCacheForRoot).toHaveBeenCalledWith('root');

    const nodeMapping = {
      node: { children: ['a'], parentId: 'p' },
      start: { parentId: 'p1' },
      p1: { parentId: 'p2' },
      p2: null,
    };
    mockCacheManager.get.mockImplementation((id) => nodeMapping[id]);

    expect(service.getChildren('missing')).toEqual([]);
    expect(service.getParent('missing')).toBeNull();
    expect(service.getChildren('node')).toEqual(['a']);
    expect(service.getParent('node')).toEqual('p');
    expect(service.getAncestors('start')).toEqual(['p1', 'p2']);
  });

  it('returns descendants via graph algorithms', () => {
    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([
      'self',
      'child-1',
      'child-2',
    ]);

    const service = createService();
    expect(service.getAllDescendants('self')).toEqual(['child-1', 'child-2']);
    expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
      'self',
      mockCacheManager
    );
  });
});
