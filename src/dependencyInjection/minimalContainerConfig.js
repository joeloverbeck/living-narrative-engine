// src/dependencyInjection/minimalContainerConfig.js

// --- Import DI tokens & helpers ---
import { tokens } from './tokens.js';
import { Registrar } from '../utils/registrarHelpers.js';

// --- Import Logger ---
import ConsoleLogger, { LogLevel } from '../logging/consoleLogger.js';

// --- Import LoggerConfigLoader ---
import { LoggerConfigLoader } from '../configuration/loggerConfigLoader.js';

// --- Import Logger Interface for Type Hinting ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

// --- Import registration bundle functions ---
import { registerLoaders } from './registrations/loadersRegistrations.js';
import { registerInfrastructure } from './registrations/infrastructureRegistrations.js';
import { registerPersistence } from './registrations/persistenceRegistrations.js';
import { registerWorldAndEntity } from './registrations/worldAndEntityRegistrations.js';
import { registerCommandAndAction } from './registrations/commandAndActionRegistrations.js';
import { registerInterpreters } from './registrations/interpreterRegistrations.js';
import { registerEventBusAdapters } from './registrations/eventBusAdapterRegistrations.js';
import { registerInitializers } from './registrations/initializerRegistrations.js';
import { registerRuntime } from './registrations/runtimeRegistrations.js';

/** @typedef {import('./appContainer.js').default} AppContainer */

/**
 * Configures a minimal dependency injection container for tools that don't need
 * the full game UI stack (like the anatomy visualizer).
 *
 * This configuration includes:
 * - Core services (logger, loaders, registry, etc.)
 * - Entity and world services (needed for anatomy)
 * - Event system
 * - Initializers
 *
 * It excludes:
 * - UI registrations (which expect game-specific DOM elements)
 * - Turn lifecycle (not needed for visualization tools)
 * - AI services (not needed for visualization)
 * - Orchestration services (game-specific)
 *
 * @param {AppContainer} container
 */
export function configureMinimalContainer(container) {
  const registrar = new Registrar(container);

  // --- Bootstrap logger with a default level (e.g., INFO) ---
  const initialLogLevel = LogLevel.INFO;
  const appLogger = new ConsoleLogger(initialLogLevel);
  registrar.instance(tokens.ILogger, appLogger);

  const logger = /** @type {ConsoleLogger} */ (
    container.resolve(tokens.ILogger)
  );
  logger.debug(
    `[MinimalContainerConfig] Initial logger registered with level: ${initialLogLevel}.`
  );

  // --- Core Registration (essential services only) ---
  // These are needed by most tools and don't depend on game UI
  registerLoaders(container);
  registerInfrastructure(container);
  registerPersistence(container);
  registerWorldAndEntity(container);
  registerCommandAndAction(container);
  registerInterpreters(container);
  registerEventBusAdapters(container);
  registerInitializers(container);
  registerRuntime(container);

  logger.debug('[MinimalContainerConfig] All core bundles registered.');

  // --- Load logger configuration asynchronously ---
  loadLoggerConfig(container, logger);

  logger.debug('[MinimalContainerConfig] Minimal configuration complete.');
}

/**
 * @description Loads the logger configuration and applies the level if successful.
 * @param {AppContainer} container - The DI container.
 * @param {ConsoleLogger} logger - The logger instance to configure.
 * @returns {Promise<void>} Resolves once configuration is loaded.
 */
export async function loadLoggerConfig(container, logger) {
  try {
    const loggerConfigLoader = new LoggerConfigLoader({
      logger,
      safeEventDispatcher: container.resolve(tokens.ISafeEventDispatcher),
    });
    logger.debug(
      '[MinimalContainerConfig] Starting asynchronous load of logger configuration...'
    );
    const loggerConfigResult = await loggerConfigLoader.loadConfig();

    if (
      loggerConfigResult &&
      !loggerConfigResult.error &&
      loggerConfigResult.logLevel !== undefined
    ) {
      if (typeof loggerConfigResult.logLevel === 'string') {
        logger.debug(
          `[MinimalContainerConfig] Logger configuration loaded successfully. Requested level: '${loggerConfigResult.logLevel}'. Applying...`
        );
        logger.setLogLevel(loggerConfigResult.logLevel);
      } else {
        logger.warn(
          `[MinimalContainerConfig] Logger configuration loaded, but 'logLevel' is not a string: ${loggerConfigResult.logLevel}. Retaining current log level.`
        );
      }
    } else if (loggerConfigResult && loggerConfigResult.error) {
      logger.warn(
        `[MinimalContainerConfig] Failed to load logger configuration from '${
          loggerConfigResult.path || 'default path'
        }'. Error: ${loggerConfigResult.message}. Stage: ${
          loggerConfigResult.stage || 'N/A'
        }. Retaining current log level.`
      );
    } else {
      logger.debug(
        '[MinimalContainerConfig] Logger configuration file loaded but no specific logLevel found or file was empty. Retaining current log level.'
      );
    }
  } catch (error) {
    logger.error(
      '[MinimalContainerConfig] CRITICAL ERROR during asynchronous logger configuration loading:',
      {
        message: error.message,
        stack: error.stack,
        errorObj: error,
      }
    );
  }
}
