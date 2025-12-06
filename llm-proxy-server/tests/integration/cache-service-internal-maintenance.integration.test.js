import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

import CacheService from '../../src/services/cacheService.js';

function createLogger() {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
}

describe('CacheService maintenance integration coverage', () => {
  /** @type {ReturnType<typeof createLogger>} */
  let logger;
  /** @type {CacheService | null} */
  let cache;

  beforeEach(() => {
    logger = createLogger();
    cache = null;
  });

  afterEach(() => {
    if (cache) {
      cache.cleanup();
    }
    jest.useRealTimers();
  });

  it('evicts LRU entries and reports pattern invalidation summaries', () => {
    cache = new CacheService(logger, {
      maxSize: 3,
      defaultTtl: 5_000,
      enableAutoCleanup: false,
      maxMemoryBytes: 1024 * 1024,
    });

    cache.set('lru:first', { value: 'a' }, 5_000);
    cache.set('lru:second', { value: 'b' }, 5_000);
    cache.set('lru:third', { value: 'c' }, 5_000);

    // Touch one entry so another becomes the LRU candidate.
    expect(cache.get('lru:first')).toEqual({ value: 'a' });

    cache.set('lru:fourth', { value: 'd' }, 5_000);

    expect(cache.get('lru:second')).toBeUndefined();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        "CacheService: Evicted LRU entry with key 'lru:second'"
      )
    );

    cache.set('test:alpha', { value: 'alpha' }, 5_000);
    cache.set('test:beta', { value: 'beta' }, 5_000);
    cache.set('other:gamma', { value: 'gamma' }, 5_000);

    const removed = cache.invalidatePattern(/^test:/);
    expect(removed).toBe(2);
    expect(cache.get('test:alpha')).toBeUndefined();
    expect(cache.get('test:beta')).toBeUndefined();
    expect(cache.get('other:gamma')).toEqual({ value: 'gamma' });
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        'CacheService: Invalidated 2 cache entries matching pattern /^test:/, freed'
      )
    );
  });

  it('runs scheduled cleanup for expired entries and records auto cleanup statistics', async () => {
    jest.useFakeTimers();

    cache = new CacheService(logger, {
      maxSize: 5,
      defaultTtl: 20,
      enableAutoCleanup: true,
      cleanupIntervalMs: 25,
      maxMemoryBytes: 1024 * 1024,
    });

    cache.set('auto:transient', { payload: 'transient' }, 10);
    cache.set('auto:linger', { payload: 'linger' }, 200);

    // Advance past the TTL of the transient entry and allow the cleanup interval to run twice
    // to ensure the scheduled cleanup processes the expired entry.
    await jest.advanceTimersByTimeAsync(60);

    expect(cache.get('auto:transient')).toBeUndefined();
    expect(cache.get('auto:linger')).toEqual({ payload: 'linger' });
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'CacheService: Auto cleanup removed 1 expired entries, freed'
      )
    );

    const stats = cache.getStats();
    expect(stats.autoCleanups).toBeGreaterThanOrEqual(1);
    expect(stats.expirations).toBeGreaterThanOrEqual(1);
  });
});
