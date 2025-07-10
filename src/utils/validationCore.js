/**
 * @file Core validation utilities providing a unified API for common validation patterns.
 * Consolidates various validation functions to reduce duplication and provide consistency.
 */

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

import { isNonBlankString } from './textUtils.js';
import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
import { ensureValidLogger } from './loggerUtils.js';

/**
 * String validation utilities
 */
export const string = {
  /**
   * Checks if a value is a non-blank string.
   * 
   * @param {*} str - The value to check.
   * @returns {boolean} True if the value is a string and non-empty after trimming.
   */
  isNonBlank(str) {
    return isNonBlankString(str);
  },

  /**
   * Asserts that a value is a non-blank string, throwing an error if not.
   * 
   * @param {*} str - The value to check.
   * @param {string} name - The name of the parameter (for error messages).
   * @param {string} [context] - Additional context for error messages.
   * @param {ILogger} [logger] - Optional logger instance.
   * @throws {InvalidArgumentError} If the value is not a non-blank string.
   * @returns {void}
   */
  assertNonBlank(str, name, context, logger) {
    const log = ensureValidLogger(logger, 'string.assertNonBlank');
    if (!isNonBlankString(str)) {
      const contextStr = context ? ` in ${context}` : '';
      const message = `Parameter '${name}' must be a non-blank string${contextStr}. Received: ${typeof str === 'string' ? `"${str}"` : typeof str}`;
      log.error(message);
      throw new InvalidArgumentError(message);
    }
  },

  /**
   * Validates and returns a trimmed string if valid, null otherwise.
   * Useful for optional string parameters.
   * 
   * @param {*} value - The value to validate.
   * @param {string} [name] - Optional parameter name for logging.
   * @returns {string|null} Trimmed string if valid, null otherwise.
   */
  validateAndTrim(value, name) {
    if (!isNonBlankString(value)) {
      return null;
    }
    return value.trim();
  },

  /**
   * Validates a string parameter for use in handlers and operations.
   * Returns trimmed string or null, with optional logging.
   * 
   * @param {*} value - The value to validate.
   * @param {string} paramName - The parameter name.
   * @param {ILogger} [logger] - Optional logger for validation messages.
   * @returns {string|null} Trimmed string if valid, null otherwise.
   */
  validateParam(value, paramName, logger) {
    const log = ensureValidLogger(logger, 'string.validateParam');
    
    if (!isNonBlankString(value)) {
      log.debug(`Parameter '${paramName}' is not a valid non-blank string`);
      return null;
    }
    
    const trimmed = value.trim();
    log.debug(`Validated parameter '${paramName}': "${trimmed}"`);
    return trimmed;
  }
};

/**
 * Type validation utilities
 */
export const type = {
  /**
   * Asserts that a value is a Map instance.
   * 
   * @param {*} value - The value to check.
   * @param {string} name - The name of the parameter.
   * @throws {InvalidArgumentError} If the value is not a Map.
   * @returns {void}
   */
  assertIsMap(value, name) {
    if (!(value instanceof Map)) {
      throw new InvalidArgumentError(
        `Parameter '${name}' must be a Map instance. Received: ${typeof value}`
      );
    }
  },

  /**
   * Checks if an object has all required methods.
   * 
   * @param {*} obj - The object to check.
   * @param {string[]} methods - Array of method names to check for.
   * @param {string} name - The name of the parameter.
   * @throws {InvalidArgumentError} If any method is missing.
   * @returns {void}
   */
  assertHasMethods(obj, methods, name) {
    if (!obj || typeof obj !== 'object') {
      throw new InvalidArgumentError(
        `Parameter '${name}' must be an object. Received: ${typeof obj}`
      );
    }

    const missingMethods = methods.filter(method => typeof obj[method] !== 'function');
    
    if (missingMethods.length > 0) {
      throw new InvalidArgumentError(
        `Parameter '${name}' is missing required methods: ${missingMethods.join(', ')}`
      );
    }
  }
};

/**
 * Logger validation utilities
 */
export const logger = {
  /**
   * Checks if a value is a valid logger instance.
   * 
   * @param {*} logger - The value to check.
   * @returns {boolean} True if the value has all required logger methods.
   */
  isValid(logger) {
    return Boolean(logger &&
      typeof logger === 'object' &&
      typeof logger.debug === 'function' &&
      typeof logger.info === 'function' &&
      typeof logger.warn === 'function' &&
      typeof logger.error === 'function');
  },

  /**
   * Ensures a valid logger is available, using a fallback if needed.
   * 
   * @param {*} logger - The logger to validate.
   * @param {*} fallback - Fallback logger to use if primary is invalid.
   * @returns {ILogger} A valid logger instance.
   */
  ensure(logger, fallback) {
    return ensureValidLogger(logger, fallback);
  },

  /**
   * Asserts that a value is a valid logger instance.
   * 
   * @param {*} logger - The value to check.
   * @param {string} [name] - The parameter name.
   * @throws {InvalidArgumentError} If the value is not a valid logger.
   * @returns {void}
   */
  assertValid(logger, name = 'logger') {
    if (!this.isValid(logger)) {
      throw new InvalidArgumentError(
        `Parameter '${name}' must be a valid logger with debug, info, warn, and error methods`
      );
    }
  }
};