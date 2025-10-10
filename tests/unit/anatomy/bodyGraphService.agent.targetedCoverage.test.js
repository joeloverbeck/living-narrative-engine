import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

let mockCacheInstance;
let mockQueryCacheInstance;

const createCacheMock = () => ({
  hasCacheForRoot: jest.fn().mockReturnValue(false),
  buildCache: jest.fn().mockResolvedValue(undefined),
  invalidateCacheForRoot: jest.fn(),
  has: jest.fn().mockReturnValue(false),
  get: jest.fn().mockReturnValue(undefined),
  size: jest.fn().mockReturnValue(0),
  validateCache: jest.fn().mockReturnValue(true),
});

const createQueryCacheMock = () => ({
  getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
  cacheFindPartsByType: jest.fn(),
  getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
  cacheGetAllParts: jest.fn(),
  invalidateRoot: jest.fn(),
});

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => ({
  AnatomyCacheManager: jest.fn(() => mockCacheInstance),
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

import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import {
  BodyGraphService,
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';

const originalDateNow = Date.now;


describe('BodyGraphService targeted coverage', () => {
  let entityManager;
  let logger;
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

    AnatomyCacheManager.mockImplementation(() => {
      mockCacheInstance = createCacheMock();
      return mockCacheInstance;
    });

    AnatomyQueryCache.mockImplementation(() => {
      mockQueryCacheInstance = createQueryCacheMock();
      return mockQueryCacheInstance;
    });

    Object.values(AnatomyGraphAlgorithms).forEach((fn) => fn.mockReset());

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

  afterEach(() => {
    Date.now = originalDateNow;
  });

  describe('constructor behaviour', () => {
    it('requires mandatory dependencies', () => {
      expect(() => new BodyGraphService({ logger, eventDispatcher })).toThrow(
        InvalidArgumentError
      );
      expect(
        () => new BodyGraphService({ entityManager, eventDispatcher })
      ).toThrow(InvalidArgumentError);
      expect(() => new BodyGraphService({ entityManager, logger })).toThrow(
        InvalidArgumentError
      );
    });

    it('creates a query cache when not provided', () => {
      const service = createService();

      expect(service).toBeInstanceOf(BodyGraphService);
      expect(AnatomyQueryCache).toHaveBeenCalledTimes(1);
      expect(mockQueryCacheInstance).toBeDefined();
    });

    it('reuses a provided query cache', () => {
      const externalCache = createQueryCacheMock();

      const service = createService({ queryCache: externalCache });

      expect(service).toBeInstanceOf(BodyGraphService);
      expect(AnatomyQueryCache).not.toHaveBeenCalled();
    });
  });

  describe('cache management', () => {
    it('builds adjacency cache when missing', async () => {
      const service = createService();
      mockCacheInstance.hasCacheForRoot.mockReturnValue(false);

      await service.buildAdjacencyCache('root-1');

      expect(mockCacheInstance.hasCacheForRoot).toHaveBeenCalledWith('root-1');
      expect(mockCacheInstance.buildCache).toHaveBeenCalledWith(
        'root-1',
        entityManager
      );
    });

    it('skips rebuilding cache when already present', async () => {
      const service = createService();
      mockCacheInstance.hasCacheForRoot.mockReturnValue(true);

      await service.buildAdjacencyCache('root-1');

      expect(mockCacheInstance.buildCache).not.toHaveBeenCalled();
    });

    it('validates cache using the cache manager', () => {
      const service = createService();

      const result = service.validateCache();

      expect(mockCacheInstance.validateCache).toHaveBeenCalledWith(
        entityManager
      );
      expect(result).toBe(true);
    });

    it('checks whether cache exists for a root', () => {
      const service = createService();
      mockCacheInstance.hasCacheForRoot.mockReturnValue(true);

      expect(service.hasCache('actor-1')).toBe(true);
      expect(mockCacheInstance.hasCacheForRoot).toHaveBeenCalledWith('actor-1');
    });
  });

  describe('detaching anatomy parts', () => {
    it('throws when the joint component is missing', async () => {
      const service = createService();
      entityManager.getComponentData.mockReturnValue(null);

      await expect(service.detachPart('part-1')).rejects.toThrow(
        InvalidArgumentError
      );
    });

    it('detaches a subgraph with cascade enabled', async () => {
      const service = createService();

      entityManager.getComponentData.mockImplementation((id, component) => {
        if (component === 'anatomy:joint') {
          return { parentId: 'parent-1', socketId: 'socket-7' };
        }
        return null;
      });

      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([
        'part-1',
        'child-1',
      ]);
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-9');
      Date.now = jest.fn(() => 1234567890);

      const result = await service.detachPart('part-1');

      expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
        'part-1',
        mockCacheInstance
      );
      expect(entityManager.removeComponent).toHaveBeenCalledWith(
        'part-1',
        'anatomy:joint'
      );
      expect(mockCacheInstance.invalidateCacheForRoot).toHaveBeenCalledWith(
        'root-9'
      );
      expect(mockQueryCacheInstance.invalidateRoot).toHaveBeenCalledWith(
        'root-9'
      );
      expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedEntityId: 'part-1',
          parentEntityId: 'parent-1',
          socketId: 'socket-7',
          detachedCount: 2,
          timestamp: 1234567890,
        })
      );
      expect(result).toEqual({
        detached: ['part-1', 'child-1'],
        parentId: 'parent-1',
        socketId: 'socket-7',
      });
    });

    it('detaches only the requested entity when cascade is disabled', async () => {
      const service = createService();

      entityManager.getComponentData.mockImplementation((id, component) => {
        if (component === 'anatomy:joint') {
          return { parentId: 'parent-9', socketId: 'socket-3' };
        }
        return null;
      });

      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue(null);

      const result = await service.detachPart('part-8', {
        cascade: false,
        reason: 'test-reason',
      });

      expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
      expect(mockCacheInstance.invalidateCacheForRoot).not.toHaveBeenCalled();
      expect(mockQueryCacheInstance.invalidateRoot).not.toHaveBeenCalled();
      expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedEntityId: 'part-8',
          detachedCount: 1,
          reason: 'test-reason',
        })
      );
      expect(result).toEqual({
        detached: ['part-8'],
        parentId: 'parent-9',
        socketId: 'socket-3',
      });
    });
  });

  describe('query helpers', () => {
    it('uses cached results when findPartsByType cache hits', () => {
      const service = createService();
      mockQueryCacheInstance.getCachedFindPartsByType.mockReturnValue([
        'cached-1',
      ]);

      const result = service.findPartsByType('root-1', 'arm');

      expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();
      expect(result).toEqual(['cached-1']);
    });

    it('computes findPartsByType when cache misses', () => {
      const service = createService();
      mockQueryCacheInstance.getCachedFindPartsByType.mockReturnValue(
        undefined
      );
      AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['arm-1']);

      const result = service.findPartsByType('root-2', 'arm');

      expect(AnatomyGraphAlgorithms.findPartsByType).toHaveBeenCalledWith(
        'root-2',
        'arm',
        mockCacheInstance
      );
      expect(mockQueryCacheInstance.cacheFindPartsByType).toHaveBeenCalledWith(
        'root-2',
        'arm',
        ['arm-1']
      );
      expect(result).toEqual(['arm-1']);
    });

    it('delegates getAnatomyRoot to algorithms', () => {
      const service = createService();
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-3');

      const result = service.getAnatomyRoot('part-1');

      expect(AnatomyGraphAlgorithms.getAnatomyRoot).toHaveBeenCalledWith(
        'part-1',
        mockCacheInstance,
        entityManager
      );
      expect(result).toBe('root-3');
    });

    it('delegates getPath to algorithms', () => {
      const service = createService();
      AnatomyGraphAlgorithms.getPath.mockReturnValue(['a', 'b']);

      const result = service.getPath('a', 'b');

      expect(AnatomyGraphAlgorithms.getPath).toHaveBeenCalledWith(
        'a',
        'b',
        mockCacheInstance
      );
      expect(result).toEqual(['a', 'b']);
    });

    it('returns descendants excluding the origin node', () => {
      const service = createService();
      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([
        'root',
        'child-1',
        'child-2',
      ]);

      const result = service.getAllDescendants('root');

      expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
        'root',
        mockCacheInstance
      );
      expect(result).toEqual(['child-1', 'child-2']);
    });
  });

  describe('getAllParts variations', () => {
    it('returns empty array when body component is missing', () => {
      const service = createService();

      const result = service.getAllParts(null);

      expect(logger.debug).toHaveBeenCalledWith(
        'BodyGraphService.getAllParts: No bodyComponent provided'
      );
      expect(result).toEqual([]);
    });

    it('uses the blueprint root when actor is not cached', () => {
      const service = createService();
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['root-1', 'child-1']);

      const bodyComponent = {
        body: { root: 'blueprint-root' },
      };

      const result = service.getAllParts(bodyComponent, 'actor-77');

      expect(mockCacheInstance.has).toHaveBeenCalledWith('actor-77');
      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'blueprint-root',
        mockCacheInstance,
        entityManager
      );
      expect(mockQueryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith(
        'blueprint-root',
        ['root-1', 'child-1']
      );
      expect(result).toEqual(['root-1', 'child-1']);
    });

    it('uses actor entity as cache root when available', () => {
      const service = createService();
      mockCacheInstance.has.mockReturnValue(true);
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['actor-root', 'arm']);

      const bodyComponent = { root: 'blueprint-root' };

      const result = service.getAllParts(bodyComponent, 'actor-1');

      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'actor-1',
        mockCacheInstance,
        entityManager
      );
      expect(result).toEqual(['actor-root', 'arm']);
    });

    it('returns cached getAllParts results when available', () => {
      const service = createService();
      mockCacheInstance.has.mockReturnValue(true);
      mockQueryCacheInstance.getCachedGetAllParts.mockReturnValue([
        'cached-1',
        'cached-2',
      ]);

      const bodyComponent = { root: 'blueprint-root' };

      const result = service.getAllParts(bodyComponent, 'actor-5');

      expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
      expect(result).toEqual(['cached-1', 'cached-2']);
    });
  });

  describe('component lookup helpers', () => {
    it('detects presence of a component on any part', () => {
      const service = createService();
      const getAllPartsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['part-1', 'part-2', 'part-3']);

      entityManager.getComponentData.mockImplementation((id) => {
        if (id === 'part-1') return {};
        if (id === 'part-2') return null;
        if (id === 'part-3') return { value: true };
        return undefined;
      });

      const result = service.hasPartWithComponent(
        { root: 'blueprint-root' },
        'component:test'
      );

      expect(result).toBe(true);
      expect(getAllPartsSpy).toHaveBeenCalled();
      getAllPartsSpy.mockRestore();
    });

    it('returns false when no parts have the component', () => {
      const service = createService();
      jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['part-1', 'part-2']);
      entityManager.getComponentData.mockReturnValue(null);

      const result = service.hasPartWithComponent(
        { root: 'blueprint-root' },
        'component:test'
      );

      expect(result).toBe(false);
    });

    it('finds a component value across parts', () => {
      const service = createService();
      jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['part-1', 'part-2']);

      entityManager.getComponentData.mockImplementation((id) =>
        id === 'part-1'
          ? { attributes: { status: 'ready' } }
          : { attributes: { status: 'idle' } }
      );

      const result = service.hasPartWithComponentValue(
        { root: 'blueprint-root' },
        'component:test',
        'attributes.status',
        'ready'
      );

      expect(result).toEqual({ found: true, partId: 'part-1' });
    });

    it('returns not found when component value is missing', () => {
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['part-1']);
      entityManager.getComponentData.mockReturnValue({ attributes: {} });

      const result = service.hasPartWithComponentValue(
        { root: 'blueprint-root' },
        'component:test',
        'attributes.status',
        'ready'
      );

      expect(result).toEqual({ found: false });
    });
  });

  describe('body graph retrieval', () => {
    it('validates entity identifier', async () => {
      const service = createService();

      await expect(service.getBodyGraph(null)).rejects.toThrow(
        InvalidArgumentError
      );
      await expect(service.getBodyGraph(123)).rejects.toThrow(
        InvalidArgumentError
      );
    });

    it('throws when anatomy body component is missing', async () => {
      const service = createService();
      entityManager.getComponentData.mockReturnValue(null);

      await expect(service.getBodyGraph('entity-1')).rejects.toThrow(
        Error
      );
    });

    it('returns body graph helpers when anatomy exists', async () => {
      const service = createService();
      const bodyComponent = {
        body: { root: 'root-1' },
      };
      entityManager.getComponentData.mockReturnValue(bodyComponent);
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['root-1', 'child-1']);
      const getAllPartsSpy = jest
        .spyOn(service, 'getAllParts')
        .mockReturnValue(['root-1', 'child-1']);
      mockCacheInstance.get.mockImplementation((id) =>
        id === 'child-1' ? { children: ['leaf-1'] } : undefined
      );

      const graph = await service.getBodyGraph('entity-1');

      expect(graph.getAllPartIds()).toEqual(['root-1', 'child-1']);
      expect(getAllPartsSpy).toHaveBeenCalledWith(bodyComponent, 'entity-1');
      expect(graph.getConnectedParts('child-1')).toEqual(['leaf-1']);
      expect(graph.getConnectedParts('unknown')).toEqual([]);
    });

    it('fetches anatomy metadata', async () => {
      const service = createService();
      entityManager.getComponentData.mockImplementation((id, component) =>
        component === 'anatomy:body'
          ? { recipeId: 'recipe-1' }
          : null
      );

      const data = await service.getAnatomyData('entity-1');

      expect(data).toEqual({ recipeId: 'recipe-1', rootEntityId: 'entity-1' });
    });

    it('returns null metadata when anatomy is missing', async () => {
      const service = createService();
      entityManager.getComponentData.mockReturnValue(null);

      const data = await service.getAnatomyData('entity-2');

      expect(data).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        "BodyGraphService.getAnatomyData: Entity 'entity-2' has no anatomy:body component"
      );
    });

    it('validates input for getAnatomyData', async () => {
      const service = createService();

      await expect(service.getAnatomyData(undefined)).rejects.toThrow(
        InvalidArgumentError
      );
    });
  });

  describe('tree navigation helpers', () => {
    it('returns children from cache', () => {
      const service = createService();
      mockCacheInstance.get.mockReturnValue({ children: ['child-1', 'child-2'] });

      expect(service.getChildren('parent')).toEqual(['child-1', 'child-2']);
    });

    it('returns empty array when node has no children', () => {
      const service = createService();
      mockCacheInstance.get.mockReturnValue(undefined);

      expect(service.getChildren('parent')).toEqual([]);
    });

    it('returns parent identifiers when available', () => {
      const service = createService();
      mockCacheInstance.get.mockReturnValue({ parentId: 'root-1' });

      expect(service.getParent('child')).toBe('root-1');
    });

    it('computes ancestor chain', () => {
      const service = createService();
      mockCacheInstance.get.mockImplementation((id) => {
        if (id === 'child') return { parentId: 'parent' };
        if (id === 'parent') return { parentId: 'grandparent' };
        if (id === 'grandparent') return { parentId: null };
        return undefined;
      });

      const ancestors = service.getAncestors('child');

      expect(ancestors).toEqual(['parent', 'grandparent']);
    });
  });
});
