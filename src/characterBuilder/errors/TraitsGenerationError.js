/**
 * @file Custom error for traits generation failures
 * @see ../services/TraitsGenerator.js
 * @see characterBuilderError.js
 */

import { CharacterBuilderError } from './characterBuilderError.js';

/**
 * Custom error for traits generation failures
 *
 * Provides specific error handling for the traits generation process
 * with enhanced context and error chaining capabilities.
 */
export class TraitsGenerationError extends CharacterBuilderError {
  /**
   * Create a new TraitsGenerationError
   *
   * @param {string} message - Human-readable error message
   * @param {object} [context] - Additional error context
   * @param {string} [context.conceptId] - Character concept ID being processed
   * @param {string} [context.directionId] - Thematic direction ID being processed
   * @param {string} [context.stage] - Generation stage where error occurred
   * @param {number} [context.attempt] - Retry attempt number
   * @param {Error} [cause] - Original error that caused this error
   */
  constructor(message, context = {}, cause = null) {
    super(message, context, cause);
    this.name = 'TraitsGenerationError';

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TraitsGenerationError);
    }
  }

  /**
   * Create error for validation failures
   *
   * @param {string} field - Field that failed validation
   * @param {string} reason - Reason for validation failure
   * @param {object} [context] - Additional context
   * @returns {TraitsGenerationError} Validation error instance
   */
  static forValidation(field, reason, context = {}) {
    return new TraitsGenerationError(
      `Validation failed for ${field}: ${reason}`,
      {
        ...context,
        validationField: field,
        validationReason: reason,
        stage: 'validation',
      }
    );
  }

  /**
   * Create error for LLM communication failures
   *
   * @param {string} reason - Reason for LLM failure
   * @param {object} [context] - Additional context
   * @param {Error} [cause] - Original error
   * @returns {TraitsGenerationError} LLM error instance
   */
  static forLLMFailure(reason, context = {}, cause = null) {
    return new TraitsGenerationError(
      `LLM request failed: ${reason}`,
      {
        ...context,
        stage: 'llm_request',
      },
      cause
    );
  }

  /**
   * Create error for response parsing failures
   *
   * @param {string} reason - Reason for parsing failure
   * @param {object} [context] - Additional context
   * @param {Error} [cause] - Original error
   * @returns {TraitsGenerationError} Parsing error instance
   */
  static forParsingFailure(reason, context = {}, cause = null) {
    return new TraitsGenerationError(
      `Response parsing failed: ${reason}`,
      {
        ...context,
        stage: 'response_parsing',
      },
      cause
    );
  }

  /**
   * Create error for quality validation failures
   *
   * @param {string} issues - Quality issues found
   * @param {object} [context] - Additional context
   * @returns {TraitsGenerationError} Quality error instance
   */
  static forQualityFailure(issues, context = {}) {
    return new TraitsGenerationError(`Response quality issues: ${issues}`, {
      ...context,
      stage: 'quality_validation',
    });
  }
}

export default TraitsGenerationError;
