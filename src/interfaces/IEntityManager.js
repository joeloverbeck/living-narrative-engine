/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * @interface IEntityManager
 * @description Defines the contract for managing entity instances and their components.
 * This interface specifies the methods that CommandProcessor.js and its created
 * ActionContext rely upon for entity-related operations.
 */
export class IEntityManager {
  /**
   * Retrieves an active entity instance by its unique ID (UUID).
   *
   * @param {string} instanceId The unique ID (UUID) of the entity to retrieve.
   * @returns {Entity | undefined} The entity instance if found, otherwise undefined.
   */
  getEntityInstance(instanceId) {
    throw new Error('IEntityManager.getEntityInstance not implemented.');
  }

  /**
   * Creates a new Entity instance based on its definition ID.
   *
   * @param {string} definitionId - The ID of the entity definition to use.
   * @param {object} [options] - Options for entity creation.
   * @param {string} [options.instanceId] - A specific ID for the new instance. If not provided, a UUID will be generated.
   * @param {Object<string, object>} [options.componentOverrides] - A map of component data to override or add.
   * @returns {Entity} The newly created entity instance.
   * @throws {DefinitionNotFoundError} If the definition is not found.
   * @throws {Error} If an entity with the given instanceId already exists.
   */
  createEntityInstance(definitionId, options = {}) {
    throw new Error('IEntityManager.createEntityInstance not implemented.');
  }

  /**
   * Reconstructs an entity instance from a plain serializable object.
   *
   * @param {object} serializedEntity - Plain object from a save file.
   * @param {string} serializedEntity.instanceId
   * @param {string} serializedEntity.definitionId
   * @param {Record<string, object>} [serializedEntity.overrides]
   * @returns {Entity} The reconstructed Entity instance.
   */
  reconstructEntity(serializedEntity) {
    throw new Error('IEntityManager.reconstructEntity not implemented.');
  }

  /**
   * Retrieves the raw data object for a specific component type from an entity.
   *
   * @param {string} instanceId - The ID (UUID) of the entity.
   * @param {string} componentTypeId - The unique string ID of the component type.
   * @returns {object | undefined} The component data object if found, otherwise undefined.
   */
  getComponentData(instanceId, componentTypeId) {
    throw new Error('IEntityManager.getComponentData not implemented.');
  }

  /**
   * Checks if an entity has data associated with a specific component type ID.
   *
   * @param {string} instanceId - The ID (UUID) of the entity.
   * @param {string} componentTypeId - The unique string ID of the component type.
   * @returns {boolean} True if the entity has the component data, false otherwise.
   */
  hasComponent(instanceId, componentTypeId) {
    throw new Error('IEntityManager.hasComponent not implemented.');
  }

  /**
   * Checks if an entity has a component override (instance-level component data).
   * This excludes components that only exist on the definition.
   *
   * @param {string} instanceId - The ID (UUID) of the entity.
   * @param {string} componentTypeId - The unique string ID of the component type.
   * @returns {boolean} True if the entity has a component override, false otherwise.
   */
  hasComponentOverride(instanceId, componentTypeId) {
    throw new Error('IEntityManager.hasComponentOverride not implemented.');
  }

  /**
   * Fetches all active entities that possess a specific component type.
   *
   * @param {string} componentTypeId - The unique string identifier for the component type.
   * @returns {Entity[]} A new array containing all active Entity instances that have the specified component.
   * Returns an empty array if no matching entities are found.
   */
  getEntitiesWithComponent(componentTypeId) {
    throw new Error('IEntityManager.getEntitiesWithComponent not implemented.');
  }

  /**
   * Dynamically adds a component data object to an existing entity.
   * Implementations should handle validation and side effects (e.g., spatial index updates).
   *
   * @param {string} instanceId - The ID (UUID) of the entity to modify.
   * @param {string} componentTypeId - The unique string ID of the component type to add.
   * @param {object} componentData - The plain JavaScript object containing the component's data.
   * @returns {boolean} True if the component was successfully added.
   * @throws {Error} If the entity is not found, or if component data validation fails,
   * or for other addition failures.
   */
  addComponent(instanceId, componentTypeId, componentData) {
    throw new Error('IEntityManager.addComponent not implemented.');
  }

  /**
   * Removes a component data object from an existing entity.
   * Implementations should handle side effects (e.g., spatial index updates).
   *
   * @param {string} instanceId - The ID (UUID) of the entity to modify.
   * @param {string} componentTypeId - The unique string ID of the component type to remove.
   * @returns {boolean} True if the component was found and removed, false otherwise.
   */
  removeComponent(instanceId, componentTypeId) {
    throw new Error('IEntityManager.removeComponent not implemented.');
  }

  /**
   * Retrieves all entity instance IDs (UUIDs) present in a specific location.
   * This is often used by services like TargetResolutionService to find entities in the environment.
   *
   * @param {string} locationId - The unique ID of the location entity (which itself is an entity, typically identified by its instance ID or a well-known definition ID if it's a unique location).
   * @returns {Set<string>} A Set of entity instance IDs (UUIDs) in the specified location. Returns an empty Set if the location is not found or has no entities.
   */
  getEntitiesInLocation(locationId) {
    throw new Error('IEntityManager.getEntitiesInLocation not implemented.');
  }

  /**
   * Returns an iterable of all active entity instance IDs.
   *
   * @returns {Iterable<string>} Iterable of entity instance IDs.
   */
  getEntityIds() {
    throw new Error('IEntityManager.getEntityIds not implemented.');
  }

  /**
   * Finds all active entities that match a complex query.
   *
   * @param {object} query - The query definition.
   * @param {string[]} [query.withAll] - A list of componentTypeIds that the entity must have.
   * @param {string[]} [query.withAny] - A list of componentTypeIds where the entity must have at least one.
   * @param {string[]} [query.without] - A list of componentTypeIds that the entity must NOT have.
   * @returns {Entity[]} A new array of matching entities.
   */
  findEntities(query) {
    throw new Error('IEntityManager.findEntities not implemented.');
  }

  /**
   * Returns an iterator over all active entities (read-only).
   *
   * @returns {IterableIterator<Entity>}
   */
  get entities() {
    throw new Error('IEntityManager.entities getter not implemented.');
  }

  /**
   * Returns a list of all component type IDs attached to a given entity.
   *
   * @param {string} entityId The ID of the entity.
   * @returns {string[]} An array of component ID strings.
   */
  getAllComponentTypesForEntity(entityId) {
    throw new Error(
      'IEntityManager.getAllComponentTypesForEntity not implemented.'
    );
  }
}
