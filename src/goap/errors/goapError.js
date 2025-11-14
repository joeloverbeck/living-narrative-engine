/**
 * @file Base error class for all GOAP-related errors
 * @description Foundation class for GOAP system errors with appropriate defaults for planning and refinement
 * @see BaseError.js - Base error class this extends
 */

import BaseError from '../../errors/baseError.js';

/**
 * Base error class for all GOAP (Goal-Oriented Action Planning) errors
 * Provides consistent error handling across the GOAP system with appropriate defaults
 *
 * @class
 * @augments {BaseError}
 */
class GoapError extends BaseError {
  /**
   * Creates a new GoapError instance
   *
   * @param {string} message - The error message describing the failure
   * @param {string} code - Error code for classification (use GOAP_*_ERROR pattern)
   * @param {object} [context] - Context information about where/how the error occurred
   * @param {object} [options] - Additional options
   * @param {string} [options.correlationId] - Custom correlation ID (auto-generated if not provided)
   * @throws {Error} If required parameters are missing or invalid
   */
  constructor(message, code, context = {}, options = {}) {
    super(message, code, context, options);
  }

  /**
   * Determines error severity for GOAP errors
   * Default to 'error' severity - most GOAP failures are errors but recoverable
   *
   * @returns {string} Severity level ('error')
   * @override
   */
  getSeverity() {
    return 'error';
  }

  /**
   * Determines if error is recoverable for GOAP errors
   * Default to true - most GOAP errors are recoverable via replanning
   *
   * @returns {boolean} Whether the error is recoverable (true)
   * @override
   */
  isRecoverable() {
    return true;
  }
}

export default GoapError;
