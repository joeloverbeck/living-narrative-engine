import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

const mockAlgorithms = {
  getSubgraph: jest.fn(),
  findPartsByType: jest.fn(),
  getAnatomyRoot: jest.fn(),
  getPath: jest.fn(),
  getAllParts: jest.fn(),
};

jest.mock('../../../src/anatomy/anatomyGraphAlgorithms.js', () => ({
  __esModule: true,
  AnatomyGraphAlgorithms: mockAlgorithms,
}));

const cacheManagerInstances = [];
jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => ({
  __esModule: true,
  AnatomyCacheManager: jest.fn().mockImplementation(() => {
    const instance = {
      hasCacheForRoot: jest.fn().mockReturnValue(false),
      buildCache: jest.fn().mockResolvedValue(undefined),
      invalidateCacheForRoot: jest.fn(),
      get: jest.fn(),
      has: jest.fn().mockReturnValue(false),
      size: jest.fn().mockReturnValue(0),
      validateCache: jest.fn().mockReturnValue({ valid: true, issues: [] }),
    };
    cacheManagerInstances.push(instance);
    return instance;
  }),
  __cacheInstances: cacheManagerInstances,
}));

const queryCacheInstances = [];
jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => ({
  __esModule: true,
  AnatomyQueryCache: jest.fn().mockImplementation(() => {
    const instance = {
      getCachedFindPartsByType: jest.fn(),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn(),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };
    queryCacheInstances.push(instance);
    return instance;
  }),
  __queryCacheInstances: queryCacheInstances,
}));

jest.mock('../../../src/anatomy/constants/anatomyConstants.js', () => ({
  __esModule: true,
  ANATOMY_CONSTANTS: { LIMB_DETACHED_EVENT_ID: 'event:detached' },
}));

let BodyGraphService;
let LIMB_DETACHED_EVENT_ID;
let AnatomyCacheModule;
let AnatomyQueryCacheModule;

beforeAll(async () => {
  AnatomyCacheModule = await import('../../../src/anatomy/anatomyCacheManager.js');
  AnatomyQueryCacheModule = await import('../../../src/anatomy/cache/AnatomyQueryCache.js');
  ({ BodyGraphService, LIMB_DETACHED_EVENT_ID } = await import(
    '../../../src/anatomy/bodyGraphService.js'
  ));
});

beforeEach(() => {
  jest.clearAllMocks();
  AnatomyCacheModule.__cacheInstances.length = 0;
  AnatomyQueryCacheModule.__queryCacheInstances.length = 0;
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
    error: jest.fn(),
    ...overrides.logger,
  };
  const eventDispatcher = {
    dispatch: jest.fn().mockResolvedValue(undefined),
    ...overrides.eventDispatcher,
  };
  const queryCache = overrides.queryCache;

  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
    queryCache,
  });

  const cacheInstance = AnatomyCacheModule.__cacheInstances.at(-1);
  const queryCacheInstance = queryCache
    ? queryCache
    : AnatomyQueryCacheModule.__queryCacheInstances.at(-1);

  return {
    service,
    entityManager,
    logger,
    eventDispatcher,
    cacheInstance,
    queryCacheInstance,
  };
}

