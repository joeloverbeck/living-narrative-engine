/**
 * @file Unified cache manager for activity description system
 * @description Centralizes cache lifecycle management with TTL support,
 * event-driven invalidation, and LRU pruning
 */

import {
  validateDependency,
  assertNonBlankString,
} from '../../utils/dependencyUtils.js';
import {
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
  COMPONENTS_BATCH_ADDED_ID,
  ENTITY_REMOVED_ID,
} from '../../constants/eventIds.js';

/**
 * Manages multiple named caches with TTL, LRU pruning, and event-driven invalidation
 */
class ActivityCacheManager {
  #logger;
  #eventBus;
  #caches = new Map(); // cacheName -> Map of entries
  #cacheConfigs = new Map(); // cacheName -> {ttl, maxSize}
  #cleanupInterval;
  #eventUnsubscribers = [];

  /**
   * @param {object} params
   * @param {object} params.logger - Logger instance (ILogger interface)
   * @param {object} [params.eventBus] - Optional event bus for automatic invalidation events
   */
  constructor({ logger, eventBus = null }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    // Event bus is optional - if provided, enable automatic cache invalidation
    if (eventBus !== null && eventBus !== undefined) {
      validateDependency(eventBus, 'IEventBus', logger, {
        requiredMethods: ['subscribe', 'dispatch'],
      });
      this.#eventBus = eventBus;
    }

    this.#logger = logger;

    // Only subscribe to events if event bus is available
    if (this.#eventBus) {
      this.#subscribeToInvalidationEvents();
    }

    this.#setupPeriodicCleanup();

    this.#logger.debug('ActivityCacheManager initialized');
  }

  /**
   * Register a new named cache with specific configuration
   *
   * @param {string} cacheName - Unique identifier for the cache
   * @param {object} config - Cache configuration
   * @param {number} config.ttl - Time-to-live in milliseconds (default: 60000)
   * @param {number} config.maxSize - Maximum entries before pruning (default: 1000)
   */
  registerCache(cacheName, { ttl = 60000, maxSize = 1000 } = {}) {
    assertNonBlankString(cacheName, 'cacheName', 'registerCache', this.#logger);

    if (this.#caches.has(cacheName)) {
      this.#logger.warn(`Cache "${cacheName}" already registered, skipping`);
      return;
    }

    this.#caches.set(cacheName, new Map());
    this.#cacheConfigs.set(cacheName, { ttl, maxSize });

    this.#logger.debug(
      `Registered cache "${cacheName}" with TTL=${ttl}ms, maxSize=${maxSize}`
    );
  }

