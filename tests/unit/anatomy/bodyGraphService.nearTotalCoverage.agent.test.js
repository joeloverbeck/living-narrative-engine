import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyGraphService, LIMB_DETACHED_EVENT_ID } from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';

let mockCacheManager;
let mockQueryCache;
let cacheManagerConstructorArgs;
let queryCacheConstructorArgs;

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => ({
  AnatomyCacheManager: jest.fn().mockImplementation((args) => {
    cacheManagerConstructorArgs = args;
    return mockCacheManager;
  }),
}));

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => ({
  AnatomyQueryCache: jest.fn().mockImplementation((args) => {
    queryCacheConstructorArgs = args;
    return mockQueryCache;
  }),
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

describe('BodyGraphService near total coverage', () => {
  let mockEntityManager;
  let mockLogger;
  let mockEventDispatcher;
  let service;

  const createCacheManagerMock = () => ({
    hasCacheForRoot: jest.fn().mockReturnValue(false),
    buildCache: jest.fn().mockResolvedValue(undefined),
    invalidateCacheForRoot: jest.fn(),
    get: jest.fn(),
    has: jest.fn().mockReturnValue(false),
    size: jest.fn().mockReturnValue(0),
    validateCache: jest.fn().mockReturnValue('validated-cache'),
  });

  const createQueryCacheMock = () => ({
    getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
    cacheFindPartsByType: jest.fn(),
    getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
    cacheGetAllParts: jest.fn(),
    invalidateRoot: jest.fn(),
  });

  const createService = (overrides = {}) =>
    new BodyGraphService({
      entityManager: mockEntityManager,
      logger: mockLogger,
      eventDispatcher: mockEventDispatcher,
      ...overrides,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheManager = createCacheManagerMock();
    mockQueryCache = createQueryCacheMock();
    cacheManagerConstructorArgs = undefined;
    queryCacheConstructorArgs = undefined;

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

  describe('constructor validation and wiring', () => {
    it('requires an entity manager instance', () => {
      expect(
        () =>
          new BodyGraphService({
            logger: mockLogger,
            eventDispatcher: mockEventDispatcher,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('requires a logger instance', () => {
      expect(
        () =>
          new BodyGraphService({
            entityManager: mockEntityManager,
            eventDispatcher: mockEventDispatcher,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('requires an event dispatcher', () => {
      expect(
        () =>
          new BodyGraphService({
            entityManager: mockEntityManager,
            logger: mockLogger,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('instantiates cache and query cache when not provided', () => {
      service = createService();

      expect(AnatomyCacheManager).toHaveBeenCalledTimes(1);
      expect(cacheManagerConstructorArgs).toEqual({ logger: mockLogger });
      expect(AnatomyQueryCache).toHaveBeenCalledTimes(1);
      expect(queryCacheConstructorArgs).toEqual({ logger: mockLogger });
      expect(service).toBeInstanceOf(BodyGraphService);
    });

    it('uses the supplied query cache instance when provided', () => {
      const customQueryCache = createQueryCacheMock();
      service = createService({ queryCache: customQueryCache });

      expect(AnatomyQueryCache).not.toHaveBeenCalled();
      expect(service).toBeInstanceOf(BodyGraphService);
    });
  });

  describe('buildAdjacencyCache', () => {
    it('builds the cache when the root has not been cached', async () => {
      service = createService();

      await service.buildAdjacencyCache('root-1');

      expect(mockCacheManager.hasCacheForRoot).toHaveBeenCalledWith('root-1');
      expect(mockCacheManager.buildCache).toHaveBeenCalledWith(
        'root-1',
        mockEntityManager
      );
    });

    it('skips building the cache when already present', async () => {
      mockCacheManager.hasCacheForRoot.mockReturnValue(true);
      service = createService();

      await service.buildAdjacencyCache('root-2');

      expect(mockCacheManager.buildCache).not.toHaveBeenCalled();
    });
  });

  describe('detachPart', () => {
    it('removes part hierarchy, invalidates caches, and dispatches event when cascading', async () => {
      service = createService();
      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        if (componentId === 'anatomy:joint') {
          return { parentId: 'parent-1', socketId: 'socket-9' };
        }
        return null;
      });
      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([
        'part-1',
        'child-1',
      ]);
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-1');

      const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(424242);

      const result = await service.detachPart('part-1', {
        cascade: true,
        reason: 'test-reason',
      });

      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'part-1',
        'anatomy:joint'
      );
      expect(mockCacheManager.invalidateCacheForRoot).toHaveBeenCalledWith(
        'root-1'
      );
      expect(mockQueryCache.invalidateRoot).toHaveBeenCalledWith('root-1');
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedEntityId: 'part-1',
          parentEntityId: 'parent-1',
          socketId: 'socket-9',
          detachedCount: 2,
          reason: 'test-reason',
          timestamp: 424242,
        })
      );
      expect(mockLogger.info).toHaveBeenCalled();
      expect(result).toEqual({
        detached: ['part-1', 'child-1'],
        parentId: 'parent-1',
        socketId: 'socket-9',
      });

      dateSpy.mockRestore();
    });

    it('detaches only the specified part when cascade is disabled', async () => {
      service = createService();
      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        if (componentId === 'anatomy:joint') {
          return { parentId: 'parent-7', socketId: 'socket-3' };
        }
        return null;
      });
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue(undefined);

      const result = await service.detachPart('isolated-part', { cascade: false });

      expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
      expect(mockCacheManager.invalidateCacheForRoot).not.toHaveBeenCalled();
      expect(mockQueryCache.invalidateRoot).not.toHaveBeenCalled();
      expect(result.detached).toEqual(['isolated-part']);
    });

    it('throws when the part has no joint component', async () => {
      service = createService();
      mockEntityManager.getComponentData.mockReturnValue(null);

      await expect(service.detachPart('bad-part')).rejects.toBeInstanceOf(
        InvalidArgumentError
      );
    });
  });

  describe('findPartsByType', () => {
    it('returns cached results without recalculating', () => {
      service = createService();
      mockQueryCache.getCachedFindPartsByType.mockReturnValue(['cached-id']);

      const result = service.findPartsByType('root-a', 'arm');

      expect(result).toEqual(['cached-id']);
      expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();
    });

    it('performs lookup and caches new results when not cached', () => {
      service = createService();
      AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['fresh-id']);

      const result = service.findPartsByType('root-b', 'leg');

      expect(result).toEqual(['fresh-id']);
      expect(AnatomyGraphAlgorithms.findPartsByType).toHaveBeenCalledWith(
        'root-b',
        'leg',
        mockCacheManager
      );
      expect(mockQueryCache.cacheFindPartsByType).toHaveBeenCalledWith(
        'root-b',
        'leg',
        ['fresh-id']
      );
    });
  });

  describe('root and path helpers', () => {
    it('delegates to AnatomyGraphAlgorithms.getAnatomyRoot', () => {
      service = createService();
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('found-root');

      const result = service.getAnatomyRoot('part-9');

      expect(result).toBe('found-root');
      expect(AnatomyGraphAlgorithms.getAnatomyRoot).toHaveBeenCalledWith(
        'part-9',
        mockCacheManager,
        mockEntityManager
      );
    });

    it('delegates to AnatomyGraphAlgorithms.getPath', () => {
      service = createService();
      AnatomyGraphAlgorithms.getPath.mockReturnValue(['a', 'b']);

      const result = service.getPath('start', 'end');

      expect(result).toEqual(['a', 'b']);
      expect(AnatomyGraphAlgorithms.getPath).toHaveBeenCalledWith(
        'start',
        'end',
        mockCacheManager
      );
    });
  });

  describe('getAllParts', () => {
    it('returns an empty list when body component is missing', () => {
      service = createService();

      expect(service.getAllParts(null)).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'BodyGraphService.getAllParts: No bodyComponent provided'
      );
    });

    it('uses blueprint root when actor cache is unavailable and serves cached result', () => {
      service = createService();
      const bodyComponent = { body: { root: 'blueprint-root' } };
      mockQueryCache.getCachedGetAllParts.mockReturnValue(['cached-result']);

      const result = service.getAllParts(bodyComponent, 'actor-1');

      expect(mockCacheManager.has).toHaveBeenCalledWith('actor-1');
      expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
      expect(result).toEqual(['cached-result']);
    });

    it('uses actor entity as cache root and caches computed results', () => {
      service = createService();
      const bodyComponent = { root: 'blueprint-2' };
      mockCacheManager.has.mockReturnValue(true);
      mockCacheManager.size.mockReturnValue(3);
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['id-1', 'id-2']);

      const result = service.getAllParts(bodyComponent, 'actor-77');

      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'actor-77',
        mockCacheManager,
        mockEntityManager
      );
      expect(mockQueryCache.cacheGetAllParts).toHaveBeenCalledWith(
        'actor-77',
        ['id-1', 'id-2']
      );
      expect(result).toEqual(['id-1', 'id-2']);
    });

    it('returns an empty array when no root can be determined', () => {
      service = createService();

      const result = service.getAllParts({ unrelated: true });

      expect(result).toEqual([]);
    });
  });

  describe('component presence helpers', () => {
    it('detects when a part contains a given component', () => {
      service = createService();
      const partsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['part-a', 'part-b', 'part-c']);
      mockEntityManager.getComponentData
        .mockReturnValueOnce({})
        .mockReturnValueOnce({ foo: 'bar' })
        .mockReturnValue(null);

      const result = service.hasPartWithComponent({}, 'test:component');

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(2);
      partsSpy.mockRestore();
    });

    it('returns false when no component instances are found', () => {
      service = createService();
      const partsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['part-a', 'part-b']);
      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = service.hasPartWithComponent({}, 'missing:component');

      expect(result).toBe(false);
      partsSpy.mockRestore();
    });

    it('finds the first part whose component matches a nested property path', () => {
      service = createService();
      const partsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['part-1', 'part-2']);
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ metadata: { tags: ['alpha'] } })
        .mockReturnValueOnce({ metadata: { tags: ['alpha', 'beta'] } });

      const result = service.hasPartWithComponentValue(
        {},
        'test:component',
        'metadata.tags.1',
        'beta'
      );

      expect(result).toEqual({ found: true, partId: 'part-2' });
      partsSpy.mockRestore();
    });

    it('returns {found: false} when the nested property does not match', () => {
      service = createService();
      const partsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['part-9']);
      mockEntityManager.getComponentData.mockReturnValue({ other: {} });

      const result = service.hasPartWithComponentValue(
        {},
        'test:component',
        'metadata.value',
        'missing'
      );

      expect(result).toEqual({ found: false });
      partsSpy.mockRestore();
    });
  });

  describe('getBodyGraph', () => {
    it('requires a valid entity identifier', async () => {
      service = createService();

      await expect(service.getBodyGraph('')).rejects.toBeInstanceOf(
        InvalidArgumentError
      );
    });

    it('throws when the entity lacks an anatomy:body component', async () => {
      service = createService();
      mockEntityManager.getComponentData.mockResolvedValueOnce(null);

      await expect(service.getBodyGraph('entity-1')).rejects.toThrow(
        'Entity entity-1 has no anatomy:body component'
      );
    });

    it('returns accessors powered by cache data', async () => {
      service = createService();
      mockEntityManager.getComponentData.mockResolvedValue({
        body: { root: 'blueprint-root' },
      });
      mockCacheManager.has.mockReturnValue(true);
      mockCacheManager.size.mockReturnValue(2);
      mockCacheManager.get.mockImplementation((id) => {
        if (id === 'part-root') {
          return { children: ['child-1'] };
        }
        if (id === 'child-1') {
          return { children: [], parentId: 'part-root' };
        }
        return undefined;
      });
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue([
        'part-root',
        'child-1',
      ]);

      const graph = await service.getBodyGraph('actor-entity');

      expect(typeof graph.getAllPartIds).toBe('function');
      expect(typeof graph.getConnectedParts).toBe('function');
      expect(await graph.getAllPartIds()).toEqual(['part-root', 'child-1']);
      expect(graph.getConnectedParts('part-root')).toEqual(['child-1']);
      expect(graph.getConnectedParts('missing')).toEqual([]);
    });
  });

  describe('getAnatomyData', () => {
    it('requires a valid entity identifier', async () => {
      service = createService();

      await expect(service.getAnatomyData('')).rejects.toBeInstanceOf(
        InvalidArgumentError
      );
    });

    it('returns null when the anatomy component is missing', async () => {
      service = createService();
      mockEntityManager.getComponentData.mockResolvedValueOnce(null);

      await expect(service.getAnatomyData('entity-2')).resolves.toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "BodyGraphService.getAnatomyData: Entity 'entity-2' has no anatomy:body component"
      );
    });

    it('provides recipe and root identifiers when available', async () => {
      service = createService();
      mockEntityManager.getComponentData.mockResolvedValue({ recipeId: 'r-7' });

      await expect(service.getAnatomyData('entity-3')).resolves.toEqual({
        recipeId: 'r-7',
        rootEntityId: 'entity-3',
      });
    });

    it('falls back to a null recipe identifier when one is not provided', async () => {
      service = createService();
      mockEntityManager.getComponentData.mockResolvedValue({});

      await expect(service.getAnatomyData('entity-4')).resolves.toEqual({
        recipeId: null,
        rootEntityId: 'entity-4',
      });
    });
  });

  describe('cache access helpers', () => {
    it('validates the internal cache against the entity manager', () => {
      service = createService();

      expect(service.validateCache()).toBe('validated-cache');
      expect(mockCacheManager.validateCache).toHaveBeenCalledWith(
        mockEntityManager
      );
    });

    it('checks whether a cache exists for a given root', () => {
      service = createService();
      mockCacheManager.hasCacheForRoot.mockReturnValue(true);

      expect(service.hasCache('root-55')).toBe(true);
    });

    it('provides child identifiers from the cache', () => {
      service = createService();
      mockCacheManager.get
        .mockReturnValueOnce({ children: ['c-1', 'c-2'] })
        .mockReturnValueOnce(undefined);

      expect(service.getChildren('node-1')).toEqual(['c-1', 'c-2']);
      expect(service.getChildren('missing')).toEqual([]);
    });

    it('provides parent identifiers from the cache', () => {
      service = createService();
      mockCacheManager.get
        .mockReturnValueOnce({ parentId: 'parent-1' })
        .mockReturnValueOnce(undefined);

      expect(service.getParent('node-1')).toBe('parent-1');
      expect(service.getParent('missing')).toBeNull();
    });

    it('collects ancestors from nearest to farthest', () => {
      service = createService();
      mockCacheManager.get.mockImplementation((id) => {
        const mapping = {
          'leaf-1': { parentId: 'mid-1' },
          'mid-1': { parentId: 'root-1' },
          'root-1': { parentId: null },
        };
        return mapping[id];
      });

      expect(service.getAncestors('leaf-1')).toEqual(['mid-1', 'root-1']);
      expect(service.getAncestors('root-1')).toEqual([]);
    });

    it('derives descendants using AnatomyGraphAlgorithms.getSubgraph', () => {
      service = createService();
      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([
        'origin',
        'child-a',
        'child-b',
      ]);

      expect(service.getAllDescendants('origin')).toEqual(['child-a', 'child-b']);
      expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
        'origin',
        mockCacheManager
      );
    });
  });
});
