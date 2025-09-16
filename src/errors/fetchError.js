/**
 * @file Error type for fetch operation failures.
 */

import BaseError from './baseError.js';

/**
 * Error thrown when a file or resource cannot be fetched.
 *
 * @class
 * @augments {BaseError}
 */
export class FetchError extends BaseError {
  /**
   * Create a new FetchError instance.
   *
   * @param {string} message - Description of the fetch failure.
   * @param {string} [path] - Path or URL that failed to fetch.
   */
  constructor(message, path = null) {
    super(message, 'FETCH_ERROR', { path });
    this.name = 'FetchError';
    // Backward compatibility: preserve existing property
    this.path = path;
  }

  /**
   * @returns {string} Severity level for fetch errors
   */
  getSeverity() {
    return 'warning';
  }

  /**
   * @returns {boolean} Fetch errors are recoverable (can retry)
   */
  isRecoverable() {
    return true;
  }
}

export default FetchError;
