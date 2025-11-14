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
   * @description Determines if a value represents a debug-tagged log message.
   * @param {unknown} message - Candidate log message value.
   * @returns {boolean} True when the message begins with the `[DEBUG]` tag.
   */
  #isDebugTaggedMessage(message) {
    if (typeof message !== 'string') {
      return false;
    }

    const trimmedMessage = message.trimStart();

    if (trimmedMessage.startsWith('[DEBUG]')) {
      return true;
    }

    return /^[^[]*?:\s*\[DEBUG\]/.test(trimmedMessage);
  }

  /**
   * @description Removes the leading `[DEBUG]` tag from a message when present.
   * @param {unknown} message - Original log message value.
   * @returns {unknown} Message with the `[DEBUG]` prefix stripped when possible.
   */
  #stripDebugTag(message) {
    const trimmedStart = message.trimStart();
    if (trimmedStart.startsWith('[DEBUG]')) {
      const withoutTag = trimmedStart.slice('[DEBUG]'.length);
      return withoutTag.trimStart();
    }

    // #isDebugTaggedMessage ensures that any message reaching this point includes a
    // prefix followed by a "[DEBUG]" marker, so the regex match is guaranteed.
    /** @type {RegExpMatchArray} */
    const taggedPrefixMatch = trimmedStart.match(/^([^[]*?:\s*)\[DEBUG\]\s*/);
    const [, prefix] = taggedPrefixMatch;
    const remainder = trimmedStart.slice(taggedPrefixMatch[0].length);
    return `${prefix}${remainder}`;
  }

  /**
   * @description Routes debug-tagged messages through the debug channel.
   * @param {unknown} message - Primary log message value.
   * @param {any[]} args - Additional console arguments supplied by the caller.
   * @returns {boolean} True when the message was handled as a debug log.
   */
  #handleDebugTaggedMessage(message, args) {
    if (!this.#isDebugTaggedMessage(message)) {
      return false;
    }

    if (this.#currentLogLevel <= LogLevel.DEBUG) {
      const normalizedMessage = this.#stripDebugTag(message);
      console.debug(normalizedMessage, ...args);
    }

    return true;
  }

  /**
   * @private
   * @type {number}
   */
  #currentLogLevel = LogLevel.INFO; // Default log level

  /**
   * @private
   * @type {Set<string>}
   */
  #enabledDebugNamespaces = new Set(); // Enabled debug namespaces

  /**
   * @private
   * @type {boolean}
   */
  #globalDebugEnabled = false; // If true, all debug logs are enabled

  /**
   * Creates an instance of ConsoleLogger.
   *
   * @param {string | number} [logLevelInput] - The desired initial log level.
   * Can be a string (e.g., "DEBUG", "INFO", "WARN", "ERROR", "NONE")
   * or a number corresponding to LogLevel enum (0-4).
   * Defaults to LogLevel.INFO if not provided or invalid.
   * @param {object} [options] - Additional options
   * @param {Set<string>} [options.enabledNamespaces] - Set of enabled debug namespaces
   * @param {boolean} [options.globalDebug] - Enable all debug logs
   */
  constructor(logLevelInput = LogLevel.INFO, options = {}) {
    this.setLogLevel(logLevelInput);
    if (options.enabledNamespaces instanceof Set) {
      this.#enabledDebugNamespaces = options.enabledNamespaces;
    }
    if (typeof options.globalDebug === 'boolean') {
      this.#globalDebugEnabled = options.globalDebug;
    }
    // Initial log message to confirm logger setup and its level.
    // This message itself will be subject to the just-set log level.
    this.debug(
      `[ConsoleLogger] Initialized. Log level set to ${this.getLogLevelName(this.#currentLogLevel)} (${this.#currentLogLevel}).`
    );
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
      const normalizedInput = logLevelInput.trim();
      const upperCaseLevel = normalizedInput.toUpperCase();
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
    if (this.#handleDebugTaggedMessage(message, args)) {
      return;
    }

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
    if (this.#handleDebugTaggedMessage(message, args)) {
      return;
    }

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
    if (this.#handleDebugTaggedMessage(message, args)) {
      return;
    }

    if (this.#currentLogLevel <= LogLevel.ERROR) {
      console.error(message, ...args);
    }
  }

  /**
   * Logs a debug message to the console if the current log level allows DEBUG.
   *
   * IMPORTANT: Debug logs must be activated individually using namespaces to prevent
   * console overload (~25,000 logs on startup can hang the browser).
   *
   * Usage:
   *   logger.debug('message')  // Only logs if log level is DEBUG
   *   logger.debug('message', 'namespace')  // Requires namespace to be enabled
   *   logger.debug('message', 'namespace', data)  // With additional data
   *
   * Enable namespaces via:
   *   /debug:enable category:namespace
   *   DEBUG_NAMESPACES=engine:init,ai:memory environment variable
   *
   * @param {string} message - The primary debug message string.
   * @param {string} [namespace] - Optional namespace for selective activation
   * @param {...any} args - Additional arguments or objects to include in the debug output.
   */
  debug(message, namespace, ...args) {
    // Early return if debug level not enabled
    if (this.#currentLogLevel > LogLevel.DEBUG) {
      return;
    }

    // If no namespace provided, use traditional behavior (log if DEBUG level)
    if (typeof namespace !== 'string') {
      // namespace is actually part of args in this case
      const allArgs = namespace !== undefined ? [namespace, ...args] : args;
      console.debug(message, ...allArgs);
      return;
    }

    // Namespace provided - check if it's enabled
    if (this.#globalDebugEnabled || this.#enabledDebugNamespaces.has(namespace)) {
      console.debug(message, ...args);
    }
  }

  /**
   * Enables a debug namespace for selective logging.
   *
   * @param {string} namespace - The namespace to enable (e.g., "engine:init")
   */
  enableDebugNamespace(namespace) {
    if (typeof namespace === 'string' && namespace.trim()) {
      this.#enabledDebugNamespaces.add(namespace.trim());
    }
  }

  /**
   * Disables a debug namespace.
   *
   * @param {string} namespace - The namespace to disable
   */
  disableDebugNamespace(namespace) {
    if (typeof namespace === 'string') {
      this.#enabledDebugNamespaces.delete(namespace.trim());
    }
  }

  /**
   * Clears all enabled debug namespaces.
   */
  clearDebugNamespaces() {
    this.#enabledDebugNamespaces.clear();
  }

  /**
   * Gets the list of enabled debug namespaces.
   *
   * @returns {string[]} Array of enabled namespaces
   */
  getEnabledNamespaces() {
    return Array.from(this.#enabledDebugNamespaces);
  }

  /**
   * Sets the global debug mode.
   *
   * @param {boolean} enabled - Whether to enable all debug logs
   */
  setGlobalDebug(enabled) {
    this.#globalDebugEnabled = !!enabled;
  }

  /**
   * Gets the global debug mode status.
   *
   * @returns {boolean} Whether global debug is enabled
   */
  isGlobalDebugEnabled() {
    return this.#globalDebugEnabled;
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
   * @param {string[] | undefined} [columns] - An array of strings representing the columns to include.
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
