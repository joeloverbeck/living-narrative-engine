/**
 * @file Error thrown when an entity instance within a world file is missing an instanceId.
 */

import BaseError from './baseError.js';

/**
 * Error thrown when an instance lacks the required instanceId.
 *
 * @class MissingInstanceIdError
 * @augments {BaseError}
 */
export class MissingInstanceIdError extends BaseError {
  /**
   * @param {string} worldFile - World file where the instance resides.
   */
  constructor(worldFile) {
    const message = `Instance in world file '${worldFile}' is missing an 'instanceId'.`;
    const context = { worldFile };
    super(message, 'MISSING_INSTANCE_ID_ERROR', context);
    this.name = 'MissingInstanceIdError';
    // Backward compatibility
    this.worldFile = worldFile;
  }

  /**
   * @returns {string} Severity level for missing instance ID errors
   */
  getSeverity() {
    return 'error';
  }

  /**
   * @returns {boolean} Missing instance ID errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}

export default MissingInstanceIdError;
