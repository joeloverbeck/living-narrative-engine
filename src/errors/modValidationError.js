/**
 * @file Base error class for mod validation failures
 * @description Provides a base error type for all mod validation errors with context and recovery information
 * @see src/errors/validationError.js - Base validation error pattern
 */

import BaseError from './baseError.js';

/**
 * Base error class for mod validation errors with context and recovery information
 *
 * @class
 * @augments {BaseError}
 */
export class ModValidationError extends BaseError {
  /**
   * Creates a new ModValidationError instance
   *
   * @param {string} message - The error message describing the validation failure
   * @param {string} code - Error code for classification (e.g., 'SECURITY_VIOLATION', 'FILE_CORRUPTION')
   * @param {object} context - Context information about where/how the error occurred
   * @param {boolean} [recoverable] - Whether the error is recoverable
   */
  constructor(message, code, context, recoverable = true) {
    const baseContext = { ...context, originalCode: code, originalRecoverable: recoverable };
    super(message, code || 'MOD_VALIDATION_ERROR', baseContext);
    this.name = 'ModValidationError';
    // Store properties for backward compatibility
    this._code = code;
    this._context = context;
    this._recoverable = recoverable;
  }

  /**
   * @returns {string} Severity level for mod validation errors
   */
  getSeverity() {
    return 'warning';
  }

  /**
   * @returns {boolean} Mod validation errors are recoverable
   */
  isRecoverable() {
    return this._recoverable !== undefined ? this._recoverable : true;
  }

  // Getters for backward compatibility
  get code() {
    return this._code || super.code;
  }

  get context() {
    return this._context || super.context;
  }

  get recoverable() {
    return this._recoverable !== undefined ? this._recoverable : true;
  }
  
  /**
   * Serializes the error for logging or reporting
   *
   * @returns {object} Serialized error object
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      recoverable: this.recoverable,
      timestamp: this.timestamp || new Date().toISOString(),
      stack: this.stack
    };
  }
  
  /**
   * Creates a formatted string representation of the error
   *
   * @returns {string} Formatted error string
   */
  toString() {
    return `${this.name} [${this.code}]: ${this.message} (${this.recoverable ? 'recoverable' : 'non-recoverable'})`;
  }
}

export default ModValidationError;