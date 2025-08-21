/**
 * @file No-operation logger implementation that silently ignores all logging calls.
 * Used when logging is disabled or in 'none' mode.
 */

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Implements the ILogger interface with no-op methods.
 * All logging methods are silently ignored without any output.
 * Useful for disabling logging or in performance-critical scenarios.
 *
 * @implements {ILogger}
 */
class NoOpLogger {
  /**
   * No-op info logging.
   *
   * @param {string} message - The message string (ignored).
   * @param {...any} args - Additional arguments (ignored).
   * @returns {void}
   */
  info(message, ...args) {
    // Intentionally empty - no operation
  }

  /**
   * No-op warning logging.
   *
   * @param {string} message - The message string (ignored).
   * @param {...any} args - Additional arguments (ignored).
   * @returns {void}
   */
  warn(message, ...args) {
    // Intentionally empty - no operation
  }

  /**
   * No-op error logging.
   *
   * @param {string} message - The message string (ignored).
   * @param {...any} args - Additional arguments (ignored).
   * @returns {void}
   */
  error(message, ...args) {
    // Intentionally empty - no operation
  }

  /**
   * No-op debug logging.
   *
   * @param {string} message - The message string (ignored).
   * @param {...any} args - Additional arguments (ignored).
   * @returns {void}
   */
  debug(message, ...args) {
    // Intentionally empty - no operation
  }

  /**
   * No-op group collapsed logging.
   *
   * @param {string} [label] - The label for the group (ignored).
   * @returns {void}
   */
  groupCollapsed(label) {
    // Intentionally empty - no operation
  }

  /**
   * No-op group end logging.
   *
   * @returns {void}
   */
  groupEnd() {
    // Intentionally empty - no operation
  }

  /**
   * No-op table logging.
   *
   * @param {any} data - The data to display (ignored).
   * @param {string[] | undefined} [columns] - The columns to include (ignored).
   * @returns {void}
   */
  table(data, columns) {
    // Intentionally empty - no operation
  }

  /**
   * No-op log level setting.
   * Accepts the value but does nothing with it.
   *
   * @param {string | number} logLevelInput - The desired log level (ignored).
   * @returns {void}
   */
  setLogLevel(logLevelInput) {
    // Intentionally empty - no operation
  }
}

export default NoOpLogger;
