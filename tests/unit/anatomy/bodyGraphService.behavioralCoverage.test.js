import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

let mockCacheManagerInstance;
let mockQueryCacheInstance;

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => ({
  AnatomyCacheManager: jest.fn(() => mockCacheManagerInstance),
}));

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => ({
  AnatomyQueryCache: jest.fn(() => mockQueryCacheInstance),
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

const {
  AnatomyGraphAlgorithms: {
    getSubgraph: mockGetSubgraph,
    findPartsByType: mockFindPartsByType,
    getAnatomyRoot: mockGetAnatomyRoot,
    getPath: mockGetPath,
    getAllParts: mockGetAllPartsAlgorithm,
  },
} = jest.requireMock('../../../src/anatomy/anatomyGraphAlgorithms.js');

import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createEntityManager = () => ({
  getComponentData: jest.fn(),
  removeComponent: jest.fn().mockResolvedValue(undefined),
});

const createDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
});

const defaultDeps = () => ({
  entityManager: createEntityManager(),
  logger: createLogger(),
  eventDispatcher: createDispatcher(),
});

const createService = (overrides = {}) =>
  new BodyGraphService({ ...defaultDeps(), ...overrides });

beforeEach(() => {
  mockCacheManagerInstance = {
    hasCacheForRoot: jest.fn(),
    buildCache: jest.fn().mockResolvedValue(undefined),
    invalidateCacheForRoot: jest.fn(),
    get: jest.fn(),
    has: jest.fn(),
    size: jest.fn().mockReturnValue(0),
    validateCache: jest.fn(),
  };

  mockQueryCacheInstance = {
    getCachedFindPartsByType: jest.fn(),
    cacheFindPartsByType: jest.fn(),
    invalidateRoot: jest.fn(),
    getCachedGetAllParts: jest.fn(),
    cacheGetAllParts: jest.fn(),
  };

  AnatomyCacheManager.mockClear();
  AnatomyQueryCache.mockClear();
  AnatomyCacheManager.mockImplementation(() => mockCacheManagerInstance);
  AnatomyQueryCache.mockImplementation(() => mockQueryCacheInstance);

  mockGetSubgraph.mockReset();
  mockFindPartsByType.mockReset();
  mockGetAnatomyRoot.mockReset();
  mockGetPath.mockReset();
  mockGetAllPartsAlgorithm.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('BodyGraphService constructor', () => {
  it('validates required dependencies', () => {
    const { logger, eventDispatcher } = defaultDeps();

    expect(
      () => new BodyGraphService({ logger, eventDispatcher })
    ).toThrow(InvalidArgumentError);

    expect(() =>
      new BodyGraphService({
        entityManager: defaultDeps().entityManager,
        eventDispatcher,
      })
    ).toThrow(InvalidArgumentError);

    expect(() =>
      new BodyGraphService({
        entityManager: defaultDeps().entityManager,
        logger,
      })
    ).toThrow(InvalidArgumentError);
  });

  it('creates cache utilities with provided logger when dependencies are valid', () => {
    const deps = defaultDeps();
    const service = new BodyGraphService(deps);

    expect(service).toBeInstanceOf(BodyGraphService);
    expect(AnatomyCacheManager).toHaveBeenCalledWith({ logger: deps.logger });
    expect(AnatomyQueryCache).toHaveBeenCalledWith({ logger: deps.logger });
  });

  it('respects a provided query cache implementation', () => {
    const deps = defaultDeps();
    const customQueryCache = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(['cached']),
      cacheFindPartsByType: jest.fn(),
      invalidateRoot: jest.fn(),
      getCachedGetAllParts: jest.fn(),
      cacheGetAllParts: jest.fn(),
    };

    const service = new BodyGraphService({ ...deps, queryCache: customQueryCache });
    const result = service.findPartsByType('root', 'arm');

    expect(result).toEqual(['cached']);
    expect(AnatomyQueryCache).not.toHaveBeenCalled();
    expect(customQueryCache.getCachedFindPartsByType).toHaveBeenCalledWith(
      'root',
      'arm'
    );
  });
});

describe('buildAdjacencyCache', () => {
  it('builds cache when missing', async () => {
    const deps = defaultDeps();
    mockCacheManagerInstance.hasCacheForRoot.mockReturnValue(false);
    const service = new BodyGraphService(deps);

    await service.buildAdjacencyCache('root-1');

    expect(mockCacheManagerInstance.buildCache).toHaveBeenCalledWith(
      'root-1',
      deps.entityManager
    );
  });

  it('skips building when cache exists', async () => {
    const deps = defaultDeps();
    mockCacheManagerInstance.hasCacheForRoot.mockReturnValue(true);
    const service = new BodyGraphService(deps);

    await service.buildAdjacencyCache('root-2');

    expect(mockCacheManagerInstance.buildCache).not.toHaveBeenCalled();
  });
});

describe('detachPart', () => {
  it('throws when entity lacks joint data', async () => {
    const deps = defaultDeps();
    deps.entityManager.getComponentData.mockReturnValue(null);
    const service = new BodyGraphService(deps);

    await expect(service.detachPart('missing')).rejects.toBeInstanceOf(
      InvalidArgumentError
    );
  });

  it('detaches part with cascade, invalidates caches and dispatches event', async () => {
    const deps = defaultDeps();
    deps.entityManager.getComponentData.mockReturnValue({
      parentId: 'torso',
      socketId: 'socket-1',
    });
    mockGetSubgraph.mockReturnValue(['arm', 'hand']);
    mockGetAnatomyRoot.mockReturnValue('root-entity');

    const service = new BodyGraphService(deps);
    jest.spyOn(Date, 'now').mockReturnValue(1234567890);

    const result = await service.detachPart('arm');

    expect(mockGetSubgraph).toHaveBeenCalledWith('arm', mockCacheManagerInstance);
    expect(deps.entityManager.removeComponent).toHaveBeenCalledWith(
      'arm',
      'anatomy:joint'
    );
    expect(mockCacheManagerInstance.invalidateCacheForRoot).toHaveBeenCalledWith(
      'root-entity'
    );
    expect(mockQueryCacheInstance.invalidateRoot).toHaveBeenCalledWith(
      'root-entity'
    );
    expect(deps.eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'arm',
        parentEntityId: 'torso',
        socketId: 'socket-1',
        detachedCount: 2,
        reason: 'manual',
        timestamp: 1234567890,
      })
    );
    expect(deps.logger.info).toHaveBeenCalledWith(
      "BodyGraphService: Detached 2 entities from parent 'torso'"
    );
    expect(result).toEqual({
      detached: ['arm', 'hand'],
      parentId: 'torso',
      socketId: 'socket-1',
    });
  });

  it('supports non-cascading detach operations', async () => {
    const deps = defaultDeps();
    deps.entityManager.getComponentData.mockReturnValue({
      parentId: 'torso',
      socketId: 'socket-2',
    });
    mockGetAnatomyRoot.mockReturnValue('root-entity');

    const service = new BodyGraphService(deps);
    jest.spyOn(Date, 'now').mockReturnValue(999);

    const result = await service.detachPart('arm', {
      cascade: false,
      reason: 'auto',
    });

    expect(mockGetSubgraph).not.toHaveBeenCalled();
    expect(deps.eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'arm',
        detachedCount: 1,
        reason: 'auto',
        timestamp: 999,
      })
    );
    expect(result).toEqual({
      detached: ['arm'],
      parentId: 'torso',
      socketId: 'socket-2',
    });
  });
});

