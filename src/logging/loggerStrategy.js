/**
 * @file LoggerStrategy class implementing the Strategy pattern for logger selection based on runtime mode.
 * Main entry point for all logging operations with support for runtime mode switching.
 */

import ConsoleLogger from './consoleLogger.js';
import NoOpLogger from './noOpLogger.js';
import RemoteLogger from './remoteLogger.js';
import { validateDependency } from '../utils/dependencyUtils.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Logger modes supported by the strategy
 *
 * @enum {string}
 */
export const LoggerMode = {
  PRODUCTION: 'production',
  DEVELOPMENT: 'development',
  TEST: 'test',
  CONSOLE: 'console',
  NONE: 'none',
};

/**
 * Maps special setLogLevel values to logger modes
 *
 * @private
 * @type {{[key: string]: string}}
 */
const MODE_SWITCH_MAP = {
  remote: LoggerMode.PRODUCTION,
  console: LoggerMode.CONSOLE,
  hybrid: LoggerMode.DEVELOPMENT,
  none: LoggerMode.NONE,
};

/**
 * Default configuration for the logger strategy
 *
 * @private
 */
const DEFAULT_CONFIG = {
  enabled: true,
  fallbackToConsole: true,
  remote: {
    endpoint: 'http://localhost:3001/api/debug-log',
    batchSize: 100,
    flushInterval: 1000,
    retryAttempts: 3,
    retryBaseDelay: 1000,
    retryMaxDelay: 30000,
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 60000,
    requestTimeout: 5000,
  },
  categories: {
    engine: { enabled: true, level: 'debug' },
    ui: { enabled: true, level: 'info' },
  },
};

/**
 * Implements the ILogger interface using the Strategy pattern.
 * Delegates to appropriate logger implementations based on runtime mode.
 * Supports runtime switching between different logger implementations.
 *
 * @implements {ILogger}
 */
class LoggerStrategy {
  /**
   * @private
   * @type {ILogger}
   */
  #logger;

  /**
   * @private
   * @type {string}
   */
  #mode;

  /**
   * @private
   * @type {object}
   */
  #config;

  /**
   * @private
   * @type {object}
   */
  #dependencies;

  /**
   * @private
   * @type {Map<string, ILogger>}
   */
  #loggerInstances;

  /**
   * Creates an instance of LoggerStrategy.
   *
   * @param {object} options - Configuration options
   * @param {string} [options.mode] - Initial logger mode
   * @param {object} [options.config] - Configuration object
   * @param {object} [options.dependencies] - Logger dependencies
   * @param {ConsoleLogger} [options.dependencies.consoleLogger] - ConsoleLogger instance
   * @param {RemoteLogger} [options.dependencies.remoteLogger] - RemoteLogger instance (auto-created if not provided)
   * @param {*} [options.dependencies.hybridLogger] - HybridLogger instance (future)
   * @param {*} [options.dependencies.mockLogger] - MockLogger instance (for tests)
   * @param {*} [options.dependencies.eventBus] - Event bus for error reporting
   */
  constructor({ mode, config = {}, dependencies = {} } = {}) {
    this.#dependencies = dependencies;
    this.#loggerInstances = new Map();

    // Merge config with defaults
    this.#config = this.#validateConfig({ ...DEFAULT_CONFIG, ...config });

    // Determine initial mode
    this.#mode = this.#detectMode(mode);

    // Create initial logger
    this.#logger = this.#createLogger(
      this.#mode,
      this.#config,
      this.#dependencies
    );

