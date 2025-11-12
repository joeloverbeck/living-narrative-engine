/**
 * @file Integration tests covering advanced CacheMetrics analytics and lifecycle behavior
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CacheMetrics } from '../../../src/cache/CacheMetrics.js';
import {
  UnifiedCache,
  EvictionPolicy,
} from '../../../src/cache/UnifiedCache.js';
import { createTestBed } from '../../common/testBed.js';

const LRU_RECOMMENDATION =
  'Consider using LRU strategy for most caches as it typically provides the best balance of performance and memory usage.';
const HIT_RATE_RECOMMENDATION =
  'Overall hit rate is below 60%. Consider reviewing cache TTL settings or key strategies.';
const MEMORY_PRESSURE_RECOMMENDATION =
  'Memory utilization is high (>85%). Consider increasing memory limits or enabling more aggressive pruning.';
const CAPACITY_RECOMMENDATION =
  'Some caches are at maximum capacity. Monitor eviction patterns and consider increasing cache sizes for frequently accessed data.';

describe('CacheMetrics advanced analytics integration', () => {
  let testBed;
  let mockLogger;
  let metrics;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    metrics = new CacheMetrics(
      {
        logger: mockLogger,
      },
      {
        enableAutoCollection: false,
        historyRetention: 2,
        collectionInterval: 25,
      }
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    if (metrics) {
      metrics.destroy();
    }
    testBed.cleanup();
  });

  it('validates cache registration inputs and lifecycle state', () => {
    const unifiedCache = new UnifiedCache(
      { logger: mockLogger },
      {
        maxSize: 5,
        enableMetrics: true,
      }
    );

    expect(() => metrics.registerCache('', unifiedCache)).toThrow(
      'Cache ID must be a non-empty string'
    );
    expect(() => metrics.registerCache('invalid-cache', {})).toThrow(
      'Cache must implement getMetrics() method'
    );

    metrics.registerCache('validation-cache', unifiedCache, {
      type: 'validation',
      description: 'Verifies registration lifecycle',
    });

    expect(metrics.isCacheRegistered('validation-cache')).toBe(true);
    expect(metrics.getRegisteredCaches()).toEqual(['validation-cache']);
    expect(metrics.getCacheMetrics('validation-cache')).toBeNull();

    unifiedCache.set('validation:key', { status: 'ready' });
    unifiedCache.get('validation:key');

    const snapshot = metrics.collectCacheMetrics('validation-cache');
    expect(snapshot.cacheId).toBe('validation-cache');
    expect(snapshot.metadata.type).toBe('validation');
    expect(metrics.getCacheMetrics('validation-cache')).toEqual(snapshot);

    const history = metrics.getCacheHistory('validation-cache');
    expect(history).toHaveLength(1);
    expect(history[0].cacheId).toBe('validation-cache');

    expect(metrics.collectCacheMetrics('missing-cache')).toBeNull();
    expect(metrics.getCacheHistory('missing-cache')).toBeNull();

    expect(metrics.unregisterCache('validation-cache')).toBe(true);
    expect(metrics.unregisterCache('validation-cache')).toBe(false);
    expect(metrics.isCacheRegistered('validation-cache')).toBe(false);
    expect(metrics.getCacheMetrics('validation-cache')).toBeNull();
  });

  it('produces aggregated analytics, recommendations, and historical insights', () => {
    jest.useFakeTimers();
    const baseTime = new Date('2030-01-01T00:00:00.000Z');
    jest.setSystemTime(baseTime);

    const lruCache = new UnifiedCache(
      { logger: mockLogger },
      {
        maxSize: 3,
        maxMemoryUsage: 8 * 1024 * 1024,
        evictionPolicy: EvictionPolicy.LRU,
        enableMetrics: true,
      }
    );
    const fifoCache = new UnifiedCache(
      { logger: mockLogger },
      {
        maxSize: 2,
        maxMemoryUsage: 12 * 1024 * 1024,
        evictionPolicy: EvictionPolicy.FIFO,
        enableMetrics: true,
      }
    );
    const lfuCache = new UnifiedCache(
      { logger: mockLogger },
      {
        maxSize: 2,
        maxMemoryUsage: 4 * 1024 * 1024,
        evictionPolicy: EvictionPolicy.LFU,
        enableMetrics: true,
      }
    );

    const lruValue = 'h'.repeat(1_250_000); // ~2.5MB per entry
    const fifoValue = 'l'.repeat(6_000_000); // ~12MB value
    const lfuValue = 'm'.repeat(900_000); // ~1.8MB per entry

    lruCache.set('high:1', lruValue);
    lruCache.set('high:2', lruValue);
    lruCache.set('high:3', lruValue);
    lruCache.get('high:1');
    lruCache.get('high:2');
    lruCache.get('high:3');
    lruCache.get('high:1');
    lruCache.get('high:2');
    lruCache.get('high:missing');

    fifoCache.set('low:1', fifoValue);
    fifoCache.get('low:missing:1');
    fifoCache.get('low:missing:2');
    fifoCache.get('low:1');
    fifoCache.get('low:missing:3');
    fifoCache.get('low:missing:4');

    lfuCache.set('mid:1', lfuValue);
    lfuCache.set('mid:2', lfuValue);
    lfuCache.get('mid:1');
    lfuCache.get('mid:2');
    lfuCache.get('mid:missing:1');
    lfuCache.get('mid:missing:2');

    const registerCache = (cacheId, cache, metadata) => {
      metrics.registerCache(
        cacheId,
        {
          getMetrics: () => {
            const baseMetrics = cache.getMetrics();
            const usage = cache.getMemoryUsage();
            return {
              ...baseMetrics,
              memorySize: usage.currentBytes,
              memoryUsageMB: usage.currentMB,
              utilizationPercent: usage.utilizationPercent ?? 0,
            };
          },
        },
        metadata
      );
    };

    registerCache('analytics-high', lruCache, {
      type: 'lru',
      description: 'High performing cache',
    });
    registerCache('analytics-low', fifoCache, {
      type: 'fifo',
      description: 'Low hit rate cache',
    });
    registerCache('analytics-mid', lfuCache, {
      type: 'lfu',
      description: 'Moderate cache performance',
    });

    metrics.collectAllMetrics();

    jest.setSystemTime(new Date(baseTime.getTime() + 30 * 60 * 1000));
    metrics.collectCacheMetrics('analytics-low');

    jest.setSystemTime(new Date(baseTime.getTime() + 120 * 60 * 1000));
    metrics.collectCacheMetrics('analytics-low');

    const aggregated = metrics.getAggregatedMetrics();

    expect(metrics.getRegisteredCaches()).toEqual(
      expect.arrayContaining([
        'analytics-high',
        'analytics-low',
        'analytics-mid',
      ])
    );

    expect(aggregated.cacheCount).toBe(3);
    expect(aggregated.totalHits).toBe(8);
    expect(aggregated.totalMisses).toBe(7);
    expect(aggregated.overallHitRate).toBeLessThan(0.6);
    expect(aggregated.memoryUtilization.highestUtilization).toBeGreaterThan(
      aggregated.memoryUtilization.averageUtilization - 1
    );
    expect(aggregated.memoryUtilization.averageUtilization).toBeGreaterThan(85);
    expect(aggregated.strategyDistribution).toMatchObject({
      LRU: expect.any(Number),
      FIFO: expect.any(Number),
      LFU: expect.any(Number),
    });
    expect(aggregated.caches['analytics-high'].strategy).toBe('LRU');
    expect(aggregated.caches['analytics-high'].size).toBe(3);
    expect(aggregated.caches['analytics-high'].size).toBe(
      aggregated.caches['analytics-high'].maxSize
    );
    expect(aggregated.caches['analytics-low'].memoryMB).toBeGreaterThan(10);
    expect(aggregated.globalStats.totalHits).toBe(aggregated.totalHits);
    expect(aggregated.globalStats.totalMisses).toBe(aggregated.totalMisses);
    const summary = metrics.getPerformanceSummary();
    expect(summary.overview.cacheCount).toBe(3);
    expect(summary.performance.highPerformingCaches).toContain(
      'analytics-high'
    );
    expect(summary.performance.lowPerformingCaches).toContain('analytics-low');
    expect(summary.performance.memoryIntensiveCaches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'analytics-low',
          memoryMB: expect.any(Number),
        }),
      ])
    );
    expect(summary.recommendations).toEqual(
      expect.arrayContaining([
        LRU_RECOMMENDATION,
        HIT_RATE_RECOMMENDATION,
        MEMORY_PRESSURE_RECOMMENDATION,
        CAPACITY_RECOMMENDATION,
      ])
    );

    const recentHistory = metrics.getCacheHistory('analytics-low', 1);
    expect(recentHistory.length).toBeGreaterThanOrEqual(2);
    expect(
      recentHistory.every((entry) => entry.cacheId === 'analytics-low')
    ).toBe(true);

    const historicalData = metrics.getHistoricalData();
    const timestamps = historicalData.map((entry) => entry.timestamp);
    const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
    expect(timestamps).toEqual(sortedTimestamps);
    expect(
      historicalData.some((entry) => entry.cacheId === 'analytics-high')
    ).toBe(true);

    const analysis = metrics.analyzePerformance();
    expect(analysis.summary.totalCaches).toBe(3);
    expect(analysis.topPerformers.map((cache) => cache.id)).toContain(
      'analytics-high'
    );
    expect(analysis.poorPerformers.map((cache) => cache.id)).toContain(
      'analytics-low'
    );
    expect(analysis.recommendations).toEqual(
      expect.arrayContaining([LRU_RECOMMENDATION, CAPACITY_RECOMMENDATION])
    );
    expect(analysis.strategyDistribution.FIFO).toBeGreaterThan(0);

    const collectSpy = jest.spyOn(metrics, 'collectAllMetrics');
    collectSpy.mockClear();
    metrics.startCollection(200);
    jest.advanceTimersByTime(600);
    metrics.startCollection(150);
    jest.advanceTimersByTime(300);
    metrics.stopCollection();
    expect(collectSpy.mock.calls.length).toBeGreaterThanOrEqual(4);

    metrics.destroy();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('CacheMetrics service destroyed')
    );
    metrics = null;

    collectSpy.mockRestore();
  });
});
