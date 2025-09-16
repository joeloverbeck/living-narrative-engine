// src/errors/modsLoaderError.js

import BaseError from './baseError.js';

/**
 * Custom error class representing fatal failures during the world loading
 * sequence. It wraps the original error to provide additional context
 * while still preserving the underlying stack trace.
 *
 * @class ModsLoaderError
 * @augments BaseError
 * @param {string} message - A human friendly message describing the failure.
 * @param {string} [code] - An optional error code.
 * @param {Error} [originalError] - The original error that triggered this failure.
 */
class ModsLoaderError extends BaseError {
  constructor(message, code, originalError) {
    const context = { code, originalError };
    super(message, code || 'MODS_LOADER_ERROR', context);
    this.name = 'ModsLoaderError';
    // Store for backward compatibility
    if (originalError) {
      this.cause = originalError;
    }
  }

  /**
   * @returns {string} Severity level for mods loader errors
   */
  getSeverity() {
    return 'error';
  }

  /**
   * @returns {boolean} Mods loader errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}

export default ModsLoaderError;
