// llm-proxy-server/src/interfaces/coreServices.js
/**
 * @interface ILogger
 * @description Defines an interface for logging operations across the application.
 */

/**
 * Logs an informational message.
 * @function
 * @name ILogger#info
 * @param {string} message - The message to log.
 * @param {object} [context] - Optional context object with additional information.
 * @returns {void}
 */

/**
 * Logs a warning message.
 * @function
 * @name ILogger#warn
 * @param {string} message - The message to log.
 * @param {object} [context] - Optional context object with additional information.
 * @returns {void}
 */

/**
 * Logs an error message.
 * @function
 * @name ILogger#error
 * @param {string} message - The message to log.
 * @param {object} [context] - Optional context object with additional information.
 * @returns {void}
 */

/**
 * Logs a debug message.
 * @function
 * @name ILogger#debug
 * @param {string} message - The message to log.
 * @param {object} [context] - Optional context object with additional information.
 * @returns {void}
 */

export {}; // Ensures it's treated as an ES module for tooling compatibility
