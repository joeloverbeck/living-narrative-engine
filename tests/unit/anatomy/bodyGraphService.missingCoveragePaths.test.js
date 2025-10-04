import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

jest.mock('../../../src/anatomy/anatomyGraphAlgorithms.js', () => ({
  __esModule: true,
  AnatomyGraphAlgorithms: {
    getSubgraph: jest.fn(),
    findPartsByType: jest.fn(),
    getAnatomyRoot: jest.fn(),
    getPath: jest.fn(),
    getAllParts: jest.fn(),
  },
}));

import { AnatomyGraphAlgorithms as algorithmMocks } from '../../../src/anatomy/anatomyGraphAlgorithms.js';

const cacheInstances = [];
jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => ({
  __esModule: true,
  AnatomyCacheManager: jest.fn().mockImplementation(() => {
    const instance = {
      hasCacheForRoot: jest.fn().mockReturnValue(false),
      buildCache: jest.fn().mockResolvedValue(undefined),
      invalidateCacheForRoot: jest.fn(),
      get: jest.fn().mockReturnValue(undefined),
      has: jest.fn().mockReturnValue(false),
      size: jest.fn().mockReturnValue(0),
      validateCache: jest.fn().mockReturnValue({ valid: true, issues: [] }),
    };
    cacheInstances.push(instance);
    return instance;
  }),
}));

const queryCacheInstances = [];
jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => ({
  __esModule: true,
  AnatomyQueryCache: jest.fn().mockImplementation(() => {
    const instance = {
      getCachedFindPartsByType: jest.fn(),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };
    queryCacheInstances.push(instance);
    return instance;
  }),
}));

// Import after mocks are registered.
import BodyGraphService from '../../../src/anatomy/bodyGraphService.js';

