/**
 * @file TestModuleValidationError - Custom error class for test module validation failures
 * @description Provides detailed error information when test module configuration is invalid
 */

/**
 * Custom error class for test module validation failures.
 * Provides structured error information including field-specific validation errors.
 */
export class TestModuleValidationError extends Error {
  /**
   * Creates a test module validation error
   *
   * @param {string} message - The main error message
   * @param {Array<{field: string, message: string, code?: string}>} errors - Array of field-specific errors
   */
  constructor(message, errors = []) {
    super(message);
    this.name = 'TestModuleValidationError';
    this.errors = errors;
    
    // Capture stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TestModuleValidationError);
    }
  }

  /**
   * Get a formatted string representation of all validation errors
   *
   * @returns {string} Formatted error details
   */
  getFormattedErrors() {
    if (this.errors.length === 0) {
      return this.message;
    }

    const header = `${this.message}\nValidation errors:`;
    const errorList = this.errors
      .map(err => {
        const codeStr = err.code ? ` [${err.code}]` : '';
        return `  - ${err.field}: ${err.message}${codeStr}`;
      })
      .join('\n');

    return `${header}\n${errorList}`;
  }

  /**
   * Get errors for a specific field
   *
   * @param {string} field - The field name to filter by
   * @returns {Array<{field: string, message: string, code?: string}>} Errors for the specified field
   */
  getFieldErrors(field) {
    return this.errors.filter(err => err.field === field);
  }

  /**
   * Check if there are errors for a specific field
   *
   * @param {string} field - The field name to check
   * @returns {boolean} True if there are errors for the field
   */
  hasFieldErrors(field) {
    return this.errors.some(err => err.field === field);
  }

  /**
   * Get the total number of validation errors
   *
   * @returns {number} The number of validation errors
   */
  get errorCount() {
    return this.errors.length;
  }

  /**
   * Convert the error to a JSON-serializable object
   *
   * @returns {object} JSON representation of the error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errors: this.errors,
    };
  }
}