/**
 * @file ErrorTranslator - Translates factory errors to typed domain errors
 * @description Service responsible for translating errors from EntityFactory
 * into properly typed domain errors with consistent messaging.
 */

import { validateDependency } from '../../utils/validationUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { DuplicateEntityError } from '../../errors/duplicateEntityError.js';
import { SerializedEntityError } from '../../errors/serializedEntityError.js';
import { InvalidInstanceIdError } from '../../errors/invalidInstanceIdError.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @class ErrorTranslator
 * @description Translates errors from EntityFactory to maintain legacy messages
 * and provide consistent error types.
 */
export class ErrorTranslator {
  /** @type {ILogger} @private */
  #logger;

  /**
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });

    this.#logger = ensureValidLogger(logger, 'ErrorTranslator');
    this.#logger.debug('ErrorTranslator initialized.');
  }

  /**
   * Translate errors from EntityFactory to maintain legacy messages.
   *
   * @param {Error} err - Original error thrown by the factory.
   * @returns {Error|DuplicateEntityError} Translated error with proper typing
   */
  translate(err) {
    if (err instanceof SerializedEntityError) {
      const msg =
        'EntityManager.reconstructEntity: serializedEntity data is missing or invalid.';
      this.#logger.error(msg);
      return new SerializedEntityError(msg);
    }

    if (err instanceof InvalidInstanceIdError) {
      const msg =
        'EntityManager.reconstructEntity: instanceId is missing or invalid in serialized data.';
      this.#logger.error(msg);
      return new InvalidInstanceIdError(err.instanceId, msg);
    }

    if (
      err instanceof Error &&
      err.message.startsWith(
        'EntityFactory.reconstruct: serializedEntity data is missing or invalid.'
      )
    ) {
      const msg =
        'EntityManager.reconstructEntity: serializedEntity data is missing or invalid.';
      this.#logger.error(msg);
      return new SerializedEntityError(msg);
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
      return new InvalidInstanceIdError('unknown', msg);
    }

    if (
      err instanceof Error &&
      err.message.startsWith('EntityFactory.reconstruct: Entity with ID')
    ) {
      const match = err.message.match(
        /Entity with ID '([^']+)' already exists/
      );
      if (match) {
        const msg = `EntityManager.reconstructEntity: Entity with ID '${match[1]}' already exists. Reconstruction aborted.`;
        this.#logger.error(msg);
        return new DuplicateEntityError(match[1], msg);
      }
    }

    if (err instanceof DuplicateEntityError) {
      const msg = err.message.startsWith('EntityManager.')
        ? err.message
        : `EntityManager.createEntityInstance: ${err.message}`;
      this.#logger.error(msg);
      return new DuplicateEntityError(err.entityId, msg);
    }

    if (err instanceof Error && err.message.startsWith('Entity with ID')) {
      const match = err.message.match(
        /Entity with ID '([^']+)' already exists/
      );
      if (match) {
        const msg = `EntityManager.createEntityInstance: Entity with ID '${match[1]}' already exists.`;
        this.#logger.error(msg);
        return new DuplicateEntityError(match[1], msg);
      }
    }

    return err instanceof Error ? err : new Error(String(err));
  }
}

export default ErrorTranslator;
