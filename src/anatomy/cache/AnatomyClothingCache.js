/**
 * @file Optimized cache service for anatomy-clothing integration using LRU cache
 * Provides bounded memory usage, TTL support, and intelligent invalidation
 * @see src/anatomy/integration/SlotResolver.js
 * @see src/clothing/services/clothingManagementService.js
 */

import { LRUCache } from 'lru-cache';
import { BaseService } from '../../utils/serviceBase.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Cache key types for different anatomy-clothing operations
 */
export const CacheKeyTypes = {
  AVAILABLE_SLOTS: 'available_slots',
  SLOT_RESOLUTION: 'slot_resolution',
  BLUEPRINT: 'blueprint',
  SOCKET_LOOKUP: 'socket_lookup',
  ENTITY_STRUCTURE: 'entity_structure',
  VALIDATION: 'validation',
};

/**
 * Optimized cache service for anatomy-clothing integration
 * Addresses memory leaks and performance issues in the original implementation
 */
export class AnatomyClothingCache extends BaseService {
  #logger;
  #caches;
  #config;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {object} [config] - Cache configuration
   * @param {number} [config.maxSize] - Maximum items per cache type
   * @param {number} [config.ttl] - Time to live in milliseconds (5 minutes default)
   * @param {number} [config.updateAgeOnGet] - Reset TTL on access
   * @param {number} [config.maxMemoryUsage] - Max memory usage in bytes (100MB default)
   */
  constructor({ logger }, config = {}) {
    super();

    this.#logger = this._init('AnatomyClothingCache', logger);

    this.#config = {
      maxSize: config.maxSize || 500,
      ttl: config.ttl || 300000, // 5 minutes
      updateAgeOnGet: config.updateAgeOnGet !== false,
      maxMemoryUsage: config.maxMemoryUsage || 104857600, // 100MB
    };

    // Initialize separate caches for different data types
    this.#caches = new Map();
    this.#initializeCaches();

