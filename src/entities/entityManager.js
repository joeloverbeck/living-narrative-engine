/**
 * @file Refactored EntityManager - Facade coordinator for specialized entity managers
 * @see src/entities/entityManager.js
 */

// -----------------------------------------------------------------------------
//  Living Narrative Engine – EntityManager (Refactored)
// -----------------------------------------------------------------------------
//  @description
//  Centralised facade and runtime registry for all Entity instances. Coordinates
//  specialized managers for creation, mutation, and querying while maintaining
//  backward compatibility with the original API.
//
//  @module EntityManager
//  @since   0.3.0
// -----------------------------------------------------------------------------

import { createDefaultDeps } from './utils/createDefaultDeps.js';
import { createDefaultServices } from './utils/createDefaultServices.js';
import { validateDependency } from '../utils/dependencyUtils.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';
import { IEntityManager } from '../interfaces/IEntityManager.js';
import EntityCreationManager from './managers/EntityCreationManager.js';
import EntityMutationManager from './managers/EntityMutationManager.js';
import EntityQueryManager from './managers/EntityQueryManager.js';

/* -------------------------------------------------------------------------- */
/* Type-Hint Imports (JSDoc only – removed at runtime)                        */
/* -------------------------------------------------------------------------- */

/** @typedef {import('./entityDefinition.js').default} EntityDefinition */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../ports/IEntityRepository.js').IEntityRepository} IEntityRepository */
/** @typedef {import('../ports/IComponentCloner.js').IComponentCloner} IComponentCloner */
/** @typedef {import('../ports/IIdGenerator.js').IIdGenerator} IIdGenerator */
/** @typedef {import('../ports/IDefaultComponentPolicy.js').IDefaultComponentPolicy} IDefaultComponentPolicy */
/** @typedef {import('./services/definitionCache.js').DefinitionCache} DefinitionCache */
/** @typedef {import('./entity.js').default} Entity */

/* -------------------------------------------------------------------------- */
/* EntityManager Implementation                                               */
/* -------------------------------------------------------------------------- */

/**
 * @class EntityManager
 * @augments {IEntityManager}
 * @description
 * Refactored runtime manager that coordinates specialized managers for:
 * • Entity creation and reconstruction (EntityCreationManager)
 * • Component mutations and entity removal (EntityMutationManager)
 * • Entity queries and lookups (EntityQueryManager)
 * • Maintains backward compatibility with original API
 */
class EntityManager extends IEntityManager {
  // Core dependencies
  #registry;
  #validator;
  #logger;
  #eventDispatcher;
  #idGenerator;
  #cloner;
  #defaultPolicy;

  // Services
  #entityRepository;
  #componentMutationService;
  #definitionCache;
  #lifecycleManager;

  // Specialized managers
  #creationManager;
  #mutationManager;
  #queryManager;

  /**
   * Getter that returns an iterator over all active entities.
   * This provides read-only access to the entity collection.
   *
   * @returns {IterableIterator<Entity>} Iterator over all active entities
   */
  get entities() {
    return this.#queryManager.entities;
  }

  /**
   * Returns an array of all active entity IDs.
   *
   * @returns {string[]} Array of entity instance IDs.
   */
  getEntityIds() {
    return this.#queryManager.getEntityIds();
  }

