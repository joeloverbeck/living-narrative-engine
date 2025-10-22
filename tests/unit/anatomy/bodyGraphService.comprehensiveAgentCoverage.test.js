import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

let mockCacheInstance;
let mockQueryCacheInstance;

const createMockCacheInstance = () => ({
  hasCacheForRoot: jest.fn(),
  buildCache: jest.fn().mockResolvedValue(undefined),
  invalidateCacheForRoot: jest.fn(),
  has: jest.fn(),
  get: jest.fn(),
  size: jest.fn(),
  validateCache: jest.fn(),
});

const createMockQueryCacheInstance = () => ({
  getCachedFindPartsByType: jest.fn(),
  cacheFindPartsByType: jest.fn(),
  getCachedGetAllParts: jest.fn(),
  cacheGetAllParts: jest.fn(),
  invalidateRoot: jest.fn(),
});

var mockGraphAlgorithms = {};

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => ({
  AnatomyCacheManager: jest.fn(() => mockCacheInstance),
}));

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => ({
  AnatomyQueryCache: jest.fn(() => mockQueryCacheInstance),
}));

jest.mock('../../../src/anatomy/anatomyGraphAlgorithms.js', () => {
  mockGraphAlgorithms = {
    getSubgraph: jest.fn(),
    findPartsByType: jest.fn(),
    getAllParts: jest.fn(),
    getAnatomyRoot: jest.fn(),
    getPath: jest.fn(),
  };

  return {
    AnatomyGraphAlgorithms: mockGraphAlgorithms,
  };
});

import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { BodyGraphService, LIMB_DETACHED_EVENT_ID } from '../../../src/anatomy/bodyGraphService.js';

