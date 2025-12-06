/**
 * @file Unit tests for UnifiedCache
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import {
  UnifiedCache,
  EvictionPolicy,
} from '../../../src/cache/UnifiedCache.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { CacheError } from '../../../src/errors/cacheError.js';

describe('UnifiedCache', () => {
  let testBed;
  let cache;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    cache = new UnifiedCache(
      { logger: mockLogger },
      {
        maxSize: 5,
        ttl: 1000,
        evictionPolicy: EvictionPolicy.LRU,
        enableMetrics: true,
      }
    );
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Construction and Configuration', () => {
    it('should create cache with default configuration', () => {
      const defaultCache = new UnifiedCache({ logger: mockLogger });
      expect(defaultCache).toBeDefined();
      expect(defaultCache.getMetrics().config.maxSize).toBe(1000);
      expect(defaultCache.getMetrics().config.evictionPolicy).toBe(
        EvictionPolicy.LRU
      );
    });

    it('should create cache with custom configuration', () => {
      const customCache = new UnifiedCache(
        { logger: mockLogger },
        {
          maxSize: 100,
          ttl: 5000,
          evictionPolicy: EvictionPolicy.LFU,
          enableMetrics: false,
        }
      );

      const metrics = customCache.getMetrics();
      expect(metrics.config.maxSize).toBe(100);
      expect(metrics.config.ttl).toBe(5000);
      expect(metrics.config.evictionPolicy).toBe(EvictionPolicy.LFU);
      expect(metrics.stats).toBeNull();
    });

    it('should throw error for invalid eviction policy', () => {
      expect(() => {
        new UnifiedCache(
          { logger: mockLogger },
          {
            evictionPolicy: 'invalid',
          }
        );
      }).toThrow(InvalidArgumentError);
    });

    it('should support all eviction policies', () => {
      const policies = [
        EvictionPolicy.LRU,
        EvictionPolicy.LFU,
        EvictionPolicy.FIFO,
      ];

      policies.forEach((policy) => {
        expect(() => {
          new UnifiedCache({ logger: mockLogger }, { evictionPolicy: policy });
        }).not.toThrow();
      });
    });
  });

  describe('Basic Cache Operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should check if keys exist', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should delete values', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('should clear all values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
    });
  });

  describe('Generator Function Support', () => {
    it('should use generator function when key is not found', () => {
      const generator = jest.fn().mockReturnValue('generated_value');

      const result = cache.get('key1', generator);

      expect(generator).toHaveBeenCalledWith('key1');
      expect(result).toBe('generated_value');
      expect(cache.get('key1')).toBe('generated_value'); // Should be cached now
    });

    it('should not call generator when key exists', () => {
      cache.set('key1', 'existing_value');
      const generator = jest.fn().mockReturnValue('generated_value');

      const result = cache.get('key1', generator);

      expect(generator).not.toHaveBeenCalled();
      expect(result).toBe('existing_value');
    });

    it('should handle async generators', async () => {
      const generator = jest.fn().mockResolvedValue('async_generated_value');

      const result = await cache.get('key1', generator);

      expect(generator).toHaveBeenCalledWith('key1');
      expect(result).toBe('async_generated_value');
      expect(cache.get('key1')).toBe('async_generated_value');
    });

    it('should handle generator errors', () => {
      const generator = jest.fn().mockImplementation(() => {
        throw new Error('Generator failed');
      });

      expect(() => {
        cache.get('key1', generator);
      }).toThrow(CacheError);
    });

    it('should not cache undefined values from generator', () => {
      const generator = jest.fn().mockReturnValue(undefined);

      const result = cache.get('key1', generator);

      expect(result).toBeUndefined();
      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('Input Validation', () => {
    it('should validate cache keys', () => {
      expect(() => cache.get('')).toThrow(InvalidArgumentError);
      expect(() => cache.get(null)).toThrow(InvalidArgumentError);
      expect(() => cache.get(123)).toThrow(InvalidArgumentError);

      expect(() => cache.set('', 'value')).toThrow(InvalidArgumentError);
      expect(() => cache.set(null, 'value')).toThrow(InvalidArgumentError);
    });

    it('should return false for invalid keys in has and delete operations', () => {
      expect(cache.has('')).toBe(false);
      expect(cache.has(null)).toBe(false);
      expect(cache.delete('')).toBe(false);
      expect(cache.delete(null)).toBe(false);
    });

    it('should handle edge case values', () => {
      const testCases = [
        ['null', null],
        ['zero', 0],
        ['empty_string', ''],
        ['false', false],
        ['empty_object', {}],
        ['empty_array', []],
      ];

      testCases.forEach(([key, value]) => {
        if (key === 'undefined') return; // Skip undefined as it's filtered out

        cache.set(key, value);
        expect(cache.get(key)).toEqual(value);
        expect(cache.has(key)).toBe(true);
      });
    });

    it('should warn when caching undefined values', () => {
      cache.set('key1', undefined);
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('Pattern-based Invalidation', () => {
    beforeEach(() => {
      cache.set('user:1:profile', 'profile1');
      cache.set('user:1:settings', 'settings1');
      cache.set('user:2:profile', 'profile2');
      cache.set('post:1:data', 'post1');
      cache.set('post:2:data', 'post2');
    });

    it('should invalidate entries by string pattern', () => {
      const invalidated = cache.invalidate('user:1');

      expect(invalidated).toBe(2);
      expect(cache.has('user:1:profile')).toBe(false);
      expect(cache.has('user:1:settings')).toBe(false);
      expect(cache.has('user:2:profile')).toBe(true);
      expect(cache.has('post:1:data')).toBe(true);
    });

    it('should invalidate entries by regex pattern', () => {
      const invalidated = cache.invalidate(/^post:\d+/);

      expect(invalidated).toBe(2);
      expect(cache.has('post:1:data')).toBe(false);
      expect(cache.has('post:2:data')).toBe(false);
      expect(cache.has('user:1:profile')).toBe(true);
    });

    it('should throw error for empty pattern', () => {
      expect(() => cache.invalidate('')).toThrow(InvalidArgumentError);
      expect(() => cache.invalidate(null)).toThrow(InvalidArgumentError);
    });

    it('should return 0 when no entries match pattern', () => {
      const invalidated = cache.invalidate('nonexistent');
      expect(invalidated).toBe(0);
    });
  });

  describe('Metrics and Statistics', () => {
    it('should track hit and miss statistics', () => {
      cache.set('key1', 'value1');

      cache.get('key1'); // Hit
      cache.get('key2'); // Miss
      cache.get('key1'); // Hit
      cache.get('key3'); // Miss

      const metrics = cache.getMetrics();
      expect(metrics.stats.hits).toBe(2);
      expect(metrics.stats.misses).toBe(2);
      expect(metrics.hitRate).toBe(0.5);
    });

    it('should track set and delete operations', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.delete('key1');

      const metrics = cache.getMetrics();
      expect(metrics.stats.sets).toBe(2);
      expect(metrics.stats.deletes).toBe(1);
    });

    it('should provide comprehensive metrics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const metrics = cache.getMetrics();

      expect(metrics.size).toBe(2);
      expect(metrics.maxSize).toBe(5);
      expect(metrics.strategyName).toBe('LRU');
      expect(metrics.config).toBeDefined();
      expect(metrics.stats).toBeDefined();
    });

    it('should include strategy specific metrics when available', () => {
      const fifoCache = new UnifiedCache(
        { logger: mockLogger },
        {
          evictionPolicy: EvictionPolicy.FIFO,
        }
      );

      fifoCache.set('fifo-key', 'value');

      const fifoMetrics = fifoCache.getMetrics();

      expect(fifoMetrics.insertionStats).toMatchObject({
        oldestKey: 'fifo-key',
        newestKey: 'fifo-key',
      });
      expect(fifoMetrics.frequencyStats).toBeUndefined();
    });

    it('should not track stats when metrics are disabled', () => {
      const noMetricsCache = new UnifiedCache(
        { logger: mockLogger },
        {
          enableMetrics: false,
        }
      );

      noMetricsCache.set('key1', 'value1');
      noMetricsCache.get('key1');

      const metrics = noMetricsCache.getMetrics();
      expect(metrics.stats).toBeNull();
      expect(metrics.hitRate).toBe(0);
    });

    it('should reset statistics', () => {
      cache.set('key1', 'value1');
      cache.get('key1');

      let metrics = cache.getMetrics();
      expect(metrics.stats.hits).toBe(1);

      cache.resetStats();

      metrics = cache.getMetrics();
      expect(metrics.stats.hits).toBe(0);
    });
  });

  describe('Memory Usage Tracking', () => {
    it('should provide memory usage information', () => {
      cache.set('key1', 'value1');

      const memoryUsage = cache.getMemoryUsage();
      expect(memoryUsage.currentBytes).toBeGreaterThanOrEqual(0);
      expect(memoryUsage.currentMB).toBeGreaterThanOrEqual(0);
    });

    it('should calculate utilization percentage when max memory is set', () => {
      const memoryCache = new UnifiedCache(
        { logger: mockLogger },
        {
          maxMemoryUsage: 1024 * 1024, // 1MB
        }
      );

      memoryCache.set('key1', 'value1');

      const memoryUsage = memoryCache.getMemoryUsage();
      expect(memoryUsage.maxBytes).toBe(1024 * 1024);
      expect(memoryUsage.maxMB).toBe(1);
      expect(memoryUsage.utilizationPercent).toBeGreaterThan(0);
    });
  });

  describe('Pruning Operations', () => {
    it('should prune expired entries', (done) => {
      const shortTtlCache = new UnifiedCache(
        { logger: mockLogger },
        {
          ttl: 50,
          enableMetrics: true,
        }
      );

      shortTtlCache.set('key1', 'value1');
      shortTtlCache.set('key2', 'value2');

      setTimeout(() => {
        const pruned = shortTtlCache.prune();
        expect(pruned).toBeGreaterThan(0);

        const metrics = shortTtlCache.getMetrics();
        expect(metrics.stats.prunings).toBe(1);
        done();
      }, 100);
    });

    it('should support aggressive pruning', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const pruned = cache.prune(true);
      expect(pruned).toBe(2);
      expect(cache.getMetrics().size).toBe(0);
    });
  });

  describe('Debugging Support', () => {
    it('should provide entry listing with limit', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const entries = cache.getEntries(2);
      expect(entries).toHaveLength(2);
      expect(entries[0]).toHaveLength(2); // [key, value] pairs
    });

    it('should provide key listing with limit', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const keys = cache.getKeys(2);
      expect(keys).toHaveLength(2);
      expect(typeof keys[0]).toBe('string');
    });

    it('should handle empty cache in debug methods', () => {
      const entries = cache.getEntries();
      const keys = cache.getKeys();

      expect(entries).toHaveLength(0);
      expect(keys).toHaveLength(0);
    });
  });

  describe('TTL Override Support', () => {
    it('should support per-entry TTL override', (done) => {
      cache.set('key1', 'value1', { ttl: 50 });
      cache.set('key2', 'value2'); // Uses default TTL

      setTimeout(() => {
        expect(cache.get('key1')).toBeUndefined();
        expect(cache.get('key2')).toBe('value2');
        done();
      }, 100);
    });
  });

  describe('Strategy-Specific Behavior', () => {
    it('should use LRU strategy correctly', () => {
      const lruCache = new UnifiedCache(
        { logger: mockLogger },
        {
          maxSize: 2,
          evictionPolicy: EvictionPolicy.LRU,
        }
      );

      lruCache.set('key1', 'value1');
      lruCache.set('key2', 'value2');
      lruCache.get('key1'); // Make key1 most recently used
      lruCache.set('key3', 'value3'); // Should evict key2

      expect(lruCache.has('key1')).toBe(true);
      expect(lruCache.has('key2')).toBe(false);
      expect(lruCache.has('key3')).toBe(true);
    });

    it('should use LFU strategy correctly', () => {
      const lfuCache = new UnifiedCache(
        { logger: mockLogger },
        {
          maxSize: 2,
          evictionPolicy: EvictionPolicy.LFU,
        }
      );

      lfuCache.set('key1', 'value1');
      lfuCache.set('key2', 'value2');
      lfuCache.get('key1'); // Increase frequency of key1
      lfuCache.get('key1'); // Increase frequency of key1 again
      lfuCache.set('key3', 'value3'); // Should evict key2 (lower frequency)

      expect(lfuCache.has('key1')).toBe(true);
      expect(lfuCache.has('key2')).toBe(false);
      expect(lfuCache.has('key3')).toBe(true);
    });

    it('should use FIFO strategy correctly', () => {
      const fifoCache = new UnifiedCache(
        { logger: mockLogger },
        {
          maxSize: 2,
          evictionPolicy: EvictionPolicy.FIFO,
        }
      );

      fifoCache.set('key1', 'value1'); // First in
      fifoCache.set('key2', 'value2'); // Second in
      fifoCache.get('key1'); // Access doesn't matter in FIFO
      fifoCache.set('key3', 'value3'); // Should evict key1 (first in, first out)

      expect(fifoCache.has('key1')).toBe(false);
      expect(fifoCache.has('key2')).toBe(true);
      expect(fifoCache.has('key3')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle strategy creation errors gracefully', () => {
      // This is primarily for internal errors, but we should handle them
      expect(() => {
        new UnifiedCache(
          { logger: mockLogger },
          {
            evictionPolicy: 'unsupported_strategy',
          }
        );
      }).toThrow(InvalidArgumentError);
    });
  });
});
