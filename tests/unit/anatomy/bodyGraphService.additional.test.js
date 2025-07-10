import { describe, it, expect, beforeEach } from '@jest/globals';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import {
  createMockLogger,
  createMockSafeEventDispatcher,
} from '../../common/mockFactories/index.js';

/**
 * Additional coverage tests for BodyGraphService focusing on helper
 * methods like getAllParts, hasPartWithComponent and
 * hasPartWithComponentValue.
 */
describe('BodyGraphService additional methods', () => {
  let service;
  let entityManager;
  let logger;
  let dispatcher;

  beforeEach(() => {
    const entities = [
      {
        id: 'torso',
        components: {
          'anatomy:part': { subType: 'torso' },
          'anatomy:sockets': { sockets: [{ id: 'arm_socket' }] },
        },
      },
      {
        id: 'arm',
        components: {
          'anatomy:part': { subType: 'arm' },
          'anatomy:joint': {
            parentId: 'torso',
            socketId: 'arm_socket',
            breakThreshold: 5,
          },
          'custom:flag': { locked: true },
        },
      },
      {
        id: 'hand',
        components: {
          'anatomy:part': { subType: 'hand' },
          'anatomy:joint': { parentId: 'arm', socketId: 'hand_socket' },
        },
      },
    ];

    entityManager = new SimpleEntityManager(entities);
    logger = createMockLogger();
    dispatcher = createMockSafeEventDispatcher();
    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
    });

    service.buildAdjacencyCache('torso');
  });

  it('getAllParts should return all parts using the adjacency cache', () => {
    const bodyComponent = { root: 'torso' };
    const parts = service.getAllParts(bodyComponent);
    expect(parts).toEqual(expect.arrayContaining(['torso', 'arm', 'hand']));
  });

  it('hasPartWithComponent detects presence of a component', () => {
    const bodyComponent = { root: 'torso' };
    expect(service.hasPartWithComponent(bodyComponent, 'custom:flag')).toBe(
      true
    );
    expect(service.hasPartWithComponent(bodyComponent, 'missing:comp')).toBe(
      false
    );
  });

  it('hasPartWithComponentValue matches nested properties correctly', () => {
    const bodyComponent = { root: 'torso' };
    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'custom:flag',
        'locked',
        true
      )
    ).toEqual({ found: true, partId: 'arm' });
    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'custom:flag',
        'locked',
        false
      )
    ).toEqual({ found: false });
  });

  it('getAllParts falls back to entity manager when cache is empty', () => {
    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
    });
    const bodyComponent = { root: 'torso' };
    const parts = service.getAllParts(bodyComponent);
    expect(parts).toEqual(expect.arrayContaining(['torso', 'arm', 'hand']));
  });

  it('throws when detaching a part without a joint', async () => {
    await expect(service.detachPart('torso')).rejects.toThrow();
  });

  it('returns empty array when body component is missing root', () => {
    expect(service.getAllParts({})).toEqual([]);
  });

  it('propagates issues from cache validation', () => {
    const spy = jest
      .spyOn(AnatomyCacheManager.prototype, 'validateCache')
      .mockReturnValue({ valid: false, issues: ['bad'] });
    const result = service.validateCache();
    expect(result).toEqual({ valid: false, issues: ['bad'] });
    spy.mockRestore();
  });
});

describe('BodyGraphService query caching', () => {
  let service;
  let entityManager;
  let logger;
  let dispatcher;
  let mockQueryCache;

  beforeEach(() => {
    entityManager = new SimpleEntityManager([
      {
        id: 'torso',
        components: {
          'anatomy:part': { subType: 'torso' },
        },
      },
      {
        id: 'arm',
        components: {
          'anatomy:part': { subType: 'arm' },
          'anatomy:joint': { parentId: 'torso', socketId: 'arm_socket' },
        },
      },
    ]);
    logger = createMockLogger();
    dispatcher = createMockSafeEventDispatcher();
    mockQueryCache = {
      getCachedFindPartsByType: jest.fn(),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn(),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };

    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
      queryCache: mockQueryCache,
    });
  });

  it('should use cached getAllParts results when available', () => {
    const cachedResult = ['torso-cached', 'arm-cached'];
    mockQueryCache.getCachedGetAllParts.mockReturnValue(cachedResult);

    const bodyComponent = { root: 'torso' };
    const result = service.getAllParts(bodyComponent);

    expect(result).toEqual(cachedResult);
    expect(mockQueryCache.getCachedGetAllParts).toHaveBeenCalledWith('torso');
    expect(mockQueryCache.cacheGetAllParts).not.toHaveBeenCalled();
  });

  it('should cache getAllParts results when not in cache', () => {
    mockQueryCache.getCachedGetAllParts.mockReturnValue(undefined);
    service.buildAdjacencyCache('torso');

    const bodyComponent = { root: 'torso' };
    const result = service.getAllParts(bodyComponent);

    expect(mockQueryCache.cacheGetAllParts).toHaveBeenCalledWith(
      'torso',
      expect.arrayContaining(['torso', 'arm'])
    );
  });

  it('should handle nested body structure with caching', () => {
    mockQueryCache.getCachedGetAllParts.mockReturnValue(undefined);
    service.buildAdjacencyCache('torso');

    const bodyComponent = { body: { root: 'torso' } };
    const result = service.getAllParts(bodyComponent);

    expect(mockQueryCache.cacheGetAllParts).toHaveBeenCalledWith(
      'torso',
      expect.arrayContaining(['torso', 'arm'])
    );
  });
});
