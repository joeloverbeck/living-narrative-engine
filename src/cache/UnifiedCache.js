/**
 * @file Unified cache implementation with configurable eviction strategies
 * @description Main cache service that supports LRU, LFU, and FIFO eviction policies
 * @see src/anatomy/cache/AnatomyClothingCache.js
 * @see src/characterBuilder/cache/CoreMotivationsCacheManager.js
 */

import { BaseService } from '../utils/serviceBase.js';
import { validateDependency } from '../utils/dependencyUtils.js';
import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
import { CacheError } from '../errors/cacheError.js';
import LRUStrategy from './strategies/LRUStrategy.js';
import LFUStrategy from './strategies/LFUStrategy.js';
import FIFOStrategy from './strategies/FIFOStrategy.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Cache eviction policy types
 */
export const EvictionPolicy = {
  LRU: 'lru',
  LFU: 'lfu',
  FIFO: 'fifo',
};

/**
 * Unified cache service with configurable eviction strategies
 * Provides a consistent interface for all caching needs across the application
 */
export class UnifiedCache extends BaseService {
  #logger;
  #strategy;
  #config;
  #stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    prunings: 0,
  };

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {object} [config] - Cache configuration
   * @param {number} [config.maxSize] - Maximum number of entries
   * @param {number} [config.ttl] - Default TTL in milliseconds (5 minutes)
   * @param {boolean} [config.updateAgeOnGet] - Reset TTL on access
   * @param {number} [config.maxMemoryUsage] - Maximum memory usage in bytes
   * @param {string} [config.evictionPolicy] - Eviction policy (lru, lfu, fifo)
   * @param {boolean} [config.enableMetrics] - Enable statistics collection
   */
  constructor({ logger }, config = {}) {
    super();

    this.#logger = this._init('UnifiedCache', logger);

    this.#config = {
      maxSize: config.maxSize || 1000,
      ttl: config.ttl || 300000, // 5 minutes
      updateAgeOnGet: config.updateAgeOnGet !== false,
      maxMemoryUsage: config.maxMemoryUsage,
      evictionPolicy: config.evictionPolicy || EvictionPolicy.LRU,
      enableMetrics: config.enableMetrics !== false,
    };

    // Validate eviction policy
    if (!Object.values(EvictionPolicy).includes(this.#config.evictionPolicy)) {
      throw new InvalidArgumentError(
        `Invalid eviction policy: ${this.#config.evictionPolicy}. ` +
          `Supported policies: ${Object.values(EvictionPolicy).join(', ')}`
      );
    }

    this.#strategy = this.#createStrategy(this.#config);

    this.#logger.info(
      `UnifiedCache initialized: ${this.#config.evictionPolicy.toUpperCase()} strategy, ` +
        `maxSize=${this.#config.maxSize}, ttl=${this.#config.ttl}ms` +
        (this.#config.maxMemoryUsage
          ? `, maxMemory=${(this.#config.maxMemoryUsage / 1048576).toFixed(1)}MB`
          : '')
    );
  }

  /**
   * Create the appropriate cache strategy
   *
   * @param {object} config - Configuration object
   * @returns {LRUStrategy|LFUStrategy|FIFOStrategy} Cache strategy instance
   * @private
   */
  #createStrategy(config) {
    const strategyConfig = {
      maxSize: config.maxSize,
      ttl: config.ttl,
      updateAgeOnGet: config.updateAgeOnGet,
      maxMemoryUsage: config.maxMemoryUsage,
    };

    switch (config.evictionPolicy) {
      case EvictionPolicy.LRU:
        return new LRUStrategy(strategyConfig);
      case EvictionPolicy.LFU:
        return new LFUStrategy(strategyConfig);
      case EvictionPolicy.FIFO:
        return new FIFOStrategy(strategyConfig);
      default:
        throw new InvalidArgumentError(
          `Unsupported eviction policy: ${config.evictionPolicy}`
        );
    }
  }

  /**
   * Get a value from the cache, optionally with a generator function
   *
   * @param {string} key - Cache key
   * @param {Function} [generator] - Function to generate value if not found
   * @returns {Promise<*>|*} Cached value, generated value, or undefined
   */
  get(key, generator) {
    if (!key || typeof key !== 'string') {
      throw new InvalidArgumentError('Cache key must be a non-empty string');
    }

    const value = this.#strategy.get(key);

    if (value !== undefined) {
      if (this.#config.enableMetrics) {
        this.#stats.hits++;
      }
      this.#logger.debug(`Cache hit: ${key}`);
      return value;
    }

    if (this.#config.enableMetrics) {
      this.#stats.misses++;
    }

    this.#logger.debug(`Cache miss: ${key}`);

    // If no generator provided, return undefined
    if (!generator || typeof generator !== 'function') {
      return undefined;
    }

    // Generate and cache the value
    try {
      const generatedValue = generator(key);

      // Handle async generators
      if (generatedValue && typeof generatedValue.then === 'function') {
        return generatedValue.then((value) => {
          if (value !== undefined) {
            this.set(key, value);
          }
          return value;
        });
      }

      // Synchronous generator
      if (generatedValue !== undefined) {
        this.set(key, generatedValue);
      }
      return generatedValue;
    } catch (error) {
      this.#logger.error(`Generator function failed for key: ${key}`, error);
      throw new CacheError(`Failed to generate value for key: ${key}`, {
        cause: error,
      });
    }
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
    if (!key || typeof key !== 'string') {
      throw new InvalidArgumentError('Cache key must be a non-empty string');
    }

    if (value === undefined) {
      this.#logger.warn(`Attempting to cache undefined value for key: ${key}`);
      return;
    }

    try {
      this.#strategy.set(key, value, options);

      if (this.#config.enableMetrics) {
        this.#stats.sets++;
      }

      this.#logger.debug(
        `Cache set: ${key}` + (options.ttl ? ` (TTL: ${options.ttl}ms)` : '')
      );
    } catch (error) {
      this.#logger.error(`Failed to set cache value for key: ${key}`, error);
      throw new CacheError(`Failed to cache value for key: ${key}`, {
        cause: error,
      });
    }
  }

  /**
   * Check if a key exists in the cache
   *
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists
   */
  has(key) {
    if (!key || typeof key !== 'string') {
      return false;
    }
    return this.#strategy.has(key);
  }

  /**
   * Delete a specific entry from the cache
   *
   * @param {string} key - Cache key
   * @returns {boolean} True if entry was deleted
   */
  delete(key) {
    if (!key || typeof key !== 'string') {
      return false;
    }

    const deleted = this.#strategy.delete(key);
    if (deleted) {
      if (this.#config.enableMetrics) {
        this.#stats.deletes++;
      }
      this.#logger.debug(`Cache delete: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear all entries from the cache
   */
  clear() {
    const sizeBefore = this.#strategy.size;
    this.#strategy.clear();
    this.#logger.info(`Cache cleared: ${sizeBefore} entries removed`);
  }

  /**
   * Invalidate cache entries by pattern
   *
   * @param {string|RegExp} pattern - Pattern to match against keys
   * @returns {number} Number of entries invalidated
   */
  invalidate(pattern) {
    if (!pattern) {
      throw new InvalidArgumentError('Pattern is required for invalidation');
    }

    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    let invalidated = 0;

    // Collect keys to delete (avoid modifying during iteration)
    const keysToDelete = [];
    for (const key of this.#strategy.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    // Delete collected keys
    for (const key of keysToDelete) {
      if (this.#strategy.delete(key)) {
        invalidated++;
      }
    }

    if (invalidated > 0) {
      this.#logger.info(
        `Cache invalidated ${invalidated} entries matching pattern: ${pattern}`
      );
    }

    return invalidated;
  }

  /**
   * Prune expired or excess entries
   *
   * @param {boolean} [aggressive] - Whether to prune aggressively
   * @returns {number} Number of entries pruned
   */
  prune(aggressive = false) {
    const pruned = this.#strategy.prune(aggressive);

    if (pruned > 0) {
      if (this.#config.enableMetrics) {
        this.#stats.prunings++;
      }
      this.#logger.info(
        `Cache pruned ${pruned} entries (aggressive: ${aggressive})`
      );
    }

    return pruned;
  }

  /**
   * Get cache statistics and metrics
   *
   * @returns {object} Cache statistics
   */
  getMetrics() {
    const metrics = {
      // Basic metrics
      size: this.#strategy.size,
      maxSize: this.#strategy.maxSize,
      memorySize: this.#strategy.memorySize,
      strategyName: this.#strategy.strategyName,

      // Configuration
      config: { ...this.#config },

      // Statistics (if enabled)
      stats: this.#config.enableMetrics ? { ...this.#stats } : null,

      // Calculated metrics
      hitRate:
        this.#config.enableMetrics && this.#stats.hits + this.#stats.misses > 0
          ? this.#stats.hits / (this.#stats.hits + this.#stats.misses)
          : 0,

      // Memory usage
      memoryUsageMB: this.#strategy.memorySize / 1048576,
      maxMemoryUsageMB: this.#config.maxMemoryUsage
        ? this.#config.maxMemoryUsage / 1048576
        : null,
    };

    // Add strategy-specific stats if available
    if (this.#strategy.getFrequencyStats) {
      metrics.frequencyStats = this.#strategy.getFrequencyStats();
    }
    if (this.#strategy.getInsertionStats) {
      metrics.insertionStats = this.#strategy.getInsertionStats();
    }

    return metrics;
  }

  /**
   * Get current memory usage estimation
   *
   * @returns {object} Memory usage information
   */
  getMemoryUsage() {
    return {
      currentBytes: this.#strategy.memorySize,
      currentMB: this.#strategy.memorySize / 1048576,
      maxBytes: this.#config.maxMemoryUsage,
      maxMB: this.#config.maxMemoryUsage
        ? this.#config.maxMemoryUsage / 1048576
        : null,
      utilizationPercent: this.#config.maxMemoryUsage
        ? (this.#strategy.memorySize / this.#config.maxMemoryUsage) * 100
        : null,
    };
  }

  /**
   * Get cache entries (for debugging)
   * Warning: This can be memory intensive for large caches
   *
   * @param {number} [limit] - Maximum number of entries to return
   * @returns {Array<[string, *]>} Array of key-value pairs
   */
  getEntries(limit = 100) {
    const entries = [];
    let count = 0;

    for (const [key, value] of this.#strategy.entries()) {
      if (count >= limit) break;
      entries.push([key, value]);
      count++;
    }

    return entries;
  }

  /**
   * Get cache keys (for debugging)
   *
   * @param {number} [limit] - Maximum number of keys to return
   * @returns {string[]} Array of keys
   */
  getKeys(limit = 100) {
    const keys = [];
    let count = 0;

    for (const key of this.#strategy.keys()) {
      if (count >= limit) break;
      keys.push(key);
      count++;
    }

    return keys;
  }

  /**
   * Reset statistics (if metrics are enabled)
   */
  resetStats() {
    if (this.#config.enableMetrics) {
      this.#stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        evictions: 0,
        prunings: 0,
      };
      this.#logger.info('Cache statistics reset');
    }
  }
}

export default UnifiedCache;
