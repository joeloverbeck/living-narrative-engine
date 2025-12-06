import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const createdCacheManagers = [];
const createdQueryCaches = [];

class MockCacheManager {
  constructor({ logger }) {
    this.logger = logger;
    this.cacheRoots = new Set();
    this.nodes = new Map();
    this.built = [];
    this.invalidated = [];
    this.hasCacheForRoot = jest.fn((rootId) => this.cacheRoots.has(rootId));
    this.buildCache = jest.fn(async (rootId, entityManager) => {
      this.cacheRoots.add(rootId);
      this.built.push({ rootId, entityManager });
    });
    this.invalidateCacheForRoot = jest.fn((rootId) => {
      this.cacheRoots.delete(rootId);
      this.invalidated.push(rootId);
    });
    this.get = jest.fn((entityId) => this.nodes.get(entityId));
    this.has = jest.fn(
      (entityId) => this.cacheRoots.has(entityId) || this.nodes.has(entityId)
    );
    this.size = jest.fn(() => this.cacheRoots.size);
    this.validateCache = jest.fn(() => true);
  }
}

class MockQueryCache {
  constructor({ logger }) {
    this.logger = logger;
    this.findPartsCache = new Map();
    this.allPartsCache = new Map();
    this.getCachedFindPartsByType = jest.fn((rootId, type) =>
      this.findPartsCache.has(`${rootId}|${type}`)
        ? this.findPartsCache.get(`${rootId}|${type}`)
        : undefined
    );
    this.cacheFindPartsByType = jest.fn((rootId, type, value) => {
      this.findPartsCache.set(`${rootId}|${type}`, value);
    });
    this.invalidateRoot = jest.fn((rootId) => {
      this.allPartsCache.delete(rootId);
      [...this.findPartsCache.keys()]
        .filter((key) => key.startsWith(`${rootId}|`))
        .forEach((key) => this.findPartsCache.delete(key));
    });
    this.getCachedGetAllParts = jest.fn((rootId) =>
      this.allPartsCache.has(rootId)
        ? this.allPartsCache.get(rootId)
        : undefined
    );
    this.cacheGetAllParts = jest.fn((rootId, value) => {
      this.allPartsCache.set(rootId, value);
    });
  }
}

const mockGraphState = {
  subgraphs: new Map(),
  types: new Map(),
  roots: new Map(),
  paths: new Map(),
  allParts: new Map(),
};

var mockAlgorithms;

const TEST_EVENT_ID = 'integration.anatomy.limb.detached';

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => ({
  AnatomyCacheManager: jest.fn().mockImplementation((params) => {
    const instance = new MockCacheManager(params);
    createdCacheManagers.push(instance);
    return instance;
  }),
}));

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => ({
  AnatomyQueryCache: jest.fn().mockImplementation((params) => {
    const instance = new MockQueryCache(params);
    createdQueryCaches.push(instance);
    return instance;
  }),
}));

jest.mock('../../../src/anatomy/anatomyGraphAlgorithms.js', () => {
  mockAlgorithms = {
    getSubgraph: jest.fn((partId) =>
      mockGraphState.subgraphs.has(partId)
        ? mockGraphState.subgraphs.get(partId)
        : [partId]
    ),
    findPartsByType: jest.fn(
      (rootId, type) => mockGraphState.types.get(`${rootId}|${type}`) || []
    ),
    getAnatomyRoot: jest.fn(
      (partId) => mockGraphState.roots.get(partId) || null
    ),
    getPath: jest.fn(
      (fromId, toId) => mockGraphState.paths.get(`${fromId}|${toId}`) || []
    ),
    getAllParts: jest.fn((rootId) => mockGraphState.allParts.get(rootId) || []),
  };

  return { AnatomyGraphAlgorithms: mockAlgorithms };
});

jest.mock('../../../src/anatomy/constants/anatomyConstants.js', () => ({
  ANATOMY_CONSTANTS: { LIMB_DETACHED_EVENT_ID: TEST_EVENT_ID },
}));

import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

class MockEntityManager {
  constructor(initialEntities = {}) {
    this.entities = new Map();
    Object.entries(initialEntities).forEach(([id, components]) => {
      this.entities.set(id, { ...components });
    });
    this.removeComponent = jest.fn(async (entityId, componentId) => {
      const entity = this.entities.get(entityId);
      if (entity && Object.prototype.hasOwnProperty.call(entity, componentId)) {
        delete entity[componentId];
      }
    });
  }

  setComponent(entityId, componentId, value) {
    if (!this.entities.has(entityId)) {
      this.entities.set(entityId, {});
    }
    this.entities.get(entityId)[componentId] = value;
  }

