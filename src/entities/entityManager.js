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

import { createDefaultDeps } from './utils/createDefaultDeps.js';
import Entity from './entity.js';
import EntityInstanceData from './entityInstanceData.js';
import EntityFactory from './factories/entityFactory.js';
import EntityRepositoryAdapter from './services/entityRepositoryAdapter.js';
import ComponentMutationService from './services/componentMutationService.js';
import ErrorTranslator from './services/errorTranslator.js';
import DefinitionCache from './services/definitionCache.js';
import EntityLifecycleManager from './services/entityLifecycleManager.js';
import { createDefaultServices } from './utils/createDefaultServices.js';
import {
  validateGetEntityInstanceParams as validateGetEntityInstanceParamsUtil,
  validateGetComponentDataParams as validateGetComponentDataParamsUtil,
  validateHasComponentParams as validateHasComponentParamsUtil,
  validateHasComponentOverrideParams as validateHasComponentOverrideParamsUtil,
  validateGetEntitiesWithComponentParams as validateGetEntitiesWithComponentParamsUtil,
} from './utils/parameterValidators.js';
import EntityQuery from '../query/EntityQuery.js';
import { assertValidId } from '../utils/parameterGuards.js';
import { IEntityManager } from '../interfaces/IEntityManager.js';
import { validateDependency } from '../utils/validationUtils.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';
import { DefinitionNotFoundError } from '../errors/definitionNotFoundError.js';
import { EntityNotFoundError } from '../errors/entityNotFoundError';
import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
import { DuplicateEntityError } from '../errors/duplicateEntityError.js';
import { ValidationError } from '../errors/validationError.js';
import { ENTITY_CREATED_ID, ENTITY_REMOVED_ID } from '../constants/eventIds.js';

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
/** @typedef {import('./services/definitionCache.js').DefinitionCache} DefinitionCache */

/* -------------------------------------------------------------------------- */
/* Internal Utilities                                                         */

