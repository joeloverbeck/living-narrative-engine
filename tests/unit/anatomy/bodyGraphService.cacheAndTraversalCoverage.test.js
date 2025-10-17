/**
 * @file Focused coverage tests for BodyGraphService traversal and cache interactions
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ANATOMY_CONSTANTS } from '../../../src/anatomy/constants/anatomyConstants.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';

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

describe('BodyGraphService cache & traversal coverage', () => {
  /** @type {ReturnType<typeof createCacheManagerMock>} */
  let cacheManagerMock;
  /** @type {ReturnType<typeof createQueryCacheMock>} */
  let queryCacheMock;
  /** @type {{getComponentData: jest.Mock, removeComponent: jest.Mock}} */
  let entityManagerMock;
  /** @type {{debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock}} */
  let loggerMock;
  /** @type {{dispatch: jest.Mock}} */
  let eventDispatcherMock;
  /** @type {BodyGraphService} */
  let service;

  const createCacheManagerMock = () => ({
    hasCacheForRoot: jest.fn(),
    buildCache: jest.fn(),
    has: jest.fn(),
    get: jest.fn(),
    size: jest.fn(),
    invalidateCacheForRoot: jest.fn(),
    validateCache: jest.fn(),
  });

  const createQueryCacheMock = () => ({
    getCachedFindPartsByType: jest.fn(),
    cacheFindPartsByType: jest.fn(),
    getCachedGetAllParts: jest.fn(),
    cacheGetAllParts: jest.fn(),
    invalidateRoot: jest.fn(),
  });

  beforeEach(() => {
    cacheManagerMock = createCacheManagerMock();
    queryCacheMock = createQueryCacheMock();

    AnatomyCacheManager.mockImplementation(() => cacheManagerMock);
    AnatomyQueryCache.mockImplementation(() => queryCacheMock);

    AnatomyGraphAlgorithms.getSubgraph.mockReset();
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReset();
    AnatomyGraphAlgorithms.getPath.mockReset();
    AnatomyGraphAlgorithms.getAllParts.mockReset();
    AnatomyGraphAlgorithms.findPartsByType.mockReset();

    entityManagerMock = {
      getComponentData: jest.fn(),
      removeComponent: jest.fn(),
    };

    loggerMock = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    eventDispatcherMock = {
      dispatch: jest.fn(),
    };

    service = new BodyGraphService({
      entityManager: entityManagerMock,
      logger: loggerMock,
      eventDispatcher: eventDispatcherMock,
      queryCache: queryCacheMock,
    });
  });

  describe('constructor validation', () => {
    it('requires an entity manager', () => {
      expect(
        () =>
          new BodyGraphService({
            logger: loggerMock,
            eventDispatcher: eventDispatcherMock,
            queryCache: queryCacheMock,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('requires a logger', () => {
      expect(
        () =>
          new BodyGraphService({
            entityManager: entityManagerMock,
            eventDispatcher: eventDispatcherMock,
            queryCache: queryCacheMock,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('requires an event dispatcher', () => {
      expect(
        () =>
          new BodyGraphService({
            entityManager: entityManagerMock,
            logger: loggerMock,
            queryCache: queryCacheMock,
          })
      ).toThrow(InvalidArgumentError);
    });
  });

  describe('buildAdjacencyCache', () => {
    it('builds cache when no cache exists for root', async () => {
      cacheManagerMock.hasCacheForRoot.mockReturnValue(false);

      await service.buildAdjacencyCache('root-1');

      expect(cacheManagerMock.buildCache).toHaveBeenCalledWith(
        'root-1',
        entityManagerMock
      );
    });

    it('skips build when cache already exists for root', async () => {
      cacheManagerMock.hasCacheForRoot.mockReturnValue(true);

      await service.buildAdjacencyCache('root-2');

      expect(cacheManagerMock.buildCache).not.toHaveBeenCalled();
    });
  });

  describe('detachPart', () => {
    it('detaches with cascade, invalidates caches, and dispatches event', async () => {
      const jointData = { parentId: 'parent-1', socketId: 'socket-99' };
      entityManagerMock.getComponentData.mockReturnValueOnce(jointData);
      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([
        'part-1',
        'child-1',
      ]);
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-entity');

      const result = await service.detachPart('part-1', {
        cascade: true,
        reason: 'test-case',
      });

      expect(entityManagerMock.removeComponent).toHaveBeenCalledWith(
        'part-1',
        'anatomy:joint'
      );
      expect(cacheManagerMock.invalidateCacheForRoot).toHaveBeenCalledWith(
        'root-entity'
      );
      expect(queryCacheMock.invalidateRoot).toHaveBeenCalledWith('root-entity');
      expect(eventDispatcherMock.dispatch).toHaveBeenCalledWith(
        ANATOMY_CONSTANTS.LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedEntityId: 'part-1',
          parentEntityId: 'parent-1',
          socketId: 'socket-99',
          detachedCount: 2,
          reason: 'test-case',
          timestamp: expect.any(Number),
        })
      );
      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining("Detached 2 entities from parent 'parent-1'")
      );
      expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
        'part-1',
        cacheManagerMock
      );
      expect(result).toEqual({
        detached: ['part-1', 'child-1'],
        parentId: 'parent-1',
        socketId: 'socket-99',
      });
    });

    it('supports non-cascade detachment and omits cache invalidation when no root', async () => {
      const jointData = { parentId: 'parent-2', socketId: 'socket-1' };
      entityManagerMock.getComponentData.mockReturnValueOnce(jointData);
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue(null);

      const result = await service.detachPart('leaf-1', { cascade: false });

      expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
      expect(cacheManagerMock.invalidateCacheForRoot).not.toHaveBeenCalled();
      expect(queryCacheMock.invalidateRoot).not.toHaveBeenCalled();
      expect(result).toEqual({
        detached: ['leaf-1'],
        parentId: 'parent-2',
        socketId: 'socket-1',
      });
    });

    it('throws when the entity lacks a joint component', async () => {
      entityManagerMock.getComponentData.mockReturnValueOnce(null);

      await expect(service.detachPart('missing-joint')).rejects.toThrow(
        InvalidArgumentError
      );
      expect(entityManagerMock.removeComponent).not.toHaveBeenCalled();
    });
  });

  describe('findPartsByType', () => {
    it('returns cached results when available', () => {
      queryCacheMock.getCachedFindPartsByType.mockReturnValue(['cached-1']);

      const result = service.findPartsByType('root-1', 'hand');

      expect(result).toEqual(['cached-1']);
      expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();
    });

    it('queries algorithms when cache misses and stores result', () => {
      queryCacheMock.getCachedFindPartsByType.mockReturnValue(undefined);
      AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['arm-1']);

      const result = service.findPartsByType('root-2', 'arm');

      expect(AnatomyGraphAlgorithms.findPartsByType).toHaveBeenCalledWith(
        'root-2',
        'arm',
        cacheManagerMock
      );
      expect(queryCacheMock.cacheFindPartsByType).toHaveBeenCalledWith(
        'root-2',
        'arm',
        ['arm-1']
      );
      expect(result).toEqual(['arm-1']);
    });
  });

  describe('getAllParts caching pathways', () => {
    it('returns empty array when no body component provided', () => {
      const result = service.getAllParts(undefined);

      expect(result).toEqual([]);
      expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
    });

    it('uses blueprint root when actor is absent from cache', () => {
      cacheManagerMock.has.mockReturnValue(false);
      cacheManagerMock.size.mockReturnValue(0);
      queryCacheMock.getCachedGetAllParts.mockReturnValue(undefined);
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['a', 'b']);

      const bodyComponent = { body: { root: 'blueprint-root' } };
      const result = service.getAllParts(bodyComponent, 'actor-1');

      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'blueprint-root',
        cacheManagerMock,
        entityManagerMock
      );
      expect(queryCacheMock.cacheGetAllParts).toHaveBeenCalledWith(
        'blueprint-root',
        ['a', 'b']
      );
      expect(result).toEqual(['a', 'b']);
    });

    it('prefers actor cache root when available', () => {
      cacheManagerMock.has.mockImplementation((id) => id === 'actor-42');
      cacheManagerMock.size.mockReturnValue(3);
      queryCacheMock.getCachedGetAllParts.mockReturnValue(undefined);
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['actor-root']);

      const bodyComponent = { body: { root: 'blueprint-root' } };
      const result = service.getAllParts(bodyComponent, 'actor-42');

      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'actor-42',
        cacheManagerMock,
        entityManagerMock
      );
      expect(result).toEqual(['actor-root']);
    });

    it('supports direct body structure and returns cached results', () => {
      queryCacheMock.getCachedGetAllParts.mockReturnValue(['cached-root']);

      const result = service.getAllParts({ root: 'direct-root' });

      expect(result).toEqual(['cached-root']);
      expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
    });

    it('handles body components without root identifiers', () => {
      const result = service.getAllParts({ body: {} });

      expect(result).toEqual([]);
      expect(loggerMock.debug).toHaveBeenCalledWith(
        'BodyGraphService.getAllParts: No root ID found in bodyComponent'
      );
    });
  });

  describe('component inspection helpers', () => {
    it('detects presence of a component with non-empty data', () => {
      const getAllPartsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['part-1', 'part-2']);

      entityManagerMock.getComponentData
        .mockReturnValueOnce({})
        .mockReturnValueOnce({ equipped: true });

      const result = service.hasPartWithComponent(
        { body: { root: 'blueprint' } },
        'inventory:slot'
      );

      expect(result).toBe(true);
      expect(getAllPartsSpy).toHaveBeenCalled();
    });

    it('returns false when component data is missing or empty', () => {
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-3']);

      entityManagerMock.getComponentData
        .mockReturnValueOnce({})
        .mockReturnValueOnce(null);

      const result = service.hasPartWithComponent(
        { body: { root: 'blueprint' } },
        'inventory:slot'
      );

      expect(result).toBe(false);
    });

    it('finds nested component values across parts', () => {
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1', 'part-2']);

      entityManagerMock.getComponentData
        .mockReturnValueOnce({})
        .mockReturnValueOnce({ stats: { durability: 12 } });

      const result = service.hasPartWithComponentValue(
        { body: { root: 'blueprint' } },
        'anatomy:details',
        'stats.durability',
        12
      );

      expect(result).toEqual({ found: true, partId: 'part-2' });
    });

    it('reports missing component values when not found', () => {
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1']);
      entityManagerMock.getComponentData.mockReturnValueOnce({ stats: {} });

      const result = service.hasPartWithComponentValue(
        { body: { root: 'blueprint' } },
        'anatomy:details',
        'stats.durability',
        30
      );

      expect(result).toEqual({ found: false });
    });
  });

  describe('graph accessors', () => {
    it('validates input for getBodyGraph and fetches connected parts', async () => {
      await expect(service.getBodyGraph('')).rejects.toThrow(InvalidArgumentError);

      entityManagerMock.getComponentData.mockResolvedValue({ body: { root: 'r' } });
      cacheManagerMock.get.mockImplementation((id) => {
        if (id === 'part-1') {
          return { children: ['grand-1', 'grand-2'] };
        }
        return { children: ['child-1'] };
      });
      const getAllPartsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['part-a']);
      const buildAdjacencyCacheSpy = jest.spyOn(service, 'buildAdjacencyCache');

      const graph = await service.getBodyGraph('actor-1');

      expect(buildAdjacencyCacheSpy).toHaveBeenCalledWith('actor-1');
      expect(graph.getAllPartIds()).toEqual(['part-a']);
      expect(graph.getConnectedParts('part-1')).toEqual(['grand-1', 'grand-2']);
    });

    it('throws when anatomy component is missing', async () => {
      entityManagerMock.getComponentData.mockResolvedValue(null);

      await expect(service.getBodyGraph('actor-2')).rejects.toThrow(
        /has no anatomy:body component/
      );
    });

    it('exposes anatomy metadata and validates cache utilities', async () => {
      cacheManagerMock.validateCache.mockReturnValue(true);
      cacheManagerMock.hasCacheForRoot.mockReturnValue(true);
      cacheManagerMock.get.mockImplementation((id) => {
        if (id === 'root-1') {
          return { children: ['child-1'] };
        }
        if (id === 'child-1') {
          return { parentId: 'parent-1' };
        }
        if (id === 'parent-1') {
          return { parentId: 'root-1' };
        }
        if (id === 'grandchild-1') {
          return { parentId: 'child-1' };
        }
        return { parentId: null };
      });

      expect(service.validateCache()).toBe(true);
      expect(service.hasCache('root-1')).toBe(true);
      expect(service.getChildren('root-1')).toEqual(['child-1']);
      expect(service.getParent('child-1')).toEqual('parent-1');
      expect(service.getAncestors('grandchild-1')).toEqual([
        'child-1',
        'parent-1',
        'root-1',
      ]);
    });

    it('walks descendants and delegates path & root lookups to algorithms', () => {
      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([
        'node-1',
        'child-1',
        'child-2',
      ]);
      AnatomyGraphAlgorithms.getPath.mockReturnValue(['node-1', 'node-2']);
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-1');

      const descendants = service.getAllDescendants('node-1');

      expect(descendants).toEqual(['child-1', 'child-2']);
      expect(service.getPath('a', 'b')).toEqual(['node-1', 'node-2']);
      expect(service.getAnatomyRoot('part-9')).toBe('root-1');
    });
  });

  describe('getAnatomyData', () => {
    it('validates input', async () => {
      await expect(service.getAnatomyData('')).rejects.toThrow(
        InvalidArgumentError
      );
      await expect(service.getAnatomyData(42)).rejects.toThrow(
        InvalidArgumentError
      );
    });

    it('returns null when anatomy component is missing', async () => {
      entityManagerMock.getComponentData.mockResolvedValue(null);

      const result = await service.getAnatomyData('actor-1');

      expect(result).toBeNull();
      expect(loggerMock.debug).toHaveBeenCalledWith(
        "BodyGraphService.getAnatomyData: Getting anatomy data for entity 'actor-1'"
      );
      expect(loggerMock.debug).toHaveBeenCalledWith(
        "BodyGraphService.getAnatomyData: Entity 'actor-1' has no anatomy:body component"
      );
    });

    it('returns anatomy metadata when component exists', async () => {
      const bodyComponent = { recipeId: 'human', body: { root: 'root-1' } };
      entityManagerMock.getComponentData.mockResolvedValue(bodyComponent);

      const result = await service.getAnatomyData('actor-2');

      expect(result).toEqual({ recipeId: 'human', rootEntityId: 'actor-2' });
      expect(entityManagerMock.getComponentData).toHaveBeenCalledWith(
        'actor-2',
        'anatomy:body'
      );
    });
  });
});

