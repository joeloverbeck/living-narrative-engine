// src/entities/entityManager.js

import Entity from "./entity.js";
import {EntitiesPresentComponent} from '../components/entitiesPresentComponent.js';

/**
 * Manages the creation of Entity instances from data definitions.
 * It uses a registry to map JSON component names to JavaScript component classes.
 * Component classes must be manually registered after instantiation.
 */
class EntityManager {
    /**
     * @param {import('../../dataManager.js').default} dataManager - The loaded data manager instance.
     */
    constructor(dataManager) {
        if (!dataManager) {
            throw new Error("EntityManager requires a DataManager instance.");
        }
        this.dataManager = dataManager;
        /** @type {Map<string, Function>} */
        this.componentRegistry = new Map(); // Map JSON component key -> Component Class
        /** @type {Map<string, Entity>} */
        this.activeEntities = new Map(); // Optional: Store created instances

        // REMOVED the call to registerCoreComponents()
        console.log("EntityManager initialized. Components need manual registration.");
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
        // Basic check if it's a class/function
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
            // console.log(`Returning existing instance for entity ID: ${entityId}`); // Keep this less verbose unless debugging
            return this.activeEntities.get(entityId);
        }

        // console.log(`Attempting to create instance for entity ID: ${entityId}`); // Keep this less verbose
        const entityDefinition = this.dataManager.getEntityDefinition(entityId);

        if (!entityDefinition) {
            console.error(`EntityManager: Entity definition not found for ID: ${entityId}`);
            return null;
        }

        if (!entityDefinition.components || typeof entityDefinition.components !== 'object') {
            console.warn(`EntityManager: Entity definition for ${entityId} has no 'components' object. Creating entity without components.`);
            // Allow creating entities without components if needed, adjust if this should be an error
            // return null; // Uncomment if entity MUST have components
        }


        try {
            const entity = new Entity(entityId);

            // Instantiate and add components only if the components object exists
            if (entityDefinition.components) {
                for (const jsonKey in entityDefinition.components) {
                    const componentData = entityDefinition.components[jsonKey];
                    const ComponentClass = this.componentRegistry.get(jsonKey);

                    if (ComponentClass) {
                        try {
                            if (typeof ComponentClass !== 'function' || !ComponentClass.prototype) {
                                throw new Error(`Registry entry for "${jsonKey}" is not a valid class/constructor.`);
                            }
                            const componentInstance = new ComponentClass(componentData);
                            entity.addComponent(componentInstance);
                        } catch (compError) {
                            console.error(`EntityManager: Error instantiating component ${jsonKey} (Class: ${ComponentClass ? ComponentClass.name : 'N/A'}) for entity ${entityId}:`, compError);
                            throw compError; // Re-throw to halt creation on component error
                        }
                    } else {
                        console.warn(`EntityManager: No registered component class found for JSON key "${jsonKey}" in entity ${entityId}. Skipping component.`);
                    }
                }
            }


            console.log(`Successfully created instance for entity ${entityId}`); // Log creation
            if (!forceNew) {
                this.activeEntities.set(entityId, entity); // Store the new instance
            }
            return entity;

        } catch (error) {
            console.error(`EntityManager: Failed to create entity instance for ID ${entityId}:`, error);
            return null;
        }
    }

    /**
     * Ensures that all entities listed in a location's EntitiesPresentComponent
     * are instantiated (or already exist) in the EntityManager.
     * This is typically called when the player enters a new location.
     * @param {Entity} locationEntity - The location entity instance.
     */
    ensureLocationEntitiesInstantiated(locationEntity) {
        if (!locationEntity || !(locationEntity instanceof Entity)) {
            console.warn("EntityManager.ensureLocationEntitiesInstantiated: Received invalid locationEntity.");
            return;
        }

        const presentComp = locationEntity.getComponent(EntitiesPresentComponent);

        if (presentComp && Array.isArray(presentComp.entityIds)) {
            console.log(`EntityManager: Ensuring entities present in ${locationEntity.id} are instantiated.`);
            presentComp.entityIds.forEach(entityId => {
                if (typeof entityId !== 'string' || !entityId) {
                    console.warn(`EntityManager: Invalid entity ID found in EntitiesPresentComponent of ${locationEntity.id}:`, entityId);
                    return; // Skip invalid entries
                }
                // Call createEntityInstance - it handles checking if instance already exists
                // and logs errors internally if definition is missing/invalid.
                const instance = this.createEntityInstance(entityId);
                if (!instance) {
                    // Error is already logged by createEntityInstance, maybe add context?
                    console.warn(`EntityManager: Failed to ensure instance for entity ID '${entityId}' listed in location '${locationEntity.id}'. See previous error.`);
                }
                // No need to log success here, createEntityInstance already does if it creates a new one.
            });
        } else {
            // console.debug(`EntityManager: Location ${locationEntity.id} has no EntitiesPresentComponent or empty list. No entities to ensure.`); // Optional debug log
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
     * Removes an entity instance from the active map.
     * @param {string} entityId
     * @returns {boolean}
     */
    removeEntityInstance(entityId) {
        return this.activeEntities.delete(entityId);
    }
}

export default EntityManager;