describe('BodyGraphService high coverage', () => {
  it('wires dependencies and exposes limb event constant', () => {
    const { logger, cacheInstance, queryCacheInstance } = createService();

    expect(AnatomyCacheModule.AnatomyCacheManager).toHaveBeenCalledWith({ logger });
    expect(AnatomyQueryCacheModule.AnatomyQueryCache).toHaveBeenCalledWith({ logger });
    expect(cacheInstance).toBeDefined();
    expect(queryCacheInstance).toBeDefined();
    expect(LIMB_DETACHED_EVENT_ID).toBe('event:detached');
  });

  it('throws descriptive errors when required dependencies are missing', async () => {
    await expect(
      () =>
        new BodyGraphService({
          logger: { debug: jest.fn() },
          eventDispatcher: { dispatch: jest.fn() },
        })
    ).toThrow(new InvalidArgumentError('entityManager is required'));

    await expect(
      () =>
        new BodyGraphService({
          entityManager: { getComponentData: jest.fn() },
          eventDispatcher: { dispatch: jest.fn() },
        })
    ).toThrow(new InvalidArgumentError('logger is required'));

    await expect(
      () =>
        new BodyGraphService({
          entityManager: { getComponentData: jest.fn() },
          logger: { debug: jest.fn() },
        })
    ).toThrow(new InvalidArgumentError('eventDispatcher is required'));
  });

  it('uses provided query cache instance when supplied', () => {
    const customQueryCache = {
      getCachedFindPartsByType: jest.fn(),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn(),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };

    const { queryCacheInstance } = createService({ queryCache: customQueryCache });

    expect(queryCacheInstance).toBe(customQueryCache);
    expect(AnatomyQueryCacheModule.AnatomyQueryCache).not.toHaveBeenCalled();
  });

  it('builds adjacency cache only when missing', async () => {
    const { service, cacheInstance, entityManager } = createService();
    cacheInstance.hasCacheForRoot.mockReturnValueOnce(false).mockReturnValue(true);

    await service.buildAdjacencyCache('actor-1');
    await service.buildAdjacencyCache('actor-1');

    expect(cacheInstance.buildCache).toHaveBeenCalledTimes(1);
    expect(cacheInstance.buildCache).toHaveBeenCalledWith('actor-1', entityManager);
  });

  it('throws when detaching a part without joint data', async () => {
    const { service, entityManager } = createService();
    entityManager.getComponentData.mockReturnValue(undefined);

    await expect(service.detachPart('torso')).rejects.toBeInstanceOf(InvalidArgumentError);
  });

  it('detaches part with cascade and invalidates caches', async () => {
    const { service, entityManager, cacheInstance, queryCacheInstance, eventDispatcher, logger } =
      createService();

    entityManager.getComponentData.mockImplementation((id, component) => {
      if (component === 'anatomy:joint') {
        return { parentId: 'torso', socketId: 'shoulder' };
      }
      return null;
    });
    mockAlgorithms.getSubgraph.mockReturnValue(['arm', 'hand']);
    mockAlgorithms.getAnatomyRoot.mockReturnValue('root-1');

    const result = await service.detachPart('arm');

    expect(mockAlgorithms.getSubgraph).toHaveBeenCalledWith('arm', cacheInstance);
    expect(entityManager.removeComponent).toHaveBeenCalledWith('arm', 'anatomy:joint');
    expect(cacheInstance.invalidateCacheForRoot).toHaveBeenCalledWith('root-1');
    expect(queryCacheInstance.invalidateRoot).toHaveBeenCalledWith('root-1');
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      'event:detached',
      expect.objectContaining({
        detachedEntityId: 'arm',
        parentEntityId: 'torso',
        socketId: 'shoulder',
        detachedCount: 2,
        reason: 'manual',
        timestamp: expect.any(Number),
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      "BodyGraphService: Detached 2 entities from parent 'torso'"
    );
    expect(result).toEqual({ detached: ['arm', 'hand'], parentId: 'torso', socketId: 'shoulder' });
  });

  it('supports non-cascading detachment with custom reason', async () => {
    const { service, entityManager, cacheInstance, queryCacheInstance } = createService();

    entityManager.getComponentData.mockImplementation((id, component) => {
      if (component === 'anatomy:joint') {
        return { parentId: 'torso', socketId: 'elbow' };
      }
      return null;
    });
    mockAlgorithms.getSubgraph.mockReturnValue(['arm']);
    mockAlgorithms.getAnatomyRoot.mockReturnValue('root-7');

    const result = await service.detachPart('arm', { cascade: false, reason: 'scripted' });

    expect(mockAlgorithms.getSubgraph).not.toHaveBeenCalled();
    expect(cacheInstance.invalidateCacheForRoot).toHaveBeenCalledWith('root-7');
    expect(queryCacheInstance.invalidateRoot).toHaveBeenCalledWith('root-7');
    expect(result).toEqual({ detached: ['arm'], parentId: 'torso', socketId: 'elbow' });
  });

  it('skips cache invalidation when anatomy root cannot be resolved', async () => {
    const { service, entityManager, cacheInstance, queryCacheInstance, eventDispatcher } =
      createService();

    entityManager.getComponentData.mockImplementation((id, component) => {
      if (component === 'anatomy:joint') {
        return { parentId: 'torso', socketId: 'wrist' };
      }
      return null;
    });
    mockAlgorithms.getSubgraph.mockReturnValue(['hand']);
    mockAlgorithms.getAnatomyRoot.mockReturnValue(null);

    const result = await service.detachPart('hand');

    expect(cacheInstance.invalidateCacheForRoot).not.toHaveBeenCalled();
    expect(queryCacheInstance.invalidateRoot).not.toHaveBeenCalled();
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      'event:detached',
      expect.objectContaining({
        detachedEntityId: 'hand',
        parentEntityId: 'torso',
        socketId: 'wrist',
        detachedCount: 1,
      })
    );
    expect(result).toEqual({ detached: ['hand'], parentId: 'torso', socketId: 'wrist' });
  });

  it('findPartsByType leverages caching and updates cache when missing', () => {
    const { service, cacheInstance, queryCacheInstance } = createService();

    queryCacheInstance.getCachedFindPartsByType.mockReturnValue(['cached-arm']);
    const cached = service.findPartsByType('actor-1', 'arm');
    expect(cached).toEqual(['cached-arm']);
    expect(mockAlgorithms.findPartsByType).not.toHaveBeenCalled();

    queryCacheInstance.getCachedFindPartsByType.mockReturnValue(undefined);
    mockAlgorithms.findPartsByType.mockReturnValue(['fresh-leg']);

    const fresh = service.findPartsByType('actor-1', 'leg');
    expect(fresh).toEqual(['fresh-leg']);
    expect(mockAlgorithms.findPartsByType).toHaveBeenCalledWith('actor-1', 'leg', cacheInstance);
    expect(queryCacheInstance.cacheFindPartsByType).toHaveBeenCalledWith(
      'actor-1',
      'leg',
      ['fresh-leg']
    );
  });

  it('delegates root and path queries to AnatomyGraphAlgorithms', () => {
    const { service, cacheInstance } = createService();
    mockAlgorithms.getAnatomyRoot.mockReturnValue('root-id');
    mockAlgorithms.getPath.mockReturnValue(['a', 'b']);

    expect(service.getAnatomyRoot('part-9')).toBe('root-id');
    expect(mockAlgorithms.getAnatomyRoot).toHaveBeenCalledWith('part-9', cacheInstance, expect.any(Object));

    expect(service.getPath('from', 'to')).toEqual(['a', 'b']);
    expect(mockAlgorithms.getPath).toHaveBeenCalledWith('from', 'to', cacheInstance);
  });

  it('getAllParts handles missing data and caches generated results', () => {
    const { service, cacheInstance, queryCacheInstance, logger } = createService();

    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({})).toEqual([]);

    queryCacheInstance.getCachedGetAllParts.mockReturnValue(['cached-part']);
    expect(service.getAllParts({ root: 'torso' })).toEqual(['cached-part']);
    expect(mockAlgorithms.getAllParts).not.toHaveBeenCalled();

    queryCacheInstance.getCachedGetAllParts.mockReturnValue(undefined);
    cacheInstance.has.mockReturnValue(false);
    mockAlgorithms.getAllParts.mockReturnValue(['torso', 'arm']);

    const result = service.getAllParts({ body: { root: 'torso' } }, 'actor-2');

    expect(logger.debug).toHaveBeenCalledWith(
      "BodyGraphService.getAllParts: Found root ID in bodyComponent.body.root: torso"
    );
    expect(mockAlgorithms.getAllParts).toHaveBeenCalledWith('torso', cacheInstance, expect.any(Object));
    expect(queryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith('torso', ['torso', 'arm']);
    expect(result).toEqual(['torso', 'arm']);
  });

  it('logs truncated output when anatomy graph contains many parts', () => {
    const { service, cacheInstance, queryCacheInstance, logger } = createService();

    queryCacheInstance.getCachedGetAllParts.mockReturnValue(undefined);
    cacheInstance.has.mockReturnValue(false);
    cacheInstance.size.mockReturnValue(2);

    const longResult = ['root', 'arm', 'leg', 'head', 'torso', 'hand', 'foot'];
    mockAlgorithms.getAllParts.mockReturnValue(longResult);

    const parts = service.getAllParts({ root: 'root' }, 'actor-1');

    expect(parts).toEqual(longResult);
    const logMessage = logger.debug.mock.calls
      .map((call) => call[0])
      .find((message) =>
        message?.startsWith(
          'BodyGraphService: AnatomyGraphAlgorithms.getAllParts returned'
        )
      );
    expect(logMessage).toContain('...');
  });

  it('prefers actor cache root when available', () => {
    const { service, cacheInstance, queryCacheInstance, logger } = createService();

    queryCacheInstance.getCachedGetAllParts.mockReturnValue(undefined);
    cacheInstance.has.mockImplementation((id) => id === 'actor-7');
    cacheInstance.size.mockReturnValue(3);
    mockAlgorithms.getAllParts.mockReturnValue(['actor-7', 'arm']);

    const result = service.getAllParts({ root: 'torso' }, 'actor-7');

    expect(logger.debug).toHaveBeenCalledWith(
      "BodyGraphService: Using actor entity 'actor-7' as cache root instead of blueprint root 'torso' (cache size: 3)"
    );
    expect(mockAlgorithms.getAllParts).toHaveBeenCalledWith('actor-7', cacheInstance, expect.any(Object));
    expect(queryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith('actor-7', ['actor-7', 'arm']);
    expect(result).toEqual(['actor-7', 'arm']);
  });

  it('detects components and values across all parts', () => {
    const { service, entityManager, queryCacheInstance } = createService();

    queryCacheInstance.getCachedGetAllParts.mockReturnValue(['arm', 'leg']);
    entityManager.getComponentData.mockImplementation((id, component) => {
      if (component === 'custom:flag') {
        if (id === 'arm') return {};
        if (id === 'leg') return { locked: true };
      }
      if (component === 'custom:status' && id === 'arm') {
        return { state: { value: 'online' } };
      }
      return null;
    });

    expect(service.hasPartWithComponent({ root: 'torso' }, 'custom:flag')).toBe(true);
    expect(service.hasPartWithComponent({ root: 'torso' }, 'missing:comp')).toBe(false);

    expect(
      service.hasPartWithComponentValue(
        { root: 'torso' },
        'custom:status',
        'state.value',
        'online'
      )
    ).toEqual({ found: true, partId: 'arm' });
    expect(
      service.hasPartWithComponentValue(
        { root: 'torso' },
        'custom:status',
        'state.value',
        'offline'
      )
    ).toEqual({ found: false });
  });

  it('treats missing nested properties as undefined when matching component values', () => {
    const { service, entityManager, queryCacheInstance } = createService();

    queryCacheInstance.getCachedGetAllParts.mockReturnValue(['elbow']);
    entityManager.getComponentData.mockImplementation((id, component) => {
      if (id === 'elbow' && component === 'custom:status') {
        return {};
      }
      return null;
    });

    const result = service.hasPartWithComponentValue(
      { root: 'root' },
      'custom:status',
      'state.value',
      'online'
    );

    expect(result).toEqual({ found: false });
    expect(entityManager.getComponentData).toHaveBeenCalledWith('elbow', 'custom:status');
  });

  it('validates inputs and exposes helpers from getBodyGraph', async () => {
    const { service, entityManager, cacheInstance } = createService();

    await expect(service.getBodyGraph('')).rejects.toBeInstanceOf(InvalidArgumentError);
    await expect(service.getBodyGraph(5)).rejects.toBeInstanceOf(InvalidArgumentError);

    entityManager.getComponentData.mockReturnValue(undefined);
    await expect(service.getBodyGraph('actor-1')).rejects.toThrow(
      'Entity actor-1 has no anatomy:body component'
    );

    entityManager.getComponentData.mockReturnValue({ body: { root: 'root-1' } });
    mockAlgorithms.getAllParts.mockReturnValue(['actor-1', 'arm']);
    cacheInstance.get.mockImplementation((id) => {
      if (id === 'arm') {
        return { children: ['hand'], parentId: 'torso' };
      }
      if (id === 'torso') {
        return { children: ['arm'], parentId: null };
      }
      return null;
    });

    const graph = await service.getBodyGraph('actor-1');
    expect(cacheInstance.buildCache).toHaveBeenCalledWith('actor-1', entityManager);
    expect(graph.getAllPartIds()).toEqual(['actor-1', 'arm']);
    expect(graph.getConnectedParts('arm')).toEqual(['hand']);
    expect(graph.getConnectedParts('unknown')).toEqual([]);
  });

  it('returns anatomy metadata and logs missing components', async () => {
    const { service, entityManager, logger } = createService();

    await expect(service.getAnatomyData('')).rejects.toBeInstanceOf(InvalidArgumentError);
    await expect(service.getAnatomyData(42)).rejects.toBeInstanceOf(InvalidArgumentError);

    entityManager.getComponentData.mockReturnValue(null);
    await expect(service.getAnatomyData('actor-5')).resolves.toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      "BodyGraphService.getAnatomyData: Entity 'actor-5' has no anatomy:body component"
    );

    entityManager.getComponentData.mockReturnValue({ recipeId: 'recipe-9' });
    await expect(service.getAnatomyData('actor-5')).resolves.toEqual({
      recipeId: 'recipe-9',
      rootEntityId: 'actor-5',
    });

    entityManager.getComponentData.mockReturnValue({});
    await expect(service.getAnatomyData('actor-5')).resolves.toEqual({
      recipeId: null,
      rootEntityId: 'actor-5',
    });
  });

  it('delegates cache helpers and ancestry queries', () => {
    const { service, cacheInstance } = createService();

    cacheInstance.validateCache.mockReturnValue({ valid: false, issues: ['issue'] });
    cacheInstance.hasCacheForRoot.mockReturnValue(true);
    cacheInstance.get.mockImplementation((id) => {
      if (id === 'hand') return { parentId: 'arm', children: [] };
      if (id === 'arm') return { parentId: 'torso', children: ['hand'] };
      if (id === 'torso') return { parentId: null, children: ['arm'] };
      return null;
    });
    mockAlgorithms.getSubgraph.mockReturnValue(['arm', 'hand', 'finger']);

    expect(service.validateCache()).toEqual({ valid: false, issues: ['issue'] });
    expect(service.hasCache('root-1')).toBe(true);
    expect(service.getChildren('arm')).toEqual(['hand']);
    expect(service.getChildren('unknown')).toEqual([]);
    expect(service.getParent('hand')).toBe('arm');
    expect(service.getParent('unknown')).toBeNull();
    expect(service.getAncestors('hand')).toEqual(['arm', 'torso']);
    expect(service.getAllDescendants('arm')).toEqual(['hand', 'finger']);
  });
});
