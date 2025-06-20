// src/errors/modsLoaderError.js
/**
 * Custom error class representing fatal failures during the world loading
 * sequence. It wraps the original error to provide additional context
 * while still preserving the underlying stack trace.
 *
 * @class ModsLoaderError
 * @augments Error
 * @param {string} message - A human friendly message describing the failure.
 * @param {Error} [cause] - The original error that triggered this failure.
 */
class ModsLoaderError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'ModsLoaderError';
    if (cause) {
      this.cause = cause;
    }
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ModsLoaderError);
    }
  }
}

export default ModsLoaderError;
