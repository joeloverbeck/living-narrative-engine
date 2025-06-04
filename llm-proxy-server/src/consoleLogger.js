// llm-proxy-server/src/consoleLogger.js

/**
 * @file Basic ILogger implementation that directs output to the browser/Node console.
 * This class replicates the console.* usage found previously in GameDataRepository and other parts
 * of the system, providing a simple, concrete logger implementation.
 */

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Implements the ILogger interface using the standard console object.
 * Provides basic logging levels (info, warn, error, debug) that map directly
 * to the corresponding console methods.
 * @implements {ILogger}
 */
export class ConsoleLogger {
  /**
   * Logs an informational message to the console.
   * Uses console.info if available, otherwise console.log acts similarly in most environments.
   * @param {string} message - The primary message string to log.
   * @param {...any} args - Additional arguments or objects to include in the log output.
   */
  info(message, ...args) {
    // AC: info method logs messages using console.info (or console.log).
    // Using console.info for semantic correctness, though console.log is functionally similar.
    console.info(message, ...args);
  }

  /**
   * Logs a warning message to the console.
   * Uses console.warn.
   * @param {string} message - The primary warning message string.
   * @param {...any} args - Additional arguments or objects to include in the warning output.
   */
  warn(message, ...args) {
    // AC: warn method logs messages using console.warn.
    console.warn(message, ...args);
  }

  /**
   * Logs an error message to the console.
   * Uses console.error. This often includes stack traces in developer consoles.
   * @param {string} message - The primary error message string.
   * @param {...any} args - Additional arguments or objects, typically including an Error object, to log.
   */
  error(message, ...args) {
    // AC: error method logs messages using console.error.
    console.error(message, ...args);
  }

  /**
   * Logs a debug message to the console.
   * Uses console.debug. Note that browser developer tools often filter these messages
   * by default; ensure the 'Verbose' or 'Debug' level is enabled to see them.
   * The ticket allows for future conditional logging based on flags or environment,
   * but the initial implementation logs directly.
   * @param {string} message - The primary debug message string.
   * @param {...any} args - Additional arguments or objects to include in the debug output.
   */
  debug(message, ...args) {
    // AC: debug method logs messages using console.debug.
    // Per ticket preference, use console.debug.
    console.debug(message, ...args);
    // Alternative if console.debug isn't suitable or needs fallback:
    // console.log(`[DEBUG] ${message}`, ...args);
  }
}
