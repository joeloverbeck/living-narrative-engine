/**
 * @file Error class for data registry issues.
 */

/**
 * Error thrown when a data registry operation encounters invalid parameters or other issues.
 *
 * @class DataRegistryError
 * @augments {Error}
 */
export default class DataRegistryError extends Error {
  /**
   * Create a new DataRegistryError.
   *
   * @param {string} message - Description of the error.
   */
  constructor(message) {
    super(message);
    this.name = 'DataRegistryError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DataRegistryError);
    }
  }
}
