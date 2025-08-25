/**
 * @file Custom error for speech patterns generation failures
 * @description Error classes for Speech Patterns Generator service
 * @see ../services/SpeechPatternsGenerator.js
 */

/**
 * Custom error for speech patterns generation failures
 * Following the pattern established by ClicheGenerationError and TraitsGenerationError
 */
export class SpeechPatternsGenerationError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'SpeechPatternsGenerationError';
    this.cause = cause;
  }
}

/**
 * Custom error for speech patterns response processing failures
 */
export class SpeechPatternsResponseProcessingError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'SpeechPatternsResponseProcessingError';
    this.cause = cause;
  }
}

/**
 * Custom error for speech patterns validation failures
 */
export class SpeechPatternsValidationError extends Error {
  constructor(message, validationErrors = [], cause) {
    super(message);
    this.name = 'SpeechPatternsValidationError';
    this.validationErrors = validationErrors;
    this.cause = cause;
  }
}

export default SpeechPatternsGenerationError;