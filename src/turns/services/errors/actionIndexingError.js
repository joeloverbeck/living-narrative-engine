/**
 * @module turns/services/errors/actionIndexingError
 * @description Error thrown by ActionIndexingService when resolving or retrieving
 * indexed actions fails.
 */

/**
 * Custom error for ActionIndexingService failures, providing actor and index context.
 *
 * @class ActionIndexingError
 * @augments {Error}
 */
export class ActionIndexingError extends Error {
  /**
   * Creates a new ActionIndexingError instance.
   *
   * @param {string} message - Description of the failure.
   * @param {string} actorId - The actor associated with the failure.
   * @param {number} [index] - The index involved in the error if applicable.
   */
  constructor(message, actorId, index = null) {
    super(message);
    this.name = 'ActionIndexingError';
    /** @type {string} */
    this.actorId = actorId;
    /** @type {number|null} */
    this.index = index;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ActionIndexingError);
    }
  }
}

export default ActionIndexingError;
