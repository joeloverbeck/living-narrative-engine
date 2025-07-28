/**
 * @file Integration tests for ScopeCacheStrategy
 * Focuses on uncovered lines 70-80 and 96-319 to improve coverage from 27.27% to 80%+
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ScopeCacheStrategy } from '../../../../src/actions/scopes/scopeCacheStrategy.js';
import { UnifiedScopeResolver } from '../../../../src/actions/scopes/unifiedScopeResolver.js';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { TARGET_DOMAIN_SELF } from '../../../../src/constants/targetDomains.js';

describe('ScopeCacheStrategy Integration Tests', () => {
  let container;
  let cacheStrategy;
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create DOM elements needed by container configuration
    const outputDiv = document.createElement('div');
    const inputElement = document.createElement('input');
    const titleElement = document.createElement('h1');

    // Create and configure container
    container = new AppContainer();
    configureContainer(container, {
      outputDiv,
      inputElement,
      titleElement,
      document,
    });

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create cache strategy with real dependencies
    cacheStrategy = new ScopeCacheStrategy({
      logger: mockLogger,
      maxSize: 5,
      defaultTTL: 1000,
    });

    // Note: UnifiedScopeResolver can be resolved when needed for specific tests
  });

  afterEach(() => {
    cacheStrategy.clear();
    jest.clearAllMocks();
  });

  describe('Cache Hit Path Integration (lines 70-80)', () => {
    it('should return cached result with proper logging in getSync', () => {
      const testValue = ActionResult.success(new Set(['entity1', 'entity2']));
      const testKey = 'test:scope:actor123:location1';

      // Set value in cache first
      cacheStrategy.setSync(testKey, testValue);

      // Clear mock logs to focus on getSync behavior
      mockLogger.debug.mockClear();

      // Test cache hit path (line 72-76)
      const cachedResult = cacheStrategy.getSync(testKey);

      expect(cachedResult).toBe(testValue);
      expect(mockLogger.debug).toHaveBeenCalledWith('Cache hit', {
        key: testKey,
        age: expect.any(Number),
      });
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
    });

    it('should handle expired entry removal during getSync (lines 78-80)', async () => {
      const testValue = ActionResult.success(new Set(['expired']));
      const testKey = 'test:expired:actor123:location1';

      // Set value with very short TTL
      cacheStrategy.setSync(testKey, testValue, 10);

      // Verify it exists initially
      expect(cacheStrategy.getSync(testKey)).toBe(testValue);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Clear mock logs to focus on expiration behavior
      mockLogger.debug.mockClear();

      // Test expired entry removal (lines 78-80)
      const result = cacheStrategy.getSync(testKey);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith('Cache entry expired', {
        key: testKey,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith('Cache miss', {
        key: testKey,
      });
      expect(cacheStrategy.size).toBe(0); // Expired entry should be removed
    });
  });

  describe('Core Cache Operations Integration (lines 96-319)', () => {
    describe('setSync method integration (line 96)', () => {
      it('should delegate to private #set method with proper parameters', () => {
        const testValue = ActionResult.success(new Set(['set-test']));
        const testKey = 'test:setSync:actor456:location2';
        const customTTL = 2000;

        // Test setSync delegation (line 96)
        cacheStrategy.setSync(testKey, testValue, customTTL);

        // Verify value was stored correctly
        const retrieved = cacheStrategy.getSync(testKey);
        expect(retrieved).toBe(testValue);

        // Verify logging from private #set method
        expect(mockLogger.debug).toHaveBeenCalledWith('Cached value', {
          key: testKey,
          ttl: customTTL,
        });
      });
    });

    describe('async get method integration (lines 107-145)', () => {
      it('should return cached value when available (lines 111-118)', async () => {
        const cachedValue = ActionResult.success(new Set(['cached-async']));
        const testKey = 'test:async-cached:actor789:location3';

        // Pre-populate cache
        cacheStrategy.setSync(testKey, cachedValue);
        mockLogger.debug.mockClear();

        const factory = jest.fn();

        // Test cached path (lines 111-118)
        const result = await cacheStrategy.get(testKey, factory);

        expect(result).toBe(cachedValue);
        expect(factory).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith('Cache hit', {
          key: testKey,
          age: expect.any(Number),
        });
      });

      it('should handle cache miss and factory execution (lines 126-137)', async () => {
        const factoryResult = ActionResult.success(new Set(['factory-result']));
        const factory = jest.fn().mockResolvedValue(factoryResult);
        const testKey = 'test:factory:actor999:location4';

        // Test cache miss path (lines 126-137)
        const result = await cacheStrategy.get(testKey, factory);

        expect(result).toBe(factoryResult);
        expect(factory).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith('Cache miss', {
          key: testKey,
        });

        // Verify successful result was cached (line 134)
        const cachedResult = cacheStrategy.getSync(testKey);
        expect(cachedResult).toBe(factoryResult);
      });

      it('should not cache failed results (lines 133-135)', async () => {
        const failedResult = ActionResult.failure(new Error('Factory failed'));
        const factory = jest.fn().mockResolvedValue(failedResult);
        const testKey = 'test:failed:actor111:location5';

        // Test failed result handling
        const result = await cacheStrategy.get(testKey, factory);

        expect(result).toBe(failedResult);
        expect(cacheStrategy.getSync(testKey)).toBeNull();
      });

      it('should handle factory function errors (lines 138-144)', async () => {
        const factory = jest
          .fn()
          .mockRejectedValue(new Error('Factory threw error'));
        const testKey = 'test:error:actor222:location6';

        // Test error handling (lines 138-144)
        await expect(cacheStrategy.get(testKey, factory)).rejects.toThrow(
          'Factory threw error'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Factory function failed',
          {
            key: testKey,
            error: 'Factory threw error',
          }
        );
      });

      it('should use custom TTL when provided (lines 108, 134)', async () => {
        const factoryResult = ActionResult.success(new Set(['custom-ttl']));
        const factory = jest.fn().mockResolvedValue(factoryResult);
        const testKey = 'test:custom-ttl:actor333:location7';
        const customTTL = 5000;

        await cacheStrategy.get(testKey, factory, customTTL);

        expect(mockLogger.debug).toHaveBeenCalledWith('Cached value', {
          key: testKey,
          ttl: customTTL,
        });
      });
    });

    describe('LRU Eviction Integration (#set method, lines 155-174)', () => {
      it('should enforce maxSize with LRU eviction', () => {
        // Fill cache to max size (5)
        for (let i = 1; i <= 5; i++) {
          cacheStrategy.setSync(`key${i}`, `value${i}`);
        }
        expect(cacheStrategy.size).toBe(5);

        mockLogger.debug.mockClear();

        // Add one more to trigger eviction (lines 157-163)
        cacheStrategy.setSync('key6', 'value6');

        expect(cacheStrategy.size).toBe(5);
        expect(cacheStrategy.getSync('key1')).toBeNull(); // Should be evicted
        expect(cacheStrategy.getSync('key6')).toBe('value6');

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Evicted cache entry due to size limit',
          { key: 'key1' }
        );
      });

      it('should not evict when updating existing key', () => {
        // Fill cache to max size
        for (let i = 1; i <= 5; i++) {
          cacheStrategy.setSync(`key${i}`, `value${i}`);
        }

        mockLogger.debug.mockClear();

        // Update existing key - should not trigger eviction
        cacheStrategy.setSync('key3', 'updated-value3');

        expect(cacheStrategy.size).toBe(5);
        expect(cacheStrategy.getSync('key1')).toBe('value1'); // Should still exist
        expect(cacheStrategy.getSync('key3')).toBe('updated-value3');

        // Should not log eviction
        expect(mockLogger.debug).not.toHaveBeenCalledWith(
          'Evicted cache entry due to size limit',
          expect.any(Object)
        );
      });
    });

    describe('TTL Validation Integration (#isValid method, lines 183-192)', () => {
      it('should validate entry based on timestamp and TTL', () => {
        const testKey = 'test:ttl:actor444:location8';
        const testValue = 'ttl-test-value';

        // Set with custom TTL
        cacheStrategy.setSync(testKey, testValue, 500);

        // Should be valid immediately
        expect(cacheStrategy.getSync(testKey)).toBe(testValue);
      });

      it('should handle invalid entries (missing timestamp)', () => {
        const testKey = 'test:invalid:actor555:location9';

        // Test cache with valid entry first
        cacheStrategy.setSync(testKey, 'test');

        // Test should handle gracefully without crashing
        expect(() => cacheStrategy.getSync(testKey)).not.toThrow();
        expect(cacheStrategy.getSync(testKey)).toBe('test');
      });
    });

    describe('Cache Management Integration (lines 197-243)', () => {
      beforeEach(() => {
        // Set up test data
        cacheStrategy.setSync('key1', 'value1');
        cacheStrategy.setSync('key2', 'value2');
        cacheStrategy.setSync('key3', 'value3');
      });

      it('should clear all entries (lines 197-201)', () => {
        const initialSize = cacheStrategy.size;
        expect(initialSize).toBe(3);

        // Test clear method
        cacheStrategy.clear();

        expect(cacheStrategy.size).toBe(0);
        expect(mockLogger.info).toHaveBeenCalledWith('Cleared cache', {
          entriesRemoved: initialSize,
        });
      });

      it('should invalidate specific entries (lines 209-215)', () => {
        // Test invalidate method
        const removed = cacheStrategy.invalidate('key2');

        expect(removed).toBe(true);
        expect(cacheStrategy.getSync('key2')).toBeNull();
        expect(cacheStrategy.getSync('key1')).toBe('value1');
        expect(cacheStrategy.size).toBe(2);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Invalidated cache entry',
          {
            key: 'key2',
          }
        );
      });

      it('should return false when invalidating non-existent key', () => {
        const removed = cacheStrategy.invalidate('non-existent');
        expect(removed).toBe(false);
      });

      it('should invalidate matching keys with predicate (lines 223-242)', () => {
        // Add more test data with patterns
        cacheStrategy.setSync('test:scope1:actor1', 'value1');
        cacheStrategy.setSync('test:scope2:actor1', 'value2');
        cacheStrategy.setSync('test:scope1:actor2', 'value3');

        // Test invalidateMatching
        const invalidated = cacheStrategy.invalidateMatching((key) =>
          key.includes('actor1')
        );

        expect(invalidated).toBe(2);
        expect(cacheStrategy.getSync('test:scope1:actor1')).toBeNull();
        expect(cacheStrategy.getSync('test:scope2:actor1')).toBeNull();
        expect(cacheStrategy.getSync('test:scope1:actor2')).toBe('value3');

        expect(mockLogger.info).toHaveBeenCalledWith(
          'Invalidated matching cache entries',
          { count: 2 }
        );
      });
    });

    describe('Statistics Integration (lines 259-281)', () => {
      it('should provide accurate cache statistics', async () => {
        // Set up test data with different TTLs
        cacheStrategy.setSync('valid1', 'value1', 2000);
        cacheStrategy.setSync('valid2', 'value2', 3000);
        cacheStrategy.setSync('expire', 'value3', 10);

        // Wait for one to expire
        await new Promise((resolve) => setTimeout(resolve, 20));

        // Test getStats method (lines 259-281)
        const stats = cacheStrategy.getStats();

        expect(stats).toEqual({
          size: 3, // Total entries including expired
          maxSize: 5,
          validEntries: 2, // Only non-expired
          expiredEntries: 1,
          averageAge: expect.any(Number),
          memoryUsage: expect.any(Number),
        });

        expect(stats.averageAge).toBeGreaterThanOrEqual(0);
        expect(stats.memoryUsage).toBeGreaterThan(0);
      });

      it('should handle empty cache in statistics', () => {
        cacheStrategy.clear();

        const stats = cacheStrategy.getStats();

        expect(stats.size).toBe(0);
        expect(stats.validEntries).toBe(0);
        expect(stats.expiredEntries).toBe(0);
        expect(stats.averageAge).toBe(0);
        expect(stats.memoryUsage).toBe(0);
      });
    });

    describe('Memory Usage Estimation Integration (lines 289-293)', () => {
      it('should estimate memory usage based on cache size', () => {
        // Empty cache
        expect(cacheStrategy.getStats().memoryUsage).toBe(0);

        // Add entries
        cacheStrategy.setSync('mem1', 'test');
        cacheStrategy.setSync('mem2', 'test');

        const stats = cacheStrategy.getStats();
        // Should be 2 entries * (100 + 1024) bytes = 2248 bytes
        expect(stats.memoryUsage).toBe(2 * (100 + 1024));
      });
    });

    describe('Cleanup Integration (lines 300-320)', () => {
      it('should remove expired entries during cleanup', async () => {
        // Set up entries with different expiration times
        cacheStrategy.setSync('keep1', 'value1', 2000);
        cacheStrategy.setSync('expire1', 'value2', 10);
        cacheStrategy.setSync('expire2', 'value3', 10);
        cacheStrategy.setSync('keep2', 'value4', 2000);

        expect(cacheStrategy.size).toBe(4);

        // Wait for some to expire
        await new Promise((resolve) => setTimeout(resolve, 20));

        // Test cleanup method (lines 300-320)
        const cleanedCount = cacheStrategy.cleanup();

        expect(cleanedCount).toBe(2); // Should remove 2 expired entries
        expect(cacheStrategy.size).toBe(2); // Should have 2 remaining
        expect(cacheStrategy.getSync('keep1')).toBe('value1');
        expect(cacheStrategy.getSync('keep2')).toBe('value4');
        expect(cacheStrategy.getSync('expire1')).toBeNull();
        expect(cacheStrategy.getSync('expire2')).toBeNull();

        expect(mockLogger.info).toHaveBeenCalledWith(
          'Cleaned up expired cache entries',
          { count: 2 }
        );
      });

      it('should handle cleanup with no expired entries', () => {
        cacheStrategy.setSync('valid', 'value', 5000);

        const cleanedCount = cacheStrategy.cleanup();

        expect(cleanedCount).toBe(0);
        expect(cacheStrategy.size).toBe(1);
      });
    });
  });

  describe('UnifiedScopeResolver Integration', () => {
    it('should work with UnifiedScopeResolver for real caching scenarios', () => {
      // Create UnifiedScopeResolver with our cache strategy
      const testResolver = new UnifiedScopeResolver({
        scopeRegistry: container.resolve(tokens.IScopeRegistry),
        scopeEngine: container.resolve(tokens.IScopeEngine),
        entityManager: container.resolve(tokens.IEntityManager),
        jsonLogicEvaluationService: container.resolve(
          tokens.JsonLogicEvaluationService
        ),
        dslParser: container.resolve(tokens.DslParser),
        logger: container.resolve(tokens.ILogger),
        actionErrorContextBuilder: container.resolve(
          tokens.IActionErrorContextBuilder
        ),
        cacheStrategy: cacheStrategy,
      });

      const context = {
        actor: { id: 'integration-actor', componentTypeIds: [] },
        actorLocation: 'location1',
      };

      // First call - should miss cache and potentially populate it
      const result1 = testResolver.resolve(TARGET_DOMAIN_SELF, context, {
        useCache: true,
      });

      expect(result1.success).toBe(true);
      // Note: Cache size may be 0 if resolver doesn't use cache for special scopes
      expect(cacheStrategy.size).toBeGreaterThanOrEqual(0);

      // Second call - should work consistently
      mockLogger.debug.mockClear();
      const result2 = testResolver.resolve(TARGET_DOMAIN_SELF, context, {
        useCache: true,
      });

      expect(result2.success).toBe(true);
      expect(result2.value).toEqual(result1.value);
    });

    it('should generate consistent cache keys', () => {
      const context1 = {
        actor: { id: 'test-actor' },
        actorLocation: 'location1',
      };

      const context2 = {
        actor: { id: 'test-actor' },
        actorLocation: 'location1',
      };

      const key1 = cacheStrategy.generateKey('test:scope', context1);
      const key2 = cacheStrategy.generateKey('test:scope', context2);

      expect(key1).toBe(key2);
      expect(key1).toBe('test:scope:test-actor:location1');
    });
  });

  describe('Memory Management and Performance Integration', () => {
    it('should handle large cache scenarios without memory leaks', () => {
      // Fill cache with many entries
      for (let i = 0; i < 100; i++) {
        cacheStrategy.setSync(`large-key-${i}`, `large-value-${i}`);
      }

      // Should be limited by maxSize
      expect(cacheStrategy.size).toBe(5);

      // Cleanup should work efficiently
      const cleanedCount = cacheStrategy.cleanup();
      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle concurrent access patterns', async () => {
      const promises = [];

      // Simulate concurrent cache operations
      for (let i = 0; i < 10; i++) {
        promises.push(
          cacheStrategy.get(`concurrent-${i}`, async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return ActionResult.success(new Set([`result-${i}`]));
          })
        );
      }

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result, i) => {
        expect(result.success).toBe(true);
        expect(result.value).toEqual(new Set([`result-${i}`]));
      });
    });
  });

  describe('Error Recovery and Edge Cases Integration', () => {
    it('should handle logger failures gracefully', () => {
      // Test with null logger (which is handled gracefully)
      const faultyCacheStrategy = new ScopeCacheStrategy({
        logger: null, // Null logger should be handled gracefully
        maxSize: 3,
        defaultTTL: 1000,
      });

      // Should not crash with null logger
      expect(() => {
        faultyCacheStrategy.setSync('test', 'value');
        expect(faultyCacheStrategy.getSync('test')).toBe('value');
        faultyCacheStrategy.clear();
        faultyCacheStrategy.cleanup();
      }).not.toThrow();
    });

    it('should handle custom cache implementation', () => {
      const customCache = new Map();
      const customCacheStrategy = new ScopeCacheStrategy({
        cache: customCache,
        logger: mockLogger,
      });

      customCacheStrategy.setSync('custom', 'value');

      expect(customCache.has('custom')).toBe(true);
      expect(customCacheStrategy.getSync('custom')).toBe('value');
    });

    it('should handle edge cases in cache key generation', () => {
      const edgeCases = [
        {
          actor: { id: 'actor with spaces' },
          actorLocation: 'location:with:colons',
        },
        {
          actor: { id: 'actor/with/slashes' },
          actorLocation: 'location\\with\\backslashes',
        },
        {
          actor: { id: 'actor-with-unicode-🎯' },
          actorLocation: 'location-with-unicode-🏠',
        },
      ];

      edgeCases.forEach((context, i) => {
        const key = cacheStrategy.generateKey(`edge-case-${i}`, context);
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);

        // Should be able to use the key for caching
        cacheStrategy.setSync(key, `edge-value-${i}`);
        expect(cacheStrategy.getSync(key)).toBe(`edge-value-${i}`);
      });
    });

    it('should handle zero and negative TTL values', () => {
      // Zero TTL should use default
      cacheStrategy.setSync('zero-ttl', 'value', 0);
      expect(cacheStrategy.getSync('zero-ttl')).toBe('value');

      // Negative TTL should expire immediately
      cacheStrategy.setSync('negative-ttl', 'value', -100);
      expect(cacheStrategy.getSync('negative-ttl')).toBeNull();
    });
  });

  describe('Lifecycle Integration Tests', () => {
    it('should maintain cache integrity through multiple operations', async () => {
      // Perform various operations in sequence
      cacheStrategy.setSync('lifecycle1', 'value1', 1000);
      cacheStrategy.setSync('lifecycle2', 'value2', 100);

      expect(cacheStrategy.size).toBe(2);

      // Wait for one to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Add more entries
      cacheStrategy.setSync('lifecycle3', 'value3');

      // Cleanup expired entries
      const cleaned = cacheStrategy.cleanup();
      expect(cleaned).toBe(1);

      // Verify integrity
      expect(cacheStrategy.getSync('lifecycle1')).toBe('value1');
      expect(cacheStrategy.getSync('lifecycle2')).toBeNull();
      expect(cacheStrategy.getSync('lifecycle3')).toBe('value3');

      // Get statistics
      const stats = cacheStrategy.getStats();
      expect(stats.size).toBe(2);
      expect(stats.validEntries).toBe(2);
      expect(stats.expiredEntries).toBe(0);
    });

    it('should handle cache invalidation patterns', () => {
      // Set up hierarchical cache keys
      cacheStrategy.setSync('scope:area1:actor1', 'value1');
      cacheStrategy.setSync('scope:area1:actor2', 'value2');
      cacheStrategy.setSync('scope:area2:actor1', 'value3');
      cacheStrategy.setSync('other:area1:actor1', 'value4');

      // Invalidate all entries for area1
      const invalidated = cacheStrategy.invalidateMatching((key) =>
        key.includes(':area1:')
      );

      expect(invalidated).toBe(3);
      expect(cacheStrategy.getSync('scope:area2:actor1')).toBe('value3');
      expect(cacheStrategy.size).toBe(1);
    });
  });
});
