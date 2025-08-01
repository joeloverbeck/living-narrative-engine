/**
 * @file ServiceError - Custom error class for pipeline services
 * @see BaseService.js
 */

import { InvalidArgumentError } from '../../../../errors/invalidArgumentError.js';

/**
 * Custom error class for pipeline service errors
 *
 * Used for errors that occur within the pipeline service layer,
 * including validation failures, dependency issues, and operational errors.
 */
export class ServiceError extends InvalidArgumentError {
  /**
   * @param {string} message - Error message
   * @param {string} code - Error code for categorization
   * @param {*} [value] - Invalid value that caused the error
   */
  constructor(message, code, value) {
    super(message, code, value);
    this.name = 'ServiceError';
    this.code = code;
  }
}

// Export common error codes as constants
export const ServiceErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR',
  CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',
  MISSING_PARAMETER: 'MISSING_PARAMETER',
  INVALID_STATE: 'INVALID_STATE',
  OPERATION_FAILED: 'OPERATION_FAILED',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
};
