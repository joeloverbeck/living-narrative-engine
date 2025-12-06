import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

/**
 * @file cache-service-lru-eviction-path.integration.test.js
 * @description Validates that CacheService triggers its LRU eviction path using the
 *              real console logger stack, ensuring the eviction branch that removes
 *              keyed nodes executes against the formatted logger output.
 */

describe('CacheService LRU eviction branch integration', () => {
  const ORIGINAL_ENV = { ...process.env };
  let chalkBackup;
  const consoleSpies = new Map();

  beforeEach(() => {
    jest.resetModules();

    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'development',
      LOG_ENHANCED_FORMATTING: 'true',
      LOG_CONTEXT_PRETTY_PRINT: 'true',
      LOG_COLOR_MODE: 'never',
      LOG_ICON_MODE: 'false',
    };

    chalkBackup = globalThis.chalk;
    const identity = (value) => String(value);
    const styledIdentity = Object.assign(identity, {
      italic: identity,
      bold: identity,
    });

    globalThis.chalk = {
      blue: identity,
      green: identity,
      yellow: identity,
      cyan: identity,
      red: styledIdentity,
      gray: styledIdentity,
    };

    consoleSpies.set(
      'info',
      jest.spyOn(console, 'info').mockImplementation(() => {})
    );
    consoleSpies.set(
      'warn',
      jest.spyOn(console, 'warn').mockImplementation(() => {})
    );
    consoleSpies.set(
      'error',
      jest.spyOn(console, 'error').mockImplementation(() => {})
    );
    consoleSpies.set(
      'debug',
      jest.spyOn(console, 'debug').mockImplementation(() => {})
    );
  });

  afterEach(() => {
    for (const spy of consoleSpies.values()) {
      spy.mockRestore();
    }
    consoleSpies.clear();

    if (chalkBackup === undefined) {
      delete globalThis.chalk;
    } else {
      globalThis.chalk = chalkBackup;
    }

    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  it('evicts the least recently used entry when max size is exceeded', async () => {
    const [{ createConsoleLogger }, { default: CacheService }] =
      await Promise.all([
        import('../../src/consoleLogger.js'),
        import('../../src/services/cacheService.js'),
      ]);

    const logger = createConsoleLogger();
    const cache = new CacheService(logger, {
      maxSize: 1,
      defaultTtl: 60_000,
      maxMemoryBytes: 1024 * 1024,
      enableAutoCleanup: false,
    });

    cache.set('alpha', { payload: 'first' });

    expect(cache.get('alpha')).toEqual({ payload: 'first' });

    cache.set('beta', { payload: 'second' });

    expect(cache.get('alpha')).toBeUndefined();
    expect(cache.get('beta')).toEqual({ payload: 'second' });

    const debugOutput = consoleSpies
      .get('debug')
      .mock.calls.map(([line]) => line)
      .join('\n');

    expect(debugOutput).toContain(
      "CacheService: Evicted LRU entry with key 'alpha'"
    );

    const stats = cache.getStats();
    expect(stats.evictions).toBeGreaterThanOrEqual(1);
    expect(stats.size).toBe(1);
  });
});
