/**
 * @file CacheService - Optimized in-memory caching service with TTL support and O(1) LRU
 * @description Provides a high-performance caching solution with proper LRU implementation,
 * memory management, and automated cleanup capabilities
 */

/**
 * @typedef {object} CacheEntry
 * @property {*} value - The cached value
 * @property {number} timestamp - When the entry was cached
 * @property {number} ttl - Time to live in milliseconds
 * @property {number} accessCount - Number of times accessed
 * @property {number} lastAccessed - Last access timestamp
 */

/**
 * @typedef {object} LRUNode
 * @property {string} key - The cache key
 * @property {CacheEntry} entry - The cache entry
 * @property {LRUNode|null} prev - Previous node in LRU list
 * @property {LRUNode|null} next - Next node in LRU list
 */

/**
 * Optimized in-memory cache service with TTL and true O(1) LRU eviction support
 */
class CacheService {
  #logger;
  #cache;
  #maxSize;
  #defaultTtl;
  #stats;
  #head;
  #tail;
  #maxMemoryBytes;
  #currentMemoryBytes;
  #cleanupIntervalId;
  #enableAutoCleanup;

  /**
   * Creates an instance of CacheService
   * @param {object} logger - Logger instance
   * @param {object} config - Configuration object
   * @param {number} config.maxSize - Maximum number of entries in cache
   * @param {number} config.defaultTtl - Default TTL in milliseconds
   * @param {number} config.maxMemoryBytes - Maximum memory usage in bytes
   * @param {boolean} config.enableAutoCleanup - Enable automatic cleanup of expired entries
   * @param {number} config.cleanupIntervalMs - Cleanup interval in milliseconds
   */
  constructor(logger, config = {}) {
    if (!logger) {
      throw new Error('CacheService: logger is required.');
    }

    this.#logger = logger;
    this.#cache = new Map();
    this.#maxSize = config.maxSize || 1000;
    this.#defaultTtl = config.defaultTtl || 5 * 60 * 1000; // 5 minutes default
    this.#maxMemoryBytes = config.maxMemoryBytes || 50 * 1024 * 1024; // 50MB default
    this.#currentMemoryBytes = 0;
    this.#enableAutoCleanup = config.enableAutoCleanup !== false; // Default true
    this.#cleanupIntervalId = null;

    // Initialize doubly linked list for O(1) LRU operations
    this.#head = { key: null, entry: null, prev: null, next: null };
    this.#tail = { key: null, entry: null, prev: null, next: null };
    this.#head.next = this.#tail;
    this.#tail.prev = this.#head;

    // Initialize enhanced statistics
    this.#stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
      memoryEvictions: 0,
      autoCleanups: 0,
      totalMemoryBytes: 0,
      averageEntrySize: 0,
    };

