/**
 * @file Domain-specific error classes for cliché generation
 *
 * Provides a hierarchical error system for cliché-related operations with:
 * - Base ClicheError class with common error properties
 * - Specialized error types for different failure scenarios
 * - Structured error details for debugging and recovery
 * - Error codes for programmatic handling
 * @see ../characterBuilder/validators/clicheValidator.js
 * @see ../characterBuilder/services/clicheErrorHandler.js
 */

import BaseError from './baseError.js';

/**
 * Base error class for all cliché-related errors
 *
 * Provides common structure and functionality for all domain-specific
 * cliché errors with proper error chaining and detailed context.
 */
export class ClicheError extends BaseError {
  /**
   * @param {string} message - Human-readable error message
   * @param {object} [details] - Additional error context and metadata
   * @param {string} [details.code] - Error code for programmatic handling
   * @param {string} [details.operation] - Operation that failed
   * @param {*} [details.context] - Additional context data
   */
  constructor(message, details = {}) {
    const errorCode = details.code || 'CLICHE_ERROR';
    super(message, errorCode, details.context);
    this.name = 'ClicheError';
    // Store additional properties for backward compatibility
    this.operation = details.operation;
    this.details = details;
  }

  /**
   * @returns {string} Severity level for cliché errors
   */
  getSeverity() {
    return 'warning';
  }

  /**
   * @returns {boolean} Cliché errors are recoverable
   */
  isRecoverable() {
    return true;
  }

  /**
   * Convert error to JSON for logging and debugging
   *
   * @returns {object} JSON representation of the error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      operation: this.operation,
      context: this.context,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Error thrown when LLM generation fails
 *
 * Handles failures in the cliché generation process including:
 * - LLM service timeouts or connectivity issues
 * - Invalid or malformed LLM responses
 * - Generation quota exceeded or rate limiting
 */
export class ClicheGenerationError extends ClicheError {
  /**
   * @param {string} message - Human-readable error message
   * @param {object} [details] - Additional error context
   * @param {string} [details.directionId] - Direction ID being processed
   * @param {string} [details.conceptId] - Concept ID being processed
   * @param {number} [details.attempt] - Current retry attempt number
   * @param {number} [details.statusCode] - HTTP status code if applicable
   */
  constructor(message, details = {}) {
    super(message, { ...details, code: 'CLICHE_GENERATION_ERROR' });
    this.name = 'ClicheGenerationError';
    this.directionId = details.directionId;
    this.conceptId = details.conceptId;
    this.attempt = details.attempt || 1;
    this.statusCode = details.statusCode;
  }
}

/**
 * Error thrown when validation fails
 *
 * Handles validation failures for:
 * - User input validation (direction selection, prerequisites)
 * - LLM response validation (structure, content requirements)
 * - Data integrity validation (required fields, formats)
 */
export class ClicheValidationError extends ClicheError {
  /**
   * @param {string} message - Human-readable error message
   * @param {string[]} [validationErrors] - Detailed validation error messages
   * @param {object} [details] - Additional error context
   * @param {*} [details.invalidData] - The data that failed validation
   * @param {string} [details.validator] - The validator that failed
   */
  constructor(message, validationErrors = [], details = {}) {
    super(message, {
      ...details,
      code: 'CLICHE_VALIDATION_ERROR',
      validationErrors,
    });
    this.name = 'ClicheValidationError';
    this.validationErrors = validationErrors;
    this.invalidData = details.invalidData;
    this.validator = details.validator;
  }

