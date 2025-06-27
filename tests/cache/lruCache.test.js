import createLruCache from '../../src/scopeDsl/cache/lruCache.js';

describe('createLruCache', () => {
  test('evicts oldest entry when max size is exceeded', () => {
    const cache = createLruCache(3);
    
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // Should evict 'a'
    
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
    expect(cache.size).toBe(3);
  });

  test('moves accessed key to MRU position', () => {
    const cache = createLruCache(3);
    
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    
    // Access 'a' to move it to MRU
    cache.get('a');
    
    // Add new item, should evict 'b' (oldest)
    cache.set('d', 4);
    
    expect(cache.get('a')).toBe(1); // Still present
    expect(cache.get('b')).toBeNull(); // Evicted
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  test('size getter returns accurate count', () => {
    const cache = createLruCache(5);
    
    expect(cache.size).toBe(0);
    
    cache.set('a', 1);
    expect(cache.size).toBe(1);
    
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.size).toBe(3);
    
    cache.clear();
    expect(cache.size).toBe(0);
  });
});