import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import BodyGraphService from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

/** @type {ReturnType<typeof createService>} */
let service;
let entityManager;
let logger;
let eventDispatcher;
let queryCache;

const createService = (overrides = {}) =>
  new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
    queryCache,
    ...overrides,
  });

beforeEach(() => {
  entityManager = {
    getComponentData: jest.fn(),
    removeComponent: jest.fn().mockResolvedValue(undefined),
    getEntityInstance: jest.fn(),
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

  queryCache = {
    getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
    cacheFindPartsByType: jest.fn(),
    getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
    cacheGetAllParts: jest.fn(),
    invalidateRoot: jest.fn(),
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('BodyGraphService constructor validation', () => {
  it('throws when entity manager is missing', () => {
    expect(
      () =>
        new BodyGraphService({
          logger,
          eventDispatcher,
        })
    ).toThrow(InvalidArgumentError);
  });

  it('throws when logger is missing', () => {
    expect(
      () =>
        new BodyGraphService({
          entityManager,
          eventDispatcher,
        })
    ).toThrow(InvalidArgumentError);
  });

  it('throws when event dispatcher is missing', () => {
    expect(
      () =>
        new BodyGraphService({
          entityManager,
          logger,
        })
    ).toThrow(InvalidArgumentError);
  });

  it('creates a default query cache when none is provided', () => {
    const cachedSpy = jest
      .spyOn(AnatomyQueryCache.prototype, 'getCachedFindPartsByType')
      .mockReturnValue(['cached-arm']);
    const findSpy = jest.spyOn(AnatomyGraphAlgorithms, 'findPartsByType');

    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });

    const result = service.findPartsByType('actor-root', 'arm');

    expect(cachedSpy).toHaveBeenCalledWith('actor-root', 'arm');
    expect(findSpy).not.toHaveBeenCalled();
    expect(result).toEqual(['cached-arm']);
  });
});

describe('buildAdjacencyCache', () => {
  it('builds cache when root not present', async () => {
    jest
      .spyOn(AnatomyCacheManager.prototype, 'hasCacheForRoot')
      .mockReturnValue(false);
    const buildSpy = jest
      .spyOn(AnatomyCacheManager.prototype, 'buildCache')
      .mockResolvedValue(undefined);

    service = createService();
    await service.buildAdjacencyCache('root-1');

    expect(buildSpy).toHaveBeenCalledWith('root-1', entityManager);
  });

  it('skips rebuilding when cache already exists', async () => {
    jest
      .spyOn(AnatomyCacheManager.prototype, 'hasCacheForRoot')
      .mockReturnValue(true);
    const buildSpy = jest
      .spyOn(AnatomyCacheManager.prototype, 'buildCache')
      .mockResolvedValue(undefined);

    service = createService();
    await service.buildAdjacencyCache('root-2');

    expect(buildSpy).not.toHaveBeenCalled();
  });
});

describe('detachPart', () => {
  it('detaches with cascade and invalidates caches', async () => {
    jest
      .spyOn(AnatomyGraphAlgorithms, 'getSubgraph')
      .mockReturnValue(['arm-1', 'hand-1']);
    jest
      .spyOn(AnatomyGraphAlgorithms, 'getAnatomyRoot')
      .mockReturnValue('actor-1');
    const invalidateCacheSpy = jest
      .spyOn(AnatomyCacheManager.prototype, 'invalidateCacheForRoot')
      .mockImplementation(() => {});

    entityManager.getComponentData.mockReturnValue({
      parentId: 'torso-1',
      socketId: 'shoulder',
    });

    service = createService();
    const result = await service.detachPart('arm-1', {
      cascade: true,
      reason: 'testing',
    });

    expect(entityManager.removeComponent).toHaveBeenCalledWith(
      'arm-1',
      'anatomy:joint'
    );
    expect(invalidateCacheSpy).toHaveBeenCalledWith('actor-1');
    expect(queryCache.invalidateRoot).toHaveBeenCalledWith('actor-1');
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        detachedEntityId: 'arm-1',
        detachedCount: 2,
        parentEntityId: 'torso-1',
        socketId: 'shoulder',
        reason: 'testing',
      })
    );
    expect(result).toEqual({
      detached: ['arm-1', 'hand-1'],
      parentId: 'torso-1',
      socketId: 'shoulder',
    });
  });

  it('supports non-cascade detaches without cache invalidation when root missing', async () => {
    const subgraphSpy = jest
      .spyOn(AnatomyGraphAlgorithms, 'getSubgraph')
      .mockReturnValue(['arm-1']);
    jest
      .spyOn(AnatomyGraphAlgorithms, 'getAnatomyRoot')
      .mockReturnValue(null);

    entityManager.getComponentData.mockReturnValue({
      parentId: 'torso-2',
      socketId: 'socket-2',
    });

    service = createService();
    const result = await service.detachPart('arm-1', { cascade: false });

    expect(subgraphSpy).not.toHaveBeenCalled();
    expect(queryCache.invalidateRoot).not.toHaveBeenCalled();
    expect(result).toEqual({
      detached: ['arm-1'],
      parentId: 'torso-2',
      socketId: 'socket-2',
    });
  });

  it('throws when joint component missing', async () => {
    entityManager.getComponentData.mockReturnValue(undefined);

    service = createService();

    await expect(service.detachPart('arm-2')).rejects.toThrow(InvalidArgumentError);
  });
});

