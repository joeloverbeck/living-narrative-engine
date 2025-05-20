import Entity from './entity.js'; // Represents OriginalEntity as per ticket context
import {POSITION_COMPONENT_ID} from "../constants/componentIds.js";
// Corrected import path for IEntityManager
import {IEntityManager} from "../core/interfaces/IEntityManager.js";

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../core/interfaces/coreServices.js').ISpatialIndexManager} ISpatialIndexManager */

/** @typedef {import('../core/interfaces/coreServices.js').ValidationResult} ValidationResult */

/**
 * Manages the lifecycle and component data manipulation of Entity instances.
 * It orchestrates entity creation using validated definitions from the IDataRegistry,
 * handles dynamic component addition/removal with runtime validation via ISchemaValidator,
 * and ensures the ISpatialIndexManager is updated accordingly.
 * This class operates purely on component data (plain objects) and their type IDs,
 * remaining agnostic to specific component logic or classes.
 * @implements {IEntityManager}
 */
class EntityManager extends IEntityManager {
    /**
     * @private
     * @type {IDataRegistry}
     * @description Service to retrieve validated game data definitions.
     */
    #registry;

    /**
     * @private
     * @type {ISchemaValidator}
     * @description Service to validate component data against registered schemas.
     */
    #validator;

    /**
     * @private
     * @type {ILogger}
     * @description Service for logging messages.
     */
    #logger;

    /**
     * @private
     * @type {ISpatialIndexManager}
     * @description Service to manage the spatial index based on entity positions.
     */
    #spatialIndexManager;

    /**
     * Stores the active, instantiated Entity objects, keyed by their unique instance ID.
     * @type {Map<string, Entity>}
     */
    activeEntities = new Map();

    /**
     * Creates a new EntityManager instance.
     * @param {IDataRegistry} registry - The data registry service.
     * @param {ISchemaValidator} validator - The schema validation service.
     * @param {ILogger} logger - The logging service.
     * @param {ISpatialIndexManager} spatialIndexManager - The spatial index management service.
     * @throws {Error} If any required dependency is not provided or invalid.
     */
    constructor(registry, validator, logger, spatialIndexManager) {
        super();
        // AC: Constructor accepts IDataRegistry, ISchemaValidator, ILogger, ISpatialIndexManager.
        if (!registry || typeof registry.getEntityDefinition !== 'function') { // Check specific method needed
            throw new Error('EntityManager requires a valid IDataRegistry instance with getEntityDefinition.');
        }
        if (!validator || typeof validator.validate !== 'function') {
            throw new Error('EntityManager requires a valid ISchemaValidator instance with validate.');
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function' || typeof logger.warn !== 'function' || typeof logger.debug !== 'function') {
            throw new Error('EntityManager requires a valid ILogger instance with info, error, warn, and debug methods.');
        }
        if (!spatialIndexManager || typeof spatialIndexManager.addEntity !== 'function' || typeof spatialIndexManager.removeEntity !== 'function' || typeof spatialIndexManager.updateEntityLocation !== 'function') {
            throw new Error('EntityManager requires a valid ISpatialIndexManager instance.');
        }

        this.#registry = registry;
        this.#validator = validator;
        this.#logger = logger;
        this.#spatialIndexManager = spatialIndexManager;

        this.#logger.info('EntityManager initialized with required services (IDataRegistry, ISchemaValidator, ILogger, ISpatialIndexManager).');
    }

    /**
     * Creates a new Entity instance based on its definition ID.
     * Retrieves the *pre-validated* definition from IDataRegistry, instantiates the Entity,
     * copies the component *data* (plain objects) from the definition to the entity instance,
     * and updates the spatial index if a valid position component is present.
     * Component data is deep-cloned to ensure instance independence.
     *
     * @param {string} entityId - The unique ID of the entity definition to instantiate (also used as the instance ID).
     * @param {boolean} [forceNew=false] - If true, always creates a new instance even if one exists in activeEntities.
     * The new instance is returned but NOT added to/updated in the activeEntities map
     * if an entity with that ID already exists in the map.
     * @returns {Entity | null} The created Entity instance, or null if definition not found or instantiation fails.
     * If forceNew is false and an entity with entityId already exists, the existing instance is returned.
     */
    createEntityInstance(entityId, forceNew = false) {
        if (typeof entityId !== 'string' || !entityId) {
            this.#logger.error(`EntityManager.createEntityInstance: Invalid entityId provided: ${entityId}`);
            return null;
        }

        if (!forceNew && this.activeEntities.has(entityId)) {
            this.#logger.debug(`EntityManager.createEntityInstance: Returning existing instance for ID: ${entityId}`);
            return this.activeEntities.get(entityId);
        }

        const entityDefinition = this.#registry.getEntityDefinition(entityId);

        if (!entityDefinition) {
            this.#logger.error(`EntityManager.createEntityInstance: Entity definition not found in IDataRegistry for ID: ${entityId}`);
            return null;
        }

        if (entityDefinition.components && typeof entityDefinition.components !== 'object') {
            this.#logger.warn(`EntityManager.createEntityInstance: Entity definition for ${entityId} has an invalid 'components' field (must be an object). Treating as no components.`);
            entityDefinition.components = {};
        } else if (!entityDefinition.components) {
            entityDefinition.components = {};
        }

        let entity; // Declare entity here to be accessible in catch block if needed for cleanup
        try {
            this.#logger.debug(`EntityManager.createEntityInstance: Creating new entity instance for ID: ${entityId} (forceNew=${forceNew})`);
            entity = new Entity(entityId); // Uses the imported Entity class

            for (const [componentTypeId, componentData] of Object.entries(entityDefinition.components)) {
                const clonedData = JSON.parse(JSON.stringify(componentData));
                entity.addComponent(componentTypeId, clonedData);
            }
            this.#logger.debug(`EntityManager.createEntityInstance: Populated components for entity ${entityId} from definition (with cloning).`);

            // Manage entity in activeEntities map based on forceNew
            if (!forceNew) {
                // This branch is taken if forceNew is false.
                // Since the check at the beginning of the method would have returned an existing entity,
                // reaching this point means entityId was not previously in activeEntities.
                // So, we are creating a new entity that should be managed.
                this.activeEntities.set(entityId, entity);
                this.#logger.debug(`EntityManager.createEntityInstance: Added new entity ${entityId} to activeEntities map (forceNew=false, ID was new).`);
            } else {
                // forceNew is true. The new 'entity' instance is returned.
                // The activeEntities map is NOT modified. If an entity with 'entityId' already existed in the map, it remains.
                // If 'entityId' was not in the map, it is still not added here. The returned entity is "standalone".
                this.#logger.debug(`EntityManager.createEntityInstance: Created entity ${entityId} (forceNew=true). This instance is returned. The activeEntities map was not modified.`);
            }

            const positionData = entity.getComponentData(POSITION_COMPONENT_ID);
            if (positionData) {
                const locationId = positionData.locationId;
                // The new entity (whether in activeEntities or standalone) is added to the spatial index if it has a position.
                this.#spatialIndexManager.addEntity(entityId, locationId);
                if (typeof locationId === 'string' && locationId.trim() !== '') {
                    this.#logger.debug(`EntityManager.createEntityInstance: Added entity ${entityId} (from new instance) to spatial index at location ${locationId}.`);
                } else {
                    this.#logger.debug(`EntityManager.createEntityInstance: Entity ${entityId} (new instance) has position component but invalid/null locationId (${locationId}). Not added to spatial index via this path.`);
                }
            } else {
                this.#logger.debug(`EntityManager.createEntityInstance: Entity ${entityId} (new instance) has no position component. Not added to spatial index.`);
            }

            this.#logger.info(`EntityManager.createEntityInstance: Successfully created instance for entity ${entityId} (forceNew=${forceNew}).`);
            return entity;

        } catch (error) {
            this.#logger.error(`EntityManager.createEntityInstance: Failed to create entity instance for ID ${entityId} (forceNew=${forceNew}):`, error);
            // Clean up only if forceNew was false and we attempted to add it.
            // If forceNew was true, 'entity' was never intended for activeEntities via this path.
            if (!forceNew && entity && this.activeEntities.get(entityId) === entity) {
                this.activeEntities.delete(entityId);
                this.#logger.debug(`EntityManager.createEntityInstance: Cleaned up entity ${entityId} from activeEntities due to creation error.`);
            }
            return null;
        }
    }

    /**
     * Dynamically adds a component data object to an existing entity.
     * Validates the component data against its schema before adding.
     * Updates the spatial index if the position component is added or modified.
     * Component data is deep-cloned before being added to the entity.
     *
     * @param {string} entityId - The ID of the entity to modify.
     * @param {string} componentTypeId - The unique string ID of the component type to add (e.g., "core:health").
     * @param {object} componentData - The plain JavaScript object containing the component's data.
     * @returns {boolean} True if the component was successfully added, false otherwise.
     * @throws {Error} If the entity is not found, or if component data validation fails.
     */
    addComponent(entityId, componentTypeId, componentData) {
        const entity = this.activeEntities.get(entityId);
        if (!entity) {
            const errMsg = `EntityManager.addComponent: Entity not found with ID: ${entityId}`;
            this.#logger.error(errMsg);
            throw new Error(errMsg);
        }

        const validationResult = this.#validator.validate(componentTypeId, componentData);
        if (!validationResult.isValid) {
            const errorDetails = JSON.stringify(validationResult.errors, null, 2);
            const errMsg = `EntityManager.addComponent: Component data validation failed for type '${componentTypeId}' on entity '${entityId}'. Errors:\n${errorDetails}`;
            this.#logger.error(errMsg);
            throw new Error(`EntityManager.addComponent: Component data validation failed for type '${componentTypeId}' on entity '${entityId}'.`);
        }
        this.#logger.debug(`EntityManager.addComponent: Component data validation passed for type '${componentTypeId}' on entity '${entityId}'.`);

        let oldLocationId = null;
        if (componentTypeId === POSITION_COMPONENT_ID) {
            const currentPositionData = entity.getComponentData(POSITION_COMPONENT_ID);
            oldLocationId = currentPositionData?.locationId;
            this.#logger.debug(`EntityManager.addComponent: Old location for entity ${entityId} was ${oldLocationId ?? 'null/undefined'}.`);
        }

        try {
            const clonedData = JSON.parse(JSON.stringify(componentData));
            entity.addComponent(componentTypeId, clonedData);
            this.#logger.debug(`EntityManager.addComponent: Successfully added/updated component '${componentTypeId}' data on entity '${entityId}'.`);
        } catch (error) {
            this.#logger.error(`EntityManager.addComponent: Error calling entity.addComponent for ${componentTypeId} on ${entityId}:`, error);
            throw error;
        }

        if (componentTypeId === POSITION_COMPONENT_ID) {
            const newPositionData = entity.getComponentData(POSITION_COMPONENT_ID);
            const newLocationId = newPositionData?.locationId;
            this.#logger.debug(`EntityManager.addComponent: New location for entity ${entityId} is ${newLocationId ?? 'null/undefined'}. Updating spatial index.`);
            this.#spatialIndexManager.updateEntityLocation(entityId, oldLocationId, newLocationId);
        }
        return true;
    }

    /**
     * Removes a component data object from an existing entity.
     * Updates the spatial index if the position component is removed.
     *
     * @param {string} entityId - The ID of the entity to modify.
     * @param {string} componentTypeId - The unique string ID of the component type to remove.
     * @returns {boolean} True if the component was found and removed, false otherwise.
     */
    removeComponent(entityId, componentTypeId) {
        const entity = this.activeEntities.get(entityId);
        if (!entity) {
            this.#logger.warn(`EntityManager.removeComponent: Entity not found with ID: ${entityId}. Cannot remove component.`);
            return false;
        }

        let oldLocationId = null;
        if (componentTypeId === POSITION_COMPONENT_ID) {
            const currentPositionData = entity.getComponentData(POSITION_COMPONENT_ID);
            oldLocationId = currentPositionData?.locationId;
            this.#logger.debug(`EntityManager.removeComponent: Removing position component from entity ${entityId}. Old location was ${oldLocationId ?? 'null/undefined'}.`);
        }

        const removed = entity.removeComponent(componentTypeId);

        if (removed) {
            this.#logger.debug(`EntityManager.removeComponent: Successfully removed component '${componentTypeId}' from entity '${entityId}'.`);
            if (componentTypeId === POSITION_COMPONENT_ID) {
                this.#spatialIndexManager.removeEntity(entityId, oldLocationId);
                this.#logger.debug(`EntityManager.removeComponent: Updated spatial index for entity ${entityId} removal from location ${oldLocationId ?? 'null/undefined'}.`);
            }
        } else {
            this.#logger.debug(`EntityManager.removeComponent: Component '${componentTypeId}' not found on entity '${entityId}'. Nothing removed.`);
        }
        return removed;
    }

    /**
     * Retrieves the raw data object for a specific component type from an entity.
     * Delegates directly to the Entity instance.
     *
     * @param {string} entityId - The ID of the entity.
     * @param {string} componentTypeId - The unique string ID of the component type.
     * @returns {object | undefined} The component data object if found, otherwise undefined.
     */
    getComponentData(entityId, componentTypeId) {
        const entity = this.activeEntities.get(entityId);
        return entity?.getComponentData(componentTypeId);
    }

    /**
     * Checks if an entity has data associated with a specific component type ID.
     * Delegates directly to the Entity instance.
     *
     * @param {string} entityId - The ID of the entity.
     * @param {string} componentTypeId - The unique string ID of the component type.
     * @returns {boolean} True if the entity has the component data, false otherwise.
     */
    hasComponent(entityId, componentTypeId) {
        const entity = this.activeEntities.get(entityId);
        return entity?.hasComponent(componentTypeId) || false;
    }

    /**
     * Retrieves an active entity instance by ID.
     * @param {string} entityId
     * @returns {Entity | undefined}
     */
    getEntityInstance(entityId) {
        return this.activeEntities.get(entityId);
    }

    /**
     * Fetches all active entities that possess a specific component type.
     *
     * @param {string} componentTypeId - The unique string identifier for the component type.
     * @returns {Entity[]} A new array containing all active `Entity` instances that have the specified component.
     */
    getEntitiesWithComponent(componentTypeId) {
        if (typeof componentTypeId !== 'string' || !componentTypeId) {
            this.#logger.debug(`EntityManager.getEntitiesWithComponent: Received invalid componentTypeId (${componentTypeId}). Returning empty array.`);
            return [];
        }
        const matchingEntities = [];
        for (const entity of this.activeEntities.values()) {
            if (entity.hasComponent(componentTypeId)) {
                matchingEntities.push(entity);
            }
        }
        this.#logger.debug(`EntityManager.getEntitiesWithComponent: Found ${matchingEntities.length} entities with component '${componentTypeId}'.`);
        return matchingEntities;
    }

    /**
     * Removes an entity instance entirely from the active map AND the spatial index.
     * @param {string} entityId
     * @returns {boolean} True if the entity was found and removed, false otherwise.
     */
    removeEntityInstance(entityId) {
        const entity = this.activeEntities.get(entityId);
        if (entity) {
            let oldLocationId = null;
            const positionData = entity.getComponentData(POSITION_COMPONENT_ID);
            oldLocationId = positionData?.locationId;

            if (oldLocationId) { // Check if oldLocationId is not null/undefined before trying to remove
                this.#spatialIndexManager.removeEntity(entityId, oldLocationId);
                this.#logger.debug(`EntityManager.removeEntityInstance: Removed entity ${entityId} from spatial index (location: ${oldLocationId}).`);
            } else {
                this.#logger.debug(`EntityManager.removeEntityInstance: Entity ${entityId} had no position or no valid locationId. No removal from spatial index needed based on oldLocationId.`);
            }

            const deleted = this.activeEntities.delete(entityId);
            if (deleted) {
                this.#logger.info(`EntityManager.removeEntityInstance: Removed entity instance ${entityId} from active map.`);
            }
            return deleted;
        }
        this.#logger.warn(`EntityManager.removeEntityInstance: Attempted to remove non-existent entity instance ${entityId}`);
        return false;
    }

