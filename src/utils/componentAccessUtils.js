// src/utils/componentAccessUtils.js

/**
 * @module componentAccessUtils
 * @description Helper utilities for safely accessing component data on entities.
 */

// Deprecated helpers have been replaced by EntityAccessService.

/**
 * @description Retrieves component data from an entity. Works with full
 * Entity instances exposing `getComponentData` as well as plain objects that
 * store data under a `components` property.
 * @param {object} entity - Target entity instance or pseudo-entity.
 * @param {string} componentId - ID of the component to fetch.
 * @returns {any | null} The component data if found, otherwise `null`.
 */
export function readComponent(entity, componentId) {
  if (!entity) {
    return null;
  }
  if (typeof entity.getComponentData === 'function') {
    return entity.getComponentData(componentId);
  }
  return entity.components?.[componentId] ?? null;
}

/**
 * @description Writes component data back to an entity. Uses `addComponent`
 * when available, falling back to direct assignment on a `components` bag.
 * @param {object} entity - Target entity instance or pseudo-entity.
 * @param {string} componentId - ID of the component to write.
 * @param {any} data - Data to store.
 * @returns {boolean} `true` if the data was stored, otherwise `false`.
 */
export function writeComponent(entity, componentId, data) {
  if (!entity) {
    return false;
  }
  if (typeof entity.addComponent === 'function') {
    entity.addComponent(componentId, data);
    return true;
  }
  if (entity.components && typeof entity.components === 'object') {
    entity.components[componentId] = data;
    return true;
  }
  return false;
}

// --- FILE END ---
