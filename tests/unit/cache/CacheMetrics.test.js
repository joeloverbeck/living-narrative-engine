/**
 * @file Unit tests for CacheMetrics
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { CacheMetrics } from '../../../src/cache/CacheMetrics.js';

describe('CacheMetrics', () => {
  let testBed;
  let metrics;
  let mockLogger;
  let mockCache;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    mockCache = testBed.createMock('cache', [
      'getMetrics',
      'getMemoryUsage',
      'resetStats',
    ]);

    mockCache.getMetrics.mockReturnValue({
      size: 10,
      maxSize: 100,
      hitRate: 0.75,
      stats: {
        hits: 75,
        misses: 25,
        sets: 100,
        deletes: 10,
        evictions: 5,
        prunings: 2,
      },
      config: {
        maxSize: 100,
        ttl: 5000,
        evictionPolicy: 'LRU',
      },
      strategyName: 'LRU',
    });

    mockCache.getMemoryUsage.mockReturnValue({
      currentBytes: 1024,
      currentMB: 0.001,
      maxBytes: 102400,
      maxMB: 0.1,
      utilizationPercent: 1.0,
    });

    metrics = new CacheMetrics({
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Construction and Configuration', () => {
    it('should create metrics service with default configuration', () => {
      expect(metrics).toBeDefined();
    });

    it('should validate logger dependency', () => {
      expect(() => {
        new CacheMetrics({ logger: null });
      }).toThrow();
    });

    it('should create with custom configuration', () => {
      const customMetrics = new CacheMetrics(
        {
          logger: mockLogger,
        },
        {
          collectionInterval: 10000,
          historyRetention: 48,
        }
      );

      expect(customMetrics).toBeDefined();
    });
  });

  describe('Cache Registration', () => {
    it('should register cache for monitoring', () => {
      metrics.registerCache('test-cache', mockCache, {
        description: 'Test cache',
        category: 'entity',
      });

      const registeredCaches = metrics.getRegisteredCaches();
      expect(registeredCaches).toHaveLength(1);
      expect(registeredCaches[0]).toEqual('test-cache');
      expect(metrics.isCacheRegistered('test-cache')).toBe(true);
    });

    it('should register cache with minimal metadata', () => {
      metrics.registerCache('simple-cache', mockCache);

      const registeredCaches = metrics.getRegisteredCaches();
      expect(registeredCaches).toHaveLength(1);
      expect(registeredCaches[0]).toEqual('simple-cache');
    });

    it('should throw error for invalid cache ID', () => {
      expect(() => {
        metrics.registerCache('', mockCache);
      }).toThrow(Error);

      expect(() => {
        metrics.registerCache(null, mockCache);
      }).toThrow(Error);
    });

    it('should throw error for invalid cache object', () => {
      expect(() => {
        metrics.registerCache('test-cache', null);
      }).toThrow(Error);

      expect(() => {
        metrics.registerCache('test-cache', {});
      }).toThrow(Error);
    });

    it('should allow duplicate cache registration', () => {
      metrics.registerCache('test-cache', mockCache);

      // Production code allows re-registration, overwrites the existing one
      expect(() => {
        metrics.registerCache('test-cache', mockCache);
      }).not.toThrow();
    });
  });

  describe('Cache Unregistration', () => {
    beforeEach(() => {
      metrics.registerCache('test-cache', mockCache);
    });

    it('should unregister existing cache', () => {
      const result = metrics.unregisterCache('test-cache');

      expect(result).toBe(true);
      expect(metrics.getRegisteredCaches()).toHaveLength(0);
    });

    it('should return false for non-existent cache', () => {
      const result = metrics.unregisterCache('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('Individual Cache Metrics Collection', () => {
    beforeEach(() => {
      metrics.registerCache('test-cache', mockCache, {
        description: 'Test cache',
      });
    });

    it('should collect metrics for specific cache', () => {
      const cacheMetrics = metrics.collectCacheMetrics('test-cache');

      expect(cacheMetrics).toMatchObject({
        cacheId: 'test-cache',
        size: 10,
        maxSize: 100,
        hitRate: 0.75,
        stats: {
          hits: 75,
          misses: 25,
          sets: 100,
          deletes: 10,
          evictions: 5,
          prunings: 2,
        },
        config: {
          maxSize: 100,
          ttl: 5000,
          evictionPolicy: 'LRU',
        },
        strategyName: 'LRU',
        metadata: expect.objectContaining({
          description: 'Test cache',
          registeredAt: expect.any(Number),
        }),
      });
    });

    it('should return null for non-existent cache', () => {
      const cacheMetrics = metrics.collectCacheMetrics('non-existent');

      expect(cacheMetrics).toBeNull();
    });

    it('should handle cache metrics errors', () => {
      mockCache.getMetrics.mockImplementation(() => {
        throw new Error('Metrics error');
      });

      const cacheMetrics = metrics.collectCacheMetrics('test-cache');

      expect(cacheMetrics).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Cache History', () => {
    beforeEach(() => {
      metrics.registerCache('test-cache', mockCache);
    });

    it('should maintain cache history', () => {
      // Collect metrics multiple times
      metrics.collectCacheMetrics('test-cache');
      metrics.collectCacheMetrics('test-cache');

      const history = metrics.getCacheHistory('test-cache', 1);

      expect(history).toHaveLength(2);
      expect(history[0].timestamp).toBeLessThanOrEqual(history[1].timestamp);
    });

    it('should return null for non-existent cache history', () => {
      const history = metrics.getCacheHistory('non-existent');

      expect(history).toBeNull();
    });

    it('should filter history by hours', () => {
      // This is a simplified test since we can't easily mock time
      const history = metrics.getCacheHistory('test-cache', 0.001);

      expect(history).toBeDefined();
    });
  });

  describe('Cache Accessors', () => {
    it('should return the most recent metrics snapshot for a cache', () => {
      metrics.registerCache('test-cache', mockCache);

      const snapshot = metrics.collectCacheMetrics('test-cache');
      const retrieved = metrics.getCacheMetrics('test-cache');

      expect(retrieved).toEqual(snapshot);
      expect(metrics.getCacheMetrics('missing-cache')).toBeNull();
    });

    it('should merge historical data across caches in chronological order', () => {
      const altCache = testBed.createMock('cache', ['getMetrics']);
      altCache.getMetrics.mockReturnValue({
        size: 5,
        maxSize: 10,
        hitRate: 0.5,
        stats: { hits: 5, misses: 5 },
        strategyName: 'FIFO',
      });

      metrics.registerCache('primary-cache', mockCache);
      metrics.registerCache('secondary-cache', altCache);

      const nowSpy = jest.spyOn(Date, 'now');
      nowSpy.mockReturnValue(1000);
      metrics.collectCacheMetrics('primary-cache');
      nowSpy.mockReturnValue(3000);
      metrics.collectCacheMetrics('secondary-cache');
      nowSpy.mockReturnValue(2000);
      metrics.collectCacheMetrics('primary-cache');
      nowSpy.mockRestore();

      const history = metrics.getHistoricalData();

      expect(history).toHaveLength(3);
      expect(history.map((entry) => entry.timestamp)).toEqual([
        1000, 2000, 3000,
      ]);
      expect(history[0].cacheId).toBe('primary-cache');
      expect(history[2].cacheId).toBe('secondary-cache');
    });
  });

  describe('Aggregated Metrics', () => {
    let mockCache2;

    beforeEach(() => {
      mockCache2 = testBed.createMock('cache', [
        'getMetrics',
        'getMemoryUsage',
      ]);

      mockCache2.getMetrics.mockReturnValue({
        size: 20,
        maxSize: 200,
        hitRate: 0.8,
        stats: {
          hits: 80,
          misses: 20,
          sets: 150,
          deletes: 5,
          evictions: 10,
          prunings: 3,
        },
        config: { maxSize: 200, ttl: 10000, evictionPolicy: 'LFU' },
        strategyName: 'LFU',
      });

      mockCache2.getMemoryUsage.mockReturnValue({
        currentBytes: 2048,
        currentMB: 0.002,
        maxBytes: 204800,
        maxMB: 0.2,
        utilizationPercent: 1.0,
      });

      metrics.registerCache('cache1', mockCache, { category: 'entity' });
      metrics.registerCache('cache2', mockCache2, { category: 'component' });
    });

    it('should provide aggregated metrics across all caches', () => {
      const aggregated = metrics.getAggregatedMetrics();

      expect(aggregated).toMatchObject({
        cacheCount: 2,
        totalSize: 30, // 10 + 20
        totalMaxSize: 300, // 100 + 200
        overallHitRate: 0.775, // (75+80)/(75+80+25+20)
        totalHits: 155,
        totalMisses: 45,
        totalSets: 250,
        totalDeletes: 15,
        strategyDistribution: {
          LRU: 1,
          LFU: 1,
        },
        memoryUtilization: expect.any(Object),
        caches: {
          cache1: expect.objectContaining({
            size: 10,
            hitRate: 0.75,
            strategy: 'LRU',
          }),
          cache2: expect.objectContaining({
            size: 20,
            hitRate: 0.8,
            strategy: 'LFU',
          }),
        },
      });
    });

    it('should handle empty metrics', () => {
      const emptyMetrics = new CacheMetrics({ logger: mockLogger });
      const aggregated = emptyMetrics.getAggregatedMetrics();

      expect(aggregated).toMatchObject({
        cacheCount: 0,
        totalSize: 0,
        totalMaxSize: 0,
        overallHitRate: 0,
        totalHits: 0,
        totalMisses: 0,
        totalSets: 0,
        totalDeletes: 0,
        strategyDistribution: {},
        caches: {},
      });
    });

    it('should compute memory utilization statistics when usage data is available', () => {
      const primaryCache = testBed.createMock('cache', ['getMetrics']);
      primaryCache.getMetrics.mockReturnValue({
        size: 5,
        maxSize: 50,
        hitRate: 0.6,
        stats: { hits: 30, misses: 20 },
        strategyName: 'LRU',
        memoryUsageMB: 20,
        memorySize: 20480,
        utilizationPercent: 92,
      });

      const detailedCache = testBed.createMock('cache', ['getMetrics']);
      detailedCache.getMetrics.mockReturnValue({
        size: 7,
        maxSize: 70,
        hitRate: 0.5,
        stats: { hits: 35, misses: 35 },
        strategyName: 'FIFO',
        memoryUsageMB: 15,
        memorySize: 15360,
        utilizationPercent: 88,
      });

      const service = new CacheMetrics({ logger: mockLogger });
      service.registerCache('cacheA', primaryCache);
      service.registerCache('cacheB', detailedCache);

      const aggregated = service.getAggregatedMetrics();

      expect(aggregated.memoryUtilization.totalMB).toBeCloseTo(35, 5);
      expect(aggregated.memoryUtilization.totalBytes).toBe(35840);
      expect(aggregated.memoryUtilization.highestUtilization).toBe(92);
      expect(aggregated.memoryUtilization.averageUtilization).toBeCloseTo(
        90,
        5
      );
    });

    it('should handle partial cache errors in aggregation', () => {
      mockCache.getMetrics.mockImplementation(() => {
        throw new Error('Cache error');
      });

      const aggregated = metrics.getAggregatedMetrics();

      expect(aggregated.cacheCount).toBe(2); // Both caches still registered
      expect(aggregated.totalSize).toBe(20); // Only successful cache data
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should treat missing stat values as zero when updating totals', () => {
      const zeroStatCache = testBed.createMock('cache', ['getMetrics']);
      zeroStatCache.getMetrics.mockReturnValue({
        size: 0,
        maxSize: 0,
        hitRate: 0,
        stats: {
          hits: 0,
          misses: 0,
          sets: 0,
          deletes: 0,
        },
        strategyName: 'LRU',
      });

      const service = new CacheMetrics({ logger: mockLogger });
      service.registerCache('zero-cache', zeroStatCache);

      const collected = service.collectAllMetrics();
      expect(collected).toHaveLength(1);

      const aggregated = service.getAggregatedMetrics();

      expect(aggregated.totalHits).toBe(0);
      expect(aggregated.totalMisses).toBe(0);
      expect(aggregated.totalSets).toBe(0);
      expect(aggregated.totalDeletes).toBe(0);
      expect(aggregated.globalStats).toEqual(
        expect.objectContaining({
          totalHits: 0,
          totalMisses: 0,
          totalSets: 0,
          totalDeletes: 0,
        })
      );
    });

    it('should label caches without identifiers as unknown in aggregated output', () => {
      const service = new CacheMetrics({ logger: mockLogger });
      service.registerCache('alpha-cache', mockCache);

      const metricsSpy = jest
        .spyOn(service, 'collectCacheMetrics')
        .mockImplementation(() => ({
          size: 3,
          maxSize: 30,
          hitRate: 0.5,
          strategyName: 'custom-strategy',
          stats: { hits: 0, misses: 0 },
        }));

      const aggregated = service.getAggregatedMetrics();

      expect(aggregated.caches).toHaveProperty(
        'unknown',
        expect.objectContaining({
          size: 3,
          strategy: 'custom-strategy',
        })
      );

      metricsSpy.mockRestore();
    });
  });

  describe('Performance Summary', () => {
    beforeEach(() => {
      // First cache with high hit rate (> 0.8 to be considered high performing)
      const highHitCache = testBed.createMock('cache', [
        'getMetrics',
        'getMemoryUsage',
      ]);
      highHitCache.getMetrics.mockReturnValue({
        size: 10,
        maxSize: 100,
        hitRate: 0.85, // > 0.8 to be high performing
        stats: { hits: 85, misses: 15, sets: 100, deletes: 10 },
        strategyName: 'LRU',
        memoryUsageMB: 0.001,
      });
      metrics.registerCache('high-hit-cache', highHitCache, {
        description: 'High hit rate',
      });

      // Second cache with low hit rate (< 0.5 to be considered low performing)
      const lowHitCache = testBed.createMock('cache', [
        'getMetrics',
        'getMemoryUsage',
      ]);
      lowHitCache.getMetrics.mockReturnValue({
        size: 50,
        maxSize: 100,
        hitRate: 0.3, // < 0.5 to be low performing
        stats: { hits: 30, misses: 70, evictions: 20 },
        strategyName: 'FIFO',
        memoryUsageMB: 0.005,
      });
      lowHitCache.getMemoryUsage.mockReturnValue({
        currentBytes: 5120,
        utilizationPercent: 5.0,
      });

      metrics.registerCache('low-hit-cache', lowHitCache, {
        description: 'Low hit rate',
      });

      // Collect metrics to populate the cache data
      metrics.collectAllMetrics();
    });

    it('should analyze cache performance', () => {
      const summary = metrics.getPerformanceSummary();

      expect(summary.overview).toMatchObject({
        cacheCount: 2,
        overallHitRate: expect.any(Number),
      });

      expect(summary.performance.highPerformingCaches).toContain(
        'high-hit-cache'
      );
      expect(summary.performance.lowPerformingCaches).toContain(
        'low-hit-cache'
      );
      expect(summary.recommendations).toBeInstanceOf(Array);
    });

    it('should provide specific recommendations', () => {
      const summary = metrics.getPerformanceSummary();

      // Check that recommendations are generated based on metrics
      expect(summary.recommendations).toBeDefined();
      expect(Array.isArray(summary.recommendations)).toBe(true);

      // Since overall hit rate is 0.575 ((85+30)/(85+15+30+70)) which is < 0.6, should have recommendation
      expect(
        summary.recommendations.some(
          (r) => r.includes('hit rate') || r.includes('60%')
        )
      ).toBe(true);
    });

    it('should handle performance summary with no caches', () => {
      const emptyMetrics = new CacheMetrics({ logger: mockLogger });
      const summary = emptyMetrics.getPerformanceSummary();

      expect(summary.overview.cacheCount).toBe(0);
      expect(summary.performance.highPerformingCaches).toHaveLength(0);
      expect(summary.performance.lowPerformingCaches).toHaveLength(0);
      // Empty caches may still generate recommendations based on the lack of caches
      expect(summary.recommendations).toBeDefined();
      expect(Array.isArray(summary.recommendations)).toBe(true);
    });

    it('should generate recommendations for memory, capacity, and strategy concerns', () => {
      const service = new CacheMetrics({ logger: mockLogger });

      const saturatedCache = testBed.createMock('cache', ['getMetrics']);
      saturatedCache.getMetrics.mockReturnValue({
        size: 100,
        maxSize: 100,
        hitRate: 0.9,
        stats: { hits: 90, misses: 10 },
        strategyName: 'LRU',
        memoryUsageMB: 50,
        memorySize: 51200,
        utilizationPercent: 95,
        metadata: { type: 'entity' },
      });

      const slowCache = testBed.createMock('cache', ['getMetrics']);
      slowCache.getMetrics.mockReturnValue({
        size: 70,
        maxSize: 100,
        hitRate: 0.2,
        stats: { hits: 10, misses: 40 },
        strategyName: 'FIFO',
        memoryUsageMB: 12,
        memorySize: 12288,
        utilizationPercent: 90,
      });

      const mediumCache = testBed.createMock('cache', ['getMetrics']);
      mediumCache.getMetrics.mockReturnValue({
        size: 40,
        maxSize: 80,
        hitRate: 0.4,
        stats: { hits: 30, misses: 45 },
        strategyName: 'LFU',
        memoryUsageMB: 11,
        memorySize: 11264,
        utilizationPercent: 88,
      });

      service.registerCache('saturated-cache', saturatedCache);
      service.registerCache('slow-cache', slowCache);
      service.registerCache('medium-cache', mediumCache);

      const summary = service.getPerformanceSummary();

      expect(summary.performance.memoryIntensiveCaches).toEqual(
        expect.arrayContaining([
          { id: 'saturated-cache', memoryMB: 50 },
          { id: 'slow-cache', memoryMB: 12 },
          { id: 'medium-cache', memoryMB: 11 },
        ])
      );

      expect(summary.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('hit rate'),
          expect.stringContaining('Memory utilization is high'),
          expect.stringContaining('Consider using LRU strategy'),
          expect.stringContaining('maximum capacity'),
        ])
      );
    });
  });

  describe('All Metrics Collection', () => {
    beforeEach(() => {
      metrics.registerCache('test-cache', mockCache);
    });

    it('should collect metrics from all registered caches', () => {
      const allMetrics = metrics.collectAllMetrics();

      expect(allMetrics).toHaveLength(1);
      expect(allMetrics[0]).toMatchObject({
        cacheId: 'test-cache',
        size: 10,
        maxSize: 100,
        hitRate: 0.75,
      });
    });
  });

  describe('Automatic Metrics Management', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start and stop automatic metrics collection on the provided interval', () => {
      jest.useFakeTimers();
      const collectSpy = jest
        .spyOn(metrics, 'collectAllMetrics')
        .mockReturnValue([]);

      metrics.startCollection(100);
      jest.advanceTimersByTime(350);

      expect(collectSpy).toHaveBeenCalledTimes(3);

      const callCount = collectSpy.mock.calls.length;
      metrics.stopCollection();
      jest.advanceTimersByTime(200);
      expect(collectSpy).toHaveBeenCalledTimes(callCount);

      collectSpy.mockRestore();
    });

    it('should restart automatic collection when already running', () => {
      jest.useFakeTimers();
      const collectSpy = jest
        .spyOn(metrics, 'collectAllMetrics')
        .mockReturnValue([]);

      metrics.startCollection(200);
      jest.advanceTimersByTime(200);
      const firstInvocationCount = collectSpy.mock.calls.length;

      metrics.startCollection(50);
      jest.advanceTimersByTime(150);

      expect(collectSpy.mock.calls.length).toBeGreaterThan(
        firstInvocationCount
      );

      metrics.stopCollection();
      collectSpy.mockRestore();
    });

    it('should destroy the service by clearing caches and timers', () => {
      jest.useFakeTimers();
      const service = new CacheMetrics({ logger: mockLogger });
      const stopSpy = jest.spyOn(service, 'stopCollection');

      service.registerCache('test-cache', mockCache);
      service.startCollection(100);
      service.destroy();

      expect(stopSpy).toHaveBeenCalled();
      expect(service.getRegisteredCaches()).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('CacheMetrics service destroyed')
      );

      stopSpy.mockRestore();
    });

    it('should default to configured interval when none is provided', () => {
      jest.useFakeTimers();
      const service = new CacheMetrics(
        { logger: mockLogger },
        { collectionInterval: 250 }
      );
      const intervalSpy = jest.spyOn(global, 'setInterval');

      service.startCollection();

      expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 250);

      intervalSpy.mockRestore();
      service.stopCollection();
    });

    it('should safely handle stopCollection with no active timer', () => {
      mockLogger.info.mockClear();

      expect(() => metrics.stopCollection()).not.toThrow();
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Stopped automatic metrics collection')
      );
    });
  });

  describe('Performance Analysis', () => {
    it('should analyze caches to identify top and poor performers', () => {
      const service = new CacheMetrics({ logger: mockLogger });

      const highCache = testBed.createMock('cache', ['getMetrics']);
      highCache.getMetrics.mockReturnValue({
        size: 10,
        maxSize: 100,
        hitRate: 0.9,
        stats: { hits: 90, misses: 10 },
        strategyName: 'LRU',
      });

      const lowCache = testBed.createMock('cache', ['getMetrics']);
      lowCache.getMetrics.mockReturnValue({
        size: 50,
        maxSize: 100,
        hitRate: 0.2,
        stats: { hits: 10, misses: 40 },
        strategyName: 'FIFO',
      });

      service.registerCache('high-cache', highCache);
      service.registerCache('low-cache', lowCache);
      service.collectAllMetrics();

      const analysis = service.analyzePerformance();

      expect(analysis.summary.totalCaches).toBe(2);
      expect(analysis.topPerformers).toEqual([
        expect.objectContaining({ id: 'high-cache', hitRate: 0.9 }),
      ]);
      expect(analysis.poorPerformers).toEqual([
        expect.objectContaining({ id: 'low-cache', hitRate: 0.2 }),
      ]);
      expect(Array.isArray(analysis.recommendations)).toBe(true);
      expect(analysis.strategyDistribution).toMatchObject({ LRU: 1, FIFO: 1 });
    });

    it('should order performance lists by relative hit rates', () => {
      const service = new CacheMetrics({ logger: mockLogger });

      const highPrimary = testBed.createMock('cache', ['getMetrics']);
      highPrimary.getMetrics.mockReturnValue({
        size: 10,
        maxSize: 100,
        hitRate: 0.95,
        stats: { hits: 95, misses: 5 },
        strategyName: 'LRU',
      });

      const highSecondary = testBed.createMock('cache', ['getMetrics']);
      highSecondary.getMetrics.mockReturnValue({
        size: 8,
        maxSize: 80,
        hitRate: 0.9,
        stats: { hits: 90, misses: 10 },
        strategyName: 'LFU',
      });

      const lowPrimary = testBed.createMock('cache', ['getMetrics']);
      lowPrimary.getMetrics.mockReturnValue({
        size: 50,
        maxSize: 100,
        hitRate: 0.3,
        stats: { hits: 30, misses: 70 },
        strategyName: 'FIFO',
      });

      const lowSecondary = testBed.createMock('cache', ['getMetrics']);
      lowSecondary.getMetrics.mockReturnValue({
        size: 60,
        maxSize: 90,
        hitRate: 0.1,
        stats: { hits: 10, misses: 90 },
        strategyName: 'MRU',
      });

      service.registerCache('high-primary', highPrimary);
      service.registerCache('high-secondary', highSecondary);
      service.registerCache('low-primary', lowPrimary);
      service.registerCache('low-secondary', lowSecondary);

      service.collectAllMetrics();

      const analysis = service.analyzePerformance();

      expect(analysis.topPerformers.map((p) => p.id)).toEqual([
        'high-primary',
        'high-secondary',
      ]);
      expect(analysis.poorPerformers.map((p) => p.id)).toEqual([
        'low-secondary',
        'low-primary',
      ]);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle concurrent operations safely', async () => {
      metrics.registerCache('test-cache', mockCache);

      // Simulate concurrent metric collections
      const promises = Array.from({ length: 5 }, () =>
        Promise.resolve(metrics.collectAllMetrics())
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      expect(results.every((r) => r.length === 1)).toBe(true);
    });

    it('should handle malformed cache metrics gracefully', () => {
      metrics.registerCache('test-cache', mockCache);
      mockCache.getMetrics.mockReturnValue(null);

      const cacheMetrics = metrics.collectCacheMetrics('test-cache');
      // When getMetrics returns null, the spread operator still creates an object with metadata
      expect(cacheMetrics).toMatchObject({
        cacheId: 'test-cache',
        timestamp: expect.any(Number),
        metadata: expect.any(Object),
      });

      const aggregated = metrics.getAggregatedMetrics();
      expect(aggregated.cacheCount).toBe(1); // Cache is still registered
    });
  });

  describe('Cache Registration Check', () => {
    it('should check if cache is registered', () => {
      expect(metrics.isCacheRegistered('test-cache')).toBe(false);

      metrics.registerCache('test-cache', mockCache);
      expect(metrics.isCacheRegistered('test-cache')).toBe(true);

      metrics.unregisterCache('test-cache');
      expect(metrics.isCacheRegistered('test-cache')).toBe(false);
    });
  });
});
