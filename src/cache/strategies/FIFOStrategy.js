/**
 * @file FIFO (First In First Out) cache strategy implementation
 * @description Evicts entries based on insertion order, oldest entries first
 */

/**
 * FIFO cache strategy implementation
 * Maintains insertion order and evicts the oldest entries when capacity is reached
 */
export class FIFOStrategy {
  #cache = new Map();
  #insertionOrder = [];
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
   * Evict the oldest (first inserted) entry
   *
   * @private
   */
  #evictFIFO() {
    if (this.#insertionOrder.length > 0) {
      const oldestKey = this.#insertionOrder.shift();
      this.#cache.delete(oldestKey);
    }
  }

  /**
   * Check if entry is expired
   *
   * @param {object} entry - Cache entry
   * @returns {boolean} True if expired
   * @private
   */
  #isExpired(entry) {
    return entry.ttl && Date.now() > entry.expiresAt;
  }

  /**
   * Remove key from insertion order tracking
   *
   * @param {string} key - Key to remove
   * @private
   */
  #removeFromInsertionOrder(key) {
    const index = this.#insertionOrder.indexOf(key);
    if (index !== -1) {
      this.#insertionOrder.splice(index, 1);
    }
  }

  /**
   * Get a value from the cache
   *
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    const entry = this.#cache.get(key);
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (this.#isExpired(entry)) {
      this.delete(key);
      return undefined;
    }

    // Update access time if configured
    if (this.#config.updateAgeOnGet && entry.ttl) {
      entry.expiresAt = Date.now() + entry.ttl;
      entry.lastAccessed = Date.now();
    }

    return entry.value;
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
    const isUpdate = this.#cache.has(key);

    // If updating existing key, remove it from insertion order first
    if (isUpdate) {
      this.#removeFromInsertionOrder(key);
    }

    // Check if we need to evict (only for new entries)
    if (!isUpdate && this.#cache.size >= this.#config.maxSize) {
      this.#evictFIFO();
    }

    const ttl = options.ttl !== undefined ? options.ttl : this.#config.ttl;
    const now = Date.now();
    const entry = {
      value,
      createdAt: now,
      lastAccessed: now,
      ttl,
      expiresAt: ttl ? now + ttl : null,
      size: this.#config.maxMemoryUsage ? this.#calculateSize(value) : 0,
    };

    this.#cache.set(key, entry);
    
    // Add to end of insertion order (maintains FIFO order)
    this.#insertionOrder.push(key);
  }

  /**
   * Check if a key exists in the cache
   *
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists and not expired
   */
  has(key) {
    const entry = this.#cache.get(key);
    if (!entry) {
      return false;
    }

    // Check if expired
    if (this.#isExpired(entry)) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a specific entry from the cache
   *
   * @param {string} key - Cache key
   * @returns {boolean} True if entry was deleted
   */
  delete(key) {
    const deleted = this.#cache.delete(key);
    if (deleted) {
      this.#removeFromInsertionOrder(key);
    }
    return deleted;
  }

  /**
   * Clear all entries from the cache
   */
  clear() {
    this.#cache.clear();
    this.#insertionOrder = [];
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
    return this.#config.maxSize;
  }

  /**
   * Get calculated memory size (if enabled)
   *
   * @returns {number} Current memory usage in bytes
   */
  get memorySize() {
    if (!this.#config.maxMemoryUsage) {
      return 0;
    }
    let total = 0;
    for (const entry of this.#cache.values()) {
      total += entry.size || 0;
    }
    return total;
  }

  /**
   * Get cache entries iterator (in FIFO order)
   *
   * @returns {IterableIterator<[string, *]>} Iterator of key-value pairs
   */
  * entries() {
    // Return entries in insertion order
    for (const key of this.#insertionOrder) {
      const entry = this.#cache.get(key);
      if (entry && !this.#isExpired(entry)) {
        yield [key, entry.value];
      }
    }
  }

  /**
   * Get cache keys iterator (in FIFO order)
   *
   * @returns {IterableIterator<string>} Iterator of keys
   */
  * keys() {
    // Return keys in insertion order
    for (const key of this.#insertionOrder) {
      const entry = this.#cache.get(key);
      if (entry && !this.#isExpired(entry)) {
        yield key;
      }
    }
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
      this.clear();
      return sizeBefore;
    }

    // Remove expired entries
    const keysToRemove = [];

    for (const [key, entry] of this.#cache.entries()) {
      if (this.#isExpired(entry)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => this.delete(key));
    return keysToRemove.length;
  }

  /**
   * Get strategy name
   *
   * @returns {string} Strategy name
   */
  get strategyName() {
    return 'FIFO';
  }

  /**
   * Get insertion order statistics
   *
   * @returns {object} FIFO-specific statistics
   */
  getInsertionStats() {
    const stats = {
      insertionOrder: [...this.#insertionOrder],
      oldestKey: this.#insertionOrder[0] || null,
      newestKey: this.#insertionOrder[this.#insertionOrder.length - 1] || null,
      orderIntegrity: this.#insertionOrder.length === this.#cache.size,
    };

    // Calculate average age of entries
    if (this.#cache.size > 0) {
      const now = Date.now();
      let totalAge = 0;
      let validEntries = 0;

      for (const key of this.#insertionOrder) {
        const entry = this.#cache.get(key);
        if (entry && !this.#isExpired(entry)) {
          totalAge += now - entry.createdAt;
          validEntries++;
        }
      }

      stats.averageAge = validEntries > 0 ? totalAge / validEntries : 0;
    } else {
      stats.averageAge = 0;
    }

    return stats;
  }
}

export default FIFOStrategy;