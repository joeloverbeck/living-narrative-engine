/**
 * @file LRU (Least Recently Used) cache strategy implementation
 * @description Leverages the lru-cache package for efficient LRU caching
 */

import { LRUCache } from 'lru-cache';

/**
 * LRU cache strategy implementation using the lru-cache package
 */
export class LRUStrategy {
  #cache;
  #config;

  /**
   * @param {object} config - Cache configuration
   * @param {number} [config.maxSize] - Maximum number of entries
   * @param {number} [config.ttl] - Time to live in milliseconds
   * @param {boolean} [config.updateAgeOnGet] - Reset TTL on access
   * @param {number} [config.maxMemoryUsage] - Maximum memory usage in bytes
   */
  constructor(config = {}) {
    this.#config = {
      maxSize: config.maxSize || 1000,
      ttl: config.ttl || 300000, // 5 minutes
      updateAgeOnGet: config.updateAgeOnGet !== false,
      maxMemoryUsage: config.maxMemoryUsage,
    };

    this.#cache = new LRUCache({
      max: this.#config.maxSize,
      ttl: this.#config.ttl,
      updateAgeOnGet: this.#config.updateAgeOnGet,
      sizeCalculation: this.#config.maxMemoryUsage
        ? (value) => this.#calculateSize(value)
        : undefined,
      maxSize: this.#config.maxMemoryUsage,
    });
  }

  /**
   * Calculate approximate size of cached value in bytes
   *
   * @param {*} value - The value to size
   * @returns {number} Size in bytes
   * @private
   */
  #calculateSize(value) {
    if (typeof value === 'string') {
      return value.length * 2; // 2 bytes per character (UTF-16)
    }
    if (Array.isArray(value)) {
      return value.reduce((size, item) => size + this.#calculateSize(item), 24); // Array overhead
    }
    if (value && typeof value === 'object') {
      try {
        return JSON.stringify(value).length * 2;
      } catch {
        return 100; // Default size for non-serializable objects
      }
    }
    return 8; // Default size for primitives
  }

  /**
   * Get a value from the cache
   *
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    return this.#cache.get(key);
  }

  /**
   * Set a value in the cache
   *
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {object} [options] - Additional options
   * @param {number} [options.ttl] - Override TTL for this entry
   */
  set(key, value, options = {}) {
    const setOptions = {};
    if (options.ttl !== undefined) {
      setOptions.ttl = options.ttl;
    }
    this.#cache.set(key, value, setOptions);
  }

  /**
   * Check if a key exists in the cache
   *
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists
   */
  has(key) {
    return this.#cache.has(key);
  }

  /**
   * Delete a specific entry from the cache
   *
   * @param {string} key - Cache key
   * @returns {boolean} True if entry was deleted
   */
  delete(key) {
    return this.#cache.delete(key);
  }

  /**
   * Clear all entries from the cache
   */
  clear() {
    this.#cache.clear();
  }

  /**
   * Get cache size
   *
   * @returns {number} Number of entries in cache
   */
  get size() {
    return this.#cache.size;
  }

  /**
   * Get maximum cache size
   *
   * @returns {number} Maximum number of entries
   */
  get maxSize() {
    return this.#cache.max;
  }

  /**
   * Get calculated memory size (if enabled)
   *
   * @returns {number} Current memory usage in bytes
   */
  get memorySize() {
    return this.#cache.calculatedSize || 0;
  }

  /**
   * Get cache entries iterator
   *
   * @returns {IterableIterator<[string, *]>} Iterator of key-value pairs
   */
  entries() {
    return this.#cache.entries();
  }

  /**
   * Get cache keys iterator
   *
   * @returns {IterableIterator<string>} Iterator of keys
   */
  keys() {
    return this.#cache.keys();
  }

  /**
   * Prune expired entries
   *
   * @param {boolean} [aggressive] - Whether to prune aggressively
   * @returns {number} Number of entries pruned
   */
  prune(aggressive = false) {
    const sizeBefore = this.#cache.size;
    
    if (aggressive) {
      // Clear everything for aggressive pruning
      this.#cache.clear();
      return sizeBefore;
    }
    
    // Let lru-cache handle normal pruning
    this.#cache.purgeStale();
    return sizeBefore - this.#cache.size;
  }

  /**
   * Get strategy name
   *
   * @returns {string} Strategy name
   */
  get strategyName() {
    return 'LRU';
  }
}

export default LRUStrategy;