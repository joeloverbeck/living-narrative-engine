// src/entities/utils/componentHelpers.js
import {
  readComponent,
  writeComponent,
} from '../../utils/componentAccessUtils.js';

/**
 * Fetch component data from an entity or pseudo-entity.
 *
 * @description Wrapper around {@link readComponent} for entity helpers.
 * @param {object} entity - Entity instance or plain object with components.
 * @param {string} componentId - Component identifier to retrieve.
 * @returns {any | null} The component data or `null` when absent.
 */
export function fetchComponent(entity, componentId) {
  return readComponent(entity, componentId);
}

/**
 * Apply component data to an entity or pseudo-entity.
 *
 * @description Wrapper around {@link writeComponent} for entity helpers.
 * @param {object} entity - Entity instance or plain object with components.
 * @param {string} componentId - Component identifier to apply.
 * @param {any} data - Component data to store.
 * @returns {boolean} `true` if the component was written, otherwise `false`.
 */
export function applyComponent(entity, componentId, data) {
  return writeComponent(entity, componentId, data);
}

export default {
  fetchComponent,
  applyComponent,
};