    this.#logger.info(
      `AnatomyClothingCache initialized with maxSize=${this.#config.maxSize}, ttl=${this.#config.ttl}ms, maxMemory=${this.#config.maxMemoryUsage / 1048576}MB`
    );
  }

  /**
   * Initialize LRU caches for different data types
   *
   * @private
   */
  #initializeCaches() {
    // Create separate caches for each type to allow different configurations
    for (const cacheType of Object.values(CacheKeyTypes)) {
      const cacheConfig = this.#getCacheConfig(cacheType);

      this.#caches.set(
        cacheType,
        new LRUCache({
          max: cacheConfig.maxSize,
          ttl: cacheConfig.ttl,
          updateAgeOnGet: cacheConfig.updateAgeOnGet,
          sizeCalculation: (value) => this.#calculateSize(value),
          maxSize: Math.floor(
            this.#config.maxMemoryUsage / Object.keys(CacheKeyTypes).length
          ),
          dispose: (value, key) => {
            this.#logger.debug(`Cache entry disposed: ${cacheType}:${key}`);
          },
        })
      );
    }
  }

  /**
   * Get cache configuration for specific cache type
   *
   * @param {string} cacheType
   * @returns {object} Cache configuration
   * @private
   */
  #getCacheConfig(cacheType) {
    // Different cache types can have different configurations
    switch (cacheType) {
      case CacheKeyTypes.BLUEPRINT:
        // Blueprints are accessed frequently and change rarely
        return {
          maxSize: this.#config.maxSize * 2,
          ttl: this.#config.ttl * 2,
          updateAgeOnGet: true,
        };
      case CacheKeyTypes.SLOT_RESOLUTION:
        // Slot resolutions are computed and should be cached aggressively
        return {
          maxSize: this.#config.maxSize,
          ttl: this.#config.ttl,
          updateAgeOnGet: true,
        };
      case CacheKeyTypes.AVAILABLE_SLOTS:
        // Available slots change when equipment changes
        return {
          maxSize: this.#config.maxSize,
          ttl: this.#config.ttl / 2,
          updateAgeOnGet: true,
        };
      default:
        return {
          maxSize: this.#config.maxSize,
          ttl: this.#config.ttl,
          updateAgeOnGet: this.#config.updateAgeOnGet,
        };
    }
  }

  /**
   * Calculate approximate size of cached value in bytes
   *
   * @param {*} value
   * @returns {number} Size in bytes
   * @private
   */
  #calculateSize(value) {
    // Simple size calculation - can be made more sophisticated if needed
    if (typeof value === 'string') {
      return value.length * 2; // 2 bytes per character
    }
    if (Array.isArray(value)) {
      return value.reduce((size, item) => size + this.#calculateSize(item), 24); // Array overhead
    }
    if (value && typeof value === 'object') {
      return JSON.stringify(value).length * 2;
    }
    return 8; // Default size for primitives
  }

  /**
   * Get a value from cache
   *
   * @param {string} cacheType - Type of cache (from CacheKeyTypes)
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(cacheType, key) {
    const cache = this.#caches.get(cacheType);
    if (!cache) {
      this.#logger.warn(`Unknown cache type: ${cacheType}`);
      return undefined;
    }

    const value = cache.get(key);
    if (value !== undefined) {
      this.#logger.debug(`Cache hit: ${cacheType}:${key}`);
    }
    return value;
  }

  /**
   * Set a value in cache
   *
   * @param {string} cacheType - Type of cache (from CacheKeyTypes)
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {object} [options] - Additional options
   * @param {number} [options.ttl] - Override TTL for this entry
   */
  set(cacheType, key, value, options = {}) {
    const cache = this.#caches.get(cacheType);
    if (!cache) {
      this.#logger.warn(`Unknown cache type: ${cacheType}`);
      return;
    }

    const setOptions = {};
    if (options.ttl !== undefined) {
      setOptions.ttl = options.ttl;
    }

    cache.set(key, value, setOptions);
    this.#logger.debug(`Cache set: ${cacheType}:${key}`);
  }

  /**
   * Check if a key exists in cache
   *
   * @param {string} cacheType - Type of cache (from CacheKeyTypes)
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(cacheType, key) {
    const cache = this.#caches.get(cacheType);
    return cache ? cache.has(key) : false;
  }

  /**
   * Delete a specific entry from cache
   *
   * @param {string} cacheType - Type of cache (from CacheKeyTypes)
   * @param {string} key - Cache key
   * @returns {boolean} True if entry was deleted
   */
  delete(cacheType, key) {
    const cache = this.#caches.get(cacheType);
    if (!cache) {
      return false;
    }

    const deleted = cache.delete(key);
    if (deleted) {
      this.#logger.debug(`Cache entry deleted: ${cacheType}:${key}`);
    }
    return deleted;
  }

  /**
   * Clear all entries of a specific cache type
   *
   * @param {string} cacheType - Type of cache to clear
   */
  clearType(cacheType) {
    const cache = this.#caches.get(cacheType);
    if (!cache) {
      this.#logger.warn(`Unknown cache type: ${cacheType}`);
      return;
    }

    const size = cache.size;
    cache.clear();
    this.#logger.info(`Cleared ${size} entries from ${cacheType} cache`);
  }

  /**
   * Clear all caches
   */
  clearAll() {
    let totalCleared = 0;
    for (const [cacheType, cache] of this.#caches) {
      totalCleared += cache.size;
      cache.clear();
    }
    this.#logger.info(`Cleared all caches (${totalCleared} total entries)`);
  }

  /**
   * Invalidate all cache entries for a specific entity
   *
   * @param {string} entityId - Entity ID to invalidate
   */
  invalidateEntity(entityId) {
    let invalidated = 0;

    for (const [cacheType, cache] of this.#caches) {
      // Find all keys that contain the entity ID
      for (const [key] of cache.entries()) {
        if (key.includes(entityId)) {
          cache.delete(key);
          invalidated++;
        }
      }
    }

    this.#logger.info(
      `Invalidated ${invalidated} cache entries for entity ${entityId}`
    );
  }

  /**
   * Invalidate cache entries by pattern
   *
   * @param {string} pattern - Pattern to match against keys
   * @param {string} [cacheType] - Specific cache type to search, or all if not specified
   */
  invalidatePattern(pattern, cacheType = null) {
    let invalidated = 0;
    const regex = new RegExp(pattern);

    const cachesToSearch = cacheType
      ? [this.#caches.get(cacheType)].filter(Boolean)
      : Array.from(this.#caches.values());

    for (const cache of cachesToSearch) {
      for (const [key] of cache.entries()) {
        if (regex.test(key)) {
          cache.delete(key);
          invalidated++;
        }
      }
    }

    this.#logger.info(
      `Invalidated ${invalidated} cache entries matching pattern: ${pattern}`
    );
  }

  /**
   * Get cache statistics
   *
   * @returns {object} Cache statistics
   */
  getStats() {
    const stats = {
      caches: {},
      totalSize: 0,
      totalItems: 0,
      memoryUsage: 0,
    };

    for (const [cacheType, cache] of this.#caches) {
      const cacheStats = {
        size: cache.size,
        maxSize: cache.max,
        calculatedSize: cache.calculatedSize || 0,
      };

      stats.caches[cacheType] = cacheStats;
      stats.totalSize += cacheStats.size;
      stats.totalItems += cacheStats.size;
      stats.memoryUsage += cacheStats.calculatedSize;
    }

    stats.memoryUsageMB = stats.memoryUsage / 1048576;
    stats.maxMemoryUsageMB = this.#config.maxMemoryUsage / 1048576;

    return stats;
  }

  /**
   * Create a cache key for available slots
   *
   * @param {string} entityId
   * @returns {string}
   */
  static createAvailableSlotsKey(entityId) {
    return `${entityId}`;
  }

  /**
   * Create a cache key for slot resolution
   *
   * @param {string} entityId
   * @param {string} slotId
   * @returns {string}
   */
  static createSlotResolutionKey(entityId, slotId) {
    return `${entityId}:${slotId}`;
  }

  /**
   * Create a cache key for blueprint lookup
   *
   * @param {string} recipeId
   * @returns {string}
   */
  static createBlueprintKey(recipeId) {
    return recipeId;
  }

  /**
   * Create a cache key for socket lookup
   *
   * @param {string} rootEntityId
   * @param {string} socketId
   * @returns {string}
   */
  static createSocketLookupKey(rootEntityId, socketId) {
    return `${rootEntityId}:${socketId}`;
  }

  /**
   * Create a cache key for entity structure
   *
   * @param {string} entityId
   * @returns {string}
   */
  static createEntityStructureKey(entityId) {
    return entityId;
  }
}

export default AnatomyClothingCache;
