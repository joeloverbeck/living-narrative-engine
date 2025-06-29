/**
 * @file This module provides a dedicated factory for creating and reconstructing Entity instances.
 * It encapsulates the creation/reconstruction logic previously contained in EntityManager.
 * @see src/entities/factories/entityFactory.js
 */

// -----------------------------------------------------------------------------
//  Living Narrative Engine – EntityFactory
// -----------------------------------------------------------------------------
//  @description
//  Dedicated factory class responsible for creating new Entity instances from
//  definitions and reconstructing Entity instances from serialized data.
//  Handles validation, default component injection, and entity initialization.
//
//  @module EntityFactory
//  @since   0.3.0
// -----------------------------------------------------------------------------

import { getDefinition as lookupDefinition } from '../utils/definitionLookup.js';
import Entity from '../entity.js';
import EntityInstanceData from '../entityInstanceData.js';
import { MapManager } from '../../utils/mapManagerUtils.js';
import {
  assertValidId,
  assertNonBlankString,
} from '../../utils/dependencyUtils.js';
import { injectDefaultComponents } from '../utils/defaultComponentInjector.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { DefinitionNotFoundError } from '../../errors/definitionNotFoundError.js';
import { SerializedEntityError } from '../../errors/serializedEntityError.js';
import { InvalidInstanceIdError } from '../../errors/invalidInstanceIdError.js';
import createValidateAndClone from '../utils/createValidateAndClone.js';
import { validateSerializedComponent } from './serializedComponentValidator.js';

/* -------------------------------------------------------------------------- */
/* Type-Hint Imports (JSDoc only – removed at runtime)                        */
/* -------------------------------------------------------------------------- */

/** @typedef {import('../entityDefinition.js').default} EntityDefinition */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry}        IDataRegistry */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator}     ISchemaValidator */
/** @typedef {import('../../interfaces/coreServices.js').ILogger}              ILogger */
/** @typedef {import('../../interfaces/coreServices.js').ValidationResult}     ValidationResult */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/* -------------------------------------------------------------------------- */
/* Internal Utilities                                                         */
/* -------------------------------------------------------------------------- */

// createValidateAndClone imported from
// ../utils/createValidateAndClone.js

/* -------------------------------------------------------------------------- */
/* EntityFactory Implementation                                               */
/* -------------------------------------------------------------------------- */

/**
 * @class EntityFactory
 * @description
 * Factory class responsible for creating and reconstructing Entity instances.
 * Handles validation, default component injection, and entity initialization.
 */
class EntityFactory {
  /** @type {ISchemaValidator} @private */
  #validator;
  /** @type {ILogger} @private */
  #logger;
  /** @type {function(): string} @private */
  #idGenerator;
  /** @type {Function} @private */
  #cloner;
  /** @type {object} @private */
  #defaultPolicy; // eslint-disable-line no-unused-private-class-members
  /** @type {(componentTypeId: string, data: object, context: string) => object} @private */
  #validateAndClone;

  /**
   * @class
   * @param {ISchemaValidator}     validator
   * @param {ILogger}              logger
   * @param {function(): string}   idGenerator
   * @param {Function}             cloner
   * @param {object}               defaultPolicy
   * @throws {Error} If any dependency is missing or malformed.
   */
  constructor({ validator, logger, idGenerator, cloner, defaultPolicy }) {
    /* ---------- dependency checks ---------- */
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = ensureValidLogger(logger, 'EntityFactory');

    validateDependency(validator, 'ISchemaValidator', this.#logger, {
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

    this.#validator = validator;
    this.#idGenerator = idGenerator;
    this.#cloner = cloner;
    this.#defaultPolicy = defaultPolicy;
    this.#validateAndClone = createValidateAndClone(
      this.#validator,
      this.#logger,
      this.#cloner
    );
    this.#logger.debug('[EntityFactory] EntityFactory initialised.');
  }

  /**
   * Retrieves an entity definition from the registry.
   *
   * @private
   * @param {string} definitionId - The ID of the entity definition.
   * @param {IDataRegistry} registry - The data registry to fetch from.
   * @returns {EntityDefinition|null} The entity definition, or null when the
   * ID is invalid or no definition exists.
   */
  #getDefinition(definitionId, registry) {
    try {
      return lookupDefinition(definitionId, registry, this.#logger);
    } catch {
      return null;
    }
  }

