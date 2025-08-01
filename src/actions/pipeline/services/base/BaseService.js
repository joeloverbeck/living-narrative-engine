/**
 * @file BaseService - Base class for all pipeline services
 * @see ServiceError.js
 */

import {
  validateDependency,
  assertNonBlankString,
  assertPresent,
} from '../../../../utils/dependencyUtils.js';
import { ServiceError, ServiceErrorCodes } from './ServiceError.js';

/** @typedef {import('../../../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Base class providing common functionality for pipeline services
 *
 * This class provides:
 * - Dependency validation
 * - Logger integration
 * - Common parameter validation
 * - Operation logging helpers
 * - Error handling patterns
 */
export class BaseService {
  #logger;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', null, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    this.#logger = logger;
  }

  /**
   * Get logger instance
   *
   * @protected
   * @returns {ILogger}
   */
  get logger() {
    return this.#logger;
  }

  /**
   * Validate required parameters
   *
   * @protected
   * @param {object} params - Parameters to validate
   * @param {string[]} required - Required parameter names
   * @throws {ServiceError} If validation fails
   */
  validateParams(params, required) {
    if (!params || typeof params !== 'object') {
      throw new ServiceError(
        'Parameters must be an object',
        ServiceErrorCodes.VALIDATION_ERROR,
        params
      );
    }

    const missing = required.filter(
      (key) => params[key] === undefined || params[key] === null
    );

    if (missing.length > 0) {
      throw new ServiceError(
        `Missing required parameters: ${missing.join(', ')}`,
        ServiceErrorCodes.MISSING_PARAMETER,
        { missing, provided: Object.keys(params) }
      );
    }
  }

  /**
   * Validate a non-blank string parameter
   *
   * @protected
   * @param {*} value - Value to validate
   * @param {string} paramName - Parameter name for error messages
   * @throws {ServiceError} If validation fails
   */
  validateNonBlankString(value, paramName) {
    try {
      assertNonBlankString(value, `${paramName} must be a non-blank string`);
    } catch (error) {
      throw new ServiceError(
        error.message,
        ServiceErrorCodes.VALIDATION_ERROR,
        value
      );
    }
  }

  /**
   * Validate that a value is present (not null or undefined)
   *
   * @protected
   * @param {*} value - Value to validate
   * @param {string} paramName - Parameter name for error messages
   * @throws {ServiceError} If validation fails
   */
  validatePresent(value, paramName) {
    try {
      assertPresent(value, `${paramName} is required`);
    } catch (error) {
      throw new ServiceError(
        error.message,
        ServiceErrorCodes.MISSING_PARAMETER,
        value
      );
    }
  }

  /**
   * Log service operation with consistent format
   *
   * @protected
   * @param {string} operation - Operation name
   * @param {object} context - Operation context
   * @param {string} [level] - Log level
   */
  logOperation(operation, context, level = 'debug') {
    const logContext = {
      service: this.constructor.name,
      operation,
      ...context,
    };
    this.#logger[level](`${this.constructor.name}: ${operation}`, logContext);
  }

  /**
   * Log and throw a service error
   *
   * @protected
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {object} [context] - Additional error context
   * @throws {ServiceError} Always throws
   */
  throwError(message, code, context = {}) {
    const fullMessage = `${this.constructor.name}: ${message}`;
    this.#logger.error(fullMessage, { code, ...context });
    throw new ServiceError(fullMessage, code, context);
  }

  /**
   * Wrap an operation with error handling and logging
   *
   * @protected
   * @param {string} operationName - Name of the operation
   * @param {Function} operation - Operation to execute
   * @param {object} [context] - Additional context for logging
   * @returns {Promise<*>} Operation result
   * @throws {ServiceError} If operation fails
   */
  async executeOperation(operationName, operation, context = {}) {
    this.logOperation(operationName, { ...context, status: 'started' });

    try {
      const result = await operation();
      this.logOperation(operationName, { ...context, status: 'completed' });
      return result;
    } catch (error) {
      this.logOperation(
        operationName,
        {
          ...context,
          status: 'failed',
          error: error.message,
        },
        'error'
      );

      // Re-throw ServiceErrors as-is
      if (error instanceof ServiceError) {
        throw error;
      }

      // Wrap other errors
      throw new ServiceError(
        `Operation '${operationName}' failed: ${error.message}`,
        ServiceErrorCodes.OPERATION_FAILED,
        { originalError: error, context }
      );
    }
  }

  /**
   * Check if service is properly initialized
   *
   * @protected
   * @returns {boolean} True if initialized
   */
  isInitialized() {
    return this.#logger !== null && this.#logger !== undefined;
  }
}
