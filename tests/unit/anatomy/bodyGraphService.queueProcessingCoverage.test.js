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
      get: jest.fn(),
      has: jest.fn().mockReturnValue(false),
      size: jest.fn().mockReturnValue(0),
      validateCache: jest.fn().mockReturnValue({ valid: true, issues: [] }),
    };
    cacheManagerInstances.push({ instance, args });
    return instance;
  }),
}));

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => ({
  __esModule: true,
  AnatomyQueryCache: jest.fn().mockImplementation((...args) => {
    const instance = {
      getCachedFindPartsByType: jest.fn(),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn(),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };
    queryCacheInstances.push({ instance, args });
    return instance;
  }),
}));

let BodyGraphService;
let LIMB_DETACHED_EVENT_ID;

beforeAll(async () => {
  ({ BodyGraphService, LIMB_DETACHED_EVENT_ID } = await import(
    '../../../src/anatomy/bodyGraphService.js'
  ));
});

beforeEach(() => {
  jest.clearAllMocks();
  cacheManagerInstances.length = 0;
  queryCacheInstances.length = 0;
  Object.values(mockAlgorithms).forEach((fn) => fn.mockReset());
});

function createService(overrides = {}) {
  const entityManager = {
    getComponentData: jest.fn().mockReturnValue(undefined),
    removeComponent: jest.fn().mockResolvedValue(undefined),
    ...overrides.entityManager,
  };
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    ...overrides.logger,
  };
  const eventDispatcher = {
    dispatch: jest.fn().mockResolvedValue(undefined),
    ...overrides.eventDispatcher,
  };

  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
    queryCache: overrides.queryCache,
  });

  const cacheEntry = cacheManagerInstances.at(-1);
  const cacheInstance = cacheEntry?.instance;
  const cacheArgs = cacheEntry?.args ?? [];
  const queryEntry = overrides.queryCache ? null : queryCacheInstances.at(-1);
  const queryCacheInstance = overrides.queryCache
    ? overrides.queryCache
    : queryEntry?.instance;

  return {
    service,
    entityManager,
    logger,
    eventDispatcher,
    cacheInstance,
    cacheArgs,
    queryCacheInstance,
  };
}

