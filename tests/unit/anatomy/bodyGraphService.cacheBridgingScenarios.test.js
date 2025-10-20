import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => ({
  AnatomyCacheManager: jest.fn(),
}));

jest.mock('../../../src/anatomy/anatomyGraphAlgorithms.js', () => ({
  AnatomyGraphAlgorithms: {
    getSubgraph: jest.fn(),
    findPartsByType: jest.fn(),
    getAnatomyRoot: jest.fn(),
    getPath: jest.fn(),
    getAllParts: jest.fn(),
  },
}));

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => ({
  AnatomyQueryCache: jest.fn(),
}));

describe('BodyGraphService (cache bridging scenarios)', () => {
  let mockEntityManager;
  let mockLogger;
  let mockEventDispatcher;
  let mockCacheManager;
  let mockQueryCache;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCacheManager = {
      hasCacheForRoot: jest.fn().mockReturnValue(false),
      buildCache: jest.fn().mockResolvedValue(undefined),
      invalidateCacheForRoot: jest.fn(),
      size: jest.fn().mockReturnValue(0),
      has: jest.fn().mockReturnValue(false),
      get: jest.fn(),
      validateCache: jest.fn().mockReturnValue(true),
    };
    AnatomyCacheManager.mockImplementation(() => mockCacheManager);

    mockQueryCache = {
      getCachedFindPartsByType: jest.fn(),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn(),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };
    AnatomyQueryCache.mockImplementation(() => mockQueryCache);

    mockEntityManager = {
      getComponentData: jest.fn(),
      removeComponent: jest.fn().mockResolvedValue(undefined),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
    };

    mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };
  });

  const createService = (overrides = {}) =>
    new BodyGraphService({
      entityManager: mockEntityManager,
      logger: mockLogger,
      eventDispatcher: mockEventDispatcher,
      ...overrides,
    });

  it('creates a default AnatomyQueryCache when none is provided', () => {
    createService();
    expect(AnatomyQueryCache).toHaveBeenCalledWith({ logger: mockLogger });
  });

  it('skips query cache construction when an external cache is supplied', () => {
    const externalCache = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };
    createService({ queryCache: externalCache });
    expect(AnatomyQueryCache).not.toHaveBeenCalled();
  });

  it('builds adjacency cache only once per root', async () => {
    mockCacheManager.hasCacheForRoot.mockReturnValueOnce(false).mockReturnValue(true);

    const service = createService();
    await service.buildAdjacencyCache('actor-1');
    await service.buildAdjacencyCache('actor-1');

    expect(mockCacheManager.buildCache).toHaveBeenCalledTimes(1);
    expect(mockCacheManager.buildCache).toHaveBeenCalledWith('actor-1', mockEntityManager);
  });

  it('caches findPartsByType results for subsequent calls', () => {
    AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['arm-1']);
    mockQueryCache.getCachedFindPartsByType
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(['arm-1']);

    const service = createService();
    const firstCall = service.findPartsByType('root-1', 'arm');
    const secondCall = service.findPartsByType('root-1', 'arm');

    expect(firstCall).toEqual(['arm-1']);
    expect(secondCall).toEqual(['arm-1']);
    expect(AnatomyGraphAlgorithms.findPartsByType).toHaveBeenCalledTimes(1);
    expect(mockQueryCache.cacheFindPartsByType).toHaveBeenCalledWith('root-1', 'arm', ['arm-1']);
  });

  it('leverages cache root substitution when actor instance has a cache entry', () => {
    mockQueryCache.getCachedGetAllParts
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(['cached-1']);
    mockCacheManager.has.mockReturnValue(true);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['fresh']);

    const service = createService();
    const first = service.getAllParts({ body: { root: 'blueprint-root' } }, 'actor-9');
    const second = service.getAllParts({ body: { root: 'blueprint-root' } }, 'actor-9');

    expect(first).toEqual(['fresh']);
    expect(second).toEqual(['cached-1']);
    expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledTimes(1);
    expect(mockQueryCache.cacheGetAllParts).toHaveBeenCalledWith('actor-9', ['fresh']);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "BodyGraphService: Using actor entity 'actor-9' as cache root instead of blueprint root 'blueprint-root' (cache size: 0)"
    );
  });

  it('returns an empty list when no anatomy root can be resolved', () => {
    const service = createService();
    const result = service.getAllParts({ metadataOnly: true });

    expect(result).toEqual([]);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'BodyGraphService.getAllParts: No root ID found in bodyComponent'
    );
  });

  it('ignores empty component payloads when checking for components', () => {
    const service = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['node-1']);
    mockEntityManager.getComponentData.mockReturnValue({});

    expect(
      service.hasPartWithComponent({ body: { root: 'root-id' } }, 'component:test')
    ).toBe(false);
  });

  it('returns not found when nested component values do not match', () => {
    const service = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['node-1']);
    mockEntityManager.getComponentData.mockReturnValue({ stats: { hp: 10 } });

    expect(
      service.hasPartWithComponentValue(
        { body: { root: 'root-id' } },
        'component:test',
        'stats.hp',
        99
      )
    ).toEqual({ found: false });
  });

  it('builds graph helpers that reuse cached adjacency information', async () => {
    mockEntityManager.getComponentData.mockResolvedValue({ body: { root: 'root-1' } });
    mockCacheManager.get.mockImplementation((id) =>
      id === 'part-2' ? { children: ['child-1'] } : { children: [] }
    );

    const service = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1', 'part-2']);

    const graph = await service.getBodyGraph('actor-1');
    expect(mockCacheManager.buildCache).toHaveBeenCalledWith('actor-1', mockEntityManager);
    expect(graph.getAllPartIds()).toEqual(['part-1', 'part-2']);
    expect(graph.getConnectedParts('part-2')).toEqual(['child-1']);
    expect(graph.getConnectedParts('unknown')).toEqual([]);
  });

  it('returns null anatomy data when the component is missing', async () => {
    mockEntityManager.getComponentData.mockResolvedValue(null);
    const service = createService();

    await expect(service.getAnatomyData('actor-1')).resolves.toBeNull();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "BodyGraphService.getAnatomyData: Entity 'actor-1' has no anatomy:body component"
    );
  });

  it('aggregates descendants while excluding the origin node', () => {
    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['root', 'child-1', 'child-2']);
    const service = createService();

    expect(service.getAllDescendants('root')).toEqual(['child-1', 'child-2']);
    expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith('root', mockCacheManager);
  });

  it('throws descriptive errors when detachPart is invoked without a joint component', async () => {
    mockEntityManager.getComponentData.mockReturnValue(null);
    const service = createService();

    await expect(service.detachPart('node-9')).rejects.toThrow(
      new InvalidArgumentError("Entity 'node-9' has no joint component - cannot detach")
    );
  });
});
