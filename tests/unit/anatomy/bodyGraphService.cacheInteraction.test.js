import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
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

describe('BodyGraphService cache and query interactions', () => {
  let mockCacheManager;
  let mockQueryCache;
  let mockEntityManager;
  let mockLogger;
  let mockEventDispatcher;
  let createService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCacheManager = {
      hasCacheForRoot: jest.fn().mockReturnValue(false),
      buildCache: jest.fn().mockResolvedValue(undefined),
      invalidateCacheForRoot: jest.fn(),
      size: jest.fn().mockReturnValue(0),
      has: jest.fn().mockReturnValue(false),
      get: jest.fn(),
      validateCache: jest.fn().mockReturnValue({ valid: true, issues: [] }),
    };
    AnatomyCacheManager.mockImplementation(() => mockCacheManager);

    mockQueryCache = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
      cacheFindPartsByType: jest.fn(),
      invalidateRoot: jest.fn(),
      getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
      cacheGetAllParts: jest.fn(),
    };
    AnatomyQueryCache.mockImplementation(() => mockQueryCache);

    mockEntityManager = {
      getComponentData: jest.fn(),
      removeComponent: jest.fn().mockResolvedValue(undefined),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    createService = (overrides = {}) =>
      new BodyGraphService({
        entityManager: mockEntityManager,
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
        ...overrides,
      });
  });

  it('skips rebuilding adjacency cache when one already exists', async () => {
    mockCacheManager.hasCacheForRoot.mockReturnValue(true);
    const service = createService();

    await service.buildAdjacencyCache('actor-root');

    expect(mockCacheManager.buildCache).not.toHaveBeenCalled();
  });

  it('detaches parts, invalidates caches, and emits events when cascade is enabled', async () => {
    mockEntityManager.getComponentData.mockReturnValue({
      parentId: 'torso',
      socketId: 'shoulder',
    });
    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['arm', 'hand']);
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('actor-root');
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(123456789);

    const service = createService();
    const result = await service.detachPart('arm');

    expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
      'arm',
      'anatomy:joint'
    );
    expect(mockCacheManager.invalidateCacheForRoot).toHaveBeenCalledWith(
      'actor-root'
    );
    expect(mockQueryCache.invalidateRoot).toHaveBeenCalledWith('actor-root');
    expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'arm',
        parentEntityId: 'torso',
        socketId: 'shoulder',
        detachedCount: 2,
        reason: 'manual',
        timestamp: 123456789,
      })
    );
    expect(result).toEqual({
      detached: ['arm', 'hand'],
      parentId: 'torso',
      socketId: 'shoulder',
    });

    nowSpy.mockRestore();
  });

  it('throws an InvalidArgumentError when attempting to detach a part without a joint component', async () => {
    mockEntityManager.getComponentData.mockReturnValue(null);
    const service = createService();

    await expect(service.detachPart('missing-joint')).rejects.toEqual(
      new InvalidArgumentError(
        "Entity 'missing-joint' has no joint component - cannot detach"
      )
    );
  });

  it('returns cached target lookups without invoking graph algorithms', () => {
    mockQueryCache.getCachedFindPartsByType.mockReturnValue(['cached-id']);
    const service = createService();

    const result = service.findPartsByType('root', 'hand');

    expect(result).toEqual(['cached-id']);
    expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();
  });

  it('computes and caches target lookups when no cache entry exists', () => {
    AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['computed']);
    const service = createService();

    const result = service.findPartsByType('root', 'hand');

    expect(AnatomyGraphAlgorithms.findPartsByType).toHaveBeenCalledWith(
      'root',
      'hand',
      mockCacheManager
    );
    expect(mockQueryCache.cacheFindPartsByType).toHaveBeenCalledWith(
      'root',
      'hand',
      ['computed']
    );
    expect(result).toEqual(['computed']);
  });

  it('uses the actor entity as cache root when available and records cache entries', () => {
    mockCacheManager.has.mockReturnValue(true);
    mockCacheManager.size.mockReturnValue(2);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['actor-arm', 'actor-hand']);

    const service = createService();
    const result = service.getAllParts({ body: { root: 'blueprint-root' } }, 'actor');

    expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
      'actor',
      mockCacheManager,
      mockEntityManager
    );
    expect(mockQueryCache.cacheGetAllParts).toHaveBeenCalledWith(
      'actor',
      ['actor-arm', 'actor-hand']
    );
    expect(result).toEqual(['actor-arm', 'actor-hand']);

    const logMessages = mockLogger.debug.mock.calls.map((call) => call[0]);
    expect(
      logMessages.some((msg) =>
        msg?.includes(
          "BodyGraphService: Using actor entity 'actor' as cache root instead of blueprint root 'blueprint-root'"
        )
      )
    ).toBe(true);
  });

  it('falls back to blueprint root when actor cache is unavailable', () => {
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['bp-arm']);
    const service = createService();

    const result = service.getAllParts({ root: 'bp-root' }, 'actor');

    expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
      'bp-root',
      mockCacheManager,
      mockEntityManager
    );
    expect(result).toEqual(['bp-arm']);

    const logMessages = mockLogger.debug.mock.calls.map((call) => call[0]);
    expect(
      logMessages.some((msg) =>
        msg?.includes(
          "BodyGraphService: Using blueprint root 'bp-root' as cache root"
        )
      )
    ).toBe(true);
  });

  it('returns cached part lists without querying the graph algorithms', () => {
    mockQueryCache.getCachedGetAllParts.mockReturnValue(['cached']);
    const service = createService();

    const result = service.getAllParts({ body: { root: 'torso' } });

    expect(result).toEqual(['cached']);
    expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
    expect(
      mockLogger.debug.mock.calls
        .map((call) => call[0])
        .some((msg) =>
          msg?.includes("BodyGraphService: Found cached result for root 'torso'")
        )
    ).toBe(true);
  });

  it('ignores empty component payloads when checking for component presence', () => {
    const service = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1']);
    mockEntityManager.getComponentData.mockReturnValueOnce({});

    expect(service.hasPartWithComponent({ body: { root: 'torso' } }, 'comp')).toBe(
      false
    );
  });

  it('returns a negative lookup when the expected nested property is missing', () => {
    const service = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1']);
    mockEntityManager.getComponentData
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ status: { locked: false } });

    expect(
      service.hasPartWithComponentValue(
        { body: { root: 'torso' } },
        'status',
        'locked.flag',
        true
      )
    ).toEqual({ found: false });
  });

  describe('getBodyGraph', () => {
    it('validates the provided entity identifier', async () => {
      const service = createService();
      await expect(service.getBodyGraph()).rejects.toEqual(
        new InvalidArgumentError('Entity ID is required and must be a string')
      );
    });

    it('throws when the anatomy component is missing', async () => {
      mockEntityManager.getComponentData.mockResolvedValueOnce(null);
      const service = createService();

      await expect(service.getBodyGraph('actor-1')).rejects.toEqual(
        new Error('Entity actor-1 has no anatomy:body component')
      );
    });

    it('returns helper accessors backed by the cache when anatomy exists', async () => {
      mockEntityManager.getComponentData.mockResolvedValueOnce({
        body: { root: 'actor-root' },
      });
      mockCacheManager.get.mockImplementation((id) =>
        id === 'actor-1' ? { children: ['child-1'] } : undefined
      );
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-a']);

      const graph = await service.getBodyGraph('actor-1');

      expect(mockCacheManager.buildCache).toHaveBeenCalledWith(
        'actor-1',
        mockEntityManager
      );
      expect(graph.getAllPartIds()).toEqual(['part-a']);
      expect(graph.getConnectedParts('actor-1')).toEqual(['child-1']);
      expect(graph.getConnectedParts('unknown')).toEqual([]);
    });
  });

  describe('getAnatomyData', () => {
    it('validates the entity identifier input', async () => {
      const service = createService();
      await expect(service.getAnatomyData()).rejects.toEqual(
        new InvalidArgumentError('Entity ID is required and must be a string')
      );
    });

    it('returns null and logs when no anatomy component exists', async () => {
      mockEntityManager.getComponentData.mockResolvedValueOnce(null);
      const service = createService();

      await expect(service.getAnatomyData('actor-1')).resolves.toBeNull();
      expect(
        mockLogger.debug.mock.calls
          .map((call) => call[0])
          .some((msg) =>
            msg?.includes(
              "BodyGraphService.getAnatomyData: Entity 'actor-1' has no anatomy:body component"
            )
          )
      ).toBe(true);
    });

    it('extracts recipe data with a null fallback when anatomy exists', async () => {
      mockEntityManager.getComponentData.mockResolvedValueOnce({});
      const service = createService();

      await expect(service.getAnatomyData('actor-1')).resolves.toEqual({
        recipeId: null,
        rootEntityId: 'actor-1',
      });
    });
  });

  it('exposes cache helper utilities and ancestor lookups', () => {
    const service = createService();
    const nodeMap = {
      'part-1': { children: ['child-1'], parentId: 'root' },
      root: { parentId: null },
      'lonely-part': { parentId: 'ancestor' },
      ancestor: { parentId: null },
    };
    mockCacheManager.get.mockImplementation((id) => nodeMap[id]);

    expect(service.validateCache()).toEqual({ valid: true, issues: [] });
    expect(mockCacheManager.validateCache).toHaveBeenCalledWith(
      mockEntityManager
    );
    expect(service.hasCache('root')).toBe(false);
    expect(mockCacheManager.hasCacheForRoot).toHaveBeenCalledWith('root');
    expect(service.getChildren('part-1')).toEqual(['child-1']);
    expect(service.getChildren('unknown')).toEqual([]);
    expect(service.getParent('part-1')).toEqual('root');
    expect(service.getParent('missing')).toBeNull();
    expect(service.getAncestors('lonely-part')).toEqual(['ancestor']);
  });

  it('derives descendants from the subgraph helper without including the source node', () => {
    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([
      'root',
      'child-1',
      'child-2',
    ]);

    const service = createService();
    expect(service.getAllDescendants('root')).toEqual(['child-1', 'child-2']);
    expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
      'root',
      mockCacheManager
    );
  });
});
