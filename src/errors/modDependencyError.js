// src/errors/modDependencyError.js

import BaseError from './baseError.js';

/**
 * Custom error class for fatal mod dependency issues.
 * Mirrors the structure of RuleLoaderError, accepting an optional 'cause'.
 */
class ModDependencyError extends BaseError {
  /**
   * Creates an instance of ModDependencyError.
   *
   * @param {string} message - A consolidated message, often joined from multiple individual errors.
   * @param {Error | undefined} [cause] - The underlying error that caused this dependency issue, if any.
   */
  constructor(message, cause) {
    const context = { cause };
    super(message, 'MOD_DEPENDENCY_ERROR', context);
    this.name = 'ModDependencyError';

    // Backward compatibility
    if (cause) {
      this.cause = cause;
    }
  }

  /**
   * @returns {string} Severity level for mod dependency errors
   */
  getSeverity() {
    return 'error';
  }

  /**
   * @returns {boolean} Mod dependency errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}

export default ModDependencyError;
