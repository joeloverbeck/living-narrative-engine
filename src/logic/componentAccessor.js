// src/logic/componentAccessor.js

/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Error returned when component access fails.
 *
 * @class
 * @augments Error
 * @param {string | number} entityId - Entity whose component was requested.
 * @param {string} componentId - Identifier of the component being fetched.
 * @param {Error} originalError - Underlying error from the EntityManager.
 */
export class ComponentAccessorError extends Error {
  constructor(entityId, componentId, originalError) {
    super(
      `Failed to fetch component [${componentId}] for entity [${entityId}]`
    );
    this.name = 'ComponentAccessorError';
    this.entityId = entityId;
    this.componentId = componentId;
    this.originalError = originalError;
  }
}

/**
 * @description Create a simple proxy for accessing an entity's components.
 * Accessing a property returns the component data or `null` if missing.
 * The `in` operator checks component existence via EntityManager.
 * @param {string | number} entityId - Target entity identifier.
 * @param {EntityManager} entityManager - Manager used for lookups.
 * @param {ILogger} logger - Logger for diagnostics.
 * @returns {Object<string, object | null | {error: ComponentAccessorError}>}
 *   Read-only view of components. When a component lookup fails, the returned
 *   value will be an object with an `error` property containing a
 *   {@link ComponentAccessorError} instance.
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
          return {
            error: new ComponentAccessorError(entityId, String(prop), error),
          };
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
