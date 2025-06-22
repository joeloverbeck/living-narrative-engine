/**
 * @file In-memory EntityManager stub used for integration tests.
 * @see tests/common/entities/simpleEntityManager.js
 */

/**
 * Minimal EntityManager implementation providing only the methods
 * required by integration tests.
 *
 * @class
 */
import { deepClone } from '../../../src/utils/cloneUtils.js';

export default class SimpleEntityManager {
  /**
   * Creates a new instance pre-populated with the provided entities.
   *
   * @param {Array<{id:string, components:object}>} [entities] - Seed entities.
   */
  constructor(entities = []) {
    /** @type {Map<string, {id:string, components:Record<string, any>}>} */
    this.entities = new Map();
    console.log('DEBUG: SimpleEntityManager constructor called with entities:', JSON.stringify(entities, null, 2));
    for (const e of entities) {
      console.log('DEBUG: Processing entity:', e.id, 'with original components:', Object.keys(e.components || {}));
      console.log('DEBUG: Original entity components:', JSON.stringify(e.components, null, 2));
      
      const cloned = deepClone(e);
      console.log('DEBUG: After deepClone - cloned entity components:', JSON.stringify(cloned.components, null, 2));
      console.log('DEBUG: Cloned components keys:', Object.keys(cloned.components || {}));
      
      console.log('DEBUG: Storing entity:', e.id, 'with components:', Object.keys(cloned.components || {}));
      this.entities.set(cloned.id, cloned);
    }
    // Add activeEntities alias for compatibility
    this.activeEntities = this.entities;
  }

  /**
   * Retrieves an entity instance by id.
   *
   * @param {string} id - Entity id.
   * @returns {object|undefined} The entity object or undefined if not found.
   */
  getEntityInstance(id) {
    const entity = this.entities.get(id);
    if (!entity) {
      return undefined;
    }
    
    // Return an object that has a getComponentData method to satisfy isValidEntity
    return {
      id: entity.id,
      components: entity.components,
      getComponentData: (componentType) => entity.components[componentType] ?? null,
    };
  }

  /**
   * Gets component data for an entity.
   *
   * @param {string} id - Entity id.
   * @param {string} type - Component type.
   * @returns {any} Component data or null.
   */
  getComponentData(id, type) {
    return this.entities.get(id)?.components[type] ?? null;
  }

  /**
   * Determines whether an entity has a component.
   *
   * @param {string} id - Entity id.
   * @param {string} type - Component type.
   * @returns {boolean} True if the component exists.
   */
  hasComponent(id, type) {
    return Object.prototype.hasOwnProperty.call(
      this.entities.get(id)?.components || {},
      type
    );
  }

  /**
   * Adds or replaces a component on an entity.
   *
   * @param {string} id - Entity id.
   * @param {string} type - Component type.
   * @param {object} data - Component data to set.
   * @returns {void}
   */
  addComponent(id, type, data) {
    let ent = this.entities.get(id);
    if (!ent) {
      ent = { id, components: {} };
      this.entities.set(id, ent);
    }
    ent.components[type] = deepClone(data);
  }

  /**
   * Removes a component from an entity.
   *
   * @param {string} id - Entity id.
   * @param {string} type - Component type.
   * @returns {void}
   */
  removeComponent(id, type) {
    const ent = this.entities.get(id);
    if (ent) {
      delete ent.components[type];
    }
  }

  /**
   * Returns all entities that have the specified component.
   *
   * @param {string} componentType - Component type to filter by.
   * @returns {Array<object>} Array of entity objects with the component.
   */
  getEntitiesWithComponent(componentType) {
    const result = [];
    for (const ent of this.entities.values()) {
      if (Object.prototype.hasOwnProperty.call(ent.components, componentType)) {
        result.push({
          id: ent.id,
          getComponentData: (type) => ent.components[type] ?? null,
        });
      }
    }
    return result;
  }

  /**
   * Returns a set of entity IDs for entities in the specified location.
   *
   * @param {string} locationId - The location identifier.
   * @returns {Set<string>} Set of entity IDs in the location.
   */
  getEntitiesInLocation(locationId) {
    const POSITION_COMPONENT_ID = 'core:position';
    const ids = new Set();
    for (const [id, ent] of this.entities) {
      const loc = ent.components[POSITION_COMPONENT_ID]?.locationId;
      if (loc === locationId) ids.add(id);
    }
    return ids;
  }
}
