/**
 * Utility helpers for entity evaluation and component retrieval.
 *
 * @module entityHelpers
 */

import { buildComponents } from '../../utils/entityComponentUtils.js';

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
 * @returns {object|null} Context object with entity, actor and location fields.
 */
export function createEvaluationContext(
  item,
  actorEntity,
  gateway,
  locationProvider,
  trace
) {
  // Critical check: actor should never be undefined in scope evaluation
  if (!actorEntity) {
    const error = new Error(
      'createEvaluationContext: actorEntity is undefined. This should never happen during scope evaluation.'
    );
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
    // Fail fast - don't continue with undefined actor
    throw error;
  }

  // Additional check: actor must have a valid ID
  if (
    !actorEntity.id ||
    actorEntity.id === 'undefined' ||
    typeof actorEntity.id !== 'string'
  ) {
    const error = new Error(
      `createEvaluationContext: actorEntity has invalid ID: ${JSON.stringify(actorEntity.id)}. This should never happen.`
    );
    console.error('[CRITICAL] createEvaluationContext actor has invalid ID:', {
      actorId: actorEntity.id,
      actorIdType: typeof actorEntity.id,
      actorKeys: Object.keys(actorEntity),
      hasComponents: !!actorEntity.components,
      item,
      itemType: typeof item,
      callStack: new Error().stack,
    });
    throw error;
  }

  // Create entity with components if needed
  let entity;
  if (typeof item === 'string') {
    entity = gateway.getEntityInstance(item);
    if (!entity) {
      entity = { id: item };
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
    if (entity.components || !entity.componentTypeIds) {
      return entity;
    }

    const components = buildComponents(entityId || entity.id, entity, gateway);

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

  // Ensure entity has components
  entity = addComponentsToEntity(entity, entity.id || item);

  // Ensure actor has components
  const actor = addComponentsToEntity(actorEntity, actorEntity.id);

  const location = locationProvider.getLocation();

  // Debug logging
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
      }
    );
  }

  return { entity, actor, location };
}
