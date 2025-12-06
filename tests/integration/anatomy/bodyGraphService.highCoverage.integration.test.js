import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const createdCacheManagers = [];
const createdQueryCaches = [];

class MockCacheManager {
  constructor({ logger }) {
    this.logger = logger;
    this.rootCaches = new Set();
    this.nodes = new Map();
    this.hasCacheForRoot = jest.fn((rootId) => this.rootCaches.has(rootId));
    this.buildCache = jest.fn(async (rootId, entityManager) => {
      this.rootCaches.add(rootId);
      this.nodes.set(rootId, this.nodes.get(rootId) || { children: [] });
      return { rootId, entityManager };
    });
    this.invalidateCacheForRoot = jest.fn((rootId) => {
      this.rootCaches.delete(rootId);
      this.nodes.delete(rootId);
    });
    this.get = jest.fn((entityId) => this.nodes.get(entityId));
    this.has = jest.fn(
      (entityId) => this.rootCaches.has(entityId) || this.nodes.has(entityId)
    );
    this.size = jest.fn(() => this.rootCaches.size);
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
    getSubgraph: jest.fn(
      (partId) => mockGraphState.subgraphs.get(partId) || [partId]
    ),
    findPartsByType: jest.fn(
      (rootId, type) => mockGraphState.types.get(`${rootId}|${type}`) || []
    ),
    getAnatomyRoot: jest.fn(
      (partId) => mockGraphState.roots.get(partId) || null
    ),
    getPath: jest.fn(
      (from, to) => mockGraphState.paths.get(`${from}|${to}`) || []
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
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';

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

describe('BodyGraphService integration coverage boost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createdCacheManagers.length = 0;
    createdQueryCaches.length = 0;
    resetMockGraphState();
  });

  it('validates constructor dependencies and reuses provided query cache', () => {
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

    const queryCache = new MockQueryCache({ logger });
    const service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
      queryCache,
    });

    expect(service).toBeInstanceOf(BodyGraphService);
    expect(AnatomyCacheManager).toHaveBeenCalledTimes(1);
    expect(AnatomyQueryCache).not.toHaveBeenCalled();
    expect(createdQueryCaches).toHaveLength(0);
  });

  it('builds adjacency cache only when missing', async () => {
    const { service, cacheManager, entityManager } = createService();
    cacheManager.hasCacheForRoot.mockReturnValueOnce(false);
    cacheManager.hasCacheForRoot.mockReturnValueOnce(true);

    await service.buildAdjacencyCache('root-1');
    await service.buildAdjacencyCache('root-1');

    expect(cacheManager.buildCache).toHaveBeenCalledTimes(1);
    expect(cacheManager.buildCache).toHaveBeenCalledWith(
      'root-1',
      entityManager
    );
  });

  it('detaches parts with cascading children and invalidates caches', async () => {
    const {
      service,
      entityManager,
      cacheManager,
      queryCache,
      eventDispatcher,
      logger,
    } = createService();

    entityManager.setComponent('limb-1', 'anatomy:joint', {
      parentId: 'parent-1',
      socketId: 'socket-2',
    });
    mockGraphState.subgraphs.set('limb-1', ['limb-1', 'child-1']);
    mockGraphState.roots.set('parent-1', 'root-entity');
    cacheManager.rootCaches.add('root-entity');

    const result = await service.detachPart('limb-1');

    expect(entityManager.removeComponent).toHaveBeenCalledWith(
      'limb-1',
      'anatomy:joint'
    );
    expect(cacheManager.invalidateCacheForRoot).toHaveBeenCalledWith(
      'root-entity'
    );
    expect(queryCache.invalidateRoot).toHaveBeenCalledWith('root-entity');
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'limb-1',
        parentEntityId: 'parent-1',
        socketId: 'socket-2',
        detachedCount: 2,
        reason: 'manual',
      })
    );
    expect(logger.info).toHaveBeenCalled();
    expect(result).toEqual({
      detached: ['limb-1', 'child-1'],
      parentId: 'parent-1',
      socketId: 'socket-2',
    });
  });

  it('supports non-cascading detachment and custom reasons', async () => {
    const {
      service,
      entityManager,
      cacheManager,
      queryCache,
      eventDispatcher,
    } = createService();

    entityManager.setComponent('limb-2', 'anatomy:joint', {
      parentId: 'torso',
      socketId: 'socket-9',
    });

    const outcome = await service.detachPart('limb-2', {
      cascade: false,
      reason: 'surgical',
    });

    expect(mockAlgorithms.getSubgraph).not.toHaveBeenCalled();
    expect(cacheManager.invalidateCacheForRoot).not.toHaveBeenCalled();
    expect(queryCache.invalidateRoot).not.toHaveBeenCalled();
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({ detachedCount: 1, reason: 'surgical' })
    );
    expect(outcome.detached).toEqual(['limb-2']);
  });

  it('throws when detaching parts without a joint component', async () => {
    const { service } = createService();

    await expect(service.detachPart('missing-limb')).rejects.toThrow(
      "Entity 'missing-limb' has no joint component - cannot detach"
    );
  });

  it('finds parts by type using cache when available', () => {
    const { service, queryCache, cacheManager } = createService();
    queryCache.getCachedFindPartsByType.mockReturnValueOnce(['cached-arm']);

    expect(service.findPartsByType('actor-1', 'arm')).toEqual(['cached-arm']);
    expect(mockAlgorithms.findPartsByType).not.toHaveBeenCalled();

    queryCache.getCachedFindPartsByType.mockReturnValueOnce(undefined);
    mockGraphState.types.set('actor-1|leg', ['computed-leg']);

    expect(service.findPartsByType('actor-1', 'leg')).toEqual(['computed-leg']);
    expect(mockAlgorithms.findPartsByType).toHaveBeenCalledWith(
      'actor-1',
      'leg',
      cacheManager
    );
    expect(queryCache.cacheFindPartsByType).toHaveBeenCalledWith(
      'actor-1',
      'leg',
      ['computed-leg']
    );
  });

  it('delegates to graph algorithms for root and path lookups', () => {
    const { service, cacheManager, entityManager } = createService();
    mockGraphState.roots.set('part-1', 'root-9');
    mockGraphState.paths.set('from|to', ['from', 'mid', 'to']);

    expect(service.getAnatomyRoot('part-1')).toBe('root-9');
    expect(mockAlgorithms.getAnatomyRoot).toHaveBeenCalledWith(
      'part-1',
      cacheManager,
      entityManager
    );

    expect(service.getPath('from', 'to')).toEqual(['from', 'mid', 'to']);
    expect(mockAlgorithms.getPath).toHaveBeenCalledWith(
      'from',
      'to',
      cacheManager
    );
  });

  it('handles missing body components when fetching all parts', () => {
    const { service } = createService();

    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({ body: {} })).toEqual([]);
  });

  it('collects parts using blueprint roots and caches results', () => {
    const { service, cacheManager, entityManager, queryCache, logger } =
      createService();
    cacheManager.has.mockReturnValue(false);
    cacheManager.size.mockReturnValue(3);
    mockGraphState.allParts.set('blueprint-root', ['torso', 'arm']);

    const result = service.getAllParts(
      { body: { root: 'blueprint-root' } },
      'actor-not-in-cache'
    );

    expect(mockAlgorithms.getAllParts).toHaveBeenCalledWith(
      'blueprint-root',
      cacheManager,
      entityManager
    );
    expect(queryCache.cacheGetAllParts).toHaveBeenCalledWith('blueprint-root', [
      'torso',
      'arm',
    ]);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('cache size: 3')
    );
    expect(result).toEqual(['torso', 'arm']);
  });

  it('prefers actor roots when the cache already knows the actor', () => {
    const { service, cacheManager, entityManager, queryCache, logger } =
      createService();
    cacheManager.has.mockImplementation(
      (entityId) => entityId === 'actor-available'
    );
    mockGraphState.allParts.set('actor-available', ['actor-torso']);

    const result = service.getAllParts({ root: 'unused' }, 'actor-available');

    expect(mockAlgorithms.getAllParts).toHaveBeenCalledWith(
      'actor-available',
      cacheManager,
      entityManager
    );
    expect(queryCache.cacheGetAllParts).toHaveBeenCalledWith(
      'actor-available',
      ['actor-torso']
    );
    expect(result).toEqual(['actor-torso']);
  });

  it('supports direct body structures and cached responses', () => {
    const { service, cacheManager, entityManager, queryCache } =
      createService();
    mockGraphState.allParts.set('direct-root', ['arm']);

    const first = service.getAllParts({ root: 'direct-root' });
    expect(first).toEqual(['arm']);

    queryCache.getCachedGetAllParts.mockReturnValueOnce(['cached-head']);
    const cached = service.getAllParts(
      { body: { root: 'direct-root' } },
      'actor-x'
    );
    expect(cached).toEqual(['cached-head']);
    expect(mockAlgorithms.getAllParts).toHaveBeenCalledTimes(1);
  });

  it('logs truncated debug output when many parts are returned', () => {
    const { service, cacheManager, entityManager, logger } = createService();
    cacheManager.has.mockReturnValue(false);
    const largeResult = Array.from(
      { length: 7 },
      (_, index) => `part-${index}`
    );
    mockGraphState.allParts.set('blueprint-root', largeResult);

    const result = service.getAllParts({ body: { root: 'blueprint-root' } });

    expect(result).toEqual(largeResult);
    const debugMessages = logger.debug.mock.calls
      .flat()
      .filter((msg) => typeof msg === 'string');
    const infoMessages = logger.info.mock.calls
      .flat()
      .filter((msg) => typeof msg === 'string');
    expect(
      [...debugMessages, ...infoMessages].some((msg) => msg.includes('...'))
    ).toBe(true);
  });

  it('detects components on parts', () => {
    const { service, entityManager } = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['p1', 'p2', 'p3']);

    entityManager.setComponent('p1', 'component:x', null);
    entityManager.setComponent('p2', 'component:x', {});
    entityManager.setComponent('p3', 'component:x', { status: 'present' });

    expect(
      service.hasPartWithComponent({ body: { root: 'r' } }, 'component:x')
    ).toBe(true);
  });

  it('locates nested component values and handles misses', () => {
    const { service, entityManager } = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['p1', 'p2']);

    entityManager.setComponent('p1', 'component:details', {
      details: { id: 'wrong' },
    });
    entityManager.setComponent('p2', 'component:details', {
      details: { id: 'target' },
    });

    expect(
      service.hasPartWithComponentValue(
        { body: { root: 'r' } },
        'component:details',
        'details.id',
        'target'
      )
    ).toEqual({ found: true, partId: 'p2' });

    entityManager.setComponent('p2', 'component:details', { details: {} });

    expect(
      service.hasPartWithComponentValue(
        { body: { root: 'r' } },
        'component:details',
        'details.id',
        'target'
      )
    ).toEqual({ found: false });
  });

  it('builds body graphs and exposes helpers', async () => {
    const { service, entityManager, cacheManager } = createService();
    entityManager.setComponent('actor-1', 'anatomy:body', {
      body: { root: 'blueprint' },
    });
    cacheManager.hasCacheForRoot.mockReturnValue(false);
    cacheManager.get.mockImplementation((id) =>
      id === 'actor-1' ? { children: ['child-1'] } : undefined
    );
    jest.spyOn(service, 'getAllParts').mockReturnValue(['actor-1', 'child-1']);

    const graph = await service.getBodyGraph('actor-1');

    expect(cacheManager.buildCache).toHaveBeenCalledWith(
      'actor-1',
      entityManager
    );
    expect(graph.getAllPartIds()).toEqual(['actor-1', 'child-1']);
    expect(graph.getConnectedParts('actor-1')).toEqual(['child-1']);
    expect(graph.getConnectedParts('missing')).toEqual([]);
  });

  it('validates input when building body graphs', async () => {
    const base = createService();

    await expect(base.service.getBodyGraph(123)).rejects.toBeInstanceOf(
      InvalidArgumentError
    );

    await expect(base.service.getBodyGraph('actor-no-body')).rejects.toThrow(
      'has no anatomy:body component'
    );
  });

  it('retrieves anatomy data with and without recipe identifiers', async () => {
    const { service, entityManager, cacheManager } = createService();

    await expect(service.getAnatomyData(0)).rejects.toBeInstanceOf(
      InvalidArgumentError
    );

    await expect(service.getAnatomyData('missing-body')).resolves.toBeNull();

    entityManager.setComponent('actor-a', 'anatomy:body', {
      recipeId: 'recipe-1',
    });
    await expect(service.getAnatomyData('actor-a')).resolves.toEqual({
      recipeId: 'recipe-1',
      rootEntityId: 'actor-a',
    });

    entityManager.setComponent('actor-b', 'anatomy:body', {});
    await expect(service.getAnatomyData('actor-b')).resolves.toEqual({
      recipeId: null,
      rootEntityId: 'actor-b',
    });

    cacheManager.validateCache.mockReturnValue(true);
    expect(service.validateCache()).toBe(true);
  });

  it('exposes cache helpers for children, parents, and ancestors', () => {
    const { service, cacheManager } = createService();
    cacheManager.hasCacheForRoot.mockReturnValue(true);
    cacheManager.get.mockImplementation((id) => {
      if (id === 'node-1') return { children: ['child-A'] };
      if (id === 'node-2') return { parentId: 'parent-1' };
      if (id === 'parent-1') return { parentId: 'root-1' };
      return null;
    });

    expect(service.hasCache('root-1')).toBe(true);
    expect(service.getChildren('node-1')).toEqual(['child-A']);
    expect(service.getParent('node-2')).toBe('parent-1');
    expect(service.getAncestors('node-2')).toEqual(['parent-1', 'root-1']);
    expect(service.getChildren('missing')).toEqual([]);
    expect(service.getParent('missing')).toBeNull();
  });

  it('lists descendants using subgraph traversal', () => {
    const { service, cacheManager } = createService();
    mockGraphState.subgraphs.set('root', ['root', 'child-1', 'child-2']);

    expect(service.getAllDescendants('root')).toEqual(['child-1', 'child-2']);
    expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
      'root',
      cacheManager
    );
  });

  it('exports the limb detached event identifier', () => {
    expect(LIMB_DETACHED_EVENT_ID).toBe(TEST_EVENT_ID);
  });
});
