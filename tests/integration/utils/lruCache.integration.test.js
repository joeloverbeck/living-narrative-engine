import { describe, it, expect, beforeEach } from '@jest/globals';
import LRUCache from '../../../src/utils/lruCache.js';

describe('LRUCache integration', () => {
  it('returns undefined for missing entries and reports default stats', () => {
    const cache = new LRUCache();

    expect(cache.get('missing-key')).toBeUndefined();
    expect(cache.getStats()).toEqual({
      size: 0,
      maxSize: 1000,
    });
  });

  describe('with a constrained cache size', () => {
    let cache;

    beforeEach(() => {
      cache = new LRUCache(2);
    });

    it('keeps most recently accessed entries and evicts the oldest', () => {
      cache.set('first', 'alpha');
      cache.set('second', 'beta');

      expect(cache.get('first')).toBe('alpha');
      cache.set('third', 'gamma');

      expect(cache.has('first')).toBe(true);
      expect(cache.has('second')).toBe(false);
      expect(cache.get('third')).toBe('gamma');
    });

    it('updates existing keys without overflowing and preserves order', () => {
      cache.set('alpha', 'one');
      cache.set('beta', 'two');

      cache.set('alpha', 'uno');
      expect(cache.get('alpha')).toBe('uno');

      cache.set('gamma', 'tres');

      expect(cache.has('alpha')).toBe(true);
      expect(cache.get('alpha')).toBe('uno');
      expect(cache.has('beta')).toBe(false);
    });

    it('clears stored entries and exposes accurate stats', () => {
      cache.set('left', 'value');
      cache.set('right', 'other');

      cache.clear();

      expect(cache.has('left')).toBe(false);
      expect(cache.get('right')).toBeUndefined();
      expect(cache.getStats()).toEqual({
        size: 0,
        maxSize: 2,
      });
    });
  });
});
