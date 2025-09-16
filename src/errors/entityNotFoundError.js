/**
 * @file Error for the cases when an entity hasn't been found.
 * @see src/errors/entityNotFound.js
 */

import BaseError from './baseError.js';

/**
 * Error thrown when an entity instance cannot be found in the manager.
 *
 * @class
 * @augments {BaseError}
 */
export class EntityNotFoundError extends BaseError {
  /**
   * Create a new EntityNotFoundError instance.
   *
   * @param {string} instanceId - The ID of the instance that was not found.
   */
  constructor(instanceId) {
    const message = `Entity instance not found: '${instanceId}'`;
    super(message, 'NOT_FOUND_ERROR', { instanceId });
    this.name = 'EntityNotFoundError';
    // Backward compatibility: preserve existing property
    this.instanceId = instanceId;
  }

  /**
   * @returns {string} Severity level for not found errors
   */
  getSeverity() {
    return 'error';
  }

  /**
   * @returns {boolean} Entity not found errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}
