/* eslint-disable no-console */

/**
 * @file Basic ILogger implementation that directs output to the browser/Node console.
 * This class replicates the console.* usage found previously in GameDataRepository and other parts
 * of the system, providing a simple, concrete logger implementation with log level support.
 */

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Defines the available log levels and their severity.
 * Lower numbers are more verbose.
 *
 * @enum {number}
 */
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4, // Special level to disable all logging
};

/**
 * Maps string representations of log levels to their numerical LogLevel enum values.
 *
 * @private
 * @type {{[key: string]: number}}
 */
const LOG_LEVEL_MAP = {
  DEBUG: LogLevel.DEBUG,
  INFO: LogLevel.INFO,
  WARN: LogLevel.WARN,
  ERROR: LogLevel.ERROR,
  NONE: LogLevel.NONE,
};

/**
 * Implements the ILogger interface using the standard console object.
 * Provides basic logging levels (info, warn, error, debug) that map directly
 * to the corresponding console methods, filtered by a configured log level.
 *
 * @implements {ILogger}
 */
class ConsoleLogger {
  /**
   * @private
   * @type {number}
   */
  #currentLogLevel = LogLevel.INFO; // Default log level

  /**
   * Creates an instance of ConsoleLogger.
   *
   * @param {string | number} [logLevelInput] - The desired initial log level.
   * Can be a string (e.g., "DEBUG", "INFO", "WARN", "ERROR", "NONE")
   * or a number corresponding to LogLevel enum (0-4).
   * Defaults to LogLevel.INFO if not provided or invalid.
   */
  constructor(logLevelInput = LogLevel.INFO) {
    this.setLogLevel(logLevelInput);
    // Initial log message to confirm logger setup and its level.
    // This message itself will be subject to the just-set log level.
    if (this.#currentLogLevel <= LogLevel.INFO) {
      // Using console.info directly here to ensure this initial message appears
      // regardless of complex interactions during the very first setup moments if needed,
      // but normal operation should use the instance's methods.
      // For robustness in showing this initial setup:
      console.info(
        `[ConsoleLogger] Initialized. Log level set to ${this.getLogLevelName(this.#currentLogLevel)} (${this.#currentLogLevel}).`
      );
    }
  }

  /**
   * Sets the current log level.
   *
   * @param {string | number} logLevelInput - The desired log level (string or number).
   */
  setLogLevel(logLevelInput) {
    let newLevel = LogLevel.INFO; // Default to INFO if input is invalid
    let changed = false;

    if (typeof logLevelInput === 'string') {
      const upperCaseLevel = logLevelInput.toUpperCase();
      if (upperCaseLevel in LOG_LEVEL_MAP) {
        newLevel = LOG_LEVEL_MAP[upperCaseLevel];
        changed = true;
      } else {
        // Use console.warn directly for this specific warning about invalid level string,
        // as the logger's own .warn() would be subject to the *current* (old) level.
        console.warn(
          `[ConsoleLogger] Invalid log level string: '${logLevelInput}'. Using previous or default: ${this.getLogLevelName(this.#currentLogLevel)}.`
        );
        newLevel = this.#currentLogLevel; // Keep current level if new one is invalid
      }
    } else if (
      typeof logLevelInput === 'number' &&
      Object.values(LogLevel).includes(logLevelInput)
    ) {
      newLevel = logLevelInput;
      changed = true;
    } else {
      console.warn(
        `[ConsoleLogger] Invalid log level input type: '${typeof logLevelInput}', value: '${logLevelInput}'. Using previous or default: ${this.getLogLevelName(this.#currentLogLevel)}.`
      );
      newLevel = this.#currentLogLevel; // Keep current level
    }

    if (this.#currentLogLevel !== newLevel && changed) {
      // Log level change message, useful for diagnostics. Use console.info directly to ensure it's seen.
      console.info(
        `[ConsoleLogger] Log level changing from ${this.getLogLevelName(this.#currentLogLevel)} to ${this.getLogLevelName(newLevel)}.`
      );
      this.#currentLogLevel = newLevel;
    } else if (!changed) {
      // Only set if it's a valid assignment, otherwise it keeps the old level.
      // This case means the input was invalid and we're not changing.
    } else {
      // Level is the same as current, no actual change.
    }
  }

  /**
   * Gets the string name of a numerical log level.
   *
   * @private
   * @param {number} levelValue - The numerical value of the log level.
   * @returns {string} The string name of the log level (e.g., "INFO").
   */
  getLogLevelName(levelValue) {
    for (const name in LOG_LEVEL_MAP) {
      if (LOG_LEVEL_MAP[name] === levelValue) {
        return name;
      }
    }
    return 'UNKNOWN';
  }

  /**
   * Logs an informational message to the console if the current log level allows INFO.
   *
   * @param {string} message - The primary message string to log.
   * @param {...any} args - Additional arguments or objects to include in the log output.
   */
  info(message, ...args) {
    if (this.#currentLogLevel <= LogLevel.INFO) {
      console.info(message, ...args);
    }
  }

  /**
   * Logs a warning message to the console if the current log level allows WARN.
   *
   * @param {string} message - The primary warning message string.
   * @param {...any} args - Additional arguments or objects to include in the warning output.
   */
  warn(message, ...args) {
    if (this.#currentLogLevel <= LogLevel.WARN) {
      console.warn(message, ...args);
    }
  }

  /**
   * Logs an error message to the console if the current log level allows ERROR.
   *
   * @param {string} message - The primary error message string.
   * @param {...any} args - Additional arguments or objects, typically including an Error object, to log.
   */
  error(message, ...args) {
    if (this.#currentLogLevel <= LogLevel.ERROR) {
      console.error(message, ...args);
    }
  }

  /**
   * Logs a debug message to the console if the current log level allows DEBUG.
   *
   * @param {string} message - The primary debug message string.
   * @param {...any} args - Additional arguments or objects to include in the debug output.
   */
  debug(message, ...args) {
    if (this.#currentLogLevel <= LogLevel.DEBUG) {
      console.debug(message, ...args);
    }
  }

  /**
   * Starts a collapsed logging group if the current log level allows DEBUG.
   *
   * @param {string} [label] - The label for the group.
   */
  groupCollapsed(label) {
    if (this.#currentLogLevel <= LogLevel.DEBUG) {
      console.groupCollapsed(label);
    }
  }

  /**
   * Ends the current logging group if the current log level allows DEBUG.
   */
  groupEnd() {
    if (this.#currentLogLevel <= LogLevel.DEBUG) {
      console.groupEnd();
    }
  }

  /**
   * Displays tabular data in the console if the current log level allows DEBUG.
   *
   * @param {any} data - The data to display in a table.
   * @param {readonly string[] | undefined} [columns] - An array of strings representing the columns to include.
   */
  table(data, columns) {
    if (this.#currentLogLevel <= LogLevel.DEBUG) {
      console.table(data, columns);
    }
  }
}

// AC: consoleLogger.js exists and exports the ConsoleLogger class.
// Export the class as the default export for this module
export default ConsoleLogger;