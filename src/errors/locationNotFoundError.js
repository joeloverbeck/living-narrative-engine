/**
 * @file Error thrown when a location entity cannot be found.
 */

import BaseError from './baseError.js';

/**
 * Error thrown when a location entity is missing or the provided identifier is invalid.
 *
 * @class LocationNotFoundError
 * @augments {BaseError}
 */
export class LocationNotFoundError extends BaseError {
  /**
   * @param {string|null|undefined} locationEntityId - The missing location entity identifier.
   * @param {string} [message] - Optional custom message.
   */
  constructor(locationEntityId, message = null) {
    const defaultMessage = `Location entity not found: '${locationEntityId}'`;
    const context = { locationEntityId };
    super(message || defaultMessage, 'LOCATION_NOT_FOUND_ERROR', context);
    this.name = 'LocationNotFoundError';
    // Backward compatibility
    this.locationEntityId = locationEntityId;
  }

  /**
   * @returns {string} Severity level for location not found errors
   */
  getSeverity() {
    return 'error';
  }

  /**
   * @returns {boolean} Location not found errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}