describe('findPartsByType', () => {
  it('returns cached results when present', () => {
    const service = createService();
    mockQueryCacheInstance.getCachedFindPartsByType.mockReturnValue(['a']);

    const result = service.findPartsByType('root', 'type');

    expect(result).toEqual(['a']);
    expect(mockFindPartsByType).not.toHaveBeenCalled();
  });

  it('computes and caches results when missing', () => {
    const service = createService();
    mockQueryCacheInstance.getCachedFindPartsByType.mockReturnValue(undefined);
    mockFindPartsByType.mockReturnValue(['a', 'b']);

    const result = service.findPartsByType('root', 'type');

    expect(mockFindPartsByType).toHaveBeenCalledWith(
      'root',
      'type',
      mockCacheManagerInstance
    );
    expect(mockQueryCacheInstance.cacheFindPartsByType).toHaveBeenCalledWith(
      'root',
      'type',
      ['a', 'b']
    );
    expect(result).toEqual(['a', 'b']);
  });
});

describe('delegated graph helpers', () => {
  it('returns anatomy root from algorithms', () => {
    const deps = defaultDeps();
    const service = new BodyGraphService(deps);
    mockGetAnatomyRoot.mockReturnValue('root-123');

    expect(service.getAnatomyRoot('arm')).toBe('root-123');
    expect(mockGetAnatomyRoot).toHaveBeenCalledWith(
      'arm',
      mockCacheManagerInstance,
      deps.entityManager
    );
  });

  it('returns path from algorithms', () => {
    const service = createService();
    mockGetPath.mockReturnValue(['a', 'b']);

    expect(service.getPath('a', 'b')).toEqual(['a', 'b']);
    expect(mockGetPath).toHaveBeenCalledWith('a', 'b', mockCacheManagerInstance);
  });
});