function createEntityManager(overrides = {}) {
  return {
    getComponentData: jest.fn(),
    removeComponent: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createLogger(overrides = {}) {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    ...overrides,
  };
}

function createEventDispatcher(overrides = {}) {
  return {
    dispatch: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function instantiateService(options = {}) {
  const entityManager = options.entityManager ?? createEntityManager();
  const logger = options.logger ?? createLogger();
  const eventDispatcher =
    options.eventDispatcher ?? createEventDispatcher();
  const queryCache = options.queryCache;

  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
    queryCache,
  });

  const cacheInstance = cacheInstances.at(-1);
  const queryCacheInstance =
    queryCache !== undefined ? queryCache : queryCacheInstances.at(-1);

  return {
    service,
    entityManager,
    logger,
    eventDispatcher,
    cacheInstance,
    queryCacheInstance,
  };
}

describe('BodyGraphService additional coverage scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cacheInstances.length = 0;
    queryCacheInstances.length = 0;
    Object.values(algorithmMocks).forEach((fn) => fn.mockReset());
  });

  describe('getAllParts edge cases', () => {
    it('returns an empty list when no body component is provided', () => {
      const { service, logger } = instantiateService();

      expect(service.getAllParts(null)).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith(
        'BodyGraphService.getAllParts: No bodyComponent provided',
      );
    });

    it('returns an empty list when the body component has no root identifier', () => {
      const { service, logger } = instantiateService();
      const component = { body: {} };

      expect(service.getAllParts(component)).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith(
        'BodyGraphService.getAllParts: No root ID found in bodyComponent',
      );
    });

    it('prefers the blueprint root when the actor is not cached and caches the query result', () => {
      const { service, logger, cacheInstance, queryCacheInstance, entityManager } =
        instantiateService();
      cacheInstance.has.mockReturnValue(false);
      cacheInstance.size.mockReturnValue(3);
      const graphResult = ['root-77', 'child-1'];
      algorithmMocks.getAllParts.mockReturnValue(graphResult);

      const parts = service.getAllParts({ body: { root: 'root-77' } }, 'actor-5');

      expect(algorithmMocks.getAllParts).toHaveBeenCalledWith(
        'root-77',
        cacheInstance,
        entityManager,
      );
      expect(queryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith(
        'root-77',
        graphResult,
      );
      expect(logger.debug).toHaveBeenCalledWith(
        "BodyGraphService: Using blueprint root 'root-77' as cache root (actor 'actor-5' not in cache, cache size: 3)",
      );
      expect(
        logger.debug.mock.calls.some((call) =>
          String(call[0]).includes('AnatomyGraphAlgorithms.getAllParts returned 2 parts'),
        ),
      ).toBe(true);
      expect(parts).toEqual(graphResult);
    });

    it('returns cached results without invoking the graph algorithms', () => {
      const { service, logger, queryCacheInstance } = instantiateService();
      const cached = ['cached-root', 'cached-child'];
      queryCacheInstance.getCachedGetAllParts.mockReturnValue(cached);

      expect(service.getAllParts({ body: { root: 'root-11' } })).toEqual(cached);
      expect(algorithmMocks.getAllParts).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        "BodyGraphService: Found cached result for root 'root-11': 2 parts",
      );
    });
  });

  describe('component inspection helpers', () => {
    it('ignores empty component payloads when checking for component presence', () => {
      const { service, entityManager } = instantiateService();
      jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['part-empty', 'part-with-component']);
      entityManager.getComponentData.mockImplementation((id) => {
        if (id === 'part-empty') return {};
        if (id === 'part-with-component') return { status: 'ready' };
        return null;
      });

      expect(service.hasPartWithComponent({}, 'custom:flag')).toBe(true);
      expect(entityManager.getComponentData).toHaveBeenCalledTimes(2);
    });

    it('retrieves nested component values and reports when none match', () => {
      const { service, entityManager } = instantiateService();
      jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['part-with-value', 'part-missing']);
      entityManager.getComponentData.mockImplementation((id) => {
        if (id === 'part-with-value') {
          return { status: { locked: true } };
        }
        return null;
      });

      expect(
        service.hasPartWithComponentValue(
          {},
          'status',
          'status.locked',
          true,
        ),
      ).toEqual({ found: true, partId: 'part-with-value' });
      expect(
        service.hasPartWithComponentValue(
          {},
          'status',
          'status.locked',
          false,
        ),
      ).toEqual({ found: false });
    });
  });

  describe('getBodyGraph behaviour', () => {
    it('validates the entity identifier before querying data', async () => {
      const { service } = instantiateService();
      await expect(service.getBodyGraph(null)).rejects.toBeInstanceOf(
        InvalidArgumentError,
      );
      await expect(service.getBodyGraph(123)).rejects.toBeInstanceOf(
        InvalidArgumentError,
      );
    });

    it('throws when the entity has no anatomy body component', async () => {
      const { service, entityManager } = instantiateService();
      entityManager.getComponentData.mockResolvedValueOnce(null);

      await expect(service.getBodyGraph('actor-2')).rejects.toThrow(
        'Entity actor-2 has no anatomy:body component',
      );
    });

    it('returns helper accessors that query caches for connected parts', async () => {
      const { service, entityManager, cacheInstance } = instantiateService();
      entityManager.getComponentData.mockResolvedValueOnce({ root: 'torso' });
      const buildSpy = jest
        .spyOn(service, 'buildAdjacencyCache')
        .mockResolvedValue(undefined);
      const allPartsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['torso', 'arm']);
      cacheInstance.get.mockImplementation((id) => {
        if (id === 'torso') {
          return { children: ['arm'] };
        }
        return undefined;
      });

      const graph = await service.getBodyGraph('actor-graph');

      expect(buildSpy).toHaveBeenCalledWith('actor-graph');
      expect(graph.getAllPartIds()).toEqual(['torso', 'arm']);
      expect(graph.getConnectedParts('torso')).toEqual(['arm']);
      expect(graph.getConnectedParts('missing')).toEqual([]);
      expect(allPartsSpy).toHaveBeenCalledWith({ root: 'torso' }, 'actor-graph');
    });
  });

  describe('getAnatomyData variations', () => {
    it('validates input identifiers', async () => {
      const { service } = instantiateService();
      await expect(service.getAnatomyData(undefined)).rejects.toBeInstanceOf(
        InvalidArgumentError,
      );
    });

    it('returns null when the anatomy component is missing', async () => {
      const { service, entityManager, logger } = instantiateService();
      entityManager.getComponentData.mockResolvedValueOnce(null);

      await expect(service.getAnatomyData('actor-9')).resolves.toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        "BodyGraphService.getAnatomyData: Entity 'actor-9' has no anatomy:body component",
      );
    });

    it('returns recipe metadata and applies null fallback', async () => {
      const { service, entityManager } = instantiateService();
      entityManager.getComponentData
        .mockResolvedValueOnce({ recipeId: 'recipe-1' })
        .mockResolvedValueOnce({});

      await expect(service.getAnatomyData('actor-10')).resolves.toEqual({
        recipeId: 'recipe-1',
        rootEntityId: 'actor-10',
      });

      await expect(service.getAnatomyData('actor-10')).resolves.toEqual({
        recipeId: null,
        rootEntityId: 'actor-10',
      });
    });
  });

  describe('cache utilities', () => {
    it('delegates cache validation to the cache manager', () => {
      const { service, cacheInstance, entityManager } = instantiateService();
      cacheInstance.validateCache.mockReturnValue({ valid: false });

      expect(service.validateCache()).toEqual({ valid: false });
      expect(cacheInstance.validateCache).toHaveBeenCalledWith(entityManager);
    });

    it('exposes cache presence, children, parent, ancestors and descendants helpers', () => {
      const { service, cacheInstance } = instantiateService();
      cacheInstance.hasCacheForRoot.mockReturnValueOnce(true).mockReturnValueOnce(false);
      cacheInstance.get.mockImplementation((id) => {
        if (id === 'torso') {
          return { children: ['arm'], parentId: 'spine' };
        }
        if (id === 'arm') {
          return { parentId: 'torso' };
        }
        if (id === 'hand') {
          return { parentId: 'arm' };
        }
        return undefined;
      });
      algorithmMocks.getSubgraph
        .mockReturnValueOnce(['torso', 'arm', 'hand'])
        .mockReturnValueOnce(['hand']);

      expect(service.hasCache('root-x')).toBe(true);
      expect(service.hasCache('root-x')).toBe(false);
      expect(service.getChildren('torso')).toEqual(['arm']);
      expect(service.getChildren('missing')).toEqual([]);
      expect(service.getParent('arm')).toBe('torso');
      expect(service.getParent('no-parent')).toBeNull();
      expect(service.getAncestors('hand')).toEqual(['arm', 'torso', 'spine']);
      expect(service.getAllDescendants('torso')).toEqual(['arm', 'hand']);
      expect(service.getAllDescendants('hand')).toEqual([]);
    });
  });
});
