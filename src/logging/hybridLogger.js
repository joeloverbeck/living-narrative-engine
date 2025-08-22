/**
 * @file HybridLogger that sends logs to both console and remote simultaneously
 * @see consoleLogger.js, remoteLogger.js, logCategoryDetector.js
 */

import { validateDependency } from '../utils/dependencyUtils.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {object} FilterConfig
 * @property {string[]|null} categories - Array of categories to include, null for all
 * @property {string[]|null} levels - Array of levels to include, null for all
 * @property {boolean} enabled - Whether this destination is enabled
 */

/**
 * @typedef {object} HybridLoggerFilters
 * @property {FilterConfig} console - Console logging filter configuration
 * @property {FilterConfig} remote - Remote logging filter configuration
 */

/**
 * HybridLogger that sends logs to both console and remote server simultaneously.
 * Supports independent filtering for each destination, ideal for development mode
 * where you want immediate console feedback with comprehensive remote logging.
 *
 * @implements {ILogger}
 */
class HybridLogger {
  /**
   * @private
   * @type {ILogger}
   */
  #consoleLogger;

  /**
   * @private
   * @type {ILogger}
   */
  #remoteLogger;

  /**
   * @private
   * @type {*}
   */
  #categoryDetector;

  /**
   * @private
   * @type {HybridLoggerFilters}
   */
  #filters;

  /**
   * Creates a HybridLogger instance.
   *
   * @param {object} dependencies - Required dependencies
   * @param {ILogger} dependencies.consoleLogger - Console logger instance
   * @param {ILogger} dependencies.remoteLogger - Remote logger instance
   * @param {*} dependencies.categoryDetector - LogCategoryDetector instance
   * @param {HybridLoggerFilters} [config] - Filter configuration
   */
  constructor({ consoleLogger, remoteLogger, categoryDetector }, config = {}) {
    // Validate required dependencies
    validateDependency(consoleLogger, 'ILogger', undefined, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(remoteLogger, 'ILogger', undefined, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(categoryDetector, 'LogCategoryDetector', undefined, {
      requiredMethods: ['detectCategory'],
    });

    this.#consoleLogger = consoleLogger;
    this.#remoteLogger = remoteLogger;
    this.#categoryDetector = categoryDetector;

    // Set up default filter configuration
    this.#filters = {
      console: {
        categories: ['errors', 'warnings', 'ai'], // Reduce console noise by default
        levels: ['warn', 'error'],
        enabled: true,
      },
      remote: {
        categories: null, // All categories
        levels: null, // All levels
        enabled: true,
      },
      ...config,
    };

    // Log initialization to console only if console is enabled (to avoid recursive logging)
    if (
      this.#filters.console.enabled &&
      typeof this.#consoleLogger.info === 'function'
    ) {
      this.#consoleLogger.info(
        '[HybridLogger] Initialized with console and remote logging'
      );
    }
  }

  /**
   * Logs an informational message to both console and remote (if filters allow).
   *
   * @param {string} message - The primary message string to log
   * @param {...any} args - Additional arguments or objects to include in the log output
   */
  info(message, ...args) {
    this.#logToDestinations('info', message, args);
  }

  /**
   * Logs a warning message to both console and remote (if filters allow).
   *
   * @param {string} message - The primary warning message string
   * @param {...any} args - Additional arguments or objects to include in the warning output
   */
  warn(message, ...args) {
    this.#logToDestinations('warn', message, args);
  }

  /**
   * Logs an error message to both console and remote (if filters allow).
   *
   * @param {string} message - The primary error message string
   * @param {...any} args - Additional arguments or objects to include in the error output
   */
  error(message, ...args) {
    this.#logToDestinations('error', message, args);
  }

  /**
   * Logs a debug message to both console and remote (if filters allow).
   *
   * @param {string} message - The primary debug message string
   * @param {...any} args - Additional arguments or objects to include in the debug output
   */
  debug(message, ...args) {
    this.#logToDestinations('debug', message, args);
  }

  /**
   * Starts a collapsed logging group (console only).
   *
   * @param {string} [label] - The label for the group
   */
  groupCollapsed(label) {
    if (
      this.#filters.console.enabled &&
      typeof this.#consoleLogger.groupCollapsed === 'function'
    ) {
      this.#consoleLogger.groupCollapsed(label);
    }
  }

  /**
   * Ends the current logging group (console only).
   */
  groupEnd() {
    if (
      this.#filters.console.enabled &&
      typeof this.#consoleLogger.groupEnd === 'function'
    ) {
      this.#consoleLogger.groupEnd();
    }
  }

  /**
   * Displays tabular data (console only).
   *
   * @param {any} data - The data to display in a table
   * @param {string[] | undefined} [columns] - An array of strings representing the columns to include
   */
  table(data, columns) {
    if (
      this.#filters.console.enabled &&
      typeof this.#consoleLogger.table === 'function'
    ) {
      this.#consoleLogger.table(data, columns);
    }
  }

