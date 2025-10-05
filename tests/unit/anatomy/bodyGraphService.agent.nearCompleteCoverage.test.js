import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => ({
  AnatomyCacheManager: jest.fn(),
}));

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => ({
  AnatomyQueryCache: jest.fn(),
}));

jest.mock('../../../src/anatomy/anatomyGraphAlgorithms.js', () => ({
  AnatomyGraphAlgorithms: {
    getSubgraph: jest.fn(),
    findPartsByType: jest.fn(),
    getAllParts: jest.fn(),
    getAnatomyRoot: jest.fn(),
    getPath: jest.fn(),
  },
}));

import {
  BodyGraphService,
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';

describe('BodyGraphService near complete coverage', () => {
  let entityManager;
  let logger;
  let eventDispatcher;
  let cacheInstance;
  let queryCacheInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    cacheInstance = {
      hasCacheForRoot: jest.fn().mockReturnValue(false),
      buildCache: jest.fn().mockResolvedValue(undefined),
      invalidateCacheForRoot: jest.fn(),
      get: jest.fn().mockReturnValue(undefined),
      has: jest.fn().mockReturnValue(false),
      size: jest.fn().mockReturnValue(0),
      validateCache: jest.fn().mockReturnValue({ valid: true }),
    };
    AnatomyCacheManager.mockImplementation(() => cacheInstance);

    queryCacheInstance = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };
    AnatomyQueryCache.mockImplementation(() => queryCacheInstance);

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

    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['part-1', 'child-1']);
    AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['arm']);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue([
      'root-entity',
      'part-1',
      'child-1',
    ]);
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-entity');
    AnatomyGraphAlgorithms.getPath.mockReturnValue(['from', 'to']);
  });

  /**
   * @description Creates a BodyGraphService instance with optional dependency overrides.
   * @param {Partial<{entityManager: object, logger: object, eventDispatcher: object, queryCache: object}>} [overrides={}]
   * Dependencies to override for the service instance.
   * @returns {BodyGraphService} Configured BodyGraphService instance for testing.
   */
  function createService(overrides = {}) {
    return new BodyGraphService({
      entityManager: overrides.entityManager ?? entityManager,
      logger: overrides.logger ?? logger,
      eventDispatcher: overrides.eventDispatcher ?? eventDispatcher,
      queryCache: overrides.queryCache,
    });
  }

  describe('constructor validation', () => {
    it('requires core dependencies', () => {
      expect(
        () => new BodyGraphService({ logger, eventDispatcher })
      ).toThrow('entityManager is required');
      expect(
        () => new BodyGraphService({ entityManager, eventDispatcher })
      ).toThrow('logger is required');
      expect(
        () => new BodyGraphService({ entityManager, logger })
      ).toThrow('eventDispatcher is required');
    });

    it('uses provided query cache when supplied', () => {
      const providedQueryCache = {
        getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
        cacheFindPartsByType: jest.fn(),
        getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
        cacheGetAllParts: jest.fn(),
        invalidateRoot: jest.fn(),
      };
      const service = createService({ queryCache: providedQueryCache });

      expect(AnatomyQueryCache).not.toHaveBeenCalled();

      AnatomyGraphAlgorithms.findPartsByType.mockReturnValueOnce(['hand']);
      expect(service.findPartsByType('root-entity', 'hand')).toEqual(['hand']);
      expect(
        providedQueryCache.cacheFindPartsByType
      ).toHaveBeenCalledWith('root-entity', 'hand', ['hand']);

      providedQueryCache.getCachedGetAllParts.mockReturnValueOnce(['cached']);
      expect(service.getAllParts({ root: 'blueprint-root' })).toEqual([
        'cached',
      ]);
    });
  });

  it('builds adjacency cache only when missing', async () => {
    const service = createService();

    cacheInstance.hasCacheForRoot.mockReturnValueOnce(false);
    await service.buildAdjacencyCache('actor-1');
    expect(cacheInstance.buildCache).toHaveBeenCalledWith(
      'actor-1',
      entityManager
    );

    cacheInstance.hasCacheForRoot.mockReturnValueOnce(true);
    await service.buildAdjacencyCache('actor-1');
    expect(cacheInstance.buildCache).toHaveBeenCalledTimes(1);
  });

  describe('detachPart', () => {
    beforeEach(() => {
      entityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === 'anatomy:joint' && entityId === 'part-1') {
          return { parentId: 'torso-1', socketId: 'shoulder' };
        }
        return null;
      });
    });

    it('detaches with cascade and invalidates caches', async () => {
      const service = createService();

      const result = await service.detachPart('part-1', {
        cascade: true,
        reason: 'injury',
      });

      expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
        'part-1',
        cacheInstance
      );
      expect(entityManager.removeComponent).toHaveBeenCalledWith(
        'part-1',
        'anatomy:joint'
      );
      expect(cacheInstance.invalidateCacheForRoot).toHaveBeenCalledWith(
        'root-entity'
      );
      expect(queryCacheInstance.invalidateRoot).toHaveBeenCalledWith(
        'root-entity'
      );
      expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedEntityId: 'part-1',
          parentEntityId: 'torso-1',
          socketId: 'shoulder',
          detachedCount: 2,
          reason: 'injury',
          timestamp: expect.any(Number),
        })
      );
      expect(logger.info).toHaveBeenCalled();
      expect(result).toEqual({
        detached: ['part-1', 'child-1'],
        parentId: 'torso-1',
        socketId: 'shoulder',
      });
    });

    it('supports non-cascading detach and default reason', async () => {
      const service = createService();

      AnatomyGraphAlgorithms.getSubgraph.mockClear();
      const result = await service.detachPart('part-1', { cascade: false });

      expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
      expect(result.detached).toEqual(['part-1']);
      expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({ reason: 'manual' })
      );
    });

    it('ignores cache invalidation when no root is found', async () => {
      const service = createService();

      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValueOnce(null);
      await service.detachPart('part-1');

      expect(cacheInstance.invalidateCacheForRoot).not.toHaveBeenCalled();
      expect(queryCacheInstance.invalidateRoot).not.toHaveBeenCalled();
    });

    it('throws when the part has no joint', async () => {
      const service = createService();
      entityManager.getComponentData.mockReturnValueOnce(null);

      await expect(service.detachPart('missing-part')).rejects.toThrow(
        InvalidArgumentError
      );
    });
  });

  it('finds parts by type with caching support', () => {
    const service = createService();

    expect(service.findPartsByType('root-entity', 'arm')).toEqual(['arm']);
    expect(AnatomyGraphAlgorithms.findPartsByType).toHaveBeenCalledWith(
      'root-entity',
      'arm',
      cacheInstance
    );
    expect(queryCacheInstance.cacheFindPartsByType).toHaveBeenCalledWith(
      'root-entity',
      'arm',
      ['arm']
    );

    AnatomyGraphAlgorithms.findPartsByType.mockClear();
    queryCacheInstance.getCachedFindPartsByType.mockReturnValueOnce([
      'cached-arm',
    ]);
    expect(service.findPartsByType('root-entity', 'arm')).toEqual([
      'cached-arm',
    ]);
    expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();
  });

  describe('getAllParts', () => {
    it('returns empty when body component is missing', () => {
      const service = createService();
      expect(service.getAllParts(null)).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith(
        'BodyGraphService.getAllParts: No bodyComponent provided'
      );
    });

    it('returns empty when no root is available', () => {
      const service = createService();
      expect(service.getAllParts({})).toEqual([]);
    });

    it('prefers actor root when cached and stores results', () => {
      const service = createService();

      cacheInstance.has.mockReturnValueOnce(true);
      cacheInstance.size.mockReturnValueOnce(2);

      const parts = service.getAllParts({ body: { root: 'blueprint-root' } }, 'actor-1');
      expect(parts).toEqual(['root-entity', 'part-1', 'child-1']);
      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'actor-1',
        cacheInstance,
        entityManager
      );
      expect(queryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith(
        'actor-1',
        parts
      );
    });

    it('falls back to blueprint root when actor cache is missing', () => {
      const service = createService();

      AnatomyGraphAlgorithms.getAllParts.mockClear();
      const parts = service.getAllParts({ root: 'blueprint-root' });
      expect(parts).toEqual(['root-entity', 'part-1', 'child-1']);
      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'blueprint-root',
        cacheInstance,
        entityManager
      );
    });

    it('returns cached parts without recalculating', () => {
      const service = createService();

      queryCacheInstance.getCachedGetAllParts.mockReturnValueOnce([
        'cached-part',
      ]);

      AnatomyGraphAlgorithms.getAllParts.mockClear();
      expect(service.getAllParts({ root: 'blueprint-root' })).toEqual([
        'cached-part',
      ]);
      expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
    });

    it('logs truncated previews when more than five parts are returned', () => {
      const service = createService();

      const manyParts = [
        'root-entity',
        'part-1',
        'part-2',
        'part-3',
        'part-4',
        'part-5',
        'part-6',
      ];
      AnatomyGraphAlgorithms.getAllParts.mockReturnValueOnce(manyParts);

      service.getAllParts({ root: 'blueprint-root' });

      const previewCall = logger.debug.mock.calls.find(([message]) =>
        message.includes(
          'BodyGraphService: AnatomyGraphAlgorithms.getAllParts returned 7 parts'
        )
      );
      expect(previewCall?.[0]).toContain('...');
    });
  });

  it('checks for component presence across parts', () => {
    const service = createService();

    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-a', 'part-b']);
    entityManager.getComponentData.mockImplementation((entityId, componentId) => {
      if (entityId === 'part-a' && componentId === 'custom:flag') {
        return { present: true };
      }
      if (entityId === 'part-b' && componentId === 'custom:flag') {
        return {};
      }
      return null;
    });

    expect(service.hasPartWithComponent({ root: 'ignored' }, 'custom:flag')).toBe(
      true
    );

    entityManager.getComponentData.mockReturnValue(null);
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-z']);
    expect(
      service.hasPartWithComponent({ root: 'ignored' }, 'custom:flag')
    ).toBe(false);
  });

  it('checks for specific component values', () => {
    const service = createService();

    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-a', 'part-b']);
    entityManager.getComponentData.mockImplementation((entityId) => {
      if (entityId === 'part-b') {
        return { nested: { value: 42 } };
      }
      return null;
    });

    expect(
      service.hasPartWithComponentValue(
        { root: 'ignored' },
        'custom:flag',
        'nested.value',
        42
      )
    ).toEqual({ found: true, partId: 'part-b' });
    expect(
      service.hasPartWithComponentValue(
        { root: 'ignored' },
        'custom:flag',
        'nested.value',
        100
      )
    ).toEqual({ found: false });
  });

  it('handles missing nested properties when checking component values', () => {
    const service = createService();

    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-a']);
    entityManager.getComponentData.mockReturnValue({ nested: {} });

    expect(
      service.hasPartWithComponentValue(
        { root: 'ignored' },
        'custom:flag',
        'nested.value.deep',
        'anything'
      )
    ).toEqual({ found: false });
  });

  describe('getBodyGraph', () => {
    it('validates entity identifier and body component presence', async () => {
      const service = createService();
      await expect(service.getBodyGraph('')).rejects.toThrow(
        InvalidArgumentError
      );

      entityManager.getComponentData.mockReturnValueOnce(null);
      await expect(service.getBodyGraph('actor-1')).rejects.toThrow(
        'Entity actor-1 has no anatomy:body component'
      );
    });

    it('returns graph helpers when anatomy data exists', async () => {
      entityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'actor-1' && componentId === 'anatomy:body') {
          return { body: { root: 'blueprint-root' } };
        }
        return null;
      });

      cacheInstance.get.mockImplementation((entityId) => {
        if (entityId === 'part-1') {
          return { children: ['child-1'], parentId: 'root-entity' };
        }
        return undefined;
      });

      const service = createService();
      const graph = await service.getBodyGraph('actor-1');

      expect(cacheInstance.buildCache).toHaveBeenCalledWith(
        'actor-1',
        entityManager
      );
      expect(graph.getAllPartIds()).toEqual([
        'root-entity',
        'part-1',
        'child-1',
      ]);
      expect(graph.getConnectedParts('part-1')).toEqual(['child-1']);
      expect(graph.getConnectedParts('missing')).toEqual([]);
    });
  });

  describe('getAnatomyData', () => {
    it('validates identifier and handles missing anatomy', async () => {
      const service = createService();
      await expect(service.getAnatomyData('')).rejects.toThrow(
        InvalidArgumentError
      );

      entityManager.getComponentData.mockReturnValueOnce(null);
      await expect(service.getAnatomyData('actor-1')).resolves.toBeNull();
    });

    it('returns recipe and root information when available', async () => {
      entityManager.getComponentData.mockReturnValueOnce({ recipeId: 'recipe-9' });
      const service = createService();

      await expect(service.getAnatomyData('actor-2')).resolves.toEqual({
        recipeId: 'recipe-9',
        rootEntityId: 'actor-2',
      });
    });

    it('defaults recipeId to null when not provided', async () => {
      entityManager.getComponentData.mockReturnValueOnce({});
      const service = createService();

      await expect(service.getAnatomyData('actor-3')).resolves.toEqual({
        recipeId: null,
        rootEntityId: 'actor-3',
      });
    });
  });

  it('exposes cache utilities and graph helpers', () => {
    cacheInstance.hasCacheForRoot.mockReturnValueOnce(true);
    cacheInstance.get.mockImplementation((entityId) => {
      const nodes = {
        'child-x': { children: ['grandchild'], parentId: 'root-x' },
        'root-x': { children: ['child-x'], parentId: null },
      };
      return nodes[entityId];
    });

    AnatomyGraphAlgorithms.getSubgraph.mockReturnValueOnce([
      'child-x',
      'grandchild',
    ]);

    const service = createService();

    expect(service.validateCache()).toEqual({ valid: true });
    expect(service.hasCache('root-x')).toBe(true);
    expect(service.getChildren('root-x')).toEqual(['child-x']);
    expect(service.getChildren('unknown')).toEqual([]);
    expect(service.getParent('child-x')).toEqual('root-x');
    expect(service.getParent('unknown')).toBeNull();
    expect(service.getAncestors('child-x')).toEqual(['root-x']);
    expect(service.getAllDescendants('child-x')).toEqual(['grandchild']);
    expect(service.getAnatomyRoot('node')).toBe('root-entity');
    expect(service.getPath('from', 'to')).toEqual(['from', 'to']);
  });
});
