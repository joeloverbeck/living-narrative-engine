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
import EntityInstanceData from './entityInstanceData.js';
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
import { ensureValidLogger } from '../utils';
import { DefinitionNotFoundError } from '../errors/definitionNotFoundError.js';
import { EntityNotFoundError } from '../errors/entityNotFoundError';
import {
  ENTITY_CREATED_ID,
  ENTITY_REMOVED_ID,
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
} from '../constants/eventIds.js';

/* -------------------------------------------------------------------------- */
/* Type-Hint Imports (JSDoc only – removed at runtime)                        */
/* -------------------------------------------------------------------------- */

/** @typedef {import('../interfaces/coreServices.js').IDataRegistry}        IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator}     ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').ILogger}              ILogger */
/** @typedef {import('../interfaces/ISpatialIndexManager.js').ISpatialIndexManager} ISpatialIndexManager */
/** @typedef {import('../interfaces/coreServices.js').ValidationResult}     ValidationResult */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

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
 * • Instantiating entities from definitions
 * • Validating and mutating component payloads
 * • Injecting engine-level default components (STM, notes, and goals)
 * • Tracking active entities and their primary instances
 * • Propagating position changes to the spatial index
 * • Emitting events for entity lifecycle and component changes.
 */
class EntityManager extends IEntityManager {
  /** @type {IDataRegistry}  @private */ #registry;
  /** @type {ISchemaValidator} @private */ #validator;
  /** @type {ILogger} @private */ #logger;
  /** @type {ISpatialIndexManager} @private */ #spatialIndexManager;
  /** @type {ISafeEventDispatcher} @private */ #eventDispatcher;

  /** @type {MapManager} @private */ #mapManager;

  /** @type {Map<string, EntityDefinition>} @private */
  #definitionCache;

  /** @type {Map<string, Entity>} */
  activeEntities;

  /**
   * @class
   * @param {IDataRegistry}        registry
   * @param {ISchemaValidator}     validator
   * @param {ILogger}              logger
   * @param {ISpatialIndexManager} spatialIndexManager
   * @param {ISafeEventDispatcher} safeEventDispatcher
   * @throws {Error} If any dependency is missing or malformed.
   */
  constructor(registry, validator, logger, spatialIndexManager, safeEventDispatcher) {
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
    validateDependency(safeEventDispatcher, 'ISafeEventDispatcher', this.#logger, {
      requiredMethods: ['dispatch'],
    });

    this.#registry = registry;
    this.#validator = validator;
    this.#spatialIndexManager = spatialIndexManager;
    this.#eventDispatcher = safeEventDispatcher;
    this.#mapManager = new MapManager({ throwOnInvalidId: false });
    this.activeEntities = this.#mapManager.items;
    this.#definitionCache = new Map();