describe('findPartsByType', () => {
  it('uses cached result when available', () => {
    queryCache.getCachedFindPartsByType.mockReturnValue(['arm-2']);
    const findSpy = jest.spyOn(AnatomyGraphAlgorithms, 'findPartsByType');

    service = createService();

    const result = service.findPartsByType('root-3', 'arm');

    expect(findSpy).not.toHaveBeenCalled();
    expect(result).toEqual(['arm-2']);
  });

  it('delegates to graph algorithms and caches result when cache empty', () => {
    jest
      .spyOn(AnatomyGraphAlgorithms, 'findPartsByType')
      .mockReturnValue(['arm-3']);

    service = createService();

    const result = service.findPartsByType('root-4', 'arm');

    expect(result).toEqual(['arm-3']);
    expect(queryCache.cacheFindPartsByType).toHaveBeenCalledWith(
      'root-4',
      'arm',
      ['arm-3']
    );
  });
});

describe('graph query helpers', () => {
  it('delegates getAnatomyRoot and getPath to algorithms', () => {
    const rootSpy = jest
      .spyOn(AnatomyGraphAlgorithms, 'getAnatomyRoot')
      .mockReturnValue('actor-root');
    const pathSpy = jest
      .spyOn(AnatomyGraphAlgorithms, 'getPath')
      .mockReturnValue(['a', 'b']);

    service = createService();

    expect(service.getAnatomyRoot('hand-1')).toBe('actor-root');
    expect(rootSpy).toHaveBeenCalledWith(
      'hand-1',
      expect.any(AnatomyCacheManager),
      entityManager
    );

    expect(service.getPath('hand-1', 'hand-2')).toEqual(['a', 'b']);
    expect(pathSpy).toHaveBeenCalledWith(
      'hand-1',
      'hand-2',
      expect.any(AnatomyCacheManager)
    );
  });
});

describe('getAllParts', () => {
  it('returns empty array when body component missing', () => {
    service = createService();

    expect(service.getAllParts(undefined)).toEqual([]);
  });

  it('returns empty array when body component lacks root references', () => {
    service = createService();

    const result = service.getAllParts({ body: {} });

    expect(result).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      'BodyGraphService.getAllParts: No root ID found in bodyComponent'
    );
  });

  it('uses actor entity as cache root when cached', () => {
    jest.spyOn(AnatomyCacheManager.prototype, 'has').mockImplementation((id) => id === 'actor-1');
    jest.spyOn(AnatomyCacheManager.prototype, 'size').mockReturnValue(5);
    jest
      .spyOn(AnatomyQueryCache.prototype, 'getCachedGetAllParts')
      .mockReturnValue(undefined);
    const cacheSpy = jest
      .spyOn(AnatomyQueryCache.prototype, 'cacheGetAllParts')
      .mockImplementation(() => {});
    jest
      .spyOn(AnatomyGraphAlgorithms, 'getAllParts')
      .mockReturnValue(['actor-1', 'child-1']);

    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });

    const result = service.getAllParts(
      {
        body: { root: 'blueprint-root' },
      },
      'actor-1'
    );

    expect(result).toEqual(['actor-1', 'child-1']);
    expect(cacheSpy).toHaveBeenCalledWith('actor-1', ['actor-1', 'child-1']);
  });

  it('uses blueprint root when actor not cached', () => {
    jest.spyOn(AnatomyCacheManager.prototype, 'has').mockReturnValue(false);
    jest.spyOn(AnatomyCacheManager.prototype, 'size').mockReturnValue(1);
    jest
      .spyOn(AnatomyQueryCache.prototype, 'getCachedGetAllParts')
      .mockReturnValue(undefined);
    const cacheSpy = jest
      .spyOn(AnatomyQueryCache.prototype, 'cacheGetAllParts')
      .mockImplementation(() => {});
    jest
      .spyOn(AnatomyGraphAlgorithms, 'getAllParts')
      .mockReturnValue(['blueprint-root', 'child-2']);

    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });

    const result = service.getAllParts({ root: 'blueprint-root' }, 'actor-2');

    expect(result).toEqual(['blueprint-root', 'child-2']);
    expect(cacheSpy).toHaveBeenCalledWith('blueprint-root', [
      'blueprint-root',
      'child-2',
    ]);
  });

  it('truncates debug output when anatomy has many parts', () => {
    jest.spyOn(AnatomyCacheManager.prototype, 'has').mockReturnValue(false);
    jest.spyOn(AnatomyCacheManager.prototype, 'size').mockReturnValue(3);
    jest
      .spyOn(AnatomyQueryCache.prototype, 'getCachedGetAllParts')
      .mockReturnValue(undefined);
    jest
      .spyOn(AnatomyGraphAlgorithms, 'getAllParts')
      .mockReturnValue(['a', 'b', 'c', 'd', 'e', 'f', 'g']);

    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });

    const parts = service.getAllParts({ root: 'rich-root' });

    expect(parts).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("BodyGraphService: AnatomyGraphAlgorithms.getAllParts returned 7 parts for root 'rich-root':")
    );
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('...'));
  });

  it('returns cached results when available', () => {
    jest
      .spyOn(AnatomyQueryCache.prototype, 'getCachedGetAllParts')
      .mockReturnValue(['cached-1', 'cached-2']);

    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });

    const result = service.getAllParts({ root: 'blueprint-root' }, 'actor-3');

    expect(result).toEqual(['cached-1', 'cached-2']);
  });
});

