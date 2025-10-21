jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => {
  const createInstance = () => ({
    hasCacheForRoot: jest.fn(),
    buildCache: jest.fn().mockResolvedValue(undefined),
    invalidateCacheForRoot: jest.fn(),
    has: jest.fn(),
    size: jest.fn(),
    get: jest.fn(),
    validateCache: jest.fn(),
  });

  const mock = jest.fn().mockImplementation(() => createInstance());
  return { AnatomyCacheManager: mock };
});

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => {
  const createInstance = () => ({
    getCachedFindPartsByType: jest.fn(),
    cacheFindPartsByType: jest.fn(),
    getCachedGetAllParts: jest.fn(),
    cacheGetAllParts: jest.fn(),
    invalidateRoot: jest.fn(),
  });

  const mock = jest.fn().mockImplementation(() => createInstance());
  return { AnatomyQueryCache: mock };
});

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
let InvalidArgumentError;
let AnatomyCacheManager;
let AnatomyGraphAlgorithms;
let AnatomyQueryCache;

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

const createEventDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
});

const setupService = (overrides = {}) => {
  const entityManager = overrides.entityManager ?? createEntityManager();
  const logger = overrides.logger ?? createLogger();
  const eventDispatcher = overrides.eventDispatcher ?? createEventDispatcher();

  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
    queryCache: overrides.queryCache,
  });

  const cacheManager = AnatomyCacheManager.mock.results.at(-1)?.value;
  const queryCache = overrides.queryCache ?? AnatomyQueryCache.mock.results.at(-1)?.value;

  return { service, entityManager, logger, eventDispatcher, cacheManager, queryCache };
};

