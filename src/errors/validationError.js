/**
 * @file Error for validation failures.
 */

/**
 * Error thrown when data validation fails.
 *
 * @class
 * @augments {Error}
 */
export class ValidationError extends Error {
  /**
   * @param {string} message - The error message describing the validation failure.
   * @param {string} [componentTypeId] - The ID of the component that failed validation.
   * @param {any} [validationErrors] - The validation errors returned by the validator.
   */
  constructor(message, componentTypeId = null, validationErrors = null) {
    super(message);
    this.name = 'ValidationError';
    this.componentTypeId = componentTypeId;
    this.validationErrors = validationErrors;
  }
}
