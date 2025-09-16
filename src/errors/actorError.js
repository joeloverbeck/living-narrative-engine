import BaseError from './baseError.js';

/**
 * Base error class for actor-related issues.
 *
 * @description Base error class for actor-related issues.
 * @class ActorError
 * @augments {BaseError}
 */
export class ActorError extends BaseError {
  /**
   * Creates a new ActorError instance.
   *
   * @param {string} message The error message.
   * @param {object} [context] Additional context for the error.
   */
  constructor(message, context = {}) {
    super(message, 'ACTOR_ERROR', context);
    this.name = 'ActorError';
  }

  /**
   * @returns {string} Severity level for actor errors
   */
  getSeverity() {
    return 'error';
  }

  /**
   * @returns {boolean} Actor errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}
