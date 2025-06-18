// src/entities/entityManager.js
// -----------------------------------------------------------------------------
//  Living Narrative Engine – EntityManager
// -----------------------------------------------------------------------------
//  @description
//  Centralised factory and runtime registry for all Entity instances. Handles
//  validation of component payloads, automatic injection of required defaults
//  (e.g. `core:short_term_memory`, `core:notes`, `core:goals`) and co-ordination
//  with the spatial-index service.
//
//  @module EntityManager
//  @since   0.3.0
// -----------------------------------------------------------------------------

import { v4 as uuidv4 } from 'uuid';
import { cloneDeep } from 'lodash';
import Entity from './entity.js';
import EntityDefinition from './EntityDefinition.js';
import EntityInstanceData from './EntityInstanceData.js';
import MapManager from '../utils/mapManagerUtils.js';
import {
  ACTOR_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  NOTES_COMPONENT_ID,
  GOALS_COMPONENT_ID,
} from '../constants/componentIds.js';
import { IEntityManager } from '../interfaces/IEntityManager.js';
import { validateDependency } from '../utils/validationUtils.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';

/* -------------------------------------------------------------------------- */
/* Type-Hint Imports (JSDoc only – removed at runtime)                        */
/* -------------------------------------------------------------------------- */

/** @typedef {import('../interfaces/coreServices.js').IDataRegistry}        IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator}     ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').ILogger}              ILogger */
/** @typedef {import('../interfaces/ISpatialIndexManager.js').ISpatialIndexManager} ISpatialIndexManager */
/** @typedef {import('../interfaces/coreServices.js').ValidationResult}     ValidationResult */

/* -------------------------------------------------------------------------- */
/* Internal Utilities                                                         */

/* -------------------------------------------------------------------------- */

/**
 * Normalize any validator return shape to a simple `true | false`.
 *
 * Legacy validators may return `undefined`, `null`, or a bare boolean. Newer
 * validators should return `{ isValid: boolean, errors?: any }`.
 *
 * @private
 * @param {undefined|null|boolean|ValidationResult} rawResult
 * @returns {boolean}
 */
function validationSucceeded(rawResult) {
  if (rawResult === undefined || rawResult === null) return true;
  if (typeof rawResult === 'boolean') return rawResult;
  return !!rawResult.isValid;
}

/**
 * Convert a validation result into a readable string for logs.
 *
 * @private
 * @param {ValidationResult|boolean|undefined|null} rawResult
 * @returns {string}
 */
function formatValidationErrors(rawResult) {
  if (rawResult && typeof rawResult === 'object' && rawResult.errors) {
    return JSON.stringify(rawResult.errors, null, 2);
  }
  return '(validator returned false)';
}

// assertInterface removed; using validateDependency instead

/* -------------------------------------------------------------------------- */
/* EntityManager Implementation                                               */

/* -------------------------------------------------------------------------- */

/**
 * @class EntityManager
 * @augments {IEntityManager}
 * @description
 * Runtime manager responsible for:
 *  • Instantiating entities from definitions
 *  • Validating and mutating component payloads
 *  • Injecting engine-level default components (STM, notes, and goals)
 *  • Tracking active entities and their primary instances
 *  • Propagating position changes to the spatial index
 */
class EntityManager extends IEntityManager {
  /** @type {IDataRegistry}  @private */ #registry;
  /** @type {ISchemaValidator} @private */ #validator;
  /** @type {ILogger} @private */ #logger;
  /** @type {ISpatialIndexManager} @private */ #spatialIndexManager;

  /** @type {MapManager} @private */ #mapManager;

  /** @type {Map<string, EntityDefinition>} @private */
  #definitionCache;

  /** @type {Map<string, Entity>} */
  activeEntities;

  /** @type {Map<string, string>}  @private */
  #definitionToPrimaryInstanceMap;

