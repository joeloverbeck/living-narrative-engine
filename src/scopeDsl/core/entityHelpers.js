/**
 * Utility helpers for entity evaluation and component retrieval.
 *
 * @module entityHelpers
 */

import { buildComponents } from '../../utils/entityComponentUtils.js';
import {
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
  COMPONENTS_BATCH_ADDED_ID,
} from '../../constants/eventIds.js';

// Entity lookup cache for performance optimization
const entityCache = new Map();
const CACHE_SIZE_LIMIT = 10000; // Prevent unbounded cache growth
let cacheHits = 0;
let cacheMisses = 0;

// Event bus instance for automatic cache invalidation
let eventBusInstance = null;

/**
 * Clears the entity cache. Should be called when entity data changes significantly.
 *
 * @returns {void}
 */
export function clearEntityCache() {
  entityCache.clear();
  cacheHits = 0;
  cacheMisses = 0;
}

/**
 * Invalidates a specific entity's cache entry.
 * Called automatically when components are added/removed via event listeners.
 *
 * @param {string} entityId - Entity instance ID to invalidate
 * @returns {void}
 */
export function invalidateEntityCache(entityId) {
  const cacheKey = `entity_${entityId}`;
  if (entityCache.has(cacheKey)) {
    entityCache.delete(cacheKey);
  }
}

/**
 * Sets up automatic cache invalidation via event bus.
 * Should be called once during application bootstrap.
 *
 * @param {object} eventBus - Event bus instance with 'subscribe' method for event subscription
 * @returns {void}
 */
export function setupEntityCacheInvalidation(eventBus) {
  if (eventBusInstance) {
    return; // Already set up
  }

  eventBusInstance = eventBus;

  // Listen for batch component additions (most common during operations like dropItemAtLocation)
  eventBus.subscribe(COMPONENTS_BATCH_ADDED_ID, (event) => {
    if (event?.payload?.updates) {
      event.payload.updates.forEach((update) => {
        if (update.instanceId) {
          invalidateEntityCache(update.instanceId);
        }
      });
    }
  });

  // Listen for individual component additions
  eventBus.subscribe(COMPONENT_ADDED_ID, (event) => {
    if (event?.payload?.entity?.id) {
      invalidateEntityCache(event.payload.entity.id);
    }
  });

  // Listen for component removals
  eventBus.subscribe(COMPONENT_REMOVED_ID, (event) => {
    if (event?.payload?.entity?.id) {
      invalidateEntityCache(event.payload.entity.id);
    }
  });
}

/**
 * @typedef {import('./gateways.js').EntityGateway} EntityGateway
 */

/**
 * @typedef {object} LocationProvider
 * @property {() => {id: string} | null} getLocation
 */

/**
 * Retrieves or builds a components object for the given entity.
 *
 * @description If the entity already contains a `components` object it is
 * returned directly. Otherwise component data is collected using
 * `entity.componentTypeIds` and the provided gateway.
 * @param {string} entityId - Identifier of the entity.
 * @param {object|null} entity - Entity instance or null to look up via gateway.
 * @param {EntityGateway} gateway - Gateway used to fetch entity/component data.
 * @param {object} [_trace] - Optional trace logger with `addLog` method (unused but kept for API compatibility).
 * @returns {object|null} Components object or null if the entity was not found.
 */
export function getOrBuildComponents(entityId, entity, gateway, _trace) {
  const instance = entity ?? gateway.getEntityInstance(entityId);
  if (!instance) return null;

  const hasComponentTypeIds = 'componentTypeIds' in instance;
  const hasComponents = instance.components && typeof instance.components === 'object' && !Array.isArray(instance.components);

  // FAST PATH: If entity has components object (from getEntity()), return it directly
  // This is the preferred path for entities that come from getEntity() which returns { id, components }
  if (hasComponents) {
    return instance.components;
  }

  // VALIDATION: If entity has componentTypeIds, it must be an array
  if (hasComponentTypeIds) {
    const componentTypeIdsValue = instance.componentTypeIds;
    if (!Array.isArray(componentTypeIdsValue)) {
      return {}; // Malformed: componentTypeIds exists but is not an array
    }

    // If entity also has pre-built components, return them (optimization for getters)
    if (hasComponents) {
      return instance.components;
    }

    // Build components from componentTypeIds
    return buildComponents(entityId, instance, gateway);
  }

  // Entity has neither components nor componentTypeIds - malformed
  return {};
}

