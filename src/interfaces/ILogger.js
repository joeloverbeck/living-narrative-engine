// src/interfaces/ILogger.js
// --- NEW FILE START ---
/**
 * @interface ILogger
 * @description Defines a basic logger interface.
 * This interface specifies the contract for logger objects used throughout the application.
 */
export class ILogger {
  /**
   * Logs an informational message.
   *
   * @param {string} message - The message string.
   * @param {...any} args - Additional arguments to log with the message.
   * @returns {void}
   */
  info(message, ...args) {
    throw new Error('ILogger.info method not implemented.');
  }

  /**
   * Logs a warning message.
   *
   * @param {string} message - The message string.
   * @param {...any} args - Additional arguments to log with the message.
   * @returns {void}
   */
  warn(message, ...args) {
    throw new Error('ILogger.warn method not implemented.');
  }

  /**
   * Logs an error message.
   *
   * @param {string} message - The message string.
   * @param {...any} args - Additional arguments to log with the message.
   * @returns {void}
   */
  error(message, ...args) {
    throw new Error('ILogger.error method not implemented.');
  }

  /**
   * Logs a debug message.
   *
   * @param {string} message - The message string.
   * @param {...any} args - Additional arguments to log with the message.
   * @returns {void}
   */
  debug(message, ...args) {
    throw new Error('ILogger.debug method not implemented.');
  }
}

// --- NEW FILE END ---
