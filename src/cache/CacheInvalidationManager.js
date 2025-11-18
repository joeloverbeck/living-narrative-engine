/**
 * @file Cache invalidation manager with event-driven coordination
 * @description Manages cache invalidation across multiple cache instances with event bus integration
 */

import { BaseService } from '../utils/serviceBase.js';
import { validateDependency } from '../utils/dependencyUtils.js';
import { InvalidArgumentError } from '../errors/invalidArgumentError.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */

/**
 * Cache invalidation events
 */
export const CacheInvalidationEvents = {
  CACHE_INVALIDATION_REQUESTED: 'CACHE_INVALIDATION_REQUESTED',
  CACHE_PATTERN_INVALIDATION: 'CACHE_PATTERN_INVALIDATION',
  CACHE_ENTITY_INVALIDATION: 'CACHE_ENTITY_INVALIDATION',
  CACHE_COMPONENT_MODIFIED: 'CACHE_COMPONENT_MODIFIED',
  CACHE_ENTITY_MOVED: 'CACHE_ENTITY_MOVED',
};

/**
 * Cache invalidation manager
 * Coordinates cache invalidation across multiple cache instances and integrates with the event system
 */
export class CacheInvalidationManager extends BaseService {
  #logger;
  #validatedEventDispatcher;
  #registeredCaches = new Map();
  #dependencyMappings = new Map();
  #eventListeners = new Set();
  #config;
  #stats = {
    invalidationsProcessed: 0,
    cachesCleaned: 0,
    eventsHandled: 0,
    dependenciesResolved: 0,
  };

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {IValidatedEventDispatcher} deps.validatedEventDispatcher
   * @param {object} [config] - Invalidation configuration
   * @param {boolean} [config.enableDependencyTracking] - Enable dependency-based invalidation
   * @param {boolean} [config.enableEventIntegration] - Enable event bus integration
   * @param {number} [config.batchInvalidationDelay] - Delay for batching invalidations (ms)
   */
  constructor({ logger, validatedEventDispatcher }, config = {}) {
    super();

    this.#logger = this._init('CacheInvalidationManager', logger);

    validateDependency(validatedEventDispatcher, 'IValidatedEventDispatcher', logger, {
      requiredMethods: ['dispatch']
    });
    this.#validatedEventDispatcher = validatedEventDispatcher;

    this.#config = {
      enableDependencyTracking: config.enableDependencyTracking !== false,
      enableEventIntegration: config.enableEventIntegration !== false,
      batchInvalidationDelay: config.batchInvalidationDelay || 100,
    };

    // Set up event listeners if event integration is enabled
    if (this.#config.enableEventIntegration) {
      this.#setupEventListeners();
    }

    this.#logger.info(
      `CacheInvalidationManager initialized: ` +
      `dependency tracking=${this.#config.enableDependencyTracking}, ` +
      `event integration=${this.#config.enableEventIntegration}`
    );
  }

  /**
   * Set up event listeners for automatic invalidation
   *
   * @private
   */
  #setupEventListeners() {
    // Listen for component modification events
    this.#addEventListener('COMPONENT_MODIFIED', (event) => {
      this.#handleComponentModified(event);
    });

    // Listen for entity movement events
    this.#addEventListener('ENTITY_MOVED', (event) => {
      this.#handleEntityMoved(event);
    });

    // Listen for explicit cache invalidation requests
    this.#addEventListener(CacheInvalidationEvents.CACHE_INVALIDATION_REQUESTED, (event) => {
      this.#handleInvalidationRequest(event);
    });

    // Listen for entity deletion/creation events
    this.#addEventListener('ENTITY_CREATED', (event) => {
      this.#handleEntityChanged(event, 'created');
    });

    this.#addEventListener('ENTITY_DELETED', (event) => {
      this.#handleEntityChanged(event, 'deleted');
    });
  }

  /**
   * Add an event listener
   *
   * @param {string} eventType - Event type to listen for
   * @param {Function} handler - Event handler function
   * @private
   */
  #addEventListener(eventType, handler) {
    // In a real implementation, you would register with the event bus
    // For now, we'll store the listeners for when events are dispatched
    this.#eventListeners.add({ eventType, handler });
    this.#logger.debug(`Registered event listener for: ${eventType}`);
  }

  /**
   * @description Emit an event to any listeners registered through the manager
   * @param {string} eventType - Event type to emit
   * @param {object} [event] - Event payload wrapper
   * @returns {number} Number of handlers invoked
   */
  emitEvent(eventType, event = {}) {
    let handlersInvoked = 0;

    for (const listener of this.#eventListeners) {
      if (listener.eventType === eventType) {
        handlersInvoked += 1;

        try {
          listener.handler(event);
        } catch (error) {
          this.#logger.error(`Error handling event: ${eventType}`, error);
        }
      }
    }

    return handlersInvoked;
  }

  /**
   * Register a cache instance for invalidation management
   *
   * @param {string} cacheId - Unique identifier for the cache
   * @param {object} cache - Cache instance with invalidate() and clear() methods
   * @param {object} [metadata] - Additional metadata about the cache
   * @param {string[]} [metadata.entityTypes] - Entity types this cache handles
   * @param {string[]} [metadata.componentTypes] - Component types this cache handles
   */
  registerCache(cacheId, cache, metadata = {}) {
    if (!cacheId || typeof cacheId !== 'string') {
      throw new InvalidArgumentError('Cache ID must be a non-empty string');
    }

    if (!cache) {
      throw new InvalidArgumentError('Cache instance is required');
    }

    // Validate cache interface
    const requiredMethods = ['invalidate', 'clear'];
    const missingMethods = requiredMethods.filter(method => typeof cache[method] !== 'function');
    
    if (missingMethods.length > 0) {
      throw new InvalidArgumentError(
        `Cache must implement methods: ${missingMethods.join(', ')}`
      );
    }

    this.#registeredCaches.set(cacheId, {
      cache,
      metadata: {
        registeredAt: Date.now(),
        entityTypes: metadata.entityTypes || [],
        componentTypes: metadata.componentTypes || [],
        keyPatterns: metadata.keyPatterns || [],
        ...metadata,
      },
    });

    this.#logger.info(
      `Cache registered for invalidation: ${cacheId} ` +
      `(entities: ${metadata.entityTypes?.length || 0}, ` +
      `components: ${metadata.componentTypes?.length || 0})`
    );
  }

  /**
   * Unregister a cache instance
   *
   * @param {string} cacheId - Cache identifier
   * @returns {boolean} True if cache was unregistered
   */
  unregisterCache(cacheId) {
    const removed = this.#registeredCaches.delete(cacheId);
    if (removed) {
      // Clean up any dependency mappings for this cache
      this.#cleanupDependencyMappings(cacheId);
      this.#logger.info(`Cache unregistered from invalidation: ${cacheId}`);
    }
    return removed;
  }

  /**
   * Clean up dependency mappings for a cache
   *
   * @param {string} cacheId - Cache identifier
   * @private
   */
  #cleanupDependencyMappings(cacheId) {
    for (const [key, caches] of this.#dependencyMappings.entries()) {
      caches.delete(cacheId);
      if (caches.size === 0) {
        this.#dependencyMappings.delete(key);
      }
    }
  }

  /**
   * Add a dependency mapping between an entity/component and caches
   *
   * @param {string} dependencyKey - Key representing the dependency (e.g., entity ID, component type)
   * @param {string} cacheId - Cache that depends on this key
   */
  addDependency(dependencyKey, cacheId) {
    if (!this.#config.enableDependencyTracking) {
      return;
    }

    if (!this.#registeredCaches.has(cacheId)) {
      throw new InvalidArgumentError(`Cache not registered: ${cacheId}`);
    }

    if (!this.#dependencyMappings.has(dependencyKey)) {
      this.#dependencyMappings.set(dependencyKey, new Set());
    }

    this.#dependencyMappings.get(dependencyKey).add(cacheId);
    this.#logger.debug(`Added dependency: ${dependencyKey} -> ${cacheId}`);
  }

  /**
   * Remove a dependency mapping
   *
   * @param {string} dependencyKey - Dependency key
   * @param {string} [cacheId] - Specific cache ID, or all if not specified
   */
  removeDependency(dependencyKey, cacheId = null) {
    if (!this.#config.enableDependencyTracking) {
      return;
    }

    const dependentCaches = this.#dependencyMappings.get(dependencyKey);
    if (!dependentCaches) {
      return;
    }

    if (cacheId) {
      dependentCaches.delete(cacheId);
      if (dependentCaches.size === 0) {
        this.#dependencyMappings.delete(dependencyKey);
      }
    } else {
      this.#dependencyMappings.delete(dependencyKey);
    }

    this.#logger.debug(`Removed dependency: ${dependencyKey}` + (cacheId ? ` -> ${cacheId}` : ' (all)'));
  }

  /**
   * Invalidate cache entries by pattern across registered caches
   *
   * @param {string|RegExp} pattern - Pattern to match against keys
   * @param {string[]} [cacheIds] - Specific caches to invalidate, or all if not specified
   * @returns {object} Invalidation results by cache ID
   */
  invalidatePattern(pattern, cacheIds = null) {
    const results = {};
    const targetCaches = cacheIds || Array.from(this.#registeredCaches.keys());

    for (const cacheId of targetCaches) {
      const cacheInfo = this.#registeredCaches.get(cacheId);
      if (!cacheInfo) {
        this.#logger.warn(`Cache not found for pattern invalidation: ${cacheId}`);
        continue;
      }

      try {
        const invalidated = cacheInfo.cache.invalidate(pattern);
        results[cacheId] = { success: true, invalidated };
        this.#logger.debug(`Pattern invalidation in ${cacheId}: ${invalidated} entries`);
      } catch (error) {
        results[cacheId] = { success: false, error: error.message };
        this.#logger.error(`Pattern invalidation failed in ${cacheId}:`, error);
      }
    }

    this.#stats.invalidationsProcessed++;

    // Dispatch invalidation event
    this.#dispatchInvalidationEvent(CacheInvalidationEvents.CACHE_PATTERN_INVALIDATION, {
      pattern: pattern.toString(),
      cacheIds: targetCaches,
      results,
    });

    return results;
  }

  /**
   * Invalidate all cache entries for a specific entity
   *
   * @param {string} entityId - Entity ID to invalidate
   * @param {string[]} [cacheIds] - Specific caches to invalidate, or all if not specified
   * @returns {object} Invalidation results by cache ID
   */
  invalidateEntity(entityId, cacheIds = null) {
    if (!entityId) {
      throw new InvalidArgumentError('Entity ID is required');
    }

    // Use pattern matching to find entity-related keys
    const entityPattern = new RegExp(`\\b${entityId}\\b`);
    const results = this.invalidatePattern(entityPattern, cacheIds);

    // Also invalidate based on dependency mappings
    if (this.#config.enableDependencyTracking) {
      const dependentCaches = this.#dependencyMappings.get(entityId);
      if (dependentCaches) {
        for (const cacheId of dependentCaches) {
          if (!results[cacheId] && this.#registeredCaches.has(cacheId)) {
            const cacheInfo = this.#registeredCaches.get(cacheId);
            try {
              const invalidated = cacheInfo.cache.invalidate(entityPattern);
              results[cacheId] = { success: true, invalidated };
            } catch (error) {
              results[cacheId] = { success: false, error: error.message };
            }
          }
        }
        this.#stats.dependenciesResolved++;
      }
    }

    this.#logger.info(`Entity invalidation completed for ${entityId}: ${Object.keys(results).length} caches affected`);

    // Dispatch invalidation event
    this.#dispatchInvalidationEvent(CacheInvalidationEvents.CACHE_ENTITY_INVALIDATION, {
      entityId,
      cacheIds: cacheIds || Array.from(this.#registeredCaches.keys()),
      results,
    });

    return results;
  }

  /**
   * Clear all entries from specified caches
   *
   * @param {string[]} [cacheIds] - Specific caches to clear, or all if not specified
   * @returns {object} Clear results by cache ID
   */
  clearCaches(cacheIds = null) {
    const results = {};
    const targetCaches = cacheIds || Array.from(this.#registeredCaches.keys());

    for (const cacheId of targetCaches) {
      const cacheInfo = this.#registeredCaches.get(cacheId);
      if (!cacheInfo) {
        this.#logger.warn(`Cache not found for clearing: ${cacheId}`);
        continue;
      }

      try {
        cacheInfo.cache.clear();
        results[cacheId] = { success: true };
        this.#logger.info(`Cache cleared: ${cacheId}`);
        this.#stats.cachesCleaned++;
      } catch (error) {
        results[cacheId] = { success: false, error: error.message };
        this.#logger.error(`Cache clear failed for ${cacheId}:`, error);
      }
    }

    return results;
  }

  /**
   * Handle component modified event
   *
   * @param {object} event - Component modified event
   * @private
   */
  #handleComponentModified(event) {
    this.#stats.eventsHandled++;
    
    const { entityId, componentId } = event.payload || {};
    if (!entityId || !componentId) {
      return;
    }

    // Find caches that handle this component type
    const affectedCaches = [];
    for (const [cacheId, cacheInfo] of this.#registeredCaches.entries()) {
      if (cacheInfo.metadata.componentTypes.includes(componentId) ||
          cacheInfo.metadata.entityTypes.includes(entityId)) {
        affectedCaches.push(cacheId);
      }
    }

    if (affectedCaches.length > 0) {
      this.invalidateEntity(entityId, affectedCaches);
      this.#logger.debug(
        `Component modification invalidation: ${componentId} on ${entityId} ` +
        `(${affectedCaches.length} caches affected)`
      );
    }
  }

  /**
   * Handle entity moved event
   *
   * @param {object} event - Entity moved event
   * @private
   */
  #handleEntityMoved(event) {
    this.#stats.eventsHandled++;
    
    const { entityId, fromLocation, toLocation } = event.payload || {};
    if (!entityId) {
      return;
    }

    // Invalidate caches that might be affected by position changes
    const locationPattern = new RegExp(`(${fromLocation}|${toLocation}|${entityId})`);
    this.invalidatePattern(locationPattern);

    this.#logger.debug(`Entity movement invalidation: ${entityId} (${fromLocation} -> ${toLocation})`);
  }

  /**
   * Handle explicit invalidation request
   *
   * @param {object} event - Invalidation request event
   * @private
   */
  #handleInvalidationRequest(event) {
    this.#stats.eventsHandled++;
    
    const { pattern, entityId, cacheIds } = event.payload || {};
    
    if (pattern) {
      this.invalidatePattern(pattern, cacheIds);
    } else if (entityId) {
      this.invalidateEntity(entityId, cacheIds);
    }
  }

  /**
   * Handle entity change events (created/deleted)
   *
   * @param {object} event - Entity change event
   * @param {string} changeType - Type of change (created/deleted)
   * @private
   */
  #handleEntityChanged(event, changeType) {
    this.#stats.eventsHandled++;
    
    const { entityId } = event.payload || {};
    if (!entityId) {
      return;
    }

    // For entity changes, invalidate related caches
    this.invalidateEntity(entityId);
    this.#logger.debug(`Entity ${changeType} invalidation: ${entityId}`);
  }

  /**
   * Dispatch a cache invalidation event
   *
   * @param {string} eventType - Type of invalidation event
   * @param {object} payload - Event payload
   * @private
   */
  #dispatchInvalidationEvent(eventType, payload) {
    try {
      this.#validatedEventDispatcher.dispatch({
        type: eventType,
        payload: {
          timestamp: Date.now(),
          ...payload,
        },
      });
    } catch (error) {
      this.#logger.error(`Failed to dispatch invalidation event: ${eventType}`, error);
    }
  }

  /**
   * Get invalidation statistics
   *
   * @returns {object} Invalidation statistics
   */
  getStats() {
    return {
      ...this.#stats,
      registeredCaches: this.#registeredCaches.size,
      dependencyMappings: this.#dependencyMappings.size,
      eventListeners: this.#eventListeners.size,
      config: { ...this.#config },
    };
  }

  /**
   * Get list of registered cache IDs
   *
   * @returns {string[]} Array of cache IDs
   */
  getRegisteredCaches() {
    return Array.from(this.#registeredCaches.keys());
  }

  /**
   * Get dependency mappings (for debugging)
   *
   * @returns {object} Dependency mappings
   */
  getDependencyMappings() {
    const mappings = {};
    for (const [key, caches] of this.#dependencyMappings.entries()) {
      mappings[key] = Array.from(caches);
    }
    return mappings;
  }

  /**
   * Clean up resources and remove event listeners
   */
  destroy() {
    // Remove all event listeners if they exist
    if (this.#config.enableEventIntegration && this.#eventListeners.size > 0) {
      // Note: Event listeners would need to be properly removed if the event system supports it
      this.#eventListeners.clear();
    }

    // Clear all registered caches
    this.#registeredCaches.clear();

    // Clear dependency mappings
    this.#dependencyMappings.clear();

    this.#logger.info('CacheInvalidationManager destroyed');
  }
}

export default CacheInvalidationManager;