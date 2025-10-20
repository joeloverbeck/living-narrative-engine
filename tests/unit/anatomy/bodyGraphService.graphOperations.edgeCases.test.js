import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import {
  BodyGraphService,
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';

const createCacheManagerMock = () => ({
  hasCacheForRoot: jest.fn(),
  buildCache: jest.fn().mockResolvedValue(undefined),
  invalidateCacheForRoot: jest.fn(),
  has: jest.fn(),
  get: jest.fn(),
  size: jest.fn(),
  validateCache: jest.fn(),
});

const createQueryCacheMock = () => ({
  getCachedFindPartsByType: jest.fn(),
  cacheFindPartsByType: jest.fn(),
  getCachedGetAllParts: jest.fn(),
  cacheGetAllParts: jest.fn(),
  invalidateRoot: jest.fn(),
});

const cacheManagerInstances = [];
const queryCacheInstances = [];

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => ({
  AnatomyCacheManager: jest.fn(() => {
    const instance = createCacheManagerMock();
    cacheManagerInstances.push(instance);
    return instance;
  }),
}));

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => ({
  AnatomyQueryCache: jest.fn(() => {
    const instance = createQueryCacheMock();
    queryCacheInstances.push(instance);
    return instance;
  }),
}));

var mockAnatomyGraphAlgorithms;

jest.mock('../../../src/anatomy/anatomyGraphAlgorithms.js', () => {
  mockAnatomyGraphAlgorithms = {
    getSubgraph: jest.fn(),
    findPartsByType: jest.fn(),
    getAnatomyRoot: jest.fn(),
    getPath: jest.fn(),
    getAllParts: jest.fn(),
  };
  return { AnatomyGraphAlgorithms: mockAnatomyGraphAlgorithms };
});

