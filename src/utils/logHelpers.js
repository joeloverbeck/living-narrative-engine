// src/utils/logHelpers.js
/**
 * @file Helper functions for standardized logging prefixes.
 */

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Logs a start message using the debug level.
 *
 * @description Prepends a play emoji to the provided context string and logs
 * it at the debug level.
 * @param {ILogger} logger - Logger instance used to emit the message.
 * @param {string} context - Descriptive context for the log message.
 * @returns {void}
 */
export const logStart = (logger, context) => logger.debug(`▶️  ${context}`);

/**
 * Logs an end/completion message using the debug level.
 *
 * @description Prepends a check mark emoji to the provided context string and
 * logs it at the debug level.
 * @param {ILogger} logger - Logger instance used to emit the message.
 * @param {string} context - Descriptive context for the log message.
 * @returns {void}
 */
export const logEnd = (logger, context) => logger.debug(`✅ ${context}`);

/**
 * Logs an error message using the error level.
 *
 * @description Prepends a cross mark emoji to the provided context and appends
 * the error's message. The full error object is also passed to the logger for
 * stack traces.
 * @param {ILogger} logger - Logger instance used to emit the message.
 * @param {string} context - Descriptive context for the log message.
 * @param {Error} err - The error to log alongside the message.
 * @returns {void}
 */
export const logError = (logger, context, err) =>
  logger.error(`❌ ${context}: ${err.message}`, err);
