export default class BoundedCache {
  /**
   * @param {number} maxSize
   */
  constructor(maxSize = 100) {
    if (!Number.isInteger(maxSize) || maxSize <= 0) {
      throw new Error('BoundedCache requires a positive integer maxSize');
    }

    this.#maxSize = maxSize;
    this.#map = new Map();
  }

  /**
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    if (this.#map.has(key)) {
      this.#map.delete(key);
    }

    this.#map.set(key, value);
    this.#evictIfNeeded();
  }

  /**
   * @param {string} key
   * @returns {*}
   */
  get(key) {
    if (!this.#map.has(key)) {
      return undefined;
    }

    const value = this.#map.get(key);
    this.#map.delete(key);
    this.#map.set(key, value);
    return value;
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.#map.has(key);
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  delete(key) {
    return this.#map.delete(key);
  }

  clear() {
    this.#map.clear();
  }

  get size() {
    return this.#map.size;
  }

  #evictIfNeeded() {
    if (this.#map.size <= this.#maxSize) {
      return;
    }

    const oldestKey = this.#map.keys().next().value;
    this.#map.delete(oldestKey);
  }

  #map;
  #maxSize;
}
