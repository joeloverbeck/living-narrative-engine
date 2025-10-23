/**
 * @file Unit tests for ScopeCacheStrategy
 * @see specs/unified-scope-resolver-consolidation-spec.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ScopeCacheStrategy } from '../../../../src/actions/scopes/scopeCacheStrategy.js';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';

describe('ScopeCacheStrategy', () => {
  let cacheStrategy;
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };

    cacheStrategy = new ScopeCacheStrategy({
      logger: mockLogger,
      maxSize: 3,
      defaultTTL: 1000,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should use default values when no options provided', () => {
      const defaultStrategy = new ScopeCacheStrategy();

      expect(defaultStrategy.size).toBe(0);
      // Test default maxSize by filling cache beyond default
      for (let i = 0; i < 1005; i++) {
        defaultStrategy.setSync(`key${i}`, `value${i}`);
      }
      expect(defaultStrategy.size).toBe(1000); // Default maxSize
    });

    it('should accept custom cache implementation', () => {
      const customCache = new Map();
      const strategy = new ScopeCacheStrategy({ cache: customCache });

      strategy.setSync('test', 'value');
      expect(customCache.has('test')).toBe(true);
    });
  });

  describe('generateKey', () => {
    it('should generate consistent cache keys', () => {
      const context = {
        actor: { id: 'actor123' },
        actorLocation: 'location1',
      };

      const key1 = cacheStrategy.generateKey('test-scope', context);
      const key2 = cacheStrategy.generateKey('test-scope', context);

      expect(key1).toBe('test-scope:actor123:location1');
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different contexts', () => {
      const context1 = {
        actor: { id: 'actor123' },
        actorLocation: 'location1',
      };
      const context2 = {
        actor: { id: 'actor456' },
        actorLocation: 'location1',
      };

      const key1 = cacheStrategy.generateKey('test-scope', context1);
      const key2 = cacheStrategy.generateKey('test-scope', context2);

      expect(key1).not.toBe(key2);
      expect(key1).toBe('test-scope:actor123:location1');
      expect(key2).toBe('test-scope:actor456:location1');
    });
  });

  describe('setSync and getSync', () => {
    it('should store and retrieve values', () => {
      const value = ActionResult.success(new Set(['entity1']));

      cacheStrategy.setSync('test-key', value);
      const retrieved = cacheStrategy.getSync('test-key');

      expect(retrieved).toBe(value);
      expect(mockLogger.debug).toHaveBeenCalledWith('Cached value', {
        key: 'test-key',
        ttl: 1000,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Cache hit',
        expect.objectContaining({ key: 'test-key' })
      );
    });

    it('should return null for non-existent keys', () => {
      const result = cacheStrategy.getSync('non-existent');

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith('Cache miss', {
        key: 'non-existent',
      });
    });

    it('should use custom TTL when provided', () => {
      const value = ActionResult.success(new Set(['entity1']));

      cacheStrategy.setSync('test-key', value, 5000);

      expect(mockLogger.debug).toHaveBeenCalledWith('Cached value', {
        key: 'test-key',
        ttl: 5000,
      });
    });

    it('should expire entries after TTL', async () => {
      const value = ActionResult.success(new Set(['entity1']));

      cacheStrategy.setSync('test-key', value, 10); // 10ms TTL

      // Should be available immediately
      expect(cacheStrategy.getSync('test-key')).toBe(value);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Should be expired now
      expect(cacheStrategy.getSync('test-key')).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith('Cache entry expired', {
        key: 'test-key',
      });
    });
  });

  describe('async get method', () => {
    it('should return cached value when available', async () => {
      const cachedValue = ActionResult.success(new Set(['cached']));
      cacheStrategy.setSync('test-key', cachedValue);

      const factory = jest.fn();
      const result = await cacheStrategy.get('test-key', factory);

      expect(result).toBe(cachedValue);
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory when cache miss', async () => {
      const factoryResult = ActionResult.success(new Set(['computed']));
      const factory = jest.fn().mockResolvedValue(factoryResult);

      const result = await cacheStrategy.get('test-key', factory);

      expect(result).toBe(factoryResult);
      expect(factory).toHaveBeenCalled();
      // Should cache the result
      expect(cacheStrategy.getSync('test-key')).toBe(factoryResult);
    });

    it('should not cache failed results', async () => {
      const factoryResult = ActionResult.failure(new Error('Test error'));
      const factory = jest.fn().mockResolvedValue(factoryResult);

      const result = await cacheStrategy.get('test-key', factory);

      expect(result).toBe(factoryResult);
      expect(cacheStrategy.getSync('test-key')).toBeNull();
    });

    it('should handle factory errors', async () => {
      const factory = jest.fn().mockRejectedValue(new Error('Factory failed'));

      await expect(cacheStrategy.get('test-key', factory)).rejects.toThrow(
        'Factory failed'
      );
      expect(mockLogger.error).toHaveBeenCalledWith('Factory function failed', {
        key: 'test-key',
        error: 'Factory failed',
      });
    });

    it('should use custom TTL in async mode', async () => {
      const factoryResult = ActionResult.success(new Set(['computed']));
      const factory = jest.fn().mockResolvedValue(factoryResult);

      await cacheStrategy.get('test-key', factory, 2000);

      expect(mockLogger.debug).toHaveBeenCalledWith('Cached value', {
        key: 'test-key',
        ttl: 2000,
      });
    });

    it('should evict expired entries before invoking factory', async () => {
      const customCache = new Map();
      const staleEntry = {
        value: ActionResult.success(new Set(['stale'])),
        timestamp: Date.now() - 10_000,
        ttl: 1,
      };
      customCache.set('stale-key', staleEntry);

      cacheStrategy = new ScopeCacheStrategy({
        cache: customCache,
        logger: mockLogger,
        defaultTTL: 1000,
      });

      const factoryResult = ActionResult.success(new Set(['fresh']));
      const factory = jest.fn().mockResolvedValue(factoryResult);

      const result = await cacheStrategy.get('stale-key', factory);

      expect(factory).toHaveBeenCalledTimes(1);
      expect(result).toBe(factoryResult);
      const cachedEntry = customCache.get('stale-key');
      expect(cachedEntry.value).toBe(factoryResult);
      expect(cachedEntry.timestamp).toBeGreaterThan(staleEntry.timestamp);
      expect(mockLogger.debug).toHaveBeenCalledWith('Cache entry expired', {
        key: 'stale-key',
      });
    });
  });

  describe('cache size management', () => {
    it('should enforce maximum size with LRU eviction', () => {
      // Fill cache to max size
      cacheStrategy.setSync('key1', 'value1');
      cacheStrategy.setSync('key2', 'value2');
      cacheStrategy.setSync('key3', 'value3');
      expect(cacheStrategy.size).toBe(3);

      // Adding one more should evict the oldest
      cacheStrategy.setSync('key4', 'value4');
      expect(cacheStrategy.size).toBe(3);
      expect(cacheStrategy.getSync('key1')).toBeNull(); // Should be evicted
      expect(cacheStrategy.getSync('key4')).toBe('value4'); // Should be present

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Evicted cache entry due to size limit',
        { key: 'key1' }
      );
    });

    it('should not evict when updating existing key', () => {
      cacheStrategy.setSync('key1', 'value1');
      cacheStrategy.setSync('key2', 'value2');
      cacheStrategy.setSync('key3', 'value3');

      // Update existing key - should not trigger eviction
      cacheStrategy.setSync('key2', 'updated-value2');
      expect(cacheStrategy.size).toBe(3);
      expect(cacheStrategy.getSync('key1')).toBe('value1'); // Should still be present
    });
  });

  describe('invalidation methods', () => {
    beforeEach(() => {
      cacheStrategy.setSync('key1', 'value1');
      cacheStrategy.setSync('key2', 'value2');
      cacheStrategy.setSync('key3', 'value3');
    });

    it('should invalidate specific key', () => {
      const removed = cacheStrategy.invalidate('key2');

      expect(removed).toBe(true);
      expect(cacheStrategy.getSync('key2')).toBeNull();
      expect(cacheStrategy.getSync('key1')).toBe('value1');
      expect(cacheStrategy.size).toBe(2);
      expect(mockLogger.debug).toHaveBeenCalledWith('Invalidated cache entry', {
        key: 'key2',
      });
    });

    it('should return false when invalidating non-existent key', () => {
      const removed = cacheStrategy.invalidate('non-existent');

      expect(removed).toBe(false);
    });

    it('should invalidate matching keys with predicate', () => {
      cacheStrategy.setSync('test:scope1:actor1', 'value1');
      cacheStrategy.setSync('test:scope2:actor1', 'value2');
      cacheStrategy.setSync('test:scope1:actor2', 'value3');

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

    it('should skip logging when no keys match during invalidation', () => {
      const customCache = new Map();
      customCache.set('scope:a:actor1', {
        value: 'value',
        timestamp: Date.now(),
        ttl: 1000,
      });

      cacheStrategy = new ScopeCacheStrategy({
        cache: customCache,
        logger: mockLogger,
      });

      mockLogger.info.mockClear();
      const removed = cacheStrategy.invalidateMatching(() => false);

      expect(removed).toBe(0);
      expect(customCache.has('scope:a:actor1')).toBe(true);
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        'Invalidated matching cache entries',
        expect.anything()
      );
    });

    it('should clear all entries', () => {
      const initialSize = cacheStrategy.size;
      expect(initialSize).toBeGreaterThan(0);

      cacheStrategy.clear();

      expect(cacheStrategy.size).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Cleared cache', {
        entriesRemoved: initialSize,
      });
    });
  });

  describe('maintenance and statistics', () => {
    it('should provide cache statistics', () => {
      cacheStrategy.setSync('key1', 'value1', 1000);
      cacheStrategy.setSync('key2', 'value2', 2000);

      const stats = cacheStrategy.getStats();

      expect(stats).toEqual({
        size: 2,
        maxSize: 3,
        validEntries: 2,
        expiredEntries: 0,
        averageAge: expect.any(Number),
        memoryUsage: expect.any(Number),
      });
      expect(stats.averageAge).toBeGreaterThanOrEqual(0);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it('should clean up expired entries', async () => {
      cacheStrategy.setSync('key1', 'value1', 10); // Will expire
      cacheStrategy.setSync('key2', 'value2', 1000); // Will not expire

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 20));

      const cleaned = cacheStrategy.cleanup();

      expect(cleaned).toBe(1);
      expect(cacheStrategy.size).toBe(1);
      expect(cacheStrategy.getSync('key1')).toBeNull();
      expect(cacheStrategy.getSync('key2')).toBe('value2');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cleaned up expired cache entries',
        { count: 1 }
      );
    });

    it('should handle statistics with expired entries', async () => {
      cacheStrategy.setSync('key1', 'value1', 10); // Will expire
      cacheStrategy.setSync('key2', 'value2', 1000); // Will not expire

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 20));

      const stats = cacheStrategy.getStats();

      expect(stats.validEntries).toBe(1);
      expect(stats.expiredEntries).toBe(1);
      expect(stats.size).toBe(2); // Total entries including expired
    });

    it('should avoid cleanup when no entries are expired', () => {
      const customCache = new Map();
      customCache.set('fresh-key', {
        value: 'value',
        timestamp: Date.now(),
        ttl: 1000,
      });

      cacheStrategy = new ScopeCacheStrategy({
        cache: customCache,
        logger: mockLogger,
      });

      mockLogger.info.mockClear();
      const removed = cacheStrategy.cleanup();

      expect(removed).toBe(0);
      expect(customCache.size).toBe(1);
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        'Cleaned up expired cache entries',
        expect.anything()
      );
    });
  });

  describe('edge cases', () => {
    it('should handle cache with no logger', () => {
      const strategy = new ScopeCacheStrategy({ logger: null });

      // Should not throw when logger is null
      strategy.setSync('key', 'value');
      expect(strategy.getSync('key')).toBe('value');
    });

    it('should handle zero TTL by using default TTL', () => {
      cacheStrategy.setSync('key', 'value', 0);

      // Should use default TTL instead of 0
      expect(cacheStrategy.getSync('key')).toBe('value');
    });

    it('should handle negative TTL as immediately expired', () => {
      cacheStrategy.setSync('key', 'value', -100);

      // Negative TTL means age will always be greater than TTL, so immediately expired
      expect(cacheStrategy.getSync('key')).toBeNull();
    });

    it('should estimate memory usage', () => {
      const stats = cacheStrategy.getStats();
      expect(stats.memoryUsage).toBe(0); // Empty cache

      cacheStrategy.setSync('key1', 'value1');
      const statsWithData = cacheStrategy.getStats();
      expect(statsWithData.memoryUsage).toBeGreaterThan(0);
    });

    it('should treat entries without timestamps as invalid', () => {
      const customCache = new Map();
      customCache.set('invalid-entry', { value: 'value-without-timestamp' });

      cacheStrategy = new ScopeCacheStrategy({
        cache: customCache,
        logger: mockLogger,
      });

      const result = cacheStrategy.getSync('invalid-entry');

      expect(result).toBeNull();
      expect(customCache.has('invalid-entry')).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith('Cache entry expired', {
        key: 'invalid-entry',
      });
    });

    it('should fall back to default TTL when entry ttl is falsy', () => {
      const baseTime = Date.now();
      const customCache = new Map();
      customCache.set('zero-ttl', {
        value: 'cached-value',
        timestamp: baseTime,
        ttl: 0,
      });

      const nowSpy = jest
        .spyOn(Date, 'now')
        .mockImplementation(() => baseTime + 500);

      cacheStrategy = new ScopeCacheStrategy({
        cache: customCache,
        logger: mockLogger,
        defaultTTL: 1000,
      });

      const result = cacheStrategy.getSync('zero-ttl');

      expect(result).toBe('cached-value');

      nowSpy.mockRestore();
    });
  });
});
