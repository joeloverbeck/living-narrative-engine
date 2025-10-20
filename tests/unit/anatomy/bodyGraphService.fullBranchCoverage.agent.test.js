import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

const mockAlgorithms = {
  getSubgraph: jest.fn(),
  findPartsByType: jest.fn(),
  getAnatomyRoot: jest.fn(),
  getPath: jest.fn(),
  getAllParts: jest.fn(),
};

const cacheManagerInstances = [];
const queryCacheInstances = [];

jest.mock('../../../src/anatomy/anatomyGraphAlgorithms.js', () => ({
  __esModule: true,
  AnatomyGraphAlgorithms: mockAlgorithms,
}));

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => ({
  __esModule: true,
  AnatomyCacheManager: jest.fn().mockImplementation((...args) => {
    const instance = {
      hasCacheForRoot: jest.fn().mockReturnValue(false),
      buildCache: jest.fn().mockResolvedValue(undefined),
      invalidateCacheForRoot: jest.fn(),
      get: jest.fn().mockReturnValue(undefined),
      has: jest.fn().mockReturnValue(false),
      size: jest.fn().mockReturnValue(0),
      validateCache: jest
        .fn()
        .mockReturnValue({ valid: true, issues: [] }),
    };
    cacheManagerInstances.push({ instance, args });
    return instance;
  }),
}));

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => ({
  __esModule: true,
  AnatomyQueryCache: jest.fn().mockImplementation((...args) => {
    const instance = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };
    queryCacheInstances.push({ instance, args });
    return instance;
  }),
}));

let BodyGraphService;
let LIMB_DETACHED_EVENT_ID;

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createEntityManager = (overrides = {}) => ({
  getComponentData: jest.fn().mockReturnValue(undefined),
  removeComponent: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const createDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
});

const buildService = ({
  entityManager = createEntityManager(),
  logger = createLogger(),
  eventDispatcher = createDispatcher(),
  queryCache,
} = {}) => {
  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
    queryCache,
  });

  const cacheEntry = cacheManagerInstances.at(-1) ?? {};
  const queryEntry =
    queryCache !== undefined ? undefined : queryCacheInstances.at(-1);

  return {
    service,
    entityManager,
    logger,
    eventDispatcher,
    cache: cacheEntry.instance,
    cacheArgs: cacheEntry.args,
    queryCache: queryCache ?? queryEntry?.instance,
  };
};

