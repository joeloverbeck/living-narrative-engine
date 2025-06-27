// src/utils/dependencyValidators.js
/**
 * Small assertion helpers for validating dependencies.
 *
 * @module dependencyValidators
 */

/**
 * Asserts that an object is present (not null or undefined).
 *
 * @param {*} value - Dependency value to check.
 * @param {string} message - Error message for missing dependency.
 * @param {Function} [ErrorType] - Error constructor to use when throwing.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger for error output.
 * @throws {Error} When the dependency is missing.
 * @returns {void}
 */
export function assertPresent(value, message, ErrorType = Error, logger) {
  if (value === undefined || value === null) {
    if (logger && typeof logger.error === 'function') {
      logger.error(message);
    }
    throw new ErrorType(message);
  }
}

/**
 * Asserts that an object's property is a function.
 *
 * @param {object} obj - The object being validated.
 * @param {string} fnName - Name of the property expected to be a function.
 * @param {string} message - Error message used if validation fails.
 * @param {Function} [ErrorType] - Error constructor used when throwing.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger for error output.
 * @throws {Error} When the function is missing or invalid.
 * @returns {void}
 */
export function assertFunction(
  obj,
  fnName,
  message,
  ErrorType = Error,
  logger
) {
  if (!obj || typeof obj[fnName] !== 'function') {
    if (logger && typeof logger.error === 'function') {
      logger.error(message);
    }
    throw new ErrorType(message);
  }
}

/**
 * Asserts that all specified method names exist on an object and are functions.
 *
 * @param {object} obj - The object being validated.
 * @param {string[]} methods - Method names that must exist.
 * @param {string} message - Error message used if validation fails.
 * @param {Function} [ErrorType] - Error constructor used when throwing.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger for error output.
 * @throws {Error} When any method is missing or not a function.
 * @returns {void}
 */
export function assertMethods(
  obj,
  methods,
  message,
  ErrorType = Error,
  logger
) {
  for (const m of methods) {
    assertFunction(obj, m, message, ErrorType, logger);
  }
}

// --- FILE END ---