  /**
   * Validates component overrides before entity creation.
   *
   * @private
   * @param {Record<string, object>} componentOverrides - Overrides to validate.
   * @param {EntityDefinition} entityDefinition - Definition to check existing components.
   * @param {string} instanceId - ID of the entity being created.
   * @returns {Record<string, object>} Validated and cloned overrides.
   */
  #validateOverrides(componentOverrides, entityDefinition, instanceId) {
    const validatedOverrides = {};
    if (componentOverrides && typeof componentOverrides === 'object') {
      for (const [compType, compData] of Object.entries(componentOverrides)) {
        const errorContextPrefix = entityDefinition.hasComponent(compType)
          ? 'Override for component'
          : 'New component';
        const errorContext = `${errorContextPrefix} ${compType} on entity ${instanceId}`;
        validatedOverrides[compType] = this.#validateAndClone(
          compType,
          compData,
          errorContext
        );
      }
    }
    return validatedOverrides;
  }

  /**
   * Validates serialized components during reconstruction.
   *
   * @private
   * @param {Record<string, object|null>} components - Serialized components to validate.
   * @param {string} instanceId - ID of the entity being reconstructed.
   * @param {string} definitionId - Definition ID for context in error messages.
   * @returns {Record<string, object|null>} Validated components.
   */
  #validateSerializedComponents(components, instanceId, definitionId) {
    const validatedComponents = {};
    this.#logger.debug(
      `[EntityFactory] [RECONSTRUCT_ENTITY_LOG] About to validate components for entity '${instanceId}'. Components to process: ${JSON.stringify(
        components
      )}`
    );
    if (components && typeof components === 'object') {
      for (const [typeId, data] of Object.entries(components)) {
        validatedComponents[typeId] = validateSerializedComponent(
          typeId,
          data,
          this.#validator,
          this.#logger,
          instanceId,
          definitionId
        );
      }
    }
    this.#logger.debug(
      `[EntityFactory] [RECONSTRUCT_ENTITY_LOG] All components validated for entity '${instanceId}'.`
    );
    return validatedComponents;
  }

  /**
   * Validates IDs provided to {@link EntityFactory#create}.
   *
   * @private
   * @param {string} definitionId - Entity definition ID.
   * @param {string} [instanceId] - Desired instance ID.
   * @throws {TypeError|InvalidInstanceIdError}
   */
  #validateCreateIds(definitionId, instanceId) {
    try {
      assertValidId(definitionId, 'EntityFactory.create', this.#logger);
    } catch (err) {
      if (err && err.name === 'InvalidArgumentError') {
        const msg = 'definitionId must be a non-empty string.';
        this.#logger.error(`[EntityFactory] ${msg}`);
        throw new TypeError(msg);
      }
      throw err;
    }

    if (instanceId !== undefined && instanceId !== null) {
      try {
        assertValidId(instanceId, 'EntityFactory.create', this.#logger);
      } catch (err) {
        if (err && err.name === 'InvalidArgumentError') {
          const msg = 'EntityFactory.create: instanceId is missing or invalid.';
          this.#logger.error(`[EntityFactory] ${msg}`);
          throw new InvalidInstanceIdError(instanceId, msg);
        }
        throw err;
      }
    }
  }

  /**
   * Checks for duplicate entity IDs in a repository.
   *
   * @private
   * @param {object} repository - Repository implementing `has`.
   * @param {string} id - ID to check for duplicates.
   * @param {string} errorMsg - Error message to log and throw.
   */
  #checkDuplicateId(repository, id, errorMsg) {
    if (repository.has(id)) {
      this.#logger.error(`[EntityFactory] ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * Finalizes entity construction and injects default components.
   *
   * @private
   * @param {EntityDefinition} definition - Entity definition.
   * @param {string} instanceId - Entity instance ID.
   * @param {Record<string, object|null>} components - Component data.
   * @param {string} definitionId - Definition ID for logging context.
   * @param {string} action - Description string like "created." or "reconstructed.".
   * @returns {Entity} The constructed entity.
   */
  #constructEntity(definition, instanceId, components, definitionId, action) {
    const data = new EntityInstanceData(
      instanceId,
      definition,
      components,
      this.#logger
    );
    const entity = new Entity(data);
    injectDefaultComponents(entity, this.#logger, this.#validateAndClone);
    this.#logger.info(
      `[EntityFactory] Entity instance '${instanceId}' (def: '${definitionId}') ${action}`
    );
    return entity;
  }

  /**
   * Create a new entity instance from a definition.
   *
   * @param {string} definitionId - The ID of the entity definition to use.
   * @param {object} options - Options for entity creation.
   * @param {Object<string, object>} [options.componentOverrides] - Optional. A map of component data to override or add.
   * @param {string} [options.instanceId] - Optional. A specific ID for the new instance. If not provided, a UUID will be generated.
   * @param {IDataRegistry} registry - The data registry to fetch definitions from.
   * @param {object} repository - The repository to check for ID collisions.
   * @param {EntityDefinition} [definition] - Optional. The entity definition to use (avoids double registry calls).
   * @returns {Entity} The newly created entity instance.
   * @throws {DefinitionNotFoundError} If the definition is not found.
   * @throws {Error} If component data is invalid, or if an entity with the given instanceId already exists.
   */
  create(
    definitionId,
    { componentOverrides = {}, instanceId } = {},
    registry,
    repository,
    definition = null
  ) {
    this.#validateCreateIds(definitionId, instanceId);

    const entityDefinition =
      definition || this.#getDefinition(definitionId, registry);
    if (!entityDefinition) {
      // No need to log here, #getDefinition already logs if invalid definitionId is passed
      // and DefinitionNotFoundError is specific.
      throw new DefinitionNotFoundError(definitionId);
    }

    const actualInstanceId =
      instanceId && MapManager.isValidId(instanceId)
        ? instanceId
        : this.#idGenerator();

    // Check for duplicate instanceId BEFORE any other operations
    this.#checkDuplicateId(
      repository,
      actualInstanceId,
      `Entity with ID '${actualInstanceId}' already exists.`
    );

    this.#logger.debug(
      `[EntityFactory] Creating entity instance ${actualInstanceId} from definition ${definitionId}.`
    );

    const validatedOverrides = this.#validateOverrides(
      componentOverrides,
      entityDefinition,
      actualInstanceId
    );

    return this.#constructEntity(
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
   * @param {object} serializedEntity - Plain object from a save file.
   * @param {string} serializedEntity.instanceId
   * @param {string} serializedEntity.definitionId
   * @param {Record<string, object>} [serializedEntity.components]
   * @param {IDataRegistry} registry - The data registry to fetch definitions from.
   * @param {object} repository - The repository to check for ID collisions.
   * @returns {Entity} The reconstructed Entity instance.
   * @throws {DefinitionNotFoundError} If the entity definition is not found.
   * @throws {Error} If component data is invalid, or if an entity with the given ID already exists.
   */
  reconstruct(serializedEntity, registry, repository) {
    this.#logger.debug(
      `[EntityFactory] [RECONSTRUCT_ENTITY_LOG] Attempting to reconstruct entity. Data: ${JSON.stringify(
        serializedEntity
      )}`
    );

    if (!serializedEntity || typeof serializedEntity !== 'object') {
      const msg =
        'EntityFactory.reconstruct: serializedEntity data is missing or invalid.';
      this.#logger.error(`[EntityFactory] ${msg}`);
      throw new SerializedEntityError(msg);
    }

    const { instanceId, definitionId, components } = serializedEntity;

    try {
      assertValidId(instanceId, 'EntityFactory.reconstruct', this.#logger);
    } catch (err) {
      if (err && err.name === 'InvalidArgumentError') {
        const msg =
          'EntityFactory.reconstruct: instanceId is missing or invalid in serialized data.';
        this.#logger.error(`[EntityFactory] ${msg}`);
        throw new InvalidInstanceIdError(instanceId, msg);
      }
      throw err;
    }

    this.#checkDuplicateId(
      repository,
      instanceId,
      `EntityFactory.reconstruct: Entity with ID '${instanceId}' already exists. Reconstruction aborted.`
    );

    const definitionToUse = this.#getDefinition(definitionId, registry);
    if (!definitionToUse) {
      this.#logger.error(
        `[EntityFactory] EntityFactory.reconstruct: Definition '${definitionId}' not found in registry for entity '${instanceId}'. Reconstruction aborted.`
      );
      throw new DefinitionNotFoundError(definitionId);
    }

    const validatedComponents = this.#validateSerializedComponents(
      components,
      instanceId,
      definitionId
    );

    // Create the entity
    return this.#constructEntity(
      definitionToUse,
      instanceId,
      validatedComponents,
      definitionId,
      'reconstructed.'
    );
  }
}

export default EntityFactory;
