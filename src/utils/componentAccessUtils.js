// src/utils/componentAccessUtils.js

/**
 * @module componentAccessUtils
 * @description Helper utilities for safely accessing component data on entities.
 */

/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * Safely retrieves component data from an entity.
 *
 * @param {Entity | any} entity - The entity instance to query. Must expose a
 *   `getComponentData` method.
 * @param {string} componentId - The component type ID to retrieve.
 * @returns {any | null} The component data if available, otherwise `null`.
 */
export function getComponent(entity, componentId) {
  if (typeof componentId !== 'string' || componentId.trim() === '') {
    return null;
  }

  if (!entity || typeof entity.getComponentData !== 'function') {
    return null;
  }

  try {
    const data = entity.getComponentData(componentId);
    return data ?? null;
  } catch {
    return null;
  }
}

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * Safely retrieves component data for an entity via an EntityManager.
 *
 * The function validates the entity ID, component ID and entity manager
 * before attempting to access the data. Any errors thrown during the
 * lookup are caught and `null` is returned.
 *
 * @param {string} entityId - The ID of the entity instance to query.
 * @param {string} componentId - The component type ID to retrieve.
 * @param {IEntityManager} entityManager - Manager used to access component data.
 * @returns {any | null} The component data if available, otherwise `null`.
 */
export function getComponentFromManager(entityId, componentId, entityManager) {
  if (
    typeof entityId !== 'string' ||
    entityId.trim() === '' ||
    typeof componentId !== 'string' ||
    componentId.trim() === ''
  ) {
    return null;
  }

  if (!entityManager || typeof entityManager.getComponentData !== 'function') {
    return null;
  }

  try {
    const data = entityManager.getComponentData(entityId, componentId);
    return data ?? null;
  } catch {
    return null;
  }
}

// --- FILE END ---
