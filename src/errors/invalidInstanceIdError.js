/**
 * @file Error class for invalid or missing instance IDs during reconstruction.
 */

/**
 * Error thrown when an entity instanceId is invalid.
 *
 * @class InvalidInstanceIdError
 * @augments {Error}
 */
export class InvalidInstanceIdError extends Error {
  /**
   * @param {string} instanceId - The invalid instance ID.
   * @param {string} [message] - Optional custom message.
   */
  constructor(instanceId, message = null) {
    const defaultMessage = `Invalid instanceId: '${instanceId}'.`;
    super(message || defaultMessage);
    this.name = 'InvalidInstanceIdError';
    this.instanceId = instanceId;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidInstanceIdError);
    }
  }
}
