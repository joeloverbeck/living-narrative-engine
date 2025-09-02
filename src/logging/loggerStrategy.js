/**
 * @file LoggerStrategy class implementing the Strategy pattern for logger selection based on runtime mode.
 * Main entry point for all logging operations with support for runtime mode switching.
 */

import ConsoleLogger, { LogLevel } from './consoleLogger.js';
import NoOpLogger from './noOpLogger.js';
import RemoteLogger from './remoteLogger.js';
import HybridLogger from './hybridLogger.js';
import { validateDependency } from '../utils/dependencyUtils.js';
import { DEFAULT_CONFIG, CONFIG_PRESETS } from './config/defaultConfig.js';

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
  test: LoggerMode.TEST,
};

/**
 * Special commands supported by setLogLevel
 *
 * @private
 * @type {string[]}
 */
const SPECIAL_COMMANDS = ['reload', 'reset', 'flush', 'status'];

/**
 * Valid log levels for backward compatibility
 *
 * @private
 * @type {string[]}
 */
const VALID_LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE'];

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
   * @private
   * @type {string | number}
   */
  #currentLevel;

  /**
   * @private
   * @type {Array<object>}
   */
  #logBuffer;

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
    this.#logBuffer = [];
    this.#currentLevel = 'INFO'; // Default log level

    // Merge config with defaults (but don't use mode from DEFAULT_CONFIG)
    const { mode: defaultMode, ...defaultConfigWithoutMode } = DEFAULT_CONFIG;
    this.#config = this.#validateConfig({
      ...defaultConfigWithoutMode,
      ...config,
    });

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
          // Use HybridLogger for development mode, unless remote logging is disabled
          if (dependencies.hybridLogger) {
            logger = dependencies.hybridLogger;
          } else {
            // Check if remote logging is disabled in config
            if (config.enabled === false) {
              // When remote logging is disabled, use console logger only
              logger = this.#createConsoleLogger(config);
            } else {
              // Create HybridLogger instance when remote logging is enabled
              logger = this.#createHybridLogger(config, dependencies);
            }
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
   * Creates a HybridLogger instance.
   *
   * @private
   * @param {object} config - Configuration object
   * @param {object} dependencies - Logger dependencies
   * @returns {HybridLogger} The hybrid logger instance
   */
  #createHybridLogger(config, dependencies) {
    try {
      // Create console and remote loggers
      const consoleLogger = this.#createConsoleLogger(config);
      const remoteLogger = this.#createRemoteLogger(config, dependencies);

      // Create LogCategoryDetector if not provided
      const categoryDetector = dependencies.categoryDetector || {
        detectCategory: () => 'general',
      };

      // Create HybridLogger
      return new HybridLogger(
        {
          consoleLogger,
          remoteLogger,
          categoryDetector,
        },
        config.hybrid || {}
      );
    } catch (error) {
      console.error(
        '[LoggerStrategy] Failed to create HybridLogger, falling back to console:',
        error
      );
      return this.#createConsoleLogger(config);
    }
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
      if (this.#logger && typeof this.#logger.warn === 'function') {
        this.#logger.warn(
          `[LoggerStrategy] Invalid mode '${newMode}' for switching`
        );
      }
      return;
    }

    if (this.#mode === newMode) {
      // No change needed
      return;
    }

    const oldMode = this.#mode;

    // Save current state before transition
    this.#saveCurrentState();

    // Create new logger
    const newLogger = this.#createLogger(
      newMode,
      this.#config,
      this.#dependencies
    );

    // Transition state
    this.#transitionState(oldMode, newMode, newLogger);

    // Update references
    this.#logger = newLogger;
    this.#mode = newMode;

    // Notify mode change
    this.#notifyModeChange(oldMode, newMode);

    // Log the mode switch (unless switching to none)
    if (newMode !== LoggerMode.NONE) {
      this.#logger.info(
        `[LoggerStrategy] Switched from ${oldMode} to ${newMode} mode`
      );
    }
  }

  /**
   * Checks if the input is a valid log level.
   *
   * @private
   * @param {any} input - The input to check
   * @returns {boolean} True if input is a valid log level
   */
  #isLogLevel(input) {
    if (typeof input === 'string') {
      return VALID_LOG_LEVELS.includes(input.toUpperCase());
    }
    if (typeof input === 'number') {
      return Object.values(LogLevel).includes(input);
    }
    return false;
  }

  /**
   * Checks if the input is a valid mode.
   *
   * @private
   * @param {any} input - The input to check
   * @returns {boolean} True if input is a valid mode
   */
  #isMode(input) {
    if (typeof input !== 'string') return false;
    const lowerInput = input.toLowerCase();

    // Check if it's a direct mode name or a mapped mode name
    const isDirectMode = Object.values(LoggerMode).includes(lowerInput);
    const isMappedMode = Object.keys(MODE_SWITCH_MAP).includes(lowerInput);

    return isDirectMode || isMappedMode;
  }

  /**
   * Checks if the input is a special command.
   *
   * @private
   * @param {any} input - The input to check
   * @returns {boolean} True if input is a special command
   */
  #isSpecialCommand(input) {
    if (typeof input !== 'string') return false;
    return SPECIAL_COMMANDS.includes(input.toLowerCase());
  }

  /**
   * Saves the current logger state.
   *
   * @private
   */
  #saveCurrentState() {
    // Save any buffered logs if the logger supports it
    if (typeof this.#logger.getBuffer === 'function') {
      const buffer = this.#logger.getBuffer();
      if (buffer && buffer.length > 0) {
        this.#logBuffer.push(...buffer);
      }
    }
  }

  /**
   * Transitions state between loggers.
   *
   * @private
   * @param {string} oldMode - The old mode
   * @param {string} newMode - The new mode
   * @param {ILogger} newLogger - The new logger instance
   */
  #transitionState(oldMode, newMode, newLogger) {
    // Transfer buffered logs if applicable
    if (this.#hasBuffer()) {
      const buffer = this.#drainBuffer();
      if (
        newLogger.processBatch &&
        typeof newLogger.processBatch === 'function'
      ) {
        newLogger.processBatch(buffer);
      } else {
        // Replay logs individually if batch processing not available
        buffer.forEach((log) => {
          const level = log.level || 'info';
          if (typeof newLogger[level] === 'function') {
            const args = log.args || [];
            newLogger[level](log.message, ...args);
          }
        });
      }
    }

    // Transfer log level if applicable
    if (this.#currentLevel && typeof newLogger.setLogLevel === 'function') {
      newLogger.setLogLevel(this.#currentLevel);
    }
  }

  /**
   * Checks if there are buffered logs.
   *
   * @private
   * @returns {boolean} True if there are buffered logs
   */
  #hasBuffer() {
    return this.#logBuffer.length > 0;
  }

  /**
   * Drains and returns the log buffer.
   *
   * @private
   * @returns {Array<object>} The buffered logs
   */
  #drainBuffer() {
    const buffer = [...this.#logBuffer];
    this.#logBuffer = [];
    return buffer;
  }

  /**
   * Notifies about mode change via event bus.
   *
   * @private
   * @param {string} oldMode - The old mode
   * @param {string} newMode - The new mode
   */
  #notifyModeChange(oldMode, newMode) {
    if (
      this.#dependencies.eventBus &&
      typeof this.#dependencies.eventBus.dispatch === 'function'
    ) {
      this.#dependencies.eventBus.dispatch({
        type: 'logger.mode.changed',
        payload: {
          from: oldMode,
          to: newMode,
          timestamp: Date.now(),
          reason: 'runtime-switch',
        },
      });
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
   * Supports traditional log levels, mode switching, configuration objects, and special commands.
   *
   * @param {string | number | object} input - The desired log level, mode, configuration, or command.
   * @returns {object|undefined} Status object if 'status' command, undefined otherwise
   */
  setLogLevel(input) {
    try {
      // Check mode switching first (takes precedence for 'none')
      if (this.#isMode(input)) {
        const lowerInput = input.toLowerCase();
        const targetMode = MODE_SWITCH_MAP[lowerInput] || lowerInput;
        this.#switchMode(targetMode);
        return;
      }

      // Backward compatibility: traditional log levels (except 'none' which is handled above)
      if (this.#isLogLevel(input)) {
        this.#currentLevel = input;
        if (typeof this.#logger.setLogLevel === 'function') {
          this.#logger.setLogLevel(input);
        }
        return;
      }

      // Special commands
      if (this.#isSpecialCommand(input)) {
        return this.#handleSpecialCommand(input.toLowerCase());
      }

      // Configuration object
      if (typeof input === 'object' && input !== null) {
        this.#applyConfiguration(input);
        return;
      }

      // Unknown input
      if (this.#logger && typeof this.#logger.warn === 'function') {
        this.#logger.warn(
          `[LoggerStrategy] Invalid setLogLevel input: ${JSON.stringify(input)}`
        );
      }
    } catch (error) {
      // Don't let errors in setLogLevel break the application
      console.error('[LoggerStrategy] Error in setLogLevel:', error);
      // Keep current configuration on error
    }
  }

  /**
   * Applies a configuration object.
   *
   * @private
   * @param {object} config - Configuration object
   */
  #applyConfiguration(config) {
    // Validate configuration
    const validation = this.#validateConfiguration(config);
    if (!validation.valid) {
      if (this.#logger && typeof this.#logger.error === 'function') {
        this.#logger.error(
          `[LoggerStrategy] Invalid configuration: ${validation.errors.join(', ')}`
        );
      }
      return;
    }

    // Apply mode change if specified
    if (config.mode && config.mode !== this.#mode) {
      const targetMode = MODE_SWITCH_MAP[config.mode] || config.mode;
      if (Object.values(LoggerMode).includes(targetMode)) {
        this.#switchMode(targetMode);
      }
    }

    // Apply category updates
    if (config.categories) {
      this.#updateCategories(config.categories);
    }

    // Apply logger-specific config
    if (config.logLevel) {
      this.#currentLevel = config.logLevel;
      if (typeof this.#logger.setLogLevel === 'function') {
        this.#logger.setLogLevel(config.logLevel);
      }
    }

    // Merge configuration updates
    if (config.remote || config.console || config.performance) {
      this.#config = this.#mergeConfig(this.#config, config);

      // Recreate logger with new config if needed
      if (config.remote && this.#mode === LoggerMode.PRODUCTION) {
        this.#logger = this.#createLogger(
          this.#mode,
          this.#config,
          this.#dependencies
        );
      }
    }
  }

  /**
   * Handles special commands.
   *
   * @private
   * @param {string} command - The command to handle
   */
  #handleSpecialCommand(command) {
    switch (command) {
      case 'reload':
        // Reload configuration from defaults
        const reloadedConfig = this.#mergeConfig(
          DEFAULT_CONFIG,
          this.#dependencies.config || {}
        );
        this.#config = reloadedConfig;
        // Don't call applyConfiguration as it may change the logger
        // Just update the config and log
        if (this.#logger && typeof this.#logger.info === 'function') {
          this.#logger.info('[LoggerStrategy] Configuration reloaded');
        }
        break;

      case 'reset':
        // Reset to default configuration
        this.#config = { ...DEFAULT_CONFIG };
        this.#mode = this.#detectMode(null);
        this.#currentLevel = 'INFO';
        this.#logger = this.#createLogger(
          this.#mode,
          this.#config,
          this.#dependencies
        );
        if (this.#logger && typeof this.#logger.info === 'function') {
          this.#logger.info('[LoggerStrategy] Configuration reset to defaults');
        }
        break;

      case 'flush':
        // Force any pending logs to be processed
        if (typeof this.#logger.flush === 'function') {
          this.#logger.flush();
        } else if (typeof this.#logger.processBatch === 'function') {
          this.#logger.processBatch([]);
        }
        break;

      case 'status':
        // Return current status
        const status = this.#getStatus();
        if (this.#logger && typeof this.#logger.info === 'function') {
          this.#logger.info('[LoggerStrategy] Status:', status);
        }
        return status;

      default:
        if (this.#logger && typeof this.#logger.warn === 'function') {
          this.#logger.warn(`[LoggerStrategy] Unknown command: ${command}`);
        }
    }
  }

  /**
   * Validates a configuration object.
   *
   * @private
   * @param {object} config - Configuration to validate
   * @returns {{valid: boolean, errors: string[]}} Validation result
   */
  #validateConfiguration(config) {
    const errors = [];

    if (typeof config !== 'object' || config === null) {
      return { valid: false, errors: ['Configuration must be an object'] };
    }

    // Validate mode if present
    if (config.mode !== undefined) {
      const targetMode = MODE_SWITCH_MAP[config.mode] || config.mode;
      if (!Object.values(LoggerMode).includes(targetMode)) {
        errors.push(`Invalid mode: ${config.mode}`);
      }
    }

    // Validate categories if present
    if (config.categories !== undefined) {
      if (typeof config.categories !== 'object' || config.categories === null) {
        errors.push('Categories must be an object');
      } else {
        // Validate each category configuration
        for (const [key, value] of Object.entries(config.categories)) {
          if (typeof value !== 'object' || value === null) {
            errors.push(`Category ${key} must be an object`);
          } else if (value.level && !this.#isLogLevel(value.level)) {
            errors.push(
              `Invalid log level for category ${key}: ${value.level}`
            );
          }
        }
      }
    }

    // Validate logLevel if present
    if (config.logLevel !== undefined && !this.#isLogLevel(config.logLevel)) {
      errors.push(`Invalid log level: ${config.logLevel}`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Updates category configurations.
   *
   * @private
   * @param {object} categories - Category configurations to update
   */
  #updateCategories(categories) {
    if (!this.#config.categories) {
      this.#config.categories = {};
    }

    // Merge category updates
    this.#config.categories = {
      ...this.#config.categories,
      ...categories,
    };

    // Apply to current logger if it supports category configuration
    if (typeof this.#logger.updateCategories === 'function') {
      this.#logger.updateCategories(categories);
    }
  }

  /**
   * Gets the current status.
   *
   * @private
   * @returns {object} Status information
   */
  #getStatus() {
    return {
      mode: this.#mode,
      logLevel: this.#currentLevel,
      bufferedLogs: this.#logBuffer.length,
      config: {
        enabled: this.#config.enabled,
        fallbackToConsole: this.#config.fallbackToConsole,
        categories: Object.keys(this.#config.categories || {}),
      },
      logger: {
        type: this.#logger.constructor.name,
        hasFlush: typeof this.#logger.flush === 'function',
        hasProcessBatch: typeof this.#logger.processBatch === 'function',
      },
    };
  }

  /**
   * Deep merges configuration objects.
   *
   * @private
   * @param {object} target - Target configuration
   * @param {object} source - Source configuration to merge
   * @returns {object} Merged configuration
   */
  #mergeConfig(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key]) &&
          typeof result[key] === 'object' &&
          result[key] !== null &&
          !Array.isArray(result[key])
        ) {
          // Recursively merge objects
          result[key] = this.#mergeConfig(result[key], source[key]);
        } else {
          // Direct assignment for primitives, arrays, and null
          result[key] = source[key];
        }
      }
    }

    return result;
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
