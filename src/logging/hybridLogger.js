/**
 * @file HybridLogger that sends logs to both console and remote simultaneously
 * @see consoleLogger.js, remoteLogger.js, logCategoryDetector.js
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import SensitiveDataFilter from './SensitiveDataFilter.js';
import { v4 as uuidv4 } from 'uuid';

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
 * @property {object} [filtering] - Sensitive data filtering configuration
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
   * @private
   * @type {SensitiveDataFilter|null}
   */
  #sensitiveDataFilter;

  /**
   * @private
   * @type {object}
   */
  #criticalLoggingConfig;

  /**
   * @private
   * @type {*}
   */
  #performanceMonitor;

  /**
   * @private
   * @type {Array}
   */
  #criticalBuffer;

  /**
   * @private
   * @type {number}
   */
  #maxBufferSize;

  /**
   * @private
   * @type {object}
   */
  #bufferMetadata;

  /**
   * Creates a HybridLogger instance.
   *
   * @param {object} dependencies - Required dependencies
   * @param {ILogger} dependencies.consoleLogger - Console logger instance
   * @param {ILogger} dependencies.remoteLogger - Remote logger instance
   * @param {*} dependencies.categoryDetector - LogCategoryDetector instance
   * @param {*} [dependencies.performanceMonitor] - Optional performance monitor
   * @param {HybridLoggerFilters} [config] - Filter configuration
   */
  constructor({ consoleLogger, remoteLogger, categoryDetector, performanceMonitor }, config = {}) {
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
    this.#performanceMonitor = performanceMonitor;

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

    // Initialize critical logging configuration
    this.#criticalLoggingConfig = config.criticalLogging || {
      alwaysShowInConsole: true,
      enableVisualNotifications: true,
      bufferSize: 50,
      notificationPosition: 'top-right',
      autoDismissAfter: null
    };

    // Initialize sensitive data filter if configured
    if (config.filtering && config.filtering.enabled !== false) {
      this.#sensitiveDataFilter = new SensitiveDataFilter({
        logger: consoleLogger, // Use console logger for filter's own logging
        enabled: config.filtering.enabled,
        config: config.filtering
      });
    } else {
      this.#sensitiveDataFilter = null;
    }

    // Initialize critical buffer fields after existing initialization
    this.#criticalBuffer = [];
    this.#maxBufferSize = this.#criticalLoggingConfig?.bufferSize || 50;
    this.#bufferMetadata = {
      totalWarnings: 0,
      totalErrors: 0,
      oldestTimestamp: null,
      newestTimestamp: null
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
   * Adds a critical log entry to the buffer (warnings and errors only).
   *
   * @private
   * @param {string} level - Log level ('warn' or 'error')
   * @param {string} message - Log message
   * @param {string|undefined} category - Log category
   * @param {object} metadata - Additional metadata
   * @returns {object|undefined} The created log entry or undefined if not critical
   */
  #addToCriticalBuffer(level, message, category, metadata = {}) {
    if (level !== 'warn' && level !== 'error') {
      return; // Only buffer critical logs
    }
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      category,
      metadata,
      id: uuidv4() // Using uuid package
    };
    
    // Add to buffer (circular buffer logic)
    this.#criticalBuffer.push(logEntry);
    
    // Maintain buffer size limit
    if (this.#criticalBuffer.length > this.#maxBufferSize) {
      this.#criticalBuffer.shift(); // Remove oldest
    }
    
    // Update metadata
    this.#updateBufferMetadata(level);
    
    return logEntry;
  }

  /**
   * Updates buffer metadata with new log entry statistics.
   *
   * @private
   * @param {string} level - Log level ('warn' or 'error')
   */
  #updateBufferMetadata(level) {
    if (level === 'warn') {
      this.#bufferMetadata.totalWarnings++;
    } else if (level === 'error') {
      this.#bufferMetadata.totalErrors++;
    }
    
    const now = new Date().toISOString();
    if (!this.#bufferMetadata.oldestTimestamp) {
      this.#bufferMetadata.oldestTimestamp = now;
    }
    this.#bufferMetadata.newestTimestamp = now;
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
    const category = this.#categoryDetector.detectCategory(message);
    
    // Add to critical buffer
    this.#addToCriticalBuffer('warn', message, category, { args });
    
    // Existing warn logic...
    this.#logToDestinations('warn', message, args);
  }

  /**
   * Logs an error message to both console and remote (if filters allow).
   *
   * @param {string} message - The primary error message string
   * @param {...any} args - Additional arguments or objects to include in the error output
   */
  error(message, ...args) {
    const category = this.#categoryDetector.detectCategory(message);
    
    // Add to critical buffer
    this.#addToCriticalBuffer('error', message, category, { args });
    
    // Existing error logic...
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
    // Performance tracking could be added here if needed
    
    try {
      // Detect category once for efficiency
      const category = this.#categoryDetector.detectCategory(message);

      // Track performance metrics if monitor is available
      if (this.#performanceMonitor && typeof this.#performanceMonitor.monitorLogOperation === 'function') {
        this.#performanceMonitor.monitorLogOperation(level, message, {
          category,
          argsCount: args.length,
          messageLength: message.length,
        });
      }

      // Log to console if filters allow
      if (this.#shouldLogToConsole(level, category)) {
        try {
          const formattedMessage = this.#formatConsoleMessage(
            level,
            category,
            message
          );
          
          // Apply sensitive data filtering to console output if enabled
          let filteredMessage = formattedMessage;
          let filteredArgs = args;
          if (this.#sensitiveDataFilter && this.#sensitiveDataFilter.isEnabled()) {
            const strategy = this.#sensitiveDataFilter.strategy || 'mask';
            filteredMessage = this.#sensitiveDataFilter.filter(formattedMessage, strategy);
            filteredArgs = args.map(arg => this.#sensitiveDataFilter.filter(arg, strategy));
          }
          
          this.#consoleLogger[level](filteredMessage, ...filteredArgs);
        } catch (consoleError) {
          // Console logging failed, but don't affect remote logging
          // Use fallback console.error to report the issue
          if (typeof console.error === 'function') {
            // eslint-disable-next-line no-console
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
        // eslint-disable-next-line no-console
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

    // Check if this is a critical log that should bypass filters
    if (this.#criticalLoggingConfig && this.#criticalLoggingConfig.alwaysShowInConsole) {
      if (level === 'warn' || level === 'error') {
        return true; // Always show critical logs
      }
    }

    // Existing filter logic for non-critical logs
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
    if (levelFilter !== null && levelFilter && !levelFilter.includes(level)) {
      return false;
    }

    // Check category filter
    if (categoryFilter !== null && categoryFilter) {
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

  /**
   * Waits for all pending remote flush operations to complete
   * Useful for tests and cleanup scenarios
   *
   * @returns {Promise<void>}
   */
  async waitForPendingFlushes() {
    // Delegate to remote logger if it has the method
    if (typeof this.#remoteLogger.waitForPendingFlushes === 'function') {
      await this.#remoteLogger.waitForPendingFlushes();
    }
  }

  /**
   * Gets the remote logger instance for testing purposes.
   * This method should only be used in test environments.
   *
   * @returns {ILogger} The remote logger instance
   */
  getRemoteLogger() {
    return this.#remoteLogger;
  }

  /**
   * Get all critical logs from the buffer
   * 
   * @param {object} options - Filter options
   * @param {string} options.level - Filter by level ('warn', 'error', or null for both)
   * @param {number} options.limit - Maximum number of logs to return
   * @returns {Array} Array of log entries
   */
  getCriticalLogs(options = {}) {
    let logs = [...this.#criticalBuffer]; // Create copy
    
    if (options.level) {
      logs = logs.filter(log => log.level === options.level);
    }
    
    if (options.limit) {
      logs = logs.slice(-options.limit);
    }
    
    return logs;
  }
  
  /**
   * Get critical buffer metadata
   * 
   * @returns {object} Buffer statistics
   */
  getCriticalBufferStats() {
    return {
      currentSize: this.#criticalBuffer.length,
      maxSize: this.#maxBufferSize,
      ...this.#bufferMetadata
    };
  }
  
  /**
   * Clear the critical log buffer
   */
  clearCriticalBuffer() {
    this.#criticalBuffer = [];
    this.#bufferMetadata = {
      totalWarnings: 0,
      totalErrors: 0,
      oldestTimestamp: null,
      newestTimestamp: null
    };
  }

  /**
   * Gets performance metrics if performance monitor is available
   *
   * @returns {object|null} Performance metrics or null if not available
   */
  getPerformanceMetrics() {
    if (this.#performanceMonitor && typeof this.#performanceMonitor.getLoggingMetrics === 'function') {
      return this.#performanceMonitor.getLoggingMetrics();
    }
    return null;
  }

  /**
   * Gets the performance monitor instance
   *
   * @returns {*} The performance monitor instance or undefined
   */
  getPerformanceMonitor() {
    return this.#performanceMonitor;
  }
}

export default HybridLogger;
