/**
 * @file This module is in charge of entities: their creation and destruction, updating components, etc. A big honcho.
 * @see src/entities/entityManager.js
 */

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

import InMemoryEntityRepository from '../adapters/InMemoryEntityRepository.js';
import UuidGenerator from '../adapters/UuidGenerator.js';
import LodashCloner from '../adapters/LodashCloner.js';
import DefaultComponentPolicy from '../adapters/DefaultComponentPolicy.js';
import Entity from './entity.js';
import EntityInstanceData from './entityInstanceData.js';
import MapManager from '../utils/mapManagerUtils.js';
import {
  ACTOR_COMPONENT_ID,
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

/** @typedef {import('./entityDefinition.js').default} EntityDefinition */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry}        IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator}     ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').ILogger}              ILogger */
/** @typedef {import('../interfaces/coreServices.js').ValidationResult}     ValidationResult */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../ports/IEntityRepository.js').IEntityRepository} IEntityRepository */
/** @typedef {import('../ports/IComponentCloner.js').IComponentCloner} IComponentCloner */
/** @typedef {import('../ports/IIdGenerator.js').IIdGenerator} IIdGenerator */
/** @typedef {import('../ports/IDefaultComponentPolicy.js').IDefaultComponentPolicy} IDefaultComponentPolicy */

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
 * • Emitting events for entity lifecycle and component changes.
 */
class EntityManager extends IEntityManager {
  /** @type {IDataRegistry}  @private */
  #registry;
  /** @type {ISchemaValidator} @private */
  #validator;
  /** @type {ILogger} @private */
  #logger;
  /** @type {ISafeEventDispatcher} @private */
  #eventDispatcher;
  /** @type {function(): string} @private */
  #idGenerator;
  /** @type {IEntityRepository} @private */
  #repository; // eslint-disable-line no-unused-private-class-members
  /** @type {IComponentCloner} @private */
  #cloner;
  /** @type {IDefaultComponentPolicy} @private */
  #defaultPolicy; // eslint-disable-line no-unused-private-class-members

  /** @type {MapManager} @private */
  #mapManager;

  /** @type {Map<string, EntityDefinition>} @private */
  #definitionCache;

  /** @type {Map<string, Entity>} */
  activeEntities;

