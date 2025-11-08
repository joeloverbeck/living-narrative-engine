/**
 * @file Error class for parameter validation failures in scope resolution
 * @description Provides enhanced context for parameter validation failures with helpful hints and examples
 * @see BaseError.js - Base error class following project standard
 */

import BaseError from '../../errors/baseError.js';

/**
 * Error thrown when parameter validation fails during scope resolution
 * Provides structured context including expected/received types, hints, and usage examples
 *
 * @class ParameterValidationError
 * @augments {BaseError}
 */
export class ParameterValidationError extends BaseError {
  /**
   * Creates a new ParameterValidationError instance
   *
   * @param {string} message - The error message describing the validation failure
   * @param {object} [context] - Context information about the validation failure
   * @param {string} [context.expected] - Description of expected type/structure
   * @param {string} [context.received] - Description of actual type/structure
   * @param {string} [context.hint] - Helpful suggestion for fixing the error
   * @param {string} [context.example] - Code example showing correct usage
   */
  constructor(message, context = {}) {
    super(message, 'PARAMETER_VALIDATION_ERROR', context);
    this.name = 'ParameterValidationError';
  }

  /**
   * Returns the severity level for parameter validation errors
   *
   * @returns {string} Severity level for parameter validation errors
   */
  getSeverity() {
    return 'warning';
  }

  /**
   * Determines if parameter validation errors are recoverable
   *
   * @returns {boolean} Parameter validation errors are recoverable
   */
  isRecoverable() {
    return true;
  }

  /**
   * Creates a formatted string representation with enhanced context display
   * Overrides BaseError's default toString() to provide multi-line formatted output
   *
   * @returns {string} Formatted error string with sections for expected, received, hint, and example
   */
  toString() {
    const ctx = this.context;
    let result = `${this.name}: ${this.message}`;

    // Add expected type/structure if provided
    if (ctx.expected) {
      result += `\n  Expected: ${ctx.expected}`;
    }

    // Add received type/structure if provided
    if (ctx.received) {
      result += `\n  Received: ${ctx.received}`;
    }

    // Add hint with emoji indicator if provided
    if (ctx.hint) {
      // Handle multi-line hints with proper indentation
      const hintLines = ctx.hint.split('\n');
      result += `\n  💡 Hint: ${hintLines[0]}`;
      for (let i = 1; i < hintLines.length; i++) {
        result += `\n           ${hintLines[i]}`;
      }
    }

    // Add example with proper indentation if provided
    if (ctx.example) {
      result += `\n  Example:`;
      const exampleLines = ctx.example.split('\n');
      for (const line of exampleLines) {
        result += `\n    ${line}`;
      }
    }

    return result;
  }
}

export default ParameterValidationError;
