import BaseError from './baseError.js';

/**
 * Error thrown when an invalid EnvironmentContext is provided.
 *
 * @class InvalidEnvironmentContextError
 * @augments {BaseError}
 * @param {string} message - Error message describing the failure.
 * @param {object} [details] - Optional details about the invalid context.
 */
export class InvalidEnvironmentContextError extends BaseError {
  constructor(message, details = {}) {
    super(message, 'INVALID_ENVIRONMENT_CONTEXT_ERROR', details);
    this.name = 'InvalidEnvironmentContextError';
    // Backward compatibility
    this.details = details;
  }

  /**
   * @returns {string} Severity level for invalid environment context errors
   */
  getSeverity() {
    return 'warning';
  }

  /**
   * @returns {boolean} Invalid environment context errors are recoverable
   */
  isRecoverable() {
    return true;
  }
}

// --- FILE END ---
