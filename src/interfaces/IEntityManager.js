// src/core/interfaces/IEntityManager.js

/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * @interface IEntityManager
 * @description Defines the contract for managing entity instances and their components.
 * This interface specifies the methods that CommandProcessor.js and its created
 * ActionContext rely upon for entity-related operations.
 */
export class IEntityManager {
    /**
     * Retrieves an active entity instance by its unique ID.
     * @param {string} entityId The unique ID of the entity to retrieve.
     * @returns {Entity | undefined} The entity instance if found, otherwise undefined.
     */
    getEntityInstance(entityId) {
        throw new Error('IEntityManager.getEntityInstance not implemented.');
    }

    /**
     * Creates a new Entity instance based on its definition ID.
     * @param {string} entityId - The unique ID of the entity definition to instantiate (also used as the instance ID).
     * @param {boolean} [forceNew=false] - If true, always creates a new instance even if one exists.
     * @returns {Entity | null} The created or existing Entity instance, or null if definition not found or instantiation fails.
     */
    createEntityInstance(entityId, forceNew = false) {
        throw new Error('IEntityManager.createEntityInstance not implemented.');
    }

    /**
     * Retrieves the raw data object for a specific component type from an entity.
     * @param {string} entityId - The ID of the entity.
     * @param {string} componentTypeId - The unique string ID of the component type.
     * @returns {object | undefined} The component data object if found, otherwise undefined.
     */
    getComponentData(entityId, componentTypeId) {
        throw new Error('IEntityManager.getComponentData not implemented.');
    }

    /**
     * Checks if an entity has data associated with a specific component type ID.
     * @param {string} entityId - The ID of the entity.
     * @param {string} componentTypeId - The unique string ID of the component type.
     * @returns {boolean} True if the entity has the component data, false otherwise.
     */
    hasComponent(entityId, componentTypeId) {
        throw new Error('IEntityManager.hasComponent not implemented.');
    }

    /**
     * Fetches all active entities that possess a specific component type.
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
     * @param {string} entityId - The ID of the entity to modify.
     * @param {string} componentTypeId - The unique string ID of the component type to add.
     * @param {object} componentData - The plain JavaScript object containing the component's data.
     * @returns {boolean} True if the component was successfully added.
     * @throws {Error} If the entity is not found, or if component data validation fails,
     * or for other addition failures.
     */
    addComponent(entityId, componentTypeId, componentData) {
        throw new Error('IEntityManager.addComponent not implemented.');
    }

    /**
     * Removes a component data object from an existing entity.
     * Implementations should handle side effects (e.g., spatial index updates).
     * @param {string} entityId - The ID of the entity to modify.
     * @param {string} componentTypeId - The unique string ID of the component type to remove.
     * @returns {boolean} True if the component was found and removed, false otherwise.
     */
    removeComponent(entityId, componentTypeId) {
        throw new Error('IEntityManager.removeComponent not implemented.');
    }

    /**
     * Retrieves all entity IDs present in a specific location.
     * This is often used by services like TargetResolutionService to find entities in the environment.
     * @param {string} locationId - The unique ID of the location entity.
     * @returns {Set<string>} A Set of entity IDs in the specified location. Returns an empty Set if the location is not found or has no entities.
     */
    getEntitiesInLocation(locationId) {
        throw new Error('IEntityManager.getEntitiesInLocation not implemented.');
    }
}