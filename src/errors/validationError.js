/**
 * @file Error for validation failures.
 */

import BaseError from './baseError.js';

/**
 * Error thrown when data validation fails.
 *
 * @class
 * @augments {BaseError}
 */
export class ValidationError extends BaseError {
  /**
   * @param {string} message - The error message describing the validation failure.
   * @param {string} [componentTypeId] - The ID of the component that failed validation.
   * @param {any} [validationErrors] - The validation errors returned by the validator.
   */
  constructor(message, componentTypeId = null, validationErrors = null) {
    super(message, 'VALIDATION_ERROR', { componentTypeId, validationErrors });
    this.name = 'ValidationError';
    // Backward compatibility: preserve existing properties
    this.componentTypeId = componentTypeId;
    this.validationErrors = validationErrors;
  }

  /**
   * @returns {string} Severity level for validation errors
   */
  getSeverity() {
    return 'warning';
  }

  /**
   * @returns {boolean} Validation errors are recoverable
   */
  isRecoverable() {
    return true;
  }
}
