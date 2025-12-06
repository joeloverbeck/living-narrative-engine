import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  jest,
} from '@jest/globals';

import CacheService from '../../src/services/cacheService.js';

const advanceTimers = async (ms) => {
  jest.advanceTimersByTime(ms);
  await Promise.resolve();
};

describe('CacheService primitive operations integration', () => {
  /** @type {ReturnType<typeof createLogger>} */
  let logger;
  /** @type {CacheService} */
  let cache;

  const createLogger = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    isDebugEnabled: true,
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: Date.now() });
    logger = createLogger();
    cache = new CacheService(logger, {
      maxSize: 4,
      defaultTtl: 50,
      maxMemoryBytes: 4096,
      enableAutoCleanup: true,
      cleanupIntervalMs: 25,
    });
  });

  afterEach(() => {
    if (cache) {
      cache.cleanup();
    }
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('evicts least recently used entries, invalidates patterns, and auto cleans expired nodes', async () => {
    cache.set('evict1', { value: 1 }, 1000);
    cache.set('evict2', { value: 2 }, 1000);
    cache.set('evict3', { value: 3 }, 1000);
    cache.set('evict4', { value: 4 }, 1000);
    cache.set('evict5', { value: 5 }, 1000);

    expect(cache.get('evict1')).toBeUndefined();
    expect(cache.get('evict5')).toEqual({ value: 5 });

    const evictionMessages = logger.debug.mock.calls
      .map(([message]) => String(message))
      .filter((message) => message.includes('CacheService: Evicted LRU entry'));
    expect(evictionMessages.length).toBeGreaterThanOrEqual(1);

    cache.invalidate('evict2');
    cache.invalidate('evict3');
    cache.invalidate('evict4');

    cache.set('pattern:one', { value: 'match' }, 1000);
    cache.set('pattern:two', { value: 'match' }, 1000);
    cache.set('other', { value: 'ignore' }, 1000);

    const removedCount = cache.invalidatePattern(/^pattern:/);
    expect(removedCount).toBe(2);

    const infoMessages = logger.info.mock.calls.map(([message]) =>
      String(message)
    );
    expect(
      infoMessages.some((message) =>
        message.includes(
          'CacheService: Invalidated 2 cache entries matching pattern /^pattern:/'
        )
      )
    ).toBe(true);

    cache.set('short-lived', { flag: true }, 5);

    await advanceTimers(30);

    const cleanupMessages = logger.debug.mock.calls
      .map(([message]) => String(message))
      .filter((message) =>
        message.includes('CacheService: Auto cleanup removed')
      );

    expect(cleanupMessages.length).toBeGreaterThanOrEqual(1);
    expect(cache.has('short-lived')).toBe(false);
  });
});
