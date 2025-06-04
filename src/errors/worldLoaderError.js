// src/errors/worldLoaderError.js
/**
 * Custom error class representing fatal failures during the world loading
 * sequence. It wraps the original error to provide additional context
 * while still preserving the underlying stack trace.
 *
 * @class WorldLoaderError
 * @augments Error
 * @param {string} message - A human friendly message describing the failure.
 * @param {Error} [cause] - The original error that triggered this failure.
 */
class WorldLoaderError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'WorldLoaderError';
    if (cause) {
      this.cause = cause;
    }
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WorldLoaderError);
    }
  }
}

export default WorldLoaderError;