describe('BodyGraphService additional branch coverage', () => {
  beforeAll(async () => {
    ({ BodyGraphService, LIMB_DETACHED_EVENT_ID } = await import(
      '../../../src/anatomy/bodyGraphService.js'
    ));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    cacheManagerInstances.length = 0;
    queryCacheInstances.length = 0;
    Object.values(mockAlgorithms).forEach((mockFn) => mockFn.mockReset());
  });

  it('validates constructor dependencies', () => {
    expect(() => new BodyGraphService({})).toThrow(
      new InvalidArgumentError('entityManager is required')
    );
    expect(
      () =>
        new BodyGraphService({
          entityManager: createEntityManager(),
          eventDispatcher: createDispatcher(),
        })
    ).toThrow(new InvalidArgumentError('logger is required'));
    expect(
      () =>
        new BodyGraphService({
          entityManager: createEntityManager(),
          logger: createLogger(),
        })
    ).toThrow(new InvalidArgumentError('eventDispatcher is required'));
  });

  it('builds adjacency cache only when missing and respects custom query cache', async () => {
    const customQueryCache = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(['cached-arm']),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn().mockReturnValue(['cached-root']),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };

    const { service, cache, cacheArgs } = buildService({
      queryCache: customQueryCache,
    });

    expect(cacheArgs[0]).toEqual({ logger: expect.any(Object) });
    expect(queryCacheInstances).toHaveLength(0);

    cache.hasCacheForRoot.mockReturnValueOnce(false).mockReturnValueOnce(true);
    await service.buildAdjacencyCache('root-1');
    await service.buildAdjacencyCache('root-1');

    expect(cache.buildCache).toHaveBeenCalledTimes(1);
    expect(cache.buildCache).toHaveBeenCalledWith('root-1', expect.any(Object));

    const parts = service.findPartsByType('root-1', 'arm');
    expect(parts).toEqual(['cached-arm']);
    expect(customQueryCache.getCachedFindPartsByType).toHaveBeenCalledWith(
      'root-1',
      'arm'
    );
    expect(mockAlgorithms.findPartsByType).not.toHaveBeenCalled();

    const allParts = service.getAllParts(
      { body: { root: 'root-1' } },
      'actor-1'
    );
    expect(allParts).toEqual(['cached-root']);
    expect(customQueryCache.getCachedGetAllParts).toHaveBeenCalledWith(
      'root-1'
    );
  });

  it('throws when detaching a part with no joint data', async () => {
    const { service, entityManager } = buildService();
    entityManager.getComponentData.mockReturnValueOnce(null);

    await expect(service.detachPart('arm-1')).rejects.toThrow(
      new InvalidArgumentError(
        "Entity 'arm-1' has no joint component - cannot detach"
      )
    );
  });

  it('detaches parts, invalidates caches, and dispatches events', async () => {
    mockAlgorithms.getSubgraph.mockReturnValue(['arm-1', 'hand-1']);
    mockAlgorithms.getAnatomyRoot.mockReturnValue('root-1');

    const { service, entityManager, cache, queryCache, eventDispatcher, logger } =
      buildService();

    entityManager.getComponentData.mockImplementation((entityId, componentId) => {
      if (componentId === 'anatomy:joint') {
        return { parentId: 'torso-1', socketId: 'shoulder' };
      }
      return null;
    });

    const result = await service.detachPart('arm-1', {
      cascade: true,
      reason: 'damage',
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
    expect(cache.invalidateCacheForRoot).toHaveBeenCalledWith('root-1');
    expect(queryCache.invalidateRoot).toHaveBeenCalledWith('root-1');
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'arm-1',
        detachedCount: 2,
        parentEntityId: 'torso-1',
        reason: 'damage',
        socketId: 'shoulder',
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      "BodyGraphService: Detached 2 entities from parent 'torso-1'"
    );
  });

  it('supports non-cascading detachment and path utilities', async () => {
    mockAlgorithms.getSubgraph.mockReturnValue(['arm-1', 'hand-1']);
    mockAlgorithms.getAnatomyRoot.mockReturnValue('root-1');
    mockAlgorithms.getPath.mockReturnValue(['arm-1', 'torso-1']);

    const { service, entityManager, cache } = buildService();

    entityManager.getComponentData.mockImplementation((entityId, componentId) => {
      if (componentId === 'anatomy:joint') {
        return { parentId: 'torso-1', socketId: 'shoulder' };
      }
      return null;
    });

    const result = await service.detachPart('arm-1', { cascade: false });
    expect(result.detached).toEqual(['arm-1']);
    expect(mockAlgorithms.getSubgraph).not.toHaveBeenCalled();

    cache.get.mockImplementation((id) => {
      if (id === 'arm-1') {
        return { parentId: 'torso-1', children: ['hand-1'] };
      }
      if (id === 'hand-1') {
        return { parentId: 'arm-1', children: [] };
      }
      if (id === 'torso-1') {
        return { parentId: null, children: ['arm-1'] };
      }
      return undefined;
    });

    expect(service.getAnatomyRoot('arm-1')).toBe('root-1');
    expect(service.getPath('arm-1', 'torso-1')).toEqual(['arm-1', 'torso-1']);
    expect(service.getChildren('torso-1')).toEqual(['arm-1']);
    expect(service.getChildren('unknown')).toEqual([]);
    expect(service.getParent('arm-1')).toBe('torso-1');
    expect(service.getParent('torso-1')).toBeNull();
    expect(service.getAncestors('hand-1')).toEqual(['arm-1', 'torso-1']);
  });

  it('handles getAllParts branching and caching', () => {
    const { service, cache, logger, queryCache } = buildService();

    // No body component
    expect(service.getAllParts(null)).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      'BodyGraphService.getAllParts: No bodyComponent provided'
    );

    logger.debug.mockClear();

    // Body component without roots
    expect(service.getAllParts({})).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      'BodyGraphService.getAllParts: No root ID found in bodyComponent'
    );

    logger.debug.mockClear();

    // Cached result path
    queryCache.getCachedGetAllParts.mockReturnValueOnce(['cached-1', 'cached-2']);
    expect(
      service.getAllParts(
        { body: { root: 'blueprint-root' } },
        'actor-1'
      )
    ).toEqual(['cached-1', 'cached-2']);

    logger.debug.mockClear();

    // Algorithm path with actor not in cache
    mockAlgorithms.getAllParts.mockReturnValueOnce(['torso-1', 'arm-1']);
    cache.size.mockReturnValueOnce(2);
    const resultFromAlgorithm = service.getAllParts(
      { body: { root: 'blueprint-root' } },
      'actor-2'
    );
    expect(resultFromAlgorithm).toEqual(['torso-1', 'arm-1']);
    expect(mockAlgorithms.getAllParts).toHaveBeenCalledWith(
      'blueprint-root',
      cache,
      expect.any(Object)
    );
    expect(queryCache.cacheGetAllParts).toHaveBeenCalledWith(
      'blueprint-root',
      ['torso-1', 'arm-1']
    );

    // Actor present in cache branch using bodyComponent.root
    mockAlgorithms.getAllParts.mockReturnValueOnce(['actor-2', 'arm-2']);
    cache.has.mockReturnValueOnce(true);
    cache.size.mockReturnValueOnce(1);
    const fromActorRoot = service.getAllParts({ root: 'blueprint-root' }, 'actor-2');
    expect(fromActorRoot).toEqual(['actor-2', 'arm-2']);
    expect(mockAlgorithms.getAllParts).toHaveBeenCalledWith(
      'actor-2',
      cache,
      expect.any(Object)
    );
  });

  it('evaluates components and nested values across parts', () => {
    const { service, entityManager } = buildService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['arm-1', 'hand-1']);

    entityManager.getComponentData.mockImplementation((id, componentId) => {
      if (componentId === 'status') {
        if (id === 'hand-1') return { flags: { locked: true } };
        if (id === 'arm-1') return {};
      }
      if (componentId === 'weapon:grip') {
        return id === 'arm-1' ? null : { capacity: 1 };
      }
      return undefined;
    });

    expect(service.hasPartWithComponent({}, 'weapon:grip')).toBe(true);
    expect(service.hasPartWithComponent({}, 'status')).toBe(true);
    expect(
      service.hasPartWithComponentValue(
        {},
        'status',
        'flags.locked',
        true
      )
    ).toEqual({ found: true, partId: 'hand-1' });
    expect(
      service.hasPartWithComponentValue(
        {},
        'status',
        'flags.locked',
        false
      )
    ).toEqual({ found: false });

    service.getAllParts.mockReturnValue(['arm-1']);
    entityManager.getComponentData.mockImplementation(() => null);
    expect(service.hasPartWithComponent({}, 'status')).toBe(false);
  });

  it('provides body graph information and validates cache utilities', async () => {
    const { service, entityManager, cache } = buildService();

    await expect(service.getBodyGraph('')).rejects.toThrow(
      new InvalidArgumentError('Entity ID is required and must be a string')
    );

    entityManager.getComponentData.mockResolvedValueOnce(null);
    await expect(service.getBodyGraph('actor-1')).rejects.toThrow(
      new Error('Entity actor-1 has no anatomy:body component')
    );

    const bodyComponent = { body: { root: 'actor-root' } };
    entityManager.getComponentData.mockResolvedValueOnce(bodyComponent);

    const buildSpy = jest
      .spyOn(service, 'buildAdjacencyCache')
      .mockResolvedValue(undefined);
    jest.spyOn(service, 'getAllParts').mockReturnValue(['actor-root']);

    cache.get.mockImplementation((id) =>
      id === 'actor-root' ? { children: ['arm-1'] } : undefined
    );

    const graph = await service.getBodyGraph('actor-1');
    expect(buildSpy).toHaveBeenCalledWith('actor-1');
    expect(graph.getAllPartIds()).toEqual(['actor-root']);
    expect(graph.getConnectedParts('actor-root')).toEqual(['arm-1']);
    expect(graph.getConnectedParts('unknown')).toEqual([]);
  });

  it('returns anatomy metadata and exposes cache helpers', async () => {
    const { service, entityManager, cache } = buildService();

    await expect(service.getAnatomyData('')).rejects.toThrow(
      new InvalidArgumentError('Entity ID is required and must be a string')
    );

    entityManager.getComponentData.mockResolvedValueOnce(null);
    expect(await service.getAnatomyData('actor-1')).toBeNull();

    entityManager.getComponentData.mockResolvedValueOnce({ recipeId: 'recipe-9' });
    expect(await service.getAnatomyData('actor-1')).toEqual({
      recipeId: 'recipe-9',
      rootEntityId: 'actor-1',
    });

    const { valid, issues } = service.validateCache();
    expect(valid).toBe(true);
    expect(issues).toEqual([]);

    cache.hasCacheForRoot.mockReturnValueOnce(true);
    expect(service.hasCache('actor-1')).toBe(true);

    mockAlgorithms.getSubgraph.mockReturnValue(['actor-1', 'arm-1', 'hand-1']);
    expect(service.getAllDescendants('actor-1')).toEqual(['arm-1', 'hand-1']);
  });
});
