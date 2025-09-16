/**
 * @file Error class representing invalid or missing serialized entity data.
 */

import BaseError from './baseError.js';

/**
 * Error thrown when serialized entity data is missing or malformed.
 *
 * @class SerializedEntityError
 * @augments {BaseError}
 */
export class SerializedEntityError extends BaseError {
  /**
   * @param {string} message - The error message.
   * @param {object} [context] - Additional context for the error.
   */
  constructor(message, context = {}) {
    super(message, 'SERIALIZED_ENTITY_ERROR', context);
    this.name = 'SerializedEntityError';
  }

  /**
   * @returns {string} Severity level for serialized entity errors
   */
  getSeverity() {
    return 'warning';
  }

  /**
   * @returns {boolean} Serialized entity errors are recoverable
   */
  isRecoverable() {
    return true;
  }
}
