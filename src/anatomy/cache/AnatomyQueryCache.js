/**
 * @file Cache service for anatomy query results using LRU cache
 * Improves performance by caching frequently accessed query results
 */

import { LRUCache } from 'lru-cache';
import { ANATOMY_CONSTANTS } from '../constants/anatomyConstants.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Cache key generation strategies for different query types
 */
const CacheKeyGenerators = {
  /**
   * Generate cache key for findPartsByType queries
   *
   * @param {string} rootId
   * @param {string} partType
   * @returns {string}
   */
  findPartsByType: (rootId, partType) =>
    `findPartsByType:::${rootId}:::${partType}`,

  /**
   * Generate cache key for getAllParts queries
   *
   * @param {string} rootId
   * @returns {string}
   */
  getAllParts: (rootId) => `getAllParts:::${rootId}`,

  /**
   * Generate cache key for getPath queries
   *
   * @param {string} fromId
   * @param {string} toId
   * @returns {string}
   */
  getPath: (fromId, toId) => `getPath:::${fromId}:::${toId}`,

  /**
   * Generate cache key for hasPartWithComponent queries
   *
   * @param {string} rootId
   * @param {string} componentId
   * @returns {string}
   */
  hasPartWithComponent: (rootId, componentId) =>
    `hasPartWithComponent:::${rootId}:::${componentId}`,

  /**
   * Generate cache key for hasPartWithComponentValue queries
   *
   * @param {string} rootId
   * @param {string} componentId
   * @param {string} propertyPath
   * @param {*} expectedValue
   * @returns {string}
   */
  hasPartWithComponentValue: (
    rootId,
    componentId,
    propertyPath,
    expectedValue
  ) =>
    `hasPartWithComponentValue:::${rootId}:::${componentId}:::${propertyPath}:::${JSON.stringify(expectedValue)}`,
};

/**
 * Service for caching anatomy query results
 */
export class AnatomyQueryCache {
  /** @type {ILogger} */
  #logger;
  /** @type {LRUCache} */
  #cache;
  /** @type {Set<string>} */
  #rootIdKeys;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {object} [options]
   * @param {number} [options.maxSize] - Maximum number of items in cache
   * @param {number} [options.ttl] - Time to live in milliseconds (5 minutes default)
   */
  constructor({ logger }, options = {}) {
    if (!logger) throw new Error('logger is required');

    const { maxSize = 1000, ttl = 300000 } = options;

    this.#logger = logger;
    this.#rootIdKeys = new Set();

    // Configure LRU cache with TTL and size limits
    this.#cache = new LRUCache({
      max: maxSize,
      ttl: ttl,
      updateAgeOnGet: true,
      updateAgeOnHas: false,

      // Track which root IDs have cached entries
      dispose: (value, key) => {
        this.#removeRootIdTracking(key);
      },
    });

    this.#logger.info(
      `AnatomyQueryCache: Initialized with maxSize=${maxSize}, ttl=${ttl}ms`
    );
  }

  /**
   * Get a cached query result
   *
   * @param {string} cacheKey
   * @returns {*|undefined} The cached value or undefined if not found
   */
  get(cacheKey) {
    const value = this.#cache.get(cacheKey);
    if (value !== undefined) {
      this.#logger.debug(`AnatomyQueryCache: Cache hit for key '${cacheKey}'`);
    }
    return value;
  }

  /**
   * Set a query result in the cache
   *
   * @param {string} cacheKey
   * @param {*} value
   * @param {string} rootId - The root entity ID this query relates to
   */
  set(cacheKey, value, rootId) {
    this.#cache.set(cacheKey, value);
    this.#trackRootId(cacheKey, rootId);
    this.#logger.debug(
      `AnatomyQueryCache: Cached result for key '${cacheKey}'`
    );
  }

  /**
   * Check if a cache key exists
   *
   * @param {string} cacheKey
   * @returns {boolean}
   */
  has(cacheKey) {
    return this.#cache.has(cacheKey);
  }

  /**
   * Invalidate all cached entries for a specific root entity
   * Called when anatomy structure changes
   *
   * @param {string} rootId
   */
  invalidateRoot(rootId) {
    let invalidated = 0;

    // Find all keys associated with this root ID
    for (const [key, value] of this.#cache.entries()) {
      // Check for both patterns: :::rootId::: and :::rootId (end of string)
      if (key.includes(`:::${rootId}:::`) || key.endsWith(`:::${rootId}`)) {
        this.#cache.delete(key);
        invalidated++;
      }
    }

    this.#logger.info(
      `AnatomyQueryCache: Invalidated ${invalidated} entries for root '${rootId}'`
    );
  }

  /**
   * Clear the entire cache
   */
  clear() {
    const size = this.#cache.size;
    this.#cache.clear();
    this.#rootIdKeys.clear();
    this.#logger.info(`AnatomyQueryCache: Cleared ${size} entries`);
  }

  /**
   * Get cache statistics
   *
   * @returns {{size: number, maxSize: number, hitRate: number}}
   */
  getStats() {
    const calculatedSize = this.#cache.size;
    const maxSize = this.#cache.max;

    // LRUCache doesn't track hit rate, so we'd need to implement our own
    // For now, return basic stats
    return {
      size: calculatedSize,
      maxSize: maxSize,
      hitRate: 0, // Would need to track hits/misses separately
    };
  }

  /**
   * Cache a findPartsByType query result
   *
   * @param {string} rootId
   * @param {string} partType
   * @param {string[]} result
   */
  cacheFindPartsByType(rootId, partType, result) {
    const key = CacheKeyGenerators.findPartsByType(rootId, partType);
    this.set(key, result, rootId);
  }

  /**
   * Get cached findPartsByType result
   *
   * @param {string} rootId
   * @param {string} partType
   * @returns {string[]|undefined}
   */
  getCachedFindPartsByType(rootId, partType) {
    const key = CacheKeyGenerators.findPartsByType(rootId, partType);
    return this.get(key);
  }

  /**
   * Cache a getAllParts query result
   *
   * @param {string} rootId
   * @param {string[]} result
   */
  cacheGetAllParts(rootId, result) {
    const key = CacheKeyGenerators.getAllParts(rootId);
    this.set(key, result, rootId);
  }

  /**
   * Get cached getAllParts result
   *
   * @param {string} rootId
   * @returns {string[]|undefined}
   */
  getCachedGetAllParts(rootId) {
    const key = CacheKeyGenerators.getAllParts(rootId);
    return this.get(key);
  }

  /**
   * Track which root IDs have cached data
   *
   * @param {string} cacheKey
   * @param {string} rootId
   * @private
   */
  #trackRootId(cacheKey, rootId) {
    if (!this.#rootIdKeys.has(rootId)) {
      this.#rootIdKeys.add(rootId);
    }
  }

  /**
   * Remove root ID tracking when cache entry is disposed
   *
   * @param {string} cacheKey
   * @private
   */
  #removeRootIdTracking(cacheKey) {
    // Extract root ID from cache key if needed
    // This is a simplified implementation
  }
}

// Export the cache key generators for external use if needed
export { CacheKeyGenerators };

export default AnatomyQueryCache;