/* -------------------------------------------------------------------------- */
// validateAndCloneUtil imported from
// ./utils/componentValidation.js

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
  /** @type {IComponentCloner} @private */
  #cloner;
  /** @type {IDefaultComponentPolicy} @private */
  #defaultPolicy;

  /** @type {EntityRepositoryAdapter} @private */
  #entityRepository;

  /** @type {ComponentMutationService} @private */
  #componentMutationService;

  /** @type {ErrorTranslator} @private */
  #errorTranslator;

  /** @type {DefinitionCache} @private */
  #definitionCache;

  /** @type {EntityFactory} @private */
  #factory;

  /** @type {EntityLifecycleManager} @private */
  #lifecycleManager;

  /**
   * Getter that returns an iterator over all active entities.
   * This provides read-only access to the entity collection.
   *
   * @returns {IterableIterator<Entity>} Iterator over all active entities
   */
  get entities() {
    return this.#entityRepository.entities();
  }

  /**
   * Returns an array of all active entity IDs.
   *
   * @returns {string[]} Array of entity instance IDs.
   */
  getEntityIds() {
    return Array.from(this.entities, (e) => e.id);
  }

  /**
   * @class
   * @param {object} [deps] - Constructor dependencies. Each dependency may be
   *   provided as an instance or a zero-argument factory function. Any omitted
   *   dependency will use the default from {@link createDefaultDeps}.
   * @param {IDataRegistry}        deps.registry - Data registry for definitions.
   * @param {ISchemaValidator}     deps.validator - Schema validator instance.
   * @param {ILogger}              deps.logger - Logger implementation.
   * @param {ISafeEventDispatcher} deps.dispatcher - Event dispatcher.
   * @param {IIdGenerator}         [deps.idGenerator] - ID generator function.
   * @param {Function}             [deps.idGeneratorFactory] - Factory for the ID generator.
   * @param {IComponentCloner}     [deps.cloner] - Component deep cloner.
   * @param {Function}             [deps.clonerFactory] - Factory for the cloner.
   * @param {IDefaultComponentPolicy} [deps.defaultPolicy] - Default component injection policy.
   * @param {Function}             [deps.defaultPolicyFactory] - Factory for the default component policy.
   * @param {EntityRepositoryAdapter} [deps.entityRepository] - EntityRepositoryAdapter instance.
   * @param {ComponentMutationService} [deps.componentMutationService] - ComponentMutationService instance.
   * @param {ErrorTranslator} [deps.errorTranslator] - ErrorTranslator instance.
   * @param {EntityFactory} [deps.entityFactory] - EntityFactory instance.
   * @param deps.entityLifecycleManager
   * @param {DefinitionCache} [deps.definitionCache] - DefinitionCache instance.
   * @throws {Error} If any dependency is missing or malformed.
   */
  constructor({
    registry,
    validator,
    logger,
    dispatcher,
    idGenerator,
    idGeneratorFactory,
    cloner,
    clonerFactory,
    defaultPolicy,
    defaultPolicyFactory,
    entityRepository,
    componentMutationService,
    errorTranslator,
    entityFactory,
    definitionCache,
    entityLifecycleManager,
  } = {}) {
    super();

    const defaults = createDefaultDeps({
      idGeneratorFactory,
      clonerFactory,
      defaultPolicyFactory,
    });
    const resolveDep = (dep, defaultDep) => {
      if (dep === undefined || dep === null) return defaultDep;
      if (typeof defaultDep !== 'function' && typeof dep === 'function') {
        return dep();
      }
      return dep;
    };

    idGenerator = resolveDep(idGenerator, defaults.idGenerator);
    cloner = resolveDep(cloner, defaults.cloner);
    defaultPolicy = resolveDep(defaultPolicy, defaults.defaultPolicy);

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
    this.#validator = validator;
    this.#logger = ensureValidLogger(logger, 'EntityManager');
    this.#eventDispatcher = dispatcher;
    this.#idGenerator = idGenerator;
    this.#cloner = cloner;
    this.#defaultPolicy = defaultPolicy;

    const serviceDefaults = createDefaultServices({
      registry: this.#registry,
      validator: this.#validator,
      logger: this.#logger,
      eventDispatcher: this.#eventDispatcher,
      idGenerator: this.#idGenerator,
      cloner: this.#cloner,
      defaultPolicy: this.#defaultPolicy,
    });

    this.#entityRepository = resolveDep(
      entityRepository,
      serviceDefaults.entityRepository
    );
    this.#componentMutationService = resolveDep(
      componentMutationService,
      serviceDefaults.componentMutationService
    );
    this.#errorTranslator = resolveDep(
      errorTranslator,
      serviceDefaults.errorTranslator
    );
    this.#factory = resolveDep(entityFactory, serviceDefaults.entityFactory);
    this.#definitionCache = resolveDep(
      definitionCache,
      serviceDefaults.definitionCache
    );
    this.#lifecycleManager = resolveDep(
      entityLifecycleManager,
      serviceDefaults.entityLifecycleManager
    );

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
    return this.#entityRepository.get(instanceId);
  }

  /**
   * @description Validates parameters for {@link createEntityInstance}.
   * @private
   * @param {string} definitionId - The ID of the entity definition.
   * @throws {InvalidArgumentError} If the definitionId is invalid.
   */
  #validateCreateEntityParams(definitionId) {
    try {
      assertValidId(
        definitionId,
        'EntityManager.createEntityInstance',
        this.#logger
      );
    } catch (err) {
      if (err && err.name === 'InvalidArgumentError') {
        const msg = `EntityManager.createEntityInstance: invalid definitionId '${definitionId}'`;
        this.#logger.warn(msg);
        throw new InvalidArgumentError(msg, 'definitionId', definitionId);
      }
      throw err;
    }
  }

  /**
   * @description Retrieves an entity definition or throws.
   * @private
   * @param {string} definitionId - ID of the entity definition.
   * @returns {EntityDefinition} The definition data.
   * @throws {DefinitionNotFoundError} If the definition is missing.
   */
  #getDefinitionForCreate(definitionId) {
    const definition = this.#definitionCache.get(definitionId);
    if (!definition) {
      throw new DefinitionNotFoundError(definitionId);
    }
    return definition;
  }

  /**
   * @description Constructs a new entity instance using the factory.
   * @private
   * @param {string} definitionId - Definition ID.
   * @param {object} opts - Creation options.
   * @param {EntityDefinition} definition - Resolved definition object.
   * @returns {Entity} Newly constructed entity.
   */
  #constructEntity(definitionId, opts, definition) {
    return this.#factory.create(
      definitionId,
      opts,
      this.#registry,
      this.#entityRepository,
      definition
    );
  }

  /**
   * @description Dispatches the ENTITY_CREATED event for a new entity.
   * @private
   * @param {Entity} entity - The newly created entity instance.
   */
  #dispatchEntityCreated(entity) {
    this.#eventDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: entity.id,
      definitionId: entity.definitionId,
      wasReconstructed: false,
      entity,
    });
  }

  /**
   * Retrieves an entity definition from the registry or cache.
   *
   * @private
   * @param {string} definitionId - The ID of the entity definition.
   * @returns {EntityDefinition|null} The entity definition, or null when the
   * definitionId is invalid or the definition is missing.
   */

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
    return this.#lifecycleManager.createEntityInstance(definitionId, opts);
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
    return this.#lifecycleManager.reconstructEntity(serializedEntity);
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
   * @returns {boolean} True if the component was added or updated successfully, false otherwise.
   * @throws {EntityNotFoundError} If entity not found.
   * @throws {InvalidArgumentError} If parameters are invalid.
   * @throws {ValidationError} If component data validation fails.
   */
  addComponent(instanceId, componentTypeId, componentData) {
    return this.#componentMutationService.addComponent(
      instanceId,
      componentTypeId,
      componentData
    );
  }

  /**
   * Removes a component override from an existing entity instance.
   *
   * @param {string} instanceId - The ID of the entity instance.
   * @param {string} componentTypeId - The unique ID of the component type to remove.
   * @throws {EntityNotFoundError} If entity not found.
   * @throws {InvalidArgumentError} If parameters are invalid.
   * @throws {ComponentOverrideNotFoundError} If component override does not exist.
   * @throws {Error} If removal fails.
   */
  removeComponent(instanceId, componentTypeId) {
    this.#componentMutationService.removeComponent(instanceId, componentTypeId);
  }

  /* ---------------------------------------------------------------------- */
  /* Query / Utility Methods                                                 */

  /* ---------------------------------------------------------------------- */

  /**
   * Retrieve an entity instance by its ID.
   *
   * @param {string} instanceId - The ID of the entity instance.
   * @returns {Entity|undefined} The entity if found, otherwise undefined.
   * @throws {InvalidArgumentError} If the instanceId is invalid.
   * @see validateGetEntityInstanceParams
   */
  getEntityInstance(instanceId) {
    validateGetEntityInstanceParamsUtil(instanceId, this.#logger);
    const entity = this.#getEntityById(instanceId);
    if (!entity) {
      this.#logger.debug(
        `EntityManager.getEntityInstance: Entity not found with ID: '${instanceId}'. Returning undefined.`
      );
      return undefined;
    }
    return entity;
  }

  /**
   * Retrieve component data for a specific entity.
   *
   * @param {string} instanceId - Entity instance ID.
   * @param {string} componentTypeId - Component type ID.
   * @returns {object|undefined} Component data or undefined if not found.
   * @throws {InvalidArgumentError} If parameters are invalid.
   * @see validateGetComponentDataParams
   */
  getComponentData(instanceId, componentTypeId) {
    validateGetComponentDataParamsUtil(
      instanceId,
      componentTypeId,
      this.#logger
    );
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
   * @see validateHasComponentParams
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

    validateHasComponentParamsUtil(instanceId, componentTypeId, this.#logger);
    const entity = this.#getEntityById(instanceId);
    return entity ? entity.hasComponent(componentTypeId) : false;
  }

  /**
   * Checks if an entity has a component override (instance-level component data).
   * This excludes components that only exist on the definition.
   *
   * @param {string} instanceId - The ID (UUID) of the entity.
   * @param {string} componentTypeId - The unique string ID of the component type.
   * @returns {boolean} True if the entity has a component override, false otherwise.
   * @throws {InvalidArgumentError} If parameters are invalid.
   * @see validateHasComponentOverrideParams
   */
  hasComponentOverride(instanceId, componentTypeId) {
    validateHasComponentOverrideParamsUtil(
      instanceId,
      componentTypeId,
      this.#logger
    );
    const entity = this.#getEntityById(instanceId);
    return entity ? entity.hasComponentOverride(componentTypeId) : false;
  }

  /**
   * Return **new array** of entities that possess `componentTypeId`.
   * Logs diagnostic info for engine analytics / debugging.
   *
   * @param {*} componentTypeId
   * @returns {Entity[]} fresh array (never a live reference)
   * @throws {InvalidArgumentError} If componentTypeId is invalid.
   * @see validateGetEntitiesWithComponentParams
   */
  getEntitiesWithComponent(componentTypeId) {
    validateGetEntitiesWithComponentParamsUtil(componentTypeId, this.#logger);
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
    const query = new EntityQuery(queryObj);

    // A query must have at least one positive condition.
    if (!query.hasPositiveConditions()) {
      this.#logger.warn(
        'EntityManager.findEntities called with no "withAll" or "withAny" conditions. Returning empty array.'
      );
      return [];
    }

    const results = [...this.entities].filter((e) => query.matches(e));

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
   * @see validateRemoveEntityInstanceParams
   */
  removeEntityInstance(instanceId) {
    return this.#lifecycleManager.removeEntityInstance(instanceId);
  }

  /**
   * Returns a list of all component type IDs attached to a given entity.
   *
   * @param {string} entityId The ID of the entity.
   * @returns {string[]} An array of component ID strings.
   * @throws {InvalidArgumentError} If the entityId is invalid.
   */
  getAllComponentTypesForEntity(entityId) {
    validateGetEntityInstanceParamsUtil(entityId, this.#logger);
    const entity = this.#getEntityById(entityId);
    if (!entity) {
      this.#logger.debug(
        `EntityManager.getAllComponentTypesForEntity: Entity not found with ID: '${entityId}'. Returning empty array.`
      );
      return [];
    }
    return entity.componentTypeIds;
  }

  /**
   * Clear all entities from the manager.
   * Also clears the entity definition cache.
   */
  clearAll() {
    this.#entityRepository.clear();
    this.#logger.info('All entity instances removed from EntityManager.');

    this.#definitionCache.clear();
    this.#logger.info('Entity definition cache cleared.');
  }
}

export default EntityManager;
