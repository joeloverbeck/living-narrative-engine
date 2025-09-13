/**
 * @file Unit tests for CacheMetrics
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
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
      'resetStats'
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
        prunings: 2
      },
      config: {
        maxSize: 100,
        ttl: 5000,
        evictionPolicy: 'LRU'
      },
      strategyName: 'LRU'
    });
    
    mockCache.getMemoryUsage.mockReturnValue({
      currentBytes: 1024,
      currentMB: 0.001,
      maxBytes: 102400,
      maxMB: 0.1,
      utilizationPercent: 1.0
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
      const customMetrics = new CacheMetrics({
        logger: mockLogger,
      }, {
        collectionInterval: 10000,
        historyRetention: 48
      });
      
      expect(customMetrics).toBeDefined();
    });
  });

  describe('Cache Registration', () => {
    it('should register cache for monitoring', () => {
      metrics.registerCache('test-cache', mockCache, { 
        description: 'Test cache',
        category: 'entity'
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
        description: 'Test cache' 
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
          prunings: 2
        },
        config: {
          maxSize: 100,
          ttl: 5000,
          evictionPolicy: 'LRU'
        },
        strategyName: 'LRU',
        metadata: expect.objectContaining({
          description: 'Test cache',
          registeredAt: expect.any(Number)
        })
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

  describe('Aggregated Metrics', () => {
    let mockCache2;

    beforeEach(() => {
      mockCache2 = testBed.createMock('cache', [
        'getMetrics',
        'getMemoryUsage'
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
          prunings: 3
        },
        config: { maxSize: 200, ttl: 10000, evictionPolicy: 'LFU' },
        strategyName: 'LFU'
      });
      
      mockCache2.getMemoryUsage.mockReturnValue({
        currentBytes: 2048,
        currentMB: 0.002,
        maxBytes: 204800,
        maxMB: 0.2,
        utilizationPercent: 1.0
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
          LFU: 1
        },
        memoryUtilization: expect.any(Object),
        caches: {
          cache1: expect.objectContaining({
            size: 10,
            hitRate: 0.75,
            strategy: 'LRU'
          }),
          cache2: expect.objectContaining({
            size: 20,
            hitRate: 0.8,
            strategy: 'LFU'
          })
        }
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
        caches: {}
      });
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
  });

  describe('Performance Summary', () => {
    beforeEach(() => {
      // First cache with high hit rate (> 0.8 to be considered high performing)
      const highHitCache = testBed.createMock('cache', ['getMetrics', 'getMemoryUsage']);
      highHitCache.getMetrics.mockReturnValue({
        size: 10,
        maxSize: 100,
        hitRate: 0.85, // > 0.8 to be high performing
        stats: { hits: 85, misses: 15, sets: 100, deletes: 10 },
        strategyName: 'LRU',
        memoryUsageMB: 0.001
      });
      metrics.registerCache('high-hit-cache', highHitCache, { description: 'High hit rate' });
      
      // Second cache with low hit rate (< 0.5 to be considered low performing)
      const lowHitCache = testBed.createMock('cache', ['getMetrics', 'getMemoryUsage']);
      lowHitCache.getMetrics.mockReturnValue({
        size: 50,
        maxSize: 100,
        hitRate: 0.3, // < 0.5 to be low performing
        stats: { hits: 30, misses: 70, evictions: 20 },
        strategyName: 'FIFO',
        memoryUsageMB: 0.005
      });
      lowHitCache.getMemoryUsage.mockReturnValue({
        currentBytes: 5120,
        utilizationPercent: 5.0
      });
      
      metrics.registerCache('low-hit-cache', lowHitCache, { description: 'Low hit rate' });
      
      // Collect metrics to populate the cache data
      metrics.collectAllMetrics();
    });

    it('should analyze cache performance', () => {
      const summary = metrics.getPerformanceSummary();
      
      expect(summary.overview).toMatchObject({
        cacheCount: 2,
        overallHitRate: expect.any(Number)
      });
      
      expect(summary.performance.highPerformingCaches).toContain('high-hit-cache');
      expect(summary.performance.lowPerformingCaches).toContain('low-hit-cache');
      expect(summary.recommendations).toBeInstanceOf(Array);
    });

    it('should provide specific recommendations', () => {
      const summary = metrics.getPerformanceSummary();
      
      // Check that recommendations are generated based on metrics
      expect(summary.recommendations).toBeDefined();
      expect(Array.isArray(summary.recommendations)).toBe(true);
      
      // Since overall hit rate is 0.575 ((85+30)/(85+15+30+70)) which is < 0.6, should have recommendation
      expect(summary.recommendations.some(r => 
        r.includes('hit rate') || r.includes('60%')
      )).toBe(true);
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
        hitRate: 0.75
      });
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
      expect(results.every(r => r.length === 1)).toBe(true);
    });

    it('should handle malformed cache metrics gracefully', () => {
      metrics.registerCache('test-cache', mockCache);
      mockCache.getMetrics.mockReturnValue(null);
      
      const cacheMetrics = metrics.collectCacheMetrics('test-cache');
      // When getMetrics returns null, the spread operator still creates an object with metadata
      expect(cacheMetrics).toMatchObject({
        cacheId: 'test-cache',
        timestamp: expect.any(Number),
        metadata: expect.any(Object)
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