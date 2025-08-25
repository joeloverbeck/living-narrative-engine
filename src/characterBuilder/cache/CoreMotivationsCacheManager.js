/**
 * @file Core Motivations Cache Manager
 * @description Manages caching for core motivations data with TTL and invalidation
 * @see ../services/characterBuilderService.js
 */

import {
  validateDependency,
  assertNonBlankString,
  assertPresent,
} from '../../utils/dependencyUtils.js';
import { CHARACTER_BUILDER_EVENTS } from '../services/characterBuilderService.js';
import { CacheError, CacheKeyError } from '../../errors/cacheError.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */

/**
 * Cache manager for Core Motivations data
 */
export class CoreMotivationsCacheManager {
  #cache = new Map();
  #logger;
  #eventBus;
  #schemaValidator;
  #maxCacheSize = 100; // Maximum number of cache entries
  #defaultTTL = 600000; // 10 minutes default
  #stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
  };

  // Cache TTL configuration (in milliseconds)
  #ttlConfig = {
    concepts: 600000, // 10 minutes
    directions: 600000, // 10 minutes
    cliches: 1800000, // 30 minutes
    motivations: null, // Session duration (no expiry)
  };

  /**
   * @param {object} params
   * @param {ILogger} params.logger
   * @param {ISafeEventDispatcher} params.eventBus
   * @param {ISchemaValidator} [params.schemaValidator]
   */
  constructor({ logger, eventBus, schemaValidator }) {
    validateDependency(logger, 'ILogger');
    validateDependency(eventBus, 'ISafeEventDispatcher');

    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#schemaValidator = schemaValidator;

    this.#dispatchEvent(CHARACTER_BUILDER_EVENTS.CACHE_INITIALIZED, {
      maxSize: this.#maxCacheSize,
      ttlConfig: this.#ttlConfig,
      cacheManagerType: 'CoreMotivationsCacheManager',
    });
  }

  /**
   * Get item from cache
   *
   * @param {string} key - Cache key
   * @returns {*} Cached value or null
   */
  get(key) {
    assertNonBlankString(
      key,
      'key',
      'CoreMotivationsCacheManager.get',
      this.#logger
    );

    const entry = this.#cache.get(key);

    if (!entry) {
      this.#stats.misses++;
      this.#dispatchEvent(CHARACTER_BUILDER_EVENTS.CACHE_MISS, { key });
      return null;
    }

    // Check if expired
    if (entry.ttl && Date.now() > entry.expiresAt) {
      this.#cache.delete(key);
      this.#stats.misses++;
      this.#logger.debug(`Cache expired for key: ${key}`);
      return null;
    }

    // Update last accessed time and stats
    entry.lastAccessed = Date.now();
    entry.hits++;
    this.#stats.hits++;

    this.#dispatchEvent(CHARACTER_BUILDER_EVENTS.CACHE_HIT, {
      key,
      type: entry.type,
      totalHits: entry.hits,
    });

    this.#logger.debug(`Cache hit for key: ${key} (hits: ${entry.hits})`);
    return entry.data;
  }

  /**
   * Set item in cache
   *
   * @param {string} key - Cache key
   * @param {*} data - Data to cache
   * @param {string} [type] - Data type for TTL configuration
   * @param {number} [customTTL] - Custom TTL in milliseconds
   */
  set(key, data, type = null, customTTL = null) {
    assertNonBlankString(
      key,
      'key',
      'CoreMotivationsCacheManager.set',
      this.#logger
    );
    assertPresent(data, 'data', InvalidArgumentError, this.#logger);

    // Validate cached data if schema validator available
    if (this.#schemaValidator && type) {
      try {
        this.#schemaValidator.validateAgainstSchema(
          data,
          `core:${type}-cache-entry`
        );
      } catch (validationError) {
        this.#logger.warn(
          `Cache data validation failed for ${key}:`,
          validationError
        );
        // Continue with caching - validation is advisory for cache
      }
    }

    // Enforce cache size limit
    if (this.#cache.size >= this.#maxCacheSize) {
      this.#evictLRU();
    }

    // Determine TTL
    let ttl = customTTL;
    if (!ttl && type && this.#ttlConfig[type] !== undefined) {
      ttl = this.#ttlConfig[type];
    } else if (!ttl) {
      ttl = this.#defaultTTL;
    }

    const entry = {
      data,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      expiresAt: ttl ? Date.now() + ttl : null,
      ttl,
      type,
      hits: 0,
    };

    this.#cache.set(key, entry);
    this.#stats.sets++;

    this.#logger.debug(
      `Cached data for key: ${key} (type: ${type || 'generic'})`
    );
  }

  /**
   * Delete item from cache
   *
   * @param {string} key - Cache key
   * @returns {boolean} True if deleted
   */
  delete(key) {
    const deleted = this.#cache.delete(key);
    if (deleted) {
      this.#logger.debug(`Deleted cache entry: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear all cache entries of a specific type
   *
   * @param {string} type - Data type to clear
   */
  clearType(type) {
    const keysToDelete = [];

    for (const [key, entry] of this.#cache.entries()) {
      if (entry.type === type) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.#cache.delete(key));

    this.#logger.info(
      `Cleared ${keysToDelete.length} cache entries of type: ${type}`
    );
  }

  /**
   * Clear all cache entries
   */
  clearAll() {
    const size = this.#cache.size;
    this.#cache.clear();
    this.#logger.info(`Cleared all ${size} cache entries`);
  }

  /**
   * Invalidate cache entries by pattern
   *
   * @param {string|RegExp} pattern - Pattern to match keys
   */
  invalidatePattern(pattern) {
    const keysToDelete = [];
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);

    for (const key of this.#cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.#cache.delete(key));

    this.#logger.debug(
      `Invalidated ${keysToDelete.length} cache entries matching pattern`
    );
  }

  /**
   * Helper method to dispatch events safely
   *
   * @param {string} eventType
   * @param {object} payload
   * @private
   */
  #dispatchEvent(eventType, payload) {
    try {
      this.#eventBus.dispatch({
        type: eventType,
        payload,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.#logger.error('Failed to dispatch cache event', error);
    }
  }

  /**
   * Evict least recently used entry
   *
   * @private
   */
  #evictLRU() {
    let lruKey = null;
    let lruTime = Infinity; // Start with max value to find minimum

    for (const [key, entry] of this.#cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.#cache.delete(lruKey);
      this.#stats.evictions++;
      this.#dispatchEvent(CHARACTER_BUILDER_EVENTS.CACHE_EVICTED, {
        key: lruKey,
      });
      this.#logger.debug(`Evicted LRU cache entry: ${lruKey}`);
    }
  }

  /**
   * Get cache statistics
   *
   * @returns {object} Cache statistics
   */
  getStats() {
    const stats = {
      size: this.#cache.size,
      maxSize: this.#maxCacheSize,
      hits: this.#stats.hits,
      misses: this.#stats.misses,
      sets: this.#stats.sets,
      evictions: this.#stats.evictions,
      hitRate:
        this.#stats.hits + this.#stats.misses > 0
          ? this.#stats.hits / (this.#stats.hits + this.#stats.misses)
          : 0,
      entries: [],
      totalHits: 0,
      byType: {},
    };

    for (const [key, entry] of this.#cache.entries()) {
      stats.entries.push({
        key,
        type: entry.type,
        hits: entry.hits,
        age: Date.now() - entry.createdAt,
        expiresIn: entry.expiresAt ? entry.expiresAt - Date.now() : null,
      });

      stats.totalHits += entry.hits;

      if (entry.type) {
        if (!stats.byType[entry.type]) {
          stats.byType[entry.type] = { count: 0, hits: 0 };
        }
        stats.byType[entry.type].count++;
        stats.byType[entry.type].hits += entry.hits;
      }
    }

    return stats;
  }

  /**
   * Clean expired entries
   *
   * @returns {number} Number of entries cleaned
   */
  cleanExpired() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.#cache.entries()) {
      if (entry.ttl && entry.expiresAt < now) {
        this.#cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.#logger.debug(`Cleaned ${cleaned} expired cache entries`);
    }

    return cleaned;
  }
}

export default CoreMotivationsCacheManager;
