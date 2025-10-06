import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';

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
    getAnatomyRoot: jest.fn(),
    getPath: jest.fn(),
    getAllParts: jest.fn(),
  },
}));

describe('BodyGraphService edge case coverage', () => {
  /** @type {{ getComponentData: jest.Mock, removeComponent: jest.Mock }} */
  let entityManager;
  /** @type {{ debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock }} */
  let logger;
  /** @type {{ dispatch: jest.Mock }} */
  let eventDispatcher;
  /** @type {{ hasCacheForRoot: jest.Mock, buildCache: jest.Mock, invalidateCacheForRoot: jest.Mock, get: jest.Mock, has: jest.Mock, size: jest.Mock, validateCache: jest.Mock }} */
  let cacheInstance;
  /** @type {{ getCachedFindPartsByType: jest.Mock, cacheFindPartsByType: jest.Mock, getCachedGetAllParts: jest.Mock, cacheGetAllParts: jest.Mock, invalidateRoot: jest.Mock }} */
  let queryCacheInstance;

  const createService = () =>
    new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });

  beforeEach(() => {
    jest.clearAllMocks();

    cacheInstance = {
      hasCacheForRoot: jest.fn().mockReturnValue(false),
      buildCache: jest.fn().mockResolvedValue(undefined),
      invalidateCacheForRoot: jest.fn(),
      get: jest.fn().mockReturnValue({ children: [], parentId: null }),
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
      removeComponent: jest.fn(),
    };

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    eventDispatcher = {
      dispatch: jest.fn(),
    };

    AnatomyGraphAlgorithms.getAllParts.mockReturnValue([]);
  });

  it.each([
    [
      'entity manager',
      (deps) => ({ logger: deps.logger, eventDispatcher: deps.eventDispatcher }),
      'entityManager is required',
    ],
    [
      'logger',
      (deps) => ({ entityManager: deps.entityManager, eventDispatcher: deps.eventDispatcher }),
      'logger is required',
    ],
    [
      'event dispatcher',
      (deps) => ({ entityManager: deps.entityManager, logger: deps.logger }),
      'eventDispatcher is required',
    ],
  ])('throws when %s dependency is missing', (_, optionBuilder, message) => {
    const dependencies = { entityManager, logger, eventDispatcher };

    expect(() => new BodyGraphService(optionBuilder(dependencies))).toThrow(
      new InvalidArgumentError(message)
    );
  });

  it('returns no parts when body data lacks root identifiers', () => {
    const service = createService();

    const parts = service.getAllParts({ limbs: { leftArm: 'arm-1' } });

    expect(parts).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      'BodyGraphService.getAllParts: No root ID found in bodyComponent'
    );
    expect(queryCacheInstance.getCachedGetAllParts).not.toHaveBeenCalled();
    expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
  });

  it('returns false when no parts provide the requested component data', () => {
    const service = createService();

    jest.spyOn(service, 'getAllParts').mockReturnValue(['part-a', 'part-b']);

    entityManager.getComponentData.mockImplementation((entityId, componentId) => {
      if (componentId === 'custom:flag' && entityId === 'part-a') {
        return undefined;
      }
      if (componentId === 'custom:flag' && entityId === 'part-b') {
        return {};
      }
      return null;
    });

    const result = service.hasPartWithComponent({ body: {} }, 'custom:flag');

    expect(result).toBe(false);
    expect(entityManager.getComponentData).toHaveBeenCalledTimes(2);
  });

  it('does not invalidate caches when detaching without a resolvable root', async () => {
    const service = createService();

    AnatomyGraphAlgorithms.getSubgraph.mockReturnValue(['limb-1']);
    AnatomyGraphAlgorithms.getAnatomyRoot.mockReturnValue(null);

    entityManager.getComponentData.mockImplementation((entityId, componentId) => {
      if (componentId === 'anatomy:joint' && entityId === 'limb-1') {
        return { parentId: 'torso-9', socketId: 'shoulder' };
      }
      return null;
    });

    await service.detachPart('limb-1', { cascade: true, reason: 'manual' });

    expect(cacheInstance.invalidateCacheForRoot).not.toHaveBeenCalled();
    expect(queryCacheInstance.invalidateRoot).not.toHaveBeenCalled();
    expect(eventDispatcher.dispatch).toHaveBeenCalled();
  });

  it('logs truncated anatomy previews when many parts are discovered', () => {
    const service = createService();

    cacheInstance.has.mockReturnValueOnce(false);
    const longResult = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    AnatomyGraphAlgorithms.getAllParts.mockReturnValueOnce(longResult);

    const parts = service.getAllParts({ body: { root: 'root-blueprint' } });

    expect(parts).toEqual(longResult);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('AnatomyGraphAlgorithms.getAllParts returned 7 parts')
    );
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('...'));
    expect(queryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith(
      'root-blueprint',
      longResult
    );
  });

  it('handles missing component data when searching for specific values', () => {
    const service = createService();

    jest.spyOn(service, 'getAllParts').mockReturnValue(['node-1']);
    entityManager.getComponentData.mockReturnValue(null);

    const result = service.hasPartWithComponentValue(
      { body: {} },
      'custom:flag',
      'nested.value',
      5
    );

    expect(result).toEqual({ found: false });
  });

  it('retrieves nested component values when available', () => {
    const service = createService();

    jest.spyOn(service, 'getAllParts').mockReturnValue(['node-1']);
    entityManager.getComponentData.mockReturnValue({ nested: { value: 42 } });

    const result = service.hasPartWithComponentValue(
      { body: {} },
      'custom:flag',
      'nested.value',
      42
    );

    expect(result).toEqual({ found: true, partId: 'node-1' });
  });

  it('falls back to defaults when cache lookups miss nodes', () => {
    const service = createService();

    cacheInstance.get.mockReturnValueOnce(undefined);
    expect(service.getChildren('missing')).toEqual([]);
    expect(cacheInstance.get).toHaveBeenCalledWith('missing');

    cacheInstance.get.mockReturnValueOnce({});
    expect(service.getChildren('no-children')).toEqual([]);

    cacheInstance.get.mockReturnValueOnce(null);
    expect(service.getChildren('also-missing')).toEqual([]);

    cacheInstance.get.mockReturnValueOnce(undefined);
    expect(service.getParent('missing')).toBeNull();
  });

  it('returns null recipe metadata when anatomy component omits recipe id', async () => {
    const service = createService();

    entityManager.getComponentData.mockResolvedValueOnce({});

    await expect(service.getAnatomyData('actor-9')).resolves.toEqual({
      recipeId: null,
      rootEntityId: 'actor-9',
    });
  });

  it('falls back to empty connected parts when cache lacks a node entry', async () => {
    const service = createService();

    entityManager.getComponentData.mockResolvedValueOnce({ body: { root: 'blueprint-root' } });

    const graph = await service.getBodyGraph('actor-22');

    cacheInstance.get.mockReturnValueOnce(undefined);

    expect(graph.getConnectedParts('unknown-node')).toEqual([]);
  });
});
