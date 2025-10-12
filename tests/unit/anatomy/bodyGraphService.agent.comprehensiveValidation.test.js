import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => {
  const mockCacheManagerInstance = {
    hasCacheForRoot: jest.fn(),
    buildCache: jest.fn(),
    invalidateCacheForRoot: jest.fn(),
    has: jest.fn(),
    size: jest.fn(),
    get: jest.fn(),
    validateCache: jest.fn(),
  };

  return {
    __esModule: true,
    AnatomyCacheManager: jest.fn(() => mockCacheManagerInstance),
    __mockCacheManagerInstance: mockCacheManagerInstance,
  };
});

jest.mock('../../../src/anatomy/anatomyGraphAlgorithms.js', () => {
  const mockAlgorithms = {
    getSubgraph: jest.fn(),
    findPartsByType: jest.fn(),
    getAllParts: jest.fn(),
    getAnatomyRoot: jest.fn(),
    getPath: jest.fn(),
  };

  return {
    __esModule: true,
    AnatomyGraphAlgorithms: mockAlgorithms,
    __mockAnatomyGraphAlgorithms: mockAlgorithms,
  };
});

import {
  BodyGraphService,
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import {
  AnatomyCacheManager,
  __mockCacheManagerInstance,
} from '../../../src/anatomy/anatomyCacheManager.js';
import { __mockAnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';

describe('BodyGraphService comprehensive coverage', () => {
  let entityManager;
  let logger;
  let eventDispatcher;
  let queryCache;
  let service;

  beforeEach(() => {
    jest.clearAllMocks();

    entityManager = {
      getComponentData: jest.fn(),
      removeComponent: jest.fn(),
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

    queryCache = {
      getCachedFindPartsByType: jest.fn(),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn(),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };

    __mockCacheManagerInstance.hasCacheForRoot.mockReturnValue(false);
    __mockCacheManagerInstance.has.mockReturnValue(false);
    __mockCacheManagerInstance.size.mockReturnValue(0);
    __mockCacheManagerInstance.get.mockReturnValue(undefined);
    __mockCacheManagerInstance.validateCache.mockReturnValue('validated');

    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
      queryCache,
    });
  });

  describe('constructor validation', () => {
    it('requires entityManager', () => {
      expect(
        () =>
          new BodyGraphService({
            logger,
            eventDispatcher,
            queryCache,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('requires logger', () => {
      expect(
        () =>
          new BodyGraphService({
            entityManager,
            eventDispatcher,
            queryCache,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('requires eventDispatcher', () => {
      expect(
        () =>
          new BodyGraphService({
            entityManager,
            logger,
            queryCache,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('creates cache manager instance', () => {
      expect(AnatomyCacheManager).toHaveBeenCalledWith({ logger });
    });
  });

  describe('buildAdjacencyCache', () => {
    it('builds cache when none exists', async () => {
      __mockCacheManagerInstance.hasCacheForRoot.mockReturnValueOnce(false);

      await service.buildAdjacencyCache('root-1');

      expect(__mockCacheManagerInstance.buildCache).toHaveBeenCalledWith(
        'root-1',
        entityManager
      );
    });

    it('skips building when cache already exists', async () => {
      __mockCacheManagerInstance.hasCacheForRoot.mockReturnValue(true);

      await service.buildAdjacencyCache('root-2');

      expect(__mockCacheManagerInstance.buildCache).not.toHaveBeenCalled();
    });
  });

  describe('detachPart', () => {
    beforeEach(() => {
      __mockAnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-entity');
      __mockCacheManagerInstance.invalidateCacheForRoot.mockClear();
      queryCache.invalidateRoot.mockClear();
      entityManager.removeComponent.mockResolvedValue(undefined);
      jest.spyOn(Date, 'now').mockReturnValue(1234567890);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('detaches with cascade and invalidates caches', async () => {
      __mockAnatomyGraphAlgorithms.getSubgraph.mockReturnValue([
        'part-1',
        'child-1',
      ]);

      entityManager.getComponentData.mockImplementation((entityId, component) => {
        if (component === 'anatomy:joint') {
          return { parentId: 'parent-1', socketId: 'socket-42' };
        }
        return null;
      });

      const result = await service.detachPart('part-1', {
        cascade: true,
        reason: 'injury',
      });

      expect(entityManager.removeComponent).toHaveBeenCalledWith(
        'part-1',
        'anatomy:joint'
      );
      expect(__mockCacheManagerInstance.invalidateCacheForRoot).toHaveBeenCalledWith(
        'root-entity'
      );
      expect(queryCache.invalidateRoot).toHaveBeenCalledWith('root-entity');
      expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedEntityId: 'part-1',
          parentEntityId: 'parent-1',
          socketId: 'socket-42',
          detachedCount: 2,
          reason: 'injury',
          timestamp: 1234567890,
        })
      );
      expect(result).toEqual({
        detached: ['part-1', 'child-1'],
        parentId: 'parent-1',
        socketId: 'socket-42',
      });
      expect(__mockAnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
        'part-1',
        __mockCacheManagerInstance
      );
    });

    it('detaches single part when cascade disabled', async () => {
      __mockAnatomyGraphAlgorithms.getSubgraph.mockClear();

      entityManager.getComponentData.mockReturnValue({
        parentId: 'parent-x',
        socketId: 'socket-x',
      });

      const result = await service.detachPart('part-2', { cascade: false });

      expect(__mockAnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
      expect(result.detached).toEqual(['part-2']);
      expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({ detachedCount: 1 })
      );
    });

    it('throws when joint component missing', async () => {
      entityManager.getComponentData.mockReturnValue(null);

      await expect(service.detachPart('missing')).rejects.toThrow(
        InvalidArgumentError
      );
    });
  });

  describe('findPartsByType', () => {
    it('returns cached result when available', () => {
      queryCache.getCachedFindPartsByType.mockReturnValue(['cached']);

      const result = service.findPartsByType('root-1', 'arm');

      expect(result).toEqual(['cached']);
      expect(__mockAnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();
    });

    it('delegates to algorithms and caches when no cache entry', () => {
      queryCache.getCachedFindPartsByType.mockReturnValue(undefined);
      __mockAnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['arm-1']);

      const result = service.findPartsByType('root-2', 'arm');

      expect(__mockAnatomyGraphAlgorithms.findPartsByType).toHaveBeenCalledWith(
        'root-2',
        'arm',
        __mockCacheManagerInstance
      );
      expect(queryCache.cacheFindPartsByType).toHaveBeenCalledWith(
        'root-2',
        'arm',
        ['arm-1']
      );
      expect(result).toEqual(['arm-1']);
    });
  });

  describe('graph traversal helpers', () => {
    it('returns anatomy root via algorithms', () => {
      __mockAnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-77');

      expect(service.getAnatomyRoot('part-x')).toBe('root-77');
      expect(__mockAnatomyGraphAlgorithms.getAnatomyRoot).toHaveBeenCalledWith(
        'part-x',
        __mockCacheManagerInstance,
        entityManager
      );
    });

    it('returns path via algorithms', () => {
      __mockAnatomyGraphAlgorithms.getPath.mockReturnValue(['a', 'b']);

      expect(service.getPath('a', 'b')).toEqual(['a', 'b']);
      expect(__mockAnatomyGraphAlgorithms.getPath).toHaveBeenCalledWith(
        'a',
        'b',
        __mockCacheManagerInstance
      );
    });
  });

  describe('getAllParts', () => {
    it('returns empty array when component missing', () => {
      expect(service.getAllParts(null)).toEqual([]);
      expect(logger.debug).toHaveBeenCalled();
    });

    it('returns cached query when present', () => {
      queryCache.getCachedGetAllParts.mockReturnValue(['cached-1']);
      __mockCacheManagerInstance.has.mockReturnValue(true);

      const result = service.getAllParts(
        { body: { root: 'root-a' } },
        'actor-1'
      );

      expect(result).toEqual(['cached-1']);
      expect(queryCache.cacheGetAllParts).not.toHaveBeenCalled();
    });

    it('computes parts and caches results', () => {
      queryCache.getCachedGetAllParts.mockReturnValue(undefined);
      __mockCacheManagerInstance.has.mockImplementation((id) => id === 'actor-2');
      __mockCacheManagerInstance.size.mockReturnValue(3);
      __mockAnatomyGraphAlgorithms.getAllParts.mockReturnValue([
        'actor-2',
        'child-1',
      ]);

      const result = service.getAllParts(
        { body: { root: 'root-b' } },
        'actor-2'
      );

      expect(__mockAnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'actor-2',
        __mockCacheManagerInstance,
        entityManager
      );
      expect(queryCache.cacheGetAllParts).toHaveBeenCalledWith('actor-2', [
        'actor-2',
        'child-1',
      ]);
      expect(result).toEqual(['actor-2', 'child-1']);
    });

    it('falls back to blueprint root when actor not cached', () => {
      queryCache.getCachedGetAllParts.mockReturnValue(undefined);
      __mockCacheManagerInstance.has.mockReturnValue(false);
      __mockCacheManagerInstance.size.mockReturnValue(1);
      __mockAnatomyGraphAlgorithms.getAllParts.mockReturnValue(['root-c']);

      const result = service.getAllParts({ root: 'root-c' }, 'actor-missing');

      expect(__mockAnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'root-c',
        __mockCacheManagerInstance,
        entityManager
      );
      expect(result).toEqual(['root-c']);
    });

    it('handles missing root identifiers gracefully', () => {
      const parts = service.getAllParts({ body: {} }, 'actor-3');
      expect(parts).toEqual([]);
    });
  });

  describe('component queries', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('detects component presence across parts', () => {
      jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['p1', 'p2', 'p3']);
      entityManager.getComponentData.mockImplementation((id, component) => {
        if (id === 'p2' && component === 'target:component') {
          return { value: true };
        }
        if (id === 'p3') {
          return {};
        }
        return null;
      });

      const hasComponent = service.hasPartWithComponent(
        {},
        'target:component'
      );

      expect(hasComponent).toBe(true);
    });

    it('finds component value via nested path', () => {
      jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['part-1', 'part-2']);
      entityManager.getComponentData.mockImplementation((id) => {
        if (id === 'part-1') {
          return { stats: { health: 10 } };
        }
        if (id === 'part-2') {
          return { stats: { health: 5 } };
        }
        return null;
      });

      const result = service.hasPartWithComponentValue(
        {},
        'anatomy:stats',
        'stats.health',
        5
      );

      expect(result).toEqual({ found: true, partId: 'part-2' });
    });

    it('returns not found when value absent', () => {
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-3']);
      entityManager.getComponentData.mockReturnValue({ stats: { health: 1 } });

      const result = service.hasPartWithComponentValue(
        {},
        'anatomy:stats',
        'stats.health',
        99
      );

      expect(result).toEqual({ found: false });
    });
  });

  describe('getBodyGraph', () => {
    it('validates entity identifier', async () => {
      await expect(service.getBodyGraph(null)).rejects.toThrow(
        InvalidArgumentError
      );
    });

    it('requires anatomy body component', async () => {
      entityManager.getComponentData.mockResolvedValue(null);

      await expect(service.getBodyGraph('actor-x')).rejects.toThrow(
        'has no anatomy:body component'
      );
    });

    it('returns graph utilities when component present', async () => {
      __mockAnatomyGraphAlgorithms.getAllParts.mockReturnValue(['root', 'child']);
      __mockCacheManagerInstance.has.mockImplementation(
        (id) => id === 'actor-graph'
      );
      __mockCacheManagerInstance.get.mockImplementation((id) => {
        if (id === 'child') {
          return { children: ['leaf-1'] };
        }
        return { children: [] };
      });
      entityManager.getComponentData.mockResolvedValue({
        body: { root: 'blueprint-root' },
      });

      const graph = await service.getBodyGraph('actor-graph');
      const parts = graph.getAllPartIds();
      const connected = graph.getConnectedParts('child');

      expect(parts).toEqual(['root', 'child']);
      expect(connected).toEqual(['leaf-1']);
      expect(__mockAnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'actor-graph',
        __mockCacheManagerInstance,
        entityManager
      );
    });
  });

  describe('getAnatomyData', () => {
    it('validates entity identifier', async () => {
      await expect(service.getAnatomyData('')).rejects.toThrow(
        InvalidArgumentError
      );
    });

    it('returns null when component missing', async () => {
      entityManager.getComponentData.mockResolvedValue(null);

      const result = await service.getAnatomyData('actor-y');

      expect(result).toBeNull();
    });

    it('returns recipe and root identifiers', async () => {
      entityManager.getComponentData.mockResolvedValue({ recipeId: 'recipe-1' });

      const result = await service.getAnatomyData('actor-z');

      expect(result).toEqual({ recipeId: 'recipe-1', rootEntityId: 'actor-z' });
    });
  });

  describe('cache utilities', () => {
    it('validates cache state', () => {
      expect(service.validateCache()).toBe('validated');
      expect(__mockCacheManagerInstance.validateCache).toHaveBeenCalledWith(
        entityManager
      );
    });

    it('reports cache existence', () => {
      __mockCacheManagerInstance.hasCacheForRoot.mockReturnValue(true);

      expect(service.hasCache('root-9')).toBe(true);
    });

    it('reads children from cache', () => {
      __mockCacheManagerInstance.get.mockReturnValue({ children: ['child-9'] });

      expect(service.getChildren('node-1')).toEqual(['child-9']);
    });

    it('reads parent from cache', () => {
      __mockCacheManagerInstance.get.mockReturnValue({ parentId: 'parent-9' });

      expect(service.getParent('node-2')).toBe('parent-9');
    });

    it('collects ancestors through parent chain', () => {
      __mockCacheManagerInstance.get.mockImplementation((id) => {
        if (id === 'leaf') return { parentId: 'branch' };
        if (id === 'branch') return { parentId: 'root' };
        if (id === 'root') return { parentId: null };
        return null;
      });

      expect(service.getAncestors('leaf')).toEqual(['branch', 'root']);
    });

    it('returns all descendants using algorithms helper', () => {
      __mockAnatomyGraphAlgorithms.getSubgraph.mockReturnValue([
        'self',
        'child-a',
      ]);

      expect(service.getAllDescendants('self')).toEqual(['child-a']);
      expect(__mockAnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
        'self',
        __mockCacheManagerInstance
      );
    });
  });
});
