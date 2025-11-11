/**
 * @file Test Entity Manager Adapter
 * @description Adapts SimpleEntityManager to provide production EntityManager API
 */

import SimpleEntityManager from './simpleEntityManager.js';

/**
 * Adapter that wraps SimpleEntityManager to provide production EntityManager API.
 *
 * This allows operators and services to use the same API in tests as in production,
 * preventing API drift and runtime errors.
 */
export default class TestEntityManagerAdapter {
  #simple;
  #logger;

  /**
   * Creates a new TestEntityManagerAdapter instance.
   *
   * @param {object} config - Configuration
   * @param {object} config.logger - Logger instance
   * @param {SimpleEntityManager} [config.simpleManager] - Existing SimpleEntityManager to wrap
   * @param {Array<object>} [config.initialEntities] - Initial entities to load
   */
  constructor({ logger, simpleManager, initialEntities = [] }) {
    this.#logger = logger;
    // Note: SimpleEntityManager constructor takes array of entities, not config object
    this.#simple = simpleManager || new SimpleEntityManager(initialEntities);
  }

  // ============================================================================
  // IEntityManager Interface (Required Methods)
  // ============================================================================

  /**
   * Get iterator over all entities (production API).
   * This matches the production EntityManager.entities getter.
   *
   * @returns {object} Iterator over all entities
   */
  get entities() {
    return this.#simple.entities;
  }

  /**
   * Get array of all entity IDs.
   * This matches the production EntityManager.getEntityIds() method.
   *
   * @returns {Array<string>} Array of entity IDs
   */
  getEntityIds() {
    return this.#simple.getEntityIds();
  }

  /**
   * Get component data for a specific entity and component type.
   *
   * @param {string} entityId - The entity ID
   * @param {string} componentType - Namespaced component type
   * @returns {object|null} Component data object, or null if not found
   */
  getComponentData(entityId, componentType) {
    return this.#simple.getComponentData(entityId, componentType);
  }

  /**
   * Check if entity has a specific component.
   *
   * @param {string} entityId - The entity ID
   * @param {string} componentType - Namespaced component type
   * @returns {boolean} True if entity has component
   */
  hasComponent(entityId, componentType) {
    return this.#simple.hasComponent(entityId, componentType);
  }

  /**
   * Get full entity instance with all components.
   *
   * @param {string} entityId - The entity ID
   * @returns {object|null} Entity object with components, or null if not found
   */
  getEntityInstance(entityId) {
    return this.#simple.getEntityInstance(entityId);
  }

  // ============================================================================
  // Production API Extensions (Additional Methods)
  // ============================================================================

  /**
   * Get entities that have a specific component.
   * This matches the production EntityManager.getEntitiesWithComponent() method.
   *
   * @param {string} componentType - Component type to filter by
   * @returns {Array<object>} Entities with component
   */
  getEntitiesWithComponent(componentType) {
    return this.#simple.getEntitiesWithComponent(componentType);
  }

  /**
   * Get entity IDs at a specific location.
   * This matches the production EntityManager.getEntitiesInLocation() method.
   * NOTE: Production returns Set<string> of entity IDs, NOT entity objects.
   *
   * @param {string} locationId - Location ID
   * @returns {Set<string>} Set of entity IDs at location
   */
  getEntitiesInLocation(locationId) {
    return this.#simple.getEntitiesInLocation(locationId);
  }

  /**
   * Get all component types present on an entity.
   * This matches the production EntityManager.getAllComponentTypesForEntity() method.
   *
   * @param {string} entityId - Entity ID
   * @returns {Array<string>} Component type names
   */
  getAllComponentTypesForEntity(entityId) {
    return this.#simple.getAllComponentTypesForEntity(entityId);
  }

  /**
   * Find entities matching complex query criteria.
   * This matches the production EntityManager.findEntities() method.
   *
   * @param {object} queryObj - Query object with withAll, withAny, without conditions
   * @returns {Array<object>} Array of entities matching the query
   */
  findEntities(queryObj) {
    // SimpleEntityManager doesn't have findEntities, so implement it
    const allEntities = Array.from(this.#simple.entities);

    return allEntities.filter(entity => {
      // Check withAll - entity must have all these components
      if (queryObj.withAll && Array.isArray(queryObj.withAll)) {
        const hasAll = queryObj.withAll.every(componentType =>
          this.hasComponent(entity.id, componentType)
        );
        if (!hasAll) return false;
      }

      // Check withAny - entity must have at least one of these components
      if (queryObj.withAny && Array.isArray(queryObj.withAny)) {
        const hasAny = queryObj.withAny.some(componentType =>
          this.hasComponent(entity.id, componentType)
        );
        if (!hasAny) return false;
      }

      // Check without - entity must not have any of these components
      if (queryObj.without && Array.isArray(queryObj.without)) {
        const hasNone = queryObj.without.every(componentType =>
          !this.hasComponent(entity.id, componentType)
        );
        if (!hasNone) return false;
      }

      return true;
    });
  }

  // ============================================================================
  // SimpleEntityManager Passthrough (Test-Specific Methods)
  // ============================================================================

  /**
   * Get all entities as array (test-only convenience method).
   * NOTE: Production EntityManager does NOT have this method - use entities getter instead.
   *
   * @returns {Array<object>} Array of entity objects
   */
  getEntities() {
    return this.#simple.getEntities();
  }

  /**
   * Add entity to the manager (test-only).
   *
   * @param {object} entity - Entity to add
   */
  addEntity(entity) {
    this.#simple.addEntity(entity);
  }

  /**
   * Delete entity from the manager (test-only).
   * Note: SimpleEntityManager uses deleteEntity, not removeEntity.
   *
   * @param {string} entityId - Entity ID to remove
   */
  deleteEntity(entityId) {
    this.#simple.deleteEntity(entityId);
  }

  /**
   * Clear all entities (test-only).
   */
  clearAll() {
    this.#simple.clearAll();
  }

  /**
   * Set entities (test-only).
   * Replaces all entities with the provided array.
   *
   * @param {Array<object>} entities - Entities to set
   */
  setEntities(entities = []) {
    this.#simple.setEntities(entities);
  }

  /**
   * Get underlying SimpleEntityManager (for migration purposes).
   *
   * @deprecated Use adapter methods directly
   * @returns {SimpleEntityManager} Simple entity manager
   */
  getSimpleManager() {
    this.#logger.warn(
      'TestEntityManagerAdapter.getSimpleManager() is deprecated',
      {
        hint: 'Use adapter methods directly instead of accessing SimpleEntityManager'
      }
    );
    return this.#simple;
  }
}
