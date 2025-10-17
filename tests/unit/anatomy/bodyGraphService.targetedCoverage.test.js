import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyGraphService, LIMB_DETACHED_EVENT_ID } from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { ANATOMY_CONSTANTS } from '../../../src/anatomy/constants/anatomyConstants.js';

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

describe('BodyGraphService targeted coverage', () => {
  /** @type {import('../../../src/anatomy/bodyGraphService.js').BodyGraphService} */
  let service;
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
        get: jest.fn().mockReturnValue(null),
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

    service = createService();
  });

  it('exports the limb detached event constant', () => {
    expect(LIMB_DETACHED_EVENT_ID).toBe(
      ANATOMY_CONSTANTS.LIMB_DETACHED_EVENT_ID
    );
  });

  it('requires all constructor dependencies', () => {
    expect(() => new BodyGraphService({ logger, eventDispatcher })).toThrow(
      new InvalidArgumentError('entityManager is required')
    );
    expect(() => new BodyGraphService({ entityManager, eventDispatcher })).toThrow(
      new InvalidArgumentError('logger is required')
    );
    expect(() => new BodyGraphService({ entityManager, logger })).toThrow(
      new InvalidArgumentError('eventDispatcher is required')
    );
  });

  it('builds the adjacency cache only when missing', async () => {
    cacheInstance.hasCacheForRoot.mockReturnValueOnce(false).mockReturnValueOnce(true);

    await service.buildAdjacencyCache('actor-1');
    expect(cacheInstance.buildCache).toHaveBeenCalledWith('actor-1', entityManager);

    await service.buildAdjacencyCache('actor-1');
    expect(cacheInstance.buildCache).toHaveBeenCalledTimes(1);
  });

  it('throws when detaching a part without a joint component', async () => {
    entityManager.getComponentData.mockReturnValue(null);

    await expect(service.detachPart('missing')).rejects.toThrow(
      new InvalidArgumentError("Entity 'missing' has no joint component - cannot detach")
    );
  });

  it('detaches parts with cascade and invalidates caches', async () => {
    entityManager.getComponentData.mockReturnValue({
      parentId: 'torso-1',
      socketId: 'shoulder',
    });
    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['arm-1', 'hand-1']);
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-42');

    const result = await service.detachPart('arm-1', {
      cascade: true,
      reason: 'injury',
    });

    expect(result).toEqual({
      detached: ['arm-1', 'hand-1'],
      parentId: 'torso-1',
      socketId: 'shoulder',
    });
    expect(entityManager.removeComponent).toHaveBeenCalledWith(
      'arm-1',
      'anatomy:joint'
    );
    expect(cacheInstance.invalidateCacheForRoot).toHaveBeenCalledWith('root-42');
    expect(queryCacheInstance.invalidateRoot).toHaveBeenCalledWith('root-42');
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'arm-1',
        parentEntityId: 'torso-1',
        socketId: 'shoulder',
        detachedCount: 2,
        reason: 'injury',
        timestamp: expect.any(Number),
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      "BodyGraphService: Detached 2 entities from parent 'torso-1'"
    );
  });

  it('detaches a single part when cascade is disabled', async () => {
    entityManager.getComponentData.mockReturnValue({
      parentId: 'torso-2',
      socketId: 'waist',
    });

    AnatomyGraphAlgorithms.getSubgraph.mockClear();

    const result = await service.detachPart('leg-1', {
      cascade: false,
      reason: 'automation',
    });

    expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
    expect(cacheInstance.invalidateCacheForRoot).not.toHaveBeenCalled();
    expect(queryCacheInstance.invalidateRoot).not.toHaveBeenCalled();
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'leg-1',
        detachedCount: 1,
        reason: 'automation',
      })
    );
    expect(result).toEqual({
      detached: ['leg-1'],
      parentId: 'torso-2',
      socketId: 'waist',
    });
  });

  it('uses cached findPartsByType results when available', () => {
    queryCacheInstance.getCachedFindPartsByType.mockReturnValue(['cached-part']);

    const result = service.findPartsByType('actor-1', 'eye');

    expect(result).toEqual(['cached-part']);
    expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();
  });

  it('queries and caches findPartsByType results when cache misses', () => {
    queryCacheInstance.getCachedFindPartsByType.mockReturnValue(undefined);
    AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['fresh']);

    const result = service.findPartsByType('actor-1', 'arm');

    expect(result).toEqual(['fresh']);
    expect(AnatomyGraphAlgorithms.findPartsByType).toHaveBeenCalledWith(
      'actor-1',
      'arm',
      cacheInstance
    );
    expect(queryCacheInstance.cacheFindPartsByType).toHaveBeenCalledWith(
      'actor-1',
      'arm',
      ['fresh']
    );
  });

  it('delegates to graph algorithms for root and path queries', () => {
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-9');
    AnatomyGraphAlgorithms.getPath.mockReturnValue(['root-9', 'arm-2']);

    expect(service.getAnatomyRoot('arm-2')).toBe('root-9');
    expect(service.getPath('root-9', 'arm-2')).toEqual(['root-9', 'arm-2']);
  });

  it('returns empty array when getAllParts has no component', () => {
    const result = service.getAllParts(null);
    expect(result).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      'BodyGraphService.getAllParts: No bodyComponent provided'
    );
  });

  it('returns cached getAllParts results when present', () => {
    queryCacheInstance.getCachedGetAllParts.mockReturnValueOnce(['cached-1']);

    const result = service.getAllParts({ body: { root: 'root-1' } });

    expect(result).toEqual(['cached-1']);
    expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
  });

  it('prefers actor root when available in cache', () => {
    queryCacheInstance.getCachedGetAllParts.mockReturnValueOnce(undefined);
    cacheInstance.has.mockReturnValueOnce(true);
    cacheInstance.size.mockReturnValue(3);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['actor-part']);

    const result = service.getAllParts({ body: { root: 'blueprint-root' } }, 'actor-77');

    expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
      'actor-77',
      cacheInstance,
      entityManager
    );
    expect(queryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith(
      'actor-77',
      ['actor-part']
    );
    expect(result).toEqual(['actor-part']);
  });

  it('falls back to blueprint root when actor not cached', () => {
    queryCacheInstance.getCachedGetAllParts.mockReturnValueOnce(undefined);
    cacheInstance.has.mockReturnValue(false);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['blueprint-part']);

    const result = service.getAllParts({ root: 'blueprint-root-2' }, 'actor-missing');

    expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
      'blueprint-root-2',
      cacheInstance,
      entityManager
    );
    expect(result).toEqual(['blueprint-part']);
  });

  it('returns empty array when no root id found in body component', () => {
    const result = service.getAllParts({});

    expect(result).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      'BodyGraphService.getAllParts: No root ID found in bodyComponent'
    );
  });

  it('detects parts with non-empty components', () => {
    const spy = jest.spyOn(service, 'getAllParts');
    spy.mockReturnValue(['part-1', 'part-2', 'part-3']);

    entityManager.getComponentData.mockImplementation((id, component) => {
      if (id === 'part-1') return null;
      if (id === 'part-2') return {};
      return { component, value: true };
    });

    expect(service.hasPartWithComponent({ body: { root: 'root' } }, 'anatomy:eye'))
      .toBe(true);

    spy.mockRestore();
  });

  it('returns false when parts only have empty components', () => {
    const spy = jest.spyOn(service, 'getAllParts');
    spy.mockReturnValue(['part-1']);

    entityManager.getComponentData.mockReturnValue({});

    expect(service.hasPartWithComponent({ body: { root: 'root' } }, 'anatomy:eye'))
      .toBe(false);

    spy.mockRestore();
  });

  it('finds parts with nested component values', () => {
    const spy = jest.spyOn(service, 'getAllParts');
    spy.mockReturnValue(['part-1', 'part-2']);

    entityManager.getComponentData.mockImplementation((id) => {
      if (id === 'part-1') {
        return { anatomy: { status: 'ok' } };
      }
      return { anatomy: { status: 'missing' } };
    });

    const result = service.hasPartWithComponentValue(
      { body: { root: 'root' } },
      'anatomy:state',
      'anatomy.status',
      'missing'
    );

    expect(result).toEqual({ found: true, partId: 'part-2' });

    spy.mockRestore();
  });

  it('returns not found when nested component value is absent', () => {
    const spy = jest.spyOn(service, 'getAllParts');
    spy.mockReturnValue(['part-1']);

    entityManager.getComponentData.mockReturnValue(null);

    const result = service.hasPartWithComponentValue(
      { body: { root: 'root' } },
      'anatomy:state',
      'anatomy.status',
      'present'
    );

    expect(result).toEqual({ found: false });

    spy.mockRestore();
  });

  it('validates entity id when retrieving a body graph', async () => {
    await expect(service.getBodyGraph()).rejects.toThrow(
      new InvalidArgumentError('Entity ID is required and must be a string')
    );
  });

  it('throws when entity lacks anatomy body component', async () => {
    entityManager.getComponentData.mockResolvedValueOnce(null);

    await expect(service.getBodyGraph('actor-2')).rejects.toThrow(
      new Error('Entity actor-2 has no anatomy:body component')
    );
  });

  it('provides helpers for body graphs', async () => {
    entityManager.getComponentData.mockResolvedValueOnce({ body: { root: 'root-graph' } });
    cacheInstance.get.mockImplementation((id) => {
      if (id === 'limb-1') {
        return { children: ['finger-1', 'finger-2'], parentId: 'root-graph' };
      }
      if (id === 'finger-1') {
        return { children: [], parentId: 'limb-1' };
      }
      return { children: [], parentId: null };
    });

    const getAllPartsSpy = jest
      .spyOn(service, 'getAllParts')
      .mockReturnValue(['root-graph', 'limb-1', 'finger-1']);

    const graph = await service.getBodyGraph('actor-3');

    expect(cacheInstance.buildCache).toHaveBeenCalledWith('actor-3', entityManager);
    expect(graph.getAllPartIds()).toEqual(['root-graph', 'limb-1', 'finger-1']);
    expect(graph.getConnectedParts('limb-1')).toEqual(['finger-1', 'finger-2']);

    getAllPartsSpy.mockRestore();
  });

  it('retrieves anatomy data and validates entity id', async () => {
    await expect(service.getAnatomyData()).rejects.toThrow(
      new InvalidArgumentError('Entity ID is required and must be a string')
    );

    entityManager.getComponentData.mockResolvedValueOnce(null);
    expect(await service.getAnatomyData('actor-4')).toBeNull();

    entityManager.getComponentData.mockResolvedValueOnce({ recipeId: 'recipe-7' });
    await expect(service.getAnatomyData('actor-5')).resolves.toEqual({
      recipeId: 'recipe-7',
      rootEntityId: 'actor-5',
    });
  });

  it('validates and inspects caches', () => {
    cacheInstance.validateCache.mockReturnValue({ valid: true });
    cacheInstance.hasCacheForRoot.mockReturnValue(true);
    cacheInstance.get.mockReturnValue({ children: ['child-1'], parentId: 'parent-1' });

    expect(service.validateCache()).toEqual({ valid: true });
    expect(service.hasCache('root-5')).toBe(true);
    expect(service.getChildren('node-1')).toEqual(['child-1']);
    expect(service.getParent('node-1')).toBe('parent-1');
  });

  it('collects ancestors using cached parent relationships', () => {
    cacheInstance.get.mockImplementation((id) => {
      if (id === 'leaf') return { parentId: 'mid' };
      if (id === 'mid') return { parentId: 'root' };
      if (id === 'root') return { parentId: null };
      return null;
    });

    expect(service.getAncestors('leaf')).toEqual(['mid', 'root']);
  });

  it('collects descendants using graph algorithms', () => {
    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['node', 'child-1', 'child-2']);

    expect(service.getAllDescendants('node')).toEqual(['child-1', 'child-2']);
  });
});
