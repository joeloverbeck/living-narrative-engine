/**
 * @file Character builder specific error classes
 * @description Provides domain-specific error classes for character builder operations
 * @see ../services/characterBuilderService.js
 * @see ../../errors/clicheErrors.js
 */

/**
 * Base error class for character builder operations
 *
 * Provides common structure for all character builder related errors
 * with proper error chaining and detailed context.
 */
export class CharacterBuilderError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {object} [context] - Additional error context
   * @param {Error} [cause] - Original error that caused this error
   */
  constructor(message, context = {}, cause = null) {
    super(message);
    this.name = 'CharacterBuilderError';
    this.context = context;
    this.cause = cause;
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CharacterBuilderError);
    }
  }

  /**
   * Convert error to JSON for logging
   *
   * @returns {object} JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      cause: this.cause?.message || null,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Error thrown when cliché generation fails
 *
 * Specifically for errors during the cliché generation process
 * that are not LLM-specific.
 */
export class ClicheGenerationError extends CharacterBuilderError {
  /**
   * @param {string} message - Error message
   * @param {object} [context] - Additional context
   * @param {string} [context.directionId] - Direction being processed
   * @param {string} [context.conceptId] - Concept being processed
   * @param {Error} [cause] - Original error
   */
  constructor(message, context = {}, cause = null) {
    super(message, context, cause);
    this.name = 'ClicheGenerationError';
  }
}

/**
 * Error thrown when cliché storage fails
 *
 * Handles failures in persisting cliché data to storage.
 */
export class ClicheStorageError extends CharacterBuilderError {
  /**
   * @param {string} message - Error message
   * @param {string} operation - Storage operation that failed
   * @param {object} [context] - Additional context
   * @param {Error} [cause] - Original error
   */
  constructor(message, operation, context = {}, cause = null) {
    super(message, { ...context, operation }, cause);
    this.name = 'ClicheStorageError';
    this.operation = operation;
  }
}

// Export all error classes
export default {
  CharacterBuilderError,
  ClicheGenerationError,
  ClicheStorageError,
};
