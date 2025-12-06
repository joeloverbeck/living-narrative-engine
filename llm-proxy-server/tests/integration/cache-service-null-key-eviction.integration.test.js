import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import CacheService from '../../src/services/cacheService.js';
import MetricsService from '../../src/services/metricsService.js';
import { createCacheMetricsRecorder } from '../../src/middleware/metrics.js';

const createTrackingLogger = () => {
  const entries = {
    info: [],
    debug: [],
    warn: [],
    error: [],
  };

  const logger = {
    info: (...args) => entries.info.push(args),
    debug: (...args) => entries.debug.push(args),
    warn: (...args) => entries.warn.push(args),
    error: (...args) => entries.error.push(args),
  };

  return { logger, entries };
};

describe('CacheService memory eviction behaviour with nullish keys (integration)', () => {
  let cacheService;
  let metricsService;
  let recorder;
  let loggerBundle;

  beforeEach(() => {
    loggerBundle = createTrackingLogger();
    cacheService = new CacheService(loggerBundle.logger, {
      maxSize: 5,
      defaultTtl: 60_000,
      maxMemoryBytes: 160,
      enableAutoCleanup: false,
    });

    metricsService = new MetricsService({
      logger: loggerBundle.logger,
      collectDefaultMetrics: false,
    });

    recorder = createCacheMetricsRecorder({
      metricsService,
      cacheType: 'nullish-key-lru',
    });
  });

  afterEach(() => {
    if (cacheService) {
      cacheService.cleanup();
      cacheService = null;
    }

    if (metricsService) {
      metricsService.clear();
      metricsService = null;
    }
  });

  it('retains cached values and records metrics when LRU eviction encounters a null cache key', async () => {
    const primaryPayload = { payload: 'A'.repeat(120) };
    cacheService.set(null, primaryPayload);

    const firstStats = cacheService.getStats();
    const firstMemory = cacheService.getMemoryInfo();

    recorder.recordOperation('set', 'success', {
      size: firstStats.size,
      memoryUsage: firstMemory.currentBytes,
    });

    const secondaryPayload = { payload: 'B'.repeat(120) };
    cacheService.set('fallback-entry', secondaryPayload);

    const secondStats = cacheService.getStats();
    const secondMemory = cacheService.getMemoryInfo();

    recorder.recordOperation('set', 'success', {
      size: secondStats.size,
      memoryUsage: secondMemory.currentBytes,
    });

    expect(cacheService.get(null)).toEqual(primaryPayload);
    expect(cacheService.get('fallback-entry')).toEqual(secondaryPayload);

    expect(secondStats.memoryEvictions).toBe(0);
    expect(secondMemory.currentBytes).toBeGreaterThan(secondMemory.maxBytes);

    const cacheOpsMetric = await metricsService.cacheOperationsTotal.get();
    const setOperation = cacheOpsMetric.values.find(
      (entry) =>
        entry.labels.operation === 'set' && entry.labels.result === 'success'
    );
    expect(setOperation?.value).toBe(2);

    const memoryGaugeMetric = await metricsService.cacheMemoryUsage.get();
    const cacheMemoryEntry = memoryGaugeMetric.values.find(
      (entry) => entry.labels.cache_type === 'nullish-key-lru'
    );
    expect(cacheMemoryEntry?.value).toBe(secondMemory.currentBytes);

    const debugMessages = loggerBundle.entries.debug.map((args) =>
      String(args[0])
    );

    expect(
      debugMessages.some((message) =>
        message.includes("CacheService: Cached value for key 'fallback-entry'")
      )
    ).toBe(true);
  });
});