describe('component presence helpers', () => {
  it('detects components across parts', () => {
    service = createService();

    jest
      .spyOn(service, 'getAllParts')
      .mockReturnValue(['part-a', 'part-b']);
    entityManager.getComponentData.mockImplementation((id, componentId) => {
      if (id === 'part-a') {
        return {}; // empty object should be treated as missing
      }
      if (id === 'part-b') {
        return { id: componentId };
      }
      return null;
    });

    expect(
      service.hasPartWithComponent({ root: 'root-x' }, 'component:test')
    ).toBe(true);
  });

  it('returns false when no components found', () => {
    service = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-a']);
    entityManager.getComponentData.mockReturnValue(null);

    expect(
      service.hasPartWithComponent({ root: 'root-x' }, 'component:test')
    ).toBe(false);
  });

  it('finds nested component values', () => {
    service = createService();
    jest
      .spyOn(service, 'getAllParts')
      .mockReturnValue(['part-a', 'part-b']);
    entityManager.getComponentData.mockImplementation((id) => {
      if (id === 'part-a') {
        return { stats: { health: { current: 50 } } };
      }
      if (id === 'part-b') {
        return { stats: { health: { current: 75 } } };
      }
      return null;
    });

    expect(
      service.hasPartWithComponentValue(
        { root: 'root-x' },
        'component:test',
        'stats.health.current',
        75
      )
    ).toEqual({ found: true, partId: 'part-b' });
  });

  it('returns not found when nested values missing', () => {
    service = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-a']);
    entityManager.getComponentData.mockReturnValue({ stats: {} });

    expect(
      service.hasPartWithComponentValue(
        { root: 'root-x' },
        'component:test',
        'stats.health.current',
        10
      )
    ).toEqual({ found: false });
  });

  it('returns not found when component is entirely absent', () => {
    service = createService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-a']);
    entityManager.getComponentData.mockReturnValue(null);

    expect(
      service.hasPartWithComponentValue(
        { root: 'root-x' },
        'component:test',
        'stats.health.current',
        10
      )
    ).toEqual({ found: false });
  });
});

describe('getBodyGraph', () => {
  it('rejects invalid entity identifiers', async () => {
    service = createService();

    await expect(service.getBodyGraph(null)).rejects.toThrow(InvalidArgumentError);
  });

  it('throws when anatomy component missing', async () => {
    entityManager.getComponentData.mockResolvedValue(null);

    service = createService();

    await expect(service.getBodyGraph('entity-1')).rejects.toThrow(
      'Entity entity-1 has no anatomy:body component'
    );
  });

  it('returns graph helpers using cached services', async () => {
    entityManager.getComponentData.mockResolvedValue({
      body: { root: 'root-1' },
    });
    jest
      .spyOn(AnatomyCacheManager.prototype, 'get')
      .mockImplementation((id) => ({ children: [`${id}-child`] }));

    service = createService();
    const buildSpy = jest
      .spyOn(service, 'buildAdjacencyCache')
      .mockResolvedValue(undefined);
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1', 'part-2']);

    const graph = await service.getBodyGraph('entity-graph');

    expect(buildSpy).toHaveBeenCalledWith('entity-graph');
    expect(graph.getAllPartIds()).toEqual(['part-1', 'part-2']);
    expect(graph.getConnectedParts('part-1')).toEqual(['part-1-child']);
  });

  it('returns empty connected parts when cache node missing', async () => {
    entityManager.getComponentData.mockResolvedValue({
      body: { root: 'root-1' },
    });
    const cacheSpy = jest.spyOn(AnatomyCacheManager.prototype, 'get');
    cacheSpy.mockImplementation(() => undefined);

    service = createService();
    jest.spyOn(service, 'buildAdjacencyCache').mockResolvedValue(undefined);
    jest.spyOn(service, 'getAllParts').mockReturnValue(['root-1']);

    const graph = await service.getBodyGraph('actor-1');

    expect(graph.getConnectedParts('missing-part')).toEqual([]);
    expect(cacheSpy).toHaveBeenCalledWith('missing-part');
  });
});

