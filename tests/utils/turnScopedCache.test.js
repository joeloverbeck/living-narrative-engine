import { TurnScopedCache } from '../../src/utils/turnScopedCache';
import {
  describe,
  beforeAll,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';

describe('TurnScopedCache (JS)', () => {
  let cache;
  let logMessages;

  beforeAll(() => {
    // Use fake timers to ensure no async behavior is introduced
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Confirm no pending timers remain
    expect(jest.getTimerCount()).toBe(0);
  });

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

  it('should have size 3 after adding 3 items', () => {
    const items = [
      { index: 1, value: 'one' },
      { index: 2, value: 'two' },
      { index: 3, value: 'three' },
    ];
    items.forEach((it) => cache.add(it));
    // Internal map should contain three entries
    expect(cache._map.size).toBe(3);
    // And each item should be retrievable
    items.forEach((it) => {
      expect(cache.get(it.index)).toBe(it);
    });
  });

  it('should log and throw on duplicate index', () => {
    const first = { index: 2, value: 'first' };
    const dup = { index: 2, value: 'second' };
    cache.add(first);
    expect(() => cache.add(dup)).toThrow(
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
    // After clear, internal map should be empty
    expect(cache._map.size).toBe(0);
  });
});
