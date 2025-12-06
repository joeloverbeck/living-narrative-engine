import { describe, it, expect } from '@jest/globals';
import {
  UnifiedCache,
  EvictionPolicy,
} from '../../../src/cache/UnifiedCache.js';
import NoOpLogger from '../../../src/logging/noOpLogger.js';

/**
 *
 * @param config
 */
function createLruCache(config = {}) {
  const logger = new NoOpLogger();
  return new UnifiedCache(
    { logger },
    {
      maxSize: 12,
      ttl: 500,
      evictionPolicy: EvictionPolicy.LRU,
      maxMemoryUsage: 2048,
      enableMetrics: true,
      ...config,
    }
  );
}

describe('LRU strategy real module integration', () => {
  it('tracks memory usage across diverse data and TTL overrides with real lru-cache interactions', () => {
    const lruCache = createLruCache();

    const circular = {};
    circular.self = circular;

    lruCache.set('string:value', 'alpha');
    lruCache.set('object:value', { label: 'beta', nested: { id: 42 } });
    lruCache.set('circular:value', circular);
    lruCache.set('primitive:value', 99);
    lruCache.set('ttl:value', 'temporary', { ttl: 250 });

    expect(lruCache.get('string:value')).toBe('alpha');
    expect(lruCache.get('missing:key')).toBeUndefined();
    expect(lruCache.has('ttl:value')).toBe(true);

    const entryKeys = lruCache.getKeys(10);
    expect(entryKeys).toEqual(
      expect.arrayContaining([
        'string:value',
        'object:value',
        'circular:value',
        'primitive:value',
        'ttl:value',
      ])
    );

    const entries = lruCache.getEntries(10);
    const storedPairs = Object.fromEntries(entries);
    expect(storedPairs['object:value']).toEqual({
      label: 'beta',
      nested: { id: 42 },
    });
    expect(storedPairs['circular:value']).toBe(circular);

    const metrics = lruCache.getMetrics();
    expect(metrics.strategyName).toBe('LRU');
    expect(metrics.memorySize).toBeGreaterThan(0);
    expect(metrics.stats.hits).toBeGreaterThan(0);
    expect(metrics.stats.misses).toBeGreaterThan(0);

    const memoryUsage = lruCache.getMemoryUsage();
    expect(memoryUsage.currentBytes).toBeGreaterThan(0);
    expect(memoryUsage.maxBytes).toBe(2048);
    expect(memoryUsage.utilizationPercent).toBeGreaterThan(0);

    lruCache.clear();
    expect(lruCache.getMetrics().size).toBe(0);
  });

  it('prunes stale entries and supports aggressive clearing through the LRU strategy', async () => {
    const lruCache = createLruCache({ ttl: 100 });

    lruCache.set('stale:value', 'expire-me', { ttl: 25 });
    lruCache.set('stable:value', { mode: 'persistent' });
    expect(lruCache.has('stale:value')).toBe(true);
    expect(lruCache.has('stable:value')).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 40));

    const prunedStale = lruCache.prune();
    expect(prunedStale).toBe(1);
    expect(lruCache.has('stale:value')).toBe(false);

    expect(lruCache.delete('stable:value')).toBe(true);
    expect(lruCache.has('stable:value')).toBe(false);

    lruCache.set('one:value', 'payload-one');
    lruCache.set('two:value', { active: true });
    lruCache.set('three:value', 'gamma');

    expect(lruCache.getMetrics().size).toBe(3);

    const removedAggressively = lruCache.prune(true);
    expect(removedAggressively).toBe(3);
    expect(lruCache.getMetrics().size).toBe(0);
  });
});
