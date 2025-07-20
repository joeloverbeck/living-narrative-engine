/**
 * @file Pluggable caching strategy for scope resolution
 * @see specs/unified-scope-resolver-consolidation-spec.md
 */

/** @typedef {import('../core/actionResult.js').ActionResult} ActionResult */

import { validateDependency } from '../../utils/validationUtils.js';

/**
 * @typedef {Object} CacheEntry
 * @property {*} value - The cached value
 * @property {number} timestamp - When the entry was cached
 * @property {number} [ttl] - Optional custom TTL for this entry
 */

/**
 * Caching strategy for scope resolution with TTL-based expiration.
 * Provides a pluggable caching interface for the UnifiedScopeResolver.
 *
 * @class ScopeCacheStrategy
 */
export class ScopeCacheStrategy {
  #cache;
  #maxSize;
  #defaultTTL;
  #logger;

  /**
   * Creates an instance of ScopeCacheStrategy.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {Map} [deps.cache] - Optional cache implementation (defaults to Map).
   * @param {number} [deps.maxSize=1000] - Maximum number of cache entries.
   * @param {number} [deps.defaultTTL=5000] - Default TTL in milliseconds.
   * @param {import('../../logging/consoleLogger.js').default} [deps.logger] - Optional logger.
   */
  constructor({ cache, maxSize = 1000, defaultTTL = 5000, logger } = {}) {
    this.#cache = cache || new Map();
    this.#maxSize = maxSize;
    this.#defaultTTL = defaultTTL;
    this.#logger = logger?.child({ service: 'ScopeCacheStrategy' });
  }

  /**
   * Generates a cache key based on scope name and resolution context.
   *
   * @param {string} scopeName - The scope name
   * @param {object} context - The resolution context
   * @param {object} context.actor - The actor entity
   * @param {string} context.actor.id - The actor ID
   * @param {string} context.actorLocation - The actor's current location
   * @returns {string} The generated cache key
   */
  generateKey(scopeName, context) {
    // Create a stable cache key that includes relevant context
    // Actor ID and location are the primary factors that affect scope resolution
    return `${scopeName}:${context.actor.id}:${context.actorLocation}`;
  }

  /**
   * Gets a value from cache or computes it using the factory function.
   *
   * @param {string} key - The cache key
   * @param {Function} factory - Async function to compute the value if not cached
   * @param {number} [ttl] - Optional TTL override for this entry
   * @returns {Promise<ActionResult>} The cached or computed result
   */
  async get(key, factory, ttl) {
    const effectiveTTL = ttl !== undefined ? ttl : this.#defaultTTL;

    // Check if we have a valid cached entry
    if (this.#cache.has(key)) {
      const entry = this.#cache.get(key);
      if (this.#isValid(entry)) {
        this.#logger?.debug('Cache hit', { key, age: Date.now() - entry.timestamp });
        return entry.value;
      } else {
        // Entry expired, remove it
        this.#cache.delete(key);
        this.#logger?.debug('Cache entry expired', { key });
      }
    }

    // No valid cached entry, compute the value
    this.#logger?.debug('Cache miss', { key });
    
    try {
      const result = await factory();
      
      // Only cache successful results
      if (result.success) {
        this.#set(key, result, effectiveTTL);
      }
      
      return result;
    } catch (error) {
      this.#logger?.error('Factory function failed', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Sets a value in the cache with TTL.
   *
   * @param {string} key - The cache key
   * @param {*} value - The value to cache
   * @param {number} [ttl] - TTL in milliseconds
   * @private
   */
  #set(key, value, ttl) {
    // Enforce cache size limit using LRU eviction
    if (this.#cache.size >= this.#maxSize && !this.#cache.has(key)) {
      // Remove the oldest entry (first in the Map)
      const firstKey = this.#cache.keys().next().value;
      this.#cache.delete(firstKey);
      this.#logger?.debug('Evicted cache entry due to size limit', { key: firstKey });
    }

    const entry = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.#defaultTTL,
    };

    this.#cache.set(key, entry);
    this.#logger?.debug('Cached value', { key, ttl: entry.ttl });
  }

  /**
   * Checks if a cache entry is still valid based on its TTL.
   *
   * @param {CacheEntry} entry - The cache entry to check
   * @returns {boolean} True if the entry is still valid
   * @private
   */
  #isValid(entry) {
    if (!entry || !entry.timestamp) {
      return false;
    }

    const age = Date.now() - entry.timestamp;
    const ttl = entry.ttl || this.#defaultTTL;
    
    return age < ttl;
  }

  /**
   * Clears all entries from the cache.
   */
  clear() {
    const size = this.#cache.size;
    this.#cache.clear();
    this.#logger?.info('Cleared cache', { entriesRemoved: size });
  }

  /**
   * Invalidates a specific cache entry.
   *
   * @param {string} key - The cache key to invalidate
   * @returns {boolean} True if an entry was removed
   */
  invalidate(key) {
    const removed = this.#cache.delete(key);
    if (removed) {
      this.#logger?.debug('Invalidated cache entry', { key });
    }
    return removed;
  }

  /**
   * Invalidates all cache entries matching a pattern.
   *
   * @param {Function} predicate - Function that returns true for keys to invalidate
   * @returns {number} Number of entries invalidated
   */
  invalidateMatching(predicate) {
    const keysToDelete = [];
    
    for (const key of this.#cache.keys()) {
      if (predicate(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.#cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      this.#logger?.info('Invalidated matching cache entries', { 
        count: keysToDelete.length 
      });
    }

    return keysToDelete.length;
  }

  /**
   * Gets the current cache size.
   *
   * @returns {number} Number of entries in the cache
   */
  get size() {
    return this.#cache.size;
  }

  /**
   * Gets cache statistics.
   *
   * @returns {object} Cache statistics
   */
  getStats() {
    let validCount = 0;
    let expiredCount = 0;
    let totalAge = 0;

    for (const entry of this.#cache.values()) {
      if (this.#isValid(entry)) {
        validCount++;
        totalAge += Date.now() - entry.timestamp;
      } else {
        expiredCount++;
      }
    }

    return {
      size: this.#cache.size,
      maxSize: this.#maxSize,
      validEntries: validCount,
      expiredEntries: expiredCount,
      averageAge: validCount > 0 ? Math.round(totalAge / validCount) : 0,
      memoryUsage: this.#estimateMemoryUsage(),
    };
  }

  /**
   * Estimates memory usage of the cache.
   *
   * @returns {number} Estimated memory usage in bytes
   * @private
   */
  #estimateMemoryUsage() {
    // Rough estimation: assume 100 bytes per key and 1KB average per cached Set
    const bytesPerEntry = 100 + 1024;
    return this.#cache.size * bytesPerEntry;
  }

  /**
   * Performs cache maintenance by removing expired entries.
   *
   * @returns {number} Number of expired entries removed
   */
  cleanup() {
    const keysToDelete = [];

    for (const [key, entry] of this.#cache.entries()) {
      if (!this.#isValid(entry)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.#cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      this.#logger?.info('Cleaned up expired cache entries', { 
        count: keysToDelete.length 
      });
    }

    return keysToDelete.length;
  }
}

export default ScopeCacheStrategy;