  /**
   * @class
   * @param {IDataRegistry}        registry
   * @param {ISchemaValidator}     validator
   * @param {ILogger}              logger
   * @param {ISpatialIndexManager} spatialIndexManager
   * @throws {Error} If any dependency is missing or malformed.
   */
  constructor(registry, validator, logger, spatialIndexManager) {
    super();

    /* ---------- dependency checks ---------- */
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = ensureValidLogger(logger, 'EntityManager');

    validateDependency(registry, 'IDataRegistry', this.#logger, {
      requiredMethods: ['getEntityDefinition'],
    });
    validateDependency(validator, 'ISchemaValidator', this.#logger, {
      requiredMethods: ['validate'],
    });
    validateDependency(
      spatialIndexManager,
      'ISpatialIndexManager',
      this.#logger,
      {
        requiredMethods: [
          'addEntity',
          'removeEntity',
          'updateEntityLocation',
          'clearIndex',
        ],
      }
    );

    this.#registry = registry;
    this.#validator = validator;
    this.#spatialIndexManager = spatialIndexManager;
    this.#definitionToPrimaryInstanceMap = new Map();
    this.#mapManager = new MapManager({ throwOnInvalidId: false });
    this.activeEntities = this.#mapManager.items;
    this.#definitionCache = new Map();

    this.#logger.debug('EntityManager initialised.');
  }

  /**
   * Retrieve an entity by ID or throw an Error if missing.
   *
   * @private
   * @param {string} instanceId
   * @returns {Entity}
   */
  #getEntityOrThrow(instanceId) {
    const entity = this.#mapManager.get(instanceId);
    if (!entity) {
      const msg = `EntityManager: Entity not found with ID: ${instanceId}`;
      this.#logger.error(msg);
      throw new Error(msg);
    }
    return entity;
  }

  /**
   * Validate component data and return a deep clone.
   *
   * @private
   * @param {string} componentTypeId
   * @param {object} data
   * @param {string} errorContext
   * @returns {object} The validated (and potentially cloned/modified by validator) data.
   */
  #validateAndClone(componentTypeId, data, errorContext) {
    const clone = cloneDeep(data);
    const result = this.#validator.validate(componentTypeId, clone);
    if (!validationSucceeded(result)) {
      const details = formatValidationErrors(result);
      const msg = `${errorContext} Errors:\n${details}`;
      this.#logger.error(msg);
      throw new Error(msg);
    }
    return clone;
  }

  /**
   * Inject default components required by the engine (STM, notes, and goals).
   * This method will now receive an Entity object and operate on its overrides if needed.
   *
   * @private
   * @param {Entity} entity - The entity instance to modify.
   */
  #injectDefaultComponents(entity) {
    // If it's an actor, handle STM and Notes injection
    if (entity.hasComponent(ACTOR_COMPONENT_ID)) {
      // Inject STM if missing
      if (!entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)) {
        this.#logger.debug(
          `Injecting STM for ${entity.id} (def: ${entity.definitionId})`
        );
        const stmData = { thoughts: [], maxEntries: 10 };
        const validatedStmData = this.#validateAndClone(
          SHORT_TERM_MEMORY_COMPONENT_ID,
          stmData,
          `Default STM component injection for entity ${entity.id}`
        );
        entity.addComponent(SHORT_TERM_MEMORY_COMPONENT_ID, validatedStmData);
      }

      // Inject Notes if missing (now actor-dependent)
      if (!entity.hasComponent(NOTES_COMPONENT_ID)) {
        this.#logger.debug(
          `Injecting Notes for ${entity.id} (def: ${entity.definitionId})`
        );
        const notesData = { notes: [] };
        const validatedNotesData = this.#validateAndClone(
          NOTES_COMPONENT_ID,
          notesData,
          `Default Notes component injection for entity ${entity.id}`
        );
        entity.addComponent(NOTES_COMPONENT_ID, validatedNotesData);
      }

      // Inject Goals if missing (actor-dependent)
      if (!entity.hasComponent(GOALS_COMPONENT_ID)) {
        this.#logger.debug(
          `Injecting Goals for ${entity.id} (def: ${entity.definitionId})`
        );
        const goalsData = { goals: [] }; // Default goals
        const validatedGoalsData = this.#validateAndClone(
          GOALS_COMPONENT_ID,
          goalsData,
          `Default Goals component injection for entity ${entity.id}`
        );
        entity.addComponent(GOALS_COMPONENT_ID, validatedGoalsData);
      }
    }
    // Placeholder for goal injection logic if it becomes a default component
    // if (!entity.hasComponent(GOAL_COMPONENT_ID)) { ... }
  }

  /**
   * Track a newly created entity if not a forced clone.
   *
   * @private
   * @param {Entity} entity
   * @param {string} definitionId
   * @param {string} instanceId
   * @param {boolean} isCurrentlyForceNew - True if this specific creation call was a forceNew.
   * @param {boolean} isReconstruction - True if this is part of a reconstruction.
   */
  #_trackEntity(entity, definitionId, instanceId, isCurrentlyForceNew, isReconstruction) {
    this.#mapManager.add(instanceId, entity);

    // If it's a forceNew, it becomes the primary.
    // If it's a reconstruction, it also becomes primary IF no other primary exists for that definition
    // (covers case where game is loaded and reconstructed entities become the primaries).
    // Otherwise (normal creation), it becomes primary only if no primary exists yet for that def.
    const currentPrimary = this.#definitionToPrimaryInstanceMap.get(definitionId);
    let shouldSetAsPrimary = false;

    if (isCurrentlyForceNew) {
      shouldSetAsPrimary = true;
    } else if (isReconstruction) {
      if (!currentPrimary) {
        shouldSetAsPrimary = true;
      }
    } else { // Standard creation
      if (!currentPrimary) {
        shouldSetAsPrimary = true;
      }
    }

    if (shouldSetAsPrimary) {
      this.#definitionToPrimaryInstanceMap.set(definitionId, instanceId);
      this.#logger.debug(
        `Set ${instanceId} as primary for definition ${definitionId} (forceNew: ${isCurrentlyForceNew}, recon: ${isReconstruction})`
      );
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Entity Creation                                                         */

  /* ---------------------------------------------------------------------- */

  /**
   * Gets or creates an EntityDefinition.
   * @private
   * @param {string} definitionId
   * @returns {EntityDefinition}
   * @throws {Error} If definitionId is invalid or definition data cannot be fetched/parsed.
   */
  #getOrCreateEntityDefinition(definitionId) {
    if (this.#definitionCache.has(definitionId)) {
      return this.#definitionCache.get(definitionId);
    }

    this.#logger.debug(`Definition ${definitionId} not in cache. Fetching...`);
    const rawDefinitionData = this.#registry.getEntityDefinition(definitionId);
    if (!rawDefinitionData) {
      const msg = `Entity definition not found for ID: ${definitionId}`;
      this.#logger.error(msg);
      throw new Error(msg);
    }

    try {
      // The EntityDefinition constructor will deep-freeze its components.
      const definition = new EntityDefinition(definitionId, rawDefinitionData);
      this.#definitionCache.set(definitionId, definition);
      this.#logger.info(`Cached new entity definition: ${definitionId}`);
      return definition;
    } catch (error) {
      this.#logger.error(
        `Failed to create EntityDefinition for ${definitionId}: ${error.message}`
      );
      throw error; // Re-throw after logging
    }
  }

  /**
   * Create a new entity instance from a definition ID.
   * This method maintains backward compatibility with the older signature
   * `createEntityInstance(definitionId, instanceId = null, forceNew = false)`
   * while also supporting `createEntityInstance(definitionId, componentOverrides = {}, instanceId = null, forceNew = false)`.
   *
   * @param {string} definitionId - The ID of the entity definition (e.g., "core:player").
   * @param {Record<string, object> | string | null} [p2] - Either componentOverrides (object), instanceId (string/null), or undefined.
   * @param {string | boolean | null} [p3] - Either instanceId (string/null), forceNew (boolean), or undefined.
   * @param {boolean} [p4] - forceNew (boolean) or undefined.
   * @returns {Entity|null} The created entity instance, or null if creation failed.
   * @throws {Error} If definitionId is invalid or definition cannot be found/parsed.
   */
  createEntityInstance(definitionId, p2, p3, p4) {
    if (typeof definitionId !== 'string' || !definitionId.trim()) {
      this.#logger.error('EntityManager.createEntityInstance: Invalid definitionId provided.', { definitionId });
      throw new Error('Invalid definitionId');
    }

    let instanceId;
    let componentOverrides = {};
    let finalForceNew = false; // Default for the new signature path

    // --- Argument Parsing for Overloaded Signature ---
    if (typeof p2 === 'string') {
      instanceId = p2;
      finalForceNew = typeof p3 === 'boolean' ? p3 : false; 
    } else if (typeof p2 === 'boolean') {
      instanceId = uuidv4();
      finalForceNew = p2; 
    } else if (typeof p2 === 'object' && p2 !== null) {
      componentOverrides = p2;
      if (typeof p3 === 'string') {
        instanceId = p3;
        finalForceNew = typeof p4 === 'boolean' ? p4 : false;
      } else if (typeof p3 === 'boolean') { 
        instanceId = uuidv4();
        finalForceNew = p3;
      } else { 
        instanceId = uuidv4();
      }
    } else if (p2 === undefined && p3 === undefined && p4 === undefined) {
      instanceId = uuidv4();
    } else {
      this.#logger.error('EntityManager.createEntityInstance: Invalid arguments provided.', { definitionId, p2, p3, p4 });
      throw new Error('Invalid arguments for createEntityInstance');
    }

    // --- Definition Handling ---
    const definition = this.#getOrCreateEntityDefinition(definitionId);
    if (!definition) {
      this.#logger.error(
        `EntityManager.createEntityInstance: Entity definition not found for ID: ${definitionId}`
      );
      return null;
    }

    // --- MODIFIED SECTION for ForceNew Handling ---
    if (finalForceNew) {
      const currentPrimaryId = this.#definitionToPrimaryInstanceMap.get(definitionId);
      // If a primary exists AND its ID is different from the instanceId we might be about to use/create,
      // or if instanceId is about to be generated (meaning it will be different unless a very unlikely collision).
      // The key is to remove the *current* primary if forceNew is active for the definition.
      if (currentPrimaryId) { 
        this.#logger.debug(
          `ForceNew active for definition ${definitionId}. Removing existing primary instance ${currentPrimaryId} before creating new instance ${instanceId}.`
        );
        this.removeEntityInstance(currentPrimaryId); // This removes from mapManager, spatialIndex, and definitionToPrimaryInstanceMap.
      }
    }
    // --- End MODIFIED SECTION ---

    // --- Existing Entity & ForceNew Handling (for the *specific* instanceId being created) ---
    const existingEntity = this.#mapManager.get(instanceId);
    if (existingEntity) {
      if (finalForceNew) {
        // If we reached here and finalForceNew is true, it means currentPrimaryId (if it existed) was different from instanceId,
        // OR currentPrimaryId was the same as instanceId. In either case, if an entity with this *specific* instanceId still exists,
        // it needs to be removed because we are forcing a new one with this ID.
        this.#logger.debug(`ForceNew: Entity with target ID ${instanceId} exists. Removing it before creating new one.`);
        this.removeEntityInstance(instanceId); // Remove old one completely (handles all cleanup)
      } else {
        this.#logger.warn(
          `EntityManager.createEntityInstance: Entity with ID ${instanceId} already exists and forceNew is false. Returning existing.`
        );
        return existingEntity;
      }
    }
    
    // --- Create EntityInstanceData (Holds definition and overrides) ---
    const validatedInitialOverrides = {};
    if (componentOverrides) {
      for (const compId in componentOverrides) {
        const compData = componentOverrides[compId];
        if (compData === null) { // Allow null to signify removal/nullification
          validatedInitialOverrides[compId] = null;
        } else {
          try {
            validatedInitialOverrides[compId] = this.#validateAndClone(
              compId,
              compData,
              `Override component ${compId} for entity ${instanceId}`
            );
          } catch (error) {
            // Log already done in #validateAndClone, rethrow or handle if needed
            this.#logger.error(`Failed to validate override component ${compId} for entity ${instanceId} during creation. Error: ${error.message}`);
            throw error; // Propagate validation error
          }
        }
      }
    }

    const instanceData = new EntityInstanceData(instanceId, definition, validatedInitialOverrides);
    
    // --- Create Entity (Passes instanceData) ---
    const entity = new Entity(instanceData);

    // --- Default Component Injection (operates on the new entity's instanceData) ---
    this.#injectDefaultComponents(entity);

    // --- Final Validation of ALL Components ---
    // Ensure all components present on the entity after definition, overrides, and defaults are validated.
    for (const componentTypeId of entity.componentTypeIds) {
      const componentData = entity.getComponentData(componentTypeId);
      // We only attempt to validate if componentData is not undefined AND not null.
      // Null is a valid state for a component (nulled override) and should NOT be re-validated here.
      if (componentData !== undefined && componentData !== null) {
        try {
          // #validateAndClone uses the validator and returns cloned data.
          // The entity's components are already set (either from definition, validated overrides, or validated defaults).
          // This call is primarily for the validation side-effect for components sourced purely from definition.
          const validationContext = `Final validation for component ${componentTypeId} on entity ${entity.id}`;
          this.#validateAndClone(componentTypeId, componentData, validationContext);
        } catch (error) {
          this.#logger.error(`EntityManager.createEntityInstance: Final validation failed for component ${componentTypeId} on entity ${entity.id}. Error: ${error.message}`);
          // Propagate validation error to halt entity creation if any component is invalid.
          throw error;
        }
      }
    }

    // --- Tracking & Spatial Index ---
    this.#_trackEntity(entity, definition.id, instanceId, finalForceNew, false); // Pass finalForceNew as isCurrentlyForceNew

    const posComponent = entity.getComponentData(POSITION_COMPONENT_ID);
    if (posComponent && posComponent.locationId) {
      this.#spatialIndexManager.addEntity(
        instanceId,
        posComponent.locationId
      );
    }
    
    this.#logger.info(`Entity instance created: ${instanceId} (Def: ${definitionId})`);
    return entity;
  }

  /**
   * Reconstructs an entity from a previously serialized state.
   * NOTE: This implementation will need careful review and adaptation to the new
   * EntityDefinition/EntityInstanceData model. The serialized format might need to change.
   *
   * @param {object} serializedEntityData - The data to reconstruct from. Expected to have
   *                                        `definitionId`, `instanceId`, and `componentOverrides` (or similar).
   * @returns {Entity|null} The reconstructed entity, or null on failure.
   */
  reconstructEntity(serializedEntityData) {
    if (!serializedEntityData || !serializedEntityData.instanceId || !serializedEntityData.definitionId) {
      this.#logger.error('EntityManager.reconstructEntity: Invalid serialized data. instanceId and definitionId are required.', serializedEntityData);
      return null;
    }
    const { instanceId, definitionId } = serializedEntityData;

    if (this.#mapManager.has(instanceId)) {
      this.#logger.warn(`EntityManager.reconstructEntity: Entity with ID ${instanceId} already exists. Returning existing.`);
      return this.#mapManager.get(instanceId);
    }

    const definition = this.#getOrCreateEntityDefinition(definitionId);
    if (!definition) {
      this.#logger.error(`EntityManager.reconstructEntity: Failed to get/create definition ${definitionId} for ${instanceId}`);
      return null;
    }

    const validatedOverrides = {};
    if (serializedEntityData.overrides) {
      for (const compId in serializedEntityData.overrides) {
        const compData = serializedEntityData.overrides[compId];
        if (compData === null) {
          validatedOverrides[compId] = null;
        } else if (typeof compData === 'object' && compData !== null) { // Ensured compData is a non-null object
          try {
            validatedOverrides[compId] = this.#validateAndClone(
              compId,
              compData,
              `Reconstructed override component ${compId} for entity ${instanceId}`
            );
          } catch (error) {
            this.#logger.error(`EntityManager.reconstructEntity: Failed to validate reconstructed override component ${compId} for entity ${instanceId}. Error: ${error.message}. Entity reconstruction aborted.`);
            return null;
          }
        } else {
          // Log a warning if a non-object, non-null override is found during reconstruction, then skip.
          this.#logger.warn(`EntityManager.reconstructEntity: Invalid (non-object or null but not explicitly handled as null) override data for component ${compId} on entity ${instanceId}. Skipping override.`);
          // validatedOverrides[compId] remains undefined or not set.
        }
      }
    }
    
    const instanceData = new EntityInstanceData(instanceId, definition, validatedOverrides);
    const entity = new Entity(instanceData);

    try {
      this.#injectDefaultComponents(entity);
    } catch (error) {
      this.#logger.error(`EntityManager.reconstructEntity: Failed during default component injection for entity ${instanceId}. Error: ${error.message}. Entity reconstruction aborted.`);
      // Note: The entity isn't fully tracked in #mapManager etc. yet at this stage,
      // as #_trackEntity is called after #injectDefaultComponents.
      // If #_trackEntity were called before, we'd need to untrack here.
      return null;
    }
    this.#_trackEntity(entity, definition.id, instanceId, false, true); // isReconstruction = true

    const posComponent = entity.getComponentData(POSITION_COMPONENT_ID);
    if (posComponent && posComponent.locationId) {
      this.#spatialIndexManager.addEntity(instanceId, posComponent.locationId);
    }
    this.#logger.info(`Entity instance reconstructed: ${instanceId} (Def: ${definitionId})`);
    return entity;
  }

  /* ---------------------------------------------------------------------- */
  /* Component-level Mutations                                               */

  /* ---------------------------------------------------------------------- */

  /**
   * Adds or updates a component on an existing entity instance.
   *
   * @param {string} instanceId - The ID of the entity instance.
   * @param {string} componentTypeId - The unique ID of the component type.
   * @param {object} componentData - The data for the component.
   * @throws {Error} If entity not found, or component data is invalid.
   */
  addComponent(instanceId, componentTypeId, componentData) {
    const entity = this.#getEntityOrThrow(instanceId);

    if (!MapManager.isValidId(componentTypeId)) {
      const msg = `EntityManager.addComponent: Invalid componentTypeId: ${componentTypeId}`;
      this.#logger.error(msg);
      throw new Error(msg);
    }
    // Validate componentData: must be an object or null
    if (typeof componentData !== 'object' && componentData !== null) {
      const msg = `EntityManager.addComponent: componentData for ${componentTypeId} on ${instanceId} must be an object or null. Received: ${typeof componentData}`;
      this.#logger.error(msg, { componentData });
      throw new Error(msg);
    }

    let validatedData;
    if (componentData === null) {
      validatedData = null; // Explicitly nullifying the component
    } else {
      try {
        validatedData = this.#validateAndClone(
          componentTypeId,
          componentData,
          `addComponent ${componentTypeId} to entity ${instanceId}`
        );
      } catch (error) {
        // Error already logged by #validateAndClone, rethrow
        throw error;
      }
    }

    let oldLocationId;
    let newLocationId;

    if (componentTypeId === POSITION_COMPONENT_ID) {
      const currentPositionComponent = entity.getComponentData(POSITION_COMPONENT_ID);
      oldLocationId = currentPositionComponent ? currentPositionComponent.locationId : undefined;

      // Determine newLocationId from the data that will be applied
      if (validatedData && validatedData.hasOwnProperty('locationId')) {
        newLocationId = validatedData.locationId; // Can be string or null
      } else if (validatedData && typeof validatedData === 'object' && !validatedData.hasOwnProperty('locationId')) {
        // If locationId is not a property in validatedData (e.g., {x, y}), it's undefined for spatial purposes.
        newLocationId = undefined;
      } else if (validatedData === null) {
        // If the entire component is being nulled out.
        newLocationId = undefined;
      } else {
        // Default newLocationId if not determined (e.g. componentData was not an object, though validation should catch this)
        // Or if validatedData is not an object (e.g. if #validateAndClone could return non-object, though it shouldn't for valid schemas)
        newLocationId = undefined;
      }
    }

    const updateSucceeded = entity.addComponent(componentTypeId, validatedData);

    if (!updateSucceeded) {
      this.#logger.error(
        `EntityManager.addComponent: Failed to update component ${componentTypeId} on entity ${instanceId} via entity.addComponent. The entity's method returned false.`
      );
      // Depending on contract, could throw or return a more specific error/result.
      // For now, mirroring previous behavior of returning false from EM.addComponent if entity.addComponent fails.
      return false;
    }

    this.#logger.debug(
      `Successfully added/updated component '${componentTypeId}' data on entity '${instanceId}'.`
    );

    // Spatial Index Update Logic and Logging for POSITION_COMPONENT_ID
    if (componentTypeId === POSITION_COMPONENT_ID) {
      this.#spatialIndexManager.updateEntityLocation(instanceId, oldLocationId, newLocationId);

      // Detailed logging to match test expectations
      if (oldLocationId && typeof oldLocationId === 'string') {
        this.#logger.debug(`Old location for entity '${instanceId}' was '${oldLocationId}'.`);
      } else { // Handles undefined or null oldLocationId
        this.#logger.debug(`Old location for entity '${instanceId}' was null/undefined.`);
      }

      if (newLocationId && typeof newLocationId === 'string') {
        this.#logger.debug(`New location for entity '${instanceId}' is '${newLocationId}'.`);
      } else if (newLocationId === null) {
        this.#logger.debug(`New location for entity '${instanceId}' is null.`);
      } else { // newLocationId is undefined
        this.#logger.debug(`New location for entity '${instanceId}' is undefined.`);
      }
    }
    return true;
  }

  /**
   * Remove a component from an existing entity.
   * Effectively, this sets the component's data to `null` at the instance level,
   * which means `hasComponent` will return `false` for this instance regarding this component.
   *
   * @param {string} instanceId          – UUID of the target entity.
   * @param {string} componentTypeId     – Component type to remove.
   * @returns {boolean}                  – `true` if the component was present and then "removed" (nulled out), `false` otherwise.
   */
  removeComponent(instanceId, componentTypeId) {
    const entity = this.getEntityInstance(instanceId); // Use public getter, don't throw immediately

    if (!entity) {
      this.#logger.warn( // Changed from #getEntityOrThrow behavior
        `EntityManager.removeComponent: Entity not found with ID: ${instanceId}. Cannot remove component.`
      );
      return false;
    }

    if (!entity.hasComponent(componentTypeId)) {
      this.#logger.debug(
        `Component '${componentTypeId}' not found on entity '${instanceId}'. Nothing removed.`
      );
      return false;
    }

    // If removing the position component, update the spatial index by removing the entity from its old location.
    if (componentTypeId === POSITION_COMPONENT_ID) {
      const oldPositionData = entity.getComponentData(POSITION_COMPONENT_ID);
      const oldLocationId = oldPositionData?.locationId; // This can be undefined or null

      // Always attempt to remove from spatial index if it's a position component.
      // The spatial index manager should handle cases where oldLocationId is not specific.
      this.#spatialIndexManager.removeEntity(instanceId, oldLocationId);

      if (oldLocationId !== undefined && oldLocationId !== null) {
        this.#logger.debug(
          `EntityManager.removeComponent: Entity '${instanceId}' removed from old location '${oldLocationId}' in spatial index due to ${componentTypeId} removal.`
        );
      } else {
        this.#logger.debug(
          `EntityManager.removeComponent: Attempted removal of entity '${instanceId}' from spatial index (old location was undefined/null) due to ${componentTypeId} removal.`
        );
      }
    }

    // Remove the component override from the entity instance.
    const removed = entity.removeComponent(componentTypeId);

    if (removed) {
      this.#logger.debug(
        `EntityManager.removeComponent: Component override '${componentTypeId}' removed from entity '${instanceId}'.`
      );
    } else {
      // This case should ideally not be hit if hasComponent above was true and it was an override.
      // If hasComponent was true due to definition only, removeComponent on entity would return false.
      // This indicates the component was on the definition and not as an override, so no override was removed.
      this.#logger.debug(
        `EntityManager.removeComponent: Component '${componentTypeId}' on entity '${instanceId}' was not an override or could not be removed.`
      );
    }
    return removed; // Return the result of the entity's removeComponent operation.
  }

  /* ---------------------------------------------------------------------- */
  /* Query / Utility Methods                                                 */

  /* ---------------------------------------------------------------------- */

  getPrimaryInstanceByDefinitionId(definitionId) {
    const instanceId = this.#definitionToPrimaryInstanceMap.get(definitionId);
    if (!instanceId) {
      this.#logger.debug(
        `No primary instance found for definition ID: ${definitionId}`
      );
      return undefined;
    }
    return this.#mapManager.get(instanceId); // Return the Entity object
  }

  getEntityInstance(instanceId) {
    return this.#mapManager.get(instanceId);
  }

  getComponentData(instanceId, componentTypeId) {
    const entity = this.#getEntityOrThrow(instanceId);
    return entity.getComponentData(componentTypeId);
  }

  hasComponent(instanceId, componentTypeId) {
    const entity = this.#mapManager.get(instanceId); // Use get, not getEntityOrThrow
    return entity ? entity.hasComponent(componentTypeId) : false;
  }

  /**
   * Return **new array** of entities that possess `componentTypeId`.
   * Logs diagnostic info for engine analytics / debugging.
   *
   * @param {*} componentTypeId
   * @returns {Entity[]} fresh array (never a live reference)
   */
  getEntitiesWithComponent(componentTypeId) {
    if (componentTypeId === null || componentTypeId === undefined || typeof componentTypeId !== 'string' || componentTypeId.trim() === '') {
      this.#logger.debug(
        `EntityManager.getEntitiesWithComponent: Received invalid componentTypeId (${componentTypeId}). Returning empty array.`
      );
      return [];
    }

    const results = [];
    for (const entity of this.activeEntities.values()) {
      if (entity.hasComponent(componentTypeId)) {
        results.push(entity);
      }
    }
    this.#logger.debug(
      `EntityManager.getEntitiesWithComponent: Found ${results.length} entities with component '${componentTypeId}'.`
    );
    return results;
  }

  /**
   * Retrieve the set of entity IDs currently inside a location instance.
   *
   * @param {string} locationInstanceId – UUID of the location entity.
   * @returns {Set<string>}             – Set of contained entity IDs.
   */
  getEntitiesInLocation(locationInstanceId) {
    // This assumes locationInstanceId is an entity ID that acts as a location
    // You might need a more direct way to query the spatial index or locations
    return this.#spatialIndexManager.getEntitiesInLocation(locationInstanceId);
  }

  /**
   * Completely removes an entity instance from the manager and spatial index.
   * @param {string} instanceId The ID of the entity instance to remove.
   * @returns {boolean} True if the entity was found and removed, false otherwise.
   */
  removeEntityInstance(instanceId) {
    const entity = this.getEntityInstance(instanceId);

    if (!entity) {
      this.#logger.warn(
        // `EntityManager.removeEntityInstance: Entity not found with ID: ${instanceId}`
        `EntityManager.removeEntityInstance: Attempted to remove non-existent entity instance ${instanceId}.`
      );
      return false;
    }

    // Attempt to remove from spatial index if it has a valid position component and locationId
    const positionComponent = entity.getComponentData(POSITION_COMPONENT_ID);
    if (positionComponent && typeof positionComponent.locationId === 'string' && positionComponent.locationId.trim()) {
      const locationId = positionComponent.locationId.trim();
      this.#spatialIndexManager.removeEntity(instanceId, locationId);
      this.#logger.debug(
        `EntityManager.removeEntityInstance: Removed entity ${instanceId} from spatial index (old location was ${locationId}).`
      );
    } else {
      // Even if not in spatial index or locationId is invalid, still attempt a general removal call
      // to SpatialIndexManager in case it tracks entities by ID alone for some reason (e.g. entityLocations map)
      // ISpatialIndexManager.removeEntity can take (entityId, null) or (entityId, undefined)
      // This call will be a no-op if locationId is not valid, as per ISpatialIndexManager.removeEntity spec.
      // However, the tests for aux expect removeEntity NOT to be called if position is missing or locationId invalid.
      // So, we will only call it if the locationId was valid above.
      // If there was no valid locationId, we don't call this.#spatialIndexManager.removeEntity at all.
    }

    // Remove from active entities
    this.#mapManager.remove(instanceId);
    this.#logger.info(`Removed entity instance: ${instanceId}`);

    // Remove from primary instance map if it was a primary
    const definitionId = entity.definitionId;
    if (this.#definitionToPrimaryInstanceMap.get(definitionId) === instanceId) {
      this.#definitionToPrimaryInstanceMap.delete(definitionId);
      this.#logger.debug(
        `Removed ${instanceId} as primary for definition ${definitionId}. Checking for new primary...`
      );
      // Try to find a new primary: iterate over active entities.
      // This is potentially slow but removeEntityInstance is not a high-frequency operation.
      let newPrimaryAssigned = false;
      for (const activeEntity of this.#mapManager.values()) {
        if (activeEntity.definitionId === definitionId) {
          this.#definitionToPrimaryInstanceMap.set(definitionId, activeEntity.id);
          this.#logger.info(
            `Assigned ${activeEntity.id} as new primary for definition ${definitionId} after removal of ${instanceId}.`
          );
          newPrimaryAssigned = true;
          break;
        }
      }
      if (!newPrimaryAssigned) {
        this.#logger.info(`No other instances of ${definitionId} found to assign as new primary.`);
      }
    }

    return true;
  }

  /**
   * Clear **all** runtime state — primarily for use in test harnesses.
   */
  clearAll() {
    // Clear spatial index before removing entities
    this.#spatialIndexManager.clearIndex();
    this.#logger.debug('Spatial index cleared.');

    // Clear active entities
    this.#mapManager.clear();
    this.#logger.info('All entity instances removed.');

    // Clear primary instance mappings
    this.#definitionToPrimaryInstanceMap.clear();
    this.#logger.debug('Primary instance mappings cleared.');
    
    // Clear definition cache
    this.#definitionCache.clear();
    this.#logger.info('Entity definition cache cleared.');
  }

  #ensurePrimaryInstanceCleared(definitionId, forceNew) {
    if (forceNew) {
      const oldPrimaryInstanceId =
        this.#definitionToPrimaryInstanceMap.get(definitionId);
      if (oldPrimaryInstanceId) {
        this.#logger.debug(
          `ForceNew: Removing old primary instance ${oldPrimaryInstanceId} for definition ${definitionId}`
        );
        this.removeEntityInstance(oldPrimaryInstanceId); // removeEntityInstance handles mapManager and spatialIndex
        this.#definitionToPrimaryInstanceMap.delete(definitionId);
      }
    }
  }
}

export default EntityManager;
