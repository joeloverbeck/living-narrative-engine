/**
 * @file Error class for invalid action definitions.
 */

import BaseError from './baseError.js';

/**
 * Error thrown when an action definition is missing required properties or otherwise invalid.
 *
 * @class InvalidActionDefinitionError
 * @augments {BaseError}
 */
export class InvalidActionDefinitionError extends BaseError {
  /**
   * Constructs a new InvalidActionDefinitionError instance.
   *
   * @param {string} [message] - Optional custom message.
   * @param {object} [context] - Additional context for the error.
   */
  constructor(message = 'Invalid actionDefinition', context = {}) {
    super(message, 'INVALID_ACTION_DEFINITION_ERROR', context);
    this.name = 'InvalidActionDefinitionError';
  }

  /**
   * @returns {string} Severity level for invalid action definition errors
   */
  getSeverity() {
    return 'warning';
  }

  /**
   * @returns {boolean} Invalid action definition errors are recoverable
   */
  isRecoverable() {
    return true;
  }
}

export default InvalidActionDefinitionError;