    this.#logger.info(
      'CacheService: Initialized with optimized configuration',
      {
        maxSize: this.#maxSize,
        defaultTtl: this.#defaultTtl,
        maxMemoryBytes: this.#maxMemoryBytes,
        enableAutoCleanup: this.#enableAutoCleanup,
      }
    );

    // Start automatic cleanup if enabled
    if (this.#enableAutoCleanup) {
      this.#startAutoCleanup(config.cleanupIntervalMs || 60000); // 1 minute default
    }
  }

  /**
   * Gets a value from the cache with O(1) complexity
   * @param {string} key - Cache key
   * @returns {*} The cached value or undefined if not found/expired
   */
  get(key) {
    const node = this.#cache.get(key);

    if (!node) {
      this.#stats.misses++;
      this.#logger.debug(`CacheService: Cache miss for key '${key}'`);
      return undefined;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - node.entry.timestamp > node.entry.ttl) {
      this.#removeNode(node);
      this.#cache.delete(key);
      this.#currentMemoryBytes -= this.#estimateEntrySize(node.entry);
      this.#stats.expirations++;
      this.#stats.misses++;
      this.#logger.debug(`CacheService: Cache entry expired for key '${key}'`);
      return undefined;
    }

    // Move to head (most recently used) - O(1) operation
    this.#moveToHead(node);

    // Update access statistics
    node.entry.accessCount++;
    node.entry.lastAccessed = now;

    this.#stats.hits++;
    this.#logger.debug(`CacheService: Cache hit for key '${key}'`);
    return node.entry.value;
  }

  /**
   * Sets a value in the cache with O(1) complexity and memory management
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} [ttl] - Optional TTL in milliseconds
   */
  set(key, value, ttl) {
    const now = Date.now();
    const entry = {
      value,
      timestamp: now,
      ttl: ttl || this.#defaultTtl,
      accessCount: 1,
      lastAccessed: now,
    };

    const entrySize = this.#estimateEntrySize(entry);

    // Check if updating existing entry
    if (this.#cache.has(key)) {
      const existingNode = this.#cache.get(key);
      const oldSize = this.#estimateEntrySize(existingNode.entry);
      this.#currentMemoryBytes -= oldSize;

      // Update existing node
      existingNode.entry = entry;
      this.#moveToHead(existingNode);
      this.#currentMemoryBytes += entrySize;

      this.#logger.debug(`CacheService: Updated cache entry for key '${key}'`);
      return;
    }

    // Check memory limits before adding new entry
    if (this.#currentMemoryBytes + entrySize > this.#maxMemoryBytes) {
      this.#evictByMemory(entrySize);
    }

    // Check size limits and evict LRU entries if needed
    while (this.#cache.size >= this.#maxSize) {
      this.#evictLRU();
    }

    // Create new node and add to head
    const newNode = {
      key,
      entry,
      prev: null,
      next: null,
    };

    this.#cache.set(key, newNode);
    this.#addToHead(newNode);
    this.#currentMemoryBytes += entrySize;

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
    const node = this.#cache.get(key);
    if (node) {
      this.#removeNode(node);
      this.#cache.delete(key);
      this.#currentMemoryBytes -= this.#estimateEntrySize(node.entry);
      this.#logger.info(
        `CacheService: Invalidated cache entry for key '${key}'`
      );
      return true;
    }
    return false;
  }

  /**
   * Invalidates all cache entries matching a pattern
   * @param {RegExp} pattern - Pattern to match keys against
   * @returns {number} Number of entries invalidated
   */
  invalidatePattern(pattern) {
    let count = 0;
    let freedMemory = 0;

    // Collect matching keys to avoid modifying while iterating
    const matchingKeys = [];
    for (const key of this.#cache.keys()) {
      if (pattern.test(key)) {
        matchingKeys.push(key);
      }
    }

    // Remove matching entries
    for (const key of matchingKeys) {
      const node = this.#cache.get(key);
      if (node) {
        const entrySize = this.#estimateEntrySize(node.entry);
        this.#removeNode(node);
        this.#cache.delete(key);
        this.#currentMemoryBytes -= entrySize;
        freedMemory += entrySize;
        count++;
      }
    }

    if (count > 0) {
      this.#logger.info(
        `CacheService: Invalidated ${count} cache entries matching pattern ${pattern}, freed ${freedMemory} bytes`
      );
    }

    return count;
  }

  /**
   * Clears all cache entries and resets LRU list
   */
  clear() {
    const size = this.#cache.size;
    this.#cache.clear();
    this.#currentMemoryBytes = 0;

    // Reset LRU list
    this.#head.next = this.#tail;
    this.#tail.prev = this.#head;

    this.#logger.info(`CacheService: Cleared all ${size} cache entries`);
  }

  /**
   * Gets enhanced cache statistics with memory and performance metrics
   * @returns {object} Cache statistics
   */
  getStats() {
    const totalRequests = this.#stats.hits + this.#stats.misses;
    const stats = {
      ...this.#stats,
      size: this.#cache.size,
      maxSize: this.#maxSize,
      currentMemoryBytes: this.#currentMemoryBytes,
      maxMemoryBytes: this.#maxMemoryBytes,
      memoryUsagePercent:
        ((this.#currentMemoryBytes / this.#maxMemoryBytes) * 100).toFixed(2) +
        '%',
      hitRate:
        totalRequests > 0
          ? ((this.#stats.hits / totalRequests) * 100).toFixed(2) + '%'
          : '0%',
      averageEntrySize:
        this.#cache.size > 0
          ? Math.round(this.#currentMemoryBytes / this.#cache.size)
          : 0,
      efficiency: {
        memoryEvictionRate:
          totalRequests > 0
            ? ((this.#stats.memoryEvictions / totalRequests) * 100).toFixed(2) +
              '%'
            : '0%',
        expirationRate:
          totalRequests > 0
            ? ((this.#stats.expirations / totalRequests) * 100).toFixed(2) + '%'
            : '0%',
        autoCleanupCount: this.#stats.autoCleanups,
      },
    };

    this.#logger.debug(
      'CacheService: Retrieved enhanced cache statistics',
      stats
    );
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
      memoryEvictions: 0,
      autoCleanups: 0,
      totalMemoryBytes: 0,
      averageEntrySize: 0,
    };
    this.#logger.info('CacheService: Reset enhanced cache statistics');
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
    const node = this.#cache.get(key);
    if (!node) return false;

    const now = Date.now();
    if (now - node.entry.timestamp > node.entry.ttl) {
      this.#removeNode(node);
      this.#cache.delete(key);
      this.#currentMemoryBytes -= this.#estimateEntrySize(node.entry);
      this.#stats.expirations++;
      return false;
    }

    return true;
  }

  // Private helper methods for LRU operations and memory management

  /**
   * Adds a node to the head of the LRU list (O(1))
   * @param {LRUNode} node - Node to add
   * @private
   */
  #addToHead(node) {
    node.prev = this.#head;
    node.next = this.#head.next;
    this.#head.next.prev = node;
    this.#head.next = node;
  }

  /**
   * Removes a node from the LRU list (O(1))
   * @param {LRUNode} node - Node to remove
   * @private
   */
  #removeNode(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  /**
   * Moves a node to the head of the LRU list (O(1))
   * @param {LRUNode} node - Node to move
   * @private
   */
  #moveToHead(node) {
    this.#removeNode(node);
    this.#addToHead(node);
  }

  /**
   * Removes and returns the last node from the LRU list (O(1))
   * @returns {LRUNode} The removed node
   * @private
   */
  #removeTail() {
    const last = this.#tail.prev;
    this.#removeNode(last);
    return last;
  }

  /**
   * Evicts the least recently used entry (O(1))
   * @private
   */
  #evictLRU() {
    const tail = this.#removeTail();
    if (tail && tail.key) {
      this.#cache.delete(tail.key);
      this.#currentMemoryBytes -= this.#estimateEntrySize(tail.entry);
      this.#stats.evictions++;
      this.#logger.debug(
        `CacheService: Evicted LRU entry with key '${tail.key}'`
      );
    }
  }

  /**
   * Evicts entries to free up memory for a new entry
   * @param {number} requiredSize - Bytes needed for new entry
   * @private
   */
  #evictByMemory(requiredSize) {
    let freedMemory = 0;
    let evictionCount = 0;

    while (
      this.#currentMemoryBytes + requiredSize > this.#maxMemoryBytes &&
      this.#cache.size > 0
    ) {
      const tail = this.#removeTail();
      if (tail && tail.key) {
        const entrySize = this.#estimateEntrySize(tail.entry);
        this.#cache.delete(tail.key);
        this.#currentMemoryBytes -= entrySize;
        freedMemory += entrySize;
        evictionCount++;
        this.#stats.memoryEvictions++;
      } else {
        break;
      }
    }

    if (evictionCount > 0) {
      this.#logger.info(
        `CacheService: Evicted ${evictionCount} entries to free ${freedMemory} bytes`
      );
    }
  }

  /**
   * Estimates the memory size of a cache entry
   * @param {CacheEntry} entry - Cache entry to estimate
   * @returns {number} Estimated size in bytes
   * @private
   */
  #estimateEntrySize(entry) {
    try {
      // More accurate estimation based on JSON serialization
      const entryStr = JSON.stringify(entry);
      // Use 1 byte per character for more conservative estimation
      // since most data is ASCII and actual memory overhead is handled elsewhere
      return entryStr.length;
    } catch {
      // Fallback for non-serializable objects
      return 512; // 512 bytes default estimate (reduced from 1KB)
    }
  }

  /**
   * Starts automatic cleanup of expired entries
   * @param {number} intervalMs - Cleanup interval in milliseconds
   * @private
   */
  #startAutoCleanup(intervalMs) {
    this.#cleanupIntervalId = setInterval(() => {
      this.#performAutoCleanup();
    }, intervalMs);

    this.#logger.info(
      `CacheService: Started auto cleanup with ${intervalMs}ms interval`
    );
  }

  /**
   * Performs automatic cleanup of expired entries
   * @private
   */
  #performAutoCleanup() {
    const now = Date.now();
    let cleanedCount = 0;
    let freedMemory = 0;

    // Create a list of expired keys to avoid modifying map while iterating
    const expiredKeys = [];

    for (const [key, node] of this.#cache) {
      if (now - node.entry.timestamp > node.entry.ttl) {
        expiredKeys.push(key);
      }
    }

    // Remove expired entries
    for (const key of expiredKeys) {
      const node = this.#cache.get(key);
      if (node) {
        const entrySize = this.#estimateEntrySize(node.entry);
        this.#removeNode(node);
        this.#cache.delete(key);
        this.#currentMemoryBytes -= entrySize;
        freedMemory += entrySize;
        cleanedCount++;
        this.#stats.expirations++;
      }
    }

    if (cleanedCount > 0) {
      this.#stats.autoCleanups++;
      this.#logger.debug(
        `CacheService: Auto cleanup removed ${cleanedCount} expired entries, freed ${freedMemory} bytes`
      );
    }
  }

  /**
   * Stops automatic cleanup
   * @private
   */
  #stopAutoCleanup() {
    if (this.#cleanupIntervalId) {
      clearInterval(this.#cleanupIntervalId);
      this.#cleanupIntervalId = null;
      this.#logger.info('CacheService: Stopped auto cleanup');
    }
  }

  /**
   * Gets memory usage information
   * @returns {object} Memory usage statistics
   */
  getMemoryInfo() {
    return {
      currentBytes: this.#currentMemoryBytes,
      maxBytes: this.#maxMemoryBytes,
      usagePercent: (
        (this.#currentMemoryBytes / this.#maxMemoryBytes) *
        100
      ).toFixed(2),
      averageEntrySize:
        this.#cache.size > 0
          ? Math.round(this.#currentMemoryBytes / this.#cache.size)
          : 0,
      entryCount: this.#cache.size,
    };
  }

  /**
   * Performs manual cleanup and returns results
   * @returns {object} Cleanup results
   */
  performManualCleanup() {
    const beforeSize = this.#cache.size;
    const beforeMemory = this.#currentMemoryBytes;

    this.#performAutoCleanup();

    return {
      entriesRemoved: beforeSize - this.#cache.size,
      memoryFreed: beforeMemory - this.#currentMemoryBytes,
      currentSize: this.#cache.size,
      currentMemory: this.#currentMemoryBytes,
    };
  }

  /**
   * Cleans up resources when shutting down the service
   */
  cleanup() {
    this.#stopAutoCleanup();
    this.clear();
    this.#logger.info('CacheService: Cleaned up all resources');
  }
}

export default CacheService;