describe('BodyGraphService targeted graph and cache behaviour', () => {
  beforeAll(async () => {
    ({ BodyGraphService, LIMB_DETACHED_EVENT_ID } = await import(
      '../../../src/anatomy/bodyGraphService.js'
    ));
    ({ InvalidArgumentError } = await import('../../../src/errors/invalidArgumentError.js'));
    ({ AnatomyCacheManager } = await import('../../../src/anatomy/anatomyCacheManager.js'));
    ({ AnatomyGraphAlgorithms } = await import('../../../src/anatomy/anatomyGraphAlgorithms.js'));
    ({ AnatomyQueryCache } = await import('../../../src/anatomy/cache/AnatomyQueryCache.js'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires all constructor dependencies', () => {
    const logger = createLogger();
    const eventDispatcher = createEventDispatcher();
    expect(() => new BodyGraphService({ logger, eventDispatcher })).toThrow(
      InvalidArgumentError
    );
    const entityManager = createEntityManager();
    expect(
      () => new BodyGraphService({ entityManager, eventDispatcher })
    ).toThrow(InvalidArgumentError);
    expect(() => new BodyGraphService({ entityManager, logger })).toThrow(
      InvalidArgumentError
    );
  });

  it('uses a provided query cache instance when supplied', () => {
    const entityManager = createEntityManager();
    const logger = createLogger();
    const eventDispatcher = createEventDispatcher();
    const providedQueryCache = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(['cached-part']),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn(),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };

    const service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
      queryCache: providedQueryCache,
    });

    expect(AnatomyQueryCache).not.toHaveBeenCalled();
    const result = service.findPartsByType('root-1', 'arm');
    expect(result).toEqual(['cached-part']);
    expect(providedQueryCache.getCachedFindPartsByType).toHaveBeenCalledWith(
      'root-1',
      'arm'
    );
  });

  it('builds adjacency cache when missing and skips when already populated', async () => {
    const { service, cacheManager, entityManager } = setupService();
    cacheManager.hasCacheForRoot.mockReturnValueOnce(false).mockReturnValue(true);

    await service.buildAdjacencyCache('actor-1');
    expect(cacheManager.buildCache).toHaveBeenCalledWith('actor-1', entityManager);

    await service.buildAdjacencyCache('actor-1');
    expect(cacheManager.buildCache).toHaveBeenCalledTimes(1);
  });

  it('detaches parts with cascade and invalidates caches', async () => {
    const { service, entityManager, cacheManager, queryCache, eventDispatcher, logger } =
      setupService();
    entityManager.getComponentData.mockImplementation((entityId, componentId) => {
      if (componentId === 'anatomy:joint') {
        return { parentId: 'torso-1', socketId: 'shoulder-left' };
      }
      return null;
    });
    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['arm-1', 'hand-1']);
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('actor-root');

    const result = await service.detachPart('arm-1', { cascade: true, reason: 'injury' });

    expect(entityManager.removeComponent).toHaveBeenCalledWith(
      'arm-1',
      'anatomy:joint'
    );
    expect(cacheManager.invalidateCacheForRoot).toHaveBeenCalledWith('actor-root');
    expect(queryCache.invalidateRoot).toHaveBeenCalledWith('actor-root');
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'arm-1',
        detachedCount: 2,
        parentEntityId: 'torso-1',
        reason: 'injury',
      })
    );
    expect(logger.info).toHaveBeenCalled();
    expect(result).toEqual({
      detached: ['arm-1', 'hand-1'],
      parentId: 'torso-1',
      socketId: 'shoulder-left',
    });
  });

  it('detaches without cascade and tolerates missing root', async () => {
    const { service, entityManager, cacheManager, queryCache } = setupService();
    entityManager.getComponentData.mockReturnValue({ parentId: 'torso-1', socketId: 'joint-1' });
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValueOnce(null);

    const result = await service.detachPart('arm-2', { cascade: false });

    expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
    expect(cacheManager.invalidateCacheForRoot).not.toHaveBeenCalled();
    expect(queryCache.invalidateRoot).not.toHaveBeenCalled();
    expect(result.detached).toEqual(['arm-2']);
  });

  it('throws when detaching entity without joint component', async () => {
    const { service, entityManager } = setupService();
    entityManager.getComponentData.mockReturnValue(null);

    await expect(service.detachPart('unknown')).rejects.toThrow(InvalidArgumentError);
  });

  it('uses cached results when finding parts by type', () => {
    const { service, queryCache } = setupService();
    queryCache.getCachedFindPartsByType.mockReturnValue(['cached']);

    const result = service.findPartsByType('actor-1', 'hand');

    expect(result).toEqual(['cached']);
    expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();
  });

  it('computes and caches results when cache misses in findPartsByType', () => {
    const { service, queryCache, cacheManager } = setupService();
    queryCache.getCachedFindPartsByType.mockReturnValue(undefined);
    AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['hand-1']);

    const result = service.findPartsByType('actor-1', 'hand');

    expect(AnatomyGraphAlgorithms.findPartsByType).toHaveBeenCalledWith(
      'actor-1',
      'hand',
      cacheManager
    );
    expect(queryCache.cacheFindPartsByType).toHaveBeenCalledWith(
      'actor-1',
      'hand',
      ['hand-1']
    );
    expect(result).toEqual(['hand-1']);
  });

  it('returns empty list when no body component is supplied to getAllParts', () => {
    const { service } = setupService();
    expect(service.getAllParts(null)).toEqual([]);
  });

  it('uses actor cache root when available and result is cached', () => {
    const { service, cacheManager, queryCache } = setupService();
    cacheManager.has.mockImplementation((id) => id === 'actor-77');
    cacheManager.size.mockReturnValue(5);
    queryCache.getCachedGetAllParts.mockReturnValue(['cached-part']);

    const result = service.getAllParts({ body: { root: 'blueprint-root' } }, 'actor-77');

    expect(queryCache.getCachedGetAllParts).toHaveBeenCalledWith('actor-77');
    expect(result).toEqual(['cached-part']);
    expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
  });

  it('computes all parts when cache misses and caches the result', () => {
    const { service, cacheManager, queryCache, entityManager } = setupService();
    cacheManager.has.mockReturnValue(false);
    cacheManager.size.mockReturnValue(2);
    queryCache.getCachedGetAllParts.mockReturnValue(undefined);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['torso', 'arm']);

    const result = service.getAllParts({ root: 'blueprint-root' }, 'actor-2');

    expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
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

  it('falls back to blueprint root when actor cache missing', () => {
    const { service, cacheManager, queryCache, entityManager } = setupService();
    cacheManager.has.mockReturnValue(false);
    cacheManager.size.mockReturnValue(0);
    queryCache.getCachedGetAllParts.mockReturnValue(undefined);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['part']);

    const result = service.getAllParts({ body: { root: 'blueprint-root' } }, 'missing');

    expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
      'blueprint-root',
      cacheManager,
      entityManager
    );
    expect(result).toEqual(['part']);
  });

  it('identifies parts with a given component', () => {
    const { service, entityManager } = setupService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1', 'part-2']);
    entityManager.getComponentData
      .mockReturnValueOnce({})
      .mockReturnValueOnce({ equipped: true });

    expect(service.hasPartWithComponent({ body: { root: 'r' } }, 'equipment')).toBe(true);
  });

  it('detects component values along nested paths', () => {
    const { service, entityManager } = setupService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-9']);
    entityManager.getComponentData.mockReturnValue({ status: { condition: 'intact' } });

    expect(
      service.hasPartWithComponentValue(
        { body: { root: 'r' } },
        'status',
        'status.condition',
        'intact'
      )
    ).toEqual({ found: true, partId: 'part-9' });
  });

  it('returns not found when component value is absent', () => {
    const { service, entityManager } = setupService();
    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-9']);
    entityManager.getComponentData.mockReturnValue(null);

    expect(
      service.hasPartWithComponentValue(
        { body: { root: 'r' } },
        'status',
        'status.condition',
        'intact'
      )
    ).toEqual({ found: false });
  });

  it('validates body graph retrieval and connected parts access', async () => {
    const { service, entityManager, cacheManager } = setupService();
    entityManager.getComponentData.mockResolvedValue({ body: { root: 'root-1' } });
    cacheManager.hasCacheForRoot.mockReturnValue(false);
    cacheManager.get.mockReturnValueOnce({ children: ['child-1'] }).mockReturnValueOnce(undefined);

    const getAllPartsSpy = jest
      .spyOn(service, 'getAllParts')
      .mockReturnValue(['p1', 'p2']);

    const graph = await service.getBodyGraph('actor-graph');

    expect(cacheManager.buildCache).toHaveBeenCalledWith('actor-graph', entityManager);
    expect(getAllPartsSpy).not.toHaveBeenCalled();

    expect(graph.getAllPartIds()).toEqual(['p1', 'p2']);
    expect(getAllPartsSpy).toHaveBeenCalledWith({ body: { root: 'root-1' } }, 'actor-graph');
    expect(graph.getConnectedParts('any')).toEqual(['child-1']);
    expect(graph.getConnectedParts('missing')).toEqual([]);
  });

  it('throws when body graph entity id is invalid or missing body component', async () => {
    const { service, entityManager } = setupService();
    await expect(service.getBodyGraph('')).rejects.toThrow(InvalidArgumentError);

    entityManager.getComponentData.mockResolvedValue(null);
    await expect(service.getBodyGraph('actor-1')).rejects.toThrow(
      'Entity actor-1 has no anatomy:body component'
    );
  });

  it('retrieves anatomy data and handles missing components', async () => {
    const { service, entityManager } = setupService();
    await expect(service.getAnatomyData('')).rejects.toThrow(InvalidArgumentError);

    entityManager.getComponentData.mockResolvedValueOnce(null);
    expect(await service.getAnatomyData('actor-1')).toBeNull();

    entityManager.getComponentData.mockResolvedValueOnce({ recipeId: 'recipe-1' });
    expect(await service.getAnatomyData('actor-1')).toEqual({
      recipeId: 'recipe-1',
      rootEntityId: 'actor-1',
    });
  });

  it('provides cache validation and traversal helpers', () => {
    const { service, cacheManager, entityManager } = setupService();
    cacheManager.validateCache.mockReturnValue(true);
    cacheManager.hasCacheForRoot.mockReturnValue(true);
    cacheManager.get.mockImplementation((id) => {
      const map = {
        'child-1': { parentId: 'parent-1', children: ['leaf-1'] },
        'parent-1': { parentId: 'root-1', children: ['child-1'] },
        'root-1': { parentId: null, children: [] },
      };
      return map[id];
    });
    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['node', 'desc-1', 'desc-2']);
    AnatomyGraphAlgorithms.getPath.mockReturnValue(['node', 'target']);

    expect(service.validateCache()).toBe(true);
    expect(cacheManager.validateCache).toHaveBeenCalledWith(entityManager);
    expect(service.hasCache('root-1')).toBe(true);
    expect(service.getChildren('child-1')).toEqual(['leaf-1']);
    expect(service.getChildren('unknown')).toEqual([]);
    expect(service.getParent('child-1')).toBe('parent-1');
    expect(service.getParent('root-1')).toBeNull();
    expect(service.getAncestors('child-1')).toEqual(['parent-1', 'root-1']);
    expect(service.getAllDescendants('node')).toEqual(['desc-1', 'desc-2']);
    expect(service.getPath('node', 'target')).toEqual(['node', 'target']);
  });
});
