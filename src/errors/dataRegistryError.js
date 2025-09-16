/**
 * @file Error class for data registry issues.
 */

import BaseError from './baseError.js';

/**
 * Error thrown when a data registry operation encounters invalid parameters or other issues.
 *
 * @class DataRegistryError
 * @augments {BaseError}
 */
export default class DataRegistryError extends BaseError {
  /**
   * Create a new DataRegistryError.
   *
   * @param {string} message - Description of the error.
   * @param {object} [context] - Additional context for the error.
   */
  constructor(message, context = {}) {
    super(message, 'DATA_REGISTRY_ERROR', context);
    this.name = 'DataRegistryError';
  }

  /**
   * @returns {string} Severity level for data registry errors
   */
  getSeverity() {
    return 'error';
  }

  /**
   * @returns {boolean} Data registry errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}
