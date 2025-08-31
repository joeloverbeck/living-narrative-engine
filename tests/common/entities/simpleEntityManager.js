/**
 * @file In-memory EntityManager stub used for integration tests.
 * @see tests/common/entities/simpleEntityManager.js
 */

import { deepClone } from '../../../src/utils/cloneUtils.js';

/**
 * Minimal EntityManager implementation providing only the methods
 * required by integration tests.
 *
 * @class
 */
export default class SimpleEntityManager {
  /**
   * Creates a new instance pre-populated with the provided entities.
   *
   * @param {Array<{id:string, components:object}>} [entities] - Seed entities.
   */
  constructor(entities = []) {
    /** @type {Map<string, {id:string, components:Record<string, any>}>} */
    this.entities = new Map();
    /** @type {Map<string, object>} Entity instance cache for consistent references */
    this.entityInstanceCache = new Map();
    this.setEntities(entities);

    // Add activeEntities alias for compatibility with older code
    this.activeEntities = this.entities;
  }

  /**
   * Clears all existing entities and populates the manager with a new set.
   *
   * @param {Array<{id:string, components:object}>} [entities] - The new entities.
   */
  setEntities(entities = []) {
    this.entities.clear();
    this.entityInstanceCache.clear(); // Clear cache when entities change
    for (const e of entities) {
      const cloned = deepClone(e);
      this.entities.set(cloned.id, cloned);
    }
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

    // Check cache first for consistent object references
    if (this.entityInstanceCache.has(id)) {
      return this.entityInstanceCache.get(id);
    }

    const entityManager = this; // Capture reference to fix closure issue

    // Create and cache the entity instance
    const entityInstance = {
      id: entity.id,
      get components() {
        // Always get fresh data from the entity manager
        const currentEnt = entityManager.entities.get(id);
        return currentEnt ? currentEnt.components : {};
      },
      get componentTypeIds() {
        // Always get fresh data from the entity manager
        const currentEnt = entityManager.entities.get(id);
        return currentEnt ? Object.keys(currentEnt.components) : [];
      },
      getComponentData: (componentType) => {
        // Always get fresh data from the entity manager
        const currentEnt = entityManager.entities.get(id);
        return currentEnt
          ? (currentEnt.components[componentType] ?? null)
          : null;
      },
      hasComponent: (componentType) => {
        // Always get fresh data from the entity manager
        const currentEnt = entityManager.entities.get(id);
        return currentEnt
          ? Object.prototype.hasOwnProperty.call(
              currentEnt.components,
              componentType
            )
          : false;
      },
      getAllComponents: () => {
        // Always get fresh data from the entity manager
        const currentEnt = entityManager.entities.get(id);
        return currentEnt ? currentEnt.components : {};
      },
    };

    this.entityInstanceCache.set(id, entityInstance);
    return entityInstance;
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
   * Alias for getComponentData - gets component data for an entity.
   *
   * @param {string} id - Entity id.
   * @param {string} type - Component type.
   * @returns {any} Component data or null.
   */
  getComponent(id, type) {
    return this.getComponentData(id, type);
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
   * Creates an empty entity with the given id.
   * No-op if entity already exists.
   *
   * @param {string} id - Entity id.
   * @returns {object} The created entity instance.
   */
  createEntity(id) {
    if (!this.entities.has(id)) {
      this.entities.set(id, { id, components: {} });
      // Clear cache for this entity since it's new
      this.entityInstanceCache.delete(id);
    }
    return this.getEntityInstance(id);
  }

  /**
   * Adds or replaces a component on an entity.
   * Returns true on success for compatibility with atomic operations.
   *
   * @param {string} id - Entity id.
   * @param {string} type - Component type.
   * @param {object} data - Component data to set.
   * @returns {boolean|Promise<boolean>} Success status
   */
  addComponent(id, type, data) {
    // Clear cache first to ensure fresh data is returned
    this.entityInstanceCache.delete(id);
    
    let ent = this.entities.get(id);
    if (!ent) {
      ent = { id, components: {} };
      this.entities.set(id, ent);
    }
    ent.components[type] = deepClone(data);
    
    return Promise.resolve(true);
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
      // Clear cache for this entity since its components changed
      this.entityInstanceCache.delete(id);
    }
  }

  /**
   * Returns all entities in the manager.
   *
   * @returns {Array<object>} Array of all entity objects.
   */
  getEntities() {
    const result = [];
    const entityManager = this; // Capture reference to fix closure issue

    for (const entity of this.entities.values()) {
      result.push({
        id: entity.id,
        get components() {
          // Always get fresh data from the entity manager
          const currentEnt = entityManager.entities.get(entity.id);
          return currentEnt ? currentEnt.components : {};
        },
        get componentTypeIds() {
          // Always get fresh data from the entity manager
          const currentEnt = entityManager.entities.get(entity.id);
          return currentEnt ? Object.keys(currentEnt.components) : [];
        },
        getComponentData: (type) => {
          // Always get fresh data from the entity manager
          const currentEnt = entityManager.entities.get(entity.id);
          return currentEnt ? (currentEnt.components[type] ?? null) : null;
        },
        hasComponent: (type) => {
          // Always get fresh data from the entity manager
          const currentEnt = entityManager.entities.get(entity.id);
          return currentEnt
            ? Object.prototype.hasOwnProperty.call(currentEnt.components, type)
            : false;
        },
        getAllComponents: () => {
          // Always get fresh data from the entity manager
          const currentEnt = entityManager.entities.get(entity.id);
          return currentEnt ? currentEnt.components : {};
        },
      });
    }
    return result;
  }

  /**
   * Returns all entities that have the specified component.
   *
   * @param {string} componentType - Component type to filter by.
   * @returns {Array<object>} Array of entity objects with the component.
   */
  getEntitiesWithComponent(componentType) {
    const result = [];
    const entityManager = this; // Capture reference to fix closure issue

    for (const ent of this.entities.values()) {
      if (Object.prototype.hasOwnProperty.call(ent.components, componentType)) {
        result.push({
          id: ent.id,
          get componentTypeIds() {
            // Always get fresh data from the entity manager
            const currentEnt = entityManager.entities.get(ent.id);
            return currentEnt ? Object.keys(currentEnt.components) : [];
          },
          getComponentData: (type) => {
            // Always get fresh data from the entity manager
            const currentEnt = entityManager.entities.get(ent.id);
            return currentEnt ? (currentEnt.components[type] ?? null) : null;
          },
          hasComponent: (type) => {
            // Always get fresh data from the entity manager
            const currentEnt = entityManager.entities.get(ent.id);
            return currentEnt
              ? Object.prototype.hasOwnProperty.call(
                  currentEnt.components,
                  type
                )
              : false;
          },
        });
      }
    }
    return result;
  }

  /**
   * Returns an array of all active entity IDs.
   *
   * @returns {string[]} Array of entity IDs.
   */
  getEntityIds() {
    return Array.from(this.entities.keys());
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

  /**
   * Returns all component type IDs for a given entity.
   *
   * @param {string} entityId - The entity identifier.
   * @returns {string[]} Array of component type IDs.
   */
  getAllComponentTypesForEntity(entityId) {
    const entity = this.entities.get(entityId);
    if (!entity) return [];
    return Object.keys(entity.components);
  }

  /**
   * Adds a complete entity to the manager.
   * This is a convenience method for tests that build entities with ModEntityBuilder.
   *
   * @param {object} entityObject - Entity object with id and components
   * @param {string} entityObject.id - Entity identifier
   * @param {object} entityObject.components - Entity components
   * @returns {void}
   */
  addEntity(entityObject) {
    if (!entityObject || !entityObject.id) {
      throw new Error('SimpleEntityManager.addEntity: entityObject must have an id property');
    }

    const cloned = deepClone(entityObject);
    this.entities.set(cloned.id, cloned);
    // Clear cache for this entity since it's new/updated
    this.entityInstanceCache.delete(cloned.id);
  }
}