/**
 * Builds the evaluation context used by Filter resolvers.
 *
 * @param {*} item - Item being evaluated (entity ID or object).
 * @param {object} actorEntity - Acting entity for context.
 * @param {EntityGateway} gateway - Gateway used for lookups.
 * @param {LocationProvider} locationProvider - Provides current location.
 * @param {object} [trace] - Optional trace logger with `addLog` method.
 * @param {object} [runtimeContext] - Optional runtime context with target/targets.
 * @param {object} [processedActor] - Optional pre-processed actor entity to avoid reprocessing.
 * @returns {object|null} Context object with entity, actor and location fields.
 */
export function createEvaluationContext(
  item,
  actorEntity,
  gateway,
  locationProvider,
  trace,
  runtimeContext = null,
  processedActor = null
) {
  // Fast path: null/undefined items
  if (item === null || item === undefined) return null;

  // Normalize inventory reference objects ({ itemId, ... }) into entity-like objects
  if (
    item &&
    typeof item === 'object' &&
    !item.id &&
    typeof item.itemId === 'string'
  ) {
    const trimmedItemId = item.itemId.trim();

    if (trimmedItemId.length > 0) {
      item = {
        ...item,
        id: trimmedItemId,
      };
    }
  }

  // Critical validation - always check for undefined actor (programming error)
  if (!actorEntity) {
    const error = new Error(
      'createEvaluationContext: actorEntity is undefined. This should never happen during scope evaluation.'
    );
    throw error;
  }

  // Critical validation - always check for invalid actor ID (programming error)
  if (
    !actorEntity.id ||
    actorEntity.id === 'undefined' ||
    typeof actorEntity.id !== 'string'
  ) {
    const error = new Error(
      `createEvaluationContext: actorEntity has invalid ID: ${JSON.stringify(actorEntity.id)}. This should never happen.`
    );
    throw error;
  }

  // Create or retrieve entity with components (with caching for performance)
  let entity;
  if (typeof item === 'string') {
    // Check cache first for massive performance boost
    const cacheKey = `entity_${item}`;
    if (entityCache.has(cacheKey)) {
      entity = entityCache.get(cacheKey);
      cacheHits++;

      if (trace && cacheHits % 1000 === 0) {
        trace.addLog(
          'debug',
          `Cache stats: ${cacheHits} hits, ${cacheMisses} misses (${((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1)}% hit rate)`,
          'createEvaluationContext'
        );
      }
    } else {
      cacheMisses++;

      // Try as entity first (primary path)
      entity = gateway.getEntityInstance(item);
      let resolvedHow = null;

      if (entity) {
        resolvedHow = 'resolved as entity';
      } else {
        // Fallback: component lookup or basic entity
        const components = gateway.getItemComponents?.(item);
        if (components) {
          entity = { id: item, components };
          resolvedHow = 'resolved via component lookup';
        } else {
          entity = { id: item };
          resolvedHow = 'created as basic entity';
        }
      }

      // Cache the result (with simple LRU eviction)
      if (entityCache.size >= CACHE_SIZE_LIMIT) {
        // Clear oldest 20% when limit reached
        const entriesToDelete = Math.floor(CACHE_SIZE_LIMIT * 0.2);
        let deleted = 0;
        for (const key of entityCache.keys()) {
          if (deleted >= entriesToDelete) break;
          entityCache.delete(key);
          deleted++;
        }
      }
      entityCache.set(cacheKey, entity);

      // Log how the entity was resolved
    }
  } else if (item && typeof item === 'object') {
    // FIX: Check if object has an ID property and resolve it as an entity
    if (item.id && typeof item.id === 'string') {
      // Object has an ID - resolve it properly through gateway
      const cacheKey = `entity_${item.id}`;
      if (entityCache.has(cacheKey)) {
        entity = entityCache.get(cacheKey);
        cacheHits++;
      } else {
        cacheMisses++;
        entity = gateway.getEntityInstance(item.id);
        let resolvedHow = null;

        if (entity) {
          resolvedHow = 'resolved object with ID via gateway';
        } else {
          // Fallback: use the object itself with component resolution
          const components = gateway.getItemComponents?.(item.id);
          if (components) {
            entity = { id: item.id, components };
            resolvedHow = 'resolved object with ID via component lookup';
          } else {
            entity = item;
            resolvedHow = 'kept object with ID as-is';
          }
        }

        // Cache the result (with simple LRU eviction)
        if (entityCache.size >= CACHE_SIZE_LIMIT) {
          // Clear oldest 20% when limit reached
          const entriesToDelete = Math.floor(CACHE_SIZE_LIMIT * 0.2);
          let deleted = 0;
          for (const key of entityCache.keys()) {
            if (deleted >= entriesToDelete) break;
            entityCache.delete(key);
            deleted++;
          }
        }
        entityCache.set(cacheKey, entity);
      }
    } else {
      // No ID property - keep as-is (backwards compatibility)
      entity = item;
    }
  } else {
    return null;
  }

  // Helper function to add components while preserving prototype chain
  /**
   * Adds components to an entity while preserving its prototype chain.
   *
   * @param {object} entity - The entity to add components to
   * @param {string} entityId - The entity identifier
   * @returns {object} Entity with components added
   */
  function addComponentsToEntity(entity, entityId) {
    // Convert Map-based components to plain object if needed
    if (entity.components instanceof Map) {
      const plainComponents = {};
      for (const [componentId, data] of entity.components) {
        plainComponents[componentId] = data;
      }

      // Fast path for plain objects
      const proto = Object.getPrototypeOf(entity);
      if (proto === Object.prototype || proto === null) {
        return {
          ...entity,
          components: plainComponents,
        };
      }

      // Slower path: preserve prototype
      const enhancedEntity = Object.create(proto);
      for (const key of Object.keys(entity)) {
        if (key !== 'components') {
          enhancedEntity[key] = entity[key];
        }
      }
      enhancedEntity.components = plainComponents;
      return enhancedEntity;
    }

    // If no components but has componentTypeIds or getAllComponents method, build them
    if (
      !entity.components &&
      (entity.componentTypeIds || entity.getAllComponents)
    ) {
      let components;

      // If entity has getAllComponents method (Entity class), use it
      if (typeof entity.getAllComponents === 'function') {
        components = entity.getAllComponents();
      } else {
        // Otherwise build from componentTypeIds
        components = buildComponents(entityId || entity.id, entity, gateway);
      }

      // Check if it's a plain object or has a custom prototype
      const proto = Object.getPrototypeOf(entity);
      if (proto === Object.prototype || proto === null) {
        // Plain object - safe to use spread
        return {
          ...entity,
          components,
        };
      }

      // Entity instance - create a wrapper that preserves the original entity
      // We can't copy Entity instances because they have private fields
      const enhancedEntity = Object.create(proto);

      // Define a getter for each property of the original entity
      const descriptors = Object.getOwnPropertyDescriptors(proto);
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (descriptor.get) {
          // This is a getter - create a forwarding getter
          Object.defineProperty(enhancedEntity, key, {
            get() {
              return entity[key];
            },
            enumerable: descriptor.enumerable,
            configurable: descriptor.configurable,
          });
        }
      }

      // Copy non-getter properties
      for (const key of Object.keys(entity)) {
        if (!Object.getOwnPropertyDescriptor(proto, key)?.get) {
          enhancedEntity[key] = entity[key];
        }
      }

      // Add components
      enhancedEntity.components = components;

      return enhancedEntity;
    }
  }

  // Process entity if it needs components or has Map-based components that need conversion
  if (
    (!entity.components && entity.componentTypeIds) ||
    entity.components instanceof Map
  ) {
    entity = addComponentsToEntity(entity, entity.id || item);
  }

  // Use pre-processed actor if available (critical optimization)
  // Avoids reprocessing actor for each of potentially 10,000+ entities
  let actor = processedActor || actorEntity;

  // If not pre-processed, ensure actor has components built or Map components converted
  if (
    !processedActor &&
    ((!actor.components && actor.componentTypeIds) ||
      actor.components instanceof Map)
  ) {
    actor = addComponentsToEntity(actor, actor.id);
  }

  const location = locationProvider.getLocation();

  // Enhanced debug logging for scope resolution issues

  // Create flattened context for easier JSON Logic access
  // This allows queries like {"var": "components.core:tags.tags"} to work directly
  const flattenedContext = {
    entity,
    actor,
    location,
    // Flatten entity components to root level for easier access
    ...(entity?.components && { components: entity.components }),
    // Also provide direct access to entity properties
    id: entity?.id,
    // Include trace context so operators can capture evaluation data
    trace,
  };

  // For plain objects (like inventory items), expose their properties directly
  // This allows {"var": "quantity"} to access item.quantity
  if (item && typeof item === 'object' && !entity?.components && item.id) {
    // This is a plain object (not an entity with components)
    // Expose all its properties at the root level for JSON Logic access
    Object.assign(flattenedContext, item);
  }

  // Add target context if available
  if (runtimeContext?.target) {
    flattenedContext.target = runtimeContext.target;
  }

  if (runtimeContext?.targets) {
    flattenedContext.targets = runtimeContext.targets;
  }

  return flattenedContext;
}