describe('BodyGraphService near-total coverage suite', () => {
  let entityManager;
  let logger;
  let eventDispatcher;

  const resetMocks = () => {
    mockCacheInstance = createMockCacheInstance();
    AnatomyCacheManager.mockImplementation(() => mockCacheInstance);

    mockQueryCacheInstance = createMockQueryCacheInstance();
    AnatomyQueryCache.mockImplementation(() => mockQueryCacheInstance);

    Object.values(mockGraphAlgorithms).forEach((fn) => fn.mockReset());
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetMocks();

    entityManager = {
      getComponentData: jest.fn(),
      removeComponent: jest.fn().mockResolvedValue(undefined),
    };

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    eventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };
  });

  describe('constructor validation and defaults', () => {
    it('requires entity manager, logger, and event dispatcher', () => {
      expect(() => new BodyGraphService({ logger, eventDispatcher })).toThrow(
        new InvalidArgumentError('entityManager is required'),
      );
      expect(() => new BodyGraphService({ entityManager, eventDispatcher })).toThrow(
        new InvalidArgumentError('logger is required'),
      );
      expect(() => new BodyGraphService({ entityManager, logger })).toThrow(
        new InvalidArgumentError('eventDispatcher is required'),
      );
    });

    it('creates cache managers when not provided and accepts injected query cache', () => {
      const customQueryCache = createMockQueryCacheInstance();
      const service = new BodyGraphService({
        entityManager,
        logger,
        eventDispatcher,
        queryCache: customQueryCache,
      });

      expect(AnatomyCacheManager).toHaveBeenCalledWith({ logger });
      expect(AnatomyQueryCache).not.toHaveBeenCalled();

      expect(service).toBeInstanceOf(BodyGraphService);
    });

    it('uses default query cache when none supplied', () => {
      // eslint-disable-next-line no-new
      new BodyGraphService({ entityManager, logger, eventDispatcher });

      expect(AnatomyQueryCache).toHaveBeenCalledWith({ logger });
    });
  });

  describe('instance behaviour', () => {
    let service;

    beforeEach(() => {
      service = new BodyGraphService({ entityManager, logger, eventDispatcher });
    });

    it('builds adjacency cache only when missing', async () => {
      mockCacheInstance.hasCacheForRoot.mockReturnValueOnce(false);

      await service.buildAdjacencyCache('root-1');

      expect(mockCacheInstance.buildCache).toHaveBeenCalledWith('root-1', entityManager);

      mockCacheInstance.hasCacheForRoot.mockReturnValueOnce(true);

      await service.buildAdjacencyCache('root-1');

      expect(mockCacheInstance.buildCache).toHaveBeenCalledTimes(1);
    });

    it('throws when detaching a part without joint data', async () => {
      entityManager.getComponentData.mockReturnValueOnce(null);

      await expect(service.detachPart('no-joint')).rejects.toThrow(
        new InvalidArgumentError("Entity 'no-joint' has no joint component - cannot detach"),
      );
    });

    it('detaches part with cascade and invalidates caches', async () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(111);
      entityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === 'anatomy:joint') {
          return { parentId: 'parent-1', socketId: 'socket-7' };
        }
        return null;
      });

      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['part-1', 'child-1']);
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-9');

      const result = await service.detachPart('part-1');

      expect(entityManager.removeComponent).toHaveBeenCalledWith('part-1', 'anatomy:joint');
      expect(mockCacheInstance.invalidateCacheForRoot).toHaveBeenCalledWith('root-9');
      expect(mockQueryCacheInstance.invalidateRoot).toHaveBeenCalledWith('root-9');
      expect(eventDispatcher.dispatch).toHaveBeenCalledWith(LIMB_DETACHED_EVENT_ID, {
        detachedEntityId: 'part-1',
        parentEntityId: 'parent-1',
        socketId: 'socket-7',
        detachedCount: 2,
        reason: 'manual',
        timestamp: 111,
      });
      expect(logger.info).toHaveBeenCalledWith(
        "BodyGraphService: Detached 2 entities from parent 'parent-1'",
      );
      expect(result).toEqual({ detached: ['part-1', 'child-1'], parentId: 'parent-1', socketId: 'socket-7' });

      nowSpy.mockRestore();
    });

    it('detaches part without cascade and skips invalidation when no root found', async () => {
      entityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === 'anatomy:joint') {
          return { parentId: 'parent-2', socketId: 'socket-3' };
        }
        return null;
      });

      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['part-2', 'child']);
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue(null);

      const result = await service.detachPart('part-2', { cascade: false, reason: 'auto' });

      expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
      expect(mockCacheInstance.invalidateCacheForRoot).not.toHaveBeenCalled();
      expect(mockQueryCacheInstance.invalidateRoot).not.toHaveBeenCalled();
      expect(result).toEqual({ detached: ['part-2'], parentId: 'parent-2', socketId: 'socket-3' });
    });

    it('finds parts by type using cache and algorithms', () => {
      mockQueryCacheInstance.getCachedFindPartsByType.mockReturnValueOnce(['cached']);

      expect(service.findPartsByType('root-1', 'typeA')).toEqual(['cached']);
      expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();

      mockQueryCacheInstance.getCachedFindPartsByType.mockReturnValueOnce(undefined);
      AnatomyGraphAlgorithms.findPartsByType.mockReturnValueOnce(['fresh']);

      expect(service.findPartsByType('root-1', 'typeA')).toEqual(['fresh']);
      expect(mockQueryCacheInstance.cacheFindPartsByType).toHaveBeenCalledWith('root-1', 'typeA', ['fresh']);
    });

    it('delegates to graph algorithms for root and path queries', () => {
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-x');
      AnatomyGraphAlgorithms.getPath.mockReturnValue(['a', 'b']);

      expect(service.getAnatomyRoot('part-3')).toBe('root-x');
      expect(service.getPath('from', 'to')).toEqual(['a', 'b']);
    });

    describe('getAllParts variations', () => {
      it('returns empty array when body component is missing', () => {
        expect(service.getAllParts(null)).toEqual([]);
        expect(logger.debug).toHaveBeenCalledWith(
          'BodyGraphService.getAllParts: No bodyComponent provided',
        );
      });

      it('returns empty array when no root information exists', () => {
        expect(service.getAllParts({})).toEqual([]);
        expect(logger.debug).toHaveBeenCalledWith(
          'BodyGraphService.getAllParts: No root ID found in bodyComponent',
        );
      });

      it('uses blueprint root when actor not cached and caches result', () => {
        const bodyComponent = { body: { root: 'root-blueprint' } };
        mockCacheInstance.has.mockReturnValue(false);
        mockCacheInstance.size.mockReturnValue(0);
        mockQueryCacheInstance.getCachedGetAllParts.mockReturnValueOnce(undefined);
        AnatomyGraphAlgorithms.getAllParts.mockReturnValueOnce(['root-blueprint', 'child-a']);

        const parts = service.getAllParts(bodyComponent, 'actor-1');

        expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
          'root-blueprint',
          mockCacheInstance,
          entityManager,
        );
        expect(mockQueryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith('root-blueprint', parts);
        expect(parts).toEqual(['root-blueprint', 'child-a']);
      });

      it('uses actor entity ID as cache root when cached', () => {
        const bodyComponent = { body: { root: 'root-blueprint' } };
        mockCacheInstance.has.mockReturnValue(true);
        mockQueryCacheInstance.getCachedGetAllParts.mockReturnValueOnce(undefined);
        AnatomyGraphAlgorithms.getAllParts.mockReturnValueOnce(['actor-1', 'child']);

        const parts = service.getAllParts(bodyComponent, 'actor-1');

        expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
          'actor-1',
          mockCacheInstance,
          entityManager,
        );
        expect(mockQueryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith('actor-1', parts);
      });

      it('logs truncated previews when many parts are returned', () => {
        const bodyComponent = { body: { root: 'root-blueprint' } };
        const longResult = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

        mockCacheInstance.has.mockReturnValue(false);
        mockCacheInstance.size.mockReturnValue(3);
        mockQueryCacheInstance.getCachedGetAllParts.mockReturnValueOnce(undefined);
        AnatomyGraphAlgorithms.getAllParts.mockReturnValueOnce(longResult);

        const parts = service.getAllParts(bodyComponent);

        expect(parts).toEqual(longResult);
        const message = logger.debug.mock.calls
          .map(([msg]) => msg)
          .find((msg) =>
            typeof msg === 'string' &&
            msg.includes('BodyGraphService: AnatomyGraphAlgorithms.getAllParts returned'),
          );
        expect(message).toBeDefined();
        expect(message).toContain('...');
        expect(mockQueryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith('root-blueprint', longResult);
      });

      it('returns cached results without recomputing', () => {
        const bodyComponent = { root: 'root-direct' };
        mockQueryCacheInstance.getCachedGetAllParts.mockReturnValueOnce(['cached1', 'cached2']);

        const parts = service.getAllParts(bodyComponent);

        expect(parts).toEqual(['cached1', 'cached2']);
        expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
      });
    });

    it('checks for parts with a component', () => {
      const spy = jest.spyOn(service, 'getAllParts').mockReturnValue(['part-a', 'part-b', 'part-c']);
      entityManager.getComponentData
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({})
        .mockReturnValueOnce({ present: true });

      expect(service.hasPartWithComponent({ body: { root: 'root' } }, 'component:x')).toBe(true);
      expect(spy).toHaveBeenCalled();
    });

    it('returns false when component data absent across parts', () => {
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-a', 'part-b']);
      entityManager.getComponentData.mockReturnValue(null);

      expect(service.hasPartWithComponent({ body: { root: 'root' } }, 'component:x')).toBe(false);
    });

    it('finds parts with nested component values', () => {
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-a', 'part-b']);
      entityManager.getComponentData
        .mockReturnValueOnce({ stats: { hp: 10 } })
        .mockReturnValueOnce({ stats: { hp: 15 } });

      expect(
        service.hasPartWithComponentValue({ body: { root: 'root' } }, 'component:x', 'stats.hp', 15),
      ).toEqual({ found: true, partId: 'part-b' });
    });

    it('returns not found when nested value differs', () => {
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-a']);
      entityManager.getComponentData.mockReturnValue({ stats: { hp: 10 } });

      expect(
        service.hasPartWithComponentValue({ body: { root: 'root' } }, 'component:x', 'stats.hp', 20),
      ).toEqual({ found: false });
    });

    it('returns not found when nested property path is missing', () => {
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-a', 'part-b']);
      entityManager.getComponentData
        .mockReturnValueOnce({ stats: {} })
        .mockReturnValueOnce({});

      expect(
        service.hasPartWithComponentValue({ body: { root: 'root' } }, 'component:x', 'stats.hp', 10),
      ).toEqual({ found: false });
    });

    it('handles null component data when checking nested values', () => {
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-null']);
      entityManager.getComponentData.mockReturnValue(null);

      expect(
        service.hasPartWithComponentValue(
          { body: { root: 'root' } },
          'component:x',
          'stats.hp',
          10,
        ),
      ).toEqual({ found: false });
      expect(entityManager.getComponentData).toHaveBeenCalledWith('part-null', 'component:x');
    });

    describe('getBodyGraph', () => {
      it('validates entity identifier and component presence', async () => {
        await expect(service.getBodyGraph('')).rejects.toThrow(
          new InvalidArgumentError('Entity ID is required and must be a string'),
        );

        entityManager.getComponentData.mockResolvedValueOnce(null);

        await expect(service.getBodyGraph('entity-1')).rejects.toThrow(
          new Error('Entity entity-1 has no anatomy:body component'),
        );
      });

      it('returns graph helpers using caches', async () => {
        entityManager.getComponentData.mockImplementation(async (entityId, componentId) => {
          if (componentId === 'anatomy:body') {
            return { body: { root: 'root-100' } };
          }
          return null;
        });
        const buildSpy = jest.spyOn(service, 'buildAdjacencyCache').mockResolvedValue(undefined);
        const getAllPartsSpy = jest.spyOn(service, 'getAllParts').mockReturnValue(['a', 'b']);
        mockCacheInstance.get.mockReturnValue({ children: ['child-1'] });

        const graph = await service.getBodyGraph('entity-2');

        expect(buildSpy).toHaveBeenCalledWith('entity-2');
        expect(graph.getAllPartIds()).toEqual(['a', 'b']);
        expect(getAllPartsSpy).toHaveBeenCalledWith({ body: { root: 'root-100' } }, 'entity-2');
        expect(graph.getConnectedParts('part-z')).toEqual(['child-1']);
      });

      it('returns empty connected parts when cache lacks node entry', async () => {
        entityManager.getComponentData.mockResolvedValueOnce({ body: { root: 'root-200' } });
        jest.spyOn(service, 'buildAdjacencyCache').mockResolvedValue(undefined);
        jest.spyOn(service, 'getAllParts').mockReturnValue(['root-200']);
        mockCacheInstance.get.mockReturnValue(undefined);

        const graph = await service.getBodyGraph('entity-missing');

        expect(graph.getConnectedParts('unknown-node')).toEqual([]);
      });
    });

    describe('getAnatomyData', () => {
      it('validates entity identifier and returns null when missing', async () => {
        await expect(service.getAnatomyData('')).rejects.toThrow(
          new InvalidArgumentError('Entity ID is required and must be a string'),
        );

        entityManager.getComponentData.mockResolvedValueOnce(null);

        await expect(service.getAnatomyData('entity-3')).resolves.toBeNull();
        expect(logger.debug).toHaveBeenCalledWith(
          "BodyGraphService.getAnatomyData: Entity 'entity-3' has no anatomy:body component",
        );
      });

      it('returns recipe and root data when component exists', async () => {
        entityManager.getComponentData.mockResolvedValueOnce({ recipeId: 'recipe-1' });

        await expect(service.getAnatomyData('entity-4')).resolves.toEqual({
          recipeId: 'recipe-1',
          rootEntityId: 'entity-4',
        });
      });

      it('normalizes missing recipe identifiers to null', async () => {
        entityManager.getComponentData.mockResolvedValueOnce({});

        await expect(service.getAnatomyData('entity-5')).resolves.toEqual({
          recipeId: null,
          rootEntityId: 'entity-5',
        });
      });
    });

    it('validates and delegates cache helpers', () => {
      mockCacheInstance.validateCache.mockReturnValue(true);
      mockCacheInstance.hasCacheForRoot.mockReturnValue(true);
      mockCacheInstance.get.mockReturnValue({ children: ['child-1'], parentId: 'parent-1' });

      expect(service.validateCache()).toBe(true);
      expect(service.hasCache('root-1')).toBe(true);
      expect(service.getChildren('node-1')).toEqual(['child-1']);
      expect(service.getParent('node-1')).toBe('parent-1');
    });

    it('returns empty arrays for children when cache has no entry', () => {
      mockCacheInstance.get.mockReturnValue(undefined);

      expect(service.getChildren('missing-node')).toEqual([]);
    });

    it('calculates ancestors from cache entries', () => {
      const nodes = new Map([
        ['node-3', { parentId: 'node-2' }],
        ['node-2', { parentId: 'node-1' }],
        ['node-1', { parentId: null }],
      ]);
      mockCacheInstance.get.mockImplementation((id) => nodes.get(id));

      expect(service.getAncestors('node-3')).toEqual(['node-2', 'node-1']);
    });

    it('collects descendants excluding the starting entity', () => {
      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['node-1', 'node-2', 'node-3']);

      expect(service.getAllDescendants('node-1')).toEqual(['node-2', 'node-3']);
    });
  });
});
