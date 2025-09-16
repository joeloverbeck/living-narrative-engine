/**
 * @file Error class for invalid or missing entity IDs.
 */

import BaseError from './baseError.js';

/**
 * Error thrown when a method receives a falsy entityId.
 *
 * @class InvalidEntityIdError
 * @augments {BaseError}
 */
export class InvalidEntityIdError extends BaseError {
  /**
   * @param {*} entityId - The invalid entity identifier.
   * @param {string} [message] - Optional custom message.
   */
  constructor(entityId, message = null) {
    const defaultMessage = `Invalid entityId: '${entityId}'.`;
    const context = { entityId };
    super(message || defaultMessage, 'INVALID_ENTITY_ID_ERROR', context);
    this.name = 'InvalidEntityIdError';
    // Backward compatibility
    this.entityId = entityId;
  }

  /**
   * @returns {string} Severity level for invalid entity ID errors
   */
  getSeverity() {
    return 'warning';
  }

  /**
   * @returns {boolean} Invalid entity ID errors are recoverable
   */
  isRecoverable() {
    return true;
  }
}
