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
   * Compiled filter sets for performance optimization
   * @private
   * @type {object}
   */
  #compiledFilters;

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
  constructor(
    { consoleLogger, remoteLogger, categoryDetector, performanceMonitor },
    config = {}
  ) {
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
      autoDismissAfter: null,
    };

    // Initialize sensitive data filter if configured
    if (config.filtering && config.filtering.enabled !== false) {
      this.#sensitiveDataFilter = new SensitiveDataFilter({
        logger: consoleLogger, // Use console logger for filter's own logging
        enabled: config.filtering.enabled,
        config: config.filtering,
      });
    } else {
      this.#sensitiveDataFilter = null;
    }

    // Initialize critical buffer fields after existing initialization
    this.#criticalBuffer = [];
    this.#maxBufferSize = this.#criticalLoggingConfig?.bufferSize ?? 50;
    this.#bufferMetadata = {
      totalWarnings: 0,
      totalErrors: 0,
      oldestTimestamp: null,
      newestTimestamp: null,
    };

    // Initialize compiled filter sets for performance optimization
    this.#compileFilters();

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

    // If buffer size is 0, don't store anything
    if (this.#maxBufferSize === 0) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      category,
      metadata,
      id: uuidv4(), // Using uuid package
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
    const category = this.#categoryDetector.detectCategory(message, { level: 'warn' });

    // Add to critical buffer
    this.#addToCriticalBuffer('warn', message, category, { args });

    // Existing warn logic...
    this.#logToDestinations('warn', message, args, category);
  }

  /**
   * Logs an error message to both console and remote (if filters allow).
   *
   * @param {string} message - The primary error message string
   * @param {...any} args - Additional arguments or objects to include in the error output
   */
  error(message, ...args) {
    const category = this.#categoryDetector.detectCategory(message, { level: 'error' });

    // Add to critical buffer
    this.#addToCriticalBuffer('error', message, category, { args });

    // Existing error logic...
    this.#logToDestinations('error', message, args, category);
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
    // Recompile filters for performance optimization
    this.#compileFilters();
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
    // Recompile filters for performance optimization
    this.#compileFilters();
  }

  /**
   * Updates filter configuration dynamically at runtime
   *
   * @param {object} filterUpdates - Filter configuration updates
   * @param {FilterConfig} [filterUpdates.console] - Console filter updates
   * @param {FilterConfig} [filterUpdates.remote] - Remote filter updates
   */
  updateFilters(filterUpdates) {
    if (filterUpdates.console) {
      if (filterUpdates.console.categories !== undefined) {
        this.#filters.console.categories = filterUpdates.console.categories;
      }
      if (filterUpdates.console.levels !== undefined) {
        this.#filters.console.levels = filterUpdates.console.levels;
      }
      if (filterUpdates.console.enabled !== undefined) {
        this.#filters.console.enabled = filterUpdates.console.enabled;
      }
    }

    if (filterUpdates.remote) {
      if (filterUpdates.remote.categories !== undefined) {
        this.#filters.remote.categories = filterUpdates.remote.categories;
      }
      if (filterUpdates.remote.levels !== undefined) {
        this.#filters.remote.levels = filterUpdates.remote.levels;
      }
      if (filterUpdates.remote.enabled !== undefined) {
        this.#filters.remote.enabled = filterUpdates.remote.enabled;
      }
    }

    // Recompile filters after all updates
    this.#compileFilters();
  }

  /**
   * Logs to both console and remote destinations based on filter configuration.
   *
   * @private
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {any[]} args - Additional log arguments
   * @param {string|undefined} [preDetectedCategory] - Pre-detected category to avoid dual detection
   */
  #logToDestinations(level, message, args, preDetectedCategory) {
    try {
      // Early filtering: Check if any destination needs this log before expensive operations
      const needsConsole = this.#testCompiledFilter('console', level, undefined) ||
        (this.#criticalLoggingConfig?.alwaysShowInConsole && (level === 'warn' || level === 'error'));
      const needsRemote = this.#testCompiledFilter('remote', level, undefined);
      
      // Skip processing entirely if no destination needs this log
      if (!needsConsole && !needsRemote) {
        return;
      }

      // Use pre-detected category if available, otherwise detect if needed
      let category = preDetectedCategory;
      const needsCategoryDetection = this.#needsCategoryForFiltering(needsConsole, needsRemote);
      if (!category && needsCategoryDetection) {
        category = this.#categoryDetector.detectCategory(message, { level });
      }

      // Re-check filters with category information if needed
      const finalConsoleCheck = needsConsole && (
        !needsCategoryDetection || this.#testCompiledFilter('console', level, category) ||
        (this.#criticalLoggingConfig?.alwaysShowInConsole && (level === 'warn' || level === 'error'))
      );
      const finalRemoteCheck = needsRemote && (
        !needsCategoryDetection || this.#testCompiledFilter('remote', level, category)
      );

      // Skip if no destination needs this log after category detection
      if (!finalConsoleCheck && !finalRemoteCheck) {
        return;
      }

      // Track performance metrics if monitor is available
      if (
        this.#performanceMonitor &&
        typeof this.#performanceMonitor.monitorLogOperation === 'function'
      ) {
        this.#performanceMonitor.monitorLogOperation(level, message, {
          category,
          argsCount: args.length,
          messageLength: message.length,
        });
      }

      // Log to console if final check passed
      if (finalConsoleCheck) {
        try {
          const formattedMessage = this.#formatConsoleMessage(
            level,
            category,
            message
          );

          // Apply sensitive data filtering to console output if enabled
          let filteredMessage = formattedMessage;
          let filteredArgs = args;
          if (
            this.#sensitiveDataFilter &&
            this.#sensitiveDataFilter.isEnabled()
          ) {
            const strategy = this.#sensitiveDataFilter.strategy || 'mask';
            filteredMessage = this.#sensitiveDataFilter.filter(
              formattedMessage,
              strategy
            );
            filteredArgs = args.map((arg) =>
              this.#sensitiveDataFilter.filter(arg, strategy)
            );
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

      // Log to remote if final check passed
      if (finalRemoteCheck) {
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
   * Determines if category detection is needed for filtering
   *
   * @private
   * @param {boolean} needsConsole - Whether console destination might need this log
   * @param {boolean} needsRemote - Whether remote destination might need this log
   * @returns {boolean} True if category detection is needed
   */
  #needsCategoryForFiltering(needsConsole, needsRemote) {
    return (
      (needsConsole && this.#compiledFilters.console.testCategory !== null) ||
      (needsRemote && this.#compiledFilters.remote.testCategory !== null)
    );
  }

  /**
   * Compiles filter sets for performance optimization
   *
   * @private
   */
  #compileFilters() {
    this.#compiledFilters = {
      console: this.#compileFilterSet(
        this.#filters.console.enabled,
        this.#filters.console.levels,
        this.#filters.console.categories
      ),
      remote: this.#compileFilterSet(
        this.#filters.remote.enabled,
        this.#filters.remote.levels,  
        this.#filters.remote.categories
      ),
    };
  }

  /**
   * Compiles a single filter set for efficient testing
   *
   * @private
   * @param {boolean} enabled - Whether destination is enabled
   * @param {string[]|null} levels - Allowed levels, null for all
   * @param {string[]|null} categories - Allowed categories, null for all
   * @returns {object} Compiled filter set
   */
  #compileFilterSet(enabled, levels, categories) {
    return {
      enabled,
      testLevel: levels === null ? null : new Set(levels),
      testCategory: categories === null ? null : new Set(categories),
    };
  }

  /**
   * Tests if log passes compiled filter efficiently
   *
   * @private
   * @param {string} destination - 'console' or 'remote'
   * @param {string} level - Log level
   * @param {string|undefined} category - Log category
   * @returns {boolean} True if log passes filter
   */
  #testCompiledFilter(destination, level, category) {
    const filter = this.#compiledFilters[destination];
    
    if (!filter.enabled) {
      return false;
    }
    
    // Level check using Set for O(1) lookup
    if (filter.testLevel !== null && !filter.testLevel.has(level)) {
      return false;
    }
    
    // Category check using Set for O(1) lookup
    if (filter.testCategory !== null) {
      if (!category || !filter.testCategory.has(category)) {
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
      logs = logs.filter((log) => log.level === options.level);
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
      ...this.#bufferMetadata,
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
      newestTimestamp: null,
    };
  }

  /**
   * Gets performance metrics if performance monitor is available
   *
   * @returns {object|null} Performance metrics or null if not available
   */
  getPerformanceMetrics() {
    if (
      this.#performanceMonitor &&
      typeof this.#performanceMonitor.getLoggingMetrics === 'function'
    ) {
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
