/**
 * Error thrown when an invalid EnvironmentContext is provided.
 *
 * @class InvalidEnvironmentContextError
 * @augments {Error}
 * @param {string} message - Error message describing the failure.
 * @param {object} [details] - Optional details about the invalid context.
 */
export class InvalidEnvironmentContextError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'InvalidEnvironmentContextError';
    this.details = details;
  }
}

// --- FILE END ---