/**
 * Pre-processes an actor entity for use in multiple evaluation contexts.
 * This is an optimization for bulk filtering operations.
 *
 * @param {object} actorEntity - The actor entity to preprocess
 * @param {EntityGateway} gateway - Gateway used for component lookups
 * @returns {object} Processed actor entity with components
 */
export function preprocessActorForEvaluation(actorEntity, gateway) {
  if (!actorEntity || !actorEntity.id) {
    throw new Error('preprocessActorForEvaluation: Invalid actor entity');
  }

  // Helper function copied from createEvaluationContext for consistency
  /**
   * Adds components to an entity while preserving its prototype chain.
   *
   * @param {object} entity - The entity to add components to
   * @param {string} entityId - The entity identifier
   * @returns {object} Entity with components added
   */
  function addComponentsToEntity(entity, entityId) {
    // Convert Map-based components to plain object if needed
    if (entity.components instanceof Map) {
      const plainComponents = {};
      for (const [componentId, data] of entity.components) {
        plainComponents[componentId] = data;
      }

      // Create new entity with plain object components
      const proto = Object.getPrototypeOf(entity);
      if (proto === Object.prototype || proto === null) {
        return {
          ...entity,
          components: plainComponents,
        };
      } else {
        // Preserve prototype while replacing components
        const enhancedEntity = Object.create(proto);
        for (const key of Object.keys(entity)) {
          if (key !== 'components') {
            enhancedEntity[key] = entity[key];
          }
        }
        enhancedEntity.components = plainComponents;
        return enhancedEntity;
      }
    }

    // If entity already has plain object components, return as-is
    if (entity.components && typeof entity.components === 'object') {
      return entity;
    }

    // If no components but has componentTypeIds or getAllComponents method, build them
    if (
      !entity.components &&
      (entity.componentTypeIds || entity.getAllComponents)
    ) {
      let components;

      // If entity has getAllComponents method (Entity class), use it
      if (typeof entity.getAllComponents === 'function') {
        components = entity.getAllComponents();
      } else {
        // Otherwise build from componentTypeIds
        components = buildComponents(entityId || entity.id, entity, gateway);
      }

      // Check if it's a plain object or has a custom prototype
      const proto = Object.getPrototypeOf(entity);
      if (proto === Object.prototype || proto === null) {
        // Plain object - safe to use spread
        return {
          ...entity,
          components,
        };
      }

      // Entity instance - create a wrapper that preserves the original entity
      const enhancedEntity = Object.create(proto);

      // Define a getter for each property of the original entity
      const descriptors = Object.getOwnPropertyDescriptors(proto);
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (descriptor.get) {
          // This is a getter - create a forwarding getter
          Object.defineProperty(enhancedEntity, key, {
            get() {
              return entity[key];
            },
            enumerable: descriptor.enumerable,
            configurable: descriptor.configurable,
          });
        }
      }

      // Copy non-getter properties
      for (const key of Object.keys(entity)) {
        if (!Object.getOwnPropertyDescriptor(proto, key)?.get) {
          enhancedEntity[key] = entity[key];
        }
      }

      // Add components
      enhancedEntity.components = components;

      return enhancedEntity;
    }

    // No components and no componentTypeIds - return as-is
    return entity;
  }

  return addComponentsToEntity(actorEntity, actorEntity.id);
}
