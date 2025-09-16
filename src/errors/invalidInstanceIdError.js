/**
 * @file Error class for invalid or missing instance IDs during reconstruction.
 */

import BaseError from './baseError.js';

/**
 * Error thrown when an entity instanceId is invalid.
 *
 * @class InvalidInstanceIdError
 * @augments {BaseError}
 */
export class InvalidInstanceIdError extends BaseError {
  /**
   * @param {string} instanceId - The invalid instance ID.
   * @param {string} [message] - Optional custom message.
   */
  constructor(instanceId, message = null) {
    const defaultMessage = `Invalid instanceId: '${instanceId}'.`;
    const context = { instanceId };
    super(message || defaultMessage, 'INVALID_INSTANCE_ID_ERROR', context);
    this.name = 'InvalidInstanceIdError';
    // Backward compatibility
    this.instanceId = instanceId;
  }

  /**
   * @returns {string} Severity level for invalid instance ID errors
   */
  getSeverity() {
    return 'warning';
  }

  /**
   * @returns {boolean} Invalid instance ID errors are recoverable
   */
  isRecoverable() {
    return true;
  }
}
