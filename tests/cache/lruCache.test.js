import { LRUCache } from 'lru-cache';

describe('LRUCache', () => {
  test('evicts oldest entry when max size is exceeded', () => {
    const cache = new LRUCache({ max: 3 });

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // Should evict 'a'

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
    expect(cache.size).toBe(3);
  });

  test('moves accessed key to MRU position', () => {
    const cache = new LRUCache({ max: 3 });

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    // Access 'a' to move it to MRU
    cache.get('a');

    // Add new item, should evict 'b' (oldest)
    cache.set('d', 4);

    expect(cache.get('a')).toBe(1); // Still present
    expect(cache.get('b')).toBeUndefined(); // Evicted
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  test('size getter returns accurate count', () => {
    const cache = new LRUCache({ max: 5 });

    expect(cache.size).toBe(0);

    cache.set('a', 1);
    expect(cache.size).toBe(1);

    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.size).toBe(3);

    cache.clear();
    expect(cache.size).toBe(0);
  });

  test('exposes configured max size', () => {
    const cache = new LRUCache({ max: 4 });

    expect(cache.max).toBe(4);
  });
});
