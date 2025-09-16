/**
 * @file Defines custom error classes for initialization failures.
 */

import BaseError from './baseError.js';

/**
 * Base class for all initialization related errors.
 *
 * @class InitializationError
 * @augments {BaseError}
 */
export class InitializationError extends BaseError {
  /**
   * Create a new InitializationError.
   *
   * @param {string} message - Error message.
   * @param {Error} [cause] - Optional underlying cause.
   */
  constructor(message, cause) {
    super(message, 'INITIALIZATION_ERROR', { cause });
    this.name = 'InitializationError';
    // Backward compatibility: preserve cause property
    if (cause) {
      this.cause = cause;
    }
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * @returns {string} Severity level for initialization errors
   */
  getSeverity() {
    return 'critical';
  }

  /**
   * @returns {boolean} Initialization errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}

/**
 * Error thrown for failures during world initialization.
 *
 * @class WorldInitializationError
 * @augments {InitializationError}
 */
export class WorldInitializationError extends InitializationError {
  /**
   * Create a new WorldInitializationError.
   *
   * @param {string} message - Error message.
   * @param {Error} [cause] - Optional underlying cause.
   */
  constructor(message, cause) {
    super(message, cause);
    this.name = 'WorldInitializationError';
  }
}

/**
 * Error thrown for failures during system initialization or dependency setup.
 *
 * @class SystemInitializationError
 * @augments {InitializationError}
 */
export class SystemInitializationError extends InitializationError {
  /**
   * Create a new SystemInitializationError.
   *
   * @param {string} message - Error message.
   * @param {Error} [cause] - Optional underlying cause.
   */
  constructor(message, cause) {
    super(message, cause);
    this.name = 'SystemInitializationError';
  }
}
