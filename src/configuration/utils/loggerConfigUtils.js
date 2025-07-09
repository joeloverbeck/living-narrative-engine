// src/configuration/utils/loggerConfigUtils.js

import { LoggerConfigLoader } from '../loggerConfigLoader.js';

/**
 * @description Loads the logger configuration and applies the level if successful.
 * This is a shared utility to avoid duplication between container configurations.
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
    const loggerConfigLoader = new LoggerConfigLoader({
      logger,
      safeEventDispatcher: container.resolve(tokens.ISafeEventDispatcher),
    });
    logger.debug(
      `[${configPrefix}] Starting asynchronous load of logger configuration...`
    );
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
