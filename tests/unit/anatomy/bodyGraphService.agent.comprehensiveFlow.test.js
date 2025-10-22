import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => ({
  AnatomyCacheManager: jest.fn(),
}));

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => ({
  AnatomyQueryCache: jest.fn(),
}));

jest.mock('../../../src/anatomy/anatomyGraphAlgorithms.js', () => ({
  AnatomyGraphAlgorithms: {
    getSubgraph: jest.fn(),
    findPartsByType: jest.fn(),
    getAllParts: jest.fn(),
    getAnatomyRoot: jest.fn(),
    getPath: jest.fn(),
  },
}));

let BodyGraphService;
let LIMB_DETACHED_EVENT_ID;
let AnatomyCacheManager;
let AnatomyQueryCache;
let AnatomyGraphAlgorithms;

beforeAll(async () => {
  ({ AnatomyCacheManager } = await import('../../../src/anatomy/anatomyCacheManager.js'));
  ({ AnatomyQueryCache } = await import('../../../src/anatomy/cache/AnatomyQueryCache.js'));
  ({ AnatomyGraphAlgorithms } = await import('../../../src/anatomy/anatomyGraphAlgorithms.js'));
  ({ BodyGraphService, LIMB_DETACHED_EVENT_ID } = await import('../../../src/anatomy/bodyGraphService.js'));
});

