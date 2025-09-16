/**
 * @file Error thrown when a world references an entity instance that does not exist.
 */

import BaseError from './baseError.js';

/**
 * Error thrown when a world references a non-existent entity instance.
 *
 * @class MissingEntityInstanceError
 * @augments {BaseError}
 */
export class MissingEntityInstanceError extends BaseError {
  /**
   * @param {string} instanceId - The missing entity instance ID.
   * @param {string} worldFile - The world filename where the reference occurs.
   */
  constructor(instanceId, worldFile) {
    const message = `Unknown entity instanceId '${instanceId}' referenced in world '${worldFile}'.`;
    const context = { instanceId, worldFile };
    super(message, 'MISSING_ENTITY_INSTANCE_ERROR', context);
    this.name = 'MissingEntityInstanceError';
    // Backward compatibility
    this.instanceId = instanceId;
    this.worldFile = worldFile;
  }

  /**
   * @returns {string} Severity level for missing entity instance errors
   */
  getSeverity() {
    return 'error';
  }

  /**
   * @returns {boolean} Missing entity instance errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}

export default MissingEntityInstanceError;
