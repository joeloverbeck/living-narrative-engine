import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
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

describe('BodyGraphService branch completion scenarios', () => {
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
    jest.clearAllMocks();

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

  it('creates a default query cache when one is not provided', () => {
    AnatomyQueryCache.mockClear();

    const serviceWithoutCache = new BodyGraphService({
      entityManager: entityManagerMock,
      logger: loggerMock,
      eventDispatcher: eventDispatcherMock,
    });

    expect(serviceWithoutCache).toBeInstanceOf(BodyGraphService);
    expect(AnatomyQueryCache).toHaveBeenCalledTimes(1);
    expect(AnatomyQueryCache).toHaveBeenCalledWith({ logger: loggerMock });
  });

  it('records detailed logging when getAllParts returns large result sets', () => {
    cacheManagerMock.has.mockReturnValue(false);
    cacheManagerMock.size.mockReturnValue(2);
    queryCacheMock.getCachedGetAllParts.mockReturnValue(undefined);

    const longResult = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue(longResult);

    const parts = service.getAllParts({ body: { root: 'blueprint-root' } }, 'actor-1');

    expect(parts).toEqual(longResult);
    const logEntry = loggerMock.debug.mock.calls.find((call) =>
      typeof call[0] === 'string' && call[0].includes('AnatomyGraphAlgorithms.getAllParts returned')
    );
    expect(logEntry?.[0]).toContain('...');
  });

  it('handles null component data when checking for specific component values', () => {
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1']);
    entityManagerMock.getComponentData.mockReturnValueOnce(null);

    const result = service.hasPartWithComponentValue(
      { body: { root: 'blueprint-root' } },
      'inventory:slot',
      'metadata.value',
      'expected'
    );

    expect(entityManagerMock.getComponentData).toHaveBeenCalledWith('part-1', 'inventory:slot');
    expect(result).toEqual({ found: false });
  });

  it('falls back to empty arrays when cache misses in getBodyGraph child queries', async () => {
    entityManagerMock.getComponentData.mockResolvedValue({ body: { root: 'root-entity' } });
    jest.spyOn(service, 'buildAdjacencyCache').mockResolvedValue();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['root-entity']);
    cacheManagerMock.get.mockReturnValue(undefined);

    const graph = await service.getBodyGraph('actor-entity');
    expect(graph.getConnectedParts('missing-node')).toEqual([]);
  });

  it('returns null recipe identifiers when anatomy data lacks recipeId', async () => {
    entityManagerMock.getComponentData.mockResolvedValue({ body: { root: 'root-entity' } });

    const result = await service.getAnatomyData('actor-entity');

    expect(result).toEqual({ recipeId: null, rootEntityId: 'actor-entity' });
  });

  it('returns empty child collections when cache entries are absent', () => {
    cacheManagerMock.get.mockReturnValue(undefined);

    expect(service.getChildren('unknown-node')).toEqual([]);
  });
});
