// src/errors/modsLoaderError.js
/**
 * Custom error class representing fatal failures during the world loading
 * sequence. It wraps the original error to provide additional context
 * while still preserving the underlying stack trace.
 *
 * @class ModsLoaderError
 * @augments Error
 * @param {string} message - A human friendly message describing the failure.
 * @param {string} [code] - An optional error code.
 * @param {Error} [originalError] - The original error that triggered this failure.
 */
class ModsLoaderError extends Error {
  constructor(message, code, originalError) {
    super(message);
    this.name = 'ModsLoaderError';
    this.code = code;

    if (originalError) {
      this.cause = originalError;
    }

    // Preserve stack trace (if captureStackTrace is available)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ModsLoaderError);
    }
  }
}

export default ModsLoaderError;
