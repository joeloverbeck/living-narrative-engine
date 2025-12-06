import { describe, test, expect, jest } from '@jest/globals';

import CacheService from '../../src/services/cacheService.js';
import { getEnhancedConsoleLogger } from '../../src/logging/enhancedConsoleLogger.js';

const createCache = (config = {}) => {
  const enhancedLogger = getEnhancedConsoleLogger();
  return {
    cache: new CacheService(enhancedLogger, config),
    logger: enhancedLogger,
  };
};

describe('CacheService advanced maintenance integration', () => {
  test('invalidatePattern reports freed memory when entries are removed', () => {
    const { cache, logger } = createCache({
      maxSize: 10,
      enableAutoCleanup: false,
    });

    const infoSpy = jest.spyOn(logger, 'info');

    cache.set('user:1', { value: 'one' });
    cache.set('user:2', { value: 'two' });
    cache.set('session:3', { value: 'three' });

    const removedCount = cache.invalidatePattern(/^user:/);

    expect(removedCount).toBe(2);
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'CacheService: Invalidated 2 cache entries matching pattern /^user:/, freed'
      )
    );

    infoSpy.mockRestore();
    cache.cleanup();
  });

  test('evicts least recently used entries when capacity is exceeded', () => {
    const { cache, logger } = createCache({
      maxSize: 2,
      enableAutoCleanup: false,
    });

    const debugSpy = jest.spyOn(logger, 'debug');

    cache.set('alpha', 'A');
    cache.set('beta', 'B');
    cache.set('gamma', 'C');

    expect(cache.get('alpha')).toBeUndefined();
    expect(cache.get('beta')).toBe('B');
    expect(cache.get('gamma')).toBe('C');

    expect(debugSpy).toHaveBeenCalledWith(
      "CacheService: Evicted LRU entry with key 'alpha'"
    );

    debugSpy.mockRestore();
    cache.cleanup();
  });

  test('auto cleanup removes expired entries and updates statistics', async () => {
    jest.useFakeTimers({ advanceTimers: true });

    const { cache, logger } = createCache({
      defaultTtl: 20,
      enableAutoCleanup: true,
      cleanupIntervalMs: 25,
    });

    const debugSpy = jest.spyOn(logger, 'debug');

    cache.set('temporary', 'value', 10);

    try {
      await jest.advanceTimersByTimeAsync(30);

      expect(cache.has('temporary')).toBe(false);

      const stats = cache.getStats();
      expect(stats.efficiency.autoCleanupCount).toBe(1);

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'CacheService: Auto cleanup removed 1 expired entries'
        )
      );
    } finally {
      debugSpy.mockRestore();
      cache.cleanup();
      jest.useRealTimers();
    }
  });
});
