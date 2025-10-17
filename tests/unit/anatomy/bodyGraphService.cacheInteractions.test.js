import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';

const mockCacheManagerFactory = jest.fn();
const mockQueryCacheFactory = jest.fn();

jest.mock('../../../src/anatomy/anatomyCacheManager.js', () => {
  const { jest: jestMock } = require('@jest/globals');
  return {
    AnatomyCacheManager: jestMock.fn((options) => mockCacheManagerFactory(options)),
  };
});

jest.mock('../../../src/anatomy/cache/AnatomyQueryCache.js', () => {
  const { jest: jestMock } = require('@jest/globals');
  return {
    AnatomyQueryCache: jestMock.fn((options) => mockQueryCacheFactory(options)),
  };
});

jest.mock('../../../src/anatomy/anatomyGraphAlgorithms.js', () => {
  const { jest: jestMock } = require('@jest/globals');
  return {
    AnatomyGraphAlgorithms: {
      getSubgraph: jestMock.fn(),
      getAnatomyRoot: jestMock.fn(),
      getPath: jestMock.fn(),
      getAllParts: jestMock.fn(),
      findPartsByType: jestMock.fn(),
    },
  };
});

const setup = () => {
  const cacheManager = {
    hasCacheForRoot: jest.fn(),
    buildCache: jest.fn(),
    invalidateCacheForRoot: jest.fn(),
    has: jest.fn(),
    get: jest.fn(),
    size: jest.fn(),
    validateCache: jest.fn(),
  };
  const queryCache = {
    getCachedFindPartsByType: jest.fn(),
    cacheFindPartsByType: jest.fn(),
    getCachedGetAllParts: jest.fn(),
    cacheGetAllParts: jest.fn(),
    invalidateRoot: jest.fn(),
  };
  const entityManager = {
    getComponentData: jest.fn(),
    removeComponent: jest.fn(),
  };
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const eventDispatcher = { dispatch: jest.fn() };

  mockCacheManagerFactory.mockReturnValue(cacheManager);
  mockQueryCacheFactory.mockReturnValue(queryCache);

  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
  });

  return { service, cacheManager, queryCache, entityManager, logger };
};

describe('BodyGraphService cache interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefers actor cache roots and reuses cached getAllParts results', () => {
    const { service, cacheManager, queryCache, entityManager } = setup();

    cacheManager.size.mockReturnValue(2);
    cacheManager.has.mockImplementation((id) => id === 'actor-1');
    queryCache.getCachedGetAllParts.mockReturnValueOnce(undefined);
    AnatomyGraphAlgorithms.getAllParts.mockReturnValueOnce([
      'actor-1',
      'arm-1',
    ]);

    const firstResult = service.getAllParts({ body: { root: 'blueprint-1' } }, 'actor-1');

    expect(firstResult).toEqual(['actor-1', 'arm-1']);
    expect(AnatomyGraphAlgorithms.getAllParts).toHaveBeenCalledWith(
      'actor-1',
      cacheManager,
      entityManager
    );
    expect(queryCache.cacheGetAllParts).toHaveBeenCalledWith('actor-1', [
      'actor-1',
      'arm-1',
    ]);

    AnatomyGraphAlgorithms.getAllParts.mockClear();
    queryCache.cacheGetAllParts.mockClear();
    queryCache.getCachedGetAllParts.mockReturnValueOnce(['cached-actor']);

    const secondResult = service.getAllParts({ body: { root: 'blueprint-1' } }, 'actor-1');

    expect(secondResult).toEqual(['cached-actor']);
    expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
    expect(queryCache.cacheGetAllParts).not.toHaveBeenCalled();
  });

  it('caches findPartsByType responses per root and component type', () => {
    const { service, cacheManager, queryCache } = setup();

    queryCache.getCachedFindPartsByType
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(['cached-part']);
    AnatomyGraphAlgorithms.findPartsByType.mockReturnValueOnce(['fresh-part']);

    const first = service.findPartsByType('root-3', 'hand');
    const second = service.findPartsByType('root-3', 'hand');

    expect(first).toEqual(['fresh-part']);
    expect(second).toEqual(['cached-part']);
    expect(AnatomyGraphAlgorithms.findPartsByType).toHaveBeenCalledTimes(1);
    expect(AnatomyGraphAlgorithms.findPartsByType).toHaveBeenCalledWith(
      'root-3',
      'hand',
      cacheManager
    );
    expect(queryCache.cacheFindPartsByType).toHaveBeenCalledWith('root-3', 'hand', [
      'fresh-part',
    ]);
  });

  it('treats missing component data as no-match when checking nested values', () => {
    const { service, entityManager } = setup();

    jest.spyOn(service, 'getAllParts').mockReturnValue(['node-1']);
    entityManager.getComponentData.mockReturnValue(null);

    const result = service.hasPartWithComponentValue(
      { body: { root: 'root-1' } },
      'component:test',
      'stats.health',
      10
    );

    expect(result).toEqual({ found: false });
    expect(entityManager.getComponentData).toHaveBeenCalledWith('node-1', 'component:test');
  });

  it('walks ancestor relationships using cached parent nodes', () => {
    const { service, cacheManager } = setup();

    const relationships = {
      'finger-1': { parentId: 'hand-1' },
      'hand-1': { parentId: 'arm-1' },
      'arm-1': { parentId: 'torso-1' },
      'torso-1': { parentId: null },
    };
    cacheManager.get.mockImplementation((id) => relationships[id] || null);

    const ancestors = service.getAncestors('finger-1');

    expect(ancestors).toEqual(['hand-1', 'arm-1', 'torso-1']);
    expect(cacheManager.get).toHaveBeenCalledTimes(4);
  });
});
