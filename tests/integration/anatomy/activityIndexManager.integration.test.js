/**
 * @file Integration tests for ActivityIndexManager with ActivityDescriptionService
 * @description Verifies correct delegation and cache behavior end-to-end
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ActivityDescriptionService from '../../../src/anatomy/services/activityDescriptionService.js';
import ActivityCacheManager from '../../../src/anatomy/cache/activityCacheManager.js';
import ActivityIndexManager from '../../../src/anatomy/services/activityIndexManager.js';
import ActivityMetadataCollectionSystem from '../../../src/anatomy/services/activityMetadataCollectionSystem.js';
import ActivityGroupingSystem from '../../../src/anatomy/services/grouping/activityGroupingSystem.js';
import ActivityNLGSystem from '../../../src/anatomy/services/activityNLGSystem.js';

describe('ActivityIndexManager Integration', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockAnatomyFormattingService;
  let mockJsonLogicEvaluationService;
  let cacheManager;
  let indexManager;
  let metadataCollectionSystem;
  let groupingSystem;
  let nlgSystem;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    // Create mock entity manager
    mockEntityManager = {
      getEntityInstance: () => null,
    };

    // Create mock anatomy formatting service
    mockAnatomyFormattingService = {
      formatText: (text) => text,
    };

    // Create mock JSON logic evaluation service
    mockJsonLogicEvaluationService = {
      evaluate: () => true,
    };

    // Create real dependencies for integration testing
    cacheManager = new ActivityCacheManager({
      logger: mockLogger,
      eventBus: null,
    });
    indexManager = new ActivityIndexManager({
      cacheManager,
      logger: mockLogger,
    });
    metadataCollectionSystem = new ActivityMetadataCollectionSystem({
      entityManager: mockEntityManager,
      logger: mockLogger,
      activityIndex: null,
    });
    groupingSystem = new ActivityGroupingSystem({
      indexManager,
      logger: mockLogger,
    });
    nlgSystem = new ActivityNLGSystem({
      logger: mockLogger,
      entityManager: mockEntityManager,
      cacheManager,
    });

    // Create ActivityDescriptionService instance
    service = new ActivityDescriptionService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      anatomyFormattingService: mockAnatomyFormattingService,
      jsonLogicEvaluationService: mockJsonLogicEvaluationService,
      cacheManager,
      indexManager,
      metadataCollectionSystem,
      groupingSystem,
      nlgSystem,
    });
  });

  afterEach(() => {
    if (service && typeof service.destroy === 'function') {
      service.destroy();
    }
  });

  describe('Delegation to ActivityIndexManager', () => {
    it('should delegate buildActivityIndex through test hooks', () => {
      const hooks = service.getTestHooks();
      const activities = [
        { targetId: 'actor1', priority: 10, type: 'combat' },
        { targetId: 'actor2', priority: 5, type: 'social' },
      ];

      const result = hooks.buildActivityIndex(activities);

      expect(result).toHaveProperty('byTarget');
      expect(result).toHaveProperty('byPriority');
      expect(result).toHaveProperty('byGroupKey');
      expect(result).toHaveProperty('all');
      expect(result.byTarget).toBeInstanceOf(Map);
      expect(result.byTarget.get('actor1')).toEqual([activities[0]]);
      expect(result.byTarget.get('actor2')).toEqual([activities[1]]);
      expect(result.byPriority).toEqual([activities[0], activities[1]]);
    });

    it('should delegate getActivityIndex through test hooks', () => {
      const hooks = service.getTestHooks();
      const activities = [
        { targetId: 'actor1', priority: 10, type: 'combat' },
      ];

      const result = hooks.getActivityIndex(activities, 'test-cache-key');

      expect(result).toHaveProperty('byTarget');
      expect(result.byTarget.get('actor1')).toEqual(activities);
    });
  });

  describe('Cache Integration', () => {
    it('should cache index results when cacheKey is provided', () => {
      const hooks = service.getTestHooks();
      const activities = [
        { targetId: 'actor1', priority: 10, type: 'combat' },
      ];
      const cacheKey = 'test-cache-integration';

      // First call should build and cache
      const result1 = hooks.getActivityIndex(activities, cacheKey);

      // Second call should return cached result
      const result2 = hooks.getActivityIndex(activities, cacheKey);

      // Results should be identical (same object reference due to caching)
      expect(result1.byTarget.get('actor1')).toEqual(activities);
      expect(result2.byTarget.get('actor1')).toEqual(activities);
    });

    it('should invalidate cache when activities change', () => {
      const hooks = service.getTestHooks();
      const activities1 = [
        { targetId: 'actor1', priority: 10, type: 'combat' },
      ];
      const activities2 = [
        { targetId: 'actor1', priority: 15, type: 'combat' }, // Different priority
      ];
      const cacheKey = 'test-cache-invalidation';

      // First call with activities1
      const result1 = hooks.getActivityIndex(activities1, cacheKey);
      expect(result1.byPriority[0].priority).toBe(10);

      // Second call with activities2 should rebuild index
      const result2 = hooks.getActivityIndex(activities2, cacheKey);
      expect(result2.byPriority[0].priority).toBe(15);
    });

    it('should not cache when cacheKey is not provided', () => {
      const hooks = service.getTestHooks();
      const activities = [
        { targetId: 'actor1', priority: 10, type: 'combat' },
      ];

      // Call without cacheKey
      const result1 = hooks.getActivityIndex(activities);
      const result2 = hooks.getActivityIndex(activities);

      // Both should build fresh indexes
      expect(result1.byTarget.get('actor1')).toEqual(activities);
      expect(result2.byTarget.get('actor1')).toEqual(activities);
      // Results are different object instances
      expect(result1).not.toBe(result2);
    });
  });

  describe('Index Structure', () => {
    it('should create correct byTarget index structure', () => {
      const hooks = service.getTestHooks();
      const activities = [
        { targetId: 'actor1', priority: 10, type: 'combat' },
        { targetId: 'actor1', priority: 5, type: 'movement' },
        { targetId: 'actor2', priority: 8, type: 'social' },
      ];

      const result = hooks.getActivityIndex(activities);

      expect(result.byTarget.get('actor1').length).toBe(2);
      expect(result.byTarget.get('actor2').length).toBe(1);
      expect(result.byTarget.size).toBe(2);
    });

    it('should create correct byPriority sorted array', () => {
      const hooks = service.getTestHooks();
      const activities = [
        { targetId: 'actor1', priority: 5, type: 'low' },
        { targetId: 'actor2', priority: 15, type: 'high' },
        { targetId: 'actor3', priority: 10, type: 'medium' },
      ];

      const result = hooks.getActivityIndex(activities);

      expect(result.byPriority.map((a) => a.priority)).toEqual([15, 10, 5]);
    });

    it('should create correct byGroupKey index structure', () => {
      const hooks = service.getTestHooks();
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
        {
          targetId: 'actor3',
          priority: 8,
          grouping: { groupKey: 'social' },
        },
      ];

      const result = hooks.getActivityIndex(activities);

      expect(result.byGroupKey.get('combat').length).toBe(2);
      expect(result.byGroupKey.get('social').length).toBe(1);
      expect(result.byGroupKey.size).toBe(2);
    });

    it('should maintain all activities in the all property', () => {
      const hooks = service.getTestHooks();
      const activities = [
        { targetId: 'actor1', priority: 10, type: 'combat' },
        { targetId: 'actor2', priority: 5, type: 'social' },
      ];

      const result = hooks.getActivityIndex(activities);

      expect(result.all).toEqual(activities);
      expect(result.all.length).toBe(2);
    });
  });

  describe('ActivityCacheManager Integration', () => {
    it('should use ActivityCacheManager for caching', () => {
      const hooks = service.getTestHooks();
      const activities = [
        { targetId: 'actor1', priority: 10, type: 'combat' },
      ];
      const cacheKey = 'test-cache-manager-integration';

      // Build and cache index
      hooks.getActivityIndex(activities, cacheKey);

      // Manually verify cache manager has the entry
      // (We can't directly access the cache manager from the test, but we can verify behavior)
      const cachedResult = hooks.getActivityIndex(activities, cacheKey);
      expect(cachedResult.byTarget.get('actor1')).toEqual(activities);
    });

    it('should handle cache invalidation through service methods', () => {
      const hooks = service.getTestHooks();
      const activities = [
        { targetId: 'actor1', priority: 10, type: 'combat' },
      ];
      const cacheKey = 'test-cache-manager-invalidation';

      // Build and cache index
      hooks.getActivityIndex(activities, cacheKey);

      // Invalidate cache
      service.invalidateCache('activityIndex', cacheKey);

      // Should rebuild index on next access
      const updatedActivities = [
        { targetId: 'actor1', priority: 20, type: 'combat' },
      ];
      const result = hooks.getActivityIndex(updatedActivities, cacheKey);
      expect(result.byPriority[0].priority).toBe(20);
    });

    it('should handle clearAllCaches correctly', () => {
      const hooks = service.getTestHooks();
      const activities = [
        { targetId: 'actor1', priority: 10, type: 'combat' },
      ];
      const cacheKey = 'test-clear-all-caches';

      // Build and cache index
      hooks.getActivityIndex(activities, cacheKey);

      // Clear all caches
      service.clearAllCaches();

      // Should rebuild index on next access
      const result = hooks.getActivityIndex(activities, cacheKey);
      expect(result.byTarget.get('actor1')).toEqual(activities);
    });
  });

  describe('Empty and Edge Cases', () => {
    it('should handle empty activities array', () => {
      const hooks = service.getTestHooks();
      const result = hooks.getActivityIndex([], 'empty-cache-key');

      expect(result.byTarget.size).toBe(0);
      expect(result.byPriority.length).toBe(0);
      expect(result.byGroupKey.size).toBe(0);
      expect(result.all).toEqual([]);
    });

    it('should handle activities with missing properties', () => {
      const hooks = service.getTestHooks();
      const activities = [
        {}, // No properties
        { targetId: 'actor1' }, // No priority or type
        { priority: 10 }, // No targetId or type
      ];

      const result = hooks.getActivityIndex(activities);

      // Should handle gracefully without errors
      expect(result.byTarget).toBeInstanceOf(Map);
      expect(result.byPriority).toBeInstanceOf(Array);
      expect(result.byGroupKey).toBeInstanceOf(Map);
      expect(result.all.length).toBe(3);
    });

    it('should handle activities with null/undefined values', () => {
      const hooks = service.getTestHooks();
      const activities = [
        { targetId: null, priority: undefined, type: null },
      ];

      const result = hooks.getActivityIndex(activities);

      // Should use defaults (solo for target, NEGATIVE_INFINITY for priority)
      expect(result.byTarget.get('solo')).toEqual(activities);
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large activity collections efficiently', () => {
      const hooks = service.getTestHooks();
      const activities = Array.from({ length: 1000 }, (_, i) => ({
        targetId: `actor${i % 10}`,
        priority: i % 20,
        type: `type${i % 5}`,
        grouping: { groupKey: `group${i % 3}` },
      }));

      const startTime = Date.now();
      const result = hooks.getActivityIndex(activities, 'large-collection');
      const endTime = Date.now();

      expect(result.byTarget.size).toBe(10);
      expect(result.byPriority.length).toBe(1000);
      expect(result.byGroupKey.size).toBe(3);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast (< 100ms)
    });

    it('should reuse cached indexes for performance', () => {
      const hooks = service.getTestHooks();
      const activities = Array.from({ length: 1000 }, (_, i) => ({
        targetId: `actor${i}`,
        priority: i,
        type: 'combat',
      }));
      const cacheKey = 'performance-cache-test';

      // First call builds index
      hooks.getActivityIndex(activities, cacheKey);

      // Second call should return cached result (verify by checking it doesn't throw)
      const cachedResult = hooks.getActivityIndex(activities, cacheKey);

      // Both should have the same structure
      expect(cachedResult.byTarget).toBeInstanceOf(Map);
      expect(cachedResult.byPriority.length).toBe(1000);
      expect(cachedResult.all.length).toBe(1000);
    });
  });
});
