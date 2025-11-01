/**
 * @file Unit tests for ActivityIndexManager
 * @description Tests index building, signature generation, cache key construction, and caching logic
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ActivityIndexManager from '../../../../src/anatomy/services/activityIndexManager.js';

describe('ActivityIndexManager', () => {
  let indexManager;
  let mockCacheManager;
  let mockLogger;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    // Create mock cache manager
    mockCacheManager = {
      get: jest.fn(() => undefined),
      set: jest.fn(),
    };

    indexManager = new ActivityIndexManager({
      cacheManager: mockCacheManager,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should require cacheManager with get/set methods', () => {
      expect(
        () =>
          new ActivityIndexManager({
            cacheManager: {},
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should require logger with standard methods', () => {
      expect(
        () =>
          new ActivityIndexManager({
            cacheManager: mockCacheManager,
            logger: {},
          })
      ).toThrow();
    });

    it('should create instance with valid dependencies', () => {
      const instance = new ActivityIndexManager({
        cacheManager: mockCacheManager,
        logger: mockLogger,
      });
      expect(instance).toBeInstanceOf(ActivityIndexManager);
    });
  });

  describe('buildActivityIndex', () => {
    it('should return empty index for empty array', () => {
      const result = indexManager.buildActivityIndex([]);

      expect(result).toEqual({
        byTarget: new Map(),
        byPriority: [],
        byGroupKey: new Map(),
        all: [],
      });
    });

    it('should return empty index for null input', () => {
      const result = indexManager.buildActivityIndex(null);

      expect(result.byTarget).toBeInstanceOf(Map);
      expect(result.byTarget.size).toBe(0);
      expect(result.byPriority).toEqual([]);
      expect(result.byGroupKey).toBeInstanceOf(Map);
      expect(result.all).toEqual([]);
    });

    it('should index single activity by target', () => {
      const activities = [
        { targetId: 'actor1', priority: 10, type: 'combat' },
      ];

      const result = indexManager.buildActivityIndex(activities);

      expect(result.byTarget.get('actor1')).toEqual(activities);
      expect(result.byTarget.size).toBe(1);
    });

    it('should index multiple activities by different targets', () => {
      const activities = [
        { targetId: 'actor1', priority: 10, type: 'combat' },
        { targetId: 'actor2', priority: 5, type: 'social' },
      ];

      const result = indexManager.buildActivityIndex(activities);

      expect(result.byTarget.get('actor1')).toEqual([activities[0]]);
      expect(result.byTarget.get('actor2')).toEqual([activities[1]]);
      expect(result.byTarget.size).toBe(2);
    });

    it('should group activities with same target', () => {
      const activities = [
        { targetId: 'actor1', priority: 10, type: 'combat' },
        { targetId: 'actor1', priority: 5, type: 'movement' },
      ];

      const result = indexManager.buildActivityIndex(activities);

      expect(result.byTarget.get('actor1')).toEqual(activities);
      expect(result.byTarget.size).toBe(1);
    });

    it('should use targetEntityId when targetId is missing', () => {
      const activities = [
        { targetEntityId: 'entity1', priority: 10, type: 'combat' },
      ];

      const result = indexManager.buildActivityIndex(activities);

      expect(result.byTarget.get('entity1')).toEqual(activities);
    });

    it('should default to "solo" when both targetId and targetEntityId are missing', () => {
      const activities = [{ priority: 10, type: 'self' }];

      const result = indexManager.buildActivityIndex(activities);

      expect(result.byTarget.get('solo')).toEqual(activities);
    });

    it('should sort activities by priority descending', () => {
      const activities = [
        { targetId: 'actor1', priority: 5, type: 'low' },
        { targetId: 'actor2', priority: 15, type: 'high' },
        { targetId: 'actor3', priority: 10, type: 'medium' },
      ];

      const result = indexManager.buildActivityIndex(activities);

      expect(result.byPriority).toEqual([
        activities[1], // priority 15
        activities[2], // priority 10
        activities[0], // priority 5
      ]);
    });

    it('should handle activities without priority field', () => {
      const activities = [
        { targetId: 'actor1', type: 'no-priority' },
        { targetId: 'actor2', priority: 10, type: 'has-priority' },
      ];

      const result = indexManager.buildActivityIndex(activities);

      // Activity with priority should come first
      expect(result.byPriority[0]).toBe(activities[1]);
      expect(result.byPriority[1]).toBe(activities[0]);
    });

    it('should handle non-numeric priority values', () => {
      const activities = [
        { targetId: 'actor1', priority: 'invalid', type: 'invalid-priority' },
        { targetId: 'actor2', priority: 10, type: 'valid-priority' },
      ];

      const result = indexManager.buildActivityIndex(activities);

      // Activity with valid priority should come first
      expect(result.byPriority[0]).toBe(activities[1]);
    });

    it('should index activities by groupKey', () => {
      const activities = [
        {
          targetId: 'actor1',
          priority: 10,
          grouping: { groupKey: 'combat' },
        },
      ];

      const result = indexManager.buildActivityIndex(activities);

      expect(result.byGroupKey.get('combat')).toEqual(activities);
      expect(result.byGroupKey.size).toBe(1);
    });

    it('should group activities with same groupKey', () => {
      const activities = [
        {
          targetId: 'actor1',
          priority: 10,
          grouping: { groupKey: 'combat' },
        },
        {
          targetId: 'actor2',
          priority: 5,
          grouping: { groupKey: 'combat' },
        },
      ];

      const result = indexManager.buildActivityIndex(activities);

      expect(result.byGroupKey.get('combat')).toEqual(activities);
      expect(result.byGroupKey.size).toBe(1);
    });

    it('should handle activities without groupKey', () => {
      const activities = [
        { targetId: 'actor1', priority: 10, type: 'no-group' },
      ];

      const result = indexManager.buildActivityIndex(activities);

      expect(result.byGroupKey.size).toBe(0);
    });

    it('should handle mixed activities with and without groupKey', () => {
      const activities = [
        {
          targetId: 'actor1',
          priority: 10,
          grouping: { groupKey: 'combat' },
        },
        { targetId: 'actor2', priority: 5, type: 'no-group' },
      ];

      const result = indexManager.buildActivityIndex(activities);

      expect(result.byGroupKey.get('combat')).toEqual([activities[0]]);
      expect(result.byGroupKey.size).toBe(1);
    });

    it('should store all activities in the all property', () => {
      const activities = [
        { targetId: 'actor1', priority: 10, type: 'combat' },
        { targetId: 'actor2', priority: 5, type: 'social' },
      ];

      const result = indexManager.buildActivityIndex(activities);

      expect(result.all).toEqual(activities);
    });
  });

  describe('buildActivitySignature', () => {
    it('should return empty signature string when activities array is empty', () => {
      expect(indexManager.buildActivitySignature([])).toBe('');
    });

    it('should generate signature for single activity', () => {
      const activities = [
        {
          type: 'combat',
          sourceComponent: 'core:attack',
          targetId: 'enemy',
          priority: 10,
        },
      ];

      const signature = indexManager.buildActivitySignature(activities);

      expect(signature).toBe('combat:core:attack:enemy:10');
    });

    it('should generate signature for multiple activities', () => {
      const activities = [
        {
          type: 'combat',
          sourceComponent: 'core:attack',
          targetId: 'enemy',
          priority: 10,
        },
        {
          type: 'social',
          sourceComponent: 'core:talk',
          targetId: 'friend',
          priority: 5,
        },
      ];

      const signature = indexManager.buildActivitySignature(activities);

      expect(signature).toBe('combat:core:attack:enemy:10|social:core:talk:friend:5');
    });

    it('should use descriptionType when sourceComponent is missing', () => {
      const activities = [
        {
          type: 'combat',
          // Explicitly undefined to exercise nullish coalescing fallback branch
          sourceComponent: undefined,
          descriptionType: 'fallback',
          targetId: 'enemy',
          priority: 10,
        },
      ];

      const signature = indexManager.buildActivitySignature(activities);

      expect(signature).toBe('combat:fallback:enemy:10');
    });

    it('should default to "unknown" when both sourceComponent and descriptionType are missing', () => {
      const activities = [
        { type: 'combat', targetId: 'enemy', priority: 10 },
      ];

      const signature = indexManager.buildActivitySignature(activities);

      expect(signature).toBe('combat:unknown:enemy:10');
    });

    it('should use targetEntityId when targetId is missing', () => {
      const activities = [
        {
          type: 'combat',
          sourceComponent: 'core:attack',
          targetEntityId: 'entity1',
          priority: 10,
        },
      ];

      const signature = indexManager.buildActivitySignature(activities);

      expect(signature).toBe('combat:core:attack:entity1:10');
    });

    it('should default to "solo" when both targetId and targetEntityId are missing', () => {
      const activities = [
        { type: 'self', sourceComponent: 'core:reflect', priority: 10 },
      ];

      const signature = indexManager.buildActivitySignature(activities);

      expect(signature).toBe('self:core:reflect:solo:10');
    });

    it('should default to priority 50 when priority is missing', () => {
      const activities = [
        { type: 'combat', sourceComponent: 'core:attack', targetId: 'enemy' },
      ];

      const signature = indexManager.buildActivitySignature(activities);

      expect(signature).toBe('combat:core:attack:enemy:50');
    });

    it('should default to type "generic" when type is missing', () => {
      const activities = [
        { sourceComponent: 'core:generic', targetId: 'target', priority: 10 },
      ];

      const signature = indexManager.buildActivitySignature(activities);

      expect(signature).toBe('generic:core:generic:target:10');
    });

    it('should handle nullish activity entries by falling back to safe defaults', () => {
      const activities = [null, undefined];

      const signature = indexManager.buildActivitySignature(activities);

      expect(signature).toBe('generic:unknown:solo:50|generic:unknown:solo:50');
    });

    it('should generate deterministic signature for same activities', () => {
      const activities = [
        {
          type: 'combat',
          sourceComponent: 'core:attack',
          targetId: 'enemy',
          priority: 10,
        },
      ];

      const signature1 = indexManager.buildActivitySignature(activities);
      const signature2 = indexManager.buildActivitySignature([...activities]);

      expect(signature1).toBe(signature2);
    });

    it('should generate different signatures for different activities', () => {
      const activities1 = [
        {
          type: 'combat',
          sourceComponent: 'core:attack',
          targetId: 'enemy',
          priority: 10,
        },
      ];
      const activities2 = [
        {
          type: 'combat',
          sourceComponent: 'core:attack',
          targetId: 'enemy',
          priority: 5, // Different priority
        },
      ];

      const signature1 = indexManager.buildActivitySignature(activities1);
      const signature2 = indexManager.buildActivitySignature(activities2);

      expect(signature1).not.toBe(signature2);
    });
  });

  describe('buildActivityIndexCacheKey', () => {
    it('should build cache key with namespace and entityId', () => {
      const cacheKey = indexManager.buildActivityIndexCacheKey(
        'entity_activities',
        'actor123'
      );

      expect(cacheKey).toBe('entity_activities:actor123');
    });

    it('should default to "unknown" when entityId is null', () => {
      const cacheKey = indexManager.buildActivityIndexCacheKey(
        'entity_activities',
        null
      );

      expect(cacheKey).toBe('entity_activities:unknown');
    });

    it('should default to "unknown" when entityId is undefined', () => {
      const cacheKey = indexManager.buildActivityIndexCacheKey(
        'entity_activities',
        undefined
      );

      expect(cacheKey).toBe('entity_activities:unknown');
    });

    it('should handle empty string entityId', () => {
      const cacheKey = indexManager.buildActivityIndexCacheKey(
        'entity_activities',
        ''
      );

      expect(cacheKey).toBe('entity_activities:');
    });

    it('should handle numeric entityId', () => {
      const cacheKey = indexManager.buildActivityIndexCacheKey(
        'entity_activities',
        123
      );

      expect(cacheKey).toBe('entity_activities:123');
    });
  });

  describe('getActivityIndex', () => {
    it('should return empty index for non-array input even when cache key is provided', () => {
      const getCacheSpy = jest.spyOn(mockCacheManager, 'get');
      const setCacheSpy = jest.spyOn(mockCacheManager, 'set');

      const result = indexManager.getActivityIndex(null, 'cache-key');

      expect(result).toEqual({
        byTarget: new Map(),
        byPriority: [],
        byGroupKey: new Map(),
        all: [],
      });
      expect(getCacheSpy).not.toHaveBeenCalled();
      expect(setCacheSpy).not.toHaveBeenCalled();
    });

    it('should return empty index for empty array', () => {
      const result = indexManager.getActivityIndex([], 'cache-key');

      expect(result).toEqual({
        byTarget: new Map(),
        byPriority: [],
        byGroupKey: new Map(),
        all: [],
      });
    });

    it('should build index without caching when cacheKey is null', () => {
      const getCacheSpy = jest.spyOn(mockCacheManager, 'get');
      const setCacheSpy = jest.spyOn(mockCacheManager, 'set');

      const activities = [{ targetId: 'actor1', priority: 10, type: 'combat' }];
      const result = indexManager.getActivityIndex(activities, null);

      expect(result.byTarget.get('actor1')).toEqual(activities);
      expect(getCacheSpy).not.toHaveBeenCalled();
      expect(setCacheSpy).not.toHaveBeenCalled();
    });

    it('should build index without caching when cacheKey is undefined', () => {
      const getCacheSpy = jest.spyOn(mockCacheManager, 'get');
      const setCacheSpy = jest.spyOn(mockCacheManager, 'set');

      const activities = [{ targetId: 'actor1', priority: 10, type: 'combat' }];
      const result = indexManager.getActivityIndex(activities);

      expect(result.byTarget.get('actor1')).toEqual(activities);
      expect(getCacheSpy).not.toHaveBeenCalled();
      expect(setCacheSpy).not.toHaveBeenCalled();
    });

    it('should cache index when cacheKey is provided', () => {
      const setCacheSpy = jest.spyOn(mockCacheManager, 'set');

      const activities = [{ targetId: 'actor1', priority: 10, type: 'combat' }];
      const cacheKey = 'test-cache-key';

      indexManager.getActivityIndex(activities, cacheKey);

      expect(setCacheSpy).toHaveBeenCalledWith('activityIndex', cacheKey, {
        signature: expect.any(String),
        index: expect.any(Object),
      });
    });

    it('should return cached index when signature matches', () => {
      const activities = [{ targetId: 'actor1', priority: 10, type: 'combat' }];
      const cacheKey = 'test-cache-key';
      const signature = indexManager.buildActivitySignature(activities);
      const cachedIndex = indexManager.buildActivityIndex(activities);

      mockCacheManager.get = jest.fn(() => ({
        signature,
        index: cachedIndex,
      }));

      const result = indexManager.getActivityIndex(activities, cacheKey);

      expect(result).toBe(cachedIndex);
      expect(mockCacheManager.get).toHaveBeenCalledWith('activityIndex', cacheKey);
    });

    it('should rebuild index when cached signature does not match', () => {
      const activities = [{ targetId: 'actor1', priority: 10, type: 'combat' }];
      const cacheKey = 'test-cache-key';

      mockCacheManager.get = jest.fn(() => ({
        signature: 'old-signature',
        index: { byTarget: new Map(), byPriority: [], byGroupKey: new Map(), all: [] },
      }));
      const setCacheSpy = jest.spyOn(mockCacheManager, 'set');

      const result = indexManager.getActivityIndex(activities, cacheKey);

      // Should rebuild and cache new index
      expect(result.byTarget.get('actor1')).toEqual(activities);
      expect(setCacheSpy).toHaveBeenCalledWith('activityIndex', cacheKey, {
        signature: expect.any(String),
        index: expect.any(Object),
      });
    });

    it('should rebuild index when cache is empty', () => {
      const activities = [{ targetId: 'actor1', priority: 10, type: 'combat' }];
      const cacheKey = 'test-cache-key';

      mockCacheManager.get = jest.fn(() => undefined);
      const setCacheSpy = jest.spyOn(mockCacheManager, 'set');

      const result = indexManager.getActivityIndex(activities, cacheKey);

      expect(result.byTarget.get('actor1')).toEqual(activities);
      expect(setCacheSpy).toHaveBeenCalledWith('activityIndex', cacheKey, {
        signature: expect.any(String),
        index: expect.any(Object),
      });
    });

    it('should cache both index and signature together', () => {
      const activities = [{ targetId: 'actor1', priority: 10, type: 'combat' }];
      const cacheKey = 'test-cache-key';
      const setCacheSpy = jest.spyOn(mockCacheManager, 'set');

      indexManager.getActivityIndex(activities, cacheKey);

      const [, , cachedValue] = setCacheSpy.mock.calls[0];
      expect(cachedValue).toHaveProperty('signature');
      expect(cachedValue).toHaveProperty('index');
      expect(cachedValue.index.byTarget.get('actor1')).toEqual(activities);
    });
  });

  describe('buildIndex', () => {
    it('should delegate to getActivityIndex for backward compatibility', () => {
      const activities = [{ targetId: 'actor1', priority: 10, type: 'combat' }];
      const cacheKey = 'legacy-key';
      const getIndexSpy = jest.spyOn(indexManager, 'getActivityIndex');

      indexManager.buildIndex(activities, cacheKey);

      expect(getIndexSpy).toHaveBeenCalledWith(activities, cacheKey);
    });

    it('should use default cache key when not provided', () => {
      const activities = [{ targetId: 'actor1', priority: 10, type: 'combat' }];
      const getIndexSpy = jest.spyOn(indexManager, 'getActivityIndex');

      indexManager.buildIndex(activities);

      expect(getIndexSpy).toHaveBeenCalledWith(activities, null);
    });
  });
});