  /**
   * Get user-friendly validation error summary
   *
   * @returns {string} Formatted validation errors for display
   */
  getValidationSummary() {
    if (this.validationErrors.length === 0) {
      return this.message;
    }

    if (this.validationErrors.length === 1) {
      return this.validationErrors[0];
    }

    return `${this.message}:\n• ${this.validationErrors.join('\n• ')}`;
  }
}

/**
 * Error thrown when storage operations fail
 *
 * Handles failures in data persistence including:
 * - Database connection or transaction failures
 * - Storage quota exceeded or permission issues
 * - Data serialization or corruption problems
 */
export class ClicheStorageError extends ClicheError {
  /**
   * @param {string} message - Human-readable error message
   * @param {string} [operation] - Storage operation that failed (save, load, delete)
   * @param {object} [details] - Additional error context
   * @param {string} [details.storageType] - Type of storage (database, cache, memory)
   * @param {*} [details.data] - Data involved in the failed operation
   */
  constructor(message, operation, details = {}) {
    super(message, {
      ...details,
      code: 'CLICHE_STORAGE_ERROR',
      operation,
    });
    this.name = 'ClicheStorageError';
    this.storageOperation = operation;
    this.storageType = details.storageType;
    this.failedData = details.data;
  }
}

/**
 * Error thrown when LLM service fails
 *
 * Handles LLM service-specific failures including:
 * - Authentication or API key issues
 * - Service unavailability or maintenance
 * - Rate limiting or quota exceeded
 * - Network connectivity problems
 */
export class ClicheLLMError extends ClicheError {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} [statusCode] - HTTP status code from LLM service
   * @param {object} [details] - Additional error context
   * @param {string} [details.provider] - LLM provider name (OpenAI, Anthropic, etc.)
   * @param {string} [details.endpoint] - API endpoint that failed
   * @param {boolean} [details.isRetryable] - Whether the error can be retried
   */
  constructor(message, statusCode = null, details = {}) {
    super(message, {
      ...details,
      code: 'CLICHE_LLM_ERROR',
      statusCode,
    });
    this.name = 'ClicheLLMError';
    this.statusCode = statusCode;
    this.provider = details.provider;
    this.endpoint = details.endpoint;
    this.isRetryable = details.isRetryable !== false; // Default to retryable
  }

  /**
   * Determine if this error indicates a temporary service issue
   *
   * @returns {boolean} True if the error is likely temporary and retryable
   */
  isTemporaryFailure() {
    // 5xx errors, rate limiting, and timeouts are typically temporary
    return (
      this.statusCode >= 500 ||
      this.statusCode === 429 ||
      this.statusCode === 408 ||
      this.message.toLowerCase().includes('timeout') ||
      this.message.toLowerCase().includes('unavailable')
    );
  }
}

/**
 * Error thrown when data integrity is compromised
 *
 * Handles data corruption or inconsistency issues including:
 * - Missing required references (direction, concept not found)
 * - Data structure corruption or invalid relationships
 * - Cache inconsistency or stale data problems
 */
export class ClicheDataIntegrityError extends ClicheError {
  /**
   * @param {string} message - Human-readable error message
   * @param {string} [dataType] - Type of data affected (direction, concept, cliches)
   * @param {object} [details] - Additional error context
   * @param {*} [details.expectedData] - What data was expected
   * @param {*} [details.actualData] - What data was actually found
   * @param {string} [details.source] - Source of the corrupted data
   */
  constructor(message, dataType, details = {}) {
    super(message, {
      ...details,
      code: 'CLICHE_DATA_INTEGRITY_ERROR',
      dataType,
    });
    this.name = 'ClicheDataIntegrityError';
    this.dataType = dataType;
    this.expectedData = details.expectedData;
    this.actualData = details.actualData;
    this.source = details.source;
  }
}

/**
 * Error thrown when prerequisite conditions are not met
 *
 * Handles situations where required preconditions for operations
 * are not satisfied, such as missing dependencies or invalid state.
 */
export class ClichePrerequisiteError extends ClicheError {
  /**
   * @param {string} message - Human-readable error message
   * @param {string[]} [missingPrerequisites] - List of missing prerequisites
   * @param {object} [details] - Additional error context
   * @param {string} [details.operation] - Operation requiring prerequisites
   */
  constructor(message, missingPrerequisites = [], details = {}) {
    super(message, {
      ...details,
      code: 'CLICHE_PREREQUISITE_ERROR',
      missingPrerequisites,
    });
    this.name = 'ClichePrerequisiteError';
    this.missingPrerequisites = missingPrerequisites;
  }
}

// Export all error classes for easy importing
export const ClicheErrors = {
  ClicheError,
  ClicheGenerationError,
  ClicheValidationError,
  ClicheStorageError,
  ClicheLLMError,
  ClicheDataIntegrityError,
  ClichePrerequisiteError,
};

// Export error codes for programmatic handling
export const CLICHE_ERROR_CODES = {
  GENERIC: 'CLICHE_ERROR',
  GENERATION: 'CLICHE_GENERATION_ERROR',
  VALIDATION: 'CLICHE_VALIDATION_ERROR',
  STORAGE: 'CLICHE_STORAGE_ERROR',
  LLM_SERVICE: 'CLICHE_LLM_ERROR',
  DATA_INTEGRITY: 'CLICHE_DATA_INTEGRITY_ERROR',
  PREREQUISITE: 'CLICHE_PREREQUISITE_ERROR',
};