describe('BodyGraphService queue and cache behaviour', () => {
  it('constructs with provided query cache and avoids rebuilding existing caches', async () => {
    const customQueryCache = {
      getCachedFindPartsByType: jest.fn(),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn(),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };

    const { service, cacheInstance, cacheArgs, entityManager, logger } = createService({
      queryCache: customQueryCache,
    });

    expect(cacheInstance).toBeDefined();
    expect(cacheArgs[0]).toEqual({ logger });
    expect(queryCacheInstances).toHaveLength(0);

    cacheInstance.hasCacheForRoot.mockReturnValueOnce(false).mockReturnValue(true);
    await service.buildAdjacencyCache('actor-1');
    await service.buildAdjacencyCache('actor-1');

    expect(cacheInstance.buildCache).toHaveBeenCalledTimes(1);
    expect(cacheInstance.buildCache).toHaveBeenCalledWith('actor-1', entityManager);
  });

  it('handles detachment workflows and caches query results', async () => {
    const { service, entityManager, cacheInstance, queryCacheInstance, eventDispatcher, logger } =
      createService();

    expect(cacheInstance).toBeDefined();
    expect(queryCacheInstance).toBeDefined();

    entityManager.getComponentData.mockImplementation((id, componentId) => {
      if (componentId === 'anatomy:joint') {
        return { parentId: 'torso', socketId: 'shoulder' };
      }
      if (componentId === 'custom:status') {
        return id === 'hand' ? { state: { value: 'online' } } : null;
      }
      if (componentId === 'custom:flag') {
        return id === 'arm' ? {} : null;
      }
      return null;
    });

    mockAlgorithms.getSubgraph.mockReturnValue(['arm', 'hand']);
    mockAlgorithms.getAnatomyRoot.mockReturnValue('root-1');

    const result = await service.detachPart('arm', { reason: 'scripted' });

    expect(mockAlgorithms.getSubgraph).toHaveBeenCalledWith('arm', cacheInstance);
    expect(entityManager.removeComponent).toHaveBeenCalledWith('arm', 'anatomy:joint');
    expect(cacheInstance.invalidateCacheForRoot).toHaveBeenCalledWith('root-1');
    expect(queryCacheInstance.invalidateRoot).toHaveBeenCalledWith('root-1');
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'arm',
        parentEntityId: 'torso',
        socketId: 'shoulder',
        detachedCount: 2,
        reason: 'scripted',
        timestamp: expect.any(Number),
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      "BodyGraphService: Detached 2 entities from parent 'torso'"
    );
    expect(result).toEqual({ detached: ['arm', 'hand'], parentId: 'torso', socketId: 'shoulder' });

    mockAlgorithms.getAnatomyRoot.mockReturnValueOnce(null);
    await service.detachPart('hand', { cascade: false });
    expect(mockAlgorithms.getSubgraph).toHaveBeenCalledTimes(1);
    expect(cacheInstance.invalidateCacheForRoot).toHaveBeenCalledTimes(1);
    expect(queryCacheInstance.invalidateRoot).toHaveBeenCalledTimes(1);

    queryCacheInstance.getCachedFindPartsByType.mockReturnValueOnce(['cached-arm']);
    expect(service.findPartsByType('actor-2', 'arm')).toEqual(['cached-arm']);
    expect(mockAlgorithms.findPartsByType).not.toHaveBeenCalled();

    queryCacheInstance.getCachedFindPartsByType.mockReturnValueOnce(undefined);
    mockAlgorithms.findPartsByType.mockReturnValue(['fresh-leg']);
    expect(service.findPartsByType('actor-2', 'leg')).toEqual(['fresh-leg']);
    expect(mockAlgorithms.findPartsByType).toHaveBeenCalledWith('actor-2', 'leg', cacheInstance);
    expect(queryCacheInstance.cacheFindPartsByType).toHaveBeenCalledWith('actor-2', 'leg', [
      'fresh-leg',
    ]);

    queryCacheInstance.getCachedGetAllParts.mockReturnValue(['arm', 'hand']);
    expect(service.hasPartWithComponent({ root: 'torso' }, 'custom:flag')).toBe(false);
    expect(
      service.hasPartWithComponentValue(
        { root: 'torso' },
        'custom:status',
        'state.value',
        'online'
      )
    ).toEqual({ found: true, partId: 'hand' });
    expect(
      service.hasPartWithComponentValue(
        { root: 'torso' },
        'custom:status',
        'state.value',
        'offline'
      )
    ).toEqual({ found: false });
  });

  it('navigates anatomy graphs, caching results and exposing helper methods', () => {
    const { service, cacheInstance, queryCacheInstance, logger } = createService();

    expect(cacheInstance).toBeDefined();
    expect(queryCacheInstance).toBeDefined();

    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({})).toEqual([]);

    queryCacheInstance.getCachedGetAllParts.mockReturnValueOnce(['cached-part']);
    expect(service.getAllParts({ root: 'torso' })).toEqual(['cached-part']);

    queryCacheInstance.getCachedGetAllParts.mockReturnValueOnce(undefined);
    cacheInstance.has.mockReturnValueOnce(false);
    cacheInstance.size.mockReturnValueOnce(1);
    mockAlgorithms.getAllParts.mockReturnValueOnce(['torso', 'arm', 'hand']);

    const partsFromBlueprint = service.getAllParts({ body: { root: 'torso' } }, 'actor-3');
    expect(partsFromBlueprint).toEqual(['torso', 'arm', 'hand']);
    expect(logger.debug).toHaveBeenCalledWith(
      "BodyGraphService: Using blueprint root 'torso' as cache root (actor 'actor-3' not in cache, cache size: 1)"
    );
    expect(queryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith('torso', [
      'torso',
      'arm',
      'hand',
    ]);

    queryCacheInstance.getCachedGetAllParts.mockReturnValueOnce(undefined);
    cacheInstance.has.mockImplementation((id) => id === 'actor-3');
    cacheInstance.size.mockReturnValueOnce(2);
    mockAlgorithms.getAllParts.mockReturnValueOnce(['actor-3', 'arm']);
    expect(service.getAllParts({ root: 'torso' }, 'actor-3')).toEqual(['actor-3', 'arm']);
    expect(logger.debug).toHaveBeenCalledWith(
      "BodyGraphService: Using actor entity 'actor-3' as cache root instead of blueprint root 'torso' (cache size: 2)"
    );

    expect(service.getAnatomyRoot('arm')).toBeUndefined();
    mockAlgorithms.getAnatomyRoot.mockReturnValueOnce('root-9');
    expect(service.getAnatomyRoot('arm')).toBe('root-9');

    mockAlgorithms.getPath.mockReturnValueOnce(['torso', 'arm']);
    expect(service.getPath('torso', 'arm')).toEqual(['torso', 'arm']);

    cacheInstance.get.mockImplementation((id) => {
      if (id === 'arm') return { parentId: 'torso', children: ['hand'] };
      if (id === 'hand') return { parentId: 'arm', children: [] };
      return null;
    });
    mockAlgorithms.getSubgraph.mockReturnValueOnce(['arm', 'hand']);
    expect(service.getChildren('arm')).toEqual(['hand']);
    expect(service.getChildren('unknown')).toEqual([]);
    expect(service.getParent('hand')).toBe('arm');
    expect(service.getParent('missing')).toBeNull();
    expect(service.getAncestors('hand')).toEqual(['arm', 'torso']);
    expect(service.getAllDescendants('arm')).toEqual(['hand']);

    cacheInstance.validateCache.mockReturnValueOnce({ valid: false, issues: ['warn'] });
    expect(service.validateCache()).toEqual({ valid: false, issues: ['warn'] });
    cacheInstance.hasCacheForRoot.mockReturnValueOnce(true);
    expect(service.hasCache('torso')).toBe(true);
  });

  it('validates body graph and anatomy metadata flows', async () => {
    const { service, entityManager, cacheInstance, logger } = createService();

    await expect(service.detachPart('no-joint')).rejects.toBeInstanceOf(InvalidArgumentError);

    await expect(service.getBodyGraph('')).rejects.toBeInstanceOf(InvalidArgumentError);
    await expect(service.getBodyGraph(42)).rejects.toBeInstanceOf(InvalidArgumentError);

    entityManager.getComponentData.mockResolvedValueOnce(null);
    await expect(service.getBodyGraph('actor-1')).rejects.toThrow(
      'Entity actor-1 has no anatomy:body component'
    );

    entityManager.getComponentData.mockResolvedValue({ body: { root: 'torso' } });
    mockAlgorithms.getAllParts.mockReturnValue(['torso', 'arm']);
    cacheInstance.get.mockImplementation((id) => {
      if (id === 'torso') return { children: ['arm'], parentId: null };
      if (id === 'arm') return { children: ['hand'], parentId: 'torso' };
      return null;
    });
    const graph = await service.getBodyGraph('actor-1');
    expect(cacheInstance.buildCache).toHaveBeenCalledWith('actor-1', entityManager);
    expect(graph.getAllPartIds()).toEqual(['torso', 'arm']);
    expect(graph.getConnectedParts('arm')).toEqual(['hand']);
    expect(graph.getConnectedParts('missing')).toEqual([]);

    await expect(service.getAnatomyData('')).rejects.toBeInstanceOf(InvalidArgumentError);
    await expect(service.getAnatomyData(5)).rejects.toBeInstanceOf(InvalidArgumentError);

    entityManager.getComponentData.mockResolvedValueOnce(null);
    await expect(service.getAnatomyData('actor-2')).resolves.toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      "BodyGraphService.getAnatomyData: Entity 'actor-2' has no anatomy:body component"
    );

    entityManager.getComponentData.mockResolvedValueOnce({ recipeId: 'recipe-1' });
    await expect(service.getAnatomyData('actor-2')).resolves.toEqual({
      recipeId: 'recipe-1',
      rootEntityId: 'actor-2',
    });

    entityManager.getComponentData.mockResolvedValueOnce({});
    await expect(service.getAnatomyData('actor-2')).resolves.toEqual({
      recipeId: null,
      rootEntityId: 'actor-2',
    });
  });
});
