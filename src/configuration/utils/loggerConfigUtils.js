// src/configuration/utils/loggerConfigUtils.js

import { LoggerConfigLoader } from '../loggerConfigLoader.js';
import { DebugLogConfigLoader } from '../debugLogConfigLoader.js';

/**
 * @description Loads the debug logging configuration from debug-logging-config.json.
 * This is a helper function to centralize debug config loading logic.
 * @param {object} logger - The logger instance for logging.
 * @param {object} [safeEventDispatcher] - Optional event dispatcher.
 * @returns {Promise<object|null>} The debug configuration or null if not available.
 */
import { shouldSkipDebugConfig } from '../../utils/environmentUtils.js';

export async function loadDebugLogConfig(logger, safeEventDispatcher) {
  // Check if debug config loading is explicitly disabled (e.g., for performance tests)
  if (shouldSkipDebugConfig()) {
    if (logger && typeof logger.debug === 'function') {
      logger.debug(
        'Debug configuration loading is disabled via SKIP_DEBUG_CONFIG environment variable.'
      );
    }
    return null;
  }

  try {
    const debugConfigLoader = new DebugLogConfigLoader({
      logger,
      safeEventDispatcher,
    });

    const debugConfig = await debugConfigLoader.loadConfig();

    // Check if the config loaded successfully and is enabled
    if (!debugConfig.error && debugConfig.enabled !== false) {
      return debugConfig;
    }

    // If there was an error or debug logging is disabled, return null
    return null;
  } catch (error) {
    // Log the error but don't throw - we'll fall back to legacy config
    if (logger && typeof logger.debug === 'function') {
      logger.debug(
        `Failed to load debug configuration: ${error.message}. Will fall back to legacy configuration.`
      );
    }
    return null;
  }
}

/**
 * @description Loads the logger configuration and applies the level if successful.
 * This is a shared utility to avoid duplication between container configurations.
 * Now supports both debug-logging-config.json and legacy logger-config.json formats.
 * @param {AppContainer} container - The DI container.
 * @param {ConsoleLogger} logger - The logger instance to configure.
 * @param {object} tokens - The DI tokens object.
 * @param {string} [configPrefix] - The prefix for log messages.
 * @returns {Promise<void>} Resolves once configuration is loaded.
 */
export async function loadAndApplyLoggerConfig(
  container,
  logger,
  tokens,
  configPrefix = 'ContainerConfig'
) {
  try {
    const safeEventDispatcher = container.resolve(tokens.ISafeEventDispatcher);

    // First, try to load the debug configuration
    logger.debug(
      `[${configPrefix}] Attempting to load debug logging configuration...`
    );
    const debugConfig = await loadDebugLogConfig(logger, safeEventDispatcher);

    if (debugConfig) {
      logger.debug(
        `[${configPrefix}] Debug configuration loaded successfully. Mode: '${
          debugConfig.mode || 'not specified'
        }'.`
      );

      // Apply mode if specified (triggers mode switching in LoggerStrategy)
      if (debugConfig.mode && typeof debugConfig.mode === 'string') {
        logger.debug(
          `[${configPrefix}] Applying debug mode '${debugConfig.mode}' via setLogLevel...`
        );
        logger.setLogLevel(debugConfig.mode);
      }
      // Also apply logLevel if specified (for backward compatibility)
      else if (
        debugConfig.logLevel &&
        typeof debugConfig.logLevel === 'string'
      ) {
        logger.debug(
          `[${configPrefix}] Applying log level '${debugConfig.logLevel}' from debug config...`
        );
        logger.setLogLevel(debugConfig.logLevel);
      }

      // Exit early if debug config was successfully applied
      return;
    }

    // Fall back to legacy configuration if debug config is not available
    logger.debug(
      `[${configPrefix}] Debug configuration not available or disabled. Falling back to legacy logger configuration...`
    );

    const loggerConfigLoader = new LoggerConfigLoader({
      logger,
      safeEventDispatcher,
    });
    const loggerConfigResult = await loggerConfigLoader.loadConfig();

    if (
      loggerConfigResult &&
      !loggerConfigResult.error &&
      loggerConfigResult.logLevel !== undefined
    ) {
      if (typeof loggerConfigResult.logLevel === 'string') {
        logger.debug(
          `[${configPrefix}] Logger configuration loaded successfully. Requested level: '${loggerConfigResult.logLevel}'. Applying...`
        );
        logger.setLogLevel(loggerConfigResult.logLevel);
      } else {
        logger.warn(
          `[${configPrefix}] Logger configuration loaded, but 'logLevel' is not a string: ${loggerConfigResult.logLevel}. Retaining current log level.`
        );
      }
    } else if (loggerConfigResult && loggerConfigResult.error) {
      logger.warn(
        `[${configPrefix}] Failed to load logger configuration from '${
          loggerConfigResult.path || 'default path'
        }'. Error: ${loggerConfigResult.message}. Stage: ${
          loggerConfigResult.stage || 'N/A'
        }. Retaining current log level.`
      );
    } else {
      logger.debug(
        `[${configPrefix}] Logger configuration file loaded but no specific logLevel found or file was empty. Retaining current log level.`
      );
    }
  } catch (error) {
    logger.error(
      `[${configPrefix}] CRITICAL ERROR during asynchronous logger configuration loading:`,
      {
        message: error.message,
        stack: error.stack,
        errorObj: error,
      }
    );
  }
}