    /**
     * Reconstructs an entity instance from saved data.
     * Creates a new entity and populates its components based on the provided
     * save game structure. This method centralizes the logic for bringing an entity
     * back to life from a saved state.
     *
     * @param {object} savedEntityData - An object matching the structure of an entity
     * within `SaveGameStructure.gameState.entities`.
     * @param {string} savedEntityData.instanceId - The unique instance ID of the entity.
     * @param {string} savedEntityData.definitionId - The original definition ID of the entity.
     * (Currently not stored on the live entity by this method,
     * but validated for presence).
     * @param {object} [savedEntityData.components] - An optional object where keys are
     * componentTypeIds and values are componentData objects.
     * @returns {Entity} The reconstructed Entity instance.
     * @throws {Error} If `savedEntityData` is invalid (e.g., missing `instanceId` or `definitionId`),
     * or if critical errors occur during entity creation.
     */
    reconstructEntity(savedEntityData) {
        this.#logger.debug(`EntityManager.reconstructEntity: Starting reconstruction for entity instanceId: ${savedEntityData?.instanceId}`);

        // Input Validation
        if (!savedEntityData || typeof savedEntityData !== 'object' ||
            typeof savedEntityData.instanceId !== 'string' || !savedEntityData.instanceId ||
            typeof savedEntityData.definitionId !== 'string' || !savedEntityData.definitionId) {
            const errorMsg = "Invalid savedEntityData provided for reconstruction. Must include instanceId (string) and definitionId (string).";
            this.#logger.error(`EntityManager.reconstructEntity: ${errorMsg} Received: ${JSON.stringify(savedEntityData)}`);
            throw new Error(errorMsg);
        }

        const {instanceId, definitionId, components} = savedEntityData;

        // Entity Creation
        // Note: `Entity` is imported as `OriginalEntity` contextually for this ticket
        const entity = new Entity(instanceId);
        // The ticket mentions `definitionId` is not stored on `Entity` currently.
        // If it were to be stored, it would be `entity.definitionId = definitionId;` or similar.

        // Add the newly created entity to activeEntities *before* adding components.
        // This is crucial so that this.addComponent can find the entity.
        this.activeEntities.set(entity.id, entity);
        this.#logger.debug(`EntityManager.reconstructEntity: Created and added entity ${entity.id} to activeEntities.`);

        // Component Reconstruction
        if (components && typeof components === 'object') {
            this.#logger.debug(`EntityManager.reconstructEntity: Reconstructing components for entity ${entity.id}.`);
            for (const [componentTypeId, componentData] of Object.entries(components)) {
                if (typeof componentData !== 'object' || componentData === null) {
                    this.#logger.warn(`EntityManager.reconstructEntity: Invalid componentData for componentTypeId ${componentTypeId} on entity ${entity.id}. Skipping this component. Data: ${JSON.stringify(componentData)}`);
                    continue;
                }

                // Deep clone componentData before passing to addComponent, as per ticket.
                // this.addComponent also performs cloning, so this is an extra layer of safety
                // or adheres to a specific design choice for reconstructEntity.
                const clonedComponentData = JSON.parse(JSON.stringify(componentData));

                try {
                    // this.addComponent handles validation against schema (if loaded)
                    // and side effects like spatial index updates.
                    this.addComponent(entity.id, componentTypeId, clonedComponentData);
                    this.#logger.debug(`EntityManager.reconstructEntity: Added/Validated component ${componentTypeId} to entity ${entity.id}.`);
                } catch (compError) {
                    this.#logger.error(`EntityManager.reconstructEntity: Failed to add/validate component ${componentTypeId} to entity ${entity.id} during state restoration. Error: ${compError.message}. Skipping component. Entity may be in an inconsistent state.`, compError);
                    // Continue to the next component as per requirements
                }
            }
        } else if (components !== undefined) { // components exists but is not a valid object
            this.#logger.warn(`EntityManager.reconstructEntity: savedEntityData.components for entity ${entity.id} is present but not a valid object. No components will be reconstructed. Components: ${JSON.stringify(components)}`);
        } else { // components is undefined or null
            this.#logger.debug(`EntityManager.reconstructEntity: No components found in savedEntityData for entity ${entity.id}.`);
        }

        // Definition ID Handling (Consideration):
        // As noted in the ticket, storing definitionId on the entity or in a mapping
        // is a separate enhancement if needed.

        this.#logger.debug(`EntityManager.reconstructEntity: Successfully reconstructed entity ${entity.id} (original definitionId: ${definitionId}).`);
        return entity;
    }


    // --- Methods Delegating to Spatial Index Manager ---

    /**
     * Retrieves all entity IDs present in a specific location using the spatial index.
     * @param {string} locationId - The location ID to query.
     * @returns {Set<string>} A *copy* of the Set of entity IDs in the location, or an empty Set.
     */
    getEntitiesInLocation(locationId) {
        return this.#spatialIndexManager.getEntitiesInLocation(locationId);
    }

    /**
     * Builds the spatial index based on the current state of active entities.
     * Delegates to the spatial index manager.
     */
    buildInitialSpatialIndex() {
        this.#logger.info('EntityManager: Delegating initial spatial index build...');
        this.#spatialIndexManager.buildIndex(this); // Pass 'this' (EntityManager)
    }

    /**
     * Clears all active entities and the spatial index.
     * Useful for restarting or loading a new game state.
     */
    clearAll() {
        this.activeEntities.clear();
        this.#spatialIndexManager.clearIndex();
        this.#logger.info('EntityManager: Cleared all active entities and delegated spatial index clearing.');
    }
}

export default EntityManager;