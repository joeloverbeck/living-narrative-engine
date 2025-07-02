/**
 * @file Error thrown when a location entity cannot be found.
 */

/**
 * Error thrown when a location entity is missing or the provided identifier is invalid.
 *
 * @class LocationNotFoundError
 * @augments {Error}
 */
export class LocationNotFoundError extends Error {
  /**
   * @param {string|null|undefined} locationEntityId - The missing location entity identifier.
   * @param {string} [message] - Optional custom message.
   */
  constructor(locationEntityId, message = null) {
    const defaultMessage = `Location entity not found: '${locationEntityId}'`;
    super(message || defaultMessage);
    this.name = 'LocationNotFoundError';
    this.locationEntityId = locationEntityId;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LocationNotFoundError);
    }
  }
}
