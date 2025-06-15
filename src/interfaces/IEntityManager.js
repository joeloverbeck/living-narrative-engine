// src/interfaces/IEntityManager.js

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
   * Creates a new Entity instance based on its definition ID, assigning it a unique instance ID.
   *
   * @param {string} definitionId - The unique ID of the entity definition to instantiate (e.g., "isekai:hero").
   * @param {string | null} [instanceId] - Optional. The unique instance ID (UUID) for this entity.
   * If not provided (or null), the implementation should generate a new UUID.
   * @param {boolean} [forceNew] - If true and an entity with the given `instanceId` already exists,
   * the implementation might handle this differently (e.g., create a new unmanaged instance or error).
   * Refer to concrete implementation for specific behavior.
   * @returns {Entity | null} The created Entity instance, or null if definition not found or instantiation fails.
   * If `forceNew` is false and an entity with `instanceId` already exists, the existing managed instance is typically returned.
   */
  createEntityInstance(definitionId, instanceId = null, forceNew = false) {
    throw new Error('IEntityManager.createEntityInstance not implemented.');
  }

  /**
   * Reconstructs an entity instance from serialized persistence data.
   *
   * @param {{instanceId: string, definitionId: string, components: Record<string, any>}} serialized
   *   Serialized representation produced by the save system.
   * @returns {Entity | null} The reconstructed Entity instance or null on failure.
   */
  reconstructEntity(serialized) {
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
}
