import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import CacheService from '../../src/services/cacheService.js';

function createTestLogger() {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
}

describe('CacheService auto cleanup activation', () => {
  let logger;
  beforeEach(() => {
    jest.useFakeTimers({ now: Date.now(), doNotFake: ['setImmediate'] });
    logger = createTestLogger();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('starts auto cleanup interval and purges expired entries without manual invocation', () => {
    const cacheService = new CacheService(logger, {
      maxSize: 5,
      defaultTtl: 50,
      maxMemoryBytes: 1024 * 1024,
      cleanupIntervalMs: 25,
      enableAutoCleanup: true,
    });

    try {
      cacheService.set('auto-expire', { payload: true }, 20);
      expect(cacheService.has('auto-expire')).toBe(true);

      jest.advanceTimersByTime(30);
      jest.runOnlyPendingTimers();

      jest.advanceTimersByTime(30);
      jest.runOnlyPendingTimers();

      expect(cacheService.has('auto-expire')).toBe(false);

      const stats = cacheService.getStats();
      expect(stats.autoCleanups).toBeGreaterThanOrEqual(1);
      expect(stats.expirations).toBeGreaterThanOrEqual(1);

      expect(logger.info).toHaveBeenCalledWith(
        'CacheService: Started auto cleanup with 25ms interval'
      );
    } finally {
      cacheService.cleanup();
    }
  });

  it('logs LRU eviction when capacity is exceeded', () => {
    const cacheService = new CacheService(logger, {
      maxSize: 1,
      defaultTtl: 1000,
      maxMemoryBytes: 1024 * 1024,
      enableAutoCleanup: false,
    });

    try {
      cacheService.set('first-entry', { ok: true }, 1000);
      cacheService.set('second-entry', { ok: true }, 1000);

      expect(logger.debug).toHaveBeenCalledWith(
        "CacheService: Evicted LRU entry with key 'first-entry'"
      );
      expect(cacheService.has('first-entry')).toBe(false);
      expect(cacheService.has('second-entry')).toBe(true);
    } finally {
      cacheService.cleanup();
    }
  });
});
