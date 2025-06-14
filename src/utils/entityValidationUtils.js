// src/utils/entityValidationUtils.js

/**
 * @file Utility functions to validate Entity and EntityManager objects.
 */

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @description Checks whether a value appears to be a valid Entity.
 * A valid Entity must expose a `getComponentData` method.
 * @param {any} entity - The value to test.
 * @returns {boolean} `true` if the object exposes `getComponentData`, otherwise `false`.
 */
export function isValidEntity(entity) {
  return !!entity && typeof entity.getComponentData === 'function';
}

/**
 * @description Checks whether a value appears to be a valid EntityManager.
 * It must expose both `getEntityInstance` and `getComponentData` methods.
 * @param {any} manager - The value to test.
 * @returns {boolean} `true` if both methods are present, otherwise `false`.
 */
export function isValidEntityManager(manager) {
  return (
    !!manager &&
    typeof manager.getEntityInstance === 'function' &&
    typeof manager.getComponentData === 'function'
  );
}

// --- FILE END ---
