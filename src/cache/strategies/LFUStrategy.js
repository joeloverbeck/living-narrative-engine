/**
 * @file LFU (Least Frequently Used) cache strategy implementation
 * @description Evicts entries based on access frequency rather than recency
 */

/**
 * LFU cache strategy implementation
 * Tracks access frequency and evicts least frequently used entries
 */
export class LFUStrategy {
  #cache = new Map();
  #frequencies = new Map();
  #frequencyGroups = new Map();
  #minFrequency = 1;
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

    // Initialize frequency group for frequency 1
    this.#frequencyGroups.set(1, new Set());
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
   * Update frequency tracking for a key
   *
   * @param {string} key - Cache key
   * @private
   */
  #updateFrequency(key) {
    const currentFreq = this.#frequencies.get(key) || 0;
    const newFreq = currentFreq + 1;

    // Remove from current frequency group
    if (currentFreq > 0) {
      const currentGroup = this.#frequencyGroups.get(currentFreq);
      if (currentGroup) {
        currentGroup.delete(key);
        // Update min frequency if this was the last item in the min frequency group
        if (currentFreq === this.#minFrequency && currentGroup.size === 0) {
          this.#minFrequency = newFreq;
        }
      }
    }

    // Add to new frequency group
    this.#frequencies.set(key, newFreq);
    if (!this.#frequencyGroups.has(newFreq)) {
      this.#frequencyGroups.set(newFreq, new Set());
    }
    this.#frequencyGroups.get(newFreq).add(key);

    // Reset min frequency to 1 if this is a new key
    if (currentFreq === 0) {
      this.#minFrequency = 1;
    }
  }

  /**
   * Remove frequency tracking for a key
   *
   * @param {string} key - Cache key
   * @private
   */
  #removeFrequency(key) {
    const freq = this.#frequencies.get(key);
    if (freq !== undefined) {
      this.#frequencies.delete(key);
      const group = this.#frequencyGroups.get(freq);
      if (group) {
        group.delete(key);
        // Clean up empty frequency groups
        if (group.size === 0) {
          this.#frequencyGroups.delete(freq);
          // Update min frequency if needed
          if (freq === this.#minFrequency) {
            this.#minFrequency = this.#findMinFrequency();
          }
        }
      }
    }
  }

  /**
   * Find the minimum frequency among all entries
   *
   * @returns {number} Minimum frequency
   * @private
   */
  #findMinFrequency() {
    if (this.#frequencyGroups.size === 0) {
      return 1;
    }
    // Use reduce to avoid stack overflow with large maps
    const frequencies = Array.from(this.#frequencyGroups.keys());
    return frequencies.reduce((min, freq) => Math.min(min, freq), Infinity);
  }

  /**
   * Evict the least frequently used entry
   *
   * @private
   */
  #evictLFU() {
    // Find a key in the minimum frequency group
    const minFreqGroup = this.#frequencyGroups.get(this.#minFrequency);
    if (minFreqGroup && minFreqGroup.size > 0) {
      // Get the first key from the min frequency group (arbitrary choice)
      const keyToEvict = minFreqGroup.values().next().value;
      this.delete(keyToEvict);
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

    // Update frequency
    this.#updateFrequency(key);

    // Update access time if configured
    if (this.#config.updateAgeOnGet && entry.ttl) {
      entry.expiresAt = Date.now() + entry.ttl;
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
    // Check if we need to evict
    const isUpdate = this.#cache.has(key);
    if (!isUpdate && this.#cache.size >= this.#config.maxSize) {
      this.#evictLFU();
    }

    const ttl = options.ttl !== undefined ? options.ttl : this.#config.ttl;
    const entry = {
      value,
      createdAt: Date.now(),
      ttl,
      expiresAt: ttl ? Date.now() + ttl : null,
      size: this.#config.maxMemoryUsage ? this.#calculateSize(value) : 0,
    };

    this.#cache.set(key, entry);

    // Update frequency (this will set it to 1 for new keys, or increment for existing)
    if (!isUpdate) {
      this.#frequencies.set(key, 0); // Start at 0, will be incremented to 1
    }
    this.#updateFrequency(key);
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
      this.#removeFrequency(key);
    }
    return deleted;
  }

  /**
   * Clear all entries from the cache
   */
  clear() {
    this.#cache.clear();
    this.#frequencies.clear();
    this.#frequencyGroups.clear();
    this.#frequencyGroups.set(1, new Set());
    this.#minFrequency = 1;
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
   * Get cache entries iterator
   *
   * @returns {IterableIterator<[string, *]>} Iterator of key-value pairs
   */
  * entries() {
    for (const [key, entry] of this.#cache.entries()) {
      if (!this.#isExpired(entry)) {
        yield [key, entry.value];
      }
    }
  }

  /**
   * Get cache keys iterator
   *
   * @returns {IterableIterator<string>} Iterator of keys
   */
  * keys() {
    for (const [key, entry] of this.#cache.entries()) {
      if (!this.#isExpired(entry)) {
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
    const now = Date.now();
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
    return 'LFU';
  }

  /**
   * Get frequency statistics
   *
   * @returns {object} Frequency distribution
   */
  getFrequencyStats() {
    // Use reduce to avoid stack overflow with large maps
    const frequencyValues = Array.from(this.#frequencies.values());
    const stats = {
      minFrequency: this.#minFrequency,
      maxFrequency: frequencyValues.length > 0
        ? frequencyValues.reduce((max, freq) => Math.max(max, freq), -Infinity)
        : 0,
      averageFrequency: 0,
      frequencyDistribution: {},
    };

    if (this.#frequencies.size > 0) {
      const totalFreq = Array.from(this.#frequencies.values()).reduce((sum, freq) => sum + freq, 0);
      stats.averageFrequency = totalFreq / this.#frequencies.size;
    }

    // Build frequency distribution
    for (const [freq, group] of this.#frequencyGroups.entries()) {
      stats.frequencyDistribution[freq] = group.size;
    }

    return stats;
  }
}

export default LFUStrategy;