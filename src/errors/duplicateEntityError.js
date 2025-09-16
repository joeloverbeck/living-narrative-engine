/**
 * @file Error for duplicate entity creation attempts.
 */

import BaseError from './baseError.js';

/**
 * Error thrown when attempting to create an entity with an ID that already exists.
 *
 * @class
 * @augments {BaseError}
 */
export class DuplicateEntityError extends BaseError {
  /**
   * Create a new DuplicateEntityError instance.
   *
   * @param {string} entityId - The ID of the entity that already exists.
   * @param {string} [message] - Optional custom error message.
   */
  constructor(entityId, message = null) {
    const defaultMessage = `Entity with ID '${entityId}' already exists.`;
    super(message || defaultMessage, 'DUPLICATE_ENTITY_ERROR', { entityId });
    this.name = 'DuplicateEntityError';
    // Backward compatibility: preserve existing property
    this.entityId = entityId;
  }

  /**
   * @returns {string} Severity level for duplicate entity errors
   */
  getSeverity() {
    return 'warning';
  }

  /**
   * @returns {boolean} Duplicate entity errors are recoverable
   */
  isRecoverable() {
    return true;
  }
}