  /**
   * Sets the log level (delegates to console logger for compatibility).
   *
   * @param {string | number} logLevelInput - The desired log level
   */
  setLogLevel(logLevelInput) {
    if (typeof this.#consoleLogger.setLogLevel === 'function') {
      this.#consoleLogger.setLogLevel(logLevelInput);
    }
  }

  /**
   * Sets the filter configuration for console logging.
   *
   * @param {string[]|null} categories - Array of categories to include, null for all
   * @param {string[]|null} levels - Array of levels to include, null for all
   */
  setConsoleFilter(categories, levels) {
    this.#filters.console.categories = categories;
    this.#filters.console.levels = levels;
  }

  /**
   * Sets the filter configuration for remote logging.
   *
   * @param {string[]|null} categories - Array of categories to include, null for all
   * @param {string[]|null} levels - Array of levels to include, null for all
   */
  setRemoteFilter(categories, levels) {
    this.#filters.remote.categories = categories;
    this.#filters.remote.levels = levels;
  }

  /**
   * Logs to both console and remote destinations based on filter configuration.
   *
   * @private
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {any[]} args - Additional log arguments
   */
  #logToDestinations(level, message, args) {
    try {
      // Detect category once for efficiency
      const category = this.#categoryDetector.detectCategory(message);

      // Log to console if filters allow
      if (this.#shouldLogToConsole(level, category)) {
        try {
          const formattedMessage = this.#formatConsoleMessage(
            level,
            category,
            message
          );
          this.#consoleLogger[level](formattedMessage, ...args);
        } catch (consoleError) {
          // Console logging failed, but don't affect remote logging
          // Use fallback console.error to report the issue
          if (typeof console.error === 'function') {
            console.error(
              '[HybridLogger] Console logging failed:',
              consoleError
            );
          }
        }
      }

      // Log to remote if filters allow
      if (this.#shouldLogToRemote(level, category)) {
        try {
          this.#remoteLogger[level](message, ...args);
        } catch (remoteError) {
          // Remote logging failed, but don't affect console logging
          // Log error to console if possible
          if (
            this.#filters.console.enabled &&
            typeof this.#consoleLogger.error === 'function'
          ) {
            this.#consoleLogger.error(
              '[HybridLogger] Remote logging failed:',
              remoteError
            );
          }
        }
      }
    } catch (error) {
      // Fallback error handling if everything fails
      if (typeof console.error === 'function') {
        console.error(
          '[HybridLogger] Critical logging failure:',
          error,
          'Original message:',
          message
        );
      }
    }
  }

  /**
   * Determines if a log should be sent to the console based on filters.
   *
   * @private
   * @param {string} level - Log level
   * @param {string|undefined} category - Log category
   * @returns {boolean} True if log should go to console
   */
  #shouldLogToConsole(level, category) {
    if (!this.#filters.console.enabled) {
      return false;
    }

    return this.#matchesFilter(
      level,
      category,
      this.#filters.console.levels,
      this.#filters.console.categories
    );
  }

  /**
   * Determines if a log should be sent to remote based on filters.
   *
   * @private
   * @param {string} level - Log level
   * @param {string|undefined} category - Log category
   * @returns {boolean} True if log should go to remote
   */
  #shouldLogToRemote(level, category) {
    if (!this.#filters.remote.enabled) {
      return false;
    }

    return this.#matchesFilter(
      level,
      category,
      this.#filters.remote.levels,
      this.#filters.remote.categories
    );
  }

  /**
   * Checks if level and category match the specified filters.
   *
   * @private
   * @param {string} level - Log level
   * @param {string|undefined} category - Log category
   * @param {string[]|null} levelFilter - Allowed levels, null for all
   * @param {string[]|null} categoryFilter - Allowed categories, null for all
   * @returns {boolean} True if matches filters
   */
  #matchesFilter(level, category, levelFilter, categoryFilter) {
    // Check level filter
    if (levelFilter !== null && !levelFilter.includes(level)) {
      return false;
    }

    // Check category filter
    if (categoryFilter !== null) {
      if (!category || !categoryFilter.includes(category)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Formats console message with category and level prefix.
   *
   * @private
   * @param {string} level - Log level
   * @param {string|undefined} category - Log category
   * @param {string} message - Original message
   * @returns {string} Formatted message
   */
  #formatConsoleMessage(level, category, message) {
    const categoryStr = category ? category.toUpperCase() : 'GENERAL';
    const prefix = `[${categoryStr}:${level.toUpperCase()}]`;
    return `${prefix} ${message}`;
  }

  /**
   * Gets the current filter configuration.
   *
   * @returns {HybridLoggerFilters} Current filter configuration
   */
  getFilters() {
    return JSON.parse(JSON.stringify(this.#filters));
  }

  /**
   * Updates the complete filter configuration.
   *
   * @param {HybridLoggerFilters} filters - New filter configuration
   */
  updateFilters(filters) {
    this.#filters = { ...this.#filters, ...filters };
  }
}

export default HybridLogger;