describe('getAllParts', () => {
  it('returns empty list and logs when body component missing', () => {
    const deps = defaultDeps();
    const service = new BodyGraphService(deps);

    const parts = service.getAllParts(null);

    expect(parts).toEqual([]);
    expect(deps.logger.debug).toHaveBeenCalledWith(
      'BodyGraphService.getAllParts: No bodyComponent provided'
    );
  });

  it('uses actor root when cached and caches result when computed', () => {
    const deps = defaultDeps();
    mockCacheManagerInstance.has.mockReturnValue(true);
    mockCacheManagerInstance.size.mockReturnValue(42);
    mockQueryCacheInstance.getCachedGetAllParts.mockReturnValue(undefined);
    mockGetAllPartsAlgorithm.mockReturnValue(['p1', 'p2', 'p3']);

    const service = new BodyGraphService(deps);
    const bodyComponent = { body: { root: 'blueprint-root' } };
    const parts = service.getAllParts(bodyComponent, 'actor-1');

    expect(mockCacheManagerInstance.has).toHaveBeenCalledWith('actor-1');
    expect(mockGetAllPartsAlgorithm).toHaveBeenCalledWith(
      'actor-1',
      mockCacheManagerInstance,
      deps.entityManager
    );
    expect(mockQueryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith(
      'actor-1',
      ['p1', 'p2', 'p3']
    );
    expect(parts).toEqual(['p1', 'p2', 'p3']);
  });

  it('uses blueprint root when actor cache is missing and returns cached query results', () => {
    const deps = defaultDeps();
    mockCacheManagerInstance.has.mockReturnValue(false);
    mockCacheManagerInstance.size.mockReturnValue(0);
    mockQueryCacheInstance.getCachedGetAllParts.mockReturnValue(['cached']);

    const service = new BodyGraphService(deps);
    const bodyComponent = { body: { root: 'blue-root' } };
    const parts = service.getAllParts(bodyComponent, 'actor-2');

    expect(mockQueryCacheInstance.getCachedGetAllParts).toHaveBeenCalledWith(
      'blue-root'
    );
    expect(mockGetAllPartsAlgorithm).not.toHaveBeenCalled();
    expect(parts).toEqual(['cached']);
  });
});

describe('component inspection helpers', () => {
  it('detects components across all parts', () => {
    const deps = defaultDeps();
    const service = new BodyGraphService(deps);
    jest.spyOn(service, 'getAllParts').mockReturnValue([
      'part-1',
      'part-2',
      'part-3',
    ]);
    deps.entityManager.getComponentData.mockImplementation((entityId) => {
      if (entityId === 'part-2') return {}; // ignored empty object
      if (entityId === 'part-3') return { value: 5 };
      return null;
    });

    expect(service.hasPartWithComponent({}, 'comp')).toBe(true);
    expect(deps.entityManager.getComponentData).toHaveBeenCalledTimes(3);
  });

  it('returns false when no components are found', () => {
    const deps = defaultDeps();
    const service = new BodyGraphService(deps);
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1']);
    deps.entityManager.getComponentData.mockReturnValue(undefined);

    expect(service.hasPartWithComponent({}, 'comp')).toBe(false);
  });

  it('matches nested component values', () => {
    const deps = defaultDeps();
    const service = new BodyGraphService(deps);
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1', 'part-2']);
    deps.entityManager.getComponentData.mockImplementation((entityId) => {
      if (entityId === 'part-1') return { details: { status: 'idle' } };
      return { details: { status: 'ready' } };
    });

    expect(
      service.hasPartWithComponentValue({}, 'comp', 'details.status', 'ready')
    ).toEqual({ found: true, partId: 'part-2' });
    expect(
      service.hasPartWithComponentValue({}, 'comp', 'details.status', 'active')
    ).toEqual({ found: false });
  });
});

describe('getBodyGraph', () => {
  it('validates entity identifier', async () => {
    const service = createService();
    await expect(service.getBodyGraph('')).rejects.toBeInstanceOf(
      InvalidArgumentError
    );
  });

  it('throws when anatomy body component is missing', async () => {
    const deps = defaultDeps();
    deps.entityManager.getComponentData.mockResolvedValueOnce(null);
    const service = new BodyGraphService(deps);

    await expect(service.getBodyGraph('actor-1')).rejects.toThrow(
      'Entity actor-1 has no anatomy:body component'
    );
  });

  it('builds cache and returns helper functions', async () => {
    const deps = defaultDeps();
    deps.entityManager.getComponentData.mockResolvedValueOnce({
      body: { root: 'root-1' },
    });
    mockCacheManagerInstance.get.mockImplementation((id) => {
      if (id === 'part-1') {
        return { children: ['child-1', 'child-2'] };
      }
      return { children: [] };
    });

    const service = new BodyGraphService(deps);
    const buildSpy = jest
      .spyOn(service, 'buildAdjacencyCache')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service, 'getAllParts')
      .mockReturnValue(['part-1', 'part-2']);

    const graph = await service.getBodyGraph('actor-1');

    expect(buildSpy).toHaveBeenCalledWith('actor-1');
    expect(graph.getAllPartIds()).toEqual(['part-1', 'part-2']);
    expect(graph.getConnectedParts('part-1')).toEqual(['child-1', 'child-2']);
  });
});

