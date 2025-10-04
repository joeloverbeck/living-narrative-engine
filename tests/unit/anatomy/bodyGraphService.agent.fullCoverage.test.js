import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';

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

import {
  BodyGraphService,
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';

describe('BodyGraphService comprehensive coverage', () => {
  let service;
  let entityManager;
  let logger;
  let eventDispatcher;
  let cacheInstance;
  let queryCacheInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    cacheInstance = {
      hasCacheForRoot: jest.fn().mockReturnValue(false),
      buildCache: jest.fn().mockResolvedValue(undefined),
      invalidateCacheForRoot: jest.fn(),
      get: jest.fn().mockReturnValue({ children: ['child-1'], parentId: 'parent-1' }),
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

    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['part-1', 'child-1']);
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue('root-entity');
    AnatomyGraphAlgorithms.findPartsByType.mockReturnValue(['arm']);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue([
      'root-entity',
      'part-1',
      'child-1',
    ]);
    AnatomyGraphAlgorithms.getPath.mockReturnValue(['root-entity', 'part-1']);

    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });
  });

  it('builds adjacency cache only when necessary', async () => {
    await service.buildAdjacencyCache('actor-1');

    expect(cacheInstance.hasCacheForRoot).toHaveBeenCalledWith('actor-1');
    expect(cacheInstance.buildCache).toHaveBeenCalledWith(
      'actor-1',
      entityManager
    );

    cacheInstance.hasCacheForRoot.mockReturnValueOnce(true);
    await service.buildAdjacencyCache('actor-1');
    expect(cacheInstance.buildCache).toHaveBeenCalledTimes(1);
  });

  it('detaches parts with cascade and invalidates caches', async () => {
    entityManager.getComponentData.mockImplementation((entityId, componentId) => {
      if (componentId === 'anatomy:joint' && entityId === 'part-1') {
        return { parentId: 'torso-1', socketId: 'shoulder' };
      }
      return null;
    });

    const result = await service.detachPart('part-1', {
      cascade: true,
      reason: 'injury',
    });

    expect(AnatomyGraphAlgorithms.getSubgraph).toHaveBeenCalledWith(
      'part-1',
      cacheInstance
    );
    expect(entityManager.removeComponent).toHaveBeenCalledWith(
      'part-1',
      'anatomy:joint'
    );
    expect(cacheInstance.invalidateCacheForRoot).toHaveBeenCalledWith(
      'root-entity'
    );
    expect(queryCacheInstance.invalidateRoot).toHaveBeenCalledWith(
      'root-entity'
    );
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'part-1',
        parentEntityId: 'torso-1',
        socketId: 'shoulder',
        detachedCount: 2,
        reason: 'injury',
        timestamp: expect.any(Number),
      })
    );
    expect(logger.info).toHaveBeenCalled();
    expect(result).toEqual({
      detached: ['part-1', 'child-1'],
      parentId: 'torso-1',
      socketId: 'shoulder',
    });
  });

  it('supports non-cascading detach and validates input', async () => {
    entityManager.getComponentData.mockImplementation((entityId, componentId) => {
      if (componentId === 'anatomy:joint' && entityId === 'part-1') {
        return { parentId: 'torso-1', socketId: 'shoulder' };
      }
      return null;
    });

    AnatomyGraphAlgorithms.getSubgraph.mockClear();
    const result = await service.detachPart('part-1', {
      cascade: false,
      reason: 'manual',
    });
    expect(AnatomyGraphAlgorithms.getSubgraph).not.toHaveBeenCalled();
    expect(result.detached).toEqual(['part-1']);

    await expect(service.detachPart('unknown')).rejects.toThrow(
      InvalidArgumentError
    );
  });

  it('uses query caching when finding parts by type', () => {
    const initial = service.findPartsByType('root-entity', 'arm');
    expect(initial).toEqual(['arm']);
    expect(queryCacheInstance.cacheFindPartsByType).toHaveBeenCalledWith(
      'root-entity',
      'arm',
      ['arm']
    );

    AnatomyGraphAlgorithms.findPartsByType.mockClear();
    queryCacheInstance.getCachedFindPartsByType.mockReturnValueOnce([
      'cached-arm',
    ]);
    const cached = service.findPartsByType('root-entity', 'arm');
    expect(cached).toEqual(['cached-arm']);
    expect(AnatomyGraphAlgorithms.findPartsByType).not.toHaveBeenCalled();
  });

  it('retrieves all parts with multiple cache scenarios', () => {
    expect(service.getAllParts(null)).toEqual([]);

    queryCacheInstance.getCachedGetAllParts.mockReturnValueOnce(undefined);
    cacheInstance.has.mockReturnValueOnce(true);
    cacheInstance.size.mockReturnValueOnce(3);

    const bodyComponentWithNestedRoot = { body: { root: 'blueprint-root' } };
    const partsFromActorCache = service.getAllParts(
      bodyComponentWithNestedRoot,
      'actor-1'
    );
    expect(partsFromActorCache).toEqual([
      'root-entity',
      'part-1',
      'child-1',
    ]);
    expect(queryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith(
      'actor-1',
      partsFromActorCache
    );

    AnatomyGraphAlgorithms.getAllParts.mockClear();
    queryCacheInstance.getCachedGetAllParts.mockReturnValueOnce(['cached']);
    const cachedReturn = service.getAllParts({ root: 'blueprint-root' });
    expect(cachedReturn).toEqual(['cached']);
    expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
  });

  it('checks for components and specific values on parts', () => {
    jest
      .spyOn(service, 'getAllParts')
      .mockReturnValue(['part-a', 'part-b', 'part-empty']);

    entityManager.getComponentData.mockImplementation((entityId, componentId) => {
      if (componentId === 'custom:flag' && entityId === 'part-a') {
        return { nested: { value: 42 } };
      }
      if (componentId === 'custom:flag' && entityId === 'part-b') {
        return {};
      }
      if (componentId === 'custom:flag' && entityId === 'part-empty') {
        return undefined;
      }
      return null;
    });

    expect(service.hasPartWithComponent({ root: 'dummy' }, 'custom:flag')).toBe(
      true
    );
    expect(
      service.hasPartWithComponentValue(
        { root: 'dummy' },
        'custom:flag',
        'nested.value',
        42
      )
    ).toEqual({ found: true, partId: 'part-a' });
    expect(
      service.hasPartWithComponentValue(
        { root: 'dummy' },
        'custom:flag',
        'nested.value',
        100
      )
    ).toEqual({ found: false });
  });

  it('validates input and returns helpers when building body graph', async () => {
    await expect(service.getBodyGraph('')).rejects.toThrow(InvalidArgumentError);

    entityManager.getComponentData.mockReturnValueOnce(null);
    await expect(service.getBodyGraph('actor-1')).rejects.toThrow(
      Error
    );

    entityManager.getComponentData.mockImplementation((entityId, componentId) => {
      if (componentId === 'anatomy:body' && entityId === 'actor-2') {
        return { body: { root: 'blueprint-root' } };
      }
      return null;
    });

    const graph = await service.getBodyGraph('actor-2');
    expect(cacheInstance.hasCacheForRoot).toHaveBeenCalledWith('actor-2');
    expect(graph.getAllPartIds()).toEqual([
      'root-entity',
      'part-1',
      'child-1',
    ]);
    expect(graph.getConnectedParts('any')).toEqual(['child-1']);
  });

  it('retrieves anatomy metadata and handles invalid input', async () => {
    await expect(service.getAnatomyData('')).rejects.toThrow(InvalidArgumentError);

    entityManager.getComponentData.mockReturnValueOnce(null);
    await expect(service.getAnatomyData('actor-1')).resolves.toBeNull();

    entityManager.getComponentData.mockReturnValueOnce({ recipeId: 'recipe-9' });
    await expect(service.getAnatomyData('actor-2')).resolves.toEqual({
      recipeId: 'recipe-9',
      rootEntityId: 'actor-2',
    });
  });

  it('delegates to cache helpers and graph algorithms', () => {
    cacheInstance.validateCache.mockReturnValue({ valid: true });
    cacheInstance.hasCacheForRoot.mockReturnValueOnce(true);
    cacheInstance.get.mockImplementation((entityId) => {
      if (entityId === 'child-x') {
        return { children: ['grandchild'], parentId: 'root-x' };
      }
      if (entityId === 'root-x') {
        return { children: ['child-x'], parentId: null };
      }
      return { children: [], parentId: null };
    });

    AnatomyGraphAlgorithms.getSubgraph.mockReturnValueOnce([
      'child-x',
      'grandchild',
    ]);

    expect(service.validateCache()).toEqual({ valid: true });
    expect(service.hasCache('root-x')).toBe(true);
    expect(service.getChildren('root-x')).toEqual(['child-x']);
    expect(service.getParent('child-x')).toBe('root-x');
    expect(service.getAncestors('child-x')).toEqual(['root-x']);
    expect(service.getAllDescendants('child-x')).toEqual(['grandchild']);
    expect(service.getAnatomyRoot('node')).toBe('root-entity');
    expect(service.getPath('a', 'b')).toEqual(['root-entity', 'part-1']);
  });
});
