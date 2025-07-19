/**
 * @file Interface for LLM error mapping and handling
 * @see src/llms/interfaces/ILLMErrorMapper.js
 */

/**
 * @typedef {object} ErrorContext
 * @property {string} [llmId] - The LLM configuration ID
 * @property {number} [status] - HTTP status code if applicable
 * @property {*} [responseBody] - The response body if available
 * @property {string} [operation] - The operation that failed
 * @property {Error} [originalError] - The original error object
 */

/**
 * @typedef {'api_key'|'insufficient_credits'|'content_policy'|'permission'|'bad_request'|'malformed_response'|'configuration'|'generic'} DomainErrorType
 */

/**
 * @interface ILLMErrorMapper
 * @description Maps errors from various sources to domain-specific errors
 */
export class ILLMErrorMapper {
  /**
   * Maps an HTTP error to a domain-specific error
   *
   * @param {Error} error - The error to map
   * @param {ErrorContext} [context] - Additional context for error mapping
   * @returns {Error} The mapped domain error
   */
  mapHttpError(error, context) {
    throw new Error('Not implemented');
  }

  /**
   * Creates a domain-specific error
   *
   * @param {DomainErrorType} type - The type of domain error
   * @param {string} message - The error message
   * @param {ErrorContext} [context] - Additional error context
   * @returns {Error} The created domain error
   */
  createDomainError(type, message, context) {
    throw new Error('Not implemented');
  }

  /**
   * Logs an error with appropriate context
   *
   * @param {Error} error - The error to log
   * @param {ErrorContext} context - The error context
   * @returns {void}
   */
  logError(error, context) {
    throw new Error('Not implemented');
  }

  /**
   * Determines the domain error type from an HTTP status code
   *
   * @param {number} status - The HTTP status code
   * @param {*} [responseBody] - The response body for additional context
   * @returns {DomainErrorType} The determined error type
   */
  getErrorTypeFromStatus(status, responseBody) {
    throw new Error('Not implemented');
  }

  /**
   * Checks if an error is a configuration error
   *
   * @param {Error} error - The error to check
   * @returns {boolean} True if it's a configuration error
   */
  isConfigurationError(error) {
    throw new Error('Not implemented');
  }

  /**
   * Extracts structured error details for logging
   *
   * @param {Error} error - The error to extract details from
   * @param {ErrorContext} [context] - Additional context
   * @returns {object} Structured error details for logging
   */
  extractErrorDetails(error, context) {
    throw new Error('Not implemented');
  }
}

export default ILLMErrorMapper;
