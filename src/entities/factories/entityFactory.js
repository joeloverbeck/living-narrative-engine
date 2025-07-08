/**
 * @file Refactored EntityFactory - Coordinates specialized entity factories
 * @see src/entities/factories/entityFactory.js
 */

// -----------------------------------------------------------------------------
//  Living Narrative Engine – EntityFactory (Refactored)
// -----------------------------------------------------------------------------
//  @description
//  Refactored factory class that coordinates specialized factories for entity
//  creation and reconstruction. Maintains backward compatibility while
//  improving maintainability through separation of concerns.
//
//  @module EntityFactory
//  @since   0.3.0
// -----------------------------------------------------------------------------

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { SerializedEntityError } from '../../errors/serializedEntityError.js';
import createValidateAndClone from '../utils/createValidateAndClone.js';
import EntityValidationFactory from './EntityValidationFactory.js';
import EntityConstructionFactory from './EntityConstructionFactory.js';
import EntityDefinitionLookupFactory from './EntityDefinitionLookupFactory.js';

/* -------------------------------------------------------------------------- */
/* Type-Hint Imports (JSDoc only – removed at runtime)                        */
/* -------------------------------------------------------------------------- */

/** @typedef {import('../entityDefinition.js').default} EntityDefinition */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').ValidationResult} ValidationResult */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/* -------------------------------------------------------------------------- */
/* EntityFactory Implementation                                               */
/* -------------------------------------------------------------------------- */

/**
 * @class EntityFactory
 * @description
 * Refactored factory class that coordinates specialized factories for entity
 * creation and reconstruction. Maintains backward compatibility while
 * improving maintainability through separation of concerns.
 */
class EntityFactory {
  /** @type {ISchemaValidator} */
  #validator;
  /** @type {ILogger} */
  #logger;
  /** @type {function(): string} */
  #idGenerator;
  /** @type {Function} */
  #cloner;
  /** @type {Function} */
  #validateAndClone;

  // Specialized factories
  /** @type {EntityValidationFactory} */
  #validationFactory;
  /** @type {EntityConstructionFactory} */
  #constructionFactory;
  /** @type {EntityDefinitionLookupFactory} */
  #definitionLookupFactory;

