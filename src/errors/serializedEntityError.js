/**
 * @file Error class representing invalid or missing serialized entity data.
 */

/**
 * Error thrown when serialized entity data is missing or malformed.
 *
 * @class SerializedEntityError
 * @augments {Error}
 */
export class SerializedEntityError extends Error {
  /**
   * @param {string} message - The error message.
   */
  constructor(message) {
    super(message);
    this.name = 'SerializedEntityError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SerializedEntityError);
    }
  }
}
