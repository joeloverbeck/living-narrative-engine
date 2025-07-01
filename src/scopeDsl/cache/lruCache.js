/**
 * Create a lightweight least-recently-used (LRU) cache.
 *
 * @description Provides simple get/set semantics with automatic eviction of
 * the least recently used entry once the maximum size is reached.
 * @param {number} [max] - Maximum number of entries to keep.
 * @returns {{
 *   get: (key: string) => any,
 *   set: (key: string, value: any) => void,
 *   clear: () => void,
 *   readonly size: number,
 *   readonly max: number
 * }} Cache instance with basic LRU semantics.
 */
export default function createLruCache(max = 256) {
  const map = new Map();

  /**
   * Retrieve a value from the cache.
   *
   * @description Moves the key to the most recently used position.
   * @param {string} k - Cache key
   * @returns {*} Cached value or `undefined` if not present
   */
  function get(k) {
    if (!map.has(k)) return undefined;
    const v = map.get(k);
    map.delete(k);
    map.set(k, v);
    return v;
  }

  /**
   * Store a value in the cache.
   *
   * @description Evicts the least recently used entry when capacity is exceeded.
   * @param {string} k - Cache key
   * @param {*} v - Value to store
   * @returns {void}
   */
  function set(k, v) {
    if (map.has(k)) map.delete(k);
    else if (map.size >= max) map.delete(map.keys().next().value);
    map.set(k, v);
  }

  return {
    get,
    set,
    clear: () => map.clear(),
    get size() {
      return map.size;
    },
    get max() {
      return max;
    },
  };
}
