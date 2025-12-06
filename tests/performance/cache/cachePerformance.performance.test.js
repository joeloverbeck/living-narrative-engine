/**
 * @file Performance tests for unified cache infrastructure
 * Tests cache performance under various load conditions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { UnifiedCache } from '../../../src/cache/UnifiedCache.js';
import { CacheInvalidationManager } from '../../../src/cache/CacheInvalidationManager.js';
import { CacheMetrics } from '../../../src/cache/CacheMetrics.js';

describe('Cache Performance Tests', () => {
  let testBed;
  let mockLogger;
  let mockValidatedEventDispatcher;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockValidatedEventDispatcher = testBed.createMock(
      'validatedEventDispatcher',
      ['on', 'off', 'dispatch']
    );
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('UnifiedCache Performance', () => {
    it('should handle high-volume set operations efficiently', () => {
      const cache = new UnifiedCache(
        { logger: mockLogger },
        {
          maxSize: 10000,
          evictionPolicy: 'lru',
        }
      );

      const startTime = process.hrtime.bigint();
      const itemCount = 5000;

      for (let i = 0; i < itemCount; i++) {
        cache.set(`key${i}`, {
          id: i,
          value: `value${i}`,
          timestamp: Date.now(),
        });
      }

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      // Should complete within 500ms (target: ~10,000 ops/sec)
      expect(duration).toBeLessThan(500);

      const metrics = cache.getMetrics();
      expect(metrics.stats.sets).toBe(itemCount);
      expect(metrics.size).toBeLessThanOrEqual(10000);

      console.log(
        `Set Performance: ${itemCount} operations in ${duration.toFixed(2)}ms (${((itemCount / duration) * 1000).toFixed(0)} ops/sec)`
      );
    });

    it('should handle high-volume get operations efficiently', () => {
      const cache = new UnifiedCache(
        { logger: mockLogger },
        {
          maxSize: 10000,
          evictionPolicy: 'lru',
        }
      );

      // Pre-populate cache
      const itemCount = 2000;
      for (let i = 0; i < itemCount; i++) {
        cache.set(`key${i}`, { id: i, value: `value${i}` });
      }

      const startTime = process.hrtime.bigint();

      // Perform random gets
      for (let i = 0; i < itemCount * 2; i++) {
        const keyIndex = Math.floor(Math.random() * itemCount);
        cache.get(`key${keyIndex}`);
      }

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      // Should complete within 200ms
      expect(duration).toBeLessThan(200);

      const metrics = cache.getMetrics();
      expect(metrics.stats.hits).toBeGreaterThan(0);

      console.log(
        `Get Performance: ${itemCount * 2} operations in ${duration.toFixed(2)}ms (${(((itemCount * 2) / duration) * 1000).toFixed(0)} ops/sec)`
      );
    });

    it('should handle mixed read/write workload efficiently', () => {
      const cache = new UnifiedCache(
        { logger: mockLogger },
        {
          maxSize: 5000,
          evictionPolicy: 'lru',
        }
      );

      const operations = 10000;
      const startTime = process.hrtime.bigint();

      for (let i = 0; i < operations; i++) {
        if (i % 3 === 0) {
          // Write operation
          cache.set(`key${i % 1000}`, { id: i, value: `value${i}` });
        } else {
          // Read operation
          cache.get(`key${Math.floor(Math.random() * 1000)}`);
        }
      }

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      // Should complete within 800ms
      expect(duration).toBeLessThan(800);

      const metrics = cache.getMetrics();
      expect(
        metrics.stats.sets + metrics.stats.hits + metrics.stats.misses
      ).toBe(operations);

      console.log(
        `Mixed Workload: ${operations} operations in ${duration.toFixed(2)}ms (${((operations / duration) * 1000).toFixed(0)} ops/sec)`
      );
    });

    it('should compare performance across eviction strategies', () => {
      const strategies = ['lru', 'lfu', 'fifo'];
      const results = {};

      strategies.forEach((strategy) => {
        const cache = new UnifiedCache(
          { logger: mockLogger },
          {
            maxSize: 1000,
            evictionPolicy: strategy,
          }
        );

        const operations = 2000;
        const startTime = process.hrtime.bigint();

        // Mix of operations that will trigger evictions
        for (let i = 0; i < operations; i++) {
          if (i < 1200) {
            cache.set(`key${i}`, { value: i });
          } else {
            // Access some existing keys (affects LRU/LFU)
            cache.get(`key${i % 600}`);
            // Add new keys (triggers eviction)
            cache.set(`new${i}`, { value: i });
          }
        }

        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000;

        results[strategy] = {
          duration,
          throughput: (operations / duration) * 1000,
          metrics: cache.getMetrics(),
        };

        expect(duration).toBeLessThan(1000); // All strategies should be under 1 second
      });

      // Log performance comparison
      console.log('\nEviction Strategy Performance Comparison:');
      strategies.forEach((strategy) => {
        const result = results[strategy];
        console.log(
          `${strategy.toUpperCase()}: ${result.duration.toFixed(2)}ms, ${result.throughput.toFixed(0)} ops/sec`
        );
      });

      // Verify all strategies maintain cache size limit
      strategies.forEach((strategy) => {
        expect(results[strategy].metrics.size).toBeLessThanOrEqual(1000);
      });
    });
  });

  describe('Cache Invalidation Performance', () => {
    it('should handle large-scale pattern invalidation efficiently', () => {
      const invalidationManager = new CacheInvalidationManager({
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });

      // Create multiple caches
      const caches = [];
      for (let i = 0; i < 10; i++) {
        const cache = new UnifiedCache(
          { logger: mockLogger },
          {
            maxSize: 1000,
            evictionPolicy: 'lru',
          }
        );

        // Populate each cache
        for (let j = 0; j < 500; j++) {
          cache.set(`entity:type${i}:item${j}`, { type: i, id: j });
        }

        invalidationManager.registerCache(`cache${i}`, cache, {
          entityTypes: [`type${i}`],
        });
        caches.push(cache);
      }

      const startTime = process.hrtime.bigint();

      // Invalidate pattern across all caches
      const result = invalidationManager.invalidatePattern('entity:type');

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      // Should complete within 100ms
      expect(duration).toBeLessThan(100);

      // Calculate total invalidated entries
      const totalInvalidated = Object.values(result).reduce(
        (sum, r) => sum + (r.success ? r.invalidated : 0),
        0
      );
      expect(totalInvalidated).toBeGreaterThan(0);

      console.log(
        `Pattern Invalidation: ${totalInvalidated} entries across ${caches.length} caches in ${duration.toFixed(2)}ms`
      );

      // Cleanup
      invalidationManager.destroy();
    });

    it('should handle concurrent invalidation requests efficiently', async () => {
      const invalidationManager = new CacheInvalidationManager({
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });

      const cache = new UnifiedCache(
        { logger: mockLogger },
        {
          maxSize: 5000,
          evictionPolicy: 'lru',
        }
      );

      // Populate cache with different patterns
      const patterns = ['user:', 'item:', 'game:', 'system:', 'temp:'];
      patterns.forEach((pattern, i) => {
        for (let j = 0; j < 200; j++) {
          cache.set(`${pattern}${i}-${j}`, { pattern, index: j });
        }
      });

      invalidationManager.registerCache('concurrent-cache', cache);

      const startTime = process.hrtime.bigint();

      // Create concurrent invalidation requests
      const promises = patterns.map((pattern) =>
        Promise.resolve().then(() =>
          invalidationManager.invalidatePattern(pattern)
        )
      );

      const results = await Promise.all(promises);

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      // Should complete within 50ms
      expect(duration).toBeLessThan(50);

      // Calculate total invalidated across all results
      const totalInvalidated = results.reduce((sum, result) => {
        return (
          sum +
          Object.values(result).reduce(
            (innerSum, r) => innerSum + (r.success ? r.invalidated : 0),
            0
          )
        );
      }, 0);
      expect(totalInvalidated).toBeGreaterThan(0);

      console.log(
        `Concurrent Invalidation: ${patterns.length} patterns, ${totalInvalidated} total entries in ${duration.toFixed(2)}ms`
      );

      invalidationManager.destroy();
    });
  });

  describe('Cache Metrics Performance', () => {
    it('should collect metrics efficiently across many caches', () => {
      const metricsService = new CacheMetrics({ logger: mockLogger });

      // Create and register many caches
      const cacheCount = 50;
      const caches = [];

      for (let i = 0; i < cacheCount; i++) {
        const cache = new UnifiedCache(
          { logger: mockLogger },
          {
            maxSize: 100,
            evictionPolicy: ['lru', 'lfu', 'fifo'][i % 3],
          }
        );

        // Add some data to each cache
        for (let j = 0; j < 20; j++) {
          cache.set(`cache${i}:key${j}`, { cache: i, key: j });
        }

        metricsService.registerCache(`cache-${i}`, cache, {
          category: `category-${i % 5}`,
          description: `Cache ${i}`,
        });

        caches.push(cache);
      }

      const startTime = process.hrtime.bigint();

      // Collect aggregated metrics
      const aggregated = metricsService.getAggregatedMetrics();

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      // Should complete within 100ms
      expect(duration).toBeLessThan(100);
      expect(aggregated.cacheCount).toBe(cacheCount);
      expect(aggregated.totalSize).toBe(cacheCount * 20);

      console.log(
        `Metrics Collection: ${cacheCount} caches in ${duration.toFixed(2)}ms`
      );

      metricsService.destroy();
    });

    it('should handle high-frequency metrics collection efficiently', () => {
      const metricsService = new CacheMetrics(
        { logger: mockLogger },
        {
          collectInterval: 10, // Very frequent collection
          retentionHours: 1,
        }
      );

      const cache = new UnifiedCache(
        { logger: mockLogger },
        {
          maxSize: 1000,
          evictionPolicy: 'lru',
        }
      );

      metricsService.registerCache('high-frequency-cache', cache);

      // Start automatic collection
      metricsService.startCollection(10);

      const startTime = process.hrtime.bigint();

      // Simulate workload while metrics are being collected
      return new Promise((resolve) => {
        setTimeout(() => {
          // Perform cache operations
          for (let i = 0; i < 1000; i++) {
            cache.set(`key${i}`, { value: i });
            if (i % 10 === 0) {
              cache.get(`key${Math.floor(Math.random() * i + 1)}`);
            }
          }

          const endTime = process.hrtime.bigint();
          const duration = Number(endTime - startTime) / 1000000;

          // Stop collection
          metricsService.stopCollection();

          // Check that metrics were collected
          const history = metricsService.getHistoricalData();
          expect(history.length).toBeGreaterThan(0);

          // Operations should complete despite frequent metrics collection
          expect(duration).toBeLessThan(200);

          console.log(
            `High-Frequency Metrics: 1000 operations with frequent collection in ${duration.toFixed(2)}ms`
          );
          console.log(`Collected ${history.length} metric snapshots`);

          metricsService.destroy();
          resolve();
        }, 100); // Let collection run for 100ms
      });
    });

    it('should analyze performance efficiently for large datasets', () => {
      const metricsService = new CacheMetrics({ logger: mockLogger });

      // Create caches with varying performance characteristics
      const scenarios = [
        { hitRate: 0.9, evictions: 5, strategy: 'lru', size: 100 },
        { hitRate: 0.7, evictions: 20, strategy: 'lfu', size: 80 },
        { hitRate: 0.5, evictions: 50, strategy: 'fifo', size: 60 },
        { hitRate: 0.3, evictions: 100, strategy: 'lru', size: 40 },
        { hitRate: 0.1, evictions: 200, strategy: 'lfu', size: 20 },
      ];

      scenarios.forEach((scenario, i) => {
        const mockCache = {
          getMetrics: jest.fn().mockReturnValue({
            size: scenario.size,
            maxSize: 100,
            hitRate: scenario.hitRate,
            stats: {
              hits: Math.floor(1000 * scenario.hitRate),
              misses: Math.floor(1000 * (1 - scenario.hitRate)),
              evictions: scenario.evictions,
              sets: 1000,
              deletes: 10,
            },
            strategyName: scenario.strategy.toUpperCase(),
            config: { evictionPolicy: scenario.strategy },
          }),
          getMemoryUsage: jest.fn().mockReturnValue({
            currentBytes: scenario.size * 100,
            currentMB: scenario.size * 0.0001,
          }),
        };

        metricsService.registerCache(`scenario-cache-${i}`, mockCache, {
          category: scenario.strategy,
          description: `Scenario ${i} cache`,
        });
      });

      const startTime = process.hrtime.bigint();

      // Perform comprehensive analysis
      const analysis = metricsService.analyzePerformance();

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      // Analysis should complete quickly even with complex data
      expect(duration).toBeLessThan(50);

      expect(analysis.summary.totalCaches).toBe(5);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
      expect(analysis.topPerformers.length).toBeGreaterThan(0);
      expect(analysis.poorPerformers.length).toBeGreaterThan(0);

      console.log(
        `Performance Analysis: ${scenarios.length} caches analyzed in ${duration.toFixed(2)}ms`
      );
      console.log(
        `Generated ${analysis.recommendations.length} recommendations`
      );

      metricsService.destroy();
    });
  });

  // Memory efficiency tests moved to tests/memory/cache/cacheMemoryEfficiency.memory.test.js

  describe('Scalability Benchmarks', () => {
    it('should demonstrate linear scaling with cache size', () => {
      const sizes = [100, 500, 1000, 2500, 5000];
      const results = [];

      sizes.forEach((size) => {
        const cache = new UnifiedCache(
          { logger: mockLogger },
          {
            maxSize: size,
            evictionPolicy: 'lru',
          }
        );

        const operations = size * 2; // 2x operations per cache size
        const startTime = process.hrtime.bigint();

        // Fill cache and perform operations
        for (let i = 0; i < operations; i++) {
          if (i % 4 === 0) {
            cache.set(`key${i}`, { value: i });
          } else {
            cache.get(`key${Math.floor(Math.random() * i + 1)}`);
          }
        }

        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000;
        const throughput = (operations / duration) * 1000;

        results.push({
          size,
          operations,
          duration,
          throughput,
          metrics: cache.getMetrics(),
        });

        // Performance should remain reasonable as size increases
        expect(throughput).toBeGreaterThan(5000); // At least 5K ops/sec
      });

      console.log('\nCache Size Scalability:');
      results.forEach((result) => {
        console.log(
          `Size ${result.size}: ${result.throughput.toFixed(0)} ops/sec (${result.duration.toFixed(2)}ms for ${result.operations} ops)`
        );
      });

      // Verify scaling characteristics
      const firstResult = results[0];
      const lastResult = results[results.length - 1];

      // Throughput shouldn't degrade significantly with size
      expect(lastResult.throughput).toBeGreaterThan(
        firstResult.throughput * 0.5
      );
    });

    it('should handle concurrent access patterns efficiently', async () => {
      const cache = new UnifiedCache(
        { logger: mockLogger },
        {
          maxSize: 2000,
          evictionPolicy: 'lru',
        }
      );

      const concurrency = 10;
      const operationsPerThread = 500;

      const startTime = process.hrtime.bigint();

      // Create concurrent workloads
      const promises = Array.from({ length: concurrency }, (_, threadId) =>
        Promise.resolve().then(() => {
          const threadStartTime = process.hrtime.bigint();

          for (let i = 0; i < operationsPerThread; i++) {
            const key = `thread${threadId}:key${i}`;

            if (i % 3 === 0) {
              cache.set(key, { threadId, operation: i, timestamp: Date.now() });
            } else {
              cache.get(
                `thread${threadId}:key${Math.floor(Math.random() * i + 1)}`
              );
            }
          }

          const threadEndTime = process.hrtime.bigint();
          return Number(threadEndTime - threadStartTime) / 1000000;
        })
      );

      const threadDurations = await Promise.all(promises);
      const endTime = process.hrtime.bigint();
      const totalDuration = Number(endTime - startTime) / 1000000;

      const totalOperations = concurrency * operationsPerThread;
      const throughput = (totalOperations / totalDuration) * 1000;

      // Should handle concurrent access efficiently
      expect(totalDuration).toBeLessThan(2000); // Under 2 seconds
      expect(throughput).toBeGreaterThan(2500); // At least 2.5K ops/sec with concurrency

      const metrics = cache.getMetrics();
      expect(
        metrics.stats.sets + metrics.stats.hits + metrics.stats.misses
      ).toBe(totalOperations);

      console.log(
        `Concurrent Access: ${concurrency} threads × ${operationsPerThread} ops = ${throughput.toFixed(0)} ops/sec`
      );
      console.log(
        `Thread durations: min=${Math.min(...threadDurations).toFixed(2)}ms, max=${Math.max(...threadDurations).toFixed(2)}ms`
      );
    });
  });
});
