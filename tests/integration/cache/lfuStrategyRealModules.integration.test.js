import { describe, it, expect } from '@jest/globals';
import { UnifiedCache, EvictionPolicy } from '../../../src/cache/UnifiedCache.js';
import NoOpLogger from '../../../src/logging/noOpLogger.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createLfuCache(config = {}) {
  const logger = new NoOpLogger();
  return new UnifiedCache(
    { logger },
    {
      maxSize: 4,
      ttl: 80,
      evictionPolicy: EvictionPolicy.LFU,
      maxMemoryUsage: 4096,
      enableMetrics: true,
      updateAgeOnGet: true,
      ...config,
    }
  );
}

describe('LFU strategy real module integration', () => {
  it('coordinates TTL refresh, eviction decisions, and memory accounting using production LFU collaborators', async () => {
    const cache = createLfuCache();

    cache.set('temp:expiring', 'vanish', { ttl: 25 });
    cache.set('array:value', ['gamma', { active: true }, ['delta', 7]]);
    cache.set('object:value', { label: 'beta', nested: { id: 42 } });
    cache.set('number:value', 7);

    await wait(35);
    const removedByPrune = cache.prune();
    expect(removedByPrune).toBe(1);
    expect(cache.has('temp:expiring')).toBe(false);

    cache.set('ghost:value', 'fading', { ttl: 25 });
    await wait(35);
    expect(cache.get('ghost:value')).toBeUndefined();

    expect(cache.get('array:value')).toEqual(['gamma', { active: true }, ['delta', 7]]);
    expect(cache.get('object:value')).toEqual({ label: 'beta', nested: { id: 42 } });
    expect(cache.get('object:value')).toEqual({ label: 'beta', nested: { id: 42 } });

    cache.set('string:value', 'alpha');
    expect(cache.get('string:value')).toBe('alpha');
    expect(cache.get('string:value')).toBe('alpha');

    const circular = {};
    circular.self = circular;
    cache.set('circular:value', circular);

    expect(cache.has('number:value')).toBe(false);

    const entries = cache.getEntries(10);
    const entryMap = Object.fromEntries(entries);
    expect(entryMap['array:value']).toEqual(['gamma', { active: true }, ['delta', 7]]);
    expect(entryMap['string:value']).toBe('alpha');
    expect(entryMap['circular:value']).toBe(circular);

    const keys = cache.getKeys(10);
    expect(keys).toEqual(
      expect.arrayContaining(['array:value', 'object:value', 'string:value', 'circular:value'])
    );
    expect(keys).not.toContain('ghost:value');

    expect(cache.delete('array:value')).toBe(true);
    expect(cache.delete('missing:value')).toBe(false);

    cache.set('transient:value', 'blink', { ttl: 25 });
    await wait(35);

    const keysAfterTransientExpiry = cache.getKeys(10);
    expect(keysAfterTransientExpiry).not.toContain('transient:value');

    const prunedAfterTransient = cache.prune();
    expect(prunedAfterTransient).toBe(1);

    const metricsBeforeAggressive = cache.getMetrics();
    expect(metricsBeforeAggressive.strategyName).toBe('LFU');
    expect(metricsBeforeAggressive.memorySize).toBeGreaterThan(0);
    expect(metricsBeforeAggressive.frequencyStats.minFrequency).toBeGreaterThanOrEqual(1);
    expect(Object.keys(metricsBeforeAggressive.frequencyStats.frequencyDistribution).length).toBeGreaterThan(0);

    const memoryUsage = cache.getMemoryUsage();
    expect(memoryUsage.currentBytes).toBe(metricsBeforeAggressive.memorySize);
    expect(memoryUsage.maxBytes).toBe(4096);
    expect(memoryUsage.utilizationPercent).toBeGreaterThanOrEqual(0);

    const removedAggressively = cache.prune(true);
    expect(removedAggressively).toBe(metricsBeforeAggressive.size);
    expect(cache.getMetrics().size).toBe(0);

    cache.set('ephemeral:value', 'solo');
    expect(cache.delete('ephemeral:value')).toBe(true);
    expect(cache.getMetrics().size).toBe(0);
  });
});