describe('getAnatomyData', () => {
  it('requires a valid entity identifier', async () => {
    service = createService();

    await expect(service.getAnatomyData(123)).rejects.toThrow(InvalidArgumentError);
  });

  it('returns null when body component missing', async () => {
    entityManager.getComponentData.mockResolvedValue(null);

    service = createService();

    await expect(service.getAnatomyData('entity-2')).resolves.toBeNull();
  });

  it('returns recipe and root identifiers', async () => {
    entityManager.getComponentData.mockResolvedValue({ recipeId: 'recipe-1' });

    service = createService();

    await expect(service.getAnatomyData('entity-3')).resolves.toEqual({
      recipeId: 'recipe-1',
      rootEntityId: 'entity-3',
    });
  });

  it('normalizes missing recipe identifiers', async () => {
    entityManager.getComponentData.mockResolvedValue({});

    service = createService();

    await expect(service.getAnatomyData('entity-4')).resolves.toEqual({
      recipeId: null,
      rootEntityId: 'entity-4',
    });
  });
});

describe('cache wrappers', () => {
  it('validates cache through manager', () => {
    const validateSpy = jest
      .spyOn(AnatomyCacheManager.prototype, 'validateCache')
      .mockReturnValue({ valid: true, issues: [] });

    service = createService();

    expect(service.validateCache()).toEqual({ valid: true, issues: [] });
    expect(validateSpy).toHaveBeenCalledWith(entityManager);
  });

  it('delegates hasCache to cache manager', () => {
    jest
      .spyOn(AnatomyCacheManager.prototype, 'hasCacheForRoot')
      .mockReturnValue(true);

    service = createService();

    expect(service.hasCache('root-1')).toBe(true);
  });

  it('returns children from cache nodes', () => {
    jest
      .spyOn(AnatomyCacheManager.prototype, 'get')
      .mockImplementation((id) => ({
        parentId: 'parent-' + id,
        children: [`${id}-child`],
      }));

    service = createService();

    expect(service.getChildren('node-1')).toEqual(['node-1-child']);
  });

  it('returns empty array when cache node missing children', () => {
    jest.spyOn(AnatomyCacheManager.prototype, 'get').mockReturnValue(undefined);

    service = createService();

    expect(service.getChildren('node-unknown')).toEqual([]);
  });

  it('returns parent identifiers when available', () => {
    jest
      .spyOn(AnatomyCacheManager.prototype, 'get')
      .mockImplementation(() => ({ parentId: 'parent-1' }));

    service = createService();

    expect(service.getParent('node-2')).toBe('parent-1');
  });

  it('returns null when parent missing', () => {
    jest.spyOn(AnatomyCacheManager.prototype, 'get').mockReturnValue(undefined);

    service = createService();

    expect(service.getParent('node-3')).toBeNull();
  });
});

describe('getAncestors', () => {
  it('collects ancestor chain using getParent', () => {
    service = createService();

    const parentSpy = jest
      .spyOn(service, 'getParent')
      .mockImplementationOnce(() => 'parent-2')
      .mockImplementationOnce(() => 'parent-1')
      .mockImplementationOnce(() => null);

    expect(service.getAncestors('child-3')).toEqual(['parent-2', 'parent-1']);
    expect(parentSpy).toHaveBeenCalledTimes(3);
  });
});

describe('getAllDescendants', () => {
  it('filters the root entity from subgraph results', () => {
    jest
      .spyOn(AnatomyGraphAlgorithms, 'getSubgraph')
      .mockReturnValue(['root-1', 'child-1', 'child-2']);

    service = createService();

    expect(service.getAllDescendants('root-1')).toEqual(['child-1', 'child-2']);
  });
});
