/**
 * @file Error class for invalid or missing entity IDs.
 */

/**
 * Error thrown when a method receives a falsy entityId.
 *
 * @class InvalidEntityIdError
 * @augments {Error}
 */
export class InvalidEntityIdError extends Error {
  /**
   * @param {*} entityId - The invalid entity identifier.
   * @param {string} [message] - Optional custom message.
   */
  constructor(entityId, message = null) {
    const defaultMessage = `Invalid entityId: '${entityId}'.`;
    super(message || defaultMessage);
    this.name = 'InvalidEntityIdError';
    this.entityId = entityId;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidEntityIdError);
    }
  }
}
