/**
 * @file ComponentAccessService
 * @description Provides simple utilities for reading and writing component data on
 * entities or plain objects used as pseudo-entities.
 */

/**
 * @class ComponentAccessService
 * @description Service offering methods to fetch and apply component data.
 */
export class ComponentAccessService {
  /**
   * Retrieve component data from an entity or pseudo-entity.
   *
   * @param {object} entity - Entity instance or plain object with components.
   * @param {string} componentId - Identifier of the component to fetch.
   * @returns {any|null} The component data if found, otherwise `null`.
   */
  fetchComponent(entity, componentId) {
    if (!entity) {
      return null;
    }
    if (typeof entity.getComponentData === 'function') {
      return entity.getComponentData(componentId);
    }
    return entity.components?.[componentId] ?? null;
  }

  /**
   * Apply component data to an entity or pseudo-entity.
   *
   * @param {object} entity - Entity instance or plain object with components.
   * @param {string} componentId - Identifier of the component to apply.
   * @param {any} data - Data to store on the component.
   * @returns {boolean} `true` if the component was stored, otherwise `false`.
   */
  applyComponent(entity, componentId, data) {
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
}

export default ComponentAccessService;
