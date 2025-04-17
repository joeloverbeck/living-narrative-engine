// src/entities/entityManager.js

import Entity from "./entity.js";
import SpatialIndexManager from "../core/spatialIndexManager.js";
import {PositionComponent} from "../components/positionComponent.js";
// **** Added Import ****
import DefinitionRefComponent from "../components/definitionRefComponent.js";

/**
 * Manages the creation and tracking of Entity instances from data definitions.
 * It uses a registry to map JSON component names to JavaScript component classes.
 * Component classes must be manually registered after instantiation.
 * It also maintains a spatial index for efficient location queries.
 */
class EntityManager {
    /**
     * @param {import('../core/dataManager.js').default} dataManager - The loaded data manager instance.
     */
    constructor(dataManager) {
        if (!dataManager) {
            throw new Error("EntityManager requires a DataManager instance.");
        }
        this.dataManager = dataManager;
        /** @type {Map<string, Function>} */
        this.componentRegistry = new Map();
        /** @type {Map<string, Entity>} */
        this.activeEntities = new Map();

        /** @type {SpatialIndexManager} */
        this.spatialIndexManager = new SpatialIndexManager(); // Instantiate the index manager

        console.log("EntityManager initialized. Components need manual registration. Spatial index ready.");
    }

    /**
     * Manually registers a component class with its corresponding JSON key.
     * This MUST be called externally (e.g., in main.js) for each component type.
     * @param {string} jsonKey - The key used for this component in the JSON definitions (e.g., "Health").
     * @param {Function} componentClass - The component class constructor (e.g., HealthComponent imported from its file).
     */
    registerComponent(jsonKey, componentClass) {
        if (typeof jsonKey !== 'string' || !jsonKey) {
            throw new Error("Invalid jsonKey provided for component registration.");
        }
        if (typeof componentClass !== 'function' || !componentClass.prototype) {
            console.error(`Invalid componentClass provided for jsonKey "${jsonKey}":`, componentClass);
            throw new Error(`Invalid componentClass provided for jsonKey "${jsonKey}". Expected a class constructor.`);
        }
        if (this.componentRegistry.has(jsonKey)) {
            console.warn(`Component registry already has key "${jsonKey}". Overwriting with ${componentClass.name}.`);
        }
        this.componentRegistry.set(jsonKey, componentClass);
        console.log(`Registered component: JSON key "${jsonKey}" -> Class ${componentClass.name}`);
    }

