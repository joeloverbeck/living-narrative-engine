/**
 * @file EntityValidationFactory - Handles entity validation logic
 * @module EntityValidationFactory
 */

import { assertValidId } from '../../utils/dependencyUtils.js';
import { MapManager } from '../../utils/mapManagerUtils.js';
import { InvalidInstanceIdError } from '../../errors/invalidInstanceIdError.js';
import { SerializedEntityError } from '../../errors/serializedEntityError.js';
import { validateSerializedComponent } from './serializedComponentValidator.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/** @typedef {import('../entityDefinition.js').default} EntityDefinition */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @class EntityValidationFactory
 * @description Specialized factory for entity validation operations
 */
export default class EntityValidationFactory {
  /** @type {ISchemaValidator} */
  #validator;
  /** @type {ILogger} */
  #logger;
  /** @type {Function} */
  #validateAndClone;

  /**
   * @class
   * @param {object} deps - Dependencies
   * @param {ISchemaValidator} deps.validator - Schema validator
   * @param {ILogger} deps.logger - Logger instance
   * @param {Function} deps.validateAndClone - Validation and cloning function
   */
  constructor({ validator, logger, validateAndClone }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = ensureValidLogger(logger, 'EntityValidationFactory');

    validateDependency(validator, 'ISchemaValidator', this.#logger, {
      requiredMethods: ['validate'],
    });
    this.#validator = validator;

    if (typeof validateAndClone !== 'function') {
      throw new Error('validateAndClone must be a function');
    }
    this.#validateAndClone = validateAndClone;

    this.#logger.debug('EntityValidationFactory initialized.');
  }

  /**
   * Validates component overrides before entity creation.
   *
   * @param {Record<string, object>} componentOverrides - Overrides to validate
   * @param {EntityDefinition} entityDefinition - Definition to check existing components
   * @param {string} instanceId - ID of the entity being created
   * @returns {Record<string, object>} Validated and cloned overrides
   */
  validateOverrides(componentOverrides, entityDefinition, instanceId) {
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
   * @param {Record<string, object|null>} components - Serialized components to validate
   * @param {string} instanceId - ID of the entity being reconstructed
   * @param {string} definitionId - Definition ID for context in error messages
   * @returns {Record<string, object|null>} Validated components
   */
  validateSerializedComponents(components, instanceId, definitionId) {
    this.#logger.debug(
      `[EntityValidationFactory] About to validate components for entity '${instanceId}'. Components to process: ${JSON.stringify(
        components
      )}`
    );

    if (!components || typeof components !== 'object') {
      this.#logger.debug(
        `[EntityValidationFactory] No components to validate for entity '${instanceId}'.`
      );
      return {};
    }

    const validatedComponents = {};
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

    this.#logger.debug(
      `[EntityValidationFactory] All components validated for entity '${instanceId}'.`
    );
    return validatedComponents;
  }

  /**
   * Validates IDs provided for entity creation.
   *
   * @param {string} definitionId - Entity definition ID
   * @param {string} [instanceId] - Desired instance ID
   * @throws {TypeError|InvalidInstanceIdError}
   */
  validateCreateIds(definitionId, instanceId) {
    try {
      assertValidId(
        definitionId,
        'EntityValidationFactory.validateCreateIds',
        this.#logger
      );
    } catch (err) {
      if (err && err.name === 'InvalidArgumentError') {
        const msg = 'definitionId must be a non-empty string.';
        this.#logger.error(`[EntityValidationFactory] ${msg}`);
        throw new TypeError(msg);
      }
      throw err;
    }

    if (instanceId !== undefined && instanceId !== null) {
      try {
        assertValidId(
          instanceId,
          'EntityValidationFactory.validateCreateIds',
          this.#logger
        );
      } catch (err) {
        if (err && err.name === 'InvalidArgumentError') {
          const msg =
            'EntityValidationFactory.validateCreateIds: instanceId is missing or invalid.';
          this.#logger.error(`[EntityValidationFactory] ${msg}`);
          throw new InvalidInstanceIdError(instanceId, msg);
        }
        throw err;
      }
    }
  }

  /**
   * Validates reconstruction data format.
   *
   * @param {object} serializedEntity - Serialized entity data
   * @throws {Error} If data format is invalid
   */
  validateReconstructData(serializedEntity) {
    if (!serializedEntity || typeof serializedEntity !== 'object') {
      const msg =
        'EntityValidationFactory.validateReconstructData: serializedEntity data is missing or invalid.';
      this.#logger.error(`[EntityValidationFactory] ${msg}`);
      throw new SerializedEntityError(msg);
    }

    const { instanceId } = serializedEntity;
    try {
      assertValidId(
        instanceId,
        'EntityValidationFactory.validateReconstructData',
        this.#logger
      );
    } catch (err) {
      if (err && err.name === 'InvalidArgumentError') {
        const msg =
          'EntityValidationFactory.validateReconstructData: instanceId is missing or invalid in serialized data.';
        this.#logger.error(`[EntityValidationFactory] ${msg}`);
        throw new InvalidInstanceIdError(instanceId, msg);
      }
      throw err;
    }
  }

  /**
   * Checks for duplicate entity IDs in a repository.
   *
   * @param {object} repository - Repository implementing `has`
   * @param {string} id - ID to check for duplicates
   * @param {string} errorMsg - Error message to log and throw
   * @throws {Error} If duplicate ID is found
   */
  checkDuplicateId(repository, id, errorMsg) {
    if (repository.has(id)) {
      this.#logger.error(`[EntityValidationFactory] ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * Generates a valid instance ID or validates the provided one.
   *
   * @param {string} [instanceId] - Optional instance ID to validate
   * @param {Function} idGenerator - ID generator function
   * @returns {string} Valid instance ID
   */
  resolveInstanceId(instanceId, idGenerator) {
    if (instanceId && MapManager.isValidId(instanceId)) {
      return instanceId;
    }
    return idGenerator();
  }
}