describe('getAnatomyData', () => {
  it('validates entity identifier', async () => {
    const service = createService();
    await expect(service.getAnatomyData(null)).rejects.toBeInstanceOf(
      InvalidArgumentError
    );
  });

  it('returns null when body component missing', async () => {
    const deps = defaultDeps();
    deps.entityManager.getComponentData.mockResolvedValueOnce(null);
    const service = new BodyGraphService(deps);

    await expect(service.getAnatomyData('entity-1')).resolves.toBeNull();
    expect(deps.logger.debug).toHaveBeenCalledWith(
      "BodyGraphService.getAnatomyData: Entity 'entity-1' has no anatomy:body component"
    );
  });

  it('returns recipe and root data when available', async () => {
    const deps = defaultDeps();
    deps.entityManager.getComponentData.mockResolvedValueOnce({
      recipeId: 'recipe-1',
    });
    const service = new BodyGraphService(deps);

    await expect(service.getAnatomyData('entity-2')).resolves.toEqual({
      recipeId: 'recipe-1',
      rootEntityId: 'entity-2',
    });
  });
});

describe('cache utilities', () => {
  it('delegates validation to cache manager', () => {
    const service = createService();
    mockCacheManagerInstance.validateCache.mockReturnValue(true);

    expect(service.validateCache()).toBe(true);
    expect(mockCacheManagerInstance.validateCache).toHaveBeenCalled();
  });

  it('delegates cache presence checks', () => {
    const service = createService();
    mockCacheManagerInstance.hasCacheForRoot.mockReturnValue(true);

    expect(service.hasCache('root')).toBe(true);
    expect(mockCacheManagerInstance.hasCacheForRoot).toHaveBeenCalledWith('root');
  });

  it('exposes cached children and parent lookups', () => {
    const service = createService();
    mockCacheManagerInstance.get.mockImplementation((id) => {
      if (id === 'child') return { parentId: 'parent', children: [] };
      return { parentId: null, children: ['child'] };
    });

    expect(service.getChildren('root')).toEqual(['child']);
    expect(service.getParent('child')).toEqual('parent');
  });

  it('computes ancestor lists by following parents', () => {
    const service = createService();
    mockCacheManagerInstance.get.mockImplementation((id) => {
      if (id === 'third') return { parentId: 'second' };
      if (id === 'second') return { parentId: 'first' };
      if (id === 'first') return { parentId: null };
      return { parentId: null };
    });

    expect(service.getAncestors('third')).toEqual(['second', 'first']);
  });

  it('derives descendants via AnatomyGraphAlgorithms', () => {
    const service = createService();
    mockGetSubgraph.mockReturnValue(['node', 'child-1', 'child-2']);

    expect(service.getAllDescendants('node')).toEqual(['child-1', 'child-2']);
    expect(mockGetSubgraph).toHaveBeenCalledWith('node', mockCacheManagerInstance);
  });
});

// Sanity check to ensure mocked algorithms map is what the service uses
it('uses the mocked AnatomyGraphAlgorithms implementation', () => {
  expect(AnatomyGraphAlgorithms.getSubgraph).toBe(mockGetSubgraph);
  expect(AnatomyGraphAlgorithms.getAllParts).toBe(mockGetAllPartsAlgorithm);
});
