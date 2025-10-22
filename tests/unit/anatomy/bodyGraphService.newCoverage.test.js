import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

let mockCacheInstance;
let mockQueryCacheInstance;

const createMockCacheInstance = () => ({
  hasCacheForRoot: jest.fn(),
  buildCache: jest.fn().mockResolvedValue(undefined),
  invalidateCacheForRoot: jest.fn(),
  has: jest.fn(),
  get: jest.fn(),
  size: jest.fn(),
  validateCache: jest.fn(),
});

const createMockQueryCache = () => ({
  getCachedFindPartsByType: jest.fn(),
  cacheFindPartsByType: jest.fn(),
  getCachedGetAllParts: jest.fn(),
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
    getAllParts: jest.fn(),
    getAnatomyRoot: jest.fn(),
    getPath: jest.fn(),
  },
}));

import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import {
  BodyGraphService,
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';

describe('BodyGraphService focused coverage tests', () => {
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
    mockCacheInstance = createMockCacheInstance();
    mockQueryCacheInstance = createMockQueryCache();

    AnatomyCacheManager.mockImplementation(() => mockCacheInstance);
    AnatomyQueryCache.mockImplementation(() => mockQueryCacheInstance);

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

    mockCacheInstance.size.mockReturnValue(0);
    mockCacheInstance.has.mockReturnValue(false);
    mockQueryCacheInstance.getCachedFindPartsByType.mockReturnValue(undefined);
    mockQueryCacheInstance.getCachedGetAllParts.mockReturnValue(undefined);
  });

  describe('constructor validation', () => {
    it('requires all collaborators', () => {
      expect(
        () =>
          new BodyGraphService({
            logger,
            eventDispatcher,
          }),
      ).toThrow(new InvalidArgumentError('entityManager is required'));

      expect(
        () =>
          new BodyGraphService({
            entityManager,
            eventDispatcher,
          }),
      ).toThrow(new InvalidArgumentError('logger is required'));

      expect(
        () =>
          new BodyGraphService({
            entityManager,
            logger,
          }),
      ).toThrow(new InvalidArgumentError('eventDispatcher is required'));
    });

    it('creates cache collaborators when not supplied and respects injected query cache', () => {
      const externalQueryCache = createMockQueryCache();
      const service = new BodyGraphService({
        entityManager,
        logger,
        eventDispatcher,
        queryCache: externalQueryCache,
      });

      expect(AnatomyCacheManager).toHaveBeenCalledWith({ logger });
      expect(AnatomyQueryCache).not.toHaveBeenCalled();
      expect(service).toBeInstanceOf(BodyGraphService);
    });
  });

  it('builds adjacency cache only when necessary', async () => {
    const service = createService();

    mockCacheInstance.hasCacheForRoot.mockReturnValueOnce(false);
    await service.buildAdjacencyCache('root-1');
    expect(mockCacheInstance.buildCache).toHaveBeenCalledWith(
      'root-1',
      entityManager,
    );

    mockCacheInstance.hasCacheForRoot.mockReturnValueOnce(true);
    await service.buildAdjacencyCache('root-1');
    expect(mockCacheInstance.buildCache).toHaveBeenCalledTimes(1);
  });

  describe('detachPart', () => {
    it('throws when the target entity lacks a joint component', async () => {
      const service = createService();
      entityManager.getComponentData.mockReturnValue(undefined);

      await expect(service.detachPart('part-42')).rejects.toThrow(
        new InvalidArgumentError(
          "Entity 'part-42' has no joint component - cannot detach",
        ),
      );
    });

    it('detaches cascaded parts and dispatches an event', async () => {
      const service = createService();

      entityManager.getComponentData.mockReturnValue({
        parentId: 'parent-1',
        socketId: 'socket-9',
      });
      AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['part-1', 'child-7']);
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-777');

      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(123456789);

      const result = await service.detachPart('part-1', {
        cascade: true,
        reason: 'testing',
      });

      expect(entityManager.removeComponent).toHaveBeenCalledWith(
        'part-1',
        'anatomy:joint',
      );
      expect(mockCacheInstance.invalidateCacheForRoot).toHaveBeenCalledWith(
        'root-777',
      );
      expect(mockQueryCacheInstance.invalidateRoot).toHaveBeenCalledWith(
        'root-777',
      );
      expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedEntityId: 'part-1',
          parentEntityId: 'parent-1',
          socketId: 'socket-9',
          detachedCount: 2,
          reason: 'testing',
          timestamp: 123456789,
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        "BodyGraphService: Detached 2 entities from parent 'parent-1'",
      );
      expect(result).toEqual({ detached: ['part-1', 'child-7'], parentId: 'parent-1', socketId: 'socket-9' });

      nowSpy.mockRestore();
    });

    it('supports non-cascading detaches without invalidating root caches', async () => {
      const service = createService();

      entityManager.getComponentData.mockReturnValue({
        parentId: 'parent-2',
        socketId: 'socket-3',
      });
      AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue(null);

      const outcome = await service.detachPart('part-2', { cascade: false });

      expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
      expect(mockCacheInstance.invalidateCacheForRoot).not.toHaveBeenCalled();
      expect(mockQueryCacheInstance.invalidateRoot).not.toHaveBeenCalled();
      expect(outcome.detached).toEqual(['part-2']);
    });
  });

  it('caches results for findPartsByType calls', () => {
    const service = createService();
    mockQueryCacheInstance.getCachedFindPartsByType.mockReturnValueOnce([
      'cached-part',
    ]);

    expect(service.findPartsByType('root-x', 'arm')).toEqual(['cached-part']);
    expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();

    mockQueryCacheInstance.getCachedFindPartsByType.mockReturnValueOnce(undefined);
    AnatomyGraphAlgorithms.findPartsByType.mockReturnValueOnce(['fresh']);

    expect(service.findPartsByType('root-y', 'leg')).toEqual(['fresh']);
    expect(mockQueryCacheInstance.cacheFindPartsByType).toHaveBeenCalledWith(
      'root-y',
      'leg',
      ['fresh'],
    );
  });

  it('delegates getAnatomyRoot and getPath to graph algorithms', () => {
    const service = createService();

    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-id');
    AnatomyGraphAlgorithms.getPath.mockReturnValue(['a', 'b']);

    expect(service.getAnatomyRoot('part-x')).toBe('root-id');
    expect(AnatomyGraphAlgorithms.getAnatomyRoot).toHaveBeenCalledWith(
      'part-x',
      mockCacheInstance,
      entityManager,
    );

    expect(service.getPath('a', 'b')).toEqual(['a', 'b']);
    expect(AnatomyGraphAlgorithms.getPath).toHaveBeenCalledWith(
      'a',
      'b',
      mockCacheInstance,
    );
  });

  describe('getAllParts', () => {
    it('returns an empty array when no body component is provided', () => {
      const service = createService();
      expect(service.getAllParts(null)).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith(
        'BodyGraphService.getAllParts: No bodyComponent provided',
      );
    });

    it('gracefully handles body components without any root identifier', () => {
      const service = createService();

      const result = service.getAllParts({ metadata: { label: 'no-root' } });

      expect(result).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith(
        'BodyGraphService.getAllParts: No root ID found in bodyComponent',
      );
    });

    it('resolves using the blueprint root when actor cache is missing', () => {
      const service = createService();

      mockCacheInstance.size.mockReturnValue(1);
      mockCacheInstance.has.mockReturnValue(false);
      AnatomyGraphAlgorithms.getAllParts.mockReturnValueOnce([
        'root-entity',
        'child-1',
      ]);

      const result = service.getAllParts({
        body: { root: 'blueprint-root' },
      });

      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'blueprint-root',
        mockCacheInstance,
        entityManager,
      );
      expect(mockQueryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith(
        'blueprint-root',
        ['root-entity', 'child-1'],
      );
      expect(result).toEqual(['root-entity', 'child-1']);
    });

    it('uses the actor entity as cache root when available and respects cached results', () => {
      const service = createService();

      mockCacheInstance.size.mockReturnValue(2);
      mockCacheInstance.has.mockReturnValue(true);
      mockQueryCacheInstance.getCachedGetAllParts.mockReturnValueOnce([
        'cached-result',
      ]);

      expect(
        service.getAllParts({ body: { root: 'blueprint-root' } }, 'actor-1'),
      ).toEqual(['cached-result']);

      mockQueryCacheInstance.getCachedGetAllParts.mockReturnValueOnce(undefined);
      AnatomyGraphAlgorithms.getAllParts.mockReturnValueOnce(['actor-root']);

      const secondResult = service.getAllParts(
        { root: 'ignored-blueprint-root' },
        'actor-1',
      );

      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'actor-1',
        mockCacheInstance,
        entityManager,
      );
      expect(mockQueryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith(
        'actor-1',
        ['actor-root'],
      );
      expect(secondResult).toEqual(['actor-root']);
    });

    it('logs compact summaries for large result sets', () => {
      const service = createService();

      mockCacheInstance.size.mockReturnValue(1);
      mockCacheInstance.has.mockReturnValue(false);
      mockQueryCacheInstance.getCachedGetAllParts.mockReturnValueOnce(undefined);
      AnatomyGraphAlgorithms.getAllParts.mockReturnValueOnce([
        'root',
        'child-1',
        'child-2',
        'child-3',
        'child-4',
        'child-5',
      ]);

      service.getAllParts({ body: { root: 'blueprint-root' } });

      const summaryLog = logger.debug.mock.calls.find(([message]) =>
        message.startsWith(
          'BodyGraphService: AnatomyGraphAlgorithms.getAllParts returned',
        ),
      );

      expect(summaryLog?.[0]).toContain('...');
    });
  });

  describe('component lookup helpers', () => {
    it('detects parts with a given component', () => {
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['a', 'b', 'c']);

      entityManager.getComponentData.mockImplementation((id, componentId) => {
        if (id === 'b' && componentId === 'component:x') {
          return { present: true };
        }
        if (id === 'c') {
          return {};
        }
        return null;
      });

      expect(service.hasPartWithComponent({}, 'component:x')).toBe(true);
      entityManager.getComponentData.mockReturnValue(null);
      jest.spyOn(service, 'getAllParts').mockReturnValue(['only']);
      expect(service.hasPartWithComponent({}, 'component:y')).toBe(false);
    });

    it('looks up nested component values', () => {
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['torso', 'arm']);

      entityManager.getComponentData.mockImplementation((id) => {
        if (id === 'torso') {
          return { stats: { durability: 'intact' } };
        }
        return {};
      });

      expect(
        service.hasPartWithComponentValue(
          {},
          'component:z',
          'stats.durability',
          'intact',
        ),
      ).toEqual({ found: true, partId: 'torso' });

      expect(
        service.hasPartWithComponentValue(
          {},
          'component:z',
          'stats.durability',
          'broken',
        ),
      ).toEqual({ found: false });
    });

    it('ignores parts that completely lack the requested component', () => {
      const service = createService();
      jest.spyOn(service, 'getAllParts').mockReturnValue(['missing']);

      entityManager.getComponentData.mockReturnValue(null);

      expect(
        service.hasPartWithComponentValue(
          {},
          'component:z',
          'stats.durability',
          'intact',
        ),
      ).toEqual({ found: false });
    });
  });

  describe('graph accessors', () => {
    it('creates a graph facade for valid entities', async () => {
      const service = createService();

      entityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === 'anatomy:body') {
          return Promise.resolve({ body: { root: 'blueprint-root' } });
        }
        return undefined;
      });

      mockCacheInstance.hasCacheForRoot.mockReturnValue(false);
      mockCacheInstance.get.mockReturnValueOnce({ children: ['child-1', 'child-2'] });
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['actor-root']);

      const graph = await service.getBodyGraph('actor-99');

      expect(mockCacheInstance.buildCache).toHaveBeenCalledWith(
        'actor-99',
        entityManager,
      );
      expect(graph.getAllPartIds()).toEqual(['actor-root']);
      expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
        'blueprint-root',
        mockCacheInstance,
        entityManager,
      );
      expect(graph.getConnectedParts('part-node')).toEqual(['child-1', 'child-2']);
    });

    it('validates parameters for getBodyGraph and getAnatomyData', async () => {
      const service = createService();

      await expect(service.getBodyGraph('')).rejects.toThrow(
        new InvalidArgumentError('Entity ID is required and must be a string'),
      );

      entityManager.getComponentData.mockResolvedValue(null);
      await expect(service.getBodyGraph('actor-1')).rejects.toThrow(
        new Error('Entity actor-1 has no anatomy:body component'),
      );

      await expect(service.getAnatomyData('')).rejects.toThrow(
        new InvalidArgumentError('Entity ID is required and must be a string'),
      );

      entityManager.getComponentData.mockResolvedValue(null);
      await expect(service.getAnatomyData('actor-2')).resolves.toBeNull();

      entityManager.getComponentData.mockResolvedValue({ recipeId: 'recipe-1' });
      await expect(service.getAnatomyData('actor-3')).resolves.toEqual({
        recipeId: 'recipe-1',
        rootEntityId: 'actor-3',
      });

      entityManager.getComponentData.mockResolvedValue({});
      await expect(service.getAnatomyData('actor-4')).resolves.toEqual({
        recipeId: null,
        rootEntityId: 'actor-4',
      });
    });

    it('returns empty child collections for entities missing from the cache', async () => {
      const service = createService();

      entityManager.getComponentData.mockResolvedValue({
        body: { root: 'blueprint-root' },
      });
      AnatomyGraphAlgorithms.getAllParts.mockReturnValue(['actor-root']);

      const graph = await service.getBodyGraph('actor-404');

      expect(graph.getConnectedParts('unknown-node')).toEqual([]);
    });
  });

  it('validates cache structures and exposes parent/child helpers', () => {
    const service = createService();

    mockCacheInstance.validateCache.mockReturnValue(true);
    expect(service.validateCache()).toBe(true);

    mockCacheInstance.hasCacheForRoot.mockReturnValue(true);
    expect(service.hasCache('root-5')).toBe(true);

    mockCacheInstance.get.mockImplementation((id) => {
      if (id === 'root') {
        return { children: ['branch-1'], parentId: null };
      }
      if (id === 'branch-1') {
        return { children: ['leaf'], parentId: 'root' };
      }
      if (id === 'leaf') {
        return { children: [], parentId: 'branch-1' };
      }
      return undefined;
    });

    expect(service.getChildren('root')).toEqual(['branch-1']);
    expect(service.getChildren('unknown-child')).toEqual([]);
    expect(service.getParent('branch-1')).toBe('root');
    expect(service.getParent('unknown')).toBeNull();
    expect(service.getAncestors('leaf')).toEqual(['branch-1', 'root']);
  });

  it('lists all descendants using the graph algorithms helper', () => {
    const service = createService();
    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue([
      'root',
      'child-1',
      'child-2',
    ]);

    expect(service.getAllDescendants('root')).toEqual(['child-1', 'child-2']);
    expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
      'root',
      mockCacheInstance,
    );
  });
});
