/**
 * @file traceConfigUtils.js - Utilities for loading and applying trace configuration
 * @see loggerConfigUtils.js
 */

import { TraceConfigLoader } from '../traceConfigLoader.js';

/**
 * @typedef {import('../traceConfigLoader.js').TraceConfigurationFile} TraceConfigurationFile
 */

/**
 * Loads the trace configuration and stores it in the container for later use.
 * This is a shared utility to avoid duplication between container configurations.
 *
 * @param {AppContainer} container - The DI container
 * @param {ConsoleLogger} logger - The logger instance
 * @param {object} tokens - The DI tokens object
 * @param {string} [configPrefix] - The prefix for log messages
 * @returns {Promise<void>} Resolves once configuration is loaded
 */
export async function loadAndApplyTraceConfig(
  container,
  logger,
  tokens,
  configPrefix = 'ContainerConfig'
) {
  try {
    const traceConfigLoader = new TraceConfigLoader({
      logger,
      safeEventDispatcher: container.resolve(tokens.ISafeEventDispatcher),
    });

    logger.debug(
      `[${configPrefix}] Starting asynchronous load of trace configuration...`
    );

    const traceConfigResult = await traceConfigLoader.loadConfig();

    if (
      traceConfigResult &&
      !traceConfigResult.error &&
      traceConfigResult.traceAnalysisEnabled !== undefined
    ) {
      // Store the configuration in the container for later use
      container.register(tokens.ITraceConfiguration, traceConfigResult);

      logger.debug(
        `[${configPrefix}] Trace configuration loaded successfully. Analysis enabled: ${traceConfigResult.traceAnalysisEnabled}`
      );

      // Log specific settings if trace analysis is enabled
      if (traceConfigResult.traceAnalysisEnabled) {
        const perfMonEnabled =
          traceConfigResult.performanceMonitoring?.enabled ?? true;
        const vizEnabled = traceConfigResult.visualization?.enabled ?? true;
        const analysisEnabled = traceConfigResult.analysis?.enabled ?? true;

        logger.info(
          `[${configPrefix}] Trace analysis tools enabled - Performance: ${perfMonEnabled}, Visualization: ${vizEnabled}, Analysis: ${analysisEnabled}`
        );
      } else {
        logger.debug(
          `[${configPrefix}] Trace analysis is disabled by configuration.`
        );
      }
    } else if (traceConfigResult && traceConfigResult.error) {
      logger.warn(
        `[${configPrefix}] Failed to load trace configuration: ${traceConfigResult.message}. Using default configuration (trace analysis disabled).`
      );

      // Register default configuration with trace analysis disabled
      container.register(tokens.ITraceConfiguration, {
        traceAnalysisEnabled: false,
      });
    } else {
      logger.debug(
        `[${configPrefix}] No trace configuration specified. Using default configuration (trace analysis disabled).`
      );

      // Register default configuration
      container.register(tokens.ITraceConfiguration, {
        traceAnalysisEnabled: false,
      });
    }
  } catch (err) {
    logger.error(
      `[${configPrefix}] Unexpected error while loading trace configuration: ${err.message}. Using default configuration (trace analysis disabled).`,
      err
    );

    // Register default configuration on error
    container.register(tokens.ITraceConfiguration, {
      traceAnalysisEnabled: false,
    });
  }
}

/**
 * Gets the trace configuration from the container
 *
 * @param {AppContainer} container - The DI container
 * @param {object} tokens - The DI tokens object
 * @returns {TraceConfigurationFile} The trace configuration
 */
export function getTraceConfiguration(container, tokens) {
  try {
    return container.resolve(tokens.ITraceConfiguration);
  } catch {
    // Return default configuration if not found
    return {
      traceAnalysisEnabled: false,
    };
  }
}

/**
 * Checks if trace analysis is enabled
 *
 * @param {AppContainer} container - The DI container
 * @param {object} tokens - The DI tokens object
 * @returns {boolean} Whether trace analysis is enabled
 */
export function isTraceAnalysisEnabled(container, tokens) {
  const config = getTraceConfiguration(container, tokens);
  return config.traceAnalysisEnabled === true;
}