  /**
   * Get value from cache with TTL validation
   *
   * @param {string} cacheName - Name of the cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined if expired/missing
   */
  get(cacheName, key) {
    assertNonBlankString(cacheName, 'cacheName', 'get', this.#logger);
    assertNonBlankString(key, 'key', 'get', this.#logger);

    const cache = this.#caches.get(cacheName);
    if (!cache) {
      this.#logger.warn(`Cache "${cacheName}" not registered`);
      return undefined;
    }

    const entry = cache.get(key);
    if (!entry) {
      return undefined;
    }

    const now = Date.now();
    if (entry.expiresAt < now) {
      cache.delete(key);
      this.#logger.debug(`Cache miss (expired): ${cacheName}:${key}`);
      return undefined;
    }

    this.#logger.debug(`Cache hit: ${cacheName}:${key}`);
    return entry.value;
  }

  /**
   * Set value in cache with expiration timestamp
   *
   * @param {string} cacheName - Name of the cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   */
  set(cacheName, key, value) {
    assertNonBlankString(cacheName, 'cacheName', 'set', this.#logger);
    assertNonBlankString(key, 'key', 'set', this.#logger);

    const cache = this.#caches.get(cacheName);
    const config = this.#cacheConfigs.get(cacheName);

    if (!cache || !config) {
      this.#logger.warn(`Cache "${cacheName}" not registered`);
      return;
    }

    const now = Date.now();
    const expiresAt = now + config.ttl;

    cache.set(key, { value, expiresAt });

    this.#logger.debug(
      `Cache set: ${cacheName}:${key} (expires in ${config.ttl}ms)`
    );

    // Prune if cache exceeds maxSize
    if (cache.size > config.maxSize) {
      this.#pruneCache(cacheName, cache, config.maxSize, now);
    }
  }

  /**
   * Invalidate specific cache entry
   *
   * @param {string} cacheName - Name of the cache
   * @param {string} key - Cache key to invalidate
   */
  invalidate(cacheName, key) {
    assertNonBlankString(cacheName, 'cacheName', 'invalidate', this.#logger);
    assertNonBlankString(key, 'key', 'invalidate', this.#logger);

    const cache = this.#caches.get(cacheName);
    if (!cache) {
      this.#logger.warn(`Cache "${cacheName}" not registered`);
      return;
    }

    const deleted = cache.delete(key);
    if (deleted) {
      this.#logger.debug(`Invalidated: ${cacheName}:${key}`);
    }
  }

  /**
   * Invalidate all cache entries for a specific entity
   *
   * @param {string} entityId - Entity ID to invalidate across all caches
   */
  invalidateAll(entityId) {
    assertNonBlankString(entityId, 'entityId', 'invalidateAll', this.#logger);

    let invalidatedCount = 0;

    for (const [cacheName, cache] of this.#caches.entries()) {
      for (const [key, _entry] of cache.entries()) {
        if (key.includes(entityId)) {
          cache.delete(key);
          invalidatedCount++;
        }
      }
    }

    if (invalidatedCount > 0) {
      this.#logger.debug(
        `Invalidated ${invalidatedCount} entries for entity ${entityId}`
      );
    }
  }

  /**
   * Clear all cache entries across all caches
   */
  clearAll() {
    let totalCleared = 0;

    for (const [cacheName, cache] of this.#caches.entries()) {
      const size = cache.size;
      cache.clear();
      totalCleared += size;
      this.#logger.debug(`Cleared ${size} entries from ${cacheName} cache`);
    }

    if (totalCleared > 0) {
      this.#logger.info(`Cleared ${totalCleared} total cache entries`);
    }
  }

  /**
   * Subscribe to entity change events for automatic cache invalidation
   *
   * @private
   */
  #subscribeToInvalidationEvents() {
    // COMPONENT_ADDED - invalidate entity caches
    const unsubscribeComponentAdded = this.#eventBus.subscribe(
      COMPONENT_ADDED_ID,
      (event) => {
        const entityId = event?.payload?.entity?.id || event?.payload?.entityId;
        if (entityId) {
          this.invalidateAll(entityId);
        }
      }
    );
    this.#eventUnsubscribers.push(unsubscribeComponentAdded);

    // COMPONENT_REMOVED - invalidate entity caches
    const unsubscribeComponentRemoved = this.#eventBus.subscribe(
      COMPONENT_REMOVED_ID,
      (event) => {
        const entityId = event?.payload?.entity?.id || event?.payload?.entityId;
        if (entityId) {
          this.invalidateAll(entityId);
        }
      }
    );
    this.#eventUnsubscribers.push(unsubscribeComponentRemoved);

    // COMPONENTS_BATCH_ADDED - invalidate entity caches from updates array
    const unsubscribeBatchAdded = this.#eventBus.subscribe(
      COMPONENTS_BATCH_ADDED_ID,
      (event) => {
        const updates = event?.payload?.updates;
        if (Array.isArray(updates)) {
          // Extract entity IDs from batch updates (checking multiple possible fields)
          const entityIds = new Set();
          for (const update of updates) {
            const entityId =
              update?.entity?.id || update?.entityId || update?.instanceId;
            if (entityId) {
              entityIds.add(entityId);
            }
          }
          // Invalidate all affected entities
          for (const entityId of entityIds) {
            this.invalidateAll(entityId);
          }
        }
      }
    );
    this.#eventUnsubscribers.push(unsubscribeBatchAdded);

    // ENTITY_REMOVED - invalidate entity caches
    const unsubscribeEntityRemoved = this.#eventBus.subscribe(
      ENTITY_REMOVED_ID,
      (event) => {
        const entityId = event?.payload?.entity?.id || event?.payload?.entityId;
        if (entityId) {
          this.invalidateAll(entityId);
        }
      }
    );
    this.#eventUnsubscribers.push(unsubscribeEntityRemoved);

    this.#logger.debug('Subscribed to 4 invalidation events');
  }