  /**
   * @class
   * @param {object} [deps] - Constructor dependencies.
   * @param {IDataRegistry}        deps.registry - Data registry for definitions.
   * @param {IEntityRepository}    [deps.repository] - Repository for active entities.
   * @param {ISchemaValidator}     deps.validator - Schema validator instance.
   * @param {ILogger}              deps.logger - Logger implementation.
   * @param {ISafeEventDispatcher} deps.dispatcher - Event dispatcher.
   * @param {IIdGenerator}         [deps.idGenerator] - ID generator function.
   * @param {IComponentCloner}     [deps.cloner] - Component deep cloner.
   * @param {IDefaultComponentPolicy} [deps.defaultPolicy] - Default component injection policy.
   * @throws {Error} If any dependency is missing or malformed.
   */
  constructor({
    registry,
    repository = new InMemoryEntityRepository(),
    validator,
    logger,
    dispatcher,
    idGenerator = UuidGenerator,
    cloner = LodashCloner,
    defaultPolicy = new DefaultComponentPolicy(),
  } = {}) {
    super();

    /* ---------- dependency checks ---------- */
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = ensureValidLogger(logger, 'EntityManager');

    validateDependency(registry, 'IDataRegistry', this.#logger, {
      requiredMethods: ['getEntityDefinition'],
    });
    validateDependency(repository, 'IEntityRepository', this.#logger, {
      requiredMethods: ['add', 'get', 'has', 'remove', 'clear', 'entities'],
    });
    validateDependency(validator, 'ISchemaValidator', this.#logger, {
      requiredMethods: ['validate'],
    });

    validateDependency(dispatcher, 'ISafeEventDispatcher', this.#logger, {
      requiredMethods: ['dispatch'],
    });
    validateDependency(idGenerator, 'IIdGenerator', this.#logger, {
      isFunction: true,
    });
    validateDependency(cloner, 'IComponentCloner', this.#logger, {
      isFunction: true,
    });
    validateDependency(defaultPolicy, 'IDefaultComponentPolicy', this.#logger, {
      requiredMethods: ['apply'],
    });

    this.#registry = registry;
    this.#repository = repository;
    this.#validator = validator;
    this.#logger = ensureValidLogger(logger, 'EntityManager');
    this.#eventDispatcher = dispatcher;
    this.#idGenerator = idGenerator;
    this.#cloner = cloner;
    this.#defaultPolicy = defaultPolicy;

    this.#mapManager = new MapManager({ throwOnInvalidId: false });
    this.activeEntities = this.#mapManager.items;
    this.#definitionCache = new Map();

    this.#logger.debug('EntityManager initialised.');
  }

  /**
   * Retrieves an entity instance without throwing an error if not found.
   *
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
    const clone = this.#cloner(data);
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
              `Failed to inject default component ${comp.id} for entity ${
                entity.id
              }: ${e.message}`
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
   * @param {Object<string, object>} [options.componentOverrides] - Optional. A map of component data to override or add.
   * @returns {Entity} The newly created entity instance.
   * @throws {DefinitionNotFoundError} If the definition is not found.
   * @throws {Error} If component data is invalid, or if an entity with the given instanceId already exists.
   */
  createEntityInstance(
    definitionId,
    { instanceId, componentOverrides = {} } = {}
  ) {
    if (!definitionId || typeof definitionId !== 'string') {
      const msg = 'definitionId must be a non-empty string.';
      this.#logger.error(msg);
      throw new TypeError(msg);
    }

    const definition = this.#getDefinition(definitionId);
    if (!definition) {
      // No need to log here, #getDefinition already logs if invalid definitionId is passed
      // and DefinitionNotFoundError is specific.
      throw new DefinitionNotFoundError(definitionId);
    }

    const actualInstanceId =
      instanceId && MapManager.isValidId(instanceId)
        ? instanceId
        : this.#idGenerator();

    // Check for duplicate instanceId BEFORE any other operations
    if (this.#mapManager.has(actualInstanceId)) {
      const msg = `Entity with ID '${actualInstanceId}' already exists.`;
      this.#logger.error(msg);
      throw new Error(msg); // Ensure this exact message is thrown
    }

    this.#logger.debug(
      `Creating entity instance ${actualInstanceId} from definition ${definitionId}.`
    );

    // Validate componentOverrides BEFORE creating EntityInstanceData
    const validatedOverrides = {};
    if (componentOverrides && typeof componentOverrides === 'object') {
      for (const [compType, compData] of Object.entries(componentOverrides)) {
        // This will throw if validation fails, halting creation.
        const errorContextPrefix = definition.hasComponent(compType)
          ? 'Override for component'
          : 'New component';
        const errorContext = `${errorContextPrefix} ${compType} on entity ${actualInstanceId}`;
        validatedOverrides[compType] = this.#validateAndClone(
          compType,
          compData,
          errorContext
        );
      }
    }

    // Initialise Entity with its definition, a new instance ID, and validated overrides.
    const entityInstanceDataObject = new EntityInstanceData(
      actualInstanceId,
      definition,
      validatedOverrides
    );
    // Pass logger and validator to Entity constructor
    const entity = new Entity(
      entityInstanceDataObject,
      this.#logger,
      this.#validator
    );

    // Track the primary instance.
    this.#_trackEntity(entity);
    this.#injectDefaultComponents(entity); // Injects defaults if applicable

    // Dispatch event after successful creation and setup
    this.#eventDispatcher.dispatch(ENTITY_CREATED_ID, {
      entity,
      wasReconstructed: false,
    });

    this.#logger.info(
      `Entity instance '${actualInstanceId}' (def: '${definitionId}') created.`
    );
    return entity;
  }

  /**
   * Reconstructs an entity instance from a plain serializable object.
   *
   * @param {object} serializedEntity - Plain object from a save file.
   * @param {string} serializedEntity.instanceId
   * @param {string} serializedEntity.definitionId
   * @param {Record<string, object>} [serializedEntity.overrides]
   * @returns {Entity} The reconstructed Entity instance.
   * @throws {DefinitionNotFoundError} If the entity definition is not found.
   * @throws {Error} If component data is invalid, or if an entity with the given ID already exists.
   */
  reconstructEntity(serializedEntity) {
    this.#logger.debug(
      `[RECONSTRUCT_ENTITY_LOG] Attempting to reconstruct entity. Data: ${JSON.stringify(
        serializedEntity
      )}`
    );

    if (!serializedEntity || typeof serializedEntity !== 'object') {
      const msg =
        'EntityManager.reconstructEntity: serializedEntity data is missing or invalid.';
      this.#logger.error(msg);
      throw new Error(msg);
    }

    const {
      instanceId,
      definitionId,
      components,
      componentStates,
      tags,
      flags,
    } = serializedEntity;

    if (!MapManager.isValidId(instanceId)) {
      const msg =
        'EntityManager.reconstructEntity: instanceId is missing or invalid in serialized data.';
      this.#logger.error(msg);
      throw new Error(msg);
    }

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

    const validatedComponents = {};
    this.#logger.debug(
      `[RECONSTRUCT_ENTITY_LOG] About to validate components for entity '${instanceId}'. Components to process: ${JSON.stringify(
        components
      )}`
    );
    if (components && typeof components === 'object') {
      for (const [typeId, data] of Object.entries(components)) {
        this.#logger.debug(
          `[RECONSTRUCT_ENTITY_LOG] Validating component '${typeId}' for entity '${instanceId}'. Data: ${JSON.stringify(
            data
          )}`
        );
        if (data === null) {
          validatedComponents[typeId] = null;
        } else {
          const validationResult = this.#validator.validate(
            typeId,
            data,
            `Reconstruction component ${typeId} for entity ${instanceId} (definition ${definitionId})`
          );
          if (validationResult.isValid) {
            validatedComponents[typeId] = JSON.parse(JSON.stringify(data));
          } else {
            const errorMsg = `Reconstruction component ${typeId} for entity ${instanceId} (definition ${definitionId}) Errors: ${JSON.stringify(
              validationResult.errors
            )}`;
            this.#logger.error(errorMsg);
            throw new Error(errorMsg);
          }
        }
      }
    }

    this.#logger.debug(
      `[RECONSTRUCT_ENTITY_LOG] All components validated for entity '${instanceId}'.`
    );

    // Create and track the entity
    const instanceDataForReconstruction = new EntityInstanceData(
      instanceId, // Corrected: instanceId first
      definitionToUse, // Corrected: definition second
      JSON.parse(JSON.stringify(validatedComponents)) // Replaced structuredClone
      // Removed extra arguments: componentStates, tags, flags
    );
    const entity = new Entity(
      instanceDataForReconstruction,
      this.#logger,
      this.#validator
    );

    this.#_trackEntity(entity);

    this.#eventDispatcher.dispatch(ENTITY_CREATED_ID, {
      entity,
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

    // Capture the state of the component *before* the change.
    const oldComponentData = entity.getComponentData(componentTypeId);

    let validatedData;
    if (componentData === null) {
      validatedData = null;
    } else {
      validatedData = this.#validateAndClone(
        componentTypeId,
        componentData,
        `addComponent ${componentTypeId} to entity ${instanceId}`
      );
    }

    const updateSucceeded = entity.addComponent(componentTypeId, validatedData);

    if (!updateSucceeded) {
      this.#logger.warn(
        `EntityManager.addComponent: entity.addComponent returned false for '${componentTypeId}' on entity '${instanceId}'. This may indicate an internal issue.`
      );
      return false;
    }

    this.#eventDispatcher.dispatch(COMPONENT_ADDED_ID, {
      entity,
      componentTypeId,
      componentData: validatedData,
      oldComponentData, // Include old data in the event
    });

    this.#logger.debug(
      `Successfully added/updated component '${componentTypeId}' data on entity '${instanceId}'.`
    );

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

    // Capture the state of the component *before* it is removed.
    const oldComponentData = entity.getComponentData(componentTypeId);

    const successfullyRemovedOverride = entity.removeComponent(componentTypeId);

    if (successfullyRemovedOverride) {
      this.#eventDispatcher.dispatch(COMPONENT_REMOVED_ID, {
        entity,
        componentTypeId,
        oldComponentData, // Include old data in the event
      });

      this.#logger.debug(
        `EntityManager.removeComponent: Component override '${componentTypeId}' removed from entity '${instanceId}'.`
      );

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
      this.#logger.warn(
        `EntityManager.getComponentData: Called with invalid instanceId format: '${instanceId}'. Returning undefined.`
      );
      return undefined;
    }
    if (typeof componentTypeId !== 'string' || !componentTypeId.trim()) {
      this.#logger.warn(
        `EntityManager.getComponentData: Called with invalid componentTypeId format: '${componentTypeId}'. Returning undefined.`
      );
      return undefined;
    }
    const entity = this.#_getEntity(instanceId);
    if (!entity) {
      this.#logger.warn(
        `EntityManager.getComponentData: Entity not found with ID: '${instanceId}'. Returning undefined for component '${componentTypeId}'.`
      );
      return undefined;
    }
    return entity.getComponentData(componentTypeId);
  }

  hasComponent(instanceId, componentTypeId, checkOverrideOnly = false) {
    if (!MapManager.isValidId(instanceId)) {
      this.#logger.warn(
        `EntityManager.hasComponent: Called with invalid instanceId format: '${instanceId}'. Returning false.`
      );
      return false;
    }
    if (typeof componentTypeId !== 'string' || !componentTypeId.trim()) {
      this.#logger.warn(
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
      `EntityManager.getEntitiesWithComponent: Found ${
        results.length
      } entities with component '${componentTypeId}'.`
    );
    return results;
  }

  findEntities({ withAll = [], withAny = [], without = [] }) {
    const results = [];

    // A query must have at least one positive condition.
    if (withAll.length === 0 && withAny.length === 0) {
      this.#logger.warn(
        'EntityManager.findEntities called with no "withAll" or "withAny" conditions. Returning empty array.'
      );
      return [];
    }

    for (const entity of this.activeEntities.values()) {
      // 1. 'without' check (fastest rejection): If the entity has any component from the 'without' list, skip it.
      if (
        without.length > 0 &&
        without.some((componentTypeId) => entity.hasComponent(componentTypeId))
      ) {
        continue;
      }

      // 2. 'withAll' check: If the entity fails to have even one component from the 'withAll' list, skip it.
      if (
        withAll.length > 0 &&
        !withAll.every((componentTypeId) =>
          entity.hasComponent(componentTypeId)
        )
      ) {
        continue;
      }

      // 3. 'withAny' check: If a 'withAny' list is provided, the entity must have at least one component from it.
      if (
        withAny.length > 0 &&
        !withAny.some((componentTypeId) => entity.hasComponent(componentTypeId))
      ) {
        continue;
      }

      // If all checks pass, add the entity to the results.
      results.push(entity);
    }

    this.#logger.debug(
      `EntityManager.findEntities found ${results.length} entities for query.`
    );
    return results;
  }

  /**
   * Remove an entity instance from the manager.
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

    const removed = this.#mapManager.remove(entityToRemove.id);
    if (removed) {
      this.#logger.info(
        `Entity instance ${entityToRemove.id} removed from EntityManager.`
      );
      this.#eventDispatcher.dispatch(ENTITY_REMOVED_ID, {
        entity: entityToRemove,
      });
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
   * Clear all entities from the manager.
   * Also clears the entity definition cache.
   */
  clearAll() {
    this.#mapManager.clear();
    this.#logger.info('All entity instances removed from EntityManager.');

    this.#definitionCache.clear();
    this.#logger.info('Entity definition cache cleared.');
  }
}

export default EntityManager;
