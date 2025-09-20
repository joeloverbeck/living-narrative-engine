import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
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

let BodyGraphService;
let AnatomyCacheModule;
let AnatomyQueryCacheModule;

beforeAll(async () => {
  AnatomyCacheModule = await import('../../../src/anatomy/anatomyCacheManager.js');
  AnatomyQueryCacheModule = await import('../../../src/anatomy/cache/AnatomyQueryCache.js');
  ({ default: BodyGraphService } = await import('../../../src/anatomy/bodyGraphService.js'));
});

beforeEach(() => {
  jest.clearAllMocks();
  AnatomyCacheModule.__cacheInstances.length = 0;
  AnatomyQueryCacheModule.__queryCacheInstances.length = 0;
  Object.values(mockAlgorithms).forEach((fn) => fn.mockReset());
});

function createEntityManager(overrides = {}) {
  return {
    getComponentData: jest.fn(),
    removeComponent: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  };
}

function createEventDispatcher() {
  return {
    dispatch: jest.fn().mockResolvedValue(undefined),
  };
}

function createService(options = {}) {
  const entityManager = options.entityManager ?? createEntityManager();
  const logger = options.logger ?? createLogger();
  const eventDispatcher = options.eventDispatcher ?? createEventDispatcher();
  const queryCache = options.queryCache;

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

describe('BodyGraphService targeted coverage', () => {
  it('validates entity identifiers in getAnatomyData', async () => {
    const { service } = createService();
    await expect(service.getAnatomyData(null)).rejects.toBeInstanceOf(
      InvalidArgumentError
    );
    await expect(service.getAnatomyData(42)).rejects.toBeInstanceOf(
      InvalidArgumentError
    );
  });

  it('handles missing anatomy components when resolving anatomy data', async () => {
    const { service, entityManager, logger } = createService();
    entityManager.getComponentData.mockReturnValue(null);

    const result = await service.getAnatomyData('actor-42');

    expect(result).toBeNull();
    expect(entityManager.getComponentData).toHaveBeenCalledWith(
      'actor-42',
      'anatomy:body'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "BodyGraphService.getAnatomyData: Entity 'actor-42' has no anatomy:body component"
    );
  });

  it('returns anatomy metadata with and without recipe identifiers', async () => {
    const { service, entityManager } = createService();
    entityManager.getComponentData
      .mockReturnValueOnce({ recipeId: 'recipe-7' })
      .mockReturnValueOnce({});

    await expect(service.getAnatomyData('actor-7')).resolves.toEqual({
      recipeId: 'recipe-7',
      rootEntityId: 'actor-7',
    });

    await expect(service.getAnatomyData('actor-7')).resolves.toEqual({
      recipeId: null,
      rootEntityId: 'actor-7',
    });
  });

  it('logs when large part collections are cached during getAllParts', () => {
    const { service, cacheInstance, queryCacheInstance, logger, entityManager } =
      createService();
    const blueprint = { body: { root: 'root-77' } };
    cacheInstance.has.mockReturnValue(false);
    queryCacheInstance.getCachedGetAllParts.mockReturnValue(undefined);
    const largeResult = ['a', 'b', 'c', 'd', 'e', 'f'];
    mockAlgorithms.getAllParts.mockReturnValue(largeResult);

    const parts = service.getAllParts(blueprint);

    expect(parts).toEqual(largeResult);
    expect(mockAlgorithms.getAllParts).toHaveBeenCalledWith(
      'root-77',
      cacheInstance,
      entityManager
    );
    expect(queryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith(
      'root-77',
      largeResult
    );
    expect(
      logger.debug.mock.calls.some((call) => call[0]?.includes('...'))
    ).toBe(true);
  });

  it('skips cache invalidation when detachPart cannot resolve a root entity', async () => {
    const { service, entityManager, cacheInstance, queryCacheInstance, eventDispatcher } =
      createService();

    entityManager.getComponentData.mockReturnValue({
      parentId: 'parent-99',
      socketId: 'socket-1',
    });
    mockAlgorithms.getSubgraph.mockReturnValue(['part-99']);
    mockAlgorithms.getAnatomyRoot.mockReturnValue(null);

    const originalNow = Date.now;
    Date.now = jest.fn().mockReturnValue(123456);

    try {
      const result = await service.detachPart('part-99', { cascade: false });

      expect(result).toEqual({
        detached: ['part-99'],
        parentId: 'parent-99',
        socketId: 'socket-1',
      });
      expect(cacheInstance.invalidateCacheForRoot).not.toHaveBeenCalled();
      expect(queryCacheInstance.invalidateRoot).not.toHaveBeenCalled();
      expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          detachedEntityId: 'part-99',
          parentEntityId: 'parent-99',
          detachedCount: 1,
          timestamp: 123456,
        })
      );
    } finally {
      Date.now = originalNow;
    }
  });
});