    // Log initialization (only if logger is valid)
    if (
      this.#mode !== LoggerMode.NONE &&
      this.#logger &&
      typeof this.#logger.info === 'function'
    ) {
      this.#logger.info(
        `[LoggerStrategy] Initialized with mode: ${this.#mode}`
      );
    }
  }

  /**
   * Detects the appropriate logger mode based on various inputs.
   *
   * @private
   * @param {string} [explicitMode] - Explicitly provided mode
   * @returns {string} The determined logger mode
   */
  #detectMode(explicitMode) {
    // Priority 1: Explicit mode parameter
    if (explicitMode && Object.values(LoggerMode).includes(explicitMode)) {
      return explicitMode;
    }

    // Priority 2: Environment variable DEBUG_LOG_MODE
    if (typeof process !== 'undefined' && process.env?.DEBUG_LOG_MODE) {
      const envMode = process.env.DEBUG_LOG_MODE.toLowerCase();
      if (Object.values(LoggerMode).includes(envMode)) {
        return envMode;
      }
    }

    // Priority 3: Configuration file mode
    if (
      this.#config.mode &&
      Object.values(LoggerMode).includes(this.#config.mode)
    ) {
      return this.#config.mode;
    }

    // Priority 4: NODE_ENV mapping or JEST_WORKER_ID detection
    if (typeof process !== 'undefined') {
      // Check for Jest test environment first (JEST_WORKER_ID is always set in Jest)
      if (process.env?.JEST_WORKER_ID !== undefined) {
        return LoggerMode.TEST;
      }
      
      // Then check NODE_ENV
      if (process.env?.NODE_ENV) {
        const nodeEnv = process.env.NODE_ENV.toLowerCase();
        switch (nodeEnv) {
          case 'test':
            return LoggerMode.TEST;
          case 'production':
            return LoggerMode.PRODUCTION;
          case 'development':
            return LoggerMode.DEVELOPMENT;
        }
      }
    }

    // Default
    return LoggerMode.CONSOLE;
  }

  /**
   * Creates or retrieves a logger instance for the specified mode.
   *
   * @private
   * @param {string} mode - The logger mode
   * @param {object} config - Configuration object
   * @param {object} dependencies - Logger dependencies
   * @returns {ILogger} The logger instance
   */
  #createLogger(mode, config, dependencies) {
    // Check cache first
    if (this.#loggerInstances.has(mode)) {
      return this.#loggerInstances.get(mode);
    }

    let logger;

    try {
      switch (mode) {
        case LoggerMode.PRODUCTION:
          // Use provided RemoteLogger or create new instance
          if (dependencies.remoteLogger) {
            logger = dependencies.remoteLogger;
          } else {
            // Create RemoteLogger with fallback to console logger
            logger = this.#createRemoteLogger(config, dependencies);
          }
          break;

        case LoggerMode.DEVELOPMENT:
          // HybridLogger will be implemented in DEBUGLOGGING-008
          if (dependencies.hybridLogger) {
            logger = dependencies.hybridLogger;
          } else {
            // Fallback to console for now
            logger = this.#createConsoleLogger(config);
          }
          break;

        case LoggerMode.TEST:
          // Use mock logger in test mode if provided
          if (dependencies.mockLogger) {
            logger = dependencies.mockLogger;
          } else {
            // Use NoOpLogger for tests by default
            logger = new NoOpLogger();
          }
          break;

        case LoggerMode.NONE:
          logger = new NoOpLogger();
          break;

        case LoggerMode.CONSOLE:
        default:
          logger = this.#createConsoleLogger(config);
          break;
      }

      // Validate logger has required methods
      if (!logger || typeof logger.info !== 'function') {
        throw new Error(`Invalid logger instance for mode: ${mode}`);
      }
    } catch (error) {
      // Fallback to console logger on any error
      if (config.fallbackToConsole !== false) {
        console.error(
          '[LoggerStrategy] Failed to create logger, falling back to console:',
          error
        );
        try {
          logger = this.#createConsoleLogger(config);
        } catch (fallbackError) {
          // Last resort - use NoOpLogger
          console.error(
            '[LoggerStrategy] Fallback to console also failed:',
            fallbackError
          );
          logger = new NoOpLogger();
        }
      } else {
        // If fallback is disabled, use NoOpLogger
        logger = new NoOpLogger();
      }

      // Report error via event bus if available
      if (
        dependencies.eventBus &&
        typeof dependencies.eventBus.dispatch === 'function'
      ) {
        dependencies.eventBus.dispatch({
          type: 'LOGGER_CREATION_FAILED',
          payload: { error: error.message, mode },
        });
      }
    }

    // Cache the logger instance
    this.#loggerInstances.set(mode, logger);
    return logger;
  }

  /**
   * Creates a ConsoleLogger instance.
   *
   * @private
   * @param {object} config - Configuration object
   * @returns {ConsoleLogger} The console logger instance
   */
  #createConsoleLogger(config) {
    // Use provided instance if available
    if (this.#dependencies.consoleLogger) {
      return this.#dependencies.consoleLogger;
    }

    // Create new instance
    const logLevel = config.logLevel || 'INFO';
    return new ConsoleLogger(logLevel);
  }

  /**
   * Creates a RemoteLogger instance with fallback to console logger.
   *
   * @private
   * @param {object} config - Configuration object
   * @param {object} dependencies - Logger dependencies
   * @returns {RemoteLogger} The remote logger instance
   */
  #createRemoteLogger(config, dependencies) {
    try {
      // Create console logger as fallback
      const consoleLogger = this.#createConsoleLogger(config);

      // Prepare RemoteLogger configuration
      const remoteConfig = {
        ...config.remote,
      };

      // Prepare dependencies for RemoteLogger
      const remoteDependencies = {
        consoleLogger,
        eventBus: dependencies.eventBus,
      };

      return new RemoteLogger({
        config: remoteConfig,
        dependencies: remoteDependencies,
      });
    } catch (error) {
      // Log error and fall back to console logger
      console.error(
        '[LoggerStrategy] Failed to create RemoteLogger, falling back to console:',
        error
      );

      return this.#createConsoleLogger(config);
    }
  }

  /**
   * Validates and merges configuration.
   *
   * @private
   * @param {object} config - Configuration to validate
   * @returns {object} Validated configuration
   */
  #validateConfig(config) {
    // Basic validation
    if (typeof config !== 'object' || config === null) {
      console.warn(
        '[LoggerStrategy] Invalid configuration provided, using defaults'
      );
      return DEFAULT_CONFIG;
    }

    // Validate mode if provided
    if (config.mode && !Object.values(LoggerMode).includes(config.mode)) {
      console.warn(
        `[LoggerStrategy] Invalid mode '${config.mode}' in config, will use auto-detection`
      );
      delete config.mode;
    }

    // Ensure remote config exists
    if (!config.remote || typeof config.remote !== 'object') {
      config.remote = DEFAULT_CONFIG.remote;
    }

    // Ensure categories config exists
    if (!config.categories || typeof config.categories !== 'object') {
      config.categories = DEFAULT_CONFIG.categories;
    }

    return config;
  }

  /**
   * Switches to a different logger mode at runtime.
   *
   * @private
   * @param {string} newMode - The new logger mode
   */
  #switchMode(newMode) {
    if (!Object.values(LoggerMode).includes(newMode)) {
      this.#logger.warn(
        `[LoggerStrategy] Invalid mode '${newMode}' for switching`
      );
      return;
    }

    if (this.#mode === newMode) {
      // No change needed
      return;
    }

    const oldMode = this.#mode;
    this.#mode = newMode;
    this.#logger = this.#createLogger(
      newMode,
      this.#config,
      this.#dependencies
    );

    // Log the mode switch (unless switching to none)
    if (newMode !== LoggerMode.NONE) {
      this.#logger.info(
        `[LoggerStrategy] Switched from ${oldMode} to ${newMode} mode`
      );
    }
  }

  // ILogger interface methods

  /**
   * Logs an informational message.
   *
   * @param {string} message - The primary message string to log.
   * @param {...any} args - Additional arguments or objects to include in the log output.
   */
  info(message, ...args) {
    this.#logger.info(message, ...args);
  }

  /**
   * Logs a warning message.
   *
   * @param {string} message - The primary warning message string.
   * @param {...any} args - Additional arguments or objects to include in the warning output.
   */
  warn(message, ...args) {
    this.#logger.warn(message, ...args);
  }

  /**
   * Logs an error message.
   *
   * @param {string} message - The primary error message string.
   * @param {...any} args - Additional arguments or objects, typically including an Error object, to log.
   */
  error(message, ...args) {
    this.#logger.error(message, ...args);
  }

  /**
   * Logs a debug message.
   *
   * @param {string} message - The primary debug message string.
   * @param {...any} args - Additional arguments or objects to include in the debug output.
   */
  debug(message, ...args) {
    this.#logger.debug(message, ...args);
  }

  // ConsoleLogger compatibility methods

  /**
   * Starts a collapsed logging group.
   *
   * @param {string} [label] - The label for the group.
   */
  groupCollapsed(label) {
    if (typeof this.#logger.groupCollapsed === 'function') {
      this.#logger.groupCollapsed(label);
    }
  }

  /**
   * Ends the current logging group.
   */
  groupEnd() {
    if (typeof this.#logger.groupEnd === 'function') {
      this.#logger.groupEnd();
    }
  }

  /**
   * Displays tabular data in the console.
   *
   * @param {any} data - The data to display in a table.
   * @param {string[] | undefined} [columns] - An array of strings representing the columns to include.
   */
  table(data, columns) {
    if (typeof this.#logger.table === 'function') {
      this.#logger.table(data, columns);
    }
  }

  /**
   * Sets the log level or switches logger mode.
   * Supports both traditional log level changes and mode switching via special values.
   *
   * @param {string | number} logLevelInput - The desired log level or special mode switch value.
   */
  setLogLevel(logLevelInput) {
    // Check if it's a mode switch command
    if (typeof logLevelInput === 'string') {
      const lowerInput = logLevelInput.toLowerCase();

      // Check for special mode switch values
      if (MODE_SWITCH_MAP[lowerInput]) {
        this.#switchMode(MODE_SWITCH_MAP[lowerInput]);
        return;
      }

      // Check for direct mode names
      if (Object.values(LoggerMode).includes(lowerInput)) {
        this.#switchMode(lowerInput);
        return;
      }
    }

    // Otherwise, delegate to the current logger's setLogLevel
    if (typeof this.#logger.setLogLevel === 'function') {
      this.#logger.setLogLevel(logLevelInput);
    }
  }

  /**
   * Gets the current logger mode.
   *
   * @returns {string} The current mode
   */
  getMode() {
    return this.#mode;
  }

  /**
   * Gets the current logger instance (for testing purposes).
   *
   * @returns {ILogger} The current logger
   */
  getCurrentLogger() {
    return this.#logger;
  }
}

export default LoggerStrategy;
