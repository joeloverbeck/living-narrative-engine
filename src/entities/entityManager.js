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
import { MapManager } from '../utils/mapManagerUtils.js';
import EntityFactory from './factories/entityFactory.js';
import {
  validationSucceeded,
  formatValidationErrors,
} from './utils/validationHelpers.js';
import EntityQuery from '../query/EntityQuery.js';
import {
  assertValidId,
  assertNonBlankString,
} from '../utils/parameterGuards.js';
import { IEntityManager } from '../interfaces/IEntityManager.js';
import { validateDependency } from '../utils/validationUtils.js';
import { ensureValidLogger } from '../utils';
import { isNonBlankString } from '../utils/textUtils.js';
import { DefinitionNotFoundError } from '../errors/definitionNotFoundError.js';
import { EntityNotFoundError } from '../errors/entityNotFoundError';
import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
import { DuplicateEntityError } from '../errors/duplicateEntityError.js';
import { ValidationError } from '../errors/validationError.js';
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
// validationSucceeded and formatValidationErrors imported from
// ./utils/validationHelpers.js

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

  /** @type {EntityFactory} @private */
  #factory;

  /**
   * Getter that returns an iterator over all active entities.
   * This provides read-only access to the entity collection.
   *
   * @returns {IterableIterator<Entity>} Iterator over all active entities
   */
  get entities() {
    return this.#mapManager.values();
  }

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
    this.#definitionCache = new Map();

    // Initialize the EntityFactory
    this.#factory = new EntityFactory({
      validator: this.#validator,
      logger: this.#logger,
      idGenerator: this.#idGenerator,
      cloner: this.#cloner,
      defaultPolicy: {}, // Default component policy
    });

    this.#logger.debug('EntityManager initialised.');
  }

  /**
   * Retrieves an entity instance without throwing an error if not found.
   *
   * @param {string} instanceId - The ID of the entity instance.
   * @returns {Entity | undefined} The entity instance or undefined if not found.
   * @private
   */
  #getEntityById(instanceId) {
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
   * Retrieves an entity definition from the registry or cache.
   *
   * @private
   * @param {string} definitionId - The ID of the entity definition.
   * @returns {EntityDefinition|null} The entity definition or null if not found.
   */
  #getDefinition(definitionId) {
    try {
      assertValidId(definitionId, 'EntityManager.#getDefinition', this.#logger);
    } catch (error) {
      this.#logger.warn(
        `EntityManager.#getDefinition called with invalid definitionId: '${definitionId}'`
      );
      return null;
    }
    if (this.#definitionCache.has(definitionId)) {
      return this.#definitionCache.get(definitionId);
    }
    const definition = this.#registry.getEntityDefinition(definitionId);
    console.log('[DEBUG EntityManager] definition for', definitionId, 'is', definition, 'instanceof EntityDefinition?', definition instanceof (typeof EntityDefinition !== 'undefined' ? EntityDefinition : Object));
    if (definition) {
      this.#definitionCache.set(definitionId, definition);
      return definition;
    }
    this.#logger.warn(`Definition not found in registry: ${definitionId}`);
    return null;
  }

  /**
   * Validate parameters for {@link addComponent}.
   *
   * @private
   * @param {string} instanceId - Entity instance ID.
   * @param {string} componentTypeId - Component type ID.
   * @param {object} componentData - Raw component data.
   * @throws {InvalidArgumentError} If parameters are invalid.
   */
  #validateAddComponentParams(instanceId, componentTypeId, componentData) {
    try {
      assertValidId(instanceId, 'EntityManager.addComponent', this.#logger);
      assertNonBlankString(
        componentTypeId,
        'componentTypeId',
        'EntityManager.addComponent',
        this.#logger
      );
    } catch (error) {
      this.#logger.warn(
        `EntityManager.addComponent: Invalid parameters - instanceId: '${instanceId}', componentTypeId: '${componentTypeId}'`
      );
      throw new InvalidArgumentError(
        `EntityManager.addComponent: Invalid parameters - instanceId: '${instanceId}', componentTypeId: '${componentTypeId}'`,
        'instanceId/componentTypeId',
        { instanceId, componentTypeId }
      );
    }

    if (componentData === null) {
      const errorMsg = `EntityManager.addComponent: componentData cannot be null for ${componentTypeId} on ${instanceId}`;
      this.#logger.error(errorMsg, {
        componentTypeId,
        instanceId,
      });
      throw new InvalidArgumentError(errorMsg, 'componentData', componentData);
    }

    if (componentData !== undefined && typeof componentData !== 'object') {
      const receivedType = typeof componentData;
      const errorMsg = `EntityManager.addComponent: componentData for ${componentTypeId} on ${instanceId} must be an object. Received: ${receivedType}`;
      this.#logger.error(errorMsg, {
        componentTypeId,
        instanceId,
        receivedType,
      });
      throw new InvalidArgumentError(errorMsg, 'componentData', componentData);
    }
  }

  /**
   * Validate parameters for {@link removeComponent}.
   *
   * @private
   * @param {string} instanceId - Entity instance ID.
   * @param {string} componentTypeId - Component type ID.
   * @throws {InvalidArgumentError} If parameters are invalid.
   */
  #validateRemoveComponentParams(instanceId, componentTypeId) {
    try {
      assertValidId(instanceId, 'EntityManager.removeComponent', this.#logger);
      assertNonBlankString(
        componentTypeId,
        'componentTypeId',
        'EntityManager.removeComponent',
        this.#logger
      );
    } catch (error) {
      this.#logger.warn(
        `EntityManager.removeComponent: Invalid parameters - instanceId: '${instanceId}', componentTypeId: '${componentTypeId}'`
      );
      throw new InvalidArgumentError(
        `EntityManager.removeComponent: Invalid parameters - instanceId: '${instanceId}', componentTypeId: '${componentTypeId}'`,
        'instanceId/componentTypeId',
        { instanceId, componentTypeId }
      );
    }
  }

  /**
   * Validate serialized entity data prior to reconstruction.
   *
   * @private
   * @param {object} serializedEntity - Serialized entity object.
   * @throws {Error} If the data is malformed.
   */
  #validateReconstructEntityParams(serializedEntity) {
    if (!serializedEntity || typeof serializedEntity !== 'object') {
      const msg =
        'EntityManager.reconstructEntity: serializedEntity data is missing or invalid.';
      this.#logger.error(msg);
      throw new Error(msg);
    }
    if (!isNonBlankString(serializedEntity.instanceId)) {
      const msg =
        'EntityManager.reconstructEntity: instanceId is missing or invalid in serialized data.';
      this.#logger.error(msg);
      throw new Error(msg);
    }
  }

  /**
   * Translate errors from {@link EntityFactory} to maintain legacy messages.
   *
   * @private
   * @param {Error} err - Original error thrown by the factory.
   * @throws {Error|DuplicateEntityError}
   */
  #handleReconstructionError(err) {
    if (
      err instanceof Error &&
      err.message.startsWith(
        'EntityFactory.reconstruct: serializedEntity data is missing or invalid.'
      )
    ) {
      const msg =
        'EntityManager.reconstructEntity: serializedEntity data is missing or invalid.';
      this.#logger.error(msg);
      return new Error(msg);
    }
    if (
      err instanceof Error &&
      err.message.startsWith(
        'EntityFactory.reconstruct: instanceId is missing or invalid in serialized data.'
      )
    ) {
      const msg =
        'EntityManager.reconstructEntity: instanceId is missing or invalid in serialized data.';
      this.#logger.error(msg);
      return new Error(msg);
    }
    if (
      err instanceof Error &&
      err.message.startsWith('EntityFactory.reconstruct: Entity with ID')
    ) {
      const match = err.message.match(
        /EntityFactory\.reconstruct: (Entity with ID '.*? already exists\. Reconstruction aborted\.)/
      );
      if (match) {
        const msg = `EntityManager.reconstructEntity: ${match[1]}`;
        this.#logger.error(msg);
        const entityMatch = match[1].match(
          /Entity with ID '([^']+)' already exists/
        );
        if (entityMatch) {
          return new DuplicateEntityError(entityMatch[1], msg);
        }
        return new DuplicateEntityError('unknown', msg);
      }
    }
    return err instanceof Error ? err : new Error(String(err));
  }

  /* ---------------------------------------------------------------------- */
  /* Entity Creation                                                         */

  /* ---------------------------------------------------------------------- */

  /**
   * Create a new entity instance from a definition.
   *
   * @param {string} definitionId - The ID of the entity definition to use.
   * @param {object} opts - Options for entity creation.
   * @param {string} [opts.instanceId] - Optional. A specific ID for the new instance. If not provided, a UUID will be generated.
   * @param {Object<string, object>} [opts.componentOverrides] - Optional. A map of component data to override or add.
   * @returns {Entity} The newly created entity instance.
   * @throws {DefinitionNotFoundError} If the definition is not found.
   * @throws {DuplicateEntityError} If an entity with the given instanceId already exists.
   * @throws {InvalidArgumentError} If definitionId is invalid.
   * @throws {ValidationError} If component data validation fails.
   */
  createEntityInstance(definitionId, opts = {}) {
    try {
      try {
        assertValidId(
          definitionId,
          'EntityManager.createEntityInstance',
          this.#logger
        );
      } catch (err) {
        if (err && err.name === 'InvalidArgumentError') {
          const msg =
            "EntityManager.createEntityInstance: invalid definitionId '" +
            definitionId +
            "'";
          this.#logger.warn(msg);
          throw new InvalidArgumentError(msg, 'definitionId', definitionId);
        }
        throw err;
      }

      const definition = this.#getDefinition(definitionId);
      if (!definition) {
        throw new DefinitionNotFoundError(definitionId);
      }
      const entity = this.#factory.create(
        definitionId,
        opts,
        this.#registry,
        this.#mapManager,
        definition
      );
      // Track the primary instance.
      this.#mapManager.add(entity.id, entity);
      this.#logger.debug(`Tracked entity ${entity.id}`);
      // Dispatch event after successful creation and setup
      this.#eventDispatcher.dispatch(ENTITY_CREATED_ID, {
        entity,
        wasReconstructed: false,
      });
      return entity;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Entity with ID')) {
        this.#logger.error(err.message);
        // Extract the entity ID from the error message and throw DuplicateEntityError
        const match = err.message.match(
          /Entity with ID '([^']+)' already exists/
        );
        if (match) {
          throw new DuplicateEntityError(match[1], err.message);
        }
        throw new DuplicateEntityError('unknown', err.message);
      }
      throw err;
    }
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
   * @throws {DuplicateEntityError} If an entity with the given ID already exists.
   * @throws {ValidationError} If component data validation fails.
   * @throws {Error} If serializedEntity data is invalid.
   */
  reconstructEntity(serializedEntity) {
    this.#validateReconstructEntityParams(serializedEntity);
    try {
      const entity = this.#factory.reconstruct(
        serializedEntity,
        this.#registry,
        this.#mapManager
      );
      this.#mapManager.add(entity.id, entity);
      this.#logger.debug(`Tracked entity ${entity.id}`);
      this.#eventDispatcher.dispatch(ENTITY_CREATED_ID, {
        entity,
        wasReconstructed: true,
      });
      return entity;
    } catch (err) {
      throw this.#handleReconstructionError(err);
    }
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
   * @throws {InvalidArgumentError} If parameters are invalid.
   * @throws {ValidationError} If component data validation fails.
   */
  addComponent(instanceId, componentTypeId, componentData) {
    this.#validateAddComponentParams(
      instanceId,
      componentTypeId,
      componentData
    );

    const entity = this.#getEntityById(instanceId);
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
    if (componentData === undefined) {
      validatedData = undefined;
    } else {
      try {
        validatedData = this.#validateAndClone(
          componentTypeId,
          componentData,
          `addComponent ${componentTypeId} to entity ${instanceId}`
        );
      } catch (error) {
        // Convert generic validation errors to ValidationError
        throw new ValidationError(
          error.message,
          componentTypeId,
          error.validationErrors
        );
      }
    }

    const updateSucceeded = entity.addComponent(componentTypeId, validatedData);

    if (!updateSucceeded) {
      this.#logger.warn(
        `EntityManager.addComponent: entity.addComponent returned false for '${componentTypeId}' on entity '${instanceId}'. This may indicate an internal issue.`
      );
      throw new Error(
        `Failed to add component '${componentTypeId}' to entity '${instanceId}'. Internal entity update failed.`
      );
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
  }

  /**
   * Removes a component override from an existing entity instance.
   *
   * @param {string} instanceId - The ID of the entity instance.
   * @param {string} componentTypeId - The unique ID of the component type to remove.
   * @throws {EntityNotFoundError} If entity not found.
   * @throws {InvalidArgumentError} If parameters are invalid.
   * @throws {Error} If component override does not exist or removal fails.
   */
  removeComponent(instanceId, componentTypeId) {
    this.#validateRemoveComponentParams(instanceId, componentTypeId);

    const entity = this.#getEntityById(instanceId);
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
      throw new Error(
        `Component '${componentTypeId}' not found as an override on entity '${instanceId}'. Nothing to remove at instance level.`
      );
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
    } else {
      this.#logger.warn(
        `EntityManager.removeComponent: entity.removeComponent('${componentTypeId}') returned false for entity '${instanceId}' when an override was expected and should have been removable. This may indicate an issue in Entity class logic.`
      );
      throw new Error(
        `Failed to remove component '${componentTypeId}' from entity '${instanceId}'. Internal entity removal failed.`
      );
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Query / Utility Methods                                                 */

  /* ---------------------------------------------------------------------- */

  getEntityInstance(instanceId) {
    try {
      assertValidId(
        instanceId,
        'EntityManager.getEntityInstance',
        this.#logger
      );
    } catch (error) {
      this.#logger.debug(
        `EntityManager.getEntityInstance: Called with invalid ID format: '${instanceId}'. Returning undefined.`
      );
      return undefined;
    }
    const entity = this.#getEntityById(instanceId);
    if (!entity) {
      this.#logger.debug(
        `EntityManager.getEntityInstance: Entity not found with ID: '${instanceId}'. Returning undefined.`
      );
      return undefined;
    }
    return entity;
  }

  getComponentData(instanceId, componentTypeId) {
    try {
      assertValidId(instanceId, 'EntityManager.getComponentData', this.#logger);
      assertNonBlankString(
        componentTypeId,
        'componentTypeId',
        'EntityManager.getComponentData',
        this.#logger
      );
    } catch (error) {
      this.#logger.warn(
        `EntityManager.getComponentData: Invalid parameters - instanceId: '${instanceId}', componentTypeId: '${componentTypeId}'. Returning undefined.`
      );
      throw new InvalidArgumentError(
        `EntityManager.getComponentData: Invalid parameters - instanceId: '${instanceId}', componentTypeId: '${componentTypeId}'`,
        'instanceId/componentTypeId',
        { instanceId, componentTypeId }
      );
    }
    const entity = this.#getEntityById(instanceId);
    if (!entity) {
      this.#logger.warn(
        `EntityManager.getComponentData: Entity not found with ID: '${instanceId}'. Returning undefined for component '${componentTypeId}'.`
      );
      return undefined;
    }
    return entity.getComponentData(componentTypeId);
  }

  /**
   * Checks if an entity has data associated with a specific component type ID.
   * This includes both definition components and overrides.
   *
   * @param {string} instanceId - The ID (UUID) of the entity.
   * @param {string} componentTypeId - The unique string ID of the component type.
   * @param {boolean} [checkOverrideOnly] - If true, only check for component overrides, not definition components.
   * @returns {boolean} True if the entity has the component data, false otherwise.
   * @throws {InvalidArgumentError} If parameters are invalid.
   */
  hasComponent(instanceId, componentTypeId, checkOverrideOnly = false) {
    // Handle the deprecated 3-parameter call
    if (arguments.length === 3) {
      this.#logger.warn(
        `EntityManager.hasComponent: The 3-parameter version is deprecated. Use hasComponentOverride(instanceId, componentTypeId) instead of hasComponent(instanceId, componentTypeId, true).`
      );
      if (checkOverrideOnly) {
        return this.hasComponentOverride(instanceId, componentTypeId);
      }
    }

    try {
      assertValidId(instanceId, 'EntityManager.hasComponent', this.#logger);
      assertNonBlankString(
        componentTypeId,
        'componentTypeId',
        'EntityManager.hasComponent',
        this.#logger
      );
    } catch (error) {
      this.#logger.warn(
        `EntityManager.hasComponent: Invalid parameters - instanceId: '${instanceId}', componentTypeId: '${componentTypeId}'. Returning false.`
      );
      throw new InvalidArgumentError(
        `EntityManager.hasComponent: Invalid parameters - instanceId: '${instanceId}', componentTypeId: '${componentTypeId}'`,
        'instanceId/componentTypeId',
        { instanceId, componentTypeId }
      );
    }
    const entity = this.#getEntityById(instanceId);
    return entity ? entity.hasComponent(componentTypeId, false) : false;
  }

  /**
   * Checks if an entity has a component override (instance-level component data).
   * This excludes components that only exist on the definition.
   *
   * @param {string} instanceId - The ID (UUID) of the entity.
   * @param {string} componentTypeId - The unique string ID of the component type.
   * @returns {boolean} True if the entity has a component override, false otherwise.
   * @throws {InvalidArgumentError} If parameters are invalid.
   */
  hasComponentOverride(instanceId, componentTypeId) {
    try {
      assertValidId(
        instanceId,
        'EntityManager.hasComponentOverride',
        this.#logger
      );
      assertNonBlankString(
        componentTypeId,
        'componentTypeId',
        'EntityManager.hasComponentOverride',
        this.#logger
      );
    } catch (error) {
      this.#logger.warn(
        `EntityManager.hasComponentOverride: Invalid parameters - instanceId: '${instanceId}', componentTypeId: '${componentTypeId}'. Returning false.`
      );
      throw new InvalidArgumentError(
        `EntityManager.hasComponentOverride: Invalid parameters - instanceId: '${instanceId}', componentTypeId: '${componentTypeId}'`,
        'instanceId/componentTypeId',
        { instanceId, componentTypeId }
      );
    }
    const entity = this.#getEntityById(instanceId);
    return entity ? entity.hasComponent(componentTypeId, true) : false;
  }

  /**
   * Return **new array** of entities that possess `componentTypeId`.
   * Logs diagnostic info for engine analytics / debugging.
   *
   * @param {*} componentTypeId
   * @returns {Entity[]} fresh array (never a live reference)
   * @throws {InvalidArgumentError} If componentTypeId is invalid.
   */
  getEntitiesWithComponent(componentTypeId) {
    try {
      assertNonBlankString(
        componentTypeId,
        'componentTypeId',
        'EntityManager.getEntitiesWithComponent',
        this.#logger
      );
    } catch (error) {
      this.#logger.debug(
        `EntityManager.getEntitiesWithComponent: Received invalid componentTypeId ('${componentTypeId}'). Returning empty array.`
      );
      throw new InvalidArgumentError(
        `EntityManager.getEntitiesWithComponent: Received invalid componentTypeId ('${componentTypeId}')`,
        'componentTypeId',
        componentTypeId
      );
    }
    const results = [];
    for (const entity of this.entities) {
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

  findEntities(queryObj) {
    const q = new EntityQuery(queryObj);

    // A query must have at least one positive condition.
    if (!q.hasPositiveConditions()) {
      this.#logger.warn(
        'EntityManager.findEntities called with no "withAll" or "withAny" conditions. Returning empty array.'
      );
      return [];
    }

    const results = [...this.entities].filter((e) => q.matches(e));

    this.#logger.debug(
      `EntityManager.findEntities found ${results.length} entities for query.`
    );
    return results;
  }

  /**
   * Remove an entity instance from the manager.
   *
   * @param {string} instanceId - The ID of the entity instance to remove.
   * @throws {EntityNotFoundError} If the entity is not found.
   * @throws {InvalidArgumentError} If the instanceId is invalid.
   * @throws {Error} If internal removal operation fails.
   */
  removeEntityInstance(instanceId) {
    try {
      assertValidId(
        instanceId,
        'EntityManager.removeEntityInstance',
        this.#logger
      );
    } catch (error) {
      this.#logger.warn(
        `EntityManager.removeEntityInstance: Attempted to remove entity with invalid ID: '${instanceId}'`
      );
      throw new InvalidArgumentError(
        `EntityManager.removeEntityInstance: Attempted to remove entity with invalid ID: '${instanceId}'`,
        'instanceId',
        instanceId
      );
    }

    const entityToRemove = this.#getEntityById(instanceId);
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
    } else {
      this.#logger.error(
        `EntityManager.removeEntityInstance: MapManager.remove failed for already retrieved entity '${instanceId}'. This indicates a serious internal inconsistency.`
      );
      // This path should ideally not be reachable if `getEntityById` succeeded, but throwing an error is safer.
      throw new Error(
        `Internal error: Failed to remove entity '${instanceId}' from MapManager despite entity being found.`
      );
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