  /**
   * @class
   * @param {object} [deps] - Constructor dependencies
   * @param {IDataRegistry} deps.registry - Data registry for definitions
   * @param {ISchemaValidator} deps.validator - Schema validator instance
   * @param {ILogger} deps.logger - Logger implementation
   * @param {ISafeEventDispatcher} deps.dispatcher - Event dispatcher
   * @param {IIdGenerator} [deps.idGenerator] - ID generator function
   * @param {Function} [deps.idGeneratorFactory] - Factory for the ID generator
   * @param {IComponentCloner} [deps.cloner] - Component deep cloner
   * @param {Function} [deps.clonerFactory] - Factory for the cloner
   * @param {IDefaultComponentPolicy} [deps.defaultPolicy] - Default component injection policy
   * @param {Function} [deps.defaultPolicyFactory] - Factory for the default component policy
   * @param {object} [deps.entityRepository] - EntityRepositoryAdapter instance
   * @param {object} [deps.componentMutationService] - ComponentMutationService instance
   * @param {object} [deps.entityLifecycleManager] - EntityLifecycleManager instance
   * @param {DefinitionCache} [deps.definitionCache] - DefinitionCache instance
   * @throws {Error} If any dependency is missing or malformed
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
    definitionCache,
    entityLifecycleManager,
  } = {}) {
    super();

    this.#resolveDeps({
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
    });

    this.#initServices({
      entityRepository,
      componentMutationService,
      definitionCache,
      entityLifecycleManager,
    });

    this.#initSpecializedManagers();

    this.#logger.debug('EntityManager (refactored) initialized.');
  }

  /**
   * Resolve and validate core dependencies.
   *
   * @param {object} options - Dependency overrides and factories
   * @param options.registry
   * @param options.validator
   * @param options.logger
   * @param options.dispatcher
   * @param options.idGenerator
   * @param options.idGeneratorFactory
   * @param options.cloner
   * @param options.clonerFactory
   * @param options.defaultPolicy
   * @param options.defaultPolicyFactory
   */
  #resolveDeps({
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
  }) {
    const defaults = createDefaultDeps({
      idGeneratorFactory,
      clonerFactory,
      defaultPolicyFactory,
    });

    const resolveOptionalDependency = (dep, defaultDep) => {
      if (dep === undefined || dep === null) return defaultDep;
      if (typeof defaultDep !== 'function' && typeof dep === 'function') {
        return dep();
      }
      return dep;
    };

    idGenerator = resolveOptionalDependency(idGenerator, defaults.idGenerator);
    cloner = resolveOptionalDependency(cloner, defaults.cloner);
    defaultPolicy = resolveOptionalDependency(
      defaultPolicy,
      defaults.defaultPolicy
    );

    // Dependency validation
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
    this.#eventDispatcher = dispatcher;
    this.#idGenerator = idGenerator;
    this.#cloner = cloner;
    this.#defaultPolicy = defaultPolicy;
  }

  /**
   * Initialize service instances.
   *
   * @param {object} overrides - Optional service overrides
   * @param overrides.entityRepository
   * @param overrides.componentMutationService
   * @param overrides.definitionCache
   * @param overrides.entityLifecycleManager
   */
  #initServices({
    entityRepository,
    componentMutationService,
    definitionCache,
    entityLifecycleManager,
  }) {
    const serviceDefaults = createDefaultServices({
      registry: this.#registry,
      validator: this.#validator,
      logger: this.#logger,
      eventDispatcher: this.#eventDispatcher,
      idGenerator: this.#idGenerator,
      cloner: this.#cloner,
      defaultPolicy: this.#defaultPolicy,
    });

    const resolveOptionalDependency = (dep, defaultDep) => {
      if (dep === undefined || dep === null) return defaultDep;
      if (typeof defaultDep !== 'function' && typeof dep === 'function') {
        return dep();
      }
      return dep;
    };

    this.#entityRepository = resolveOptionalDependency(
      entityRepository,
      serviceDefaults.entityRepository
    );
    this.#componentMutationService = resolveOptionalDependency(
      componentMutationService,
      serviceDefaults.componentMutationService
    );
    this.#definitionCache = resolveOptionalDependency(
      definitionCache,
      serviceDefaults.definitionCache
    );
    this.#lifecycleManager = resolveOptionalDependency(
      entityLifecycleManager,
      serviceDefaults.entityLifecycleManager
    );
  }

  /**
   * Initialize specialized manager instances.
   */
  #initSpecializedManagers() {
    this.#creationManager = new EntityCreationManager({
      lifecycleManager: this.#lifecycleManager,
      logger: this.#logger,
    });

    this.#mutationManager = new EntityMutationManager({
      componentMutationService: this.#componentMutationService,
      lifecycleManager: this.#lifecycleManager,
      logger: this.#logger,
    });

    this.#queryManager = new EntityQueryManager({
      entityRepository: this.#entityRepository,
      logger: this.#logger,
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Entity Creation (Delegated to EntityCreationManager)                  */
  /* ---------------------------------------------------------------------- */

  /**
   * Create a new entity instance from a definition.
   *
   * @param {string} definitionId - The ID of the entity definition to use
   * @param {object} opts - Options for entity creation
   * @param {string} [opts.instanceId] - Optional specific ID for the new instance
   * @param {Object<string, object>} [opts.componentOverrides] - Optional component data overrides
   * @returns {Promise<Entity>} The newly created entity instance
   * @throws {DefinitionNotFoundError} If the definition is not found
   * @throws {DuplicateEntityError} If an entity with the given instanceId already exists
   * @throws {InvalidArgumentError} If definitionId is invalid
   * @throws {ValidationError} If component data validation fails
   */
  async createEntityInstance(definitionId, opts = {}) {
    return await this.#creationManager.createEntityInstance(definitionId, opts);
  }

  /**
   * Reconstructs an entity instance from a plain serializable object.
   *
   * @param {object} serializedEntity - Plain object from a save file
   * @param {string} serializedEntity.instanceId
   * @param {string} serializedEntity.definitionId
   * @param {Record<string, object>} [serializedEntity.overrides]
   * @returns {Entity} The reconstructed Entity instance
   * @throws {DefinitionNotFoundError} If the entity definition is not found
   * @throws {DuplicateEntityError} If an entity with the given ID already exists
   * @throws {ValidationError} If component data validation fails
   * @throws {Error} If serializedEntity data is invalid
   */
  reconstructEntity(serializedEntity) {
    return this.#creationManager.reconstructEntity(serializedEntity);
  }

  /* ---------------------------------------------------------------------- */
  /* Component Mutations (Delegated to EntityMutationManager)              */
  /* ---------------------------------------------------------------------- */

  /**
   * Adds or updates a component on an existing entity instance.
   *
   * @param {string} instanceId - The ID of the entity instance
   * @param {string} componentTypeId - The unique ID of the component type
   * @param {object} componentData - The data for the component
   * @returns {Promise<boolean>} True if the component was added or updated successfully
   * @throws {EntityNotFoundError} If entity not found
   * @throws {InvalidArgumentError} If parameters are invalid
   * @throws {ValidationError} If component data validation fails
   */
  async addComponent(instanceId, componentTypeId, componentData) {
    return await this.#mutationManager.addComponent(
      instanceId,
      componentTypeId,
      componentData
    );
  }

  /**
   * Removes a component override from an existing entity instance.
   *
   * @param {string} instanceId - The ID of the entity instance
   * @param {string} componentTypeId - The unique ID of the component type to remove
   * @throws {EntityNotFoundError} If entity not found
   * @throws {InvalidArgumentError} If parameters are invalid
   * @throws {ComponentOverrideNotFoundError} If component override does not exist
   * @throws {Error} If removal fails
   */
  async removeComponent(instanceId, componentTypeId) {
    await this.#mutationManager.removeComponent(instanceId, componentTypeId);
  }

  /**
   * Remove an entity instance from the manager.
   *
   * @param {string} instanceId - The ID of the entity instance to remove
   * @throws {EntityNotFoundError} If the entity is not found
   * @throws {InvalidArgumentError} If the instanceId is invalid
   * @throws {Error} If internal removal operation fails
   */
  async removeEntityInstance(instanceId) {
    return await this.#mutationManager.removeEntityInstance(instanceId);
  }

  /* ---------------------------------------------------------------------- */
  /* Query Methods (Delegated to EntityQueryManager)                       */
  /* ---------------------------------------------------------------------- */

  /**
   * Retrieve an entity instance by its ID.
   *
   * @param {string} instanceId - The ID of the entity instance
   * @returns {Entity|undefined} The entity if found, otherwise undefined
   * @throws {InvalidArgumentError} If the instanceId is invalid
   */
  getEntityInstance(instanceId) {
    return this.#queryManager.getEntityInstance(instanceId);
  }

  /**
   * Retrieve component data for a specific entity.
   *
   * @param {string} instanceId - Entity instance ID
   * @param {string} componentTypeId - Component type ID
   * @returns {object|undefined} Component data or undefined if not found
   * @throws {InvalidArgumentError} If parameters are invalid
   */
  getComponentData(instanceId, componentTypeId) {
    return this.#queryManager.getComponentData(instanceId, componentTypeId);
  }

  /**
   * Checks if an entity has data associated with a specific component type ID.
   *
   * @param {string} instanceId - The ID (UUID) of the entity
   * @param {string} componentTypeId - The unique string ID of the component type
   * @param {boolean} [checkOverrideOnly] - If true, only check for component overrides
   * @returns {boolean} True if the entity has the component data, false otherwise
   * @throws {InvalidArgumentError} If parameters are invalid
   */
  hasComponent(instanceId, componentTypeId, checkOverrideOnly = false) {
    // Only pass the third parameter if it was explicitly provided
    if (arguments.length === 3) {
      return this.#queryManager.hasComponent(
        instanceId,
        componentTypeId,
        checkOverrideOnly
      );
    }
    return this.#queryManager.hasComponent(instanceId, componentTypeId);
  }

  /**
   * Checks if an entity has a component override.
   *
   * @param {string} instanceId - The ID (UUID) of the entity
   * @param {string} componentTypeId - The unique string ID of the component type
   * @returns {boolean} True if the entity has a component override, false otherwise
   * @throws {InvalidArgumentError} If parameters are invalid
   */
  hasComponentOverride(instanceId, componentTypeId) {
    return this.#queryManager.hasComponentOverride(instanceId, componentTypeId);
  }

  /**
   * Return **new array** of entities that possess `componentTypeId`.
   *
   * @param {string} componentTypeId - Component type ID to search for
   * @returns {Entity[]} Fresh array (never a live reference)
   * @throws {InvalidArgumentError} If componentTypeId is invalid
   */
  getEntitiesWithComponent(componentTypeId) {
    return this.#queryManager.getEntitiesWithComponent(componentTypeId);
  }

  /**
   * Find entities matching complex query criteria.
   *
   * @param {object} queryObj - Query object with withAll, withAny, without conditions
   * @returns {Entity[]} Array of entities matching the query
   */
  findEntities(queryObj) {
    return this.#queryManager.findEntities(queryObj);
  }

  /**
   * Returns a list of all component type IDs attached to a given entity.
   *
   * @param {string} entityId - The ID of the entity
   * @returns {string[]} An array of component ID strings
   * @throws {InvalidArgumentError} If the entityId is invalid
   */
  getAllComponentTypesForEntity(entityId) {
    return this.#queryManager.getAllComponentTypesForEntity(entityId);
  }

  /* ---------------------------------------------------------------------- */
  /* Management Methods                                                     */
  /* ---------------------------------------------------------------------- */

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
