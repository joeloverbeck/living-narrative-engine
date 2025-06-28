/**
 *
 * @param max
 */
export default function createLruCache(max = 256) {
  const map = new Map();
  /**
   *
   * @param k
   */
  function get(k) {
    if (!map.has(k)) return null;
    const v = map.get(k);
    map.delete(k);
    map.set(k, v);
    return v;
  }
  /**
   *
   * @param k
   * @param v
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
  };
}
