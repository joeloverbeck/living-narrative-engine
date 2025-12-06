/**
 * @file cache-service-pattern-invalidation.integration.test.js
 * @description Verifies CacheService pattern-based invalidation using the production ConsoleLogger implementation.
 */

import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';

import { ConsoleLogger } from '../../src/consoleLogger.js';
import CacheService from '../../src/services/cacheService.js';

/**
 * Collects console spy handles for cleanup.
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

describe('CacheService pattern invalidation integration', () => {
  let logger;
  let cacheService;
  let consoleSpies;

  beforeEach(() => {
    consoleSpies = instrumentConsole();
    logger = new ConsoleLogger();
    cacheService = new CacheService(logger, {
      maxSize: 10,
      defaultTtl: 5 * 60 * 1000,
      maxMemoryBytes: 1 * 1024 * 1024,
      enableAutoCleanup: false,
    });
  });

  afterEach(() => {
    if (cacheService) {
      cacheService.cleanup();
    }

    for (const spy of Object.values(consoleSpies)) {
      spy.mockRestore();
    }
  });

  it('removes matching entries and reports the cleanup summary', () => {
    cacheService.set('api_key:file:/tmp/service-a.key', { secret: 'alpha' });
    cacheService.set('api_key:file:/tmp/service-b.key', { secret: 'beta' });
    cacheService.set('health:status', { ok: true });

    const removed = cacheService.invalidatePattern(/^api_key:/);

    expect(removed).toBe(2);
    expect(cacheService.getSize()).toBe(1);

    const infoMessages = consoleSpies.infoSpy.mock.calls
      .map(([message]) => message)
      .filter((message) => typeof message === 'string');

    const summaryLog = infoMessages.find((message) =>
      message.includes(
        'CacheService: Invalidated 2 cache entries matching pattern /^api_key:/'
      )
    );

    expect(summaryLog).toBeDefined();
  });
});