  getComponentData(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (!entity) return null;
    return Object.prototype.hasOwnProperty.call(entity, componentId)
      ? entity[componentId]
      : null;
  }
}

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
});

const resetMockGraphState = () => {
  mockGraphState.subgraphs.clear();
  mockGraphState.types.clear();
  mockGraphState.roots.clear();
  mockGraphState.paths.clear();
  mockGraphState.allParts.clear();
};

const createService = ({
  entityManager = new MockEntityManager(),
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

  const cacheManager = createdCacheManagers.at(-1);
  const effectiveQueryCache = queryCache || createdQueryCaches.at(-1);

  return {
    service,
    entityManager,
    logger,
    eventDispatcher,
    cacheManager,
    queryCache: effectiveQueryCache,
  };
};

describe('BodyGraphService integration coverage enhancement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createdCacheManagers.length = 0;
    createdQueryCaches.length = 0;
    resetMockGraphState();
    mockAlgorithms.getSubgraph.mockImplementation((partId) =>
      mockGraphState.subgraphs.has(partId)
        ? mockGraphState.subgraphs.get(partId)
        : [partId]
    );
    mockAlgorithms.findPartsByType.mockImplementation(
      (rootId, type) => mockGraphState.types.get(`${rootId}|${type}`) || []
    );
    mockAlgorithms.getAnatomyRoot.mockImplementation(
      (partId) => mockGraphState.roots.get(partId) || null
    );
    mockAlgorithms.getPath.mockImplementation(
      (fromId, toId) => mockGraphState.paths.get(`${fromId}|${toId}`) || []
    );
    mockAlgorithms.getAllParts.mockImplementation(
      (rootId) => mockGraphState.allParts.get(rootId) || []
    );
  });

  it('validates constructor dependencies and initializes caches', () => {
    const entityManager = new MockEntityManager();
    const logger = createLogger();
    const dispatcher = createDispatcher();

    expect(
      () => new BodyGraphService({ logger, eventDispatcher: dispatcher })
    ).toThrow('entityManager is required');
    expect(
      () => new BodyGraphService({ entityManager, eventDispatcher: dispatcher })
    ).toThrow('logger is required');
    expect(() => new BodyGraphService({ entityManager, logger })).toThrow(
      'eventDispatcher is required'
    );

    const { cacheManager, queryCache } = createService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
    });
    expect(cacheManager).toBeInstanceOf(MockCacheManager);
    expect(queryCache).toBeInstanceOf(MockQueryCache);
    expect(LIMB_DETACHED_EVENT_ID).toBe(TEST_EVENT_ID);
  });

  it('builds adjacency cache only when missing', async () => {
    const { service, cacheManager, entityManager } = createService();
    cacheManager.hasCacheForRoot.mockReturnValueOnce(false);
    cacheManager.hasCacheForRoot.mockReturnValueOnce(true);

    await service.buildAdjacencyCache('root-A');
    await service.buildAdjacencyCache('root-A');

    expect(cacheManager.buildCache).toHaveBeenCalledTimes(1);
    expect(cacheManager.buildCache).toHaveBeenCalledWith(
      'root-A',
      entityManager
    );
  });

  it('detaches cascading limbs and invalidates caches', async () => {
    const {
      service,
      entityManager,
      cacheManager,
      queryCache,
      eventDispatcher,
      logger,
    } = createService();
    entityManager.setComponent('limb-1', 'anatomy:joint', {
      parentId: 'torso-1',
      socketId: 'socket-7',
    });
    mockAlgorithms.getAnatomyRoot.mockReturnValueOnce('root-entity');
    mockGraphState.subgraphs.set('limb-1', ['limb-1', 'child-1']);

    const result = await service.detachPart('limb-1', { reason: 'surgical' });

    expect(entityManager.removeComponent).toHaveBeenCalledWith(
      'limb-1',
      'anatomy:joint'
    );
    expect(cacheManager.invalidateCacheForRoot).toHaveBeenCalledWith(
      'root-entity'
    );
    expect(queryCache.invalidateRoot).toHaveBeenCalledWith('root-entity');
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      TEST_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'limb-1',
        parentEntityId: 'torso-1',
        socketId: 'socket-7',
        detachedCount: 2,
        reason: 'surgical',
        timestamp: expect.any(Number),
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Detached 2 entities from parent 'torso-1'")
    );
    expect(result).toEqual({
      detached: ['limb-1', 'child-1'],
      parentId: 'torso-1',
      socketId: 'socket-7',
    });
  });

  it('supports non-cascading detach operations', async () => {
    const {
      service,
      entityManager,
      cacheManager,
      queryCache,
      eventDispatcher,
    } = createService();
    entityManager.setComponent('limb-2', 'anatomy:joint', {
      parentId: 'torso-2',
      socketId: 'socket-2',
    });
    mockAlgorithms.getAnatomyRoot.mockReturnValueOnce(null);

    const result = await service.detachPart('limb-2', {
      cascade: false,
      reason: 'manual',
    });

    expect(mockAlgorithms.getSubgraph).not.toHaveBeenCalled();
    expect(cacheManager.invalidateCacheForRoot).not.toHaveBeenCalled();
    expect(queryCache.invalidateRoot).not.toHaveBeenCalled();
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      TEST_EVENT_ID,
      expect.objectContaining({ detachedCount: 1, reason: 'manual' })
    );
    expect(result).toEqual({
      detached: ['limb-2'],
      parentId: 'torso-2',
      socketId: 'socket-2',
    });
  });

  it('uses query cache when finding parts by type', () => {
    const { service, queryCache, cacheManager } = createService();
    queryCache.cacheFindPartsByType('root-1', 'arm', ['cached-arm']);

    const cached = service.findPartsByType('root-1', 'arm');
    expect(cached).toEqual(['cached-arm']);
    expect(mockAlgorithms.findPartsByType).not.toHaveBeenCalled();

    mockAlgorithms.findPartsByType.mockReturnValueOnce(['computed-leg']);
    const computed = service.findPartsByType('root-1', 'leg');
    expect(computed).toEqual(['computed-leg']);
    expect(mockAlgorithms.findPartsByType).toHaveBeenCalledWith(
      'root-1',
      'leg',
      cacheManager
    );
    expect(queryCache.cacheFindPartsByType).toHaveBeenCalledWith(
      'root-1',
      'leg',
      ['computed-leg']
    );
  });

  it('delegates to algorithms for root and path lookups', () => {
    const { service, cacheManager, entityManager } = createService();
    mockAlgorithms.getAnatomyRoot.mockReturnValueOnce('root-z');
    mockAlgorithms.getPath.mockReturnValueOnce(['a', 'b']);

    expect(service.getAnatomyRoot('part-z')).toBe('root-z');
    expect(mockAlgorithms.getAnatomyRoot).toHaveBeenCalledWith(
      'part-z',
      cacheManager,
      entityManager
    );

    expect(service.getPath('from', 'to')).toEqual(['a', 'b']);
    expect(mockAlgorithms.getPath).toHaveBeenCalledWith(
      'from',
      'to',
      cacheManager
    );
  });

  it('returns empty lists for missing body information', () => {
    const { service, logger } = createService();

    expect(service.getAllParts(null)).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      'BodyGraphService.getAllParts: No bodyComponent provided'
    );

    logger.debug.mockClear();
    expect(service.getAllParts({ body: {} })).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      'BodyGraphService.getAllParts: No root ID found in bodyComponent'
    );
  });

  it('collects parts and caches results based on blueprint root', () => {
    const { service, cacheManager, entityManager, queryCache, logger } =
      createService();
    const largeResult = [
      'torso',
      'arm',
      'hand',
      'leg',
      'foot',
      'finger',
      'toe',
    ];
    mockAlgorithms.getAllParts.mockReturnValueOnce(largeResult);

    const result = service.getAllParts(
      { body: { root: 'root-blueprint' } },
      'actor-missing'
    );

    expect(mockAlgorithms.getAllParts).toHaveBeenCalledWith(
      'root-blueprint',
      cacheManager,
      entityManager
    );
    expect(queryCache.cacheGetAllParts).toHaveBeenCalledWith(
      'root-blueprint',
      largeResult
    );
    expect(result).toEqual(largeResult);
    const debugMessages = logger.debug.mock.calls
      .flat()
      .filter((m) => typeof m === 'string');
    expect(
      debugMessages.some((msg) => msg.includes('Using blueprint root'))
    ).toBe(true);
    expect(
      debugMessages.some((msg) =>
        msg.includes('AnatomyGraphAlgorithms returned')
      )
    ).toBe(true);
  });

  it('supports direct root usage and actor cache preference', () => {
    const { service, cacheManager, entityManager, queryCache, logger } =
      createService();
    mockAlgorithms.getAllParts.mockReturnValueOnce(['direct']);
    const direct = service.getAllParts({ root: 'direct-root' });
    expect(direct).toEqual(['direct']);

    cacheManager.has.mockImplementation((id) => id === 'actor-1');
    cacheManager.size.mockReturnValueOnce(3);
    mockAlgorithms.getAllParts.mockReturnValueOnce(['actor-root']);
    const viaActor = service.getAllParts(
      { body: { root: 'bp-root' } },
      'actor-1'
    );
    expect(mockAlgorithms.getAllParts).toHaveBeenCalledWith(
      'actor-1',
      cacheManager,
      entityManager
    );
    expect(queryCache.cacheGetAllParts).toHaveBeenLastCalledWith('actor-1', [
      'actor-root',
    ]);
    expect(viaActor).toEqual(['actor-root']);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Actor 'actor-1' -> Using actor as cache root")
    );
  });

  it('returns cached all-part results without recomputation', () => {
    const { service, queryCache } = createService();
    queryCache.cacheGetAllParts('root-cached', ['cached-part']);

    const cached = service.getAllParts({ body: { root: 'root-cached' } });
    expect(cached).toEqual(['cached-part']);
    expect(mockAlgorithms.getAllParts).not.toHaveBeenCalled();
  });

  it('detects parts with components and specific values', () => {
    const { service, entityManager } = createService();
    const getAllPartsSpy = jest.spyOn(service, 'getAllParts');

    getAllPartsSpy.mockReturnValue(['hand', 'arm']);
    entityManager.setComponent('hand', 'anatomy:tag', { strength: 10 });
    entityManager.setComponent('arm', 'anatomy:tag', {});

    expect(
      service.hasPartWithComponent({ body: { root: 'ignored' } }, 'anatomy:tag')
    ).toBe(true);

    getAllPartsSpy.mockReturnValue(['arm']);
    expect(
      service.hasPartWithComponent({ body: { root: 'ignored' } }, 'anatomy:tag')
    ).toBe(false);

    getAllPartsSpy.mockReturnValue(['torso', 'leg']);
    entityManager.setComponent('leg', 'anatomy:sensors', {
      settings: { enabled: true },
    });
    const valueResult = service.hasPartWithComponentValue(
      { body: { root: 'ignored' } },
      'anatomy:sensors',
      'settings.enabled',
      true
    );
    expect(valueResult).toEqual({ found: true, partId: 'leg' });

    entityManager.setComponent('leg', 'anatomy:sensors', {
      settings: { enabled: false },
    });
    const notFound = service.hasPartWithComponentValue(
      { body: { root: 'ignored' } },
      'anatomy:sensors',
      'settings.enabled',
      true
    );
    expect(notFound).toEqual({ found: false });

    getAllPartsSpy.mockRestore();
  });

  it('validates input for body graph retrieval and builds cache', async () => {
    const { service, entityManager, cacheManager } = createService();

    await expect(service.getBodyGraph('')).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(service.getBodyGraph(null)).rejects.toThrow(
      'Entity ID is required'
    );

    await expect(service.getBodyGraph('actor-1')).rejects.toThrow(
      'Entity actor-1 has no anatomy:body component'
    );

    entityManager.setComponent('actor-1', 'anatomy:body', {
      body: { root: 'bp-root' },
    });
    const getAllPartsSpy = jest
      .spyOn(service, 'getAllParts')
      .mockReturnValue(['torso']);
    cacheManager.get.mockReturnValue({ children: ['arm'] });

    const graph = await service.getBodyGraph('actor-1');
    expect(cacheManager.buildCache).toHaveBeenCalledWith(
      'actor-1',
      entityManager
    );
    expect(graph.getAllPartIds()).toEqual(['torso']);
    expect(graph.getConnectedParts('actor-1')).toEqual(['arm']);

    getAllPartsSpy.mockRestore();
  });

  it('retrieves anatomy data and validates identifiers', async () => {
    const { service, entityManager, logger } = createService();

    await expect(service.getAnatomyData('')).rejects.toThrow(
      InvalidArgumentError
    );

    const missing = await service.getAnatomyData('actor-2');
    expect(missing).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      "BodyGraphService.getAnatomyData: Entity 'actor-2' has no anatomy:body component"
    );

    entityManager.setComponent('actor-2', 'anatomy:body', {
      recipeId: 'recipe-9',
    });

    const data = await service.getAnatomyData('actor-2');
    expect(data).toEqual({ recipeId: 'recipe-9', rootEntityId: 'actor-2' });
  });

  it('validates cache utilities and graph navigation helpers', () => {
    const { service, cacheManager } = createService();
    cacheManager.cacheRoots.add('root-x');
    cacheManager.nodes.set('child', { children: ['leaf'], parentId: 'parent' });
    cacheManager.nodes.set('leaf', { children: [], parentId: 'child' });

    expect(service.validateCache()).toBe(true);
    expect(service.hasCache('root-x')).toBe(true);
    expect(service.getChildren('child')).toEqual(['leaf']);
    expect(service.getParent('child')).toBe('parent');
    expect(service.getParent('unknown')).toBeNull();
    expect(service.getAncestors('leaf')).toEqual(['child', 'parent']);

    mockGraphState.subgraphs.set('node-1', ['node-1', 'a', 'b']);
    expect(service.getAllDescendants('node-1')).toEqual(['a', 'b']);
  });
});
