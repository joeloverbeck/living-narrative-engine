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

import { cloneDeep } from 'lodash';
import Entity from '../entity.js';
import EntityInstanceData from '../entityInstanceData.js';
import { MapManager } from '../../utils/mapManagerUtils.js';
import {
  assertValidId,
  assertNonBlankString,
} from '../../utils/parameterGuards.js';
import {
  ACTOR_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  NOTES_COMPONENT_ID,
  GOALS_COMPONENT_ID,
} from '../../constants/componentIds.js';
import { validateDependency } from '../../utils/validationUtils.js';
import { ensureValidLogger } from '../../utils';
import { DefinitionNotFoundError } from '../../errors/definitionNotFoundError.js';

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
  #defaultPolicy;

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

    this.#logger.debug('[EntityFactory] EntityFactory initialised.');
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
      this.#logger.error(`[EntityFactory] ${msg}`);
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
            `[EntityFactory] Injecting ${comp.name} for ${entity.id} (def: ${entity.definitionId})`
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
              `[EntityFactory] Failed to inject default component ${comp.id} for entity ${
                entity.id
              }: ${e.message}`
            );
          }
        }
      }
    }
  }

  /**
   * Retrieves an entity definition from the registry.
   *
   * @private
   * @param {string} definitionId - The ID of the entity definition.
   * @param {IDataRegistry} registry - The data registry to fetch from.
   * @returns {EntityDefinition|null} The entity definition or null if not found.
   */
  #getDefinition(definitionId, registry) {
    try {
      assertValidId(definitionId, 'EntityFactory.#getDefinition', this.#logger);
    } catch (error) {
      this.#logger.warn(
        `[EntityFactory] #getDefinition called with invalid definitionId: '${definitionId}'`
      );
      return null;
    }
    const definition = registry.getEntityDefinition(definitionId);
    if (definition) {
      return definition;
    }
    this.#logger.warn(
      `[EntityFactory] Definition not found in registry: ${definitionId}`
    );
    return null;
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
    try {
      assertValidId(definitionId, 'EntityFactory.create', this.#logger);
    } catch (err) {
      // Legacy compatibility: throw legacy error message for tests
      if (err && err.name === 'InvalidArgumentError') {
        const msg = 'definitionId must be a non-empty string.';
        this.#logger.error(`[EntityFactory] ${msg}`);
        throw new TypeError(msg);
      }
      throw err;
    }

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
    if (repository.has(actualInstanceId)) {
      const msg = `Entity with ID '${actualInstanceId}' already exists.`;
      this.#logger.error(`[EntityFactory] ${msg}`);
      throw new Error(msg); // Ensure this exact message is thrown
    }

    this.#logger.debug(
      `[EntityFactory] Creating entity instance ${actualInstanceId} from definition ${definitionId}.`
    );

    // Validate componentOverrides BEFORE creating EntityInstanceData
    const validatedOverrides = {};
    if (componentOverrides && typeof componentOverrides === 'object') {
      for (const [compType, compData] of Object.entries(componentOverrides)) {
        // This will throw if validation fails, halting creation.
        const errorContextPrefix = entityDefinition.hasComponent(compType)
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
      entityDefinition,
      validatedOverrides
    );
    // Pass logger and validator to Entity constructor
    const entity = new Entity(
      entityInstanceDataObject,
      this.#logger,
      this.#validator
    );

    // Apply default component policy before returning
    this.#injectDefaultComponents(entity);

    this.#logger.info(
      `[EntityFactory] Entity instance '${actualInstanceId}' (def: '${definitionId}') created.`
    );
    return entity;
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

    try {
      assertValidId(instanceId, 'EntityFactory.reconstruct', this.#logger);
    } catch (err) {
      // Legacy compatibility: throw legacy error message for tests
      if (err && err.name === 'InvalidArgumentError') {
        const msg =
          'EntityFactory.reconstruct: instanceId is missing or invalid in serialized data.';
        this.#logger.error(`[EntityFactory] ${msg}`);
        throw new Error(msg);
      }
      throw err;
    }

    if (repository.has(instanceId)) {
      const msg = `EntityFactory.reconstruct: Entity with ID '${instanceId}' already exists. Reconstruction aborted.`;
      this.#logger.error(`[EntityFactory] ${msg}`);
      throw new Error(msg);
    }

    const definitionToUse = this.#getDefinition(definitionId, registry);
    if (!definitionToUse) {
      this.#logger.error(
        `[EntityFactory] EntityFactory.reconstruct: Definition '${definitionId}' not found in registry for entity '${instanceId}'. Reconstruction aborted.`
      );
      throw new DefinitionNotFoundError(definitionId);
    }

    const validatedComponents = {};
    this.#logger.debug(
      `[EntityFactory] [RECONSTRUCT_ENTITY_LOG] About to validate components for entity '${instanceId}'. Components to process: ${JSON.stringify(
        components
      )}`
    );
    if (components && typeof components === 'object') {
      for (const [typeId, data] of Object.entries(components)) {
        this.#logger.debug(
          `[EntityFactory] [RECONSTRUCT_ENTITY_LOG] Validating component '${typeId}' for entity '${instanceId}'. Data: ${JSON.stringify(
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
            this.#logger.error(`[EntityFactory] ${errorMsg}`);
            throw new Error(errorMsg);
          }
        }
      }
    }

    this.#logger.debug(
      `[EntityFactory] [RECONSTRUCT_ENTITY_LOG] All components validated for entity '${instanceId}'.`
    );

    // Create the entity
    const instanceDataForReconstruction = new EntityInstanceData(
      instanceId, // Corrected: instanceId first
      definitionToUse,
      validatedComponents
    );
    // Pass logger and validator to Entity constructor
    const entity = new Entity(
      instanceDataForReconstruction,
      this.#logger,
      this.#validator
    );

    // Restore: inject default components for actor entities
    this.#injectDefaultComponents(entity);

    this.#logger.info(
      `[EntityFactory] Entity instance '${instanceId}' (def: '${definitionId}') reconstructed.`
    );
    return entity;
  }
}

export default EntityFactory;