describe('BodyGraphService comprehensive flow coverage', () => {
  /** @type {ReturnType<typeof AnatomyCacheManager.mock.instances[number]>} */
  let cacheInstance;
  /** @type {ReturnType<typeof AnatomyQueryCache.mock.instances[number]>} */
  let queryCacheInstance;
  /** @type {{ getComponentData: jest.Mock, removeComponent: jest.Mock }} */
  let entityManager;
  /** @type {{ debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock }} */
  let logger;
  /** @type {{ dispatch: jest.Mock }} */
  let eventDispatcher;

  const createService = (overrides = {}) =>
    new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
      ...overrides,
    });

  beforeEach(() => {
    jest.clearAllMocks();

    cacheInstance = {
      hasCacheForRoot: jest.fn().mockReturnValue(false),
      buildCache: jest.fn().mockResolvedValue(undefined),
      invalidateCacheForRoot: jest.fn(),
      get: jest.fn().mockReturnValue(undefined),
      has: jest.fn().mockReturnValue(false),
      size: jest.fn().mockReturnValue(0),
      validateCache: jest.fn().mockReturnValue({ valid: true }),
    };
    AnatomyCacheManager.mockImplementation(() => cacheInstance);

    queryCacheInstance = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };
    AnatomyQueryCache.mockImplementation(() => queryCacheInstance);

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

    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['arm', 'hand']);
    AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['arm']);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['root', 'arm']);
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-entity');
    AnatomyGraphAlgorithms.getPath.mockReturnValue(['from', 'mid', 'to']);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('enforces constructor dependencies and honours explicit query cache', () => {
    expect(() => new BodyGraphService({ logger, eventDispatcher })).toThrow(
      InvalidArgumentError
    );
    expect(() => new BodyGraphService({ entityManager, eventDispatcher })).toThrow(
      InvalidArgumentError
    );
    expect(() => new BodyGraphService({ entityManager, logger })).toThrow(
      InvalidArgumentError
    );

    const explicitCache = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(['cached-arm']),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn().mockReturnValue(['cached-root']),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };

    const service = createService({ queryCache: explicitCache });
    expect(AnatomyQueryCache).not.toHaveBeenCalled();

    const partsByType = service.findPartsByType('actor-1', 'arm');
    expect(partsByType).toEqual(['cached-arm']);
    expect(explicitCache.cacheFindPartsByType).not.toHaveBeenCalled();

    explicitCache.getCachedGetAllParts.mockReturnValue(undefined);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValueOnce(['root', 'arm', 'hand']);
    const allParts = service.getAllParts({ body: { root: 'root-entity' } }, null);
    expect(allParts).toEqual(['root', 'arm', 'hand']);
    expect(explicitCache.cacheGetAllParts).toHaveBeenCalledWith(
      'root-entity',
      ['root', 'arm', 'hand']
    );
  });

  it('builds adjacency cache only when missing', async () => {
    const service = createService();

    cacheInstance.hasCacheForRoot.mockReturnValueOnce(false).mockReturnValue(true);

    await service.buildAdjacencyCache('actor-12');
    expect(cacheInstance.buildCache).toHaveBeenCalledWith(
      'actor-12',
      entityManager
    );

    await service.buildAdjacencyCache('actor-12');
    expect(cacheInstance.buildCache).toHaveBeenCalledTimes(1);
  });

  it('detaches parts with cascade and emits notifications', async () => {
    const service = createService();

    entityManager.getComponentData.mockReturnValue({
      parentId: 'torso-1',
      socketId: 'shoulder',
    });
    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['arm-1', 'hand-2']);
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('actor-root');

    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(42);

    const result = await service.detachPart('arm-1');

    expect(entityManager.removeComponent).toHaveBeenCalledWith(
      'arm-1',
      'anatomy:joint'
    );
    expect(cacheInstance.invalidateCacheForRoot).toHaveBeenCalledWith('actor-root');
    expect(queryCacheInstance.invalidateRoot).toHaveBeenCalledWith('actor-root');
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(LIMB_DETACHED_EVENT_ID, {
      detachedEntityId: 'arm-1',
      parentEntityId: 'torso-1',
      socketId: 'shoulder',
      detachedCount: 2,
      reason: 'manual',
      timestamp: 42,
    });
    expect(logger.info).toHaveBeenCalledWith(
      "BodyGraphService: Detached 2 entities from parent 'torso-1'"
    );
    expect(result).toEqual({
      detached: ['arm-1', 'hand-2'],
      parentId: 'torso-1',
      socketId: 'shoulder',
    });

    nowSpy.mockRestore();
  });

  it('supports targeted detachment without cascade and handles missing root', async () => {
    const service = createService();

    entityManager.getComponentData.mockReturnValue({
      parentId: 'torso-7',
      socketId: 'joint-3',
    });
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue(null);

    const result = await service.detachPart('hand-9', {
      cascade: false,
      reason: 'auto',
    });

    expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
    expect(cacheInstance.invalidateCacheForRoot).not.toHaveBeenCalled();
    expect(queryCacheInstance.invalidateRoot).not.toHaveBeenCalled();
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(LIMB_DETACHED_EVENT_ID, {
      detachedEntityId: 'hand-9',
      parentEntityId: 'torso-7',
      socketId: 'joint-3',
      detachedCount: 1,
      reason: 'auto',
      timestamp: expect.any(Number),
    });
    expect(result).toEqual({
      detached: ['hand-9'],
      parentId: 'torso-7',
      socketId: 'joint-3',
    });
  });

  it('throws when attempting to detach a part without joint data', async () => {
    const service = createService();
    entityManager.getComponentData.mockReturnValue(undefined);

    await expect(service.detachPart('missing-joint')).rejects.toThrow(
      InvalidArgumentError
    );
    expect(entityManager.removeComponent).not.toHaveBeenCalled();
  });

  it('provides cached and computed search results', () => {
    const service = createService();

    queryCacheInstance.getCachedFindPartsByType.mockReturnValueOnce(['cached']);
    expect(service.findPartsByType('root-1', 'arm')).toEqual(['cached']);
    expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();

    queryCacheInstance.getCachedFindPartsByType.mockReturnValueOnce(undefined);
    AnatomyGraphAlgorithms.findPartsByType.mockReturnValueOnce(['from-alg']);
    expect(service.findPartsByType('root-1', 'arm')).toEqual(['from-alg']);
    expect(queryCacheInstance.cacheFindPartsByType).toHaveBeenCalledWith(
      'root-1',
      'arm',
      ['from-alg']
    );

    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-1');
    expect(service.getAnatomyRoot('part-4')).toBe('root-1');
    expect(AnatomyGraphAlgorithms.getPath).not.toHaveBeenCalled();
    expect(service.getPath('a', 'b')).toEqual(['from', 'mid', 'to']);
  });

  it('merges cache intelligence when collecting all parts', () => {
    const service = createService();

    expect(service.getAllParts(null)).toEqual([]);

    cacheInstance.has.mockReturnValueOnce(false);
    queryCacheInstance.getCachedGetAllParts.mockReturnValueOnce(undefined);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValueOnce(['root-x', 'arm-y']);

    const bodyComponent = { body: { root: 'root-x' } };
    const parts = service.getAllParts(bodyComponent, 'actor-z');
    expect(parts).toEqual(['root-x', 'arm-y']);
    expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
      'root-x',
      cacheInstance,
      entityManager
    );

    cacheInstance.has.mockReturnValue(true);
    queryCacheInstance.getCachedGetAllParts.mockReturnValueOnce(['cached-1']);
    const cachedParts = service.getAllParts({ root: 'blueprint-1' }, 'actor-cached');
    expect(cachedParts).toEqual(['cached-1']);
    expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledTimes(1);
  });

  it('locates component presence and nested values across parts', () => {
    const service = createService();
    const getAllPartsSpy = jest
      .spyOn(service, 'getAllParts')
      .mockReturnValue(['arm-a', 'arm-b']);

    entityManager.getComponentData.mockImplementation((partId, componentId) => {
      if (partId === 'arm-a') return {};
      if (partId === 'arm-b' && componentId === 'anatomy:muscle')
        return { stats: { strength: 5 } };
      return null;
    });

    expect(
      service.hasPartWithComponent({ body: { root: 'root-1' } }, 'anatomy:muscle')
    ).toBe(true);

    expect(
      service.hasPartWithComponent({ body: { root: 'root-1' } }, 'missing:component')
    ).toBe(false);

    getAllPartsSpy.mockReturnValue(['arm-a', 'arm-b']);
    entityManager.getComponentData.mockImplementation((partId) => {
      if (partId === 'arm-a') return { stats: { strength: 3 } };
      if (partId === 'arm-b') return { stats: { strength: 5 } };
      return null;
    });

    expect(
      service.hasPartWithComponentValue(
        { body: { root: 'root-1' } },
        'anatomy:muscle',
        'stats.strength',
        5
      )
    ).toEqual({ found: true, partId: 'arm-b' });

    expect(
      service.hasPartWithComponentValue(
        { body: { root: 'root-1' } },
        'anatomy:muscle',
        'stats.agility',
        2
      )
    ).toEqual({ found: false });
  });

  it('validates graph accessors and ancestry helpers', async () => {
    const service = createService();

    await expect(service.getBodyGraph('')).rejects.toThrow(InvalidArgumentError);

    entityManager.getComponentData.mockResolvedValueOnce(null);
    await expect(service.getBodyGraph('actor-404')).rejects.toThrow(
      'Entity actor-404 has no anatomy:body component'
    );

    entityManager.getComponentData.mockResolvedValue({ body: { root: 'root-7' } });
    cacheInstance.get.mockImplementation((id) => {
      if (id === 'root-7') return { parentId: null, children: ['arm-1'] };
      if (id === 'arm-1') return { parentId: 'root-7', children: ['hand-2'] };
      if (id === 'hand-2') return { parentId: 'arm-1', children: [] };
      return undefined;
    });

    const serviceWithSpy = createService();
    const allPartsSpy = jest
      .spyOn(serviceWithSpy, 'getAllParts')
      .mockReturnValue(['root-7', 'arm-1', 'hand-2']);

    const graph = await serviceWithSpy.getBodyGraph('actor-777');
    expect(typeof graph.getAllPartIds).toBe('function');
    expect(graph.getAllPartIds()).toEqual(['root-7', 'arm-1', 'hand-2']);
    expect(graph.getConnectedParts('arm-1')).toEqual(['hand-2']);

    cacheInstance.validateCache.mockReturnValue({ valid: true });
    cacheInstance.hasCacheForRoot.mockReturnValue(true);
    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['arm-1', 'hand-2']);

    expect(serviceWithSpy.validateCache()).toEqual({ valid: true });
    expect(serviceWithSpy.hasCache('root-7')).toBe(true);
    expect(serviceWithSpy.getChildren('root-7')).toEqual(['arm-1']);
    expect(serviceWithSpy.getParent('hand-2')).toBe('arm-1');
    expect(serviceWithSpy.getAncestors('hand-2')).toEqual(['arm-1', 'root-7']);
    expect(serviceWithSpy.getAllDescendants('arm-1')).toEqual(['hand-2']);
  });

  it('retrieves anatomy metadata for entities', async () => {
    const service = createService();

    await expect(service.getAnatomyData(undefined)).rejects.toThrow(
      InvalidArgumentError
    );

    entityManager.getComponentData.mockResolvedValueOnce(null);
    await expect(service.getAnatomyData('actor-9')).resolves.toBeNull();

    entityManager.getComponentData.mockResolvedValueOnce({ recipeId: 'humanoid' });
    await expect(service.getAnatomyData('actor-9')).resolves.toEqual({
      recipeId: 'humanoid',
      rootEntityId: 'actor-9',
    });
  });
});
