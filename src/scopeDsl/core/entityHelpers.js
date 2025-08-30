/**
 * Utility helpers for entity evaluation and component retrieval.
 *
 * @module entityHelpers
 */

import { buildComponents } from '../../utils/entityComponentUtils.js';

// Entity lookup cache for performance optimization
const entityCache = new Map();
const CACHE_SIZE_LIMIT = 10000; // Prevent unbounded cache growth
let cacheHits = 0;
let cacheMisses = 0;

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
 * @param {object} [trace] - Optional trace logger with `addLog` method.
 * @returns {object|null} Components object or null if the entity was not found.
 */
export function getOrBuildComponents(entityId, entity, gateway, trace) {
  const instance = entity ?? gateway.getEntityInstance(entityId);
  if (!instance) return null;

  if (!Array.isArray(instance.componentTypeIds)) {
    if (trace) {
      trace.addLog(
        'warn',
        `Entity '${entityId}' does not expose componentTypeIds. Unable to retrieve components.`,
        'EntityHelpers',
        { entityId }
      );
    }
    return {};
  }

  return buildComponents(entityId, instance, gateway);
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
  if (item == null) return null;

  // Critical validation - always check for undefined actor (programming error)
  if (!actorEntity) {
    const error = new Error(
      'createEvaluationContext: actorEntity is undefined. This should never happen during scope evaluation.'
    );
    if (trace) {
      console.error(
        '[CRITICAL] createEvaluationContext called with undefined actor:',
        {
          item,
          itemType: typeof item,
          hasGateway: !!gateway,
          hasLocationProvider: !!locationProvider,
          // Enhanced debugging: show the call stack to trace where this came from
          callStack: new Error().stack,
        }
      );
    }
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
    if (trace) {
      console.error(
        '[CRITICAL] createEvaluationContext actor has invalid ID:',
        {
          actorId: actorEntity.id,
          actorIdType: typeof actorEntity.id,
          actorKeys: Object.keys(actorEntity),
          hasComponents: !!actorEntity.components,
          item,
          itemType: typeof item,
          callStack: new Error().stack,
        }
      );
    }
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
      if (trace) {
        trace.addLog(
          'debug',
          `Item ${item} ${resolvedHow}`,
          'createEvaluationContext'
        );
      }
    }
  } else if (item && typeof item === 'object') {
    entity = item;
  } else {
    return null;
  }

  // Helper function to add components while preserving prototype chain
  /**
   *
   * @param entity
   * @param entityId
   */
  function addComponentsToEntity(entity, entityId) {
    // Fast path: already has components as object
    if (
      entity.components &&
      typeof entity.components === 'object' &&
      !(entity.components instanceof Map)
    ) {
      return entity;
    }

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

    // No components and no componentTypeIds - return as-is
    return entity;
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
    if (trace) {
      trace.addLog(
        'debug',
        `Processing actor components: actor=${actor.id}, has componentTypeIds=${!!actor.componentTypeIds}, componentTypeIds length=${actor.componentTypeIds?.length || 0}`,
        'EntityHelpers'
      );
    }
    
    actor = addComponentsToEntity(actor, actor.id);
  }

  const location = locationProvider.getLocation();

  // Enhanced debug logging for scope resolution issues
  if (trace) {
    trace.addLog(
      'debug',
      `createEvaluationContext: entity=${entity?.id}, has components=${!!entity?.components}, actor=${actor?.id}, has components=${!!actor?.components}`,
      'EntityHelpers',
      {
        entityId: entity?.id,
        entityComponentKeys: entity?.components
          ? Object.keys(entity.components)
          : [],
        actorId: actor?.id,
        actorComponentKeys: actor?.components
          ? Object.keys(actor.components)
          : [],
        actorHasSittingComponent: actor?.components?.['positioning:sitting_on'] ? 'YES' : 'NO',
        actorSittingComponentData: actor?.components?.['positioning:sitting_on'] || 'NOT_FOUND',
        wasActorPreprocessed: !!processedActor,
      }
    );
  }
  

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
   *
   * @param entity
   * @param entityId
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
