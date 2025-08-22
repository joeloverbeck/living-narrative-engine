// src/configuration/debugLogConfigLoader.js
// --- FILE START ---

import { fetchWithRetry } from '../utils/index.js';
import { isNonBlankString } from '../utils/textUtils.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {object} DebugLogConfigurationFile
 * @description Represents the structure of the debug-logging-config.json file.
 * @property {boolean} [enabled] - Whether debug logging is enabled.
 * @property {string} [mode] - The logger mode (e.g., "development", "production", "console", "none").
 * @property {boolean} [fallbackToConsole] - Whether to fallback to console logging on errors.
 * @property {string} [logLevel] - Log level for backward compatibility (e.g., "DEBUG", "INFO", "WARN", "ERROR").
 * @property {object} [remote] - Remote logging configuration.
 * @property {string} [remote.endpoint] - Remote logging endpoint URL.
 * @property {number} [remote.batchSize] - Batch size for remote logging.
 * @property {number} [remote.flushInterval] - Flush interval in milliseconds.
 * @property {number} [remote.retryAttempts] - Number of retry attempts.
 * @property {number} [remote.retryDelay] - Retry delay in milliseconds.
 * @property {object} [categories] - Category-specific logging configuration.
 * @property {object} [performance] - Performance-related configuration.
 * @property {number} [performance.slowLogThreshold] - Threshold for slow operation logging.
 * @property {boolean} [performance.enableMetrics] - Whether to enable performance metrics.
 */

/**
 * @typedef {object} LoadDebugLogConfigErrorResult
 * @description Represents the structure of a failed debug log configuration load attempt.
 * @property {true} error - Indicates an error occurred.
 * @property {string} message - A description of the error.
 * @property {string} [stage] - The stage where the error occurred (e.g., 'fetch', 'parse', 'validation').
 * @property {Error} [originalError] - The original error object, if any.
 * @property {string} [path] - The file path that was attempted.
 */

/**
 * @class DebugLogConfigLoader
 * @description Service responsible for loading and parsing the debug-logging-config.json file.
 * It fetches the configuration file, typically served as a static asset.
 * Follows the same pattern as LoggerConfigLoader for consistency.
 */
export class DebugLogConfigLoader {
  /**
   * @private
   * @type {ILogger}
   */
  #logger;

  /**
   * @private
   * @type {string} - Default path to the debug logging configuration file.
   */
  #defaultConfigPath = 'config/debug-logging-config.json';

  /**
   * @private
   * @type {number}
   */
  #defaultMaxRetries = 2;

  /**
   * @private
   * @type {number}
   */
  #defaultBaseDelayMs = 300;

  /**
   * @private
   * @type {number}
   */
  #defaultMaxDelayMs = 1000;

  /** @type {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
  #safeEventDispatcher;

  /**
   * Creates an instance of DebugLogConfigLoader.
   *
   * @param {object} [dependencies] - Optional dependencies.
   * @param {ILogger} [dependencies.logger] - An optional logger instance. Uses `console` for its own logging if not provided,
   * which is important during early bootstrap when the main app logger might not be fully configured.
   * @param {string} [dependencies.configPath] - Optional override for the default configuration file path.
   * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} [dependencies.safeEventDispatcher] - Event dispatcher for error reporting.
   */
  constructor(dependencies = {}) {
    // Use the provided logger, or fallback to the global console object.
    // This is crucial because this loader might run very early in the app lifecycle.
    this.#logger = dependencies.logger || console;

    // Allow operation without safeEventDispatcher for maximum flexibility
    this.#safeEventDispatcher = dependencies.safeEventDispatcher;

    // Check for environment variable override first
    const envConfigPath = this.#getEnvironmentConfigPath();
    if (envConfigPath) {
      this.#defaultConfigPath = envConfigPath;
    } else if (
      dependencies.configPath &&
      typeof dependencies.configPath === 'string'
    ) {
      this.#defaultConfigPath = dependencies.configPath;
    }
  }

