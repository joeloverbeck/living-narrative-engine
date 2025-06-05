// src/errors/modDependencyError.js

/**
 * Custom error class for fatal mod dependency issues.
 * Mirrors the structure of RuleLoaderError, accepting an optional 'cause'.
 */
class ModDependencyError extends Error {
  /**
   * Creates an instance of ModDependencyError.
   *
   * @param {string} message - A consolidated message, often joined from multiple individual errors.
   * @param {Error | undefined} [cause] - The underlying error that caused this dependency issue, if any.
   */
  constructor(message, cause) {
    super(message); // Pass message to the base Error constructor
    this.name = 'ModDependencyError'; // Set the error name

    if (cause) {
      this.cause = cause; // Store the cause if provided
    }

    // Maintains compatibility with V8 stack trace capture
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ModDependencyError);
    }
  }
}

export default ModDependencyError;
