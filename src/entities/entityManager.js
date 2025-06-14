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
import Entity from './entity.js';
import MapManager from '../utils/mapManager.js';
import SilentMapManager from '../utils/silentMapManager.js';
import {
  ACTOR_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  NOTES_COMPONENT_ID,
} from '../constants/componentIds.js';
import { IEntityManager } from '../interfaces/IEntityManager.js';

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
 * Deep clone an arbitrary JSON-compatible object.
 *
 * @private
 * @param {object} obj
 * @returns {object}
 */
function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj));
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

/**
 * Assert that an injected dependency exposes required methods.
 *
 * @private
 * @param {string} name
 * @param {object} instance
 * @param {string[]} methods
 */
function assertInterface(name, instance, methods) {
  const missing = methods.some((m) => typeof instance?.[m] !== 'function');
  if (!instance || missing) {
    throw new Error(
      `EntityManager requires an ${name} instance with ${methods.join(', ')}.`
    );
  }
}

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
    assertInterface('IDataRegistry', registry, ['getEntityDefinition']);
    assertInterface('ISchemaValidator', validator, ['validate']);
    assertInterface('ILogger', logger, ['info', 'error', 'warn', 'debug']);
    assertInterface('ISpatialIndexManager', spatialIndexManager, [
      'addEntity',
      'removeEntity',
      'updateEntityLocation',
      'clearIndex',
    ]);

    this.#registry = registry;
    this.#validator = validator;
    this.#logger = logger;
    this.#spatialIndexManager = spatialIndexManager;
    this.#definitionToPrimaryInstanceMap = new Map();
    this.#mapManager = new SilentMapManager();
    this.activeEntities = this.#mapManager.items;

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
      const msg = `EntityManager.addComponent: Entity not found with ID: ${instanceId}`;
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
   * @returns {object}
   */
  #validateAndClone(componentTypeId, data, errorContext) {
    const clone = cloneDeep(data);
    const result = this.#validator.validate(componentTypeId, clone);
    if (!validationSucceeded(result)) {
      const details = formatValidationErrors(result);
      const msg = `${errorContext} Errors:\n${details}`;
      this.#logger.error(msg);
      throw new Error(errorContext);
    }
    return clone;
  }

  /**
   * Inject default components required by the engine (STM, notes, and goals).
   *
   * @private
   * @param {Entity} entity
   * @param {string} instanceId
   */
  #injectDefaultComponents(entity, instanceId) {
    // If it's an actor and SHORT_TERM_MEMORY is missing, add it.
    if (
      entity.hasComponent(ACTOR_COMPONENT_ID) &&
      !entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)
    ) {
      const defaultStm = { thoughts: [], maxEntries: 10 };
      const validatedStm = this.#validateAndClone(
        SHORT_TERM_MEMORY_COMPONENT_ID,
        defaultStm,
        'Default STM validation failed.'
      );
      entity.addComponent(SHORT_TERM_MEMORY_COMPONENT_ID, validatedStm);
      this.#logger.debug(
        `createEntityInstance: default 'core:short_term_memory' injected into ${instanceId}.`
      );
    }

    // If it's an actor and NOTES is missing, add it.
    if (
      entity.hasComponent(ACTOR_COMPONENT_ID) &&
      !entity.hasComponent(NOTES_COMPONENT_ID)
    ) {
      const defaultNotes = { notes: [] };
      const validatedNotes = this.#validateAndClone(
        NOTES_COMPONENT_ID,
        defaultNotes,
        'Default core:notes validation failed.'
      );
      entity.addComponent(NOTES_COMPONENT_ID, validatedNotes);
      this.#logger.debug(
        `createEntityInstance: default 'core:notes' injected into ${instanceId}.`
      );
    }

    // If it's an actor and GOALS is missing, add it.
    // @description Adds a default `core:goals` with an empty array when absent.
    if (
      entity.hasComponent(ACTOR_COMPONENT_ID) &&
      !entity.hasComponent('core:goals')
    ) {
      const defaultGoals = { goals: [] };
      const validatedGoals = this.#validateAndClone(
        'core:goals',
        defaultGoals,
        'Default core:goals validation failed.'
      );
      entity.addComponent('core:goals', validatedGoals);
      this.#logger.debug(
        `createEntityInstance: default 'core:goals' injected into ${instanceId}.`
      );
    }
  }

  /**
   * Track a newly created entity if not a forced clone.
   *
   * @private
   * @param {Entity} entity
   * @param {string} definitionId
   * @param {string} instanceId
   */
  #commitEntity(entity, definitionId, instanceId) {
    this.#mapManager.add(instanceId, entity);
    if (!this.#definitionToPrimaryInstanceMap.has(definitionId)) {
      this.#definitionToPrimaryInstanceMap.set(definitionId, instanceId);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Entity Creation                                                         */

  /* ---------------------------------------------------------------------- */

  /**
   * Create a new Entity instance from its definition.
   *
   * @param {string}  definitionId
   * @param {?string} [instanceId]
   * @param {boolean} [forceNew]
   * @returns {?Entity}
   */
  createEntityInstance(definitionId, instanceId = null, forceNew = false) {
    if (!definitionId || typeof definitionId !== 'string') {
      this.#logger.error(
        `EntityManager.createEntityInstance: Invalid definitionId provided: ${definitionId}`
      );
      return null;
    }

    const actualInstanceId = instanceId || uuidv4();
    if (!actualInstanceId || typeof actualInstanceId !== 'string') {
      this.#logger.error('createEntityInstance: invalid/generated instanceId.');
      return null;
    }

    if (!forceNew && this.#mapManager.has(actualInstanceId)) {
      this.#logger.debug(
        `EntityManager.createEntityInstance: Returning existing instance for ID: ${actualInstanceId}`
      );
      return this.#mapManager.get(actualInstanceId);
    }

    const entityDefinition = this.#registry.getEntityDefinition(definitionId);
    if (!entityDefinition) {
      this.#logger.error(
        `EntityManager.createEntityInstance: Entity definition not found for ID: ${definitionId}`
      );
      return null;
    }

    const definitionComponents =
      entityDefinition.components &&
      typeof entityDefinition.components === 'object'
        ? entityDefinition.components
        : {};

    let entity;
    try {
      entity = new Entity(actualInstanceId, definitionId);

      /* --- copy + validate each component from definition --- */
      for (const [componentTypeId, componentData] of Object.entries(
        definitionComponents
      )) {
        const dataClone = this.#validateAndClone(
          componentTypeId,
          componentData,
          `createEntityInstance: validation failed for '${componentTypeId}' on definition '${definitionId}'.`
        );

        entity.addComponent(componentTypeId, dataClone);
      }

      /* --- default injections (STM, notes, goals) ------------------------------- */
      this.#injectDefaultComponents(entity, actualInstanceId);

      /* --- bookkeeping --------------------------------------------- */
      if (!forceNew) {
        this.#commitEntity(entity, definitionId, actualInstanceId);
      }

      this.#logger.debug(
        `createEntityInstance: created '${actualInstanceId}' from '${definitionId}'.`
      );
      return entity;
    } catch (err) {
      this.#logger.error('createEntityInstance: aborting due to error.', err);
      if (entity && this.#mapManager.get(actualInstanceId) === entity) {
        this.#mapManager.remove(actualInstanceId);
      }
      return null;
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Component-level Mutations                                               */

  /* ---------------------------------------------------------------------- */

  /**
   * Add or overwrite a component on an existing entity.
   *
   * @param {string} instanceId
   * @param {string} componentTypeId
   * @param {object} componentData
   * @returns {boolean}
   * @throws {Error}
   */
  addComponent(instanceId, componentTypeId, componentData) {
    const entity = this.#getEntityOrThrow(instanceId);

    if (typeof componentData !== 'object' || componentData === null) {
      const msg = `EntityManager.addComponent: Invalid component data for type '${componentTypeId}' on entity '${instanceId}'.`;
      this.#logger.error(msg);
      throw new Error(msg);
    }

    const clonedData = this.#validateAndClone(
      componentTypeId,
      componentData,
      `EntityManager.addComponent: Component data validation failed for type '${componentTypeId}' on entity '${instanceId}'.`
    );
    this.#logger.debug(
      `EntityManager.addComponent: validation passed for '${componentTypeId}' on '${instanceId}'.`
    );

    /* --- positional bookkeeping ----------------------------------- */
    let oldLocationId = null;
    if (componentTypeId === POSITION_COMPONENT_ID) {
      oldLocationId = entity.getComponentData(
        POSITION_COMPONENT_ID
      )?.locationId;
      this.#logger.debug(
        `EntityManager.addComponent: Old location for entity ${instanceId} was ${
          oldLocationId ?? 'null/undefined'
        }.`
      );
    }

    /* --- mutate ---------------------------------------------------- */
    entity.addComponent(componentTypeId, clonedData);
    this.#logger.debug(
      `EntityManager.addComponent: Successfully added/updated component '${componentTypeId}' data on entity '${instanceId}'.`
    );

    /* --- spatial index update -------------------------------------- */
    if (componentTypeId === POSITION_COMPONENT_ID) {
      const newLocationId = entity.getComponentData(
        POSITION_COMPONENT_ID
      )?.locationId;
      this.#logger.debug(
        `EntityManager.addComponent: New location for entity ${instanceId} is ${
          newLocationId ?? 'null/undefined'
        }. Updating spatial index.`
      );

      if (
        newLocationId &&
        !this.#mapManager.has(newLocationId) &&
        newLocationId.includes(':')
      ) {
        this.#logger.warn(
          `addComponent: '${instanceId}' given locationId '${newLocationId}' that looks like a definition ID.`
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

  /* ---------------------------------------------------------------------- */
  /* Query / Utility Methods                                                 */

  /* ---------------------------------------------------------------------- */

  getPrimaryInstanceByDefinitionId(definitionId) {
    const instanceId = this.#definitionToPrimaryInstanceMap.get(definitionId);
    if (instanceId) return this.#mapManager.get(instanceId);
    this.#logger.debug(
      `getPrimaryInstanceByDefinitionId: no primary for '${definitionId}'.`
    );
    return undefined;
  }

  getEntityInstance(instanceId) {
    return this.#mapManager.get(instanceId);
  }

  /**
   * Remove a component from an existing entity.
   *
   * @param {string} instanceId          – UUID of the target entity.
   * @param {string} componentTypeId     – Component type to remove.
   * @returns {boolean}                  – `true` if the component was removed.
   */
  removeComponent(instanceId, componentTypeId) {
    const entity = this.#mapManager.get(instanceId);

    /* ---------- entity guard ---------- */
    if (!entity) {
      this.#logger.warn(
        `Entity not found with ID: ${instanceId}. Cannot remove component.`
      );
      return false;
    }

    /* ---------- position bookkeeping (old location) ---------- */
    let oldLocationId = null;
    if (componentTypeId === POSITION_COMPONENT_ID) {
      oldLocationId = entity.getComponentData(
        POSITION_COMPONENT_ID
      )?.locationId;
      this.#logger.debug(
        `Removing position component from entity ${instanceId}. Old location was ${
          oldLocationId ?? 'null/undefined'
        }.`
      );
    }

    /* ---------- remove from entity ---------- */
    const removed = entity.removeComponent(componentTypeId);

    if (removed) {
      this.#logger.debug(
        `Successfully removed component '${componentTypeId}' from entity '${instanceId}'.`
      );

      if (componentTypeId === POSITION_COMPONENT_ID) {
        /* propagate to spatial index */
        this.#spatialIndexManager.removeEntity(instanceId, oldLocationId);
        this.#logger.debug(
          `Updated spatial index for entity ${instanceId} removal from location ${
            oldLocationId ?? 'null/undefined'
          }.`
        );
      }
    } else {
      /* nothing to remove */
      this.#logger.debug(
        `Component '${componentTypeId}' not found on entity '${instanceId}'. Nothing removed.`
      );
    }

    return removed;
  }

  getComponentData(instanceId, componentTypeId) {
    return this.#mapManager.get(instanceId)?.getComponentData(componentTypeId);
  }

  hasComponent(instanceId, componentTypeId) {
    return !!this.#mapManager.get(instanceId)?.hasComponent(componentTypeId);
  }

  /**
   * Return **new array** of entities that possess `componentTypeId`.
   * Logs diagnostic info for engine analytics / debugging.
   *
   * @param {*} componentTypeId
   * @returns {Entity[]} fresh array (never a live reference)
   */
  getEntitiesWithComponent(componentTypeId) {
    /* Guard – bad input ---------------------------------------------------- */
    if (typeof componentTypeId !== 'string' || !componentTypeId) {
      this.#logger.debug(
        `EntityManager.getEntitiesWithComponent: Received invalid componentTypeId (${componentTypeId})`
      );
      return [];
    }

    /* Gather matches ------------------------------------------------------- */
    const matching = [];
    for (const entity of this.#mapManager.values()) {
      if (entity.hasComponent(componentTypeId)) matching.push(entity);
    }

    /* Emit diagnostics ----------------------------------------------------- */
    this.#logger.debug(
      `EntityManager.getEntitiesWithComponent: Found ${matching.length} entities with component '${componentTypeId}'`
    );

    return matching; // already a brand-new array
  }

  /**
   * Retrieve the set of entity IDs currently inside a location instance.
   *
   * @param {string} locationInstanceId – UUID of the location entity.
   * @returns {Set<string>}             – Set of contained entity IDs.
   */
  getEntitiesInLocation(locationInstanceId) {
    return this.#spatialIndexManager.getEntitiesInLocation(locationInstanceId);
  }

  /**
   * Remove a single entity instance from runtime state (and spatial index).
   *
   * @param {string} instanceId – UUID of the entity to remove.
   * @returns {boolean}         – `true` if the entity was removed.
   */
  removeEntityInstance(instanceId) {
    const entity = this.#mapManager.get(instanceId);

    /* ---------- guard: missing entity ---------- */
    if (!entity) {
      this.#logger.warn(
        `Attempted to remove non-existent entity instance ${instanceId}`
      );
      return false;
    }

    /* ---------- spatial-index bookkeeping ---------- */
    const oldLocationId =
      entity.getComponentData(POSITION_COMPONENT_ID)?.locationId ?? null;

    if (oldLocationId !== null && oldLocationId !== undefined) {
      this.#spatialIndexManager.removeEntity(instanceId, oldLocationId);
      this.#logger.debug(
        `Removed entity ${instanceId} from spatial index (location instanceId: ${oldLocationId}).`
      );
    }

    /* ---------- maps & primary-instance bookkeeping ---------- */
    this.#mapManager.remove(instanceId);

    if (
      this.#definitionToPrimaryInstanceMap.get(entity.definitionId) ===
      instanceId
    ) {
      const replacement = Array.from(this.#mapManager.values()).find(
        (e) => e.definitionId === entity.definitionId
      );
      if (replacement) {
        this.#definitionToPrimaryInstanceMap.set(
          entity.definitionId,
          replacement.id
        );
      } else {
        this.#definitionToPrimaryInstanceMap.delete(entity.definitionId);
      }
    }

    /* ---------- final audit log ---------- */
    this.#logger.debug(
      `Removed entity instance ${instanceId} from active map.`
    );

    return true;
  }

  /**
   * Clear **all** runtime state — primarily for use in test harnesses.
   */
  clearAll() {
    this.#mapManager.clear();
    this.#definitionToPrimaryInstanceMap.clear();
    this.#spatialIndexManager.clearIndex();
    this.#logger.debug(
      'EntityManager: Cleared all active entities, definition map, and delegated spatial index clearing.'
    );
  }
}

export default EntityManager;
