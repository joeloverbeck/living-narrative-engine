import { BodyGraphService, LIMB_DETACHED_EVENT_ID } from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';

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

describe('BodyGraphService final coverage', () => {
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
    it('requires all dependencies', () => {
      expect(() => new BodyGraphService({})).toThrow(
        new InvalidArgumentError('entityManager is required')
      );

      expect(() =>
        new BodyGraphService({ entityManager: mockEntityManager })
      ).toThrow(new InvalidArgumentError('logger is required'));

      expect(() =>
        new BodyGraphService({
          entityManager: mockEntityManager,
          logger: mockLogger,
        })
      ).toThrow(new InvalidArgumentError('eventDispatcher is required'));
    });

    it('creates a default query cache when not provided', () => {
      createService();

      expect(AnatomyCacheManager).toHaveBeenCalledWith({ logger: mockLogger });
      expect(AnatomyQueryCache).toHaveBeenCalledWith({ logger: mockLogger });
    });

    it('uses a supplied query cache without instantiating a new one', () => {
      const externalCache = {
        getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
        cacheFindPartsByType: jest.fn(),
        getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
        cacheGetAllParts: jest.fn(),
        invalidateRoot: jest.fn(),
      };

      const service = createService({ queryCache: externalCache });

      expect(AnatomyQueryCache).not.toHaveBeenCalled();
      AnatomyGraphAlgorithms.findPartsByType.mockReturnValueOnce(['arm']);
      service.findPartsByType('root', 'limb');
      expect(externalCache.getCachedFindPartsByType).toHaveBeenCalledWith(
        'root',
        'limb'
      );
      expect(externalCache.cacheFindPartsByType).toHaveBeenCalledWith(
        'root',
        'limb',
        ['arm']
      );
    });
  });

  describe('buildAdjacencyCache', () => {
    it('builds cache when missing', async () => {
      mockCacheManager.hasCacheForRoot.mockReturnValue(false);

      const service = createService();
      await service.buildAdjacencyCache('actor');

      expect(mockCacheManager.buildCache).toHaveBeenCalledWith(
        'actor',
        mockEntityManager
      );
    });

    it('skips building when cache already exists', async () => {
      mockCacheManager.hasCacheForRoot.mockReturnValue(true);

      const service = createService();
      await service.buildAdjacencyCache('actor');

      expect(mockCacheManager.buildCache).not.toHaveBeenCalled();
    });
  });

  describe('detachPart', () => {
    const joint = {
      parentId: 'torso',
      socketId: 'socket-upper-arm',
    };

    beforeEach(() => {
      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['arm', 'hand']);
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('actor-root');
      mockEntityManager.getComponentData.mockReturnValue(joint);
    });

    it('throws when the joint component is missing', async () => {
      mockEntityManager.getComponentData.mockReturnValueOnce(null);

      const service = createService();
      await expect(service.detachPart('arm')).rejects.toThrow(
        new InvalidArgumentError(
          "Entity 'arm' has no joint component - cannot detach"
        )
      );
    });

    it('detaches with cascade and invalidates caches', async () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1234);
      const service = createService();

      const result = await service.detachPart('arm');

      expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
        'arm',
        mockCacheManager
      );
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'arm',
        'anatomy:joint'
      );
      expect(mockCacheManager.invalidateCacheForRoot).toHaveBeenCalledWith(
        'actor-root'
      );
      expect(mockQueryCache.invalidateRoot).toHaveBeenCalledWith('actor-root');
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedEntityId: 'arm',
          parentEntityId: 'torso',
          socketId: 'socket-upper-arm',
          detachedCount: 2,
          reason: 'manual',
          timestamp: 1234,
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "BodyGraphService: Detached 2 entities from parent 'torso'"
      );
      expect(result).toEqual({ detached: ['arm', 'hand'], parentId: 'torso', socketId: 'socket-upper-arm' });

      nowSpy.mockRestore();
    });

    it('supports non-cascade detaches and skips cache invalidation when no root is found', async () => {
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue(null);
      const service = createService();

      const result = await service.detachPart('arm', {
        cascade: false,
        reason: 'damage',
      });

      expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
      expect(mockCacheManager.invalidateCacheForRoot).not.toHaveBeenCalled();
      expect(mockQueryCache.invalidateRoot).not.toHaveBeenCalled();
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({ reason: 'damage', detachedCount: 1 })
      );
      expect(result).toEqual({
        detached: ['arm'],
        parentId: 'torso',
        socketId: 'socket-upper-arm',
      });
    });
  });

  describe('findPartsByType', () => {
    it('returns cached values when available', () => {
      mockQueryCache.getCachedFindPartsByType.mockReturnValue(['cached']);

      const service = createService();
      const result = service.findPartsByType('root', 'limb');

      expect(result).toEqual(['cached']);
      expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();
    });

    it('queries algorithms and caches results when not cached', () => {
      mockQueryCache.getCachedFindPartsByType.mockReturnValue(undefined);
      AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['computed']);

      const service = createService();
      const result = service.findPartsByType('root', 'limb');

      expect(AnatomyGraphAlgorithms.findPartsByType).toHaveBeenCalledWith(
        'root',
        'limb',
        mockCacheManager
      );
      expect(mockQueryCache.cacheFindPartsByType).toHaveBeenCalledWith(
        'root',
        'limb',
        ['computed']
      );
      expect(result).toEqual(['computed']);
    });
  });

  describe('routing helpers', () => {
    it('delegates to anatomy graph algorithms', () => {
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root');
      AnatomyGraphAlgorithms.getPath.mockReturnValue(['a', 'b']);

      const service = createService();
      expect(service.getAnatomyRoot('arm')).toBe('root');
      expect(AnatomyGraphAlgorithms.getAnatomyRoot).toHaveBeenCalledWith(
        'arm',
        mockCacheManager,
        mockEntityManager
      );

      expect(service.getPath('hand', 'finger')).toEqual(['a', 'b']);
      expect(AnatomyGraphAlgorithms.getPath).toHaveBeenCalledWith(
        'hand',
        'finger',
        mockCacheManager
      );
    });
  });

  describe('getAllParts', () => {
    it('returns an empty array when no body component is provided', () => {
      const service = createService();
      expect(service.getAllParts(null)).toEqual([]);
    });

    it('prefers actor root when available in cache', () => {
      mockCacheManager.size.mockReturnValue(3);
      mockCacheManager.has.mockImplementation((id) => id === 'actor');
      mockQueryCache.getCachedGetAllParts.mockReturnValue(undefined);
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['actor-arm']);

      const service = createService();
      const result = service.getAllParts({ body: { root: 'blueprint' } }, 'actor');

      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'actor',
        mockCacheManager,
        mockEntityManager
      );
      expect(mockQueryCache.cacheGetAllParts).toHaveBeenCalledWith(
        'actor',
        ['actor-arm']
      );
      expect(result).toEqual(['actor-arm']);
    });

    it('falls back to blueprint root when actor is not cached', () => {
      mockCacheManager.has.mockReturnValue(false);
      mockQueryCache.getCachedGetAllParts.mockReturnValue(undefined);
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['blueprint-arm']);

      const service = createService();
      const result = service.getAllParts({ body: { root: 'blueprint' } }, 'actor');

      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'blueprint',
        mockCacheManager,
        mockEntityManager
      );
      expect(result).toEqual(['blueprint-arm']);
    });

    it('supports direct root properties', () => {
      mockQueryCache.getCachedGetAllParts.mockReturnValue(undefined);
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['direct']);

      const service = createService();
      const result = service.getAllParts({ root: 'direct-root' });

      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'direct-root',
        mockCacheManager,
        mockEntityManager
      );
      expect(result).toEqual(['direct']);
    });

    it('returns cached results without recomputing', () => {
      mockQueryCache.getCachedGetAllParts.mockReturnValue(['cached']);

      const service = createService();
      const result = service.getAllParts({ body: { root: 'blueprint' } }, 'actor');

      expect(result).toEqual(['cached']);
      expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
      expect(mockQueryCache.cacheGetAllParts).not.toHaveBeenCalled();
    });
  });

  describe('component queries', () => {
    it('detects the presence of components', () => {
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['arm', 'leg']);

      mockEntityManager.getComponentData
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({ state: 'healthy' });

      expect(service.hasPartWithComponent({ body: { root: 'r' } }, 'anatomy:limb')).toBe(
        true
      );
    });

    it('returns false when no component contains data', () => {
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['arm']);

      mockEntityManager.getComponentData.mockReturnValueOnce({});

      expect(
        service.hasPartWithComponent({ body: { root: 'r' } }, 'anatomy:limb')
      ).toBe(false);
    });

    it('locates parts by nested component values', () => {
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['arm', 'leg']);

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ stats: { temperature: { celsius: 35 } } })
        .mockReturnValueOnce({ stats: { temperature: { celsius: 37 } } });

      expect(
        service.hasPartWithComponentValue(
          { body: { root: 'r' } },
          'anatomy:status',
          'stats.temperature.celsius',
          37
        )
      ).toEqual({ found: true, partId: 'leg' });

      mockEntityManager.getComponentData
        .mockReset()
        .mockReturnValueOnce({ stats: { temperature: { celsius: 35 } } })
        .mockReturnValueOnce({ stats: { temperature: { celsius: 36 } } });

      expect(
        service.hasPartWithComponentValue(
          { body: { root: 'r' } },
          'anatomy:status',
          'stats.temperature.celsius',
          37
        )
      ).toEqual({ found: false });
    });
  });

  describe('getBodyGraph', () => {
    it('validates entity identifier input', async () => {
      const service = createService();
      await expect(service.getBodyGraph('')).rejects.toThrow(
        new InvalidArgumentError('Entity ID is required and must be a string')
      );
    });

    it('throws when the entity lacks an anatomy:body component', async () => {
      mockEntityManager.getComponentData.mockResolvedValueOnce(null);
      const service = createService();

      await expect(service.getBodyGraph('actor')).rejects.toThrow(
        new Error('Entity actor has no anatomy:body component')
      );
    });

    it('returns accessor helpers for anatomy information', async () => {
      mockEntityManager.getComponentData.mockResolvedValueOnce({
        body: { root: 'blueprint' },
      });
      const service = createService();
      const buildSpy = jest
        .spyOn(service, 'buildAdjacencyCache')
        .mockResolvedValue(undefined);
      const getAllPartsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['arm', 'leg']);
      mockCacheManager.get
        .mockReturnValueOnce({ children: ['hand'] })
        .mockReturnValueOnce(null);

      const graph = await service.getBodyGraph('actor');

      expect(buildSpy).toHaveBeenCalledWith('actor');
      expect(graph.getAllPartIds()).toEqual(['arm', 'leg']);
      expect(getAllPartsSpy).toHaveBeenCalledWith(
        { body: { root: 'blueprint' } },
        'actor'
      );
      expect(graph.getConnectedParts('arm')).toEqual(['hand']);
      expect(graph.getConnectedParts('leg')).toEqual([]);
    });
  });

  describe('getAnatomyData', () => {
    it('validates entity id and returns null when no body component is present', async () => {
      const service = createService();
      await expect(service.getAnatomyData('')).rejects.toThrow(
        new InvalidArgumentError('Entity ID is required and must be a string')
      );

      mockEntityManager.getComponentData.mockResolvedValueOnce(null);
      const result = await service.getAnatomyData('actor');
      expect(result).toBeNull();
    });

    it('returns recipe and root identifiers when available', async () => {
      mockEntityManager.getComponentData.mockResolvedValueOnce({
        recipeId: 'recipe-1',
      });
      const service = createService();

      await expect(service.getAnatomyData('actor')).resolves.toEqual({
        recipeId: 'recipe-1',
        rootEntityId: 'actor',
      });
    });
  });

  describe('cache helpers', () => {
    it('validates cache state and provides accessors', () => {
      mockCacheManager.hasCacheForRoot.mockReturnValue(true);
      mockCacheManager.get
        .mockReturnValueOnce({ children: ['child'] })
        .mockReturnValueOnce({ parentId: 'parent' })
        .mockImplementation((id) => (id === 'child' ? { parentId: 'root' } : null));

      const service = createService();
      expect(service.validateCache()).toBe(true);
      expect(service.hasCache('root')).toBe(true);
      expect(service.getChildren('root')).toEqual(['child']);
      expect(service.getParent('node')).toBe('parent');
    });

    it('computes ancestors and descendants from cached data', () => {
      mockCacheManager.get.mockImplementation((id) => {
        if (id === 'finger') return { parentId: 'hand' };
        if (id === 'hand') return { parentId: 'arm' };
        if (id === 'arm') return { parentId: null };
        if (id === 'leg') return { children: ['foot'] };
        if (id === 'foot') return { children: [] };
        return null;
      });
      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([
        'leg',
        'knee',
        'foot',
      ]);

      const service = createService();

      expect(service.getAncestors('finger')).toEqual(['hand', 'arm']);
      expect(service.getChildren('leg')).toEqual(['foot']);
      expect(service.getParent('unknown')).toBeNull();
      expect(service.getAllDescendants('leg')).toEqual(['knee', 'foot']);
    });
  });
});
