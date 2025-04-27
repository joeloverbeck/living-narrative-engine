// src/entities/entityManager.js

import Entity from './entity.js';
import {POSITION_COMPONENT_ID} from '../types/components.js';

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
 */
class EntityManager {
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
    // AC: Constructor accepts IDataRegistry, ISchemaValidator, ILogger, ISpatialIndexManager.
    if (!registry || typeof registry.getEntityDefinition !== 'function') { // Check specific method needed
      throw new Error('EntityManager requires a valid IDataRegistry instance with getEntityDefinition.');
    }
    if (!validator || typeof validator.validate !== 'function') {
      throw new Error('EntityManager requires a valid ISchemaValidator instance with validate.');
    }
    if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function' || typeof logger.warn !== 'function') {
      throw new Error('EntityManager requires a valid ILogger instance.');
    }
    if (!spatialIndexManager || typeof spatialIndexManager.addEntity !== 'function' || typeof spatialIndexManager.removeEntity !== 'function' || typeof spatialIndexManager.updateEntityLocation !== 'function') {
      throw new Error('EntityManager requires a valid ISpatialIndexManager instance.');
    }

    this.#registry = registry;
    this.#validator = validator;
    this.#logger = logger;
    this.#spatialIndexManager = spatialIndexManager;
    // Removed componentRegistry initialization
    // Removed GameDataRepository dependency (replaced by IDataRegistry)

    this.#logger.info('EntityManager initialized with required services (IDataRegistry, ISchemaValidator, ILogger, ISpatialIndexManager).');
  }

  // REMOVED: registerComponent method is deleted as per AC 3.

  /**
     * Creates a new Entity instance based on its definition ID.
     * Retrieves the *pre-validated* definition from IDataRegistry, instantiates the Entity,
     * copies the component *data* (plain objects) from the definition to the entity instance,
     * and updates the spatial index if a valid position component is present.
     *
     * @param {string} entityId - The unique ID of the entity definition to instantiate (also used as the instance ID).
     * @param {boolean} [forceNew=false] - If true, always creates a new instance even if one exists in activeEntities.
     * @returns {Entity | null} The created or existing Entity instance, or null if definition not found or instantiation fails.
     * @implements {AC 4}
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

    // AC: Retrieve validated entity definition from IDataRegistry
    const entityDefinition = this.#registry.getEntityDefinition(entityId);

    if (!entityDefinition) {
      this.#logger.error(`EntityManager.createEntityInstance: Entity definition not found in IDataRegistry for ID: ${entityId}`);
      return null;
    }

    if (entityDefinition.components && typeof entityDefinition.components !== 'object') {
      this.#logger.warn(`EntityManager.createEntityInstance: Entity definition for ${entityId} has an invalid 'components' field (must be an object). Treating as no components.`);
      entityDefinition.components = {}; // Ensure it's an empty object if invalid
    } else if (!entityDefinition.components) {
      entityDefinition.components = {}; // Ensure components object exists
    }

    try {
      this.#logger.debug(`EntityManager.createEntityInstance: Creating new entity instance for ID: ${entityId}`);
      // AC: Create new Entity(entityId) instance
      const entity = new Entity(entityId);

      // AC: Populate entity's components Map by copying data (no class instantiation)
      for (const [componentTypeId, componentData] of Object.entries(entityDefinition.components)) {
        // Data is assumed pre-validated.
        // Directly add the data object to the entity.
        // Consider cloning here if entityDefinition data might be mutated elsewhere, though typically registry data is treated as immutable.
        // const clonedData = JSON.parse(JSON.stringify(componentData)); // Optional deep clone
        entity.addComponent(componentTypeId, componentData); // Use entity's method
      }
      this.#logger.debug(`EntityManager.createEntityInstance: Populated components for entity ${entityId} from definition.`);

      // AC: Handle forceNew and activeEntities map
      // Add to active entities map *before* adding to spatial index
      if (!forceNew) {
        this.activeEntities.set(entityId, entity);
        this.#logger.debug(`EntityManager.createEntityInstance: Added entity ${entityId} to activeEntities map.`);
      }

      // AC: Spatial Index Update
      // Check for position component *after* all components are added
      const positionData = entity.getComponentData(POSITION_COMPONENT_ID);
      if (positionData) {
        const locationId = positionData.locationId;
        // SpatialIndexManager.addEntity handles the check for valid string internally
        this.#spatialIndexManager.addEntity(entityId, locationId);
        if (typeof locationId === 'string' && locationId.trim() !== '') {
          this.#logger.debug(`EntityManager.createEntityInstance: Added entity ${entityId} to spatial index at location ${locationId}.`);
        } else {
          this.#logger.debug(`EntityManager.createEntityInstance: Entity ${entityId} has position component but invalid/null locationId (${locationId}). Not added to spatial index.`);
        }
      } else {
        this.#logger.debug(`EntityManager.createEntityInstance: Entity ${entityId} has no position component. Not added to spatial index.`);
      }

      this.#logger.info(`EntityManager.createEntityInstance: Successfully created instance for entity ${entityId}`);
      return entity;

    } catch (error) {
      this.#logger.error(`EntityManager.createEntityInstance: Failed to create entity instance for ID ${entityId}:`, error);
      // Clean up if partially added to activeEntities map
      if (!forceNew && this.activeEntities.has(entityId)) {
        this.activeEntities.delete(entityId);
      }
      return null;
    }
  }

  /**
     * Dynamically adds a component data object to an existing entity.
     * Validates the component data against its schema before adding.
     * Updates the spatial index if the position component is added or modified.
     *
     * @param {string} entityId - The ID of the entity to modify.
     * @param {string} componentTypeId - The unique string ID of the component type to add (e.g., "core:health").
     * @param {object} componentData - The plain JavaScript object containing the component's data.
     * @returns {boolean} True if the component was successfully added, false otherwise.
     * @throws {Error} If the entity is not found, or if component data validation fails.
     * @implements {AC 5}
     */
  addComponent(entityId, componentTypeId, componentData) {
    // AC: Retrieve entity instance
    const entity = this.activeEntities.get(entityId);
    if (!entity) {
      this.#logger.error(`EntityManager.addComponent: Entity not found with ID: ${entityId}`);
      throw new Error(`EntityManager.addComponent: Entity not found with ID: ${entityId}`);
      // return false; // Or throw? Ticket says throw on failure.
    }

    // AC: Validate Data using ISchemaValidator.validate
    const validationResult = this.#validator.validate(componentTypeId, componentData);
    if (!validationResult.isValid) {
      // AC: On Validation Failure: Throws descriptive error
      const errorDetails = JSON.stringify(validationResult.errors, null, 2);
      this.#logger.error(`EntityManager.addComponent: Component data validation failed for type '${componentTypeId}' on entity '${entityId}'. Errors:\n${errorDetails}`);
      throw new Error(`EntityManager.addComponent: Component data validation failed for type '${componentTypeId}' on entity '${entityId}'.`);
      // return false;
    }
    this.#logger.debug(`EntityManager.addComponent: Component data validation passed for type '${componentTypeId}' on entity '${entityId}'.`);

    let oldLocationId = null; // Variable to store location before change
    // AC: Retrieve Old State (for Spatial Index)
    if (componentTypeId === POSITION_COMPONENT_ID) {
      const currentPositionData = entity.getComponentData(POSITION_COMPONENT_ID);
      oldLocationId = currentPositionData?.locationId; // Will be undefined if no component or no locationId prop
      this.#logger.debug(`EntityManager.addComponent: Old location for entity ${entityId} was ${oldLocationId ?? 'null/undefined'}.`);
    }

    // AC: Call entity's addComponent method (consider cloning)
    try {
      // Simple deep clone for plain objects to prevent external mutation issues [cite: 155, 156]
      const clonedData = JSON.parse(JSON.stringify(componentData));
      entity.addComponent(componentTypeId, clonedData);
      this.#logger.debug(`EntityManager.addComponent: Successfully added/updated component '${componentTypeId}' data on entity '${entityId}'.`);
    } catch (error) {
      this.#logger.error(`EntityManager.addComponent: Error calling entity.addComponent for ${componentTypeId} on ${entityId}:`, error);
      // Depending on Entity.addComponent's potential errors, might re-throw or return false
      throw error; // Re-throw entity-level errors
    }


    // AC: Trigger Side Effects (Spatial Index)
    if (componentTypeId === POSITION_COMPONENT_ID) {
      const newPositionData = entity.getComponentData(POSITION_COMPONENT_ID); // Get the data that was *just* added
      const newLocationId = newPositionData?.locationId; // Could still be null/undefined in the new data
      this.#logger.debug(`EntityManager.addComponent: New location for entity ${entityId} is ${newLocationId ?? 'null/undefined'}. Updating spatial index.`);
      // SpatialIndexManager handles logic based on old/new being valid strings or null/undefined
      this.#spatialIndexManager.updateEntityLocation(entityId, oldLocationId, newLocationId);
    }

    // Other side effects (e.g., event dispatching) would go here

    return true; // Indicate success
  }

  /**
     * Removes a component data object from an existing entity.
     * Updates the spatial index if the position component is removed.
     *
     * @param {string} entityId - The ID of the entity to modify.
     * @param {string} componentTypeId - The unique string ID of the component type to remove.
     * @returns {boolean} True if the component was found and removed, false otherwise.
     * @implements {AC 6}
     */
  removeComponent(entityId, componentTypeId) {
    // AC: Retrieve entity instance
    const entity = this.activeEntities.get(entityId);
    if (!entity) {
      this.#logger.warn(`EntityManager.removeComponent: Entity not found with ID: ${entityId}. Cannot remove component.`);
      return false;
    }

    let oldLocationId = null;
    // AC: Retrieve Old State (for Spatial Index) *before* removing
    if (componentTypeId === POSITION_COMPONENT_ID) {
      const currentPositionData = entity.getComponentData(POSITION_COMPONENT_ID);
      oldLocationId = currentPositionData?.locationId;
      this.#logger.debug(`EntityManager.removeComponent: Removing position component from entity ${entityId}. Old location was ${oldLocationId ?? 'null/undefined'}.`);
    }

    // AC: Call entity's removeComponent method
    const removed = entity.removeComponent(componentTypeId);

    if (removed) {
      this.#logger.debug(`EntityManager.removeComponent: Successfully removed component '${componentTypeId}' from entity '${entityId}'.`);
      // AC: Trigger Side Effects (Spatial Index)
      if (componentTypeId === POSITION_COMPONENT_ID) {
        // Pass the retrieved oldLocationId. SpatialIndexManager handles if it was null/invalid.
        this.#spatialIndexManager.removeEntity(entityId, oldLocationId);
        this.#logger.debug(`EntityManager.removeComponent: Updated spatial index for entity ${entityId} removal from location ${oldLocationId ?? 'null/undefined'}.`);
      }
      // Other side effects here
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
     * @implements {AC 7}
     */
  getComponentData(entityId, componentTypeId) {
    const entity = this.activeEntities.get(entityId);
    if (!entity) {
      // this.#logger.warn(`EntityManager.getComponentData: Entity not found with ID: ${entityId}`); // Can be noisy
      return undefined;
    }
    // AC: Delegates directly to entity.getComponentData
    return entity.getComponentData(componentTypeId);
  }

  /**
     * Checks if an entity has data associated with a specific component type ID.
     * Delegates directly to the Entity instance.
     *
     * @param {string} entityId - The ID of the entity.
     * @param {string} componentTypeId - The unique string ID of the component type.
     * @returns {boolean} True if the entity has the component data, false otherwise.
     * @implements {AC 8}
     */
  hasComponent(entityId, componentTypeId) {
    const entity = this.activeEntities.get(entityId);
    if (!entity) {
      // this.#logger.warn(`EntityManager.hasComponent: Entity not found with ID: ${entityId}`); // Can be noisy
      return false;
    }
    // AC: Delegates directly to entity.hasComponent
    return entity.hasComponent(componentTypeId);
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
     * Removes an entity instance entirely from the active map AND the spatial index.
     * @param {string} entityId
     * @returns {boolean} True if the entity was found and removed, false otherwise.
     */
  removeEntityInstance(entityId) {
    const entity = this.activeEntities.get(entityId);
    if (entity) {
      // Determine location *before* removing from active map
      let oldLocationId = null;
      const positionData = entity.getComponentData(POSITION_COMPONENT_ID);
      oldLocationId = positionData?.locationId;

      // Remove from spatial index first
      if (oldLocationId) {
        this.#spatialIndexManager.removeEntity(entityId, oldLocationId);
        this.#logger.debug(`EntityManager.removeEntityInstance: Removed entity ${entityId} from spatial index (location: ${oldLocationId}).`);
      }

      // Then remove from active map
      const deleted = this.activeEntities.delete(entityId);
      if (deleted) {
        this.#logger.info(`EntityManager.removeEntityInstance: Removed entity instance ${entityId} from active map.`);
      }
      // Trigger other cleanup events/side-effects for entity removal if needed
      return deleted;
    }
    this.#logger.warn(`EntityManager.removeEntityInstance: Attempted to remove non-existent entity instance ${entityId}`);
    return false;
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

  // REMOVED: notifyPositionChange - Logic now handled within addComponent/removeComponent

  /**
     * Builds the spatial index based on the current state of active entities.
     * Delegates to the spatial index manager.
     */
  buildInitialSpatialIndex() {
    this.#logger.info('EntityManager: Delegating initial spatial index build...');
    // Pass 'this' (the EntityManager instance) which has the activeEntities map
    this.#spatialIndexManager.buildIndex(this);
  }

  /**
     * Clears all active entities and the spatial index.
     * Useful for restarting or loading a new game state.
     */
  clearAll() {
    this.activeEntities.clear();
    this.#spatialIndexManager.clearIndex(); // Delegate clearing
    this.#logger.info('EntityManager: Cleared all active entities and delegated spatial index clearing.');
  }
}

export default EntityManager;