/**
 * @file Custom error for traits rewriter generation failures
 * @see ../services/TraitsRewriterGenerator.js
 * @see characterBuilderError.js
 */

import { CharacterBuilderError } from './characterBuilderError.js';

/**
 * Error codes for traits rewriter failures
 */
export const TRAITS_REWRITER_ERROR_CODES = {
  INVALID_CHARACTER_DEFINITION: 'INVALID_CHARACTER_DEFINITION',
  GENERATION_FAILED: 'GENERATION_FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  MISSING_TRAITS: 'MISSING_TRAITS',
  EXPORT_FAILED: 'EXPORT_FAILED',
  INVALID_FORMAT: 'INVALID_FORMAT',
  CONTENT_SANITIZATION_FAILED: 'CONTENT_SANITIZATION_FAILED',
};

/**
 * Custom error for traits rewriter generation failures
 *
 * Provides specific error handling for the traits rewriter generation process
 * with enhanced context and error chaining capabilities.
 */
export class TraitsRewriterError extends CharacterBuilderError {
  /**
   * Create a new TraitsRewriterError
   *
   * @param {string} message - Human-readable error message
   * @param {object} [context] - Additional error context
   * @param {string} [context.characterName] - Character name being processed
   * @param {string} [context.stage] - Generation stage where error occurred
   * @param {Array<string>} [context.traitTypes] - Trait types being processed
   * @param {number} [context.attempt] - Retry attempt number
   * @param {string} [context.errorCode] - Specific error code
   * @param {Error} [cause] - Original error that caused this error
   */
  constructor(message, context = {}, cause = null) {
    super(message, context, cause);
    this.name = 'TraitsRewriterError';

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TraitsRewriterError);
    }
  }

  /**
   * Create error for invalid character definition
   *
   * @param {string} reason - Reason for invalidity
   * @param {object} [context] - Additional context
   * @returns {TraitsRewriterError} Invalid character definition error instance
   */
  static forInvalidCharacterDefinition(reason, context = {}) {
    return new TraitsRewriterError(`Invalid character definition: ${reason}`, {
      ...context,
      errorCode: TRAITS_REWRITER_ERROR_CODES.INVALID_CHARACTER_DEFINITION,
      stage: 'validation',
    });
  }

  /**
   * Create error for generation failures
   *
   * @param {string} reason - Reason for generation failure
   * @param {object} [context] - Additional context
   * @param {Error} [cause] - Original error
   * @returns {TraitsRewriterError} Generation failure error instance
   */
  static forGenerationFailure(reason, context = {}, cause = null) {
    return new TraitsRewriterError(
      `Traits rewriter generation failed: ${reason}`,
      {
        ...context,
        errorCode: TRAITS_REWRITER_ERROR_CODES.GENERATION_FAILED,
        stage: 'generation',
      },
      cause
    );
  }

  /**
   * Create error for validation failures
   *
   * @param {string} field - Field that failed validation
   * @param {string} reason - Reason for validation failure
   * @param {object} [context] - Additional context
   * @returns {TraitsRewriterError} Validation error instance
   */
  static forValidationFailure(field, reason, context = {}) {
    return new TraitsRewriterError(
      `Validation failed for ${field}: ${reason}`,
      {
        ...context,
        errorCode: TRAITS_REWRITER_ERROR_CODES.VALIDATION_FAILED,
        validationField: field,
        validationReason: reason,
        stage: 'validation',
      }
    );
  }

  /**
   * Create error for missing traits
   *
   * @param {string} characterName - Character name being processed
   * @param {object} [context] - Additional context
   * @returns {TraitsRewriterError} Missing traits error instance
   */
  static forMissingTraits(characterName, context = {}) {
    return new TraitsRewriterError(
      `No extractable traits found for character: ${characterName}`,
      {
        ...context,
        errorCode: TRAITS_REWRITER_ERROR_CODES.MISSING_TRAITS,
        stage: 'trait_extraction',
      }
    );
  }

  /**
   * Create error for LLM communication failures
   *
   * @param {string} reason - Reason for LLM failure
   * @param {object} [context] - Additional context
   * @param {Error} [cause] - Original error
   * @returns {TraitsRewriterError} LLM error instance
   */
  static forLLMFailure(reason, context = {}, cause = null) {
    return new TraitsRewriterError(
      `LLM request failed: ${reason}`,
      {
        ...context,
        errorCode: TRAITS_REWRITER_ERROR_CODES.GENERATION_FAILED,
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
   * @returns {TraitsRewriterError} Parsing error instance
   */
  static forParsingFailure(reason, context = {}, cause = null) {
    return new TraitsRewriterError(
      `Response parsing failed: ${reason}`,
      {
        ...context,
        errorCode: TRAITS_REWRITER_ERROR_CODES.VALIDATION_FAILED,
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
   * @returns {TraitsRewriterError} Quality error instance
   */
  static forQualityFailure(issues, context = {}) {
    return new TraitsRewriterError(`Response quality issues: ${issues}`, {
      ...context,
      errorCode: TRAITS_REWRITER_ERROR_CODES.VALIDATION_FAILED,
      stage: 'quality_validation',
    });
  }

  /**
   * Create error for export failures
   *
   * @param {string} reason - Reason for export failure
   * @param {object} [context] - Additional context
   * @param {Error} [cause] - Original error
   * @returns {TraitsRewriterError} Export failure error instance
   */
  static forExportFailure(reason, context = {}, cause = null) {
    return new TraitsRewriterError(
      `Export operation failed: ${reason}`,
      {
        ...context,
        errorCode: TRAITS_REWRITER_ERROR_CODES.EXPORT_FAILED,
        stage: 'export',
      },
      cause
    );
  }

  /**
   * Create error for invalid format
   *
   * @param {string} format - The invalid format requested
   * @param {Array<string>} supportedFormats - List of supported formats
   * @param {object} [context] - Additional context
   * @returns {TraitsRewriterError} Invalid format error instance
   */
  static forInvalidFormat(format, supportedFormats, context = {}) {
    return new TraitsRewriterError(
      `Invalid format '${format}'. Supported formats: ${supportedFormats.join(
        ', '
      )}`,
      {
        ...context,
        errorCode: TRAITS_REWRITER_ERROR_CODES.INVALID_FORMAT,
        stage: 'format_validation',
        requestedFormat: format,
        supportedFormats,
      }
    );
  }

  /**
   * Create error for content sanitization failures
   *
   * @param {string} reason - Reason for sanitization failure
   * @param {object} [context] - Additional context
   * @param {Error} [cause] - Original error
   * @returns {TraitsRewriterError} Content sanitization error instance
   */
  static forSanitizationFailure(reason, context = {}, cause = null) {
    return new TraitsRewriterError(
      `Content sanitization failed: ${reason}`,
      {
        ...context,
        errorCode: TRAITS_REWRITER_ERROR_CODES.CONTENT_SANITIZATION_FAILED,
        stage: 'content_sanitization',
      },
      cause
    );
  }
}

export default TraitsRewriterError;