  /**
   * @class
   * @param {object} deps - Dependencies
   * @param {ISchemaValidator} deps.validator - Schema validator
   * @param {ILogger} deps.logger - Logger instance
   * @param {function(): string} deps.idGenerator - ID generator function
   * @param deps.defaultPolicy
   * @param {Function} deps.cloner - Component cloner function
   * @throws {Error} If any dependency is missing or malformed
   */
  constructor({ validator, logger, idGenerator, cloner, defaultPolicy }) {
    this.#validateDependencies({
      validator,
      logger,
      idGenerator,
      cloner,
      defaultPolicy,
    });
    this.#initializeDependencies({ validator, logger, idGenerator, cloner });
    this.#initializeSpecializedFactories();

    this.#logger.debug(
      '[EntityFactory] EntityFactory (refactored) initialized.'
    );
  }

  /**
   * Validates all constructor dependencies.
   *
   * @param {object} deps - Dependencies to validate
   * @param deps.validator
   * @param deps.logger
   * @param deps.idGenerator
   * @param deps.cloner
   * @param deps.defaultPolicy
   */
  #validateDependencies({
    validator,
    logger,
    idGenerator,
    cloner,
    defaultPolicy,
  }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });

    validateDependency(validator, 'ISchemaValidator', logger, {
      requiredMethods: ['validate'],
    });

    if (typeof idGenerator !== 'function') {
      throw new Error('idGenerator must be a function');
    }

    if (typeof cloner !== 'function') {
      throw new Error('cloner must be a function');
    }

    if (!defaultPolicy || typeof defaultPolicy !== 'object') {
      throw new Error('defaultPolicy must be an object');
    }
  }

  /**
   * Initializes core dependencies.
   *
   * @param {object} deps - Dependencies to initialize
   * @param deps.validator
   * @param deps.logger
   * @param deps.idGenerator
   * @param deps.cloner
   */
  #initializeDependencies({ validator, logger, idGenerator, cloner }) {
    this.#validator = validator;
    this.#logger = ensureValidLogger(logger, 'EntityFactory');
    this.#idGenerator = idGenerator;
    this.#cloner = cloner;
    this.#validateAndClone = createValidateAndClone(
      this.#validator,
      this.#logger,
      this.#cloner
    );
  }

  /**
   * Initializes specialized factory instances.
   */
  #initializeSpecializedFactories() {
    this.#validationFactory = new EntityValidationFactory({
      validator: this.#validator,
      logger: this.#logger,
      validateAndClone: this.#validateAndClone,
    });

    this.#constructionFactory = new EntityConstructionFactory({
      logger: this.#logger,
      validateAndClone: this.#validateAndClone,
    });

    this.#definitionLookupFactory = new EntityDefinitionLookupFactory({
      logger: this.#logger,
    });
  }

  /**
   * Create a new entity instance from a definition.
   *
   * @param {string} definitionId - The ID of the entity definition to use
   * @param {object} options - Options for entity creation
   * @param {Object<string, object>} [options.componentOverrides] - Component data overrides
   * @param {string} [options.instanceId] - Optional specific ID for the new instance
   * @param {IDataRegistry} registry - The data registry to fetch definitions from
   * @param {object} repository - The repository to check for ID collisions
   * @param {EntityDefinition} [definition] - Optional entity definition to use
   * @returns {Entity} The newly created entity instance
   * @throws {DefinitionNotFoundError} If the definition is not found
   * @throws {Error} If component data is invalid or entity ID already exists
   */
  create(
    definitionId,
    { componentOverrides = {}, instanceId } = {},
    registry,
    repository,
    definition = null
  ) {
    // Validate input IDs
    this.#validationFactory.validateCreateIds(definitionId, instanceId);

    // Get entity definition
    const entityDefinition =
      definition ||
      this.#definitionLookupFactory.getDefinitionOrThrow(
        definitionId,
        registry
      );

    // Resolve actual instance ID
    const actualInstanceId = this.#validationFactory.resolveInstanceId(
      instanceId,
      this.#idGenerator
    );

    // Check for duplicates
    this.#validationFactory.checkDuplicateId(
      repository,
      actualInstanceId,
      `Entity with ID '${actualInstanceId}' already exists.`
    );

    this.#logger.debug(
      `[EntityFactory] Creating entity instance ${actualInstanceId} from definition ${definitionId}.`
    );

    // Validate component overrides
    const validatedOverrides = this.#validationFactory.validateOverrides(
      componentOverrides,
      entityDefinition,
      actualInstanceId
    );

    // Construct and return entity
    return this.#constructionFactory.constructEntity(
      entityDefinition,
      actualInstanceId,
      validatedOverrides,
      definitionId,
      'created.'
    );
  }

  /**
   * Reconstructs an entity instance from a plain serializable object.
   *
   * @param {object} serializedEntity - Plain object from a save file
   * @param {string} serializedEntity.instanceId - Entity instance ID
   * @param {string} serializedEntity.definitionId - Entity definition ID
   * @param {Record<string, object>} [serializedEntity.components] - Component data
   * @param {IDataRegistry} registry - The data registry to fetch definitions from
   * @param {object} repository - The repository to check for ID collisions
   * @returns {Entity} The reconstructed Entity instance
   * @throws {DefinitionNotFoundError} If the entity definition is not found
   * @throws {SerializedEntityError} If serialized data is invalid
   * @throws {Error} If component data is invalid or entity ID already exists
   */
  reconstruct(serializedEntity, registry, repository) {
    this.#logger.debug(
      `[EntityFactory] Attempting to reconstruct entity. Data: ${JSON.stringify(
        serializedEntity
      )}`
    );

    // Validate serialized data format
    this.#validationFactory.validateReconstructData(serializedEntity);

    const { instanceId, definitionId, components } = serializedEntity;

    // Check for duplicate instance ID
    this.#validationFactory.checkDuplicateId(
      repository,
      instanceId,
      `EntityFactory.reconstruct: Entity with ID '${instanceId}' already exists. Reconstruction aborted.`
    );

    // Get entity definition
    const definitionToUse = this.#definitionLookupFactory.getDefinitionOrThrow(
      definitionId,
      registry
    );

    // Validate serialized components
    const validatedComponents =
      this.#validationFactory.validateSerializedComponents(
        components,
        instanceId,
        definitionId
      );

    // Construct and return entity
    return this.#constructionFactory.constructEntity(
      definitionToUse,
      instanceId,
      validatedComponents,
      definitionId,
      'reconstructed.'
    );
  }

  /**
   * Gets access to the validation factory for advanced validation needs.
   *
   * @returns {EntityValidationFactory} The validation factory instance
   */
  getValidationFactory() {
    return this.#validationFactory;
  }

  /**
   * Gets access to the construction factory for advanced construction needs.
   *
   * @returns {EntityConstructionFactory} The construction factory instance
   */
  getConstructionFactory() {
    return this.#constructionFactory;
  }

  /**
   * Gets access to the definition lookup factory for advanced lookup needs.
   *
   * @returns {EntityDefinitionLookupFactory} The definition lookup factory instance
   */
  getDefinitionLookupFactory() {
    return this.#definitionLookupFactory;
  }
}
export default EntityFactory;
