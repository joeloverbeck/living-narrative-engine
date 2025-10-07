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

describe('BodyGraphService maximum coverage', () => {
  let entityManager;
  let logger;
  let eventDispatcher;
  let cacheInstance;
  let queryCacheInstance;

  const createService = (overrides = {}) =>
    new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
      ...overrides,
    });

  beforeEach(() => {
    jest.clearAllMocks();

    AnatomyCacheManager.mockImplementation(() => {
      cacheInstance = {
        hasCacheForRoot: jest.fn().mockReturnValue(false),
        buildCache: jest.fn().mockResolvedValue(undefined),
        invalidateCacheForRoot: jest.fn(),
        get: jest.fn().mockReturnValue({ children: [], parentId: null }),
        has: jest.fn().mockReturnValue(false),
        size: jest.fn().mockReturnValue(0),
        validateCache: jest.fn().mockReturnValue({ valid: true }),
      };
      return cacheInstance;
    });

    AnatomyQueryCache.mockImplementation(() => {
      queryCacheInstance = {
        getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
        cacheFindPartsByType: jest.fn(),
        getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
        cacheGetAllParts: jest.fn(),
        invalidateRoot: jest.fn(),
      };
      return queryCacheInstance;
    });

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

    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([]);
    AnatomyGraphAlgorithms.findPartsByType.mockReturnValue([]);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue([]);
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue(null);
    AnatomyGraphAlgorithms.getPath.mockReturnValue([]);
  });

  it('requires an entity manager, logger, and event dispatcher', () => {
    expect(
      () => new BodyGraphService({ logger, eventDispatcher })
    ).toThrow(new InvalidArgumentError('entityManager is required'));

    expect(
      () => new BodyGraphService({ entityManager, eventDispatcher })
    ).toThrow(new InvalidArgumentError('logger is required'));

    expect(
      () => new BodyGraphService({ entityManager, logger })
    ).toThrow(new InvalidArgumentError('eventDispatcher is required'));
  });

  it('creates default cache managers using the provided logger', () => {
    const service = createService();
    expect(service).toBeInstanceOf(BodyGraphService);
    expect(AnatomyCacheManager).toHaveBeenCalledWith({ logger });
    expect(AnatomyQueryCache).toHaveBeenCalledWith({ logger });
  });

  it('uses a provided query cache without instantiating a new one', () => {
    const customQueryCache = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };

    const service = createService({ queryCache: customQueryCache });

    expect(AnatomyQueryCache).not.toHaveBeenCalled();

    AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['fresh']);
    const result = service.findPartsByType('root-x', 'arm');
    expect(result).toEqual(['fresh']);
    expect(customQueryCache.cacheFindPartsByType).toHaveBeenCalledWith(
      'root-x',
      'arm',
      ['fresh']
    );
  });

  it('builds the adjacency cache only when missing', async () => {
    const service = createService();
    cacheInstance.hasCacheForRoot.mockReturnValueOnce(false).mockReturnValueOnce(true);

    await service.buildAdjacencyCache('actor-1');
    expect(cacheInstance.buildCache).toHaveBeenCalledWith('actor-1', entityManager);

    await service.buildAdjacencyCache('actor-1');
    expect(cacheInstance.buildCache).toHaveBeenCalledTimes(1);
  });

  it('throws when attempting to detach a part without a joint', async () => {
    const service = createService();
    entityManager.getComponentData.mockReturnValue(null);

    await expect(service.detachPart('missing-joint')).rejects.toThrow(
      new InvalidArgumentError("Entity 'missing-joint' has no joint component - cannot detach")
    );
  });

  it('detaches parts with cascade, invalidating caches and dispatching events', async () => {
    const service = createService();

    entityManager.getComponentData.mockImplementation((entityId, componentId) => {
      if (componentId === 'anatomy:joint' && entityId === 'part-1') {
        return { parentId: 'torso-1', socketId: 'shoulder' };
      }
      return null;
    });

    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['part-1', 'child-1']);
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-entity');

    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(123456789);

    const result = await service.detachPart('part-1', { cascade: true, reason: 'injury' });

    expect(entityManager.removeComponent).toHaveBeenCalledWith('part-1', 'anatomy:joint');
    expect(cacheInstance.invalidateCacheForRoot).toHaveBeenCalledWith('root-entity');
    expect(queryCacheInstance.invalidateRoot).toHaveBeenCalledWith('root-entity');
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'part-1',
        parentEntityId: 'torso-1',
        socketId: 'shoulder',
        detachedCount: 2,
        reason: 'injury',
        timestamp: 123456789,
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      "BodyGraphService: Detached 2 entities from parent 'torso-1'"
    );
    expect(result).toEqual({
      detached: ['part-1', 'child-1'],
      parentId: 'torso-1',
      socketId: 'shoulder',
    });

    nowSpy.mockRestore();
  });

  it('supports non-cascading detaches and skips cache invalidation when no root is found', async () => {
    const service = createService();

    entityManager.getComponentData.mockReturnValue({
      parentId: 'torso-2',
      socketId: 'hip',
    });

    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue(null);

    const result = await service.detachPart('part-2', { cascade: false });

    expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
    expect(cacheInstance.invalidateCacheForRoot).not.toHaveBeenCalled();
    expect(queryCacheInstance.invalidateRoot).not.toHaveBeenCalled();
    expect(result).toEqual({ detached: ['part-2'], parentId: 'torso-2', socketId: 'hip' });
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({ detachedCount: 1 })
    );
  });

  it('returns cached results for findPartsByType when available', () => {
    const service = createService();
    queryCacheInstance.getCachedFindPartsByType.mockReturnValue(['cached-part']);

    const result = service.findPartsByType('root-2', 'arm');
    expect(result).toEqual(['cached-part']);
    expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();
  });

  it('queries and caches findPartsByType results when not cached', () => {
    const service = createService();
    queryCacheInstance.getCachedFindPartsByType.mockReturnValue(undefined);
    AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['fresh-part']);

    const result = service.findPartsByType('root-3', 'leg');
    expect(result).toEqual(['fresh-part']);
    expect(queryCacheInstance.cacheFindPartsByType).toHaveBeenCalledWith(
      'root-3',
      'leg',
      ['fresh-part']
    );
  });

  it('delegates getAnatomyRoot and getPath to AnatomyGraphAlgorithms', () => {
    const service = createService();

    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-xyz');
    AnatomyGraphAlgorithms.getPath.mockReturnValue(['from', 'middle', 'to']);

    expect(service.getAnatomyRoot('part-x')).toBe('root-xyz');
    expect(AnatomyGraphAlgorithms.getAnatomyRoot).toHaveBeenCalledWith(
      'part-x',
      cacheInstance,
      entityManager
    );

    expect(service.getPath('from', 'to')).toEqual(['from', 'middle', 'to']);
    expect(AnatomyGraphAlgorithms.getPath).toHaveBeenCalledWith(
      'from',
      'to',
      cacheInstance
    );
  });

  it('returns an empty list when getAllParts receives no body component', () => {
    const service = createService();
    const result = service.getAllParts(undefined);
    expect(result).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      'BodyGraphService.getAllParts: No bodyComponent provided'
    );
  });

  it('uses actor entity cache when available for getAllParts', () => {
    const service = createService();

    cacheInstance.has.mockImplementation((id) => id === 'actor-42');
    cacheInstance.size.mockReturnValue(3);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue([
      'actor-42',
      'arm-1',
      'hand-1',
    ]);

    const bodyComponent = { body: { root: 'blueprint-root' } };
    const result = service.getAllParts(bodyComponent, 'actor-42');

    expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
      'actor-42',
      cacheInstance,
      entityManager
    );
    expect(queryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith(
      'actor-42',
      result
    );
    expect(result).toEqual(['actor-42', 'arm-1', 'hand-1']);
  });

  it('returns cached getAllParts results when present and uses blueprint root fallback', () => {
    const service = createService();

    cacheInstance.has.mockReturnValue(false);
    cacheInstance.size.mockReturnValue(1);
    queryCacheInstance.getCachedGetAllParts.mockReturnValue(['cached-root', 'cached-arm']);

    const bodyComponent = { root: 'body-root' };
    const result = service.getAllParts(bodyComponent, 'actor-missing');

    expect(result).toEqual(['cached-root', 'cached-arm']);
    expect(logger.debug).toHaveBeenCalledWith(
      "BodyGraphService: Using blueprint root 'body-root' as cache root (actor 'actor-missing' not in cache, cache size: 1)"
    );
    expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
  });

  it('hasPartWithComponent detects non-empty component data', () => {
    const service = createService();

    const getAllPartsSpy = jest
      .spyOn(service, 'getAllParts')
      .mockReturnValue(['part-a', 'part-b']);

    entityManager.getComponentData.mockImplementation((entityId) => {
      if (entityId === 'part-a') return null;
      if (entityId === 'part-b') return { some: 'value' };
      return undefined;
    });

    expect(service.hasPartWithComponent({ body: { root: 'r' } }, 'component:x')).toBe(true);

    getAllPartsSpy.mockRestore();
  });

  it('hasPartWithComponent returns false when only empty components are present', () => {
    const service = createService();

    const getAllPartsSpy = jest
      .spyOn(service, 'getAllParts')
      .mockReturnValue(['part-c']);

    entityManager.getComponentData.mockReturnValue({});

    expect(service.hasPartWithComponent({ body: { root: 'r' } }, 'component:y')).toBe(false);

    getAllPartsSpy.mockRestore();
  });

  it('hasPartWithComponentValue finds matching nested values and reports misses', () => {
    const service = createService();

    const getAllPartsSpy = jest
      .spyOn(service, 'getAllParts')
      .mockReturnValue(['part-d', 'part-e']);

    entityManager.getComponentData.mockImplementation((entityId) => {
      if (entityId === 'part-d') {
        return { attributes: { color: 'red' } };
      }
      if (entityId === 'part-e') {
        return { attributes: { color: 'blue' } };
      }
      return null;
    });

    expect(
      service.hasPartWithComponentValue(
        { body: { root: 'r' } },
        'component:z',
        'attributes.color',
        'blue'
      )
    ).toEqual({ found: true, partId: 'part-e' });

    expect(
      service.hasPartWithComponentValue(
        { body: { root: 'r' } },
        'component:z',
        'attributes.color',
        'green'
      )
    ).toEqual({ found: false });

    getAllPartsSpy.mockRestore();
  });

  it('validates entity identifiers when fetching body graphs', async () => {
    const service = createService();

    await expect(service.getBodyGraph()).rejects.toThrow(
      new InvalidArgumentError('Entity ID is required and must be a string')
    );
  });

  it('requires an anatomy:body component to build a body graph', async () => {
    const service = createService();
    entityManager.getComponentData.mockResolvedValue(null);

    await expect(service.getBodyGraph('actor-7')).rejects.toThrow(
      new Error('Entity actor-7 has no anatomy:body component')
    );
  });

  it('builds body graphs and exposes helper accessors', async () => {
    const service = createService();

    entityManager.getComponentData.mockResolvedValue({ body: { root: 'root-5' } });
    cacheInstance.hasCacheForRoot.mockReturnValue(false);
    cacheInstance.get.mockImplementation((entityId) => {
      if (entityId === 'limb-1') {
        return { children: ['finger-1'] };
      }
      return { children: [], parentId: null };
    });

    const getAllPartsSpy = jest
      .spyOn(service, 'getAllParts')
      .mockReturnValue(['root-5', 'limb-1']);

    const graph = await service.getBodyGraph('actor-5');

    expect(cacheInstance.buildCache).toHaveBeenCalledWith('actor-5', entityManager);
    expect(graph.getAllPartIds()).toEqual(['root-5', 'limb-1']);
    expect(graph.getConnectedParts('limb-1')).toEqual(['finger-1']);

    getAllPartsSpy.mockRestore();
  });

  it('validates entity identifiers when fetching anatomy data', async () => {
    const service = createService();
    await expect(service.getAnatomyData()).rejects.toThrow(
      new InvalidArgumentError('Entity ID is required and must be a string')
    );
  });

  it('returns null anatomy data when component is missing', async () => {
    const service = createService();
    entityManager.getComponentData.mockResolvedValue(null);

    const result = await service.getAnatomyData('actor-8');
    expect(result).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      "BodyGraphService.getAnatomyData: Entity 'actor-8' has no anatomy:body component"
    );
  });

  it('returns recipe information when anatomy data is available', async () => {
    const service = createService();
    entityManager.getComponentData.mockResolvedValue({ recipeId: 'recipe-99' });

    const result = await service.getAnatomyData('actor-9');
    expect(result).toEqual({ recipeId: 'recipe-99', rootEntityId: 'actor-9' });
  });

  it('validates and proxies cache utility methods', () => {
    const service = createService();

    service.validateCache();
    expect(cacheInstance.validateCache).toHaveBeenCalledWith(entityManager);

    cacheInstance.hasCacheForRoot.mockReturnValue(true);
    expect(service.hasCache('root-10')).toBe(true);

    cacheInstance.get.mockReturnValueOnce({ children: ['child-1', 'child-2'] });
    expect(service.getChildren('root-10')).toEqual(['child-1', 'child-2']);

    cacheInstance.get.mockReturnValueOnce(undefined);
    expect(service.getChildren('root-10')).toEqual([]);

    cacheInstance.get.mockReturnValueOnce({ parentId: 'parent-1' });
    expect(service.getParent('child-x')).toBe('parent-1');

    cacheInstance.get.mockReturnValueOnce(undefined);
    expect(service.getParent('orphan')).toBeNull();
  });

  it('collects ancestors by walking the cached parent chain', () => {
    const service = createService();

    cacheInstance.get.mockImplementation((entityId) => {
      const nodes = {
        'finger-1': { parentId: 'hand-1' },
        'hand-1': { parentId: 'arm-1' },
        'arm-1': { parentId: 'torso-1' },
        'torso-1': { parentId: null },
      };
      return nodes[entityId] || null;
    });

    expect(service.getAncestors('finger-1')).toEqual([
      'hand-1',
      'arm-1',
      'torso-1',
    ]);
  });

  it('returns descendants excluding the root entity', () => {
    const service = createService();

    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([
      'root-20',
      'child-1',
      'child-2',
    ]);

    expect(service.getAllDescendants('root-20')).toEqual(['child-1', 'child-2']);
    expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
      'root-20',
      cacheInstance
    );
  });
});