    this.#logger.debug('EntityManager initialised.');
  }

  /**
   * Retrieves an entity instance without throwing an error if not found.
   * @param {string} instanceId - The ID of the entity instance.
   * @returns {Entity | undefined} The entity instance or undefined if not found.
   * @private
   */
  #_getEntity(instanceId) {
    return this.#mapManager.get(instanceId);
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
    if (entity.hasComponent(ACTOR_COMPONENT_ID)) {
      const componentsToInject = [
        {
          id: SHORT_TERM_MEMORY_COMPONENT_ID,
          data: { thoughts: [], maxEntries: 10 },
          name: 'STM',
        },
        { id: NOTES_COMPONENT_ID, data: { notes: [] }, name: 'Notes' },
        { id: GOALS_COMPONENT_ID, data: { goals: [] }, name: 'Goals' },
      ];

      for (const comp of componentsToInject) {
        if (!entity.hasComponent(comp.id)) {
          this.#logger.debug(
            `Injecting ${comp.name} for ${entity.id} (def: ${entity.definitionId})`
          );
          try {
            // Note: This does not and should not fire a COMPONENT_ADDED event,
            // as this is part of the entity creation process, not a discrete runtime action.
            const validatedData = this.#validateAndClone(
              comp.id,
              comp.data,
              `Default ${comp.name} component injection for entity ${entity.id}`
            );
            entity.addComponent(comp.id, validatedData);
          } catch (e) {
            this.#logger.error(
              `Failed to inject default component ${comp.id} for entity ${entity.id}: ${e.message}`
            );
          }
        }
      }
    }
  }

  /**
   * Internal method to add an entity to tracking collections.
   *
   * @private
   * @param {Entity} entity The entity to track.
   */
  #_trackEntity(entity) {
    this.#mapManager.add(entity.id, entity);

    // If entity has a position, add it to the spatial index
    if (entity.hasComponent(POSITION_COMPONENT_ID)) {
      const position = entity.getComponentData(POSITION_COMPONENT_ID);
      // Ensure locationId exists and is a non-empty string before adding to spatial index
      if (
        position &&
        typeof position.locationId === 'string' &&
        position.locationId.trim() !== ''
      ) {
        this.#spatialIndexManager.addEntity(entity.id, position.locationId);
        this.#logger.debug(
          `Added entity ${entity.id} to spatial index at location ${position.locationId}.`
        );
      } else {
        this.#logger.debug(
          `Entity ${entity.id} has position component but no valid locationId; not added to spatial index.`
        );
      }
    }
    this.#logger.debug(`Tracked entity ${entity.id}`);
  }

  /**
   * Retrieves a cached entity definition or fetches it from the registry.
   *
   * @private
   * @param {string} definitionId - The ID of the entity definition.
   * @returns {EntityDefinition|null} The entity definition or null if not found.
   */
  #getDefinition(definitionId) {
    if (!MapManager.isValidId(definitionId)) {
      this.#logger.warn(
        `EntityManager.#getDefinition called with invalid definitionId: '${definitionId}'`
      );
      return null;
    }
    if (this.#definitionCache.has(definitionId)) {
      return this.#definitionCache.get(definitionId);
    }
    const definition = this.#registry.getEntityDefinition(definitionId);
    if (definition) {
      this.#definitionCache.set(definitionId, definition);
      return definition;
    }
    this.#logger.warn(`Definition not found in registry: ${definitionId}`);
    return null;
  }

  /* ---------------------------------------------------------------------- */
  /* Entity Creation                                                         */

  /* ---------------------------------------------------------------------- */

  /**
   * Create a new entity instance from a definition.
   *
   * @param {string} definitionId - The ID of the entity definition to use.
   * @param {object} options - Options for entity creation.
   * @param {string} [options.instanceId] - Optional. A specific ID for the new instance. If not provided, a UUID will be generated.
   * @param {Object<string, object>} [options.componentOverrides={}] - Optional. A map of component data to override or add.
   * @returns {Entity} The newly created entity instance.
   * @throws {DefinitionNotFoundError} If the definition is not found.
   * @throws {Error} If component data is invalid, or if an entity with the given instanceId already exists.
   */
  createEntityInstance(
    definitionId,
    { instanceId, componentOverrides = {} } = {}
  ) {
    if (!MapManager.isValidId(definitionId)) {
      const msg = `EntityManager.createEntityInstance: Invalid definitionId: ${definitionId}`;
      this.#logger.error(msg);
      throw new Error(msg);
    }

    const definition = this.#getDefinition(definitionId);
    if (!definition) {
      // UPDATED: Throw custom error
      this.#logger.error(
        `EntityManager.createEntityInstance: Definition not found: '${definitionId}'`
      );
      throw new DefinitionNotFoundError(definitionId);
    }

    const newInstanceId =
      instanceId && MapManager.isValidId(instanceId) ? instanceId : uuidv4();

    if (this.#mapManager.has(newInstanceId)) {
      const msg = `EntityManager.createEntityInstance: Entity with instanceId '${newInstanceId}' already exists.`;
      this.#logger.error(msg);
      throw new Error(msg);
    }

    this.#logger.debug(
      `Creating entity instance '${newInstanceId}' from definition '${definitionId}'`
    );

    const validatedOverrides = {};
    if (componentOverrides) {
      for (const [typeId, data] of Object.entries(componentOverrides)) {
        if (data === null) {
          validatedOverrides[typeId] = null;
        } else {
          validatedOverrides[typeId] = this.#validateAndClone(
            typeId,
            data,
            `Override component ${typeId} for new entity ${newInstanceId} (definition ${definitionId})`
          );
        }
      }
    }

    if (definition.components) {
      for (const [typeId, defData] of Object.entries(definition.components)) {
        if (
          defData !== null &&
          (!componentOverrides || !componentOverrides.hasOwnProperty(typeId))
        ) {
          this.#validateAndClone(
            typeId,
            defData,
            `Definition component ${typeId} for new entity ${newInstanceId} (definition ${definitionId})`
          );
        }
      }
    }

    const entityInstanceDataObject = new EntityInstanceData(
      newInstanceId,
      definition,
      validatedOverrides
    );
    const entity = new Entity(entityInstanceDataObject);

    this.#injectDefaultComponents(entity);
    this.#_trackEntity(entity);

    this.#eventDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: entity.id,
      definitionId: entity.definitionId,
      wasReconstructed: false,
    });

    this.#logger.info(
      `Entity instance '${newInstanceId}' (def: '${definitionId}') created.`
    );
    return entity;
  }

  /**
   * Reconstructs an entity instance from a plain serializable object.
   * @param {object} serializedEntity - Plain object from a save file.
   * @param {string} serializedEntity.instanceId
   * @param {string} serializedEntity.definitionId
   * @param {Record<string, object>} [serializedEntity.overrides]
   * @returns {Entity} The reconstructed Entity instance.
   * @throws {DefinitionNotFoundError} If the entity definition is not found.
   * @throws {Error} If component data is invalid, or if an entity with the given ID already exists.
   */
  reconstructEntity(serializedEntity) {
    // Destructure data from the plain object
    const { instanceId, definitionId, overrides } = serializedEntity;

    // Validate the plain data
    if (!MapManager.isValidId(instanceId)) {
      throw new Error(`Invalid instanceId in serialized data: '${instanceId}'`);
    }
    if (!MapManager.isValidId(definitionId)) {
      throw new Error(
        `Serialized data for '${instanceId}' is missing a valid definitionId.`
      );
    }

    this.#logger.debug(
      `Reconstructing entity '${instanceId}' from def '${definitionId}'`
    );

    // Existing logic for checking for duplicates and getting definition
    if (this.#mapManager.has(instanceId)) {
      const msg = `EntityManager.reconstructEntity: Entity with ID '${instanceId}' already exists. Reconstruction aborted.`;
      this.#logger.error(msg);
      throw new Error(msg);
    }

    const definitionToUse = this.#getDefinition(definitionId);
    if (!definitionToUse) {
      this.#logger.error(
        `EntityManager.reconstructEntity: Definition '${definitionId}' not found in registry for entity '${instanceId}'. Reconstruction aborted.`
      );
      throw new DefinitionNotFoundError(definitionId);
    }

    // Validate components
    const validatedOverrides = {};
    if (overrides) {
      for (const [typeId, data] of Object.entries(overrides)) {
        if (data === null) {
          validatedOverrides[typeId] = null;
        } else {
          validatedOverrides[typeId] = this.#validateAndClone(
            typeId,
            data,
            `Reconstruction component ${typeId} for entity ${instanceId} (definition ${definitionId})`
          );
        }
      }
    }

    // Create the instance data object inside this method
    const entityInstanceDataObject = new EntityInstanceData(
      instanceId,
      definitionToUse,
      validatedOverrides
    );
    const entity = new Entity(entityInstanceDataObject);
    this.#_trackEntity(entity);

    this.#eventDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: entity.id,
      definitionId: entity.definitionId,
      wasReconstructed: true,
    });

    this.#logger.info(`Entity instance '${instanceId}' reconstructed.`);
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
   * @throws {EntityNotFoundError} If entity not found.
   * @throws {Error} If component data is invalid.
   */
  addComponent(instanceId, componentTypeId, componentData) {
    if (!MapManager.isValidId(instanceId)) {
      this.#logger.warn(
        `EntityManager.addComponent: Invalid instanceId: '${instanceId}'`
      );
      return false;
    }
    if (typeof componentTypeId !== 'string' || !componentTypeId.trim()) {
      this.#logger.warn(
        `EntityManager.addComponent: Invalid componentTypeId: '${componentTypeId}' for entity '${instanceId}'`
      );
      return false;
    }

    // Unified check for componentData type, including undefined
    if (componentData !== null && typeof componentData !== 'object') {
      const receivedType =
        componentData === undefined ? 'undefined' : typeof componentData;
      const errorMsg = `EntityManager.addComponent: componentData for ${componentTypeId} on ${instanceId} must be an object or null. Received: ${receivedType}`;
      this.#logger.error(errorMsg, {
        componentTypeId,
        instanceId,
        receivedType,
      });
      throw new Error(errorMsg);
    }

    const entity = this.#_getEntity(instanceId);
    if (!entity) {
      // UPDATED: Throw custom error
      this.#logger.error(
        `EntityManager.addComponent: Entity not found with ID: ${instanceId}`,
        { instanceId, componentTypeId }
      );
      throw new EntityNotFoundError(instanceId);
    }

    let validatedData;
    if (componentData === null) {
      validatedData = null;
    } else {
      validatedData = this.#validateAndClone(
        componentTypeId,
        componentData, // This is an object
        `addComponent ${componentTypeId} to entity ${instanceId}`
      );
    }

    let oldLocationId;
    let newLocationId;

    if (componentTypeId === POSITION_COMPONENT_ID) {
      const currentPositionComponent = entity.getComponentData(
        POSITION_COMPONENT_ID,
        true
      );
      oldLocationId =
        currentPositionComponent &&
        typeof currentPositionComponent.locationId === 'string' &&
        currentPositionComponent.locationId.trim() !== ''
          ? currentPositionComponent.locationId
          : currentPositionComponent &&
          currentPositionComponent.hasOwnProperty('locationId')
            ? currentPositionComponent.locationId
            : undefined;

      if (validatedData && validatedData.hasOwnProperty('locationId')) {
        newLocationId =
          typeof validatedData.locationId === 'string' &&
          validatedData.locationId.trim() !== ''
            ? validatedData.locationId
            : validatedData.locationId === null
              ? null
              : undefined;
      } else if (validatedData === null) {
        newLocationId = undefined;
      } else {
        newLocationId = undefined;
      }
    }

    const updateSucceeded = entity.addComponent(componentTypeId, validatedData);

    if (!updateSucceeded) {
      this.#logger.warn(
        `EntityManager.addComponent: entity.addComponent returned false for '${componentTypeId}' on entity '${instanceId}'. This may indicate an internal issue.`
      );
      return false;
    }

    this.#eventDispatcher.dispatch(COMPONENT_ADDED_ID, {
      instanceId,
      componentTypeId,
      componentData: validatedData,
    });

    this.#logger.debug(
      `Successfully added/updated component '${componentTypeId}' data on entity '${instanceId}'.`
    );

    if (componentTypeId === POSITION_COMPONENT_ID) {
      this.#spatialIndexManager.updateEntityLocation(
        instanceId,
        oldLocationId,
        newLocationId
      );
      this.#logger.debug(
        `Spatial index updated for entity '${instanceId}': old='${oldLocationId}', new='${newLocationId}'.`
      );
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
   * @throws {EntityNotFoundError} If the entity is not found.
   */
  removeComponent(instanceId, componentTypeId) {
    if (!MapManager.isValidId(instanceId)) {
      this.#logger.warn(
        `EntityManager.removeComponent: Invalid instanceId: '${instanceId}'`
      );
      return false;
    }
    if (typeof componentTypeId !== 'string' || !componentTypeId.trim()) {
      this.#logger.warn(
        `EntityManager.removeComponent: Invalid componentTypeId: '${componentTypeId}' for entity '${instanceId}'`
      );
      return false;
    }

    const entity = this.#_getEntity(instanceId);
    if (!entity) {
      // UPDATED: Throw custom error
      this.#logger.error(
        `EntityManager.removeComponent: Entity not found with ID: '${instanceId}'. Cannot remove component '${componentTypeId}'.`
      );
      throw new EntityNotFoundError(instanceId);
    }

    // Check if the component to be removed exists as an override.
    if (!entity.hasComponent(componentTypeId, true)) {
      this.#logger.debug(
        `EntityManager.removeComponent: Component '${componentTypeId}' not found as an override on entity '${instanceId}'. Nothing to remove at instance level.`
      );
      return false;
    }

    let oldLocationIdForSpatialIndex = undefined;
    const wasPositionComponentOverride =
      componentTypeId === POSITION_COMPONENT_ID &&
      entity.hasComponent(componentTypeId, true); // Already know it's an override from check above

    if (wasPositionComponentOverride) {
      // Since it's an override and it's the POSITION_COMPONENT_ID, get its data.
      const positionData = entity.getComponentData(componentTypeId);
      if (
        positionData &&
        typeof positionData.locationId === 'string' &&
        positionData.locationId.trim() !== ''
      ) {
        oldLocationIdForSpatialIndex = positionData.locationId;
      } else if (
        positionData &&
        positionData.hasOwnProperty('locationId') &&
        positionData.locationId === null
      ) {
        oldLocationIdForSpatialIndex = null;
      }
      // If positionData is undefined, or locationId is not a string/null, oldLocationIdForSpatialIndex remains undefined.
    }

    const successfullyRemovedOverride = entity.removeComponent(componentTypeId);

    if (successfullyRemovedOverride) {
      this.#eventDispatcher.dispatch(COMPONENT_REMOVED_ID, {
        instanceId,
        componentTypeId,
      });

      this.#logger.debug(
        `EntityManager.removeComponent: Component override '${componentTypeId}' removed from entity '${instanceId}'.`
      );

      // Only attempt spatial index removal if the component removed was a POSITION component *override*
      // and its old location was validly determined (string or null).
      if (
        wasPositionComponentOverride &&
        (typeof oldLocationIdForSpatialIndex === 'string' ||
          oldLocationIdForSpatialIndex === null)
      ) {
        this.#spatialIndexManager.removeEntity(
          instanceId,
          oldLocationIdForSpatialIndex
        );
        this.#logger.debug(
          `EntityManager.removeComponent: Entity '${instanceId}' removed from spatial index (based on old override location '${oldLocationIdForSpatialIndex}') due to ${POSITION_COMPONENT_ID} override removal.`
        );
      } else if (wasPositionComponentOverride) {
        // Position override was removed, but oldLocationId was effectively undefined
        this.#logger.debug(
          `EntityManager.removeComponent: Entity '${instanceId}' (position component override removed). Old override location was '${oldLocationIdForSpatialIndex}', so not explicitly removed from spatial index by that location.`
        );
      }
      return true;
    } else {
      this.#logger.warn(
        `EntityManager.removeComponent: entity.removeComponent('${componentTypeId}') returned false for entity '${instanceId}' when an override was expected and should have been removable. This may indicate an issue in Entity class logic.`
      );
      return false;
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Query / Utility Methods                                                 */

  /* ---------------------------------------------------------------------- */

  getEntityInstance(instanceId) {
    if (!MapManager.isValidId(instanceId)) {
      this.#logger.debug(
        `EntityManager.getEntityInstance: Called with invalid ID format: '${instanceId}'. Returning undefined.`
      );
      return undefined;
    }
    const entity = this.#_getEntity(instanceId);
    if (!entity) {
      this.#logger.debug(
        `EntityManager.getEntityInstance: Entity not found with ID: '${instanceId}'. Returning undefined.`
      );
      return undefined;
    }
    return entity;
  }

  getComponentData(instanceId, componentTypeId) {
    if (!MapManager.isValidId(instanceId)) {
      this.#logger.debug(
        `EntityManager.getComponentData: Called with invalid instanceId format: '${instanceId}'. Returning undefined.`
      );
      return undefined;
    }
    if (typeof componentTypeId !== 'string' || !componentTypeId.trim()) {
      this.#logger.debug(
        `EntityManager.getComponentData: Called with invalid componentTypeId format: '${componentTypeId}'. Returning undefined.`
      );
      return undefined;
    }
    const entity = this.#_getEntity(instanceId);
    if (!entity) {
      this.#logger.debug(
        `EntityManager.getComponentData: Entity not found with ID: '${instanceId}'. Returning undefined for component '${componentTypeId}'.`
      );
      return undefined;
    }
    return entity.getComponentData(componentTypeId);
  }

  hasComponent(instanceId, componentTypeId, checkOverrideOnly = false) {
    if (!MapManager.isValidId(instanceId)) {
      this.#logger.debug(
        `EntityManager.hasComponent: Called with invalid instanceId format: '${instanceId}'. Returning false.`
      );
      return false;
    }
    if (typeof componentTypeId !== 'string' || !componentTypeId.trim()) {
      this.#logger.debug(
        `EntityManager.hasComponent: Called with invalid componentTypeId format: '${componentTypeId}'. Returning false.`
      );
      return false;
    }
    const entity = this.#_getEntity(instanceId);
    return entity
      ? entity.hasComponent(componentTypeId, checkOverrideOnly)
      : false;
  }

  /**
   * Return **new array** of entities that possess `componentTypeId`.
   * Logs diagnostic info for engine analytics / debugging.
   *
   * @param {*} componentTypeId
   * @returns {Entity[]} fresh array (never a live reference)
   */
  getEntitiesWithComponent(componentTypeId) {
    if (typeof componentTypeId !== 'string' || !componentTypeId.trim()) {
      this.#logger.debug(
        `EntityManager.getEntitiesWithComponent: Received invalid componentTypeId ('${componentTypeId}'). Returning empty array.`
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
    if (!MapManager.isValidId(locationInstanceId)) {
      this.#logger.warn(
        `EntityManager.getEntitiesInLocation: Invalid locationInstanceId: '${locationInstanceId}'. Returning empty set.`
      );
      return new Set();
    }
    return this.#spatialIndexManager.getEntitiesInLocation(locationInstanceId);
  }

  /**
   * Remove an entity instance from the manager and spatial index.
   *
   * @param {string} instanceId - The ID of the entity instance to remove.
   * @returns {boolean} True if the entity was successfully removed.
   * @throws {EntityNotFoundError} If the entity is not found.
   */
  removeEntityInstance(instanceId) {
    if (!MapManager.isValidId(instanceId)) {
      this.#logger.warn(
        `EntityManager.removeEntityInstance: Attempted to remove entity with invalid ID: '${instanceId}'`
      );
      return false;
    }

    const entityToRemove = this.#_getEntity(instanceId);
    if (!entityToRemove) {
      // UPDATED: Throw custom error
      this.#logger.error(
        `EntityManager.removeEntityInstance: Attempted to remove non-existent entity instance '${instanceId}'.`
      );
      throw new EntityNotFoundError(instanceId);
    }

    // Dispatch event immediately after finding the entity and before any removal logic.
    this.#eventDispatcher.dispatch(ENTITY_REMOVED_ID, {
      instanceId,
    });

    if (entityToRemove.hasComponent(POSITION_COMPONENT_ID)) {
      const positionData = entityToRemove.getComponentData(
        POSITION_COMPONENT_ID
      );
      if (
        positionData &&
        typeof positionData.locationId === 'string' &&
        positionData.locationId.trim() !== ''
      ) {
        this.#spatialIndexManager.removeEntity(
          entityToRemove.id,
          positionData.locationId
        );
        this.#logger.debug(
          `Removed entity ${entityToRemove.id} from spatial index (old location was ${positionData.locationId}) during entity removal.`
        );
      } else {
        this.#logger.debug(
          `Entity ${entityToRemove.id} had position component but no valid locationId (or location was null/empty); not explicitly removed from spatial index by that location during entity removal.`
        );
      }
    }

    const removed = this.#mapManager.remove(entityToRemove.id);
    if (removed) {
      this.#logger.info(
        `Entity instance ${entityToRemove.id} removed from EntityManager.`
      );
      return true;
    } else {
      this.#logger.error(
        `EntityManager.removeEntityInstance: MapManager.remove failed for already retrieved entity '${instanceId}'. This indicates a serious internal inconsistency.`
      );
      // This path should ideally not be reachable if `_getEntity` succeeded, but returning false is safer.
      return false;
    }
  }

  /**
   * Clear all entities from the manager and the spatial index.
   * Also clears the entity definition cache.
   */
  clearAll() {
    this.#spatialIndexManager.clearIndex();
    this.#logger.debug('Spatial index cleared.');

    this.#mapManager.clear();
    this.#logger.info('All entity instances removed from EntityManager.');

    this.#definitionCache.clear();
    this.#logger.info('Entity definition cache cleared.');
  }
}

export default EntityManager;