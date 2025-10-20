/**
 * @file cache-service-eviction-and-cleanup.integration.test.js
 * @description Exercises CacheService eviction, pattern invalidation, and auto-cleanup
 *              logic to close remaining integration coverage gaps for branch-heavy flows.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { ConsoleLogger } from '../../src/consoleLogger.js';
import CacheService from '../../src/services/cacheService.js';

/**
 * Instruments console output so tests can assert against real logger traffic.
 * @returns {{ debugSpy: jest.SpyInstance, infoSpy: jest.SpyInstance, warnSpy: jest.SpyInstance, errorSpy: jest.SpyInstance }}
 */
function instrumentConsole() {
  return {
    debugSpy: jest.spyOn(console, 'debug').mockImplementation(() => {}),
    infoSpy: jest.spyOn(console, 'info').mockImplementation(() => {}),
    warnSpy: jest.spyOn(console, 'warn').mockImplementation(() => {}),
    errorSpy: jest.spyOn(console, 'error').mockImplementation(() => {}),
  };
}

describe('CacheService eviction and cleanup integration', () => {
  let cacheService;
  let consoleSpies;
  let logger;

  beforeEach(() => {
    jest.useFakeTimers({ now: Date.now() });
    consoleSpies = instrumentConsole();
    logger = new ConsoleLogger();
    cacheService = new CacheService(logger, {
      maxSize: 2,
      defaultTtl: 30,
      maxMemoryBytes: 8 * 1024,
      enableAutoCleanup: true,
      cleanupIntervalMs: 10,
    });
  });

  afterEach(() => {
    if (cacheService) {
      cacheService.cleanup();
    }

    jest.useRealTimers();

    for (const spy of Object.values(consoleSpies)) {
      spy.mockRestore();
    }
  });

  it('evicts LRU entries, reports pattern invalidations, and performs timed cleanup', async () => {
    cacheService.set('entry:a', { payload: 'alpha' });
    cacheService.set('entry:b', { payload: 'beta' });

    // Trigger LRU eviction by inserting more keys than the configured capacity.
    cacheService.set('entry:c', { payload: 'gamma' });
    cacheService.set('entry:d', { payload: 'delta' });

    const evictionLogs = consoleSpies.debugSpy.mock.calls
      .map(([message]) => message)
      .filter((message) => typeof message === 'string')
      .filter((message) =>
        message.includes('CacheService: Evicted LRU entry with key')
      );
    expect(evictionLogs.length).toBeGreaterThan(0);

    const removedCount = cacheService.invalidatePattern(/^entry:[cd]/);
    expect(removedCount).toBe(2);
    expect(cacheService.getSize()).toBe(0);

    const summaryLog = consoleSpies.infoSpy.mock.calls
      .map(([message]) => message)
      .find(
        (message) =>
          typeof message === 'string' &&
          message.includes(
            'CacheService: Invalidated 2 cache entries matching pattern /^entry:[cd]/'
          )
      );
    expect(summaryLog).toBeDefined();

    // Add an entry with a short TTL so the scheduled cleanup removes it.
    cacheService.set('entry:expiring', { payload: 'short-lived' }, 5);
    expect(cacheService.has('entry:expiring')).toBe(true);

    // Advance timers enough for the interval-driven cleanup to process the expired entry.
    jest.advanceTimersByTime(40);
    jest.runOnlyPendingTimers();
    await Promise.resolve();

    const cleanupLog = consoleSpies.debugSpy.mock.calls
      .map(([message]) => message)
      .find(
        (message) =>
          typeof message === 'string' &&
          message.includes('CacheService: Auto cleanup removed')
      );
    expect(cleanupLog).toBeDefined();
    expect(cacheService.has('entry:expiring')).toBe(false);
  });
});
