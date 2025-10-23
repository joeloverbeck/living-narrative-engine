import { beforeEach, describe, expect, it, jest } from '@jest/globals';

let mockCacheInstance;
let mockQueryCacheInstance;

const createCacheMock = () => ({
  hasCacheForRoot: jest.fn(),
  buildCache: jest.fn(),
  invalidateCacheForRoot: jest.fn(),
  has: jest.fn().mockReturnValue(false),
  size: jest.fn().mockReturnValue(0),
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
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';

describe('BodyGraphService missing root fallback scenarios', () => {
  let entityManager;
  let logger;
  let eventDispatcher;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCacheInstance = createCacheMock();
    mockQueryCacheInstance = createQueryCacheMock();

    AnatomyCacheManager.mockImplementation(() => mockCacheInstance);
    AnatomyQueryCache.mockImplementation(() => mockQueryCacheInstance);

    entityManager = { getComponentData: jest.fn() };
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    eventDispatcher = { dispatch: jest.fn() };
  });

  it('returns an empty array when the body component lacks root identifiers', () => {
    const service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });

    const bodyComponent = { body: { metadata: { version: 1 } } };

    const result = service.getAllParts(bodyComponent, 'actor-42');

    expect(result).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      'BodyGraphService.getAllParts: No root ID found in bodyComponent',
    );
    expect(AnatomyGraphAlgorithms.getAllParts).not.toHaveBeenCalled();
    expect(mockQueryCacheInstance.getCachedGetAllParts).not.toHaveBeenCalled();
  });

  it('logs truncated output when more than five parts are discovered', () => {
    const service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });

    const bodyComponent = { body: { root: 'blueprint-root' } };
    const parts = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    AnatomyGraphAlgorithms.getAllParts.mockReturnValue(parts);

    const result = service.getAllParts(bodyComponent, 'actor-1');

    expect(result).toEqual(parts);
    const logCall = logger.debug.mock.calls.find(([message]) =>
      message.startsWith(
        "BodyGraphService: AnatomyGraphAlgorithms.getAllParts returned",
      ),
    );
    expect(logCall).toBeDefined();
    expect(logCall?.[0]).toContain('...');
    expect(mockQueryCacheInstance.cacheGetAllParts).toHaveBeenCalledWith(
      'blueprint-root',
      parts,
    );
  });

  it('ignores null component data when checking for a component value', () => {
    const service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });
    const getAllPartsSpy = jest
      .spyOn(service, 'getAllParts')
      .mockReturnValue(['part-1']);
    entityManager.getComponentData.mockReturnValueOnce(null);

    const outcome = service.hasPartWithComponentValue(
      { body: { root: 'unused' } },
      'component:test',
      'attributes.status',
      'ready',
    );

    expect(outcome).toEqual({ found: false });
    expect(entityManager.getComponentData).toHaveBeenCalledWith(
      'part-1',
      'component:test',
    );
    expect(getAllPartsSpy).toHaveBeenCalled();
  });

  it('normalises missing recipe identifiers to null in getAnatomyData', async () => {
    const service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });
    entityManager.getComponentData.mockResolvedValueOnce({});

    const metadata = await service.getAnatomyData('entity-17');

    expect(metadata).toEqual({ recipeId: null, rootEntityId: 'entity-17' });
    expect(logger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('has no anatomy:body component'),
    );
  });
});
