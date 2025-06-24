/**
 * @file ErrorTranslator - Translates factory errors to typed domain errors
 * @description Service responsible for translating errors from EntityFactory
 * into properly typed domain errors with consistent messaging.
 */

import { validateDependency } from '../../utils/validationUtils.js';
import { ensureValidLogger } from '../../utils/index.js';
import { DuplicateEntityError } from '../../errors/duplicateEntityError.js';

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
  translateReconstructionError(err) {
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
}

export default ErrorTranslator;
