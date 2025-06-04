// src/entities/entityManager.js
// --- FILE START ---

import { v4 as uuidv4 } from 'uuid'; // Import the UUID library
import Entity from './entity.js';
import {
  ACTOR_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
} from '../constants/componentIds.js';
import { IEntityManager } from '../interfaces/IEntityManager.js';

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/** @typedef {import('../interfaces/coreServices.js').ISpatialIndexManager} ISpatialIndexManager */
/** @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult */

class EntityManager extends IEntityManager {
  #registry;
  #validator;
  #logger;
  #spatialIndexManager; // Will still be used, but addEntity calls will be more controlled
  activeEntities = new Map(); // Map<instanceId, Entity>

  /**
   * @private
   * @description Maps a definitionId to its primarily created instanceId.
   * This is crucial for resolving definition-based references during initialization.
   * Assumes that for a given definitionId, there's one "main" or "first" instance
   * if multiple are ever created from the same definition (though often, locations are unique).
   * @type {Map<string, string>}
   */
  #definitionToPrimaryInstanceMap;

  constructor(registry, validator, logger, spatialIndexManager) {
    super();
    if (!registry || typeof registry.getEntityDefinition !== 'function') {
      throw new Error(
        'EntityManager requires a valid IDataRegistry instance with getEntityDefinition.'
      );
    }
    if (!validator || typeof validator.validate !== 'function') {
      throw new Error(
        'EntityManager requires a valid ISchemaValidator instance with validate.'
      );
    }
    if (
      !logger ||
      typeof logger.info !== 'function' ||
      typeof logger.error !== 'function' ||
      typeof logger.warn !== 'function' ||
      typeof logger.debug !== 'function'
    ) {
      throw new Error(
        'EntityManager requires a valid ILogger instance with info, error, warn, and debug methods.'
      );
    }
    if (
      !spatialIndexManager ||
      typeof spatialIndexManager.addEntity !== 'function' ||
      typeof spatialIndexManager.removeEntity !== 'function' ||
      typeof spatialIndexManager.updateEntityLocation !== 'function'
    ) {
      throw new Error(
        'EntityManager requires a valid ISpatialIndexManager instance.'
      );
    }

    this.#registry = registry;
    this.#validator = validator;
    this.#logger = logger;
    this.#spatialIndexManager = spatialIndexManager;
    this.#definitionToPrimaryInstanceMap = new Map(); // Initialize the new map

    this.#logger.info(
      'EntityManager initialized with required services (IDataRegistry, ISchemaValidator, ILogger, ISpatialIndexManager).'
    );
  }

  /**
   * Creates a new Entity instance based on its definition ID, assigning it a unique instance ID.
   * Retrieves the *pre-validated* definition from IDataRegistry, instantiates the Entity,
   * copies component *data* (deep-cloned), and registers the definition-to-instance mapping.
   * Spatial indexing is *deferred* and handled by the WorldInitializer after references are resolved.
   * @param {string} definitionId - The unique ID of the entity definition to instantiate (e.g., "isekai:hero").
   * @param {string | null} [instanceId] - Optional. The unique instance ID (UUID) for this entity.
   * If not provided (or null), a new UUID will be generated.
   * @param {boolean} [forceNew] - If true and an entity with the given `instanceId` already exists,
   * this method will still create and return a new instance, but this
   * new instance will NOT be added to/replace the one in `activeEntities` or `definitionToPrimaryInstanceMap`.
   * Use with caution.
   * @returns {Entity | null} The created Entity instance. Returns existing if `forceNew` is false and ID exists.
   * Null if definition not found or instantiation fails.
   */
  createEntityInstance(definitionId, instanceId = null, forceNew = false) {
    if (typeof definitionId !== 'string' || !definitionId) {
      this.#logger.error(
        `EntityManager.createEntityInstance: Invalid definitionId provided: ${definitionId}`
      );
      return null;
    }

    const actualInstanceId = instanceId || uuidv4();

    if (typeof actualInstanceId !== 'string' || !actualInstanceId) {
      this.#logger.error(
        `EntityManager.createEntityInstance: Failed to establish a valid instanceId for definition ${definitionId}. Provided instanceId: ${instanceId}`
      );
      return null;
    }

    if (!forceNew && this.activeEntities.has(actualInstanceId)) {
      this.#logger.debug(
        `EntityManager.createEntityInstance: Returning existing instance for ID: ${actualInstanceId} (Def: ${definitionId})`
      );
      return this.activeEntities.get(actualInstanceId);
    }

    const entityDefinition = this.#registry.getEntityDefinition(definitionId);

    if (!entityDefinition) {
      this.#logger.error(
        `EntityManager.createEntityInstance: Entity definition not found for ID: ${definitionId}`
      );
      return null;
    }

    entityDefinition.components =
      entityDefinition.components &&
      typeof entityDefinition.components === 'object'
        ? entityDefinition.components
        : {};

    let entity;
    try {
      this.#logger.debug(
        `EntityManager.createEntityInstance: Creating new entity. Definition: ${definitionId}, Instance ID: ${actualInstanceId} (forceNew=${forceNew})`
      );
      entity = new Entity(actualInstanceId, definitionId);

      for (const [componentTypeId, componentData] of Object.entries(
        entityDefinition.components
      )) {
        // IMPORTANT: At this stage, componentData.locationId (if present) is still a definitionId.
        // Resolution will happen in WorldInitializer's second pass.
        const clonedData = JSON.parse(JSON.stringify(componentData));
        entity.addComponent(componentTypeId, clonedData);
      }
      this.#logger.debug(
        `EntityManager.createEntityInstance: Populated components for entity ${actualInstanceId} from definition ${definitionId}.`
      );

      // ------------------------------------------------------------------
      // Inject default short-term memory for actors (core:actor)
      // ------------------------------------------------------------------
      if (
        entity.hasComponent(ACTOR_COMPONENT_ID) &&
        !entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)
      ) {
        const defaultStm = { thoughts: [], maxEntries: 10 };

        entity.addComponent(SHORT_TERM_MEMORY_COMPONENT_ID, defaultStm);
        this.#logger.debug(
          `EntityManager.createEntityInstance: Added default short_term_memory to actor entity ${actualInstanceId}.`
        );
      }

      if (!forceNew) {
        this.activeEntities.set(actualInstanceId, entity);
        // Map the definitionId to this new instanceId.
        if (!this.#definitionToPrimaryInstanceMap.has(definitionId)) {
          this.#definitionToPrimaryInstanceMap.set(
            definitionId,
            actualInstanceId
          );
          this.#logger.debug(
            `EntityManager.createEntityInstance: Mapped definitionId '${definitionId}' to primary instanceId '${actualInstanceId}'.`
          );
        } else {
          this.#logger.debug(
            `EntityManager.createEntityInstance: DefinitionId '${definitionId}' already mapped to an instance. Not overwriting primary map.`
          );
        }
      }

      this.#logger.info(
        `EntityManager.createEntityInstance: Successfully created instance ${actualInstanceId} (from definition ${definitionId}, forceNew=${forceNew}). Spatial indexing deferred.`
      );
      return entity;
    } catch (error) {
      this.#logger.error(
        `EntityManager.createEntityInstance: Failed to create entity (Instance ID: ${actualInstanceId}, Definition ID: ${definitionId}, forceNew=${forceNew}):`,
        error
      );
      if (
        !forceNew &&
        entity &&
        this.activeEntities.get(actualInstanceId) === entity
      ) {
        this.activeEntities.delete(actualInstanceId);
        if (
          this.#definitionToPrimaryInstanceMap.get(definitionId) ===
          actualInstanceId
        ) {
          this.#definitionToPrimaryInstanceMap.delete(definitionId);
        }
      }
      return null;
    }
  }

  /**
   * Retrieves the primary entity instance associated with a given definition ID.
   * "Primary" usually means the first one non-forced-new instance created and mapped.
   * @param {string} definitionId - The definition ID to look up.
   * @returns {Entity | undefined} The entity instance, or undefined if no instance is mapped to this definition ID.
   */
  getPrimaryInstanceByDefinitionId(definitionId) {
    const instanceId = this.#definitionToPrimaryInstanceMap.get(definitionId);
    if (instanceId) {
      return this.activeEntities.get(instanceId);
    }
    this.#logger.debug(
      `EntityManager.getPrimaryInstanceByDefinitionId: No primary instance found for definitionId '${definitionId}'.`
    );
    return undefined;
  }

  /**
   * Retrieves an entity instance by its unique runtime instance ID.
   * @param {string} instanceId - The UUID of the entity instance.
   * @returns {Entity | undefined} The entity instance if found, otherwise undefined.
   */
  getEntityInstance(instanceId) {
    return this.activeEntities.get(instanceId);
  }

  /**
   * Dynamically adds a component data object to an existing entity.
   * Validates the component data against its schema before adding.
   * Updates the spatial index if the position component is added or modified.
   * Component data is deep-cloned before being added to the entity.
   * @param {string} instanceId - The ID (UUID) of the entity to modify.
   * @param {string} componentTypeId - The unique string ID of the component type to add (e.g., "core:health").
   * @param {object} componentData - The plain JavaScript object containing the component's data.
   * @returns {boolean} True if the component was successfully added, false otherwise.
   * @throws {Error} If the entity is not found, or if component data validation fails.
   */
  addComponent(instanceId, componentTypeId, componentData) {
    // instanceId is the entity's unique UUID
    const entity = this.activeEntities.get(instanceId);
    if (!entity) {
      const errMsg = `EntityManager.addComponent: Entity not found with ID: ${instanceId}`;
      this.#logger.error(errMsg);
      throw new Error(errMsg);
    }

    const validationResult = this.#validator.validate(
      componentTypeId,
      componentData
    );
    if (!validationResult.isValid) {
      const errorDetails = JSON.stringify(validationResult.errors, null, 2);
      const errMsg = `EntityManager.addComponent: Component data validation failed for type '${componentTypeId}' on entity '${instanceId}'. Errors:\n${errorDetails}`;
      this.#logger.error(errMsg);
      throw new Error(
        `EntityManager.addComponent: Component data validation failed for type '${componentTypeId}' on entity '${instanceId}'.`
      );
    }
    this.#logger.debug(
      `EntityManager.addComponent: Component data validation passed for type '${componentTypeId}' on entity '${instanceId}'.`
    );

    let oldLocationId = null; // This will be an instanceId if already resolved, or a defId
    if (componentTypeId === POSITION_COMPONENT_ID) {
      const currentPositionData = entity.getComponentData(
        POSITION_COMPONENT_ID
      );
      oldLocationId = currentPositionData?.locationId;
      this.#logger.debug(
        `EntityManager.addComponent: Old location for entity ${instanceId} was ${oldLocationId ?? 'null/undefined'}.`
      );
    }

    try {
      const clonedData = JSON.parse(JSON.stringify(componentData));
      // If adding/modifying a position component, its locationId should be an INSTANCE ID of the location.
      // The caller of addComponent (e.g., an action system) is responsible for ensuring this.
      // The initial world loading resolution is handled by WorldInitializer.
      entity.addComponent(componentTypeId, clonedData);
      this.#logger.debug(
        `EntityManager.addComponent: Successfully added/updated component '${componentTypeId}' data on entity '${instanceId}'.`
      );
    } catch (error) {
      this.#logger.error(
        `EntityManager.addComponent: Error calling entity.addComponent for ${componentTypeId} on ${instanceId}:`,
        error
      );
      throw error; // Re-throw to allow calling systems to handle it
    }

    if (componentTypeId === POSITION_COMPONENT_ID) {
      const newPositionData = entity.getComponentData(POSITION_COMPONENT_ID);
      const newLocationId = newPositionData?.locationId; // Should be an instanceId
      this.#logger.debug(
        `EntityManager.addComponent: New location for entity ${instanceId} is ${newLocationId ?? 'null/undefined'}. Updating spatial index.`
      );
      // Ensure newLocationId is actually an instance ID here for spatial index consistency.
      // If it's a definition ID, the spatial index will be keyed incorrectly.
      if (
        newLocationId &&
        !this.activeEntities.has(newLocationId) &&
        newLocationId.includes(':')
      ) {
        this.#logger.warn(
          `EntityManager.addComponent: Position component for entity ${instanceId} updated with a locationId '${newLocationId}' that appears to be a definitionId and not a known instanceId. Spatial index might be affected.`
        );
      }
      this.#spatialIndexManager.updateEntityLocation(
        instanceId,
        oldLocationId,
        newLocationId
      );
    }
    return true;
  }

  removeComponent(instanceId, componentTypeId) {
    const entity = this.activeEntities.get(instanceId);
    if (!entity) {
      this.#logger.warn(
        `EntityManager.removeComponent: Entity not found with ID: ${instanceId}. Cannot remove component.`
      );
      return false;
    }

    let oldLocationId = null;
    if (componentTypeId === POSITION_COMPONENT_ID) {
      const currentPositionData = entity.getComponentData(
        POSITION_COMPONENT_ID
      );
      oldLocationId = currentPositionData?.locationId; // This should be an instanceId
      this.#logger.debug(
        `EntityManager.removeComponent: Removing position component from entity ${instanceId}. Old location was ${oldLocationId ?? 'null/undefined'}.`
      );
    }

    const removed = entity.removeComponent(componentTypeId);

    if (removed) {
      this.#logger.debug(
        `EntityManager.removeComponent: Successfully removed component '${componentTypeId}' from entity '${instanceId}'.`
      );
      if (componentTypeId === POSITION_COMPONENT_ID) {
        // oldLocationId should be an instanceId here
        this.#spatialIndexManager.removeEntity(instanceId, oldLocationId);
        this.#logger.debug(
          `EntityManager.removeComponent: Updated spatial index for entity ${instanceId} removal from location ${oldLocationId ?? 'null/undefined'}.`
        );
      }
    } else {
      this.#logger.debug(
        `EntityManager.removeComponent: Component '${componentTypeId}' not found on entity '${instanceId}'. Nothing removed.`
      );
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

  getEntitiesWithComponent(componentTypeId) {
    if (typeof componentTypeId !== 'string' || !componentTypeId) {
      this.#logger.debug(
        `EntityManager.getEntitiesWithComponent: Received invalid componentTypeId (${componentTypeId}). Returning empty array.`
      );
      return [];
    }
    const matchingEntities = [];
    for (const entity of this.activeEntities.values()) {
      if (entity.hasComponent(componentTypeId)) {
        matchingEntities.push(entity);
      }
    }
    this.#logger.debug(
      `EntityManager.getEntitiesWithComponent: Found ${matchingEntities.length} entities with component '${componentTypeId}'.`
    );
    return matchingEntities;
  }

  removeEntityInstance(instanceId) {
    const entity = this.activeEntities.get(instanceId);
    if (entity) {
      let oldLocationId = null;
      const positionData = entity.getComponentData(POSITION_COMPONENT_ID);
      if (positionData) {
        oldLocationId = positionData.locationId; // Should be an instanceId
      }

      if (oldLocationId) {
        // oldLocationId here is the instanceId of the location
        this.#spatialIndexManager.removeEntity(instanceId, oldLocationId);
        this.#logger.debug(
          `EntityManager.removeEntityInstance: Removed entity ${instanceId} from spatial index (location instanceId: ${oldLocationId}).`
        );
      } else {
        this.#logger.debug(
          `EntityManager.removeEntityInstance: Entity ${instanceId} had no position or no valid locationId. No removal from spatial index needed.`
        );
      }

      const deletedFromActive = this.activeEntities.delete(instanceId);

      // Also remove from definition map if this was the primary instance for its definition
      if (
        this.#definitionToPrimaryInstanceMap.get(entity.definitionId) ===
        instanceId
      ) {
        this.#definitionToPrimaryInstanceMap.delete(entity.definitionId);
        this.#logger.debug(
          `EntityManager.removeEntityInstance: Removed entity ${instanceId} from definitionToPrimaryInstanceMap as it was primary for ${entity.definitionId}.`
        );
      }

      if (deletedFromActive) {
        this.#logger.info(
          `EntityManager.removeEntityInstance: Removed entity instance ${instanceId} from active map.`
        );
      }
      return deletedFromActive;
    }
    this.#logger.warn(
      `EntityManager.removeEntityInstance: Attempted to remove non-existent entity instance ${instanceId}`
    );
    return false;
  }

  reconstructEntity(savedEntityData) {
    this.#logger.debug(
      `EntityManager.reconstructEntity: Starting reconstruction for entity instanceId: ${savedEntityData?.instanceId}`
    );

    if (
      !savedEntityData ||
      typeof savedEntityData !== 'object' ||
      typeof savedEntityData.instanceId !== 'string' ||
      !savedEntityData.instanceId ||
      typeof savedEntityData.definitionId !== 'string' ||
      !savedEntityData.definitionId
    ) {
      const errorMsg =
        'Invalid savedEntityData for reconstruction. Must include instanceId (string) and definitionId (string).';
      this.#logger.error(
        `EntityManager.reconstructEntity: ${errorMsg} Received: ${JSON.stringify(savedEntityData)}`
      );
      return null;
    }

    const { instanceId, definitionId, components } = savedEntityData;

    if (this.activeEntities.has(instanceId)) {
      this.#logger.warn(
        `EntityManager.reconstructEntity: Entity with instanceId ${instanceId} already exists. Returning existing.`
      );
      return this.activeEntities.get(instanceId);
    }

    let entity;
    try {
      entity = new Entity(instanceId, definitionId); // Uses the saved instanceId
    } catch (e) {
      this.#logger.error(
        `EntityManager.reconstructEntity: Failed to instantiate Entity for instanceId ${instanceId}, definitionId ${definitionId}: ${e.message}`,
        e
      );
      return null;
    }

    this.activeEntities.set(entity.id, entity);
    // If reconstructing, also update the definition map if this isn't already mapped or if we want to ensure it points here.
    // This logic might depend on how saved games interact with newly generated worlds.
    // For simplicity, let's say if it's not mapped, map it.
    if (!this.#definitionToPrimaryInstanceMap.has(definitionId)) {
      this.#definitionToPrimaryInstanceMap.set(definitionId, instanceId);
      this.#logger.debug(
        `EntityManager.reconstructEntity: Mapped definitionId '${definitionId}' to reconstructed instanceId '${instanceId}'.`
      );
    }
    this.#logger.debug(
      `EntityManager.reconstructEntity: Created and added entity ${entity.id} (Def: ${entity.definitionId}) to activeEntities.`
    );

    if (components && typeof components === 'object') {
      this.#logger.debug(
        `EntityManager.reconstructEntity: Reconstructing components for entity ${entity.id}.`
      );
      for (const [componentTypeId, componentData] of Object.entries(
        components
      )) {
        if (typeof componentData !== 'object' || componentData === null) {
          this.#logger.warn(
            `EntityManager.reconstructEntity: Invalid componentData for ${componentTypeId} on ${entity.id}. Skipping. Data: ${JSON.stringify(componentData)}`
          );
          continue;
        }
        // IMPORTANT: For saved games, componentData.locationId SHOULD ALREADY BE AN INSTANCE ID.
        // No resolution needed here, assuming saves are self-contained with instance IDs.
        const clonedComponentData = JSON.parse(JSON.stringify(componentData));

        try {
          // Using this.addComponent directly will trigger validation & spatial index updates if it's a pos component
          this.addComponent(entity.id, componentTypeId, clonedComponentData);
          this.#logger.debug(
            `EntityManager.reconstructEntity: Added/Validated component ${componentTypeId} to entity ${entity.id}.`
          );
        } catch (compError) {
          this.#logger.error(
            `EntityManager.reconstructEntity: Failed to add component ${componentTypeId} to ${entity.id} during reconstruction. Error: ${compError.message}. Skipping.`,
            compError
          );
        }
      }
    } else if (components !== undefined) {
      this.#logger.warn(
        `EntityManager.reconstructEntity: components for entity ${entity.id} is present but not an object. Components: ${JSON.stringify(components)}`
      );
    } else {
      this.#logger.debug(
        `EntityManager.reconstructEntity: No components for entity ${entity.id}.`
      );
    }

    // Note: Spatial index for reconstructed entities is handled by the addComponent call if it's a position.
    // If an entity is reconstructed without a position initially, then position added later, addComponent handles it.
    // If it's reconstructed WITH a position, addComponent also handles it.

    this.#logger.info(
      `EntityManager.reconstructEntity: Successfully reconstructed entity ${entity.id} (Def ID: ${entity.definitionId}).`
    );
    return entity;
  }

  getEntitiesInLocation(locationInstanceId) {
    // Parameter renamed for clarity
    // This should always be called with an INSTANCE ID of a location.
    if (
      locationInstanceId &&
      !this.activeEntities.has(locationInstanceId) &&
      locationInstanceId.includes(':')
    ) {
      this.#logger.warn(
        `EntityManager.getEntitiesInLocation: Called with what appears to be a definitionId '${locationInstanceId}'. Spatial index expects location instanceIds.`
      );
    }
    return this.#spatialIndexManager.getEntitiesInLocation(locationInstanceId);
  }

  clearAll() {
    this.activeEntities.clear();
    this.#definitionToPrimaryInstanceMap.clear(); // Clear the new map as well
    this.#spatialIndexManager.clearIndex();
    this.#logger.info(
      'EntityManager: Cleared all active entities, definition map, and delegated spatial index clearing.'
    );
  }
}

export default EntityManager;
// --- FILE END ---
