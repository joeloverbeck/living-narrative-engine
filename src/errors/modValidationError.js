/**
 * @file Base error class for mod validation failures
 * @description Provides a base error type for all mod validation errors with context and recovery information
 * @see src/errors/validationError.js - Base validation error pattern
 */

/**
 * Base error class for mod validation errors with context and recovery information
 * @class
 * @extends {Error}
 */
export class ModValidationError extends Error {
  /**
   * Creates a new ModValidationError instance
   * 
   * @param {string} message - The error message describing the validation failure
   * @param {string} code - Error code for classification (e.g., 'SECURITY_VIOLATION', 'FILE_CORRUPTION')
   * @param {object} context - Context information about where/how the error occurred
   * @param {boolean} [recoverable=true] - Whether the error is recoverable
   */
  constructor(message, code, context, recoverable = true) {
    super(message);
    this.name = 'ModValidationError';
    this.code = code;
    this.context = context;
    this.recoverable = recoverable;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Serializes the error for logging or reporting
   * @returns {object} Serialized error object
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
  
  /**
   * Creates a formatted string representation of the error
   * @returns {string} Formatted error string
   */
  toString() {
    return `${this.name} [${this.code}]: ${this.message} (${this.recoverable ? 'recoverable' : 'non-recoverable'})`;
  }
}

export default ModValidationError;