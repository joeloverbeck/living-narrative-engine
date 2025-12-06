/**
 * @file cacheService.coverage.test.js - Additional unit tests for CacheService to achieve 100% coverage
 */

import { jest } from '@jest/globals';
import CacheService from '../../../src/services/cacheService.js';

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('CacheService - Coverage Tests', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor validation and base behaviors', () => {
    it('throws when logger dependency is missing', () => {
      try {
        new CacheService();
        throw new Error('Expected constructor to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('CacheService: logger is required.');
      }
    });

    it('uses default configuration when options are not provided', () => {
      jest.useFakeTimers();
      const cacheService = new CacheService(mockLogger);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'CacheService: Initialized with optimized configuration',
        expect.objectContaining({
          maxSize: 1000,
          defaultTtl: 300000,
          maxMemoryBytes: expect.any(Number),
          enableAutoCleanup: true,
        })
      );

      const initialStats = cacheService.getStats();
      expect(initialStats.hitRate).toBe('0%');
      expect(initialStats.efficiency.memoryEvictionRate).toBe('0%');
      expect(initialStats.efficiency.expirationRate).toBe('0%');

      cacheService.cleanup();
      jest.useRealTimers();
    });

    it('covers cache miss, hit, and expiration paths of get()', () => {
      jest.useFakeTimers({ now: 0 });
      const cacheService = new CacheService(mockLogger, {
        maxSize: 5,
        defaultTtl: 100,
        enableAutoCleanup: false,
      });

      mockLogger.debug.mockClear();

      expect(cacheService.get('missing')).toBeUndefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "CacheService: Cache miss for key 'missing'"
      );

      cacheService.set('key1', 'value1', 50);
      expect(cacheService.get('key1')).toBe('value1');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "CacheService: Cache hit for key 'key1'"
      );

      jest.setSystemTime(1000);
      expect(cacheService.get('key1')).toBeUndefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "CacheService: Cache entry expired for key 'key1'"
      );

      jest.useRealTimers();
      cacheService.cleanup();
    });
  });

  describe('getOrLoad coverage', () => {
    it('returns cached value without invoking loader when entry exists', async () => {
      const cacheService = new CacheService(mockLogger, {
        maxSize: 5,
        defaultTtl: 1000,
        enableAutoCleanup: false,
      });

      cacheService.set('preloaded', 'cached-value');
      const loader = jest.fn().mockResolvedValue('should-not-be-used');

      const result = await cacheService.getOrLoad('preloaded', loader, 5000);

      expect(result).toBe('cached-value');
      expect(loader).not.toHaveBeenCalled();

      cacheService.cleanup();
    });

    it('loads missing values and persists them with provided ttl', async () => {
      const cacheService = new CacheService(mockLogger, {
        maxSize: 5,
        defaultTtl: 1000,
        enableAutoCleanup: false,
      });

      const loader = jest.fn().mockResolvedValue('fresh-value');
      const setSpy = jest.spyOn(cacheService, 'set');

      const result = await cacheService.getOrLoad('needs-load', loader, 777);

      expect(result).toBe('fresh-value');
      expect(loader).toHaveBeenCalledTimes(1);
      expect(setSpy).toHaveBeenCalledWith('needs-load', 'fresh-value', 777);
      expect(cacheService.get('needs-load')).toBe('fresh-value');

      cacheService.cleanup();
    });

    it('logs and rethrows loader errors', async () => {
      const cacheService = new CacheService(mockLogger, {
        maxSize: 5,
        defaultTtl: 1000,
        enableAutoCleanup: false,
      });

      const error = new Error('load failure');
      const loader = jest.fn().mockRejectedValue(error);

      await expect(cacheService.getOrLoad('fail', loader)).rejects.toThrow(
        'load failure'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        "CacheService: Error loading value for key 'fail'",
        error
      );

      cacheService.cleanup();
    });
  });

  describe('invalidate, stats, and presence utilities', () => {
    it('returns false when invalidating a missing key', () => {
      const cacheService = new CacheService(mockLogger, {
        maxSize: 3,
        defaultTtl: 1000,
        enableAutoCleanup: false,
      });

      mockLogger.info.mockClear();
      expect(cacheService.invalidate('absent')).toBe(false);
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Invalidated cache entry')
      );

      cacheService.cleanup();
    });

    it('returns zero when pattern invalidation finds no matches', () => {
      const cacheService = new CacheService(mockLogger, {
        maxSize: 3,
        defaultTtl: 1000,
        enableAutoCleanup: false,
      });

      cacheService.set('alpha:1', 'value1');
      mockLogger.info.mockClear();

      expect(cacheService.invalidatePattern(/^beta:/)).toBe(0);
      expect(mockLogger.info).not.toHaveBeenCalled();

      cacheService.cleanup();
    });

    it('resets statistics and logs the reset operation', () => {
      const cacheService = new CacheService(mockLogger, {
        maxSize: 3,
        defaultTtl: 1000,
        enableAutoCleanup: false,
      });

      cacheService.set('hit', 'value');
      cacheService.get('hit');
      cacheService.get('miss');

      const preResetStats = cacheService.getStats();
      expect(preResetStats.hits).toBeGreaterThan(0);
      expect(preResetStats.misses).toBeGreaterThan(0);

      mockLogger.info.mockClear();
      cacheService.resetStats();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'CacheService: Reset enhanced cache statistics'
      );

      const postResetStats = cacheService.getStats();
      expect(postResetStats.hits).toBe(0);
      expect(postResetStats.misses).toBe(0);
      expect(postResetStats.expirations).toBe(0);

      cacheService.cleanup();
    });

    it('handles expired entries in has() by removing and counting them', () => {
      jest.useFakeTimers({ now: 0 });
      const cacheService = new CacheService(mockLogger, {
        maxSize: 3,
        defaultTtl: 100,
        enableAutoCleanup: false,
      });

      cacheService.set('soon-expire', 'value', 50);
      jest.setSystemTime(5000);

      expect(cacheService.has('soon-expire')).toBe(false);
      const stats = cacheService.getStats();
      expect(stats.expirations).toBeGreaterThanOrEqual(1);

      jest.useRealTimers();
      cacheService.cleanup();
    });
  });

  describe('eviction guard coverage', () => {
    it('breaks out of memory eviction when tail node lacks a key', () => {
      const cacheService = new CacheService(mockLogger, {
        maxSize: 5,
        defaultTtl: 1000,
        maxMemoryBytes: 5,
        enableAutoCleanup: false,
      });

      mockLogger.info.mockClear();
      cacheService.set(undefined, 'seed-value');

      cacheService.set('oversized', 'x'.repeat(50));

      expect(cacheService.getSize()).toBeGreaterThanOrEqual(1);
      expect(cacheService.get('oversized')).toBe('x'.repeat(50));
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringMatching(/Evicted \d+ entries/)
      );

      cacheService.cleanup();
    });
  });

  describe('Memory Eviction', () => {
    it('should evict entries when memory limit is exceeded', () => {
      const cacheService = new CacheService(mockLogger, {
        maxSize: 10,
        defaultTtl: 60000,
        maxMemoryBytes: 500, // Small limit for testing
        enableAutoCleanup: false,
      });

      // Add entries that will exceed memory limit
      cacheService.set('key1', 'a'.repeat(100));
      cacheService.set('key2', 'b'.repeat(100));
      cacheService.set('key3', 'c'.repeat(100));
      cacheService.set('key4', 'd'.repeat(100));

      // This should trigger memory eviction
      cacheService.set('key5', 'e'.repeat(200));

      // Check that oldest entries were evicted
      expect(cacheService.has('key1')).toBe(false);
      expect(cacheService.has('key2')).toBe(false);

      // Recent entries should still exist
      expect(cacheService.has('key4')).toBe(true);
      expect(cacheService.has('key5')).toBe(true);

      // Check eviction logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(
          /CacheService: Evicted \d+ entries to free \d+ bytes/
        )
      );

      cacheService.cleanup();
    });

    it('should evict multiple entries to make room for large entry', () => {
      const cacheService = new CacheService(mockLogger, {
        maxSize: 10,
        defaultTtl: 60000,
        maxMemoryBytes: 1000,
        enableAutoCleanup: false,
      });

      // Fill cache with small entries
      for (let i = 1; i <= 5; i++) {
        cacheService.set(`key${i}`, 'x'.repeat(150));
      }

      // Add a large entry that requires multiple evictions
      cacheService.set('large', 'y'.repeat(600));

      // Should have evicted several entries
      const stats = cacheService.getStats();
      expect(stats.memoryEvictions).toBeGreaterThan(0);
      expect(cacheService.has('large')).toBe(true);

      cacheService.cleanup();
    });

    it('should handle edge case where all entries need to be evicted', () => {
      const cacheService = new CacheService(mockLogger, {
        maxSize: 5,
        defaultTtl: 60000,
        maxMemoryBytes: 100,
        enableAutoCleanup: false,
      });

      // Fill with entries
      cacheService.set('key1', 'a'.repeat(30));
      cacheService.set('key2', 'b'.repeat(30));
      cacheService.set('key3', 'c'.repeat(30));

      // Add entry that requires all previous entries to be evicted
      cacheService.set('huge', 'x'.repeat(90));

      expect(cacheService.getSize()).toBe(1);
      expect(cacheService.has('huge')).toBe(true);

      cacheService.cleanup();
    });
  });

  describe('Auto Cleanup', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start auto cleanup when enabled in constructor', () => {
      const cacheService = new CacheService(mockLogger, {
        maxSize: 10,
        defaultTtl: 1000,
        enableAutoCleanup: true,
        cleanupIntervalMs: 5000,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'CacheService: Started auto cleanup with 5000ms interval'
      );

      cacheService.cleanup();
    });

    it('should perform auto cleanup of expired entries', () => {
      const cacheService = new CacheService(mockLogger, {
        maxSize: 10,
        defaultTtl: 1000, // 1 second TTL
        enableAutoCleanup: true,
        cleanupIntervalMs: 2000, // 2 second cleanup interval
      });

      // Add entries
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      cacheService.set('key3', 'value3', 5000); // 5 second TTL

      // Advance time past TTL but before cleanup
      jest.advanceTimersByTime(1500);

      // Entries should still be in cache (not cleaned yet)
      expect(cacheService.getSize()).toBe(3);

      // Advance time to trigger cleanup
      jest.advanceTimersByTime(500);

      // key1 and key2 should be cleaned up, key3 should remain
      expect(cacheService.getSize()).toBe(1);
      expect(cacheService.has('key3')).toBe(true);

      // Check cleanup logging
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(
          /CacheService: Auto cleanup removed 2 expired entries/
        )
      );

      const stats = cacheService.getStats();
      expect(stats.autoCleanups).toBe(1);
      expect(stats.expirations).toBe(2);

      cacheService.cleanup();
    });

    it('should handle auto cleanup with no expired entries', () => {
      const cacheService = new CacheService(mockLogger, {
        maxSize: 10,
        defaultTtl: 60000, // Long TTL
        enableAutoCleanup: true,
        cleanupIntervalMs: 1000,
      });

      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');

      // Trigger cleanup
      jest.advanceTimersByTime(1000);

      // No entries should be removed
      expect(cacheService.getSize()).toBe(2);

      // No cleanup log for zero removals
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringMatching(/Auto cleanup removed/)
      );

      cacheService.cleanup();
    });

    it('should use default cleanup interval when not specified', () => {
      const cacheService = new CacheService(mockLogger, {
        enableAutoCleanup: true,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'CacheService: Started auto cleanup with 60000ms interval'
      );

      cacheService.cleanup();
    });
  });

  describe('Error Handling', () => {
    it('should handle non-serializable objects in estimateEntrySize', () => {
      const cacheService = new CacheService(mockLogger, {
        maxSize: 10,
        defaultTtl: 60000,
        enableAutoCleanup: false,
      });

      // Create circular reference
      const circularObj = { a: 1 };
      circularObj.self = circularObj;

      // Should not throw, uses fallback size
      cacheService.set('circular', circularObj);
      expect(cacheService.get('circular')).toBe(circularObj);

      // Add more entries to check memory estimation worked
      for (let i = 0; i < 5; i++) {
        cacheService.set(`key${i}`, { data: i });
      }

      expect(cacheService.getSize()).toBeGreaterThan(0);

      cacheService.cleanup();
    });

    it('should handle error in estimateEntrySize during memory eviction', () => {
      const cacheService = new CacheService(mockLogger, {
        maxSize: 10,
        defaultTtl: 60000,
        maxMemoryBytes: 2000,
        enableAutoCleanup: false,
      });

      // Add circular reference objects
      for (let i = 0; i < 3; i++) {
        const circular = { id: i };
        circular.self = circular;
        cacheService.set(`circular${i}`, circular);
      }

      // Add normal object that triggers eviction
      cacheService.set('normal', 'x'.repeat(1000));

      // Should handle eviction despite serialization errors
      expect(cacheService.has('normal')).toBe(true);

      cacheService.cleanup();
    });
  });

  describe('getMemoryInfo', () => {
    it('should return accurate memory information', () => {
      const cacheService = new CacheService(mockLogger, {
        maxSize: 10,
        defaultTtl: 60000,
        maxMemoryBytes: 10000,
        enableAutoCleanup: false,
      });

      cacheService.set('key1', 'value1');
      cacheService.set('key2', { data: 'value2' });

      const memoryInfo = cacheService.getMemoryInfo();

      expect(memoryInfo).toEqual({
        currentBytes: expect.any(Number),
        maxBytes: 10000,
        usagePercent: expect.any(String),
        averageEntrySize: expect.any(Number),
        entryCount: 2,
      });

      expect(memoryInfo.currentBytes).toBeGreaterThan(0);
      expect(memoryInfo.currentBytes).toBeLessThan(10000);
      expect(parseFloat(memoryInfo.usagePercent)).toBeGreaterThan(0);
      expect(memoryInfo.averageEntrySize).toBeGreaterThan(0);

      cacheService.cleanup();
    });

    it('should handle empty cache in getMemoryInfo', () => {
      const cacheService = new CacheService(mockLogger, {
        enableAutoCleanup: false,
      });

      const memoryInfo = cacheService.getMemoryInfo();

      expect(memoryInfo).toEqual({
        currentBytes: 0,
        maxBytes: expect.any(Number),
        usagePercent: '0.00',
        averageEntrySize: 0,
        entryCount: 0,
      });

      cacheService.cleanup();
    });
  });

  describe('performManualCleanup', () => {
    it('should manually clean up expired entries and return results', () => {
      jest.useFakeTimers();

      const cacheService = new CacheService(mockLogger, {
        maxSize: 10,
        defaultTtl: 1000,
        enableAutoCleanup: false,
      });

      // Add entries with different TTLs
      cacheService.set('key1', 'value1', 500);
      cacheService.set('key2', 'value2', 500);
      cacheService.set('key3', 'value3', 2000);
      cacheService.set('key4', 'value4', 2000);

      const initialMemory = cacheService.getMemoryInfo().currentBytes;

      // Advance time to expire first two entries
      jest.advanceTimersByTime(1000);

      const cleanupResult = cacheService.performManualCleanup();

      expect(cleanupResult).toEqual({
        entriesRemoved: 2,
        memoryFreed: expect.any(Number),
        currentSize: 2,
        currentMemory: expect.any(Number),
      });

      expect(cleanupResult.memoryFreed).toBeGreaterThan(0);
      expect(cleanupResult.currentMemory).toBeLessThan(initialMemory);
      expect(cacheService.has('key1')).toBe(false);
      expect(cacheService.has('key2')).toBe(false);
      expect(cacheService.has('key3')).toBe(true);
      expect(cacheService.has('key4')).toBe(true);

      cacheService.cleanup();
      jest.useRealTimers();
    });

    it('should handle manual cleanup with no expired entries', () => {
      const cacheService = new CacheService(mockLogger, {
        defaultTtl: 60000,
        enableAutoCleanup: false,
      });

      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');

      const cleanupResult = cacheService.performManualCleanup();

      expect(cleanupResult).toEqual({
        entriesRemoved: 0,
        memoryFreed: 0,
        currentSize: 2,
        currentMemory: expect.any(Number),
      });

      cacheService.cleanup();
    });
  });

  describe('cleanup method', () => {
    it('should stop auto cleanup and clear cache', () => {
      jest.useFakeTimers();

      const cacheService = new CacheService(mockLogger, {
        enableAutoCleanup: true,
        cleanupIntervalMs: 1000,
      });

      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');

      // Verify auto cleanup is running
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Started auto cleanup')
      );

      // Call cleanup
      cacheService.cleanup();

      // Verify cleanup actions
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CacheService: Stopped auto cleanup'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cleared all')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CacheService: Cleaned up all resources'
      );

      // Verify cache is empty
      expect(cacheService.getSize()).toBe(0);

      // Advance timers to ensure cleanup timer is stopped
      jest.advanceTimersByTime(2000);

      // No auto cleanup should occur after cleanup() was called
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringMatching(/Auto cleanup/)
      );

      jest.useRealTimers();
    });

    it('should handle cleanup when auto cleanup is not enabled', () => {
      const cacheService = new CacheService(mockLogger, {
        enableAutoCleanup: false,
      });

      cacheService.set('key1', 'value1');

      cacheService.cleanup();

      // Should not log stop auto cleanup
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        'CacheService: Stopped auto cleanup'
      );

      // Should still clear cache
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cleared all')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CacheService: Cleaned up all resources'
      );
    });
  });

  describe('Edge Cases and Boundaries', () => {
    it('should handle updating entry with different memory size', () => {
      const cacheService = new CacheService(mockLogger, {
        maxMemoryBytes: 1000,
        enableAutoCleanup: false,
      });

      // Set initial value
      cacheService.set('key1', 'small');
      const initialMemory = cacheService.getMemoryInfo().currentBytes;

      // Update with larger value
      cacheService.set('key1', 'x'.repeat(100));
      const updatedMemory = cacheService.getMemoryInfo().currentBytes;

      expect(updatedMemory).toBeGreaterThan(initialMemory);
      expect(cacheService.get('key1')).toBe('x'.repeat(100));

      cacheService.cleanup();
    });

    it('should handle memory eviction when cache is empty', () => {
      const cacheService = new CacheService(mockLogger, {
        maxMemoryBytes: 10, // Very small limit
        enableAutoCleanup: false,
      });

      // Should handle adding entry larger than max memory
      cacheService.set('large', 'x'.repeat(20));

      // Entry should still be added (can't evict itself)
      expect(cacheService.has('large')).toBe(true);

      cacheService.cleanup();
    });

    it('should correctly calculate stats when cache is empty', () => {
      const cacheService = new CacheService(mockLogger, {
        enableAutoCleanup: false,
      });

      const stats = cacheService.getStats();

      expect(stats.averageEntrySize).toBe(0);
      expect(stats.efficiency.memoryEvictionRate).toBe('0%');
      expect(stats.efficiency.expirationRate).toBe('0%');

      cacheService.cleanup();
    });

    it('should handle edge case with empty tail key during memory eviction', () => {
      const cacheService = new CacheService(mockLogger, {
        maxSize: 10,
        defaultTtl: 60000,
        maxMemoryBytes: 100, // Very small to trigger eviction
        enableAutoCleanup: false,
      });

      // First, we need to set up a scenario where memory eviction will encounter
      // a node without a key. This is an extremely rare edge case that would only
      // occur if the internal LRU structure is in an inconsistent state.

      // Add a small entry first
      cacheService.set('small', 'x');

      // Try to trigger the edge case through normal operations
      // by filling cache and causing multiple evictions
      for (let i = 0; i < 5; i++) {
        cacheService.set(`key${i}`, 'x'.repeat(20));
      }

      // This large entry should trigger multiple evictions
      cacheService.set('huge', 'x'.repeat(90));

      // Verify cache still works correctly
      expect(cacheService.has('huge')).toBe(true);
      expect(cacheService.getSize()).toBeGreaterThan(0);

      cacheService.cleanup();
    });
  });

  describe('Pattern invalidation and manual cleanup', () => {
    it('invalidates cache entries that match a pattern and reports freed memory', () => {
      const cacheService = new CacheService(mockLogger, {
        maxSize: 10,
        defaultTtl: 60000,
        enableAutoCleanup: false,
        maxMemoryBytes: 10 * 1024,
      });

      cacheService.set('user:1', 'alpha');
      cacheService.set('user:2', 'beta');
      cacheService.set('session:active', 'gamma');

      const removedCount = cacheService.invalidatePattern(/^user:/);

      expect(removedCount).toBe(2);
      expect(cacheService.getSize()).toBe(1);
      expect(cacheService.has('session:active')).toBe(true);
      expect(
        mockLogger.info.mock.calls.some(([message]) =>
          message.includes('Invalidated 2 cache entries matching pattern')
        )
      ).toBe(true);

      cacheService.cleanup();
    });

    it('skips missing nodes when pattern invalidation sees concurrent deletions', () => {
      const cacheService = new CacheService(mockLogger, {
        maxSize: 10,
        defaultTtl: 60000,
        enableAutoCleanup: false,
        maxMemoryBytes: 10 * 1024,
      });

      cacheService.set('user:1', 'alpha');
      cacheService.set('user:2', 'beta');

      const dynamicPattern = {
        test: jest.fn((key) => {
          if (key === 'user:1') {
            cacheService.invalidate(key);
            return true;
          }
          return key.startsWith('user:');
        }),
        toString: () => '/dynamic-user/',
      };

      const removedCount = cacheService.invalidatePattern(dynamicPattern);

      expect(dynamicPattern.test).toHaveBeenCalledTimes(2);
      expect(removedCount).toBe(1);
      expect(cacheService.has('user:2')).toBe(false);
      expect(
        mockLogger.info.mock.calls.some(([message]) =>
          message.includes(
            'Invalidated 1 cache entries matching pattern /dynamic-user/'
          )
        )
      ).toBe(true);

      cacheService.cleanup();
    });

    it('evicts the least recently used entry when size limit is exceeded', () => {
      const cacheService = new CacheService(mockLogger, {
        maxSize: 2,
        defaultTtl: 60000,
        enableAutoCleanup: false,
        maxMemoryBytes: 10 * 1024,
      });

      cacheService.set('alpha', 'value-a');
      cacheService.set('beta', 'value-b');

      // Adding a third entry should evict the least recently used ("alpha")
      cacheService.set('gamma', 'value-c');

      expect(cacheService.getSize()).toBe(2);
      expect(cacheService.has('gamma')).toBe(true);
      expect(cacheService.has('alpha')).toBe(false);

      const evictionLog = mockLogger.debug.mock.calls.find(([message]) =>
        message.includes("Evicted LRU entry with key 'alpha'")
      );
      expect(evictionLog).toBeDefined();

      const stats = cacheService.getStats();
      expect(stats.evictions).toBeGreaterThan(0);

      cacheService.cleanup();
    });

    it('handles eviction guard when the tail node is missing a key', () => {
      const originalMapSet = Map.prototype.set;
      const insertedNodes = Object.create(null);

      Map.prototype.set = function patchedSet(key, value) {
        if (value && typeof value === 'object' && 'entry' in value) {
          insertedNodes[key] = value;
        }
        return originalMapSet.call(this, key, value);
      };

      const cacheService = new CacheService(mockLogger, {
        maxSize: 2,
        defaultTtl: 60000,
        enableAutoCleanup: false,
        maxMemoryBytes: 10 * 1024,
      });

      try {
        cacheService.set('stale-key', 'old');
        cacheService.set('fresh-key', 'fresh');

        const staleNode = insertedNodes['stale-key'];
        staleNode.key = null;

        cacheService.set('new-key', 'brand-new');

        expect(cacheService.has('new-key')).toBe(true);

        const evictionLogs = mockLogger.debug.mock.calls.filter(([message]) =>
          message.includes('Evicted LRU entry with key')
        );
        expect(evictionLogs.length).toBeGreaterThanOrEqual(1);

        cacheService.invalidate('stale-key');
      } finally {
        Map.prototype.set = originalMapSet;
        cacheService.cleanup();
      }
    });

    it('performs manual cleanup of expired entries and updates statistics', () => {
      jest.useFakeTimers();
      const start = new Date('2024-01-01T00:00:00.000Z');
      jest.setSystemTime(start);

      const cacheService = new CacheService(mockLogger, {
        maxSize: 5,
        defaultTtl: 1000,
        enableAutoCleanup: false,
        maxMemoryBytes: 10 * 1024,
      });

      cacheService.set('expired', 'stale', 10);
      cacheService.set('active', 'fresh', 10_000);

      jest.setSystemTime(new Date(start.getTime() + 50));

      const result = cacheService.performManualCleanup();

      expect(result.entriesRemoved).toBe(1);
      expect(result.memoryFreed).toBeGreaterThan(0);
      expect(result.currentSize).toBe(1);
      expect(cacheService.has('expired')).toBe(false);
      expect(cacheService.has('active')).toBe(true);

      const stats = cacheService.getStats();
      expect(stats.expirations).toBeGreaterThanOrEqual(1);
      expect(stats.autoCleanups).toBeGreaterThanOrEqual(1);

      const cleanupLog = mockLogger.debug.mock.calls.find(([message]) =>
        message.includes('Auto cleanup removed 1 expired entries, freed')
      );
      expect(cleanupLog).toBeDefined();

      cacheService.cleanup();
      jest.useRealTimers();
    });

    it('ignores missing nodes during manual cleanup when entries were removed externally', () => {
      jest.useFakeTimers();
      const start = new Date('2024-01-01T00:00:00.000Z');
      jest.setSystemTime(start);

      const originalMapSet = Map.prototype.set;
      const originalMapGet = Map.prototype.get;
      let capturedMap = null;

      Map.prototype.set = function patchedSet(key, value) {
        if (
          !capturedMap &&
          value &&
          typeof value === 'object' &&
          'entry' in value
        ) {
          capturedMap = this;
        }
        return originalMapSet.call(this, key, value);
      };

      const cacheService = new CacheService(mockLogger, {
        maxSize: 5,
        defaultTtl: 1000,
        enableAutoCleanup: false,
        maxMemoryBytes: 10 * 1024,
      });

      try {
        cacheService.set('stale-during-cleanup', 'stale', 10);
        cacheService.set('active', 'fresh', 10_000);

        jest.setSystemTime(new Date(start.getTime() + 50));

        let forceMissingNode = true;
        Map.prototype.get = function patchedGet(key) {
          if (
            forceMissingNode &&
            this === capturedMap &&
            key === 'stale-during-cleanup'
          ) {
            forceMissingNode = false;
            return undefined;
          }
          return originalMapGet.call(this, key);
        };

        const result = cacheService.performManualCleanup();

        expect(result.entriesRemoved).toBe(0);
        expect(result.currentSize).toBe(2);
        expect(mockLogger.debug).not.toHaveBeenCalledWith(
          expect.stringContaining('Auto cleanup removed')
        );

        cacheService.invalidate('stale-during-cleanup');
      } finally {
        Map.prototype.set = originalMapSet;
        Map.prototype.get = originalMapGet;
        cacheService.cleanup();
        jest.useRealTimers();
      }
    });
  });
});
