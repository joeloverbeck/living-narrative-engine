import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';

import { ConsoleLogger } from '../../src/consoleLogger.js';
import CacheService from '../../src/services/cacheService.js';

const instrumentConsole = () => ({
  debugSpy: jest.spyOn(console, 'debug').mockImplementation(() => {}),
  infoSpy: jest.spyOn(console, 'info').mockImplementation(() => {}),
  warnSpy: jest.spyOn(console, 'warn').mockImplementation(() => {}),
  errorSpy: jest.spyOn(console, 'error').mockImplementation(() => {}),
});

describe('CacheService race condition resilience integration', () => {
  let cacheService;
  let consoleSpies;

  beforeEach(() => {
    consoleSpies = instrumentConsole();
    cacheService = new CacheService(new ConsoleLogger(), {
      maxSize: 20,
      enableAutoCleanup: false,
      defaultTtl: 50,
    });
  });

  afterEach(() => {
    if (cacheService) {
      cacheService.cleanup();
      cacheService = null;
    }

    if (consoleSpies) {
      for (const spy of Object.values(consoleSpies)) {
        spy.mockRestore();
      }
      consoleSpies = null;
    }

    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('handles entries removed during pattern evaluation without logging misleading summaries', () => {
    cacheService.set('ghost:pattern:primary', { value: 'alpha' });
    cacheService.set('ghost:pattern:secondary', { value: 'beta' });

    const sabotagePattern = {
      test: (key) => {
        if (key === 'ghost:pattern:primary') {
          cacheService.invalidate(key);
          return true;
        }
        return false;
      },
      toString: () => '/ghost:pattern:resilient/',
    };

    const removedCount = cacheService.invalidatePattern(sabotagePattern);

    expect(removedCount).toBe(0);
    expect(cacheService.getSize()).toBe(1);

    const infoMessages = consoleSpies.infoSpy.mock.calls.map(
      ([message]) => message
    );
    const emittedSummaries = infoMessages.filter(
      (message) =>
        typeof message === 'string' &&
        message.includes('CacheService: Invalidated') &&
        message.includes('matching pattern')
    );
    expect(emittedSummaries).toHaveLength(0);
  });

  it('tolerates cache entries disappearing between detection and removal during cleanup', () => {
    jest.useFakeTimers({ advanceTimers: true });

    const originalSet = Map.prototype.set;
    let capturedInternalMap = null;
    Map.prototype.set = function patchedSet(key, value) {
      if (
        !capturedInternalMap &&
        value &&
        typeof value === 'object' &&
        Object.prototype.hasOwnProperty.call(value, 'entry')
      ) {
        capturedInternalMap = this;
      }
      return originalSet.call(this, key, value);
    };

    try {
      cacheService.set('ghost:auto:volatile', { value: 'gamma' }, 5);
    } finally {
      Map.prototype.set = originalSet;
    }

    expect(capturedInternalMap).not.toBeNull();

    const baseTime = Date.now();
    const dateNowSpy = jest.spyOn(Date, 'now');
    dateNowSpy.mockImplementation(() => baseTime + 100);

    const originalGet = Map.prototype.get;
    let interceptNextLookup = true;
    Map.prototype.get = function patchedGet(key) {
      if (
        interceptNextLookup &&
        this === capturedInternalMap &&
        key === 'ghost:auto:volatile'
      ) {
        interceptNextLookup = false;
        return undefined;
      }
      return originalGet.call(this, key);
    };

    try {
      const cleanupResult = cacheService.performManualCleanup();

      expect(cleanupResult.entriesRemoved).toBe(0);
      expect(cleanupResult.memoryFreed).toBe(0);
      expect(cleanupResult.currentSize).toBe(1);
    } finally {
      Map.prototype.get = originalGet;
      dateNowSpy.mockRestore();
    }

    cacheService.invalidate('ghost:auto:volatile');
  });
});
