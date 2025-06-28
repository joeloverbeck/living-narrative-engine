// src/utils/dependencyUtils.js

import { isNonBlankString } from './textUtils.js';
import { InvalidArgumentError } from '../errors/invalidArgumentError.js';

/**
 * Assert that a dependency value is present (not null or undefined).
 *
 * @description Throws when the value is missing. Optionally logs the error.
 * @param {*} value - Dependency value to check.
 * @param {string} message - Error message for missing dependency.
 * @param {Function} [ErrorType] - Error constructor used when throwing.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger for error output.
 * @returns {void}
 * @throws {Error} When the dependency is missing.
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
 * Assert that an object's property is a function.
 *
 * @description Used for validating dependency methods.
 * @param {object} obj - Object being validated.
 * @param {string} fnName - Name of the property expected to be a function.
 * @param {string} message - Error message used if validation fails.
 * @param {Function} [ErrorType] - Error constructor used when throwing.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger for error output.
 * @returns {void}
 * @throws {Error} When the function is missing or invalid.
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
 * Assert that all specified method names exist on an object and are functions.
 *
 * @description Iterates over provided method names and validates each one.
 * @param {object} obj - Object being validated.
 * @param {string[]} methods - Method names that must exist.
 * @param {string} message - Error message used if validation fails.
 * @param {Function} [ErrorType] - Error constructor used when throwing.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger for error output.
 * @returns {void}
 * @throws {Error} When any method is missing or not a function.
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

/**
 * Assert that an ID is a non-blank string.
 *
 * @param {any} id - The ID to validate.
 * @param {string} context - Context information for error messages.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger instance for error logging.
 * @returns {void}
 * @throws {InvalidArgumentError} If the ID is invalid.
 */
export function assertValidId(id, context, logger) {
  if (!isNonBlankString(id)) {
    const message = `${context}: Invalid ID '${id}'. Expected non-blank string.`;
    logger.error(message, {
      receivedId: id,
      receivedType: typeof id,
      context,
    });
    throw new InvalidArgumentError(message, 'id', id);
  }
}

/**
 * Assert that a string parameter is non-blank.
 *
 * @param {any} str - The string to validate.
 * @param {string} name - The name of the parameter for error messages.
 * @param {string} context - Context information for error messages.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger instance for error logging.
 * @returns {void}
 * @throws {InvalidArgumentError} If the string is blank or not a string.
 */
export function assertNonBlankString(str, name, context, logger) {
  if (!isNonBlankString(str)) {
    const message = `${context}: Invalid ${name} '${str}'. Expected non-blank string.`;
    logger.error(message, {
      receivedValue: str,
      receivedType: typeof str,
      parameterName: name,
      context,
    });
    throw new InvalidArgumentError(message, name, str);
  }
}

/**
 * Validate a dependency instance for presence, function type and required methods.
 *
 * @param {*} dependency - The dependency instance to validate.
 * @param {string} dependencyName - Name of the dependency for error messages.
 * @param {import('../interfaces/coreServices.js').ILogger|Console} [logger] - Logger instance.
 * @param {{requiredMethods?: string[], isFunction?: boolean}} [options] - Validation options.
 * @returns {void}
 * @throws {Error} If the dependency fails validation.
 */
export function validateDependency(
  dependency,
  dependencyName,
  logger = console,
  { requiredMethods = [], isFunction = false } = {}
) {
  const effectiveLogger =
    logger && typeof logger.error === 'function' ? logger : console;

  if (dependency === null || dependency === undefined) {
    const errorMsg = `Missing required dependency: ${dependencyName}.`;
    effectiveLogger.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (isFunction && typeof dependency !== 'function') {
    const errorMsg = `Dependency '${dependencyName}' must be a function, but got ${typeof dependency}.`;
    effectiveLogger.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (requiredMethods && requiredMethods.length > 0) {
    for (const method of requiredMethods) {
      const actualMethod = dependency[method];
      if (typeof actualMethod !== 'function') {
        const errorMsg = `Invalid or missing method '${method}' on dependency '${dependencyName}'.`;
        effectiveLogger.error(errorMsg);
        throw new Error(errorMsg);
      }
    }
  }
}

/**
 * Validate a list of dependencies using {@link validateDependency}.
 *
 * @param {Iterable<{dependency: *, name: string, methods?: string[], isFunction?: boolean}>} deps - Iterable of dependency specs.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger used for validation errors.
 * @returns {void}
 */
export function validateDependencies(deps, logger) {
  if (!deps) return;

  for (const { dependency, name, methods = [], isFunction = false } of deps) {
    validateDependency(dependency, name, logger, {
      requiredMethods: methods,
      isFunction,
    });
  }
}
