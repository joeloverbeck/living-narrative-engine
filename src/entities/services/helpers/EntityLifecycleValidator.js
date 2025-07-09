/**
 * @file EntityLifecycleValidator - Handles validation for entity lifecycle operations
 * @module EntityLifecycleValidator
 */

import { assertValidId } from '../../../utils/dependencyUtils.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../../utils/loggerUtils.js';
import { InvalidArgumentError } from '../../../errors/invalidArgumentError.js';
import { EntityNotFoundError } from '../../../errors/entityNotFoundError.js';
import {
  validateReconstructEntityParams as validateReconstructEntityParamsUtil,
  validateRemoveEntityInstanceParams as validateRemoveEntityInstanceParamsUtil,
} from '../../utils/parameterValidators.js';

/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @class EntityLifecycleValidator
 * @description Handles validation for entity lifecycle operations
 */
export default class EntityLifecycleValidator {
  /** @type {ILogger} */
  #logger;

  /**
   * Creates a new EntityLifecycleValidator.
   *
   * @class
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = ensureValidLogger(logger, 'EntityLifecycleValidator');
  }

  /**
   * Validates parameters for entity creation.
   *
   * @param {string} definitionId - Definition ID to validate
   * @throws {InvalidArgumentError} If the definitionId is invalid
   */
  validateCreateEntityParams(definitionId) {
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
   * Validates parameters for entity reconstruction.
   *
   * @param {object} serializedEntity - Serialized entity data
   * @throws {InvalidArgumentError} If parameters are invalid
   */
  validateReconstructEntityParams(serializedEntity) {
    validateReconstructEntityParamsUtil(serializedEntity, this.#logger);
  }

  /**
   * Validates parameters for entity removal.
   *
   * @param {string} instanceId - Instance ID to validate
   * @throws {InvalidArgumentError} If the instanceId is invalid
   */
  validateRemoveEntityInstanceParams(instanceId) {
    validateRemoveEntityInstanceParamsUtil(instanceId, this.#logger);
  }

  /**
   * Validates that an entity exists in the repository.
   *
   * @param {string} instanceId - Instance ID to check
   * @param {object} repository - Repository to check
   * @throws {import('../../../errors/entityNotFoundError.js').EntityNotFoundError} If entity not found
   */
  validateEntityExists(instanceId, repository) {
    if (!repository.has(instanceId)) {
      const msg = `EntityManager.removeEntityInstance: Entity with ID '${instanceId}' not found.`;
      this.#logger.warn(msg);
      throw new EntityNotFoundError(instanceId);
    }
  }

  /**
   * Validates creation options.
   *
   * @param {object} opts - Creation options
   * @param {string} [opts.instanceId] - Optional instance ID
   * @param {object} [opts.componentOverrides] - Component overrides
   * @throws {InvalidArgumentError} If options are invalid
   */
  validateCreationOptions(opts) {
    if (!opts || typeof opts !== 'object') {
      throw new InvalidArgumentError(
        'EntityLifecycleValidator.validateCreationOptions: opts must be an object',
        'opts',
        opts
      );
    }

    if (opts.instanceId !== undefined && typeof opts.instanceId !== 'string') {
      throw new InvalidArgumentError(
        'EntityLifecycleValidator.validateCreationOptions: instanceId must be a string',
        'instanceId',
        opts.instanceId
      );
    }

    if (
      opts.componentOverrides !== undefined &&
      (typeof opts.componentOverrides !== 'object' ||
        Array.isArray(opts.componentOverrides))
    ) {
      throw new InvalidArgumentError(
        'EntityLifecycleValidator.validateCreationOptions: componentOverrides must be an object',
        'componentOverrides',
        opts.componentOverrides
      );
    }
  }

  /**
   * Validates serialized entity structure.
   *
   * @param {object} serializedEntity - Serialized entity data
   * @throws {InvalidArgumentError} If structure is invalid
   */
  validateSerializedEntityStructure(serializedEntity) {
    if (!serializedEntity || typeof serializedEntity !== 'object') {
      throw new InvalidArgumentError(
        'EntityLifecycleValidator.validateSerializedEntityStructure: serializedEntity must be an object',
        'serializedEntity',
        serializedEntity
      );
    }

    const requiredFields = ['instanceId', 'definitionId'];
    for (const field of requiredFields) {
      if (
        !serializedEntity[field] ||
        typeof serializedEntity[field] !== 'string'
      ) {
        throw new InvalidArgumentError(
          `EntityLifecycleValidator.validateSerializedEntityStructure: ${field} must be a non-empty string`,
          field,
          serializedEntity[field]
        );
      }
    }

    if (
      serializedEntity.components !== undefined &&
      (typeof serializedEntity.components !== 'object' ||
        Array.isArray(serializedEntity.components))
    ) {
      throw new InvalidArgumentError(
        'EntityLifecycleValidator.validateSerializedEntityStructure: components must be an object',
        'components',
        serializedEntity.components
      );
    }
  }}
