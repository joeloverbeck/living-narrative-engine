/**
 * @file CacheService - In-memory caching service with TTL support
 * @description Provides a generic caching solution with configurable TTL and LRU eviction
 */

/**
 * @typedef {object} CacheEntry
 * @property {*} value - The cached value
 * @property {number} timestamp - When the entry was cached
 * @property {number} ttl - Time to live in milliseconds
 */

/**
 * In-memory cache service with TTL and LRU eviction support
 */
class CacheService {
  #logger;
  #cache;
  #maxSize;
  #defaultTtl;
  #stats;

  /**
   * Creates an instance of CacheService
   * @param {object} logger - Logger instance
   * @param {object} config - Configuration object
   * @param {number} config.maxSize - Maximum number of entries in cache
   * @param {number} config.defaultTtl - Default TTL in milliseconds
   */
  constructor(logger, config = {}) {
    if (!logger) {
      throw new Error('CacheService: logger is required.');
    }

    this.#logger = logger;
    this.#cache = new Map();
    this.#maxSize = config.maxSize || 1000;
    this.#defaultTtl = config.defaultTtl || 5 * 60 * 1000; // 5 minutes default

    // Initialize statistics
    this.#stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
    };

    this.#logger.info('CacheService: Initialized with configuration', {
      maxSize: this.#maxSize,
      defaultTtl: this.#defaultTtl,
    });
  }

  /**
   * Gets a value from the cache
   * @param {string} key - Cache key
   * @returns {*} The cached value or undefined if not found/expired
   */
  get(key) {
    const entry = this.#cache.get(key);

    if (!entry) {
      this.#stats.misses++;
      this.#logger.debug(`CacheService: Cache miss for key '${key}'`);
      return undefined;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.#cache.delete(key);
      this.#stats.expirations++;
      this.#stats.misses++;
      this.#logger.debug(`CacheService: Cache entry expired for key '${key}'`);
      return undefined;
    }

    // Move to end (LRU)
    this.#cache.delete(key);
    this.#cache.set(key, entry);

    this.#stats.hits++;
    this.#logger.debug(`CacheService: Cache hit for key '${key}'`);
    return entry.value;
  }

  /**
   * Sets a value in the cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} [ttl] - Optional TTL in milliseconds
   */
  set(key, value, ttl) {
    // Evict oldest entry if at capacity
    if (!this.#cache.has(key) && this.#cache.size >= this.#maxSize) {
      const oldestKey = this.#cache.keys().next().value;
      this.#cache.delete(oldestKey);
      this.#stats.evictions++;
      this.#logger.debug(
        `CacheService: Evicted oldest entry with key '${oldestKey}'`
      );
    }

    const entry = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.#defaultTtl,
    };

    this.#cache.set(key, entry);
    this.#logger.debug(
      `CacheService: Cached value for key '${key}' with TTL ${entry.ttl}ms`
    );
  }

  /**
   * Gets a value from cache or loads it using the provided loader function
   * @param {string} key - Cache key
   * @param {Function} loader - Async function to load the value if not cached
   * @param {number} [ttl] - Optional TTL in milliseconds
   * @returns {Promise<*>} The cached or loaded value
   */
  async getOrLoad(key, loader, ttl) {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const value = await loader();
      this.set(key, value, ttl);
      return value;
    } catch (error) {
      this.#logger.error(
        `CacheService: Error loading value for key '${key}'`,
        error
      );
      throw error;
    }
  }

  /**
   * Invalidates a cache entry
   * @param {string} key - Cache key to invalidate
   * @returns {boolean} True if entry was deleted, false if not found
   */
  invalidate(key) {
    const existed = this.#cache.delete(key);
    if (existed) {
      this.#logger.info(
        `CacheService: Invalidated cache entry for key '${key}'`
      );
    }
    return existed;
  }

  /**
   * Invalidates all cache entries matching a pattern
   * @param {RegExp} pattern - Pattern to match keys against
   * @returns {number} Number of entries invalidated
   */
  invalidatePattern(pattern) {
    let count = 0;
    for (const key of this.#cache.keys()) {
      if (pattern.test(key)) {
        this.#cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      this.#logger.info(
        `CacheService: Invalidated ${count} cache entries matching pattern ${pattern}`
      );
    }

    return count;
  }

  /**
   * Clears all cache entries
   */
  clear() {
    const size = this.#cache.size;
    this.#cache.clear();
    this.#logger.info(`CacheService: Cleared all ${size} cache entries`);
  }

  /**
   * Gets cache statistics
   * @returns {object} Cache statistics
   */
  getStats() {
    const stats = {
      ...this.#stats,
      size: this.#cache.size,
      maxSize: this.#maxSize,
      hitRate:
        this.#stats.hits + this.#stats.misses > 0
          ? (
              (this.#stats.hits / (this.#stats.hits + this.#stats.misses)) *
              100
            ).toFixed(2) + '%'
          : '0%',
    };

    this.#logger.debug('CacheService: Retrieved cache statistics', stats);
    return stats;
  }

  /**
   * Resets cache statistics
   */
  resetStats() {
    this.#stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
    };
    this.#logger.info('CacheService: Reset cache statistics');
  }

  /**
   * Gets the current cache size
   * @returns {number} Number of entries in cache
   */
  getSize() {
    return this.#cache.size;
  }

  /**
   * Checks if a key exists and is not expired
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists and is not expired
   */
  has(key) {
    const entry = this.#cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.#cache.delete(key);
      this.#stats.expirations++;
      return false;
    }

    return true;
  }
}

export default CacheService;
