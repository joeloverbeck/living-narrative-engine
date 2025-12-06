/**
 * @file Additional coverage tests for LRUStrategy focusing on size calculation paths.
 */

import { describe, expect, it } from '@jest/globals';
import { LRUStrategy } from '../../../../src/cache/strategies/LRUStrategy.js';

describe('LRUStrategy memory sizing edge cases', () => {
  it('calculates size for strings, objects and primitive values', () => {
    const strategy = new LRUStrategy({ maxSize: 10, maxMemoryUsage: 10_000 });

    const cases = [
      { key: 'string', value: 'hello', expectedSize: 'hello'.length * 2 },
      {
        key: 'object',
        value: { foo: 'bar' },
        expectedSize: JSON.stringify({ foo: 'bar' }).length * 2,
      },
      { key: 'number', value: 42, expectedSize: 8 },
      { key: 'boolean', value: false, expectedSize: 8 },
      { key: 'null', value: null, expectedSize: 8 },
    ];

    for (const { key, value, expectedSize } of cases) {
      strategy.clear();
      strategy.set(key, value);
      expect(strategy.memorySize).toBe(expectedSize);
    }
  });

  it('falls back to the default size when JSON stringification fails', () => {
    const strategy = new LRUStrategy({ maxSize: 5, maxMemoryUsage: 10_000 });
    const circular = {};
    circular.self = circular;

    strategy.set('circular', circular);
    expect(strategy.memorySize).toBe(100);
  });

  it('recursively sums sizes when caching arrays with mixed values', () => {
    const strategy = new LRUStrategy({ maxSize: 5, maxMemoryUsage: 10_000 });

    const arrayValue = ['ab', { foo: 'bar' }, [1, 2]];
    strategy.set('mixed-array', arrayValue);

    const stringBytes = 'ab'.length * 2;
    const objectBytes = JSON.stringify({ foo: 'bar' }).length * 2;
    const nestedArrayBytes = 24 + 8 + 8; // Array overhead + two primitive numbers
    const expectedSize = 24 + stringBytes + objectBytes + nestedArrayBytes;

    expect(strategy.memorySize).toBe(expectedSize);
  });

  it('does not refresh TTL when updateAgeOnGet is explicitly disabled', async () => {
    const strategy = new LRUStrategy({ ttl: 200, updateAgeOnGet: false });

    strategy.set('session', 'value');

    // Allow some time to pass, but stay well within the TTL window to ensure the
    // value is still available.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(strategy.get('session')).toBe('value');

    // After exceeding the original TTL window, the entry should be gone because the
    // previous read did not refresh its age.
    await new Promise((resolve) => setTimeout(resolve, 170));
    expect(strategy.get('session')).toBeUndefined();
  });
});
