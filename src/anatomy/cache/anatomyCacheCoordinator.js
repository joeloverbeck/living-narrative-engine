/**
 * @file Centralized cache management for anatomy system.
 * Coordinates invalidation across multiple anatomy-related caches
 * in response to entity and component lifecycle events.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Centralized cache coordinator for the anatomy system.
 * Provides:
 * - Centralized registry for anatomy-related caches
 * - Event-driven automatic invalidation
 * - Transactional all-or-nothing invalidation
 * - Monitoring and debugging capabilities
 */
export class AnatomyCacheCoordinator {
  #caches = new Map();
  #eventBus;
  #logger;

  constructor({ eventBus, logger }) {
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['subscribe', 'dispatch'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#eventBus = eventBus;
    this.#logger = logger;

    // Subscribe to invalidation events
    this.#eventBus.subscribe(
      'core:entity_removed',
      this.#handleEntityRemoved.bind(this)
    );
    this.#eventBus.subscribe(
      'core:component_added',
      this.#handleComponentChanged.bind(this)
    );
    this.#eventBus.subscribe(
      'core:component_removed',
      this.#handleComponentChanged.bind(this)
    );
    this.#eventBus.subscribe(
      'core:components_batch_added',
      this.#handleComponentsBatchAdded.bind(this)
    );
  }

  /**
   * Registers a cache for coordinated invalidation.
   *
   * @param {string} cacheId - Unique cache identifier
   * @param {Map | object} cache - Cache instance with delete() method or invalidate() method
   */
  registerCache(cacheId, cache) {
    if (this.#caches.has(cacheId)) {
      this.#logger.warn(`Cache ${cacheId} already registered, overwriting`);
    }

    this.#caches.set(cacheId, cache);
    this.#logger.debug(`Registered cache: ${cacheId}`);
  }

  /**
   * Unregisters a cache.
   *
   * @param {string} cacheId - Cache identifier to unregister
   */
  unregisterCache(cacheId) {
    this.#caches.delete(cacheId);
    this.#logger.debug(`Unregistered cache: ${cacheId}`);
  }

  /**
   * Invalidates all caches for an entity (transactional).
   *
   * @param {string} entityId - Entity to invalidate
   */
  invalidateEntity(entityId) {
    this.#logger.debug(`Invalidating all caches for entity ${entityId}`);

    let invalidatedCount = 0;

    for (const [cacheId, cache] of this.#caches) {
      try {
        // Support Map-based caches
        if (cache instanceof Map) {
          cache.delete(entityId);
          invalidatedCount++;
        }
        // Support object-based caches with invalidate method
        else if (typeof cache.invalidate === 'function') {
          cache.invalidate(entityId);
          invalidatedCount++;
        } else {
          this.#logger.warn(
            `Cache ${cacheId} doesn't support invalidation (no delete() or invalidate() method)`
          );
        }
      } catch (err) {
        this.#logger.error(
          `Failed to invalidate cache ${cacheId} for ${entityId}`,
          err
        );
      }
    }

    // Log cache invalidation for monitoring/debugging
    // Previously dispatched anatomy:cache_invalidated event, but this caused
    // infinite recursion loops with no subscribers. Replaced with direct logging.
    this.#logger.debug(
      `Invalidated ${invalidatedCount} anatomy cache(s) for entity ${entityId}`
    );
  }

  /**
   * Invalidates all caches (full reset).
   */
  invalidateAll() {
    this.#logger.info('Invalidating all anatomy caches');

    for (const [cacheId, cache] of this.#caches) {
      try {
        if (cache instanceof Map) {
          cache.clear();
        } else if (typeof cache.clear === 'function') {
          cache.clear();
        }
      } catch (err) {
        this.#logger.error(`Failed to clear cache ${cacheId}`, err);
      }
    }

    this.#eventBus.dispatch('anatomy:caches_cleared', {});
  }

  /**
   * Gets the number of registered caches.
   *
   * @returns {number} Number of registered caches
   */
  getCacheCount() {
    return this.#caches.size;
  }

  // Event handlers
  #handleEntityRemoved({ payload }) {
    // Handle entity removal - payload may have instanceId or entity object
    const entityId = payload?.instanceId || payload?.entity?.id;
    if (entityId) {
      this.invalidateEntity(entityId);
    }
  }

  #handleComponentChanged({ payload }) {
    // Handle component additions/removals - payload has entity object
    const entityId = payload?.entity?.id;
    if (entityId) {
      this.invalidateEntity(entityId);
    }
  }

  #handleComponentsBatchAdded({ payload }) {
    // Handle batch component additions - payload has updates array
    if (payload?.updates) {
      payload.updates.forEach((update) => {
        if (update.instanceId) {
          this.invalidateEntity(update.instanceId);
        }
      });
    }
  }
}
