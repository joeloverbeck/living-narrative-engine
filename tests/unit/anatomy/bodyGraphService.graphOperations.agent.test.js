import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
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

describe('BodyGraphService graph operations', () => {
  let mockEntityManager;
  let mockLogger;
  let mockEventDispatcher;
  let mockCacheManager;
  let mockQueryCache;
  let service;

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

    service = new BodyGraphService({
      entityManager: mockEntityManager,
      logger: mockLogger,
      eventDispatcher: mockEventDispatcher,
    });
  });

  describe('detachPart', () => {
    it('throws when joint component is missing', async () => {
      mockEntityManager.getComponentData.mockReturnValueOnce(null);

      await expect(service.detachPart('part-1')).rejects.toThrow(
        new InvalidArgumentError(
          "Entity 'part-1' has no joint component - cannot detach"
        )
      );
    });

    it('removes joint and dispatches event with cascade disabled', async () => {
      mockEntityManager.getComponentData.mockReturnValueOnce({
        parentId: 'parent-1',
        socketId: 'socket-A',
      });
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-1');

      const result = await service.detachPart('part-9', {
        cascade: false,
        reason: 'auto-cleanup',
      });

      expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'part-9',
        'anatomy:joint'
      );
      expect(mockCacheManager.invalidateCacheForRoot).toHaveBeenCalledWith(
        'root-1'
      );
      expect(mockQueryCache.invalidateRoot).toHaveBeenCalledWith('root-1');
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        ANATOMY_CONSTANTS.LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedEntityId: 'part-9',
          parentEntityId: 'parent-1',
          socketId: 'socket-A',
          detachedCount: 1,
          reason: 'auto-cleanup',
        })
      );
      expect(result).toEqual({
        detached: ['part-9'],
        parentId: 'parent-1',
        socketId: 'socket-A',
      });
    });

    it('uses subgraph when cascade is enabled', async () => {
      mockEntityManager.getComponentData.mockReturnValueOnce({
        parentId: 'parent-2',
        socketId: 'socket-B',
      });
      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['part-2', 'child-1']);
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-2');

      await service.detachPart('part-2');

      expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
        'part-2',
        mockCacheManager
      );
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        ANATOMY_CONSTANTS.LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({ detachedCount: 2 })
      );
    });
  });

  describe('findPartsByType', () => {
    it('returns cached results when available', () => {
      mockQueryCache.getCachedFindPartsByType.mockReturnValueOnce(['cached']);

      const result = service.findPartsByType('root-X', 'hand');

      expect(result).toEqual(['cached']);
      expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();
    });

    it('computes and caches results when not cached', () => {
      AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['fresh']);

      const result = service.findPartsByType('root-Y', 'leg');

      expect(result).toEqual(['fresh']);
      expect(mockQueryCache.cacheFindPartsByType).toHaveBeenCalledWith(
        'root-Y',
        'leg',
        ['fresh']
      );
    });
  });

  describe('getAllParts', () => {
    it('returns empty array when no body component provided', () => {
      expect(service.getAllParts(null)).toEqual([]);
    });

    it('uses blueprint root when actor has no cache entry', () => {
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['root-part']);

      const parts = service.getAllParts(
        { body: { root: 'blue-root' } },
        'actor-1'
      );

      expect(mockQueryCache.cacheGetAllParts).toHaveBeenCalledWith(
        'blue-root',
        ['root-part']
      );
      expect(parts).toEqual(['root-part']);
    });

    it('prefers actor root when cached and returns cached query result', () => {
      mockCacheManager.has.mockReturnValue(true);
      mockQueryCache.getCachedGetAllParts
        .mockReturnValueOnce(['actor-cached'])
        .mockReturnValueOnce(undefined);

      const cached = service.getAllParts(
        { body: { root: 'blue-root' } },
        'actor-2'
      );
      expect(cached).toEqual(['actor-cached']);

      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['computed']);
      const computed = service.getAllParts({ root: 'direct-root' }, 'actor-2');

      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'actor-2',
        mockCacheManager,
        mockEntityManager
      );
      expect(mockQueryCache.cacheGetAllParts).toHaveBeenCalledWith('actor-2', [
        'computed',
      ]);
      expect(computed).toEqual(['computed']);
    });
  });

  describe('component lookups', () => {
    it('detects components, ignoring empty objects from mocks', () => {
      const getAllPartsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['part-1', 'part-2']);
      mockEntityManager.getComponentData
        .mockReturnValueOnce({})
        .mockReturnValueOnce({ useful: true });

      const found = service.hasPartWithComponent(
        { body: { root: 'root' } },
        'component:id'
      );

      expect(found).toBe(true);
      expect(getAllPartsSpy).toHaveBeenCalled();
    });

    it('matches nested component values through property path', () => {
      jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['part-10', 'part-11']);
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ nested: { target: 42 } })
        .mockReturnValueOnce({ nested: { target: 0 } });

      expect(
        service.hasPartWithComponentValue(
          { body: { root: 'root' } },
          'component:id',
          'nested.target',
          42
        )
      ).toEqual({ found: true, partId: 'part-10' });

      expect(
        service.hasPartWithComponentValue(
          { body: { root: 'root' } },
          'component:id',
          'nested.target',
          99
        )
      ).toEqual({ found: false });
    });
  });

  describe('getBodyGraph', () => {
    it('validates entity id and missing anatomy components', async () => {
      await expect(service.getBodyGraph('')).rejects.toThrow(
        InvalidArgumentError
      );
      await expect(service.getBodyGraph(123)).rejects.toThrow(
        InvalidArgumentError
      );

      mockEntityManager.getComponentData.mockReturnValueOnce(null);
      await expect(service.getBodyGraph('entity-1')).rejects.toThrow(
        new Error('Entity entity-1 has no anatomy:body component')
      );
    });

    it('returns helper methods tied to cache', async () => {
      mockEntityManager.getComponentData.mockReturnValue({
        body: { root: 'root-graph' },
      });
      mockCacheManager.get.mockReturnValue({ children: ['child-1'] });
      mockCacheManager.has.mockReturnValue(true);
      const parts = ['root-graph', 'child-1'];
      jest.spyOn(service, 'getAllParts').mockReturnValue(parts);

      const graph = await service.getBodyGraph('actor-graph');

      expect(mockCacheManager.buildCache).toHaveBeenCalledWith(
        'actor-graph',
        mockEntityManager
      );
      expect(graph.getAllPartIds()).toEqual(parts);
      expect(graph.getConnectedParts('root-graph')).toEqual(['child-1']);
    });
  });

  describe('getAnatomyData', () => {
    it('validates entity id and returns null for missing anatomy', async () => {
      await expect(service.getAnatomyData('')).rejects.toThrow(
        InvalidArgumentError
      );
      await expect(service.getAnatomyData({})).rejects.toThrow(
        InvalidArgumentError
      );

      mockEntityManager.getComponentData.mockReturnValueOnce(null);
      await expect(service.getAnatomyData('actor-5')).resolves.toBeNull();
    });

    it('returns recipe and root information', async () => {
      mockEntityManager.getComponentData.mockReturnValue({
        recipeId: 'recipe-9',
      });

      await expect(service.getAnatomyData('actor-6')).resolves.toEqual({
        recipeId: 'recipe-9',
        rootEntityId: 'actor-6',
      });
    });
  });

  describe('cache helpers', () => {
    it('exposes cache state and traversal helpers', () => {
      mockCacheManager.hasCacheForRoot.mockReturnValueOnce(true);
      mockCacheManager.get
        .mockReturnValueOnce({ children: ['c-1', 'c-2'] })
        .mockReturnValueOnce({ parentId: 'parent-9' })
        .mockReturnValueOnce({ parentId: 'parent-9' })
        .mockReturnValueOnce({ parentId: 'parent-8' })
        .mockReturnValueOnce(null);
      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([
        'entity-root',
        'descendant-1',
        'descendant-2',
      ]);

      expect(service.validateCache()).toBe(true);
      expect(service.hasCache('root-graph')).toBe(true);
      expect(service.getChildren('any')).toEqual(['c-1', 'c-2']);
      expect(service.getParent('any')).toBe('parent-9');
      expect(service.getAncestors('entity')).toEqual(['parent-9', 'parent-8']);
      expect(service.getAllDescendants('entity-root')).toEqual([
        'descendant-1',
        'descendant-2',
      ]);
    });
  });
});