describe('BodyGraphService graph operations edge cases', () => {
  let entityManager;
  let logger;
  let eventDispatcher;

  const instantiateService = (overrides = {}) => {
    const service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
      ...overrides,
    });

    const cacheManager = cacheManagerInstances.at(-1);
    const queryCache = overrides.queryCache ?? queryCacheInstances.at(-1);

    return { service, cacheManager, queryCache };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    cacheManagerInstances.length = 0;
    queryCacheInstances.length = 0;
    Object.values(mockAnatomyGraphAlgorithms).forEach((mockFn) => mockFn.mockReset());

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
  });

  it('validates constructor dependencies', () => {
    expect(() => new BodyGraphService({ logger, eventDispatcher })).toThrow(
      InvalidArgumentError
    );
    expect(() => new BodyGraphService({ entityManager, eventDispatcher })).toThrow(
      InvalidArgumentError
    );
    expect(() => new BodyGraphService({ entityManager, logger })).toThrow(
      InvalidArgumentError
    );
  });

  it('constructs cache and query helpers when dependencies are provided', () => {
    const { cacheManager, queryCache } = instantiateService();

    expect(cacheManager).toBeDefined();
    expect(queryCache).toBeDefined();
    expect(typeof cacheManager.buildCache).toBe('function');
    expect(typeof queryCache.cacheFindPartsByType).toBe('function');
  });

  it('builds adjacency cache only when necessary', async () => {
    const { service, cacheManager } = instantiateService();
    cacheManager.hasCacheForRoot.mockReturnValueOnce(false).mockReturnValue(true);

    await service.buildAdjacencyCache('actor-1');
    expect(cacheManager.buildCache).toHaveBeenCalledWith('actor-1', entityManager);

    cacheManager.buildCache.mockClear();
    await service.buildAdjacencyCache('actor-1');
    expect(cacheManager.buildCache).not.toHaveBeenCalled();
  });

  it('detaches parts and invalidates caches when cascading', async () => {
    const { service, cacheManager, queryCache } = instantiateService();
    entityManager.getComponentData.mockImplementation((entityId, componentId) => {
      if (componentId === 'anatomy:joint' && entityId === 'arm') {
        return { parentId: 'torso', socketId: 'shoulder' };
      }
      return null;
    });

    mockAnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['arm', 'hand']);
    mockAnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('torso-root');

    const result = await service.detachPart('arm', {
      cascade: true,
      reason: 'test-detach',
    });

    expect(result).toEqual({ detached: ['arm', 'hand'], parentId: 'torso', socketId: 'shoulder' });
    expect(entityManager.removeComponent).toHaveBeenCalledWith('arm', 'anatomy:joint');
    expect(cacheManager.invalidateCacheForRoot).toHaveBeenCalledWith('torso-root');
    expect(queryCache.invalidateRoot).toHaveBeenCalledWith('torso-root');
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'arm',
        parentEntityId: 'torso',
        socketId: 'shoulder',
        detachedCount: 2,
        reason: 'test-detach',
        timestamp: expect.any(Number),
      })
    );
  });

  it('can detach a single part without cascading to children', async () => {
    const { service, cacheManager, queryCache } = instantiateService();
    entityManager.getComponentData.mockReturnValue({
      parentId: 'torso',
      socketId: 'shoulder',
    });
    mockAnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('torso');

    const result = await service.detachPart('arm', { cascade: false });

    expect(result).toEqual({ detached: ['arm'], parentId: 'torso', socketId: 'shoulder' });
    expect(mockAnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
    expect(cacheManager.invalidateCacheForRoot).toHaveBeenCalledWith('torso');
    expect(queryCache.invalidateRoot).toHaveBeenCalledWith('torso');
  });

  it('throws when detaching a part without a joint component', async () => {
    const { service } = instantiateService();
    entityManager.getComponentData.mockReturnValue(null);

    await expect(service.detachPart('missing')).rejects.toThrow(InvalidArgumentError);
  });

  it('resolves anatomy root and paths using algorithms', () => {
    const { service } = instantiateService();
    mockAnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-1');
    mockAnatomyGraphAlgorithms.getPath.mockReturnValue(['a', 'b']);

    expect(service.getAnatomyRoot('child')).toBe('root-1');
    expect(service.getPath('child', 'root')).toEqual(['a', 'b']);
  });

  it('returns cached results for part lookup', () => {
    const { service, queryCache } = instantiateService();
    const cached = ['hand'];
    queryCache.getCachedFindPartsByType.mockReturnValue(cached);

    const result = service.findPartsByType('torso', 'hand');
    expect(result).toBe(cached);
    expect(mockAnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();
  });

  it('performs part lookup when cache is empty', () => {
    const { service, cacheManager, queryCache } = instantiateService();
    queryCache.getCachedFindPartsByType.mockReturnValue(undefined);
    mockAnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['arm']);

    const result = service.findPartsByType('torso', 'arm');

    expect(mockAnatomyGraphAlgorithms.findPartsByType).toHaveBeenCalledWith(
      'torso',
      'arm',
      cacheManager
    );
    expect(queryCache.cacheFindPartsByType).toHaveBeenCalledWith('torso', 'arm', ['arm']);
    expect(result).toEqual(['arm']);
  });

  it('returns empty array when no body component is provided', () => {
    const { service } = instantiateService();
    expect(service.getAllParts(null)).toEqual([]);
  });

  it('gets all parts from blueprint root when actor cache is missing', () => {
    const { service, cacheManager, queryCache } = instantiateService();
    queryCache.getCachedGetAllParts.mockReturnValue(undefined);
    cacheManager.has.mockReturnValue(false);
    cacheManager.size.mockReturnValue(0);
    mockAnatomyGraphAlgorithms.getAllParts.mockReturnValue(['torso', 'arm']);

    const result = service.getAllParts({ body: { root: 'blueprint-root' } }, 'actor-1');

    expect(mockAnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
      'blueprint-root',
      cacheManager,
      entityManager
    );
    expect(queryCache.cacheGetAllParts).toHaveBeenCalledWith('blueprint-root', ['torso', 'arm']);
    expect(result).toEqual(['torso', 'arm']);
  });

  it('prefers actor cache root when available', () => {
    const { service, cacheManager, queryCache } = instantiateService();
    queryCache.getCachedGetAllParts.mockReturnValue(undefined);
    cacheManager.size.mockReturnValue(2);
    cacheManager.has.mockImplementation((id) => id === 'actor-1');
    mockAnatomyGraphAlgorithms.getAllParts.mockReturnValue(['actor-root']);

    const result = service.getAllParts({ body: { root: 'blueprint-root' } }, 'actor-1');

    expect(mockAnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith('actor-1', cacheManager, entityManager);
    expect(result).toEqual(['actor-root']);
  });

  it('uses cached getAllParts results when available', () => {
    const { service, queryCache } = instantiateService();
    queryCache.getCachedGetAllParts.mockReturnValue(['cached']);

    const result = service.getAllParts({ body: { root: 'blueprint-root' } }, 'actor-1');
    expect(result).toEqual(['cached']);
    expect(mockAnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
  });

  it('detects components on parts using getAllParts traversal', () => {
    const { service } = instantiateService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1', 'part-2', 'part-3']);

    entityManager.getComponentData.mockImplementation((id) => {
      if (id === 'part-1') return null;
      if (id === 'part-2') return {};
      return { equipped: true };
    });

    const hasComponent = service.hasPartWithComponent({}, 'inventory');
    expect(hasComponent).toBe(true);
  });

  it('returns false when no parts contain the requested component', () => {
    const { service } = instantiateService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1', 'part-2']);
    entityManager.getComponentData.mockReturnValue(null);

    expect(service.hasPartWithComponent({}, 'inventory')).toBe(false);
  });

  it('checks nested component values', () => {
    const { service } = instantiateService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1', 'part-2']);

    entityManager.getComponentData.mockImplementation((id) => {
      if (id === 'part-1') return { status: { locked: false } };
      return { status: { locked: true } };
    });

    expect(
      service.hasPartWithComponentValue({}, 'status', 'status.locked', true)
    ).toEqual({ found: true, partId: 'part-2' });
    expect(
      service.hasPartWithComponentValue({}, 'status', 'status.locked', 'missing')
    ).toEqual({ found: false });
  });

  it('validates body graph retrieval and connected parts', async () => {
    const { service, cacheManager } = instantiateService();
    entityManager.getComponentData.mockResolvedValue({ body: { root: 'root-1' } });
    cacheManager.get.mockImplementation((id) =>
      id === 'node-1' ? { children: ['child'] } : { children: [] }
    );

    const buildSpy = jest
      .spyOn(service, 'buildAdjacencyCache')
      .mockResolvedValue(undefined);
    const getAllPartsSpy = jest
      .spyOn(service, 'getAllParts')
      .mockReturnValue(['node-1', 'child']);

    const graph = await service.getBodyGraph('actor-1');
    expect(buildSpy).toHaveBeenCalledWith('actor-1');
    expect(graph.getAllPartIds()).toEqual(['node-1', 'child']);
    expect(graph.getConnectedParts('node-1')).toEqual(['child']);
    expect(graph.getConnectedParts('unknown')).toEqual([]);
    expect(getAllPartsSpy).toHaveBeenCalledWith({ body: { root: 'root-1' } }, 'actor-1');
  });

  it('throws descriptive errors when body graph input is invalid', async () => {
    const { service } = instantiateService();
    await expect(service.getBodyGraph('actor-1')).rejects.toThrow();
    await expect(service.getBodyGraph(null)).rejects.toThrow(InvalidArgumentError);
  });

  it('returns anatomy metadata when anatomy:body exists', async () => {
    const { service } = instantiateService();
    entityManager.getComponentData.mockResolvedValue({
      recipeId: 'recipe-42',
    });

    await expect(service.getAnatomyData('actor-1')).resolves.toEqual({
      recipeId: 'recipe-42',
      rootEntityId: 'actor-1',
    });
  });

  it('returns null anatomy metadata when component is missing', async () => {
    const { service } = instantiateService();
    entityManager.getComponentData.mockResolvedValue(null);

    await expect(service.getAnatomyData('actor-1')).resolves.toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      "BodyGraphService.getAnatomyData: Entity 'actor-1' has no anatomy:body component"
    );
  });

  it('validates cache helpers and ancestor lookups', () => {
    const { service, cacheManager } = instantiateService();
    cacheManager.validateCache.mockReturnValue({ valid: true });
    cacheManager.hasCacheForRoot.mockReturnValue(true);
    cacheManager.get.mockImplementation((id) => {
      if (id === 'node') {
        return { children: ['child'], parentId: 'ancestor' };
      }
      if (id === 'missing') {
        return undefined;
      }
      if (id === 'ancestor') {
        return { parentId: 'root' };
      }
      if (id === 'root') {
        return { parentId: null };
      }
      return undefined;
    });

    expect(service.validateCache()).toEqual({ valid: true });
    expect(service.hasCache('root')).toBe(true);
    expect(service.getChildren('node')).toEqual(['child']);
    expect(service.getChildren('missing')).toEqual([]);
    expect(service.getParent('node')).toBe('ancestor');
    expect(service.getParent('missing')).toBeNull();
    expect(service.getAncestors('node')).toEqual(['ancestor', 'root']);
  });

  it('collects descendants excluding the root entity', () => {
    const { service, cacheManager } = instantiateService();
    mockAnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['root', 'child-1', 'child-2']);

    expect(service.getAllDescendants('root')).toEqual(['child-1', 'child-2']);
    expect(mockAnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith('root', cacheManager);
  });
});
