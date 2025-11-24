import BoundedCache from '../../../../src/goap/utils/boundedCache.js';

describe('BoundedCache', () => {
  it('should evict the least recently used entry when maxSize is exceeded', () => {
    const cache = new BoundedCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    cache.set('d', 4);

    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
    expect(cache.has('d')).toBe(true);
    expect(cache.size).toBe(3);
  });

  it('should update access order on get', () => {
    const cache = new BoundedCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    expect(cache.get('a')).toBe(1);
    cache.set('d', 4);

    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('c')).toBe(true);
    expect(cache.has('d')).toBe(true);
  });

  it('should handle size of one by always keeping the most recent entry', () => {
    const cache = new BoundedCache(1);
    cache.set('first', 'value1');
    cache.set('second', 'value2');

    expect(cache.has('first')).toBe(false);
    expect(cache.get('second')).toBe('value2');
    expect(cache.size).toBe(1);
  });

  it('should support delete and clear operations', () => {
    const cache = new BoundedCache(2);
    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.delete('a')).toBe(true);
    expect(cache.has('a')).toBe(false);
    expect(cache.size).toBe(1);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('b')).toBeUndefined();
  });

  it('should return undefined for missing keys without altering size', () => {
    const cache = new BoundedCache(2);
    cache.set('present', 123);

    expect(cache.get('absent')).toBeUndefined();
    expect(cache.size).toBe(1);
  });
});
