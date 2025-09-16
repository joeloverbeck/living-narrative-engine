/**
 * @file Error for invalid argument validation failures.
 */

import BaseError from './baseError.js';

/**
 * Error thrown when a function receives an invalid argument.
 *
 * @class
 * @augments {BaseError}
 */
export class InvalidArgumentError extends BaseError {
  /**
   * Creates a new InvalidArgumentError instance.
   *
   * @param {string} message - The error message describing the invalid argument.
   * @param {string} [parameterName] - The name of the parameter that was invalid.
   * @param {any} [receivedValue] - The actual value that was received.
   */
  constructor(message, parameterName = null, receivedValue = null) {
    super(message, 'INVALID_ARGUMENT_ERROR', { parameterName, receivedValue });
    this.name = 'InvalidArgumentError';
    // Backward compatibility: preserve existing properties
    this.parameterName = parameterName;
    this.receivedValue = receivedValue;
  }

  /**
   * @returns {string} Severity level for invalid argument errors
   */
  getSeverity() {
    return 'warning';
  }

  /**
   * @returns {boolean} Invalid argument errors are recoverable
   */
  isRecoverable() {
    return true;
  }
}
