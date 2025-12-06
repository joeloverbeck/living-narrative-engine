/**
 * @file cacheService.test.js - Unit tests for CacheService
 */

import { jest } from '@jest/globals';
import CacheService from '../../../src/services/cacheService.js';

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('CacheService', () => {
  let cacheService;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    cacheService = new CacheService(mockLogger, {
      maxSize: 3,
      defaultTtl: 1000, // 1 second for testing
      enableAutoCleanup: false, // Disable auto cleanup for tests
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any running timers
    if (cacheService && cacheService.cleanup) {
      cacheService.cleanup();
    }
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default configuration when not provided', () => {
      const service = new CacheService(mockLogger, {
        enableAutoCleanup: false,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CacheService: Initialized with optimized configuration',
        expect.objectContaining({
          maxSize: 1000,
          defaultTtl: 300000,
          maxMemoryBytes: expect.any(Number),
          enableAutoCleanup: false,
        })
      );
      service.cleanup();
    });

    it('should initialize with provided configuration', () => {
      const service = new CacheService(mockLogger, {
        maxSize: 3,
        defaultTtl: 1000,
        enableAutoCleanup: false,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'CacheService: Initialized with optimized configuration',
        expect.objectContaining({
          maxSize: 3,
          defaultTtl: 1000,
          enableAutoCleanup: false,
        })
      );
      service.cleanup();
    });

    it('should throw error when logger is not provided', () => {
      expect(() => new CacheService()).toThrow();
    });
  });

  describe('get', () => {
    it('should return undefined for non-existent key', () => {
      const result = cacheService.get('nonexistent');
      expect(result).toBeUndefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "CacheService: Cache miss for key 'nonexistent'"
      );
    });

    it('should return cached value for existing key', () => {
      cacheService.set('key1', 'value1');
      const result = cacheService.get('key1');
      expect(result).toBe('value1');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "CacheService: Cache hit for key 'key1'"
      );
    });

    it('should return undefined for expired entry', async () => {
      cacheService.set('key1', 'value1', 100); // 100ms TTL
      await new Promise((resolve) => setTimeout(resolve, 150)); // Wait for expiration

      const result = cacheService.get('key1');
      expect(result).toBeUndefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "CacheService: Cache entry expired for key 'key1'"
      );
    });

    it('should handle complex objects as values', () => {
      const complexValue = { nested: { data: [1, 2, 3] } };
      cacheService.set('complex', complexValue);
      const result = cacheService.get('complex');
      expect(result).toEqual(complexValue);
    });

    it('should update LRU order on get', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      cacheService.set('key3', 'value3');

      // Access key1 to move it to end
      cacheService.get('key1');

      // Add a new key, should evict key2 (oldest untouched)
      cacheService.set('key4', 'value4');

      expect(cacheService.get('key1')).toBe('value1');
      expect(cacheService.get('key2')).toBeUndefined();
      expect(cacheService.get('key3')).toBe('value3');
      expect(cacheService.get('key4')).toBe('value4');
    });
  });

  describe('set', () => {
    it('should cache value with default TTL', () => {
      cacheService.set('key1', 'value1');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "CacheService: Cached value for key 'key1' with TTL 1000ms"
      );
    });

    it('should cache value with custom TTL', () => {
      cacheService.set('key1', 'value1', 2000);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "CacheService: Cached value for key 'key1' with TTL 2000ms"
      );
    });

    it('should gracefully handle memory eviction when tail nodes lack keys', () => {
      const logger = createMockLogger();
      const smallCacheService = new CacheService(logger, {
        maxSize: 5,
        defaultTtl: 1000,
        maxMemoryBytes: 50,
        enableAutoCleanup: false,
      });

      // Ignore the initialization log so we can focus on eviction behavior
      logger.info.mockClear();

      smallCacheService.set(undefined, 'seed-value');

      expect(() => {
        smallCacheService.set('next', 'x'.repeat(200));
      }).not.toThrow();

      expect(
        logger.info.mock.calls.some(
          ([message]) =>
            typeof message === 'string' && message.includes('Evicted')
        )
      ).toBe(false);

      expect(smallCacheService.get('next')).toBe('x'.repeat(200));

      smallCacheService.cleanup();
    });

    it('should evict oldest entry when cache is full', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      cacheService.set('key3', 'value3');
      cacheService.set('key4', 'value4'); // Should evict key1

      expect(cacheService.get('key1')).toBeUndefined();
      expect(cacheService.get('key2')).toBe('value2');
      expect(cacheService.get('key3')).toBe('value3');
      expect(cacheService.get('key4')).toBe('value4');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "CacheService: Evicted LRU entry with key 'key1'"
      );
    });

    it('should update existing key without eviction', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      cacheService.set('key3', 'value3');
      cacheService.set('key2', 'updatedValue2'); // Update existing

      expect(cacheService.get('key1')).toBe('value1');
      expect(cacheService.get('key2')).toBe('updatedValue2');
      expect(cacheService.get('key3')).toBe('value3');
    });
  });

  describe('getOrLoad', () => {
    it('should return cached value when available', async () => {
      cacheService.set('key1', 'cachedValue');
      const loader = jest.fn().mockResolvedValue('loadedValue');

      const result = await cacheService.getOrLoad('key1', loader);
      expect(result).toBe('cachedValue');
      expect(loader).not.toHaveBeenCalled();
    });

    it('should load and cache value when not available', async () => {
      const loader = jest.fn().mockResolvedValue('loadedValue');

      const result = await cacheService.getOrLoad('key1', loader);
      expect(result).toBe('loadedValue');
      expect(loader).toHaveBeenCalled();
      expect(cacheService.get('key1')).toBe('loadedValue');
    });

    it('should use custom TTL when provided', async () => {
      const loader = jest.fn().mockResolvedValue('loadedValue');

      await cacheService.getOrLoad('key1', loader, 500);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "CacheService: Cached value for key 'key1' with TTL 500ms"
      );
    });

    it('should propagate loader errors', async () => {
      const error = new Error('Load failed');
      const loader = jest.fn().mockRejectedValue(error);

      await expect(cacheService.getOrLoad('key1', loader)).rejects.toThrow(
        'Load failed'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        "CacheService: Error loading value for key 'key1'",
        error
      );
    });
  });

  describe('invalidate', () => {
    it('should remove existing entry', () => {
      cacheService.set('key1', 'value1');
      const result = cacheService.invalidate('key1');

      expect(result).toBe(true);
      expect(cacheService.get('key1')).toBeUndefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "CacheService: Invalidated cache entry for key 'key1'"
      );
    });

    it('should return false for non-existent key', () => {
      const result = cacheService.invalidate('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('invalidatePattern', () => {
    it('should invalidate all matching entries', () => {
      cacheService.set('user:1', 'value1');
      cacheService.set('user:2', 'value2');
      cacheService.set('post:1', 'value3');

      const count = cacheService.invalidatePattern(/^user:/);

      expect(count).toBe(2);
      expect(cacheService.get('user:1')).toBeUndefined();
      expect(cacheService.get('user:2')).toBeUndefined();
      expect(cacheService.get('post:1')).toBe('value3');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'CacheService: Invalidated 2 cache entries matching pattern /^user:/'
        )
      );
    });

    it('should return 0 when no entries match', () => {
      cacheService.set('post:1', 'value1');
      const count = cacheService.invalidatePattern(/^user:/);
      expect(count).toBe(0);
    });
  });

  describe('auto cleanup operations', () => {
    it('should remove expired entries during auto cleanup and update statistics', () => {
      jest.useFakeTimers();

      // Replace the default service with one that has auto cleanup enabled
      cacheService.cleanup();
      cacheService = new CacheService(mockLogger, {
        maxSize: 5,
        defaultTtl: 50,
        enableAutoCleanup: true,
        cleanupIntervalMs: 10,
      });

      cacheService.set('short-lived', 'value', 30);
      cacheService.set('long-lived', 'value', 1000);

      // Focus on auto cleanup log output and skip initialization chatter
      mockLogger.debug.mockClear();

      // Advance timers so the cleanup interval runs multiple times
      jest.advanceTimersByTime(25); // two passes, entry not yet expired
      jest.advanceTimersByTime(20); // pushes beyond TTL, triggers cleanup

      const stats = cacheService.getStats();
      expect(stats.expirations).toBeGreaterThanOrEqual(1);
      expect(stats.autoCleanups).toBeGreaterThanOrEqual(1);

      const cleanupLog = mockLogger.debug.mock.calls.find(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('CacheService: Auto cleanup removed')
      );
      expect(cleanupLog).toBeDefined();
      expect(cleanupLog[0]).toMatch(/Auto cleanup removed \d+ expired entries/);
      expect(cacheService.has('short-lived')).toBe(false);
      expect(cacheService.has('long-lived')).toBe(true);

      cacheService.cleanup();
      jest.useRealTimers();
    });
  });

  describe('memory estimation fallbacks', () => {
    it('should use default size when cache entry cannot be serialized', () => {
      const circularValue = {};
      circularValue.self = circularValue;

      cacheService.set('circular', circularValue);

      const memoryInfo = cacheService.getMemoryInfo();
      expect(memoryInfo.currentBytes).toBe(512);
      expect(memoryInfo.averageEntrySize).toBe(512);
      expect(cacheService.get('circular')).toBe(circularValue);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      cacheService.set('key3', 'value3');

      cacheService.clear();

      expect(cacheService.get('key1')).toBeUndefined();
      expect(cacheService.get('key2')).toBeUndefined();
      expect(cacheService.get('key3')).toBeUndefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CacheService: Cleared all 3 cache entries'
      );
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', () => {
      // Generate some activity
      cacheService.set('key1', 'value1');
      cacheService.get('key1'); // hit
      cacheService.get('key2'); // miss
      cacheService.set('key2', 'value2');
      cacheService.set('key3', 'value3');
      cacheService.set('key4', 'value4'); // causes eviction

      const stats = cacheService.getStats();

      expect(stats).toEqual(
        expect.objectContaining({
          hits: 1,
          misses: 1,
          evictions: 1,
          expirations: 0,
          size: 3,
          maxSize: 3,
          hitRate: '50.00%',
          currentMemoryBytes: expect.any(Number),
          maxMemoryBytes: expect.any(Number),
          memoryUsagePercent: expect.any(String),
          averageEntrySize: expect.any(Number),
          efficiency: expect.objectContaining({
            memoryEvictionRate: expect.any(String),
            expirationRate: expect.any(String),
            autoCleanupCount: expect.any(Number),
          }),
        })
      );
    });

    it('should handle zero total requests', () => {
      const stats = cacheService.getStats();
      expect(stats.hitRate).toBe('0%');
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics', () => {
      cacheService.get('key1'); // miss
      cacheService.set('key1', 'value1');
      cacheService.get('key1'); // hit

      cacheService.resetStats();
      const stats = cacheService.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
      expect(stats.expirations).toBe(0);
      expect(stats.memoryEvictions).toBe(0);
      expect(stats.autoCleanups).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CacheService: Reset enhanced cache statistics'
      );
    });
  });

  describe('getSize', () => {
    it('should return current cache size', () => {
      expect(cacheService.getSize()).toBe(0);

      cacheService.set('key1', 'value1');
      expect(cacheService.getSize()).toBe(1);

      cacheService.set('key2', 'value2');
      expect(cacheService.getSize()).toBe(2);

      cacheService.invalidate('key1');
      expect(cacheService.getSize()).toBe(1);
    });
  });

  describe('has', () => {
    it('should return true for existing non-expired entry', () => {
      cacheService.set('key1', 'value1');
      expect(cacheService.has('key1')).toBe(true);
    });

    it('should return false for non-existent key', () => {
      expect(cacheService.has('nonexistent')).toBe(false);
    });

    it('should return false and clean up expired entry', async () => {
      cacheService.set('key1', 'value1', 100); // 100ms TTL
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(cacheService.has('key1')).toBe(false);
      expect(cacheService.getSize()).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle null values', () => {
      cacheService.set('key1', null);
      expect(cacheService.get('key1')).toBeNull();
    });

    it('should handle undefined values', () => {
      cacheService.set('key1', undefined);
      expect(cacheService.get('key1')).toBeUndefined();
      expect(cacheService.has('key1')).toBe(true); // Key exists even with undefined value
    });

    it('should handle empty string keys', () => {
      cacheService.set('', 'emptyKeyValue');
      expect(cacheService.get('')).toBe('emptyKeyValue');
    });

    it('should handle very large values', () => {
      const largeArray = new Array(10000).fill('data');
      cacheService.set('large', largeArray);
      expect(cacheService.get('large')).toEqual(largeArray);
    });
  });
});
