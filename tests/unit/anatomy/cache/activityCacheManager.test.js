/**
 * @file Unit tests for ActivityCacheManager
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ActivityCacheManager from '../../../../src/anatomy/cache/activityCacheManager.js';
import {
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
  COMPONENTS_BATCH_ADDED_ID,
  ENTITY_REMOVED_ID,
} from '../../../../src/constants/eventIds.js';

describe('ActivityCacheManager', () => {
  let cacheManager;
  let mockLogger;
  let mockEventBus;
  let eventHandlers;

  beforeEach(() => {
    jest.useFakeTimers();

    eventHandlers = new Map();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventBus = {
      subscribe: jest.fn((eventId, handler) => {
        eventHandlers.set(eventId, handler);
        return jest.fn(); // Return unsubscribe function
      }),
      dispatch: jest.fn(),
    };

    cacheManager = new ActivityCacheManager({
      logger: mockLogger,
      eventBus: mockEventBus,
    });
  });

  afterEach(() => {
    if (cacheManager) {
      cacheManager.destroy();
    }
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Constructor', () => {
    it('should initialize with logger and eventBus', () => {
      expect(cacheManager).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActivityCacheManager initialized'
      );
    });

    it('should subscribe to 4 invalidation events', () => {
      expect(mockEventBus.subscribe).toHaveBeenCalledTimes(4);
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        COMPONENT_ADDED_ID,
        expect.any(Function)
      );
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        COMPONENT_REMOVED_ID,
        expect.any(Function)
      );
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        COMPONENTS_BATCH_ADDED_ID,
        expect.any(Function)
      );
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        ENTITY_REMOVED_ID,
        expect.any(Function)
      );
    });

    it('should throw error if logger is missing required methods', () => {
      expect(
        () =>
          new ActivityCacheManager({
            logger: { info: jest.fn() }, // Missing required methods
            eventBus: mockEventBus,
          })
      ).toThrow();
    });

    it('should allow optional eventBus for manual cache management', () => {
      const manualCacheManager = new ActivityCacheManager({
        logger: mockLogger,
        eventBus: null,
      });

      expect(manualCacheManager).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActivityCacheManager initialized'
      );
      manualCacheManager.destroy();
    });

    it('should throw error if eventBus is missing required methods when provided', () => {
      expect(
        () =>
          new ActivityCacheManager({
            logger: mockLogger,
            eventBus: { subscribe: jest.fn() }, // Missing dispatch
          })
      ).toThrow(/Invalid or missing method.*dispatch/);
    });
  });

  describe('registerCache', () => {
    it('should register cache with default configuration', () => {
      cacheManager.registerCache('testCache');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Registered cache "testCache" with TTL=60000ms, maxSize=1000'
      );
    });

    it('should register cache with custom TTL and maxSize', () => {
      cacheManager.registerCache('customCache', { ttl: 30000, maxSize: 500 });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Registered cache "customCache" with TTL=30000ms, maxSize=500'
      );
    });

    it('should warn when registering duplicate cache name', () => {
      cacheManager.registerCache('testCache');
      cacheManager.registerCache('testCache');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cache "testCache" already registered, skipping'
      );
    });

    it('should throw error for blank cache name', () => {
      expect(() => cacheManager.registerCache('')).toThrow();
      expect(() => cacheManager.registerCache('   ')).toThrow();
    });
  });

  describe('get/set operations', () => {
    beforeEach(() => {
      cacheManager.registerCache('testCache', { ttl: 60000, maxSize: 100 });
    });

    it('should set and get value successfully', () => {
      cacheManager.set('testCache', 'key1', 'value1');
      const result = cacheManager.get('testCache', 'key1');

      expect(result).toBe('value1');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cache set: testCache:key1')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith('Cache hit: testCache:key1');
    });

    it('should return undefined for non-existent key', () => {
      const result = cacheManager.get('testCache', 'nonExistentKey');

      expect(result).toBeUndefined();
    });

    it('should return undefined for expired entry', () => {
      cacheManager.set('testCache', 'key1', 'value1');

      // Fast-forward time beyond TTL
      jest.advanceTimersByTime(61000);

      const result = cacheManager.get('testCache', 'key1');

      expect(result).toBeUndefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Cache miss (expired): testCache:key1'
      );
    });

    it('should return value within TTL window', () => {
      cacheManager.set('testCache', 'key1', 'value1');

      // Fast-forward time but stay within TTL
      jest.advanceTimersByTime(30000);

      const result = cacheManager.get('testCache', 'key1');

      expect(result).toBe('value1');
    });

    it('should warn when setting to unregistered cache', () => {
      cacheManager.set('unknownCache', 'key1', 'value1');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cache "unknownCache" not registered'
      );
    });

    it('should warn when getting from unregistered cache', () => {
      const result = cacheManager.get('unknownCache', 'key1');

      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cache "unknownCache" not registered'
      );
    });

    it('should handle complex objects as values', () => {
      const complexValue = { nested: { data: [1, 2, 3] }, count: 42 };
      cacheManager.set('testCache', 'key1', complexValue);

      const result = cacheManager.get('testCache', 'key1');

      expect(result).toEqual(complexValue);
    });

    it('should throw error for blank cache name in get', () => {
      expect(() => cacheManager.get('', 'key1')).toThrow();
    });

    it('should throw error for blank key in get', () => {
      expect(() => cacheManager.get('testCache', '')).toThrow();
    });

    it('should throw error for blank cache name in set', () => {
      expect(() => cacheManager.set('', 'key1', 'value1')).toThrow();
    });

    it('should throw error for blank key in set', () => {
      expect(() => cacheManager.set('testCache', '', 'value1')).toThrow();
    });
  });

  describe('LRU pruning', () => {
    beforeEach(() => {
      cacheManager.registerCache('smallCache', { ttl: 60000, maxSize: 10 });
    });

    it('should prune oldest entries when maxSize exceeded', () => {
      // Add 11 entries to exceed maxSize of 10
      for (let i = 0; i < 11; i++) {
        cacheManager.set('smallCache', `key${i}`, `value${i}`);
        // Advance time slightly to ensure different expiresAt values
        jest.advanceTimersByTime(10);
      }

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Pruned')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('smallCache')
      );
    });

    it('should remove approximately 20% of entries during pruning', () => {
      // Fill cache to maxSize + 1
      for (let i = 0; i < 11; i++) {
        cacheManager.set('smallCache', `key${i}`, `value${i}`);
        jest.advanceTimersByTime(10);
      }

      // Extract pruning message
      const pruneCall = mockLogger.debug.mock.calls.find((call) =>
        call[0].includes('Pruned')
      );
      expect(pruneCall).toBeDefined();
      expect(pruneCall[0]).toMatch(/Pruned \d+ entries/);
    });
  });

  describe('invalidate', () => {
    beforeEach(() => {
      cacheManager.registerCache('testCache');
    });

    it('should invalidate specific cache entry', () => {
      cacheManager.set('testCache', 'key1', 'value1');
      cacheManager.set('testCache', 'key2', 'value2');

      cacheManager.invalidate('testCache', 'key1');

      expect(cacheManager.get('testCache', 'key1')).toBeUndefined();
      expect(cacheManager.get('testCache', 'key2')).toBe('value2');
      expect(mockLogger.debug).toHaveBeenCalledWith('Invalidated: testCache:key1');
    });

    it('should handle invalidation of non-existent key gracefully', () => {
      cacheManager.invalidate('testCache', 'nonExistentKey');

      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Invalidated:')
      );
    });

    it('should warn when invalidating from unregistered cache', () => {
      cacheManager.invalidate('unknownCache', 'key1');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cache "unknownCache" not registered'
      );
    });

    it('should throw error for blank cache name', () => {
      expect(() => cacheManager.invalidate('', 'key1')).toThrow();
    });

    it('should throw error for blank key', () => {
      expect(() => cacheManager.invalidate('testCache', '')).toThrow();
    });
  });

  describe('invalidateAll', () => {
    beforeEach(() => {
      cacheManager.registerCache('cache1');
      cacheManager.registerCache('cache2');
    });

    it('should invalidate entity across all caches', () => {
      const entityId = 'entity123';

      cacheManager.set('cache1', `${entityId}:name`, 'John');
      cacheManager.set('cache1', `${entityId}:age`, 30);
      cacheManager.set('cache2', `${entityId}:status`, 'active');
      cacheManager.set('cache2', 'other:key', 'value');

      cacheManager.invalidateAll(entityId);

      expect(cacheManager.get('cache1', `${entityId}:name`)).toBeUndefined();
      expect(cacheManager.get('cache1', `${entityId}:age`)).toBeUndefined();
      expect(cacheManager.get('cache2', `${entityId}:status`)).toBeUndefined();
      expect(cacheManager.get('cache2', 'other:key')).toBe('value');
    });

    it('should log invalidation count', () => {
      const entityId = 'entity123';

      cacheManager.set('cache1', `${entityId}:name`, 'John');
      cacheManager.set('cache2', `${entityId}:status`, 'active');

      cacheManager.invalidateAll(entityId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Invalidated 2 entries for entity entity123')
      );
    });

    it('should handle entity with no cached entries gracefully', () => {
      cacheManager.invalidateAll('nonExistentEntity');

      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Invalidated')
      );
    });

    it('should throw error for blank entityId', () => {
      expect(() => cacheManager.invalidateAll('')).toThrow();
    });
  });

  describe('Event-driven invalidation', () => {
    beforeEach(() => {
      cacheManager.registerCache('testCache');
    });

    it('should invalidate on COMPONENT_ADDED event', () => {
      const entityId = 'entity123';
      cacheManager.set('testCache', `${entityId}:name`, 'John');

      const handler = eventHandlers.get(COMPONENT_ADDED_ID);
      handler({ payload: { entityId } });

      expect(cacheManager.get('testCache', `${entityId}:name`)).toBeUndefined();
    });

    it('should invalidate on COMPONENT_REMOVED event', () => {
      const entityId = 'entity123';
      cacheManager.set('testCache', `${entityId}:name`, 'John');

      const handler = eventHandlers.get(COMPONENT_REMOVED_ID);
      handler({ payload: { entityId } });

      expect(cacheManager.get('testCache', `${entityId}:name`)).toBeUndefined();
    });

    it('should invalidate on COMPONENTS_BATCH_ADDED event', () => {
      const entityId = 'entity123';
      cacheManager.set('testCache', `${entityId}:name`, 'John');

      const handler = eventHandlers.get(COMPONENTS_BATCH_ADDED_ID);
      handler({
        payload: {
          updates: [
            { entityId: entityId },
            { entity: { id: entityId } },
            { instanceId: entityId },
          ],
        },
      });

      expect(cacheManager.get('testCache', `${entityId}:name`)).toBeUndefined();
    });

    it('should invalidate on ENTITY_REMOVED event', () => {
      const entityId = 'entity123';
      cacheManager.set('testCache', `${entityId}:name`, 'John');

      const handler = eventHandlers.get(ENTITY_REMOVED_ID);
      handler({ payload: { entityId } });

      expect(cacheManager.get('testCache', `${entityId}:name`)).toBeUndefined();
    });

    it('should handle event with missing entityId gracefully', () => {
      const handler = eventHandlers.get(COMPONENT_ADDED_ID);

      expect(() => handler({ payload: {} })).not.toThrow();
      expect(() => handler({})).not.toThrow();
      expect(() => handler(null)).not.toThrow();
    });
  });

  describe('Periodic cleanup', () => {
    beforeEach(() => {
      cacheManager.registerCache('testCache', { ttl: 60000, maxSize: 100 });
    });

    it('should remove expired entries during periodic cleanup', () => {
      cacheManager.set('testCache', 'key1', 'value1');
      cacheManager.set('testCache', 'key2', 'value2');

      // Fast-forward beyond TTL (60000ms)
      jest.advanceTimersByTime(61000);

      // Trigger cleanup (happens at 30s intervals, so we need to reach the next interval)
      // We've already advanced 61s, so advance to next 30s mark (which would be at 90s total)
      jest.advanceTimersByTime(29000);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cache cleanup: removed 2 expired entries')
      );
    });

    it('should run cleanup every 30 seconds', () => {
      cacheManager.set('testCache', 'key1', 'value1');

      // Fast-forward beyond TTL to ensure entries expire
      jest.advanceTimersByTime(61000);

      // Fast-forward to trigger cleanup (at 90s total)
      jest.advanceTimersByTime(29000);

      // Should have cleaned up at least once
      const cleanupCalls = mockLogger.info.mock.calls.filter((call) =>
        call[0].includes('Cache cleanup:')
      );
      expect(cleanupCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should not log if no entries expired', () => {
      cacheManager.set('testCache', 'key1', 'value1');

      // Advance time slightly to trigger cleanup, but not enough to expire (TTL is 1000ms)
      jest.advanceTimersByTime(500);

      // Now trigger the cleanup interval (at 30s mark)
      jest.advanceTimersByTime(29500);

      // Entries should still be valid, so no cleanup should be logged
      const cleanupCalls = mockLogger.info.mock.calls.filter((call) =>
        call[0].includes('Cache cleanup:')
      );
      expect(cleanupCalls.length).toBe(0);
    });
  });

  describe('destroy', () => {
    beforeEach(() => {
      cacheManager.registerCache('testCache');
    });

    it('should clear cleanup interval', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      cacheManager.destroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should unsubscribe from all events', () => {
      const unsubscribeFns = [];
      mockEventBus.subscribe.mockImplementation((eventId, handler) => {
        const unsubscribe = jest.fn();
        unsubscribeFns.push(unsubscribe);
        return unsubscribe;
      });

      // Create new instance to capture unsubscribe functions
      const newCacheManager = new ActivityCacheManager({
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      newCacheManager.destroy();

      unsubscribeFns.forEach((unsubscribe) => {
        expect(unsubscribe).toHaveBeenCalled();
      });
    });

    it('should clear all caches', () => {
      cacheManager.set('testCache', 'key1', 'value1');

      cacheManager.destroy();

      // After destroy, cache operations should warn about unregistered cache
      const result = cacheManager.get('testCache', 'key1');
      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cache "testCache" not registered'
      );
    });

    it('should log destruction', () => {
      cacheManager.destroy();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActivityCacheManager destroyed'
      );
    });

    it('should handle multiple destroy calls gracefully', () => {
      cacheManager.destroy();
      cacheManager.destroy();

      // Should not throw error
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActivityCacheManager destroyed'
      );
    });
  });

  describe('Integration scenarios', () => {
    beforeEach(() => {
      cacheManager.registerCache('entityNames', { ttl: 60000, maxSize: 1000 });
      cacheManager.registerCache('genderData', { ttl: 60000, maxSize: 1000 });
      cacheManager.registerCache('activityIndex', { ttl: 60000, maxSize: 100 });
      cacheManager.registerCache('closenessData', { ttl: 60000, maxSize: 1000 });
    });

    it('should handle multiple caches independently', () => {
      cacheManager.set('entityNames', 'entity1', 'Alice');
      cacheManager.set('genderData', 'entity1', 'female');
      cacheManager.set('activityIndex', 'activity1', { data: 'test' });
      cacheManager.set('closenessData', 'entity1:entity2', 'close');

      expect(cacheManager.get('entityNames', 'entity1')).toBe('Alice');
      expect(cacheManager.get('genderData', 'entity1')).toBe('female');
      expect(cacheManager.get('activityIndex', 'activity1')).toEqual({
        data: 'test',
      });
      expect(cacheManager.get('closenessData', 'entity1:entity2')).toBe('close');
    });

    it('should invalidate entity across all registered caches', () => {
      const entityId = 'entity123';

      cacheManager.set('entityNames', entityId, 'Alice');
      cacheManager.set('genderData', entityId, 'female');
      cacheManager.set('closenessData', `${entityId}:other`, 'close');

      cacheManager.invalidateAll(entityId);

      expect(cacheManager.get('entityNames', entityId)).toBeUndefined();
      expect(cacheManager.get('genderData', entityId)).toBeUndefined();
      expect(cacheManager.get('closenessData', `${entityId}:other`)).toBeUndefined();
    });

    it('should handle event-driven invalidation across multiple caches', () => {
      const entityId = 'entity123';

      cacheManager.set('entityNames', entityId, 'Alice');
      cacheManager.set('genderData', entityId, 'female');

      const handler = eventHandlers.get(COMPONENT_ADDED_ID);
      handler({ payload: { entityId } });

      expect(cacheManager.get('entityNames', entityId)).toBeUndefined();
      expect(cacheManager.get('genderData', entityId)).toBeUndefined();
    });

    it('should clean up all caches during periodic cleanup', () => {
      cacheManager.set('entityNames', 'entity1', 'Alice');
      cacheManager.set('genderData', 'entity1', 'female');

      // Fast-forward beyond TTL
      jest.advanceTimersByTime(61000);

      // Trigger cleanup
      jest.advanceTimersByTime(30000);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cache cleanup: removed')
      );
    });
  });

  describe('clearAll', () => {
    it('should clear all caches and log totals', () => {
      cacheManager.registerCache('cache1', { ttl: 60000, maxSize: 100 });
      cacheManager.registerCache('cache2', { ttl: 60000, maxSize: 100 });

      cacheManager.set('cache1', 'key1', 'value1');
      cacheManager.set('cache1', 'key2', 'value2');
      cacheManager.set('cache2', 'key3', 'value3');

      cacheManager.clearAll();

      expect(cacheManager.get('cache1', 'key1')).toBeUndefined();
      expect(cacheManager.get('cache1', 'key2')).toBeUndefined();
      expect(cacheManager.get('cache2', 'key3')).toBeUndefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cleared 3 total cache entries')
      );
    });

    it('should not log if no entries to clear', () => {
      cacheManager.registerCache('emptyCache', { ttl: 60000, maxSize: 100 });

      cacheManager.clearAll();

      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });
});
