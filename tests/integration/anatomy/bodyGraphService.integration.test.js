/**
 * @file Integration tests providing thorough coverage for BodyGraphService.
 * These tests focus on the service's orchestration logic and interactions with
 * its collaborators rather than deeply testing collaborator implementations.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
} from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

const cacheManagerInstances = [];
const queryCacheInstances = [];
var mockGetSubgraph;
var mockFindPartsByType;
var mockGetAnatomyRoot;
var mockGetPath;
var mockGetAllParts;

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => ({
  AnatomyCacheManager: jest.fn().mockImplementation(() => {
    const instance = {
      hasCacheForRoot: jest.fn().mockReturnValue(false),
      buildCache: jest.fn().mockResolvedValue(undefined),
      invalidateCacheForRoot: jest.fn(),
      get: jest.fn(),
      has: jest.fn().mockReturnValue(false),
      size: jest.fn().mockReturnValue(0),
      validateCache: jest.fn(),
    };
    cacheManagerInstances.push(instance);
    return instance;
  }),
}));

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => ({
  AnatomyQueryCache: jest.fn().mockImplementation(() => {
    const instance = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
      cacheFindPartsByType: jest.fn(),
      invalidateRoot: jest.fn(),
      getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
      cacheGetAllParts: jest.fn(),
    };
    queryCacheInstances.push(instance);
    return instance;
  }),
}));

jest.mock('../../../src/anatomy/anatomyGraphAlgorithms.js', () => {
  mockGetSubgraph = jest.fn();
  mockFindPartsByType = jest.fn();
  mockGetAnatomyRoot = jest.fn();
  mockGetPath = jest.fn();
  mockGetAllParts = jest.fn();

  return {
    AnatomyGraphAlgorithms: {
      getSubgraph: mockGetSubgraph,
      findPartsByType: mockFindPartsByType,
      getAnatomyRoot: mockGetAnatomyRoot,
      getPath: mockGetPath,
      getAllParts: mockGetAllParts,
    },
  };
});

jest.mock('../../../src/anatomy/constants/anatomyConstants.js', () => ({
  ANATOMY_CONSTANTS: {
    LIMB_DETACHED_EVENT_ID: 'anatomy.limb.detached.test',
  },
}));

import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { ANATOMY_CONSTANTS } from '../../../src/anatomy/constants/anatomyConstants.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createEntityManager = (overrides = {}) => ({
  getComponentData: jest.fn(),
  removeComponent: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const createDispatcher = (overrides = {}) => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const resetAlgorithmMocks = () => {
  mockGetSubgraph?.mockReset();
  mockFindPartsByType?.mockReset();
  mockGetAnatomyRoot?.mockReset();
  mockGetPath?.mockReset();
  mockGetAllParts?.mockReset();
};

const getLast = (items) => items[items.length - 1];

const createService = ({
  entityManager = createEntityManager(),
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

  return {
    service,
    entityManager,
    logger,
    eventDispatcher,
    cacheManager: getLast(cacheManagerInstances),
    queryCache: queryCache || getLast(queryCacheInstances),
  };
};

describe('BodyGraphService integration coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cacheManagerInstances.length = 0;
    queryCacheInstances.length = 0;
    resetAlgorithmMocks();
  });

  it('validates constructor dependencies and sets up caches', () => {
    const entityManager = createEntityManager();
    const logger = createLogger();
    const dispatcher = createDispatcher();

    expect(
      () => new BodyGraphService({ logger, eventDispatcher: dispatcher })
    ).toThrow('entityManager is required');
    expect(
      () => new BodyGraphService({ entityManager, eventDispatcher: dispatcher })
    ).toThrow('logger is required');
    expect(
      () => new BodyGraphService({ entityManager, logger })
    ).toThrow('eventDispatcher is required');

    const { queryCache, cacheManager } = createService();
    expect(queryCache).toBeDefined();
    expect(cacheManager).toBeDefined();
    expect(AnatomyCacheManager).toHaveBeenCalledTimes(1);
    expect(AnatomyQueryCache).toHaveBeenCalledTimes(1);
    expect(LIMB_DETACHED_EVENT_ID).toBe(ANATOMY_CONSTANTS.LIMB_DETACHED_EVENT_ID);
  });

  it('builds adjacency cache only when missing', async () => {
    const { service, cacheManager, entityManager } = createService();
    cacheManager.hasCacheForRoot.mockReturnValueOnce(false);
    cacheManager.hasCacheForRoot.mockReturnValueOnce(true);

    await service.buildAdjacencyCache('root-A');
    expect(cacheManager.buildCache).toHaveBeenCalledWith('root-A', entityManager);

    await service.buildAdjacencyCache('root-A');
    expect(cacheManager.buildCache).toHaveBeenCalledTimes(1);
  });

  it('throws when detaching a part without a joint component', async () => {
    const { service, entityManager } = createService();
    entityManager.getComponentData.mockReturnValueOnce(null);

    await expect(service.detachPart('limb-1')).rejects.toThrow(
      "Entity 'limb-1' has no joint component - cannot detach"
    );
  });

  it('detaches a part with cascading children and invalidates caches', async () => {
    const {
      service,
      entityManager,
      cacheManager,
      queryCache,
      eventDispatcher,
      logger,
    } = createService();

    entityManager.getComponentData.mockImplementation((id, componentId) => {
      if (componentId === 'anatomy:joint') {
        return { parentId: 'parent-1', socketId: 'socket-7' };
      }
      return null;
    });
    mockGetSubgraph.mockReturnValue(['limb-1', 'child-1']);
    mockGetAnatomyRoot.mockReturnValue('root-entity');

    const result = await service.detachPart('limb-1');

    expect(entityManager.removeComponent).toHaveBeenCalledWith(
      'limb-1',
      'anatomy:joint'
    );
    expect(cacheManager.invalidateCacheForRoot).toHaveBeenCalledWith('root-entity');
    expect(queryCache.invalidateRoot).toHaveBeenCalledWith('root-entity');
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'limb-1',
        parentEntityId: 'parent-1',
        socketId: 'socket-7',
        detachedCount: 2,
        reason: 'manual',
      })
    );
    expect(logger.info).toHaveBeenCalled();
    expect(result).toEqual({
      detached: ['limb-1', 'child-1'],
      parentId: 'parent-1',
      socketId: 'socket-7',
    });
  });

  it('supports non-cascading detach operations', async () => {
    const { service, entityManager, cacheManager, queryCache, eventDispatcher } =
      createService();

    entityManager.getComponentData.mockReturnValueOnce({
      parentId: 'parent-2',
      socketId: 'socket-2',
    });
    mockGetAnatomyRoot.mockReturnValueOnce(null);

    const outcome = await service.detachPart('limb-2', {
      cascade: false,
      reason: 'surgical',
    });

    expect(mockGetSubgraph).not.toHaveBeenCalled();
    expect(cacheManager.invalidateCacheForRoot).not.toHaveBeenCalled();
    expect(queryCache.invalidateRoot).not.toHaveBeenCalled();
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedCount: 1,
        reason: 'surgical',
      })
    );
    expect(outcome.detached).toEqual(['limb-2']);
  });

  it('uses cached results when finding parts by type', () => {
    const { service, queryCache, cacheManager } = createService();
    queryCache.getCachedFindPartsByType.mockReturnValueOnce(['cached-arm']);

    const cached = service.findPartsByType('root-1', 'arm');
    expect(cached).toEqual(['cached-arm']);
    expect(mockFindPartsByType).not.toHaveBeenCalled();

    queryCache.getCachedFindPartsByType.mockReturnValueOnce(undefined);
    mockFindPartsByType.mockReturnValueOnce(['computed-leg']);

    const computed = service.findPartsByType('root-1', 'leg');
    expect(computed).toEqual(['computed-leg']);
    expect(mockFindPartsByType).toHaveBeenCalledWith(
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

  it('delegates to graph algorithms for root and path lookups', () => {
    const { service, cacheManager, entityManager } = createService();
    mockGetAnatomyRoot.mockReturnValueOnce('root-z');
    mockGetPath.mockReturnValueOnce(['a', 'b']);

    expect(service.getAnatomyRoot('part-z')).toBe('root-z');
    expect(mockGetAnatomyRoot).toHaveBeenCalledWith(
      'part-z',
      cacheManager,
      entityManager
    );

    expect(service.getPath('from', 'to')).toEqual(['a', 'b']);
    expect(mockGetPath).toHaveBeenCalledWith('from', 'to', cacheManager);
  });

  it('returns empty list when body component is missing', () => {
    const { service } = createService();
    expect(service.getAllParts(null)).toEqual([]);
  });

  it('returns empty list when body component lacks root identifier', () => {
    const { service } = createService();

    const result = service.getAllParts({ body: {} });

    expect(result).toEqual([]);
    expect(mockGetAllParts).not.toHaveBeenCalled();
  });

  it('collects parts using blueprint root when actor cache is missing', () => {
    const { service, cacheManager, entityManager, queryCache } = createService();
    cacheManager.has.mockReturnValue(false);
    cacheManager.size.mockReturnValue(5);
    mockGetAllParts.mockReturnValueOnce(['torso', 'arm']);

    const result = service.getAllParts(
      { body: { root: 'blueprint-root' } },
      'actor-missing'
    );

    expect(mockGetAllParts).toHaveBeenCalledWith(
      'blueprint-root',
      cacheManager,
      entityManager
    );
    expect(queryCache.cacheGetAllParts).toHaveBeenCalledWith(
      'blueprint-root',
      ['torso', 'arm']
    );
    expect(result).toEqual(['torso', 'arm']);
  });

  it('collects parts using direct root structure when provided', () => {
    const { service, cacheManager, entityManager, queryCache } = createService();
    cacheManager.has.mockReturnValue(false);
    mockGetAllParts.mockReturnValueOnce(['direct-arm']);

    const result = service.getAllParts({ root: 'direct-root' });

    expect(mockGetAllParts).toHaveBeenCalledWith(
      'direct-root',
      cacheManager,
      entityManager
    );
    expect(queryCache.cacheGetAllParts).toHaveBeenCalledWith(
      'direct-root',
      ['direct-arm']
    );
    expect(result).toEqual(['direct-arm']);
  });

  it('prefers actor entity as cache root when available', () => {
    const { service, cacheManager, entityManager, queryCache } = createService();
    cacheManager.has.mockImplementation((id) => id === 'actor-available');
    mockGetAllParts.mockReturnValueOnce(['actor-torso']);

    const result = service.getAllParts({ root: 'unused' }, 'actor-available');

    expect(mockGetAllParts).toHaveBeenCalledWith(
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

  it('serves cached all-part results without recomputation', () => {
    const { service, queryCache } = createService();
    queryCache.getCachedGetAllParts.mockReturnValueOnce(['cached-head']);

    const cached = service.getAllParts({ body: { root: 'cache-root' } }, 'actor');
    expect(cached).toEqual(['cached-head']);
    expect(mockGetAllParts).not.toHaveBeenCalled();
  });

  it('logs truncated results when anatomy query returns many parts', () => {
    const { service, logger, cacheManager } = createService();
    cacheManager.has.mockReturnValue(false);
    const largeResult = Array.from({ length: 7 }, (_, idx) => `part-${idx}`);
    mockGetAllParts.mockReturnValueOnce(largeResult);

    const result = service.getAllParts({ body: { root: 'bp-root' } });

    expect(result).toEqual(largeResult);
    const debugMessages = logger.debug.mock.calls
      .flat()
      .filter((msg) => typeof msg === 'string');
    expect(debugMessages.some((msg) => msg.includes('...'))).toBe(true);
  });

  it('detects components on parts', () => {
    const { service, entityManager } = createService();
    const partIds = ['p1', 'p2', 'p3'];
    jest.spyOn(service, 'getAllParts').mockReturnValue(partIds);

    entityManager.getComponentData
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({})
      .mockReturnValueOnce({ status: 'present' });

    expect(
      service.hasPartWithComponent({ body: { root: 'r' } }, 'component:status')
    ).toBe(true);
    expect(entityManager.getComponentData).toHaveBeenCalledTimes(3);
  });

  it('retrieves nested component values correctly', () => {
    const { service, entityManager } = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['p1', 'p2']);

    entityManager.getComponentData
      .mockReturnValueOnce({ details: { id: 'wrong' } })
      .mockReturnValueOnce({ details: { id: 'target' } });

    expect(
      service.hasPartWithComponentValue(
        { body: { root: 'r' } },
        'component:details',
        'details.id',
        'target'
      )
    ).toEqual({ found: true, partId: 'p2' });
  });

  it('returns false when component data does not match expected value', () => {
    const { service, entityManager } = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['p1', 'p2']);

    entityManager.getComponentData
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ details: {} });

    expect(
      service.hasPartWithComponentValue(
        { body: { root: 'r' } },
        'component:details',
        'details.id',
        'target'
      )
    ).toEqual({ found: false });
  });

  it('throws and handles error scenarios when building body graph', async () => {
    const base = createService();

    await expect(base.service.getBodyGraph(0)).rejects.toBeInstanceOf(
      InvalidArgumentError
    );

    base.entityManager.getComponentData.mockReturnValueOnce(null);
    await expect(base.service.getBodyGraph('entity-no-body')).rejects.toThrow(
      'has no anatomy:body component'
    );
  });

  it('returns body graph helpers when anatomy exists', async () => {
    const { service, entityManager, cacheManager } = createService();
    const bodyComponent = { body: { root: 'bp-root' } };
    entityManager.getComponentData.mockReturnValue(bodyComponent);
    cacheManager.hasCacheForRoot.mockReturnValue(false);
    cacheManager.get.mockReturnValue({ children: ['child-1'] });
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1', 'part-2']);

    const graph = await service.getBodyGraph('entity-1');
    expect(cacheManager.buildCache).toHaveBeenCalledWith('entity-1', entityManager);
    expect(graph.getAllPartIds()).toEqual(['part-1', 'part-2']);
    expect(graph.getConnectedParts('entity-1')).toEqual(['child-1']);
  });

  it('returns empty child list when cache does not include part node', async () => {
    const { service, entityManager, cacheManager } = createService();
    const bodyComponent = { body: { root: 'bp-root' } };
    entityManager.getComponentData.mockReturnValue(bodyComponent);
    cacheManager.get.mockImplementation((id) => {
      if (id === 'entity-1') {
        return { children: ['child-1'] };
      }
      return undefined;
    });

    const graph = await service.getBodyGraph('entity-1');

    expect(graph.getConnectedParts('missing-node')).toEqual([]);
  });

  it('retrieves anatomy data and validates cache state', async () => {
    const { service, entityManager, cacheManager } = createService();

    await expect(service.getAnatomyData(12)).rejects.toBeInstanceOf(
      InvalidArgumentError
    );

    entityManager.getComponentData.mockReturnValueOnce(null);
    await expect(service.getAnatomyData('no-anatomy')).resolves.toBeNull();

    entityManager.getComponentData.mockReturnValueOnce({ recipeId: 'recipe-42' });
    await expect(service.getAnatomyData('has-anatomy')).resolves.toEqual({
      recipeId: 'recipe-42',
      rootEntityId: 'has-anatomy',
    });

    cacheManager.validateCache.mockReturnValue(true);
    expect(service.validateCache()).toBe(true);
  });

  it('provides null recipe identifier when anatomy data lacks recipeId', async () => {
    const { service, entityManager } = createService();
    entityManager.getComponentData.mockReturnValueOnce({});

    await expect(service.getAnatomyData('actor-without-recipe')).resolves.toEqual({
      recipeId: null,
      rootEntityId: 'actor-without-recipe',
    });
  });

  it('exposes cache helper methods for parent and ancestry operations', () => {
    const { service, cacheManager } = createService();
    cacheManager.hasCacheForRoot.mockReturnValue(true);
    cacheManager.get.mockImplementation((id) => {
      if (id === 'node-1') {
        return { children: ['child-A'] };
      }
      if (id === 'node-2') {
        return { parentId: 'parent-1' };
      }
      if (id === 'leaf-1') {
        return { parentId: 'parent-1' };
      }
      if (id === 'parent-1') {
        return { parentId: 'root-1' };
      }
      return null;
    });

    expect(service.hasCache('root-123')).toBe(true);
    expect(service.getChildren('node-1')).toEqual(['child-A']);
    expect(service.getParent('node-2')).toBe('parent-1');
    expect(service.getAncestors('leaf-1')).toEqual(['parent-1', 'root-1']);
  });

  it('returns cache fallbacks when children or parents are missing', () => {
    const { service, cacheManager } = createService();
    cacheManager.get.mockReturnValue(undefined);

    expect(service.getChildren('missing')).toEqual([]);
    expect(service.getParent('missing')).toBeNull();
  });

  it('lists descendants using subgraph traversal', () => {
    const { service } = createService();
    mockGetSubgraph.mockReturnValue(['root', 'child-1', 'child-2']);

    expect(service.getAllDescendants('root')).toEqual(['child-1', 'child-2']);
    expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
      'root',
      getLast(cacheManagerInstances)
    );
  });
});