    /**
     * Creates a new Entity instance based on its definition ID.
     * Retrieves the definition from DataManager, instantiates the Entity,
     * finds corresponding Component classes from the registry,
     * instantiates components with data, and attaches them to the Entity.
     *
     * **Crucially, it now also automatically adds a DefinitionRefComponent.**
     *
     * Updates the spatial index if the new entity has a PositionComponent.
     *
     * Optionally stores the instance in an internal map.
     * If an instance for the ID already exists in the active map (and forceNew is false),
     * it returns the existing instance without creating a new one.
     *
     * @param {string} entityId - The unique ID of the entity definition to instantiate.
     * @param {boolean} [forceNew=false] - If true, always creates a new instance even if one exists in activeEntities.
     * @returns {Entity | null} The created or existing Entity instance, or null if definition not found or instantiation fails.
     */
    createEntityInstance(entityId, forceNew = false) {
        if (!forceNew && this.activeEntities.has(entityId)) {
            // Return existing instance if found and not forcing new
            return this.activeEntities.get(entityId);
        }

        const entityDefinition = this.dataManager.getEntityDefinition(entityId);

        if (!entityDefinition) {
            console.error(`EntityManager: Entity definition not found for ID: ${entityId}`);
            return null;
        }

        // Basic validation of components object from definition
        if (entityDefinition.components && typeof entityDefinition.components !== 'object') {
            console.warn(`EntityManager: Entity definition for ${entityId} has an invalid 'components' field (must be an object). Treating as no components.`);
            entityDefinition.components = null; // Ensure it's null or empty object if invalid
        }

        try {
            // Note: The Entity constructor uses the definition ID (entityId) as the instance ID here.
            // This might need review if multiple simultaneous instances of the same definition require unique IDs.
            const entity = new Entity(entityId);

            // Instantiate and add components specified in the JSON definition
            if (entityDefinition.components) {
                for (const jsonKey in entityDefinition.components) {
                    const componentData = entityDefinition.components[jsonKey];
                    const ComponentClass = this.componentRegistry.get(jsonKey);

                    if (ComponentClass) {
                        try {
                            // Basic validation that we retrieved a class constructor
                            if (typeof ComponentClass !== 'function' || !ComponentClass.prototype) {
                                throw new Error(`Registry entry for "${jsonKey}" is not a valid class/constructor.`);
                            }
                            // Instantiate the component with its data
                            const componentInstance = new ComponentClass(componentData);
                            entity.addComponent(componentInstance);
                        } catch (compError) {
                            console.error(`EntityManager: Error instantiating component ${jsonKey} (Class: ${ComponentClass ? ComponentClass.name : 'N/A'}) for entity ${entityId}:`, compError);
                            throw compError; // Re-throw to halt entity creation on component error
                        }
                    } else {
                        console.warn(`EntityManager: No registered component class found for JSON key "${jsonKey}" in entity ${entityId}. Skipping component.`);
                    }
                }
            } // <<< End of processing definition components

            // Add DefinitionRefComponent *only if one doesn't already exist*.
            // In this context, entityId often serves as the definition ID used for lookup.
            if (!entity.getComponent(DefinitionRefComponent)) {
                // Only add if the component is missing after processing definition/initial components
                entity.addComponent(new DefinitionRefComponent(entityId));
                // Optional: Log this default addition for clarity during debugging
                // console.log(`EntityManager: Added default DefinitionRefComponent(${entityId}) to entity ${entity.id}`);
            }

            // Add to active entities map *before* adding to spatial index
            // Uses definition ID as the key for the active map.
            if (!forceNew) {
                this.activeEntities.set(entityId, entity);
            }

            // ---- Spatial Index Update ----
            // Add the entity to the spatial index if it has a position.
            const positionComp = entity.getComponent(PositionComponent);
            if (positionComp && positionComp.locationId) {
                // Uses definition ID (entityId) as the key for the spatial index entry.
                this.spatialIndexManager.addEntity(entityId, positionComp.locationId);
            }
            // ---- End Spatial Index Update ----

            console.log(`Successfully created instance for entity ${entityId}`);
            return entity; // Return the fully constructed entity

        } catch (error) {
            console.error(`EntityManager: Failed to create entity instance for ID ${entityId}:`, error);
            // Clean up if partially added to activeEntities map in case of error during component creation
            if (!forceNew && this.activeEntities.has(entityId)) {
                this.activeEntities.delete(entityId);
            }
            return null; // Return null on failure
        }
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
     * Removes an entity instance from the active map AND the spatial index.
     * @param {string} entityId
     * @returns {boolean} True if the entity was found and removed, false otherwise.
     */
    removeEntityInstance(entityId) {
        const entity = this.activeEntities.get(entityId);
        if (entity) {
            // ---- Spatial Index Update ----
            const positionComp = entity.getComponent(PositionComponent);
            if (positionComp && positionComp.locationId) {
                this.spatialIndexManager.removeEntity(entityId, positionComp.locationId);
            }
            // ---- End Spatial Index Update ----

            const deleted = this.activeEntities.delete(entityId);
            if (deleted) {
                console.log(`EntityManager: Removed entity instance ${entityId}`);
            }
            return deleted;
        }
        console.warn(`EntityManager: Attempted to remove non-existent entity instance ${entityId}`);
        return false;
    }

    // --- Methods for Spatial Index ---

    /**
     * Retrieves all entity IDs present in a specific location using the spatial index.
     * @param {string} locationId - The location ID to query.
     * @returns {Set<string>} A *copy* of the Set of entity IDs in the location, or an empty Set.
     */
    getEntitiesInLocation(locationId) {
        return this.spatialIndexManager.getEntitiesInLocation(locationId);
    }

    /**
     * Notifies the EntityManager (and SpatialIndexManager) that an entity's
     * position (specifically its locationId) has changed.
     * This MUST be called by any system that modifies PositionComponent.locationId.
     * @param {string} entityId - The ID of the entity that moved.
     * @param {string | null | undefined} oldLocationId - The entity's previous location ID.
     * @param {string | null | undefined} newLocationId - The entity's new location ID.
     */
    notifyPositionChange(entityId, oldLocationId, newLocationId) {
        // Basic validation
        const entity = this.activeEntities.get(entityId);
        if (!entity) {
            console.warn(`EntityManager.notifyPositionChange: Entity ${entityId} not found in active entities. Cannot update spatial index.`);
            return;
        }
        const currentPos = entity.getComponent(PositionComponent);
        if (!currentPos || currentPos.locationId !== newLocationId) {
            // Log discrepancy but trust reported values for the update
            console.warn(`EntityManager.notifyPositionChange: Discrepancy for entity ${entityId}. Reported new location ${newLocationId} but component has ${currentPos?.locationId}. Updating index based on reported values.`);
        }

        this.spatialIndexManager.updateEntityLocation(entityId, oldLocationId, newLocationId);
    }

    /**
     * Builds the spatial index based on the current state of active entities.
     * Should be called after initial entity loading/creation.
     */
    buildInitialSpatialIndex() {
        this.spatialIndexManager.buildIndex(this);
    }

    /**
     * Clears all active entities and the spatial index.
     * Useful for restarting or loading a new game state.
     */
    clearAll() {
        this.activeEntities.clear();
        this.spatialIndexManager.clearIndex();
        console.log("EntityManager: Cleared all active entities and spatial index.");
    }

    // --- End Spatial Index Methods ---
}

export default EntityManager;