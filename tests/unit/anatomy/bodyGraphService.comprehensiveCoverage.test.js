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

describe('BodyGraphService comprehensive coverage', () => {
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

    cacheInstance = {
      hasCacheForRoot: jest.fn().mockReturnValue(false),
      buildCache: jest.fn().mockResolvedValue(undefined),
      invalidateCacheForRoot: jest.fn(),
      get: jest.fn().mockReturnValue(null),
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

    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([]);
    AnatomyGraphAlgorithms.findPartsByType.mockReturnValue([]);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue([]);
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue(null);
    AnatomyGraphAlgorithms.getPath.mockReturnValue([]);

    service = createService();
  });

  it('uses the exported limb detached constant', () => {
    expect(LIMB_DETACHED_EVENT_ID).toBe(
      ANATOMY_CONSTANTS.LIMB_DETACHED_EVENT_ID
    );
  });

  it('creates its own query cache when none is provided', () => {
    expect(AnatomyQueryCache).toHaveBeenCalledTimes(1);
    expect(service).toBeInstanceOf(BodyGraphService);
  });

  it('respects a provided query cache instance', () => {
    const providedQueryCache = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(['cached-arm']),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn(),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };

    const customService = createService({ queryCache: providedQueryCache });

    expect(AnatomyQueryCache).toHaveBeenCalledTimes(1);

    const result = customService.findPartsByType('torso', 'arm');
    expect(result).toEqual(['cached-arm']);
    expect(providedQueryCache.getCachedFindPartsByType).toHaveBeenCalledWith(
      'torso',
      'arm'
    );
    expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();
  });

  it('builds the adjacency cache only when missing', async () => {
    cacheInstance.hasCacheForRoot
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    await service.buildAdjacencyCache('actor-1');
    await service.buildAdjacencyCache('actor-1');

    expect(cacheInstance.buildCache).toHaveBeenCalledTimes(1);
    expect(cacheInstance.buildCache).toHaveBeenCalledWith(
      'actor-1',
      entityManager
    );
  });

  it('throws when detaching a part without a joint component', async () => {
    entityManager.getComponentData.mockReturnValue(null);

    await expect(service.detachPart('missing')).rejects.toThrow(
      new InvalidArgumentError(
        "Entity 'missing' has no joint component - cannot detach"
      )
    );
    expect(entityManager.removeComponent).not.toHaveBeenCalled();
  });

  it('detaches a part without cascading and skips cache invalidation when no root is found', async () => {
    entityManager.getComponentData.mockReturnValue({
      parentId: 'torso-1',
      socketId: 'shoulder',
    });
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue(null);

    const result = await service.detachPart('arm-1', { cascade: false });

    expect(result).toEqual({
      detached: ['arm-1'],
      parentId: 'torso-1',
      socketId: 'shoulder',
    });
    expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
    expect(cacheInstance.invalidateCacheForRoot).not.toHaveBeenCalled();
    expect(queryCacheInstance.invalidateRoot).not.toHaveBeenCalled();
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'arm-1',
        reason: 'manual',
      })
    );
  });

  it('detaches parts with cascading and invalidates caches', async () => {
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
    expect(cacheInstance.invalidateCacheForRoot).toHaveBeenCalledWith(
      'root-42'
    );
    expect(queryCacheInstance.invalidateRoot).toHaveBeenCalledWith('root-42');
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedCount: 2,
        reason: 'injury',
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      "BodyGraphService: Detached 2 entities from parent 'torso-1'"
    );
  });

  it('returns cached results when findPartsByType cache has an entry', () => {
    queryCacheInstance.getCachedFindPartsByType.mockReturnValue(['cached']);

    const parts = service.findPartsByType('root-1', 'leg');

    expect(parts).toEqual(['cached']);
    expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();
  });

  it('delegates findPartsByType to the algorithms and caches the result', () => {
    AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['leg-1']);

    const parts = service.findPartsByType('root-1', 'leg');

    expect(parts).toEqual(['leg-1']);
    expect(AnatomyGraphAlgorithms.findPartsByType).toHaveBeenCalledWith(
      'root-1',
      'leg',
      cacheInstance
    );
    expect(queryCacheInstance.cacheFindPartsByType).toHaveBeenCalledWith(
      'root-1',
      'leg',
      ['leg-1']
    );
  });

  it('delegates root and path queries to the algorithms', () => {
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-99');
    AnatomyGraphAlgorithms.getPath.mockReturnValue(['a', 'b']);

    expect(service.getAnatomyRoot('hand-1')).toBe('root-99');
    expect(service.getPath('hand-1', 'finger-1')).toEqual(['a', 'b']);

    expect(AnatomyGraphAlgorithms.getAnatomyRoot).toHaveBeenCalledWith(
      'hand-1',
      cacheInstance,
      entityManager
    );
    expect(AnatomyGraphAlgorithms.getPath).toHaveBeenCalledWith(
      'hand-1',
      'finger-1',
      cacheInstance
    );
  });

  it('returns an empty array when no body component is provided', () => {
    const parts = service.getAllParts(null);
    expect(parts).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      'BodyGraphService.getAllParts: No bodyComponent provided'
    );
  });

  it('returns an empty array when no root is present in the body component', () => {
    const parts = service.getAllParts({ unrelated: true });
    expect(parts).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      'BodyGraphService.getAllParts: No root ID found in bodyComponent'
    );
  });

  it('uses the blueprint root when the actor is not cached', () => {
    const bodyComponent = {
      body: { root: 'blueprint-root' },
    };
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['bp-1']);

    const parts = service.getAllParts(bodyComponent, 'actor-1');

    expect(parts).toEqual(['bp-1']);
    expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
      'blueprint-root',
      cacheInstance,
      entityManager
    );
  });

  it('uses the actor root when the actor is cached and caches the result', () => {
    const bodyComponent = {
      body: { root: 'blueprint-root' },
    };
    cacheInstance.has.mockReturnValueOnce(true);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['actor-part']);

    const parts = service.getAllParts(bodyComponent, 'actor-1');

    expect(parts).toEqual(['actor-part']);
    expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
      'actor-1',
      cacheInstance,
      entityManager
    );
    expect(queryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith(
      'actor-1',
      ['actor-part']
    );
  });

  it('returns cached getAllParts results when available', () => {
    const bodyComponent = { root: 'blueprint-root' };
    queryCacheInstance.getCachedGetAllParts.mockReturnValue(['cached']);

    const parts = service.getAllParts(bodyComponent, 'actor-1');

    expect(parts).toEqual(['cached']);
    expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
  });

  it('detects parts with specific components', () => {
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1', 'part-2']);
    entityManager.getComponentData
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ some: 'data' });

    expect(service.hasPartWithComponent({}, 'component')).toBe(true);
  });

  it('returns false when no part has the requested component value', () => {
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1']);
    entityManager.getComponentData.mockReturnValue({ nested: { value: 42 } });

    const result = service.hasPartWithComponentValue(
      {},
      'component',
      'nested.other',
      42
    );

    expect(result).toEqual({ found: false });
  });

  it('finds a component with a matching nested property value', () => {
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1']);
    entityManager.getComponentData.mockReturnValue({ nested: { value: 42 } });

    const result = service.hasPartWithComponentValue(
      {},
      'component',
      'nested.value',
      42
    );

    expect(result).toEqual({ found: true, partId: 'part-1' });
  });

  it('validates inputs when building a body graph', async () => {
    await expect(service.getBodyGraph('')).rejects.toThrow(
      new InvalidArgumentError('Entity ID is required and must be a string')
    );
  });

  it('throws when the anatomy body component is missing', async () => {
    entityManager.getComponentData.mockResolvedValue(null);

    await expect(service.getBodyGraph('actor-1')).rejects.toThrow(
      new Error('Entity actor-1 has no anatomy:body component')
    );
  });

  it('returns a body graph object with helper methods', async () => {
    entityManager.getComponentData.mockResolvedValue({
      body: { root: 'blueprint-root' },
      recipeId: 'recipe-1',
    });
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['part-a', 'part-b']);
    cacheInstance.get.mockImplementation((id) => {
      if (id === 'part-a') {
        return { children: ['part-b'] };
      }
      return null;
    });

    const graph = await service.getBodyGraph('actor-1');

    expect(typeof graph.getAllPartIds).toBe('function');
    expect(graph.getAllPartIds()).toEqual(['part-a', 'part-b']);
    expect(graph.getConnectedParts('part-a')).toEqual(['part-b']);
    expect(graph.getConnectedParts('missing')).toEqual([]);
  });

  it('validates inputs when retrieving anatomy data', async () => {
    await expect(service.getAnatomyData(null)).rejects.toThrow(
      new InvalidArgumentError('Entity ID is required and must be a string')
    );
  });

  it('returns null anatomy data when the component is missing', async () => {
    entityManager.getComponentData.mockResolvedValue(null);

    await expect(service.getAnatomyData('actor-1')).resolves.toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      "BodyGraphService.getAnatomyData: Entity 'actor-1' has no anatomy:body component"
    );
  });

  it('returns anatomy data when the component exists', async () => {
    entityManager.getComponentData.mockResolvedValue({ recipeId: 'recipe-7' });

    await expect(service.getAnatomyData('actor-1')).resolves.toEqual({
      recipeId: 'recipe-7',
      rootEntityId: 'actor-1',
    });
  });

  it('validates and queries cache helper methods', () => {
    cacheInstance.hasCacheForRoot.mockReturnValue(true);
    cacheInstance.get.mockImplementation((id) => {
      if (id === 'actor-1') {
        return { children: ['child-1'] };
      }
      if (id === 'child-1') {
        return { parentId: 'parent-1' };
      }
      return null;
    });

    expect(service.validateCache()).toEqual({ valid: true });
    expect(service.hasCache('actor-1')).toBe(true);
    expect(service.getChildren('actor-1')).toEqual(['child-1']);
    expect(service.getChildren('missing')).toEqual([]);
    expect(service.getParent('child-1')).toBe('parent-1');
    expect(service.getParent('orphan')).toBeNull();

    // Reconfigure get for ancestor resolution
    cacheInstance.get.mockImplementation((id) => {
      const nodes = {
        'child-2': { parentId: 'parent-2' },
        'parent-2': { parentId: 'grandparent-2' },
        'grandparent-2': { parentId: null },
      };
      return nodes[id] || null;
    });

    expect(service.getAncestors('child-2')).toEqual([
      'parent-2',
      'grandparent-2',
    ]);
  });

  it('returns descendants using the graph algorithms', () => {
    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([
      'root',
      'child-1',
      'child-2',
    ]);

    expect(service.getAllDescendants('root')).toEqual(['child-1', 'child-2']);
    expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
      'root',
      cacheInstance
    );
  });
});