  /**
   * Gets the configuration path from environment variable if set.
   *
   * @private
   * @returns {string|null} The environment-specified config path or null.
   */
  #getEnvironmentConfigPath() {
    /* global process */
    if (typeof process !== 'undefined' && process.env?.DEBUG_LOG_CONFIG_PATH) {
      const envPath = process.env.DEBUG_LOG_CONFIG_PATH.trim();
      if (envPath) {
        // Log that we're using an environment-specified path
        const logInfo = (msg) =>
          this.#logger.info
            ? this.#logger.info(msg)
            : // eslint-disable-next-line no-console
              console.info(msg);
        logInfo(
          `[DebugLogConfigLoader] Using environment-specified config path: ${envPath}`
        );
        return envPath;
      }
    }
    return null;
  }

  /**
   * Loads and parses the debug logging configuration file from the specified path,
   * or a default path if none is provided.
   *
   * @async
   * @param {string} [filePath] - The path to the debug-logging-config.json file.
   * If not provided, the configured default path will be used.
   * @returns {Promise<DebugLogConfigurationFile | LoadDebugLogConfigErrorResult>} A promise that resolves with the parsed
   * JavaScript object representing the debug logging configuration, or an error object if loading/parsing fails.
   */
  async loadConfig(filePath) {
    const path = isNonBlankString(filePath)
      ? filePath.trim()
      : this.#defaultConfigPath;

    // Use a safe way to log, as this.#logger could be console or a full ILogger
    const logError = (msg, ...args) =>
      this.#logger.error
        ? this.#logger.error(msg, ...args)
        : // eslint-disable-next-line no-console
          console.error(msg, ...args);
    const logWarn = (msg, ...args) =>
      this.#logger.warn
        ? this.#logger.warn(msg, ...args)
        : // eslint-disable-next-line no-console
          console.warn(msg, ...args);
    const logDebug = (msg, ...args) =>
      this.#logger.debug
        ? this.#logger.debug(msg, ...args)
        : // eslint-disable-next-line no-console
          console.debug(msg, ...args);

    let parsedResponse;
    try {
      // If we don't have a safeEventDispatcher, use a mock one for fetchWithRetry
      const eventDispatcher = this.#safeEventDispatcher || {
        dispatch: () => {}, // No-op if not provided
      };

      parsedResponse = await fetchWithRetry(
        path,
        { method: 'GET', headers: { Accept: 'application/json' } },
        this.#defaultMaxRetries,
        this.#defaultBaseDelayMs,
        this.#defaultMaxDelayMs,
        eventDispatcher,
        this.#logger
      );

      if (typeof parsedResponse !== 'object' || parsedResponse === null) {
        logWarn(
          `[DebugLogConfigLoader] Configuration file from ${path} is malformed (not an object). Content:`,
          parsedResponse
        );
        return {
          error: true,
          message: `Configuration file from ${path} is malformed (e.g., not an object). Ensure it's valid JSON.`,
          stage: 'validation',
          path: path,
        };
      }

      if (Object.keys(parsedResponse).length === 0) {
        // Return empty object, indicates no specific configuration found but file was parsable
        logDebug(
          `[DebugLogConfigLoader] Configuration file from ${path} is empty.`
        );
        return {};
      }

      // Validate configuration structure
      if (parsedResponse.mode !== undefined) {
        if (typeof parsedResponse.mode !== 'string') {
          logWarn(
            `[DebugLogConfigLoader] 'mode' in ${path} must be a string. Found: ${typeof parsedResponse.mode}. Value: ${
              parsedResponse.mode
            }`
          );
          return {
            error: true,
            message: `'mode' in ${path} must be a string. Found: ${typeof parsedResponse.mode}.`,
            stage: 'validation',
            path: path,
          };
        }
      }

      // Validate logLevel if present (backward compatibility)
      if (parsedResponse.logLevel !== undefined) {
        if (typeof parsedResponse.logLevel !== 'string') {
          logWarn(
            `[DebugLogConfigLoader] 'logLevel' in ${path} must be a string. Found: ${typeof parsedResponse.logLevel}. Value: ${
              parsedResponse.logLevel
            }`
          );
          return {
            error: true,
            message: `'logLevel' in ${path} must be a string. Found: ${typeof parsedResponse.logLevel}.`,
            stage: 'validation',
            path: path,
          };
        }
      }

      // Validate enabled flag if present
      if (
        parsedResponse.enabled !== undefined &&
        typeof parsedResponse.enabled !== 'boolean'
      ) {
        logWarn(
          `[DebugLogConfigLoader] 'enabled' in ${path} must be a boolean. Found: ${typeof parsedResponse.enabled}.`
        );
        // Don't fail, just warn - we can still use the rest of the config
      }

      // Validate remote configuration if present
      if (parsedResponse.remote !== undefined) {
        if (
          typeof parsedResponse.remote !== 'object' ||
          parsedResponse.remote === null
        ) {
          logWarn(
            `[DebugLogConfigLoader] 'remote' in ${path} must be an object. Found: ${typeof parsedResponse.remote}.`
          );
          // Don't fail, just warn
        }
      }

      // Validate categories if present
      if (parsedResponse.categories !== undefined) {
        if (
          typeof parsedResponse.categories !== 'object' ||
          parsedResponse.categories === null
        ) {
          logWarn(
            `[DebugLogConfigLoader] 'categories' in ${path} must be an object. Found: ${typeof parsedResponse.categories}.`
          );
          // Don't fail, just warn
        }
      }

      logDebug(
        `[DebugLogConfigLoader] Successfully loaded debug configuration from ${path}`
      );

      return /** @type {DebugLogConfigurationFile} */ (parsedResponse);
    } catch (error) {
      // Errors from fetchWithRetry (fetch/parse failures)
      logError(
        `[DebugLogConfigLoader] Failed to load or parse debug logging configuration from ${path}. Error: ${error.message}`,
        {
          path,
          originalError: {
            message: error.message,
            name: error.name,
            stack: error.stack,
          },
        }
      );

      let stage = 'fetch_or_parse';
      if (error.message) {
        const lowerMsg = error.message.toLowerCase();
        if (
          lowerMsg.includes('json') ||
          lowerMsg.includes('parse') ||
          lowerMsg.includes('token')
        ) {
          stage = 'parse';
        } else if (
          lowerMsg.includes('failed to fetch') ||
          lowerMsg.includes('network') ||
          lowerMsg.includes('not found') ||
          lowerMsg.includes('status')
        ) {
          stage = 'fetch';
        }
      }

      return {
        error: true,
        message: `Failed to load or parse debug logging configuration from ${path}: ${error.message}`,
        stage: stage,
        originalError: error,
        path: path,
      };
    }
  }

  /**
   * Checks if the debug logging is enabled based on the configuration.
   * This is a convenience method to quickly check if debug logging should be used.
   *
   * @async
   * @param {string} [filePath] - Optional path to the configuration file.
   * @returns {Promise<boolean>} True if debug logging is enabled, false otherwise.
   */
  async isEnabled(filePath) {
    const config = await this.loadConfig(filePath);

    // If there was an error loading the config, default to disabled
    if (config.error) {
      return false;
    }

    // Check the enabled flag (defaults to true if not specified)
    return config.enabled !== false;
  }

  /**
   * Gets the configured mode from the debug logging configuration.
   *
   * @async
   * @param {string} [filePath] - Optional path to the configuration file.
   * @returns {Promise<string|null>} The configured mode or null if not configured.
   */
  async getMode(filePath) {
    const config = await this.loadConfig(filePath);

    // If there was an error loading the config, return null
    if (config.error) {
      return null;
    }

    return config.mode || null;
  }
}

// --- FILE END ---
