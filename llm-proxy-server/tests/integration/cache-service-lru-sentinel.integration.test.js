import {
  describe,
  it,
  expect,
  afterEach,
  beforeEach,
  jest,
} from '@jest/globals';

import CacheService from '../../src/services/cacheService.js';

const createLogger = () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
};

describe('cache service sentinel-aware LRU eviction integration', () => {
  let cacheService;
  let logger;

  beforeEach(() => {
    logger = createLogger();
    cacheService = new CacheService(logger, {
      maxSize: 2,
      defaultTtl: 60_000,
      maxMemoryBytes: 1024 * 1024,
      enableAutoCleanup: false,
    });
  });

  afterEach(() => {
    if (cacheService) {
      cacheService.cleanup();
    }
  });

  it('retains falsy-keyed entries while still evicting the correct LRU element', () => {
    const sentinelPayload = { id: 'sentinel' };
    const earlyPayload = { id: 'alpha' };
    const newPayload = { id: 'beta' };

    cacheService.set('', sentinelPayload);
    cacheService.set('alpha', earlyPayload);

    cacheService.set('beta', newPayload);

    expect(cacheService.get('')).toEqual(sentinelPayload);
    expect(cacheService.get('alpha')).toBeUndefined();
    expect(cacheService.get('beta')).toEqual(newPayload);

    const stats = cacheService.getStats();
    expect(stats.evictions).toBeGreaterThanOrEqual(1);
    expect(stats.size).toBe(2);
    expect(stats.efficiency).toEqual(
      expect.objectContaining({ memoryEvictionRate: expect.any(String) })
    );
  });
});
