import { TurnScopedCache } from '../../src/utils/turnScopedCache';
import { describe, beforeEach, it, expect } from '@jest/globals';

describe('TurnScopedCache (JS)', () => {
  let cache;
  let logMessages;

  beforeEach(() => {
    logMessages = [];
    const logger = { warn: (msg) => logMessages.push(msg) };
    cache = new TurnScopedCache(logger);
  });

  it('should add and retrieve items', () => {
    const item = { index: 1, value: 'foo' };
    cache.add(item);
    expect(cache.get(1)).toBe(item);
  });

  it('should return undefined for missing index', () => {
    expect(cache.get(999)).toBeUndefined();
  });

  it('should log and throw on duplicate index', () => {
    const first = { index: 2, value: 'first' };
    const dup = { index: 2, value: 'second' };
    cache.add(first);
    expect(() => cache.add(dup)).toThrowError(
      'Duplicate index 2 in TurnScopedCache'
    );
    expect(logMessages).toContain('Duplicate index 2 in TurnScopedCache');
  });

  it('should clear all entries', () => {
    cache.add({ index: 5, foo: 'bar' });
    cache.add({ index: 6, foo: 'baz' });
    expect(cache.get(5)).toBeDefined();
    expect(cache.get(6)).toBeDefined();

    cache.clear();

    expect(cache.get(5)).toBeUndefined();
    expect(cache.get(6)).toBeUndefined();
  });
});
