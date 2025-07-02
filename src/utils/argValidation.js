// src/utils/argValidation.js

/**
 * @file Assertion helpers for validating common argument types.
 */

/**
 * Assert that a value is a Map instance.
 *
 * @param {*} value - Value to check.
 * @param {string} name - Name used in the error message.
 * @param {string} [message] - Optional custom error message.
 * @returns {void}
 * @throws {Error} If `value` is not a Map.
 */
export function assertIsMap(value, name, message) {
  if (!(value instanceof Map)) {
    throw new Error(message || `${name} must be a Map.`);
  }
}

/**
 * Assert that a logger implements the ILogger interface.
 *
 * @param {*} logger - Logger to validate.
 * @param {string} name - Name used in the error message.
 * @param {string} [message] - Optional custom error message.
 * @returns {void}
 * @throws {Error} If `logger` does not implement ILogger methods.
 */
export function assertIsLogger(logger, name, message) {
  const valid =
    logger &&
    typeof logger.info === 'function' &&
    typeof logger.warn === 'function' &&
    typeof logger.error === 'function' &&
    typeof logger.debug === 'function';

  if (!valid) {
    throw new Error(message || `${name} must be a valid ILogger instance.`);
  }
}

export default {
  assertIsMap,
  assertIsLogger,
};
