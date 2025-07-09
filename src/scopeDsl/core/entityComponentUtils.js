/**
 * Utility helpers for working with entity components.
 *
 * @module entityComponentUtils
 */

/**
 * @typedef {import('./gateways.js').EntityGateway} EntityGateway
 */

/**
 * Builds a components object for the specified entity.
 *
 * @description Retrieves component data for all component type IDs declared on
 * the entity. If a `getComponentData` method is present on the entity, it will
 * be used before falling back to the provided `entitiesGateway`.
 * @param {string} entityId - Identifier for the entity being processed.
 * @param {object} entity - Entity instance which may expose `componentTypeIds`.
 * @param {EntityGateway} entitiesGateway - Gateway used to fetch component data.
 * @returns {object} Components object keyed by type IDs.
 */
export function buildComponents(entityId, entity, entitiesGateway) {
  const components = {};

  if (!entity || !Array.isArray(entity.componentTypeIds)) {
    return components;
  }

  for (const componentTypeId of entity.componentTypeIds) {
    const data =
      entity.getComponentData?.(componentTypeId) ||
      entitiesGateway.getComponentData(entityId, componentTypeId);
    if (data) {
      components[componentTypeId] = data;
    }
  }

  return components;
}