  /**
   * Setup periodic cleanup of expired cache entries
   *
   * @private
   */
  #setupPeriodicCleanup() {
    this.#cleanupInterval = setInterval(() => {
      this.#cleanupAllCaches();
    }, 30000); // 30 seconds

    this.#logger.debug('Periodic cache cleanup scheduled (30s interval)');
  }

  /**
   * Remove expired entries from all caches
   *
   * @private
   */
  #cleanupAllCaches() {
    const now = Date.now();
    let totalCleaned = 0;

    for (const [cacheName, cache] of this.#caches.entries()) {
      let cleaned = 0;

      for (const [key, entry] of cache.entries()) {
        if (entry.expiresAt < now) {
          cache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        totalCleaned += cleaned;
        this.#logger.debug(
          `Cleaned ${cleaned} expired entries from ${cacheName} cache`
        );
      }
    }

    if (totalCleaned > 0) {
      this.#logger.info(
        `Cache cleanup: removed ${totalCleaned} expired entries`
      );
    }
  }

  /**
   * Prune cache using LRU strategy when maxSize is exceeded
   *
   * @private
   * @param {string} cacheName - Name of cache being pruned
   * @param {Map} cache - Cache map to prune
   * @param {number} maxSize - Maximum allowed size
   * @param {number} now - Current timestamp
   */
  #pruneCache(cacheName, cache, maxSize, now) {
    const entriesToRemove = Math.ceil(cache.size * 0.2); // Remove oldest 20%

    // Sort entries by expiresAt (oldest first)
    const sortedEntries = Array.from(cache.entries()).sort(
      (a, b) => a[1].expiresAt - b[1].expiresAt
    );

    // Remove oldest entries
    for (let i = 0; i < entriesToRemove && i < sortedEntries.length; i++) {
      cache.delete(sortedEntries[i][0]);
    }

    this.#logger.debug(
      `Pruned ${entriesToRemove} entries from ${cacheName} cache (size: ${cache.size}/${maxSize})`
    );
  }

  /**
   * Clean up resources (intervals, event subscriptions, caches)
   * Call this before destroying the service
   */
  /**
   * TEST ONLY: Get internal cache Map for a specific cache name
   * This method is for testing purposes only and should not be used in production code
   *
   * @param {string} cacheName - Name of the cache to retrieve
   * @returns {Map} Internal cache Map with {value, expiresAt} entries
   * @private
   */
  _getInternalCacheForTesting(cacheName) {
    return this.#caches.get(cacheName) || new Map();
  }

  destroy() {
    // Clear cleanup interval
    if (this.#cleanupInterval) {
      clearInterval(this.#cleanupInterval);
      this.#cleanupInterval = null;
    }

    // Unsubscribe from all events (with error handling)
    for (const unsubscribe of this.#eventUnsubscribers) {
      if (typeof unsubscribe === 'function') {
        try {
          unsubscribe();
        } catch (error) {
          this.#logger.warn('Failed to unsubscribe from event', error);
        }
      }
    }
    this.#eventUnsubscribers = [];

    // Clear all caches
    this.#caches.clear();
    this.#cacheConfigs.clear();

    this.#logger.debug('ActivityCacheManager destroyed');
  }
}

export default ActivityCacheManager;
