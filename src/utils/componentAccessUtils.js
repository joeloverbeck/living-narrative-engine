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

// --- FILE END ---
