// src/logic/componentAccessor.js

/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @description Create a simple proxy for accessing an entity's components.
 * Accessing a property returns the component data or `null` if missing.
 * The `in` operator checks component existence via EntityManager.
 * @param {string | number} entityId - Target entity identifier.
 * @param {EntityManager} entityManager - Manager used for lookups.
 * @param {ILogger} logger - Logger for diagnostics.
 * @returns {Object<string, object|null>} Read-only view of components.
 */
export function createComponentAccessor(entityId, entityManager, logger) {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== 'string') return undefined;
        try {
          return entityManager.getComponentData(entityId, prop) ?? null;
        } catch (error) {
          logger.error(
            `ComponentAccessor: Error fetching component [${String(prop)}] for entity [${entityId}]:`,
            error
          );
          return null;
        }
      },
      has(_target, prop) {
        if (typeof prop !== 'string') return false;
        try {
          return entityManager.hasComponent(entityId, prop);
        } catch (error) {
          logger.error(
            `ComponentAccessor: Error checking component existence [${String(prop)}] for entity [${entityId}]:`,
            error
          );
          return false;
        }
      },
    }
  );
}
