/**
 * @file Error class for invalid actor entities.
 */

import BaseError from './baseError.js';

/**
 * Error thrown when an actor entity is missing required properties or otherwise invalid.
 *
 * @class InvalidActorEntityError
 * @augments {BaseError}
 */
export class InvalidActorEntityError extends BaseError {
  /**
   * Creates a new InvalidActorEntityError instance.
   *
   * @param {string} [message] - Optional custom message.
   * @param {object} [context] - Additional context for the error.
   */
  constructor(message = 'Invalid actor entity', context = {}) {
    super(message, 'INVALID_ACTOR_ENTITY_ERROR', context);
    this.name = 'InvalidActorEntityError';
  }

  /**
   * @returns {string} Severity level for invalid actor entity errors
   */
  getSeverity() {
    return 'warning';
  }

  /**
   * @returns {boolean} Invalid actor entity errors are recoverable
   */
  isRecoverable() {
    return true;
  }
}

export default InvalidActorEntityError;
