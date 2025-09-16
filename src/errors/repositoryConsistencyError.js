/**
 * @file Error class for repository consistency failures.
 */

import BaseError from './baseError.js';

/**
 * Error thrown when the entity repository reports success retrieving
 * an entity but fails to remove it.
 *
 * @class RepositoryConsistencyError
 * @augments {BaseError}
 */
export class RepositoryConsistencyError extends BaseError {
  /**
   * @param {string} instanceId - The ID of the entity instance that could not be removed.
   * @param {string} [message] - Optional custom error message.
   */
  constructor(instanceId, message = null) {
    const defaultMessage = `Internal error: Failed to remove entity '${instanceId}' from entity repository despite entity being found.`;
    const context = { instanceId };
    super(message || defaultMessage, 'REPOSITORY_CONSISTENCY_ERROR', context);
    this.name = 'RepositoryConsistencyError';
    // Backward compatibility
    this.instanceId = instanceId;
  }

  /**
   * @returns {string} Severity level for repository consistency errors
   */
  getSeverity() {
    return 'error';
  }

  /**
   * @returns {boolean} Repository consistency errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}

export default RepositoryConsistencyError;
