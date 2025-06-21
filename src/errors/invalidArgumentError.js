/**
 * @file Error for invalid argument validation failures.
 */

/**
 * Error thrown when a function receives an invalid argument.
 *
 * @class
 * @augments {Error}
 */
export class InvalidArgumentError extends Error {
  /**
   * @param {string} message - The error message describing the invalid argument.
   * @param {string} [parameterName] - The name of the parameter that was invalid.
   * @param {any} [receivedValue] - The actual value that was received.
   */
  constructor(message, parameterName = null, receivedValue = null) {
    super(message);
    this.name = 'InvalidArgumentError';
    this.parameterName = parameterName;
    this.receivedValue = receivedValue;
  }
} 