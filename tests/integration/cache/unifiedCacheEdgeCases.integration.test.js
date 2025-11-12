import { describe, it, expect, jest } from '@jest/globals';
import { UnifiedCache, EvictionPolicy } from '../../../src/cache/UnifiedCache.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { CacheError } from '../../../src/errors/cacheError.js';
import LRUStrategy from '../../../src/cache/strategies/LRUStrategy.js';

class RecordingLogger {
  constructor() {
    this.infos = [];
    this.warnings = [];
    this.errors = [];
    this.debugs = [];
  }

  info(message, ...args) {
    this.infos.push(String(message), ...args.map(String));
  }

  warn(message, ...args) {
    this.warnings.push(String(message), ...args.map(String));
  }

  error(message, ...args) {
    this.errors.push(String(message), ...args.map(String));
  }

  debug(message, ...args) {
    this.debugs.push(String(message), ...args.map(String));
  }
}

describe('UnifiedCache integration coverage for edge cases', () => {
  it('throws an InvalidArgumentError for unsupported eviction policies', () => {
    const logger = new RecordingLogger();

    expect(
      () => new UnifiedCache({ logger }, { evictionPolicy: 'made-up-policy' })
    ).toThrow(InvalidArgumentError);
  });

  it('enforces key validation, supports generator flows, and resets metrics correctly', async () => {
    const logger = new RecordingLogger();
    const cache = new UnifiedCache({ logger }, {
      evictionPolicy: EvictionPolicy.LRU,
      enableMetrics: true,
      maxSize: 50,
      ttl: 200,
    });

    expect(() => cache.get('', () => 'value')).toThrow(InvalidArgumentError);
    expect(() => cache.set('', 'value')).toThrow(InvalidArgumentError);
    expect(cache.has('')).toBe(false);
    expect(cache.delete('')).toBe(false);
    expect(() => cache.invalidate()).toThrow(InvalidArgumentError);

    const asyncValue = await cache.get('async:item', () => Promise.resolve({ id: 'async' }));
    expect(asyncValue).toEqual({ id: 'async' });
    expect(cache.get('async:item')).toEqual({ id: 'async' });

    const syncValue = cache.get('sync:item', () => 'sync-result');
    expect(syncValue).toBe('sync-result');

    expect(() => cache.get('error:item', () => {
      throw new Error('generator failure');
    })).toThrow(CacheError);
    expect(logger.errors.some((entry) => entry.includes('Generator function failed'))).toBe(true);

    cache.set('invalidate:one', { order: 1 });
    cache.set('invalidate:two', { order: 2 });

    cache.set('warn:item', undefined);
    expect(logger.warnings.some((entry) => entry.includes('Attempting to cache undefined value'))).toBe(true);
    expect(cache.get('warn:item')).toBeUndefined();

    const invalidated = cache.invalidate(/^invalidate:/);
    expect(invalidated).toBe(2);
    expect(logger.infos.some((entry) => entry.includes('Cache invalidated 2 entries'))).toBe(true);

    cache.set('metrics:hit', 'hit');
    expect(cache.get('metrics:hit')).toBe('hit');
    expect(cache.delete('metrics:hit')).toBe(true);

    cache.set('prune:one', 'value-one');
    cache.set('prune:two', 'value-two');
    const pruned = cache.prune(true);
    expect(pruned).toBeGreaterThanOrEqual(2);

    // Trigger a miss explicitly
    expect(cache.get('missing:item')).toBeUndefined();

    const metricsBeforeReset = cache.getMetrics();
    expect(metricsBeforeReset.stats.hits).toBeGreaterThan(0);
    expect(metricsBeforeReset.stats.misses).toBeGreaterThan(0);
    expect(metricsBeforeReset.stats.sets).toBeGreaterThan(0);
    expect(metricsBeforeReset.stats.deletes).toBeGreaterThan(0);
    expect(metricsBeforeReset.stats.prunings).toBeGreaterThan(0);

    cache.resetStats();
    const metricsAfterReset = cache.getMetrics();
    expect(metricsAfterReset.stats).toEqual({
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      prunings: 0,
    });
    expect(logger.infos.some((entry) => entry.includes('Cache statistics reset'))).toBe(true);
  });

  it('wraps strategy errors in CacheError during set operations', () => {
    const logger = new RecordingLogger();
    const cache = new UnifiedCache({ logger }, { evictionPolicy: EvictionPolicy.LRU });

    const setSpy = jest.spyOn(LRUStrategy.prototype, 'set').mockImplementation(() => {
      throw new Error('underlying strategy failure');
    });

    try {
      expect(() => cache.set('failing:item', 'value')).toThrow(CacheError);
      expect(logger.errors.some((entry) => entry.includes('Failed to set cache value for key'))).toBe(true);
    } finally {
      setSpy.mockRestore();
    }
  });
});
