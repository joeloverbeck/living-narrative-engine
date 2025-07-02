/**
 * Utility helpers for entity evaluation and component retrieval.
 *
 * @module entityHelpers
 */

import { buildComponents } from './entityComponentUtils.js';

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
  let entity;

  if (typeof item === 'string') {
    entity = gateway.getEntityInstance(item) || { id: item };
  } else if (item && typeof item === 'object') {
    entity = item;
  } else {
    return null;
  }

  if (entity.componentTypeIds && !entity.components) {
    const comps = getOrBuildComponents(entity.id, entity, gateway, trace);
    entity.components = comps;
  }

  let actor = actorEntity;
  if (actorEntity && actorEntity.componentTypeIds && !actorEntity.components) {
    const comps = getOrBuildComponents(
      actorEntity.id,
      actorEntity,
      gateway,
      trace
    );
    actor = { ...actorEntity, components: comps };
  }

  const location = locationProvider.getLocation();

  return { entity, actor, location };
}
