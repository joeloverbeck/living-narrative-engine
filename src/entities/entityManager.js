// src/entities/entityManager.js

import {v4 as uuidv4} from 'uuid'; // Import the UUID library
import Entity from './entity.js';
import {POSITION_COMPONENT_ID} from "../constants/componentIds.js";
import {IEntityManager} from "../interfaces/IEntityManager.js";

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/** @typedef {import('../interfaces/coreServices.js').ISpatialIndexManager} ISpatialIndexManager */
/** @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult */

class EntityManager extends IEntityManager {
    // ... (constructor and other private fields remain the same) ...
    #registry;
    #validator;
    #logger;
    #spatialIndexManager;
    activeEntities = new Map();

    constructor(registry, validator, logger, spatialIndexManager) {
        super();
        if (!registry || typeof registry.getEntityDefinition !== 'function') {
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
     * Creates a new Entity instance based on its definition ID, assigning it a unique instance ID.
     * Retrieves the *pre-validated* definition from IDataRegistry using definitionId,
     * instantiates the Entity with an instanceId (either provided or generated if null),
     * copies the component *data* from the definition to the entity instance,
     * and updates the spatial index if a valid position component is present.
     * Component data is deep-cloned to ensure instance independence.
     *
     * @param {string} definitionId - The unique ID of the entity definition to instantiate (e.g., "isekai:hero").
     * @param {string | null} [instanceId=null] - Optional. The unique instance ID (UUID) for this entity.
     * If not provided (or null), a new UUID will be generated using `uuidv4()`.
     * @param {boolean} [forceNew=false] - If true and an entity with the given `instanceId` already exists,
     * this method will still create and return a new instance, but this
     * new instance will NOT be added to/replace the one in `activeEntities`.
     * Use with caution, primarily for temporary or preview entities.
     * @returns {Entity | null} The created Entity instance, or null if definition not found or instantiation fails.
     * If `forceNew` is false and an entity with `instanceId` already exists, the existing instance is returned.
     */
    createEntityInstance(definitionId, instanceId = null, forceNew = false) {
        if (typeof definitionId !== 'string' || !definitionId) {
            this.#logger.error(`EntityManager.createEntityInstance: Invalid definitionId provided: ${definitionId}`);
            return null;
        }

        const actualInstanceId = instanceId || uuidv4(); // Use uuidv4()

        if (typeof actualInstanceId !== 'string' || !actualInstanceId) {
            this.#logger.error(`EntityManager.createEntityInstance: Failed to establish a valid instanceId for definition ${definitionId}. Provided instanceId: ${instanceId}`);
            return null;
        }

        if (!forceNew && this.activeEntities.has(actualInstanceId)) {
            this.#logger.debug(`EntityManager.createEntityInstance: Returning existing instance for ID: ${actualInstanceId}`);
            return this.activeEntities.get(actualInstanceId);
        }

        const entityDefinition = this.#registry.getEntityDefinition(definitionId);

        if (!entityDefinition) {
            this.#logger.error(`EntityManager.createEntityInstance: Entity definition not found in IDataRegistry for definition ID: ${definitionId}`);
            return null;
        }

        if (entityDefinition.components && typeof entityDefinition.components !== 'object') {
            this.#logger.warn(`EntityManager.createEntityInstance: Entity definition for ${definitionId} has an invalid 'components' field. Treating as no components.`);
            entityDefinition.components = {};
        } else if (!entityDefinition.components) {
            entityDefinition.components = {};
        }

        let entity;
        try {
            this.#logger.debug(`EntityManager.createEntityInstance: Creating new entity. Definition: ${definitionId}, Instance ID: ${actualInstanceId} (forceNew=${forceNew})`);
            entity = new Entity(actualInstanceId, definitionId);

            for (const [componentTypeId, componentData] of Object.entries(entityDefinition.components)) {
                const clonedData = JSON.parse(JSON.stringify(componentData));
                entity.addComponent(componentTypeId, clonedData);
            }
            this.#logger.debug(`EntityManager.createEntityInstance: Populated components for entity ${actualInstanceId} from definition ${definitionId}.`);

            if (!forceNew) {
                this.activeEntities.set(actualInstanceId, entity);
                this.#logger.debug(`EntityManager.createEntityInstance: Added new entity ${actualInstanceId} to activeEntities map.`);
            } else {
                this.#logger.debug(`EntityManager.createEntityInstance: Created entity ${actualInstanceId} (forceNew=true). Not added to activeEntities map.`);
            }

            const positionData = entity.getComponentData(POSITION_COMPONENT_ID);
            if (positionData) {
                const locationId = positionData.locationId;
                this.#spatialIndexManager.addEntity(actualInstanceId, locationId);
                if (typeof locationId === 'string' && locationId.trim() !== '') {
                    this.#logger.debug(`EntityManager.createEntityInstance: Added entity ${actualInstanceId} to spatial index at location ${locationId}.`);
                } else {
                    this.#logger.debug(`EntityManager.createEntityInstance: Entity ${actualInstanceId} has position component but invalid/null locationId (${locationId}). Not added to spatial index.`);
                }
            } else {
                this.#logger.debug(`EntityManager.createEntityInstance: Entity ${actualInstanceId} has no position component. Not added to spatial index.`);
            }

            this.#logger.info(`EntityManager.createEntityInstance: Successfully created instance ${actualInstanceId} (from definition ${definitionId}, forceNew=${forceNew}).`);
            return entity;

        } catch (error) {
            this.#logger.error(`EntityManager.createEntityInstance: Failed to create entity (Instance ID: ${actualInstanceId}, Definition ID: ${definitionId}, forceNew=${forceNew}):`, error);
            if (!forceNew && entity && this.activeEntities.get(actualInstanceId) === entity) {
                this.activeEntities.delete(actualInstanceId);
                this.#logger.debug(`EntityManager.createEntityInstance: Cleaned up entity ${actualInstanceId} from activeEntities due to creation error.`);
            }
            return null;
        }
    }

    // ... addComponent, removeComponent, getComponentData, hasComponent, getEntityInstance,
    // getEntitiesWithComponent, removeEntityInstance, reconstructEntity,
    // getEntitiesInLocation, buildInitialSpatialIndex, clearAll
    // remain the same as provided in the previous corrected version of EntityManager.js
    // (they already use instanceId correctly)
    // For brevity, I'm omitting them here, but they should be the versions from your last EntityManager update.
    // Make sure to paste them back in if you're copy-pasting this whole block.
    // The crucial change was only in createEntityInstance for the uuidv4() call.

    /**
     * Dynamically adds a component data object to an existing entity.
     * Validates the component data against its schema before adding.
     * Updates the spatial index if the position component is added or modified.
     * Component data is deep-cloned before being added to the entity.
     *
     * @param {string} instanceId - The ID (UUID) of the entity to modify.
     * @param {string} componentTypeId - The unique string ID of the component type to add (e.g., "core:health").
     * @param {object} componentData - The plain JavaScript object containing the component's data.
     * @returns {boolean} True if the component was successfully added, false otherwise.
     * @throws {Error} If the entity is not found, or if component data validation fails.
     */
    addComponent(instanceId, componentTypeId, componentData) { // instanceId is the entity's unique UUID
        const entity = this.activeEntities.get(instanceId);
        if (!entity) {
            const errMsg = `EntityManager.addComponent: Entity not found with ID: ${instanceId}`;
            this.#logger.error(errMsg);
            throw new Error(errMsg);
        }

        const validationResult = this.#validator.validate(componentTypeId, componentData);
        if (!validationResult.isValid) {
            const errorDetails = JSON.stringify(validationResult.errors, null, 2);
            const errMsg = `EntityManager.addComponent: Component data validation failed for type '${componentTypeId}' on entity '${instanceId}'. Errors:\n${errorDetails}`;
            this.#logger.error(errMsg);
            throw new Error(`EntityManager.addComponent: Component data validation failed for type '${componentTypeId}' on entity '${instanceId}'.`);
        }
        this.#logger.debug(`EntityManager.addComponent: Component data validation passed for type '${componentTypeId}' on entity '${instanceId}'.`);

        let oldLocationId = null;
        if (componentTypeId === POSITION_COMPONENT_ID) {
            const currentPositionData = entity.getComponentData(POSITION_COMPONENT_ID);
            oldLocationId = currentPositionData?.locationId;
            this.#logger.debug(`EntityManager.addComponent: Old location for entity ${instanceId} was ${oldLocationId ?? 'null/undefined'}.`);
        }

        try {
            const clonedData = JSON.parse(JSON.stringify(componentData));
            entity.addComponent(componentTypeId, clonedData);
            this.#logger.debug(`EntityManager.addComponent: Successfully added/updated component '${componentTypeId}' data on entity '${instanceId}'.`);
        } catch (error) {
            this.#logger.error(`EntityManager.addComponent: Error calling entity.addComponent for ${componentTypeId} on ${instanceId}:`, error);
            throw error;
        }

        if (componentTypeId === POSITION_COMPONENT_ID) {
            const newPositionData = entity.getComponentData(POSITION_COMPONENT_ID);
            const newLocationId = newPositionData?.locationId;
            this.#logger.debug(`EntityManager.addComponent: New location for entity ${instanceId} is ${newLocationId ?? 'null/undefined'}. Updating spatial index.`);
            this.#spatialIndexManager.updateEntityLocation(instanceId, oldLocationId, newLocationId);
        }
        return true;
    }

    removeComponent(instanceId, componentTypeId) {
        const entity = this.activeEntities.get(instanceId);
        if (!entity) {
            this.#logger.warn(`EntityManager.removeComponent: Entity not found with ID: ${instanceId}. Cannot remove component.`);
            return false;
        }

        let oldLocationId = null;
        if (componentTypeId === POSITION_COMPONENT_ID) {
            const currentPositionData = entity.getComponentData(POSITION_COMPONENT_ID);
            oldLocationId = currentPositionData?.locationId;
            this.#logger.debug(`EntityManager.removeComponent: Removing position component from entity ${instanceId}. Old location was ${oldLocationId ?? 'null/undefined'}.`);
        }

        const removed = entity.removeComponent(componentTypeId);

        if (removed) {
            this.#logger.debug(`EntityManager.removeComponent: Successfully removed component '${componentTypeId}' from entity '${instanceId}'.`);
            if (componentTypeId === POSITION_COMPONENT_ID) {
                this.#spatialIndexManager.removeEntity(instanceId, oldLocationId);
                this.#logger.debug(`EntityManager.removeComponent: Updated spatial index for entity ${instanceId} removal from location ${oldLocationId ?? 'null/undefined'}.`);
            }
        } else {
            this.#logger.debug(`EntityManager.removeComponent: Component '${componentTypeId}' not found on entity '${instanceId}'. Nothing removed.`);
        }
        return removed;
    }

    getComponentData(instanceId, componentTypeId) {
        const entity = this.activeEntities.get(instanceId);
        return entity?.getComponentData(componentTypeId);
    }

    hasComponent(instanceId, componentTypeId) {
        const entity = this.activeEntities.get(instanceId);
        return entity?.hasComponent(componentTypeId) || false;
    }

    getEntityInstance(instanceId) {
        return this.activeEntities.get(instanceId);
    }

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

    removeEntityInstance(instanceId) {
        const entity = this.activeEntities.get(instanceId);
        if (entity) {
            let oldLocationId = null;
            const positionData = entity.getComponentData(POSITION_COMPONENT_ID);
            oldLocationId = positionData?.locationId;

            if (oldLocationId) {
                this.#spatialIndexManager.removeEntity(instanceId, oldLocationId);
                this.#logger.debug(`EntityManager.removeEntityInstance: Removed entity ${instanceId} from spatial index (location: ${oldLocationId}).`);
            } else {
                this.#logger.debug(`EntityManager.removeEntityInstance: Entity ${instanceId} had no position or no valid locationId. No removal from spatial index needed.`);
            }

            const deleted = this.activeEntities.delete(instanceId);
            if (deleted) {
                this.#logger.info(`EntityManager.removeEntityInstance: Removed entity instance ${instanceId} from active map.`);
            }
            return deleted;
        }
        this.#logger.warn(`EntityManager.removeEntityInstance: Attempted to remove non-existent entity instance ${instanceId}`);
        return false;
    }

    reconstructEntity(savedEntityData) {
        this.#logger.debug(`EntityManager.reconstructEntity: Starting reconstruction for entity instanceId: ${savedEntityData?.instanceId}`);

        if (!savedEntityData || typeof savedEntityData !== 'object' ||
            typeof savedEntityData.instanceId !== 'string' || !savedEntityData.instanceId ||
            typeof savedEntityData.definitionId !== 'string' || !savedEntityData.definitionId) {
            const errorMsg = "Invalid savedEntityData for reconstruction. Must include instanceId (string) and definitionId (string).";
            this.#logger.error(`EntityManager.reconstructEntity: ${errorMsg} Received: ${JSON.stringify(savedEntityData)}`);
            return null;
        }

        const {instanceId, definitionId, components} = savedEntityData;

        if (this.activeEntities.has(instanceId)) {
            this.#logger.warn(`EntityManager.reconstructEntity: Entity with instanceId ${instanceId} already exists. Returning existing.`);
            return this.activeEntities.get(instanceId);
        }

        let entity;
        try {
            entity = new Entity(instanceId, definitionId);
        } catch (e) {
            this.#logger.error(`EntityManager.reconstructEntity: Failed to instantiate Entity for instanceId ${instanceId}, definitionId ${definitionId}: ${e.message}`, e);
            return null;
        }

        this.activeEntities.set(entity.id, entity);
        this.#logger.debug(`EntityManager.reconstructEntity: Created and added entity ${entity.id} (Def: ${entity.definitionId}) to activeEntities.`);

        if (components && typeof components === 'object') {
            this.#logger.debug(`EntityManager.reconstructEntity: Reconstructing components for entity ${entity.id}.`);
            for (const [componentTypeId, componentData] of Object.entries(components)) {
                if (typeof componentData !== 'object' || componentData === null) {
                    this.#logger.warn(`EntityManager.reconstructEntity: Invalid componentData for ${componentTypeId} on ${entity.id}. Skipping. Data: ${JSON.stringify(componentData)}`);
                    continue;
                }
                const clonedComponentData = JSON.parse(JSON.stringify(componentData));

                try {
                    this.addComponent(entity.id, componentTypeId, clonedComponentData);
                    this.#logger.debug(`EntityManager.reconstructEntity: Added/Validated component ${componentTypeId} to entity ${entity.id}.`);
                } catch (compError) {
                    this.#logger.error(`EntityManager.reconstructEntity: Failed to add component ${componentTypeId} to ${entity.id}. Error: ${compError.message}. Skipping.`, compError);
                }
            }
        } else if (components !== undefined) {
            this.#logger.warn(`EntityManager.reconstructEntity: components for entity ${entity.id} is present but not an object. Components: ${JSON.stringify(components)}`);
        } else {
            this.#logger.debug(`EntityManager.reconstructEntity: No components for entity ${entity.id}.`);
        }

        this.#logger.info(`EntityManager.reconstructEntity: Successfully reconstructed entity ${entity.id} (Def ID: ${entity.definitionId}).`);
        return entity;
    }

    getEntitiesInLocation(locationId) {
        return this.#spatialIndexManager.getEntitiesInLocation(locationId);
    }

    buildInitialSpatialIndex() {
        this.#logger.info('EntityManager: Delegating initial spatial index build...');
        this.#spatialIndexManager.buildIndex(this);
    }

    clearAll() {
        this.activeEntities.clear();
        this.#spatialIndexManager.clearIndex();
        this.#logger.info('EntityManager: Cleared all active entities and delegated spatial index clearing.');
    }
}

export default EntityManager;