// src/dependencyInjection/containerConfig.js

// --- Import DI tokens & helpers ---
import { tokens } from './tokens.js';
import { Registrar } from './registrarHelpers.js';

// --- Import Logger ---
import ConsoleLogger, { LogLevel } from '../logging/consoleLogger.js';

// --- Import LoggerConfigLoader ---
import { LoggerConfigLoader } from '../configuration/loggerConfigLoader.js';

// --- Import Logger Interface for Type Hinting ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
// --- Import necessary types for registry population ---
/** @typedef {import('../registry/systemServiceRegistry.js').SystemServiceRegistry} SystemServiceRegistry */
/** @typedef {import('../data/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../data/systemDataRegistry.js').SystemDataRegistry} SystemDataRegistry */
/** @typedef {import('../context/worldContext.js').default} WorldContext */
/** @typedef {import('../perception/perceptionUpdateService.js').default} PerceptionUpdateService */

// --- Import registration bundle functions ---
import { registerLoaders } from './registrations/loadersRegistrations.js';
import { registerInfrastructure } from './registrations/infrastructureRegistrations.js';
import { registerUI } from './registrations/uiRegistrations.js';
import { registerDomainServices } from './registrations/domainServicesRegistrations.js';
import { registerCoreSystems } from './registrations/coreSystemsRegistrations.js';
import { registerInterpreters } from './registrations/interpreterRegistrations.js';
import { registerInitializers } from './registrations/initializerRegistrations.js';
import { registerRuntime } from './registrations/runtimeRegistrations.js';
import { registerOrchestration } from './registrations/orchestrationRegistrations.js';
import { registerAdapters } from './registrations/adapterRegistrations.js';

/** @typedef {import('./appContainer.js').default} AppContainer */
/** @typedef {import('../../bootstrapper/UIBootstrapper.js').EssentialUIElements} EssentialUIElements */

/**
 * @callback ConfigureContainerFunction
 * @param {AppContainer} container - The application container instance.
 * @param {EssentialUIElements} uiReferences - References to essential UI elements.
 * @returns {void}
 */

/**
 * Configures the application's dependency‑injection container.
 *
 * @param {AppContainer} container
 * @param {EssentialUIElements} uiElements – external DOM references.
 */
export function configureContainer(container, uiElements) {
  const registrar = new Registrar(container);
  const { outputDiv, inputElement, titleElement, document: doc } = uiElements;

  // --- Bootstrap logger with a default level (e.g., INFO) ---
  // This logger instance will be updated if a dependencyInjection file is successfully loaded.
  // Choose a sensible default. LogLevel.INFO is common for production,
  // LogLevel.DEBUG might be useful during development if not overridden by dependencyInjection.
  const initialLogLevel = LogLevel.INFO;
  const appLogger = new ConsoleLogger(initialLogLevel);
  // CORRECTED LINE: Use registrar.instance for pre-built instances
  registrar.instance(tokens.ILogger, appLogger);

  // Get the logger instance (cast to ConsoleLogger to access setLogLevel later)
  const logger = /** @type {ConsoleLogger} */ (
    container.resolve(tokens.ILogger)
  );

  // Log that we're attempting to load the remote configuration.
  // This message will use the `initialLogLevel`.
  logger.debug(
    `[ContainerConfig] Initial logger registered with level: ${initialLogLevel}. Attempting to load remote logger configuration...`
  );

  // --- Asynchronously load logger configuration and update level ---
  // This is a self-invoking async function so it doesn't block configureContainer.
  (async () => {
    try {
      // The LoggerConfigLoader will use the `appLogger` instance (which currently has `initialLogLevel`).
      // Its own logs during loading will thus adhere to `initialLogLevel`.
      const loggerConfigLoader = new LoggerConfigLoader({ logger: logger });

      // This log message from containerConfig itself will use the `initialLogLevel`.
      logger.debug(
        '[ContainerConfig] Starting asynchronous load of logger configuration...'
      );

      const loggerConfigResult = await loggerConfigLoader.loadConfig(); // loadConfig() is defined in LoggerConfigLoader

      if (
        loggerConfigResult &&
        !loggerConfigResult.error &&
        loggerConfigResult.logLevel !== undefined
      ) {
        if (typeof loggerConfigResult.logLevel === 'string') {
          // Log before changing level (will use current level)
          logger.debug(
            `[ContainerConfig] Logger configuration loaded successfully. Requested level: '${loggerConfigResult.logLevel}'. Applying...`
          );
          // Update the log level of the existing singleton logger instance
          logger.setLogLevel(loggerConfigResult.logLevel);
          // The setLogLevel method in ConsoleLogger already logs the change if it occurs.
        } else {
          logger.warn(
            `[ContainerConfig] Logger configuration loaded, but 'logLevel' is not a string: ${loggerConfigResult.logLevel}. Retaining current log level.`
          );
        }
      } else if (loggerConfigResult && loggerConfigResult.error) {
        logger.warn(
          `[ContainerConfig] Failed to load logger configuration from '${loggerConfigResult.path || 'default path'}'. Error: ${loggerConfigResult.message}. Stage: ${loggerConfigResult.stage || 'N/A'}. Retaining current log level.`
        );
      } else {
        // This case means the file was loaded but either empty, or logLevel property was missing.
        logger.info(
          '[ContainerConfig] Logger configuration file loaded but no specific logLevel found or file was empty. Retaining current log level.'
        );
      }
    } catch (error) {
      // Catch any unexpected errors during the async loading/processing.
      logger.error(
        '[ContainerConfig] CRITICAL ERROR during asynchronous logger configuration loading:',
        {
          message: error.message,
          stack: error.stack,
          errorObj: error,
        }
      );
      // Log level will remain as `initialLogLevel`.
    }
  })(); // End of self-invoking async function for logger dependencyInjection loading

  // --- Continue with other registrations ---
  // These will use the logger, which might still have its initial log level,
  // or an updated one if the async loading was very fast.
  logger.info(
    '[ContainerConfig] Starting synchronous bundle registration while logger dependencyInjection continues loading in background (if not already done).'
  );

  // --- Registration Order ---
  registerLoaders(container);
  registerInfrastructure(container);
  registerUI(container, {
    outputDiv,
    inputElement,
    titleElement,
    document: doc,
  });
  registerDomainServices(container);
  registerInterpreters(container);
  registerAdapters(container);
  registerCoreSystems(container);
  registerInitializers(container);
  registerRuntime(container);
  registerOrchestration(container);

  logger.info('[ContainerConfig] All core bundles registered.');

  // --- Populate Registries (Post-Registration Steps) ---
  try {
    logger.debug('[ContainerConfig] Populating SystemDataRegistry...'); // This debug log will respect the current log level
    const systemDataRegistry = /** @type {SystemDataRegistry} */ (
      container.resolve(tokens.SystemDataRegistry)
    );

    const gameDataRepo = /** @type {GameDataRepository} */ (
      container.resolve(tokens.IGameDataRepository)
    );
    systemDataRegistry.registerSource('GameDataRepository', gameDataRepo);
    logger.info(
      `[ContainerConfig] Data source 'GameDataRepository' registered in SystemDataRegistry.`
    );

    const worldContextInstance = /** @type {WorldContext} */ (
      container.resolve(tokens.IWorldContext)
    );
    const worldContextKey = 'WorldContext';
    logger.debug(
      `[ContainerConfig] Registering data source '${worldContextKey}' in SystemDataRegistry...`
    );
    systemDataRegistry.registerSource(worldContextKey, worldContextInstance);
    logger.info(
      `[ContainerConfig] Data source '${worldContextKey}' successfully registered in SystemDataRegistry.`
    );

    const perceptionUpdateServiceInstance =
      /** @type {PerceptionUpdateService} */ (
        container.resolve(tokens.PerceptionUpdateService)
      );
    const perceptionUpdateServiceKey = 'PerceptionUpdateService';
    logger.debug(
      `[ContainerConfig] Registering data source '${perceptionUpdateServiceKey}' in SystemDataRegistry...`
    );
    systemDataRegistry.registerSource(
      perceptionUpdateServiceKey,
      perceptionUpdateServiceInstance
    );
    logger.info(
      `[ContainerConfig] Data source '${perceptionUpdateServiceKey}' successfully registered in SystemDataRegistry.`
    );
  } catch (error) {
    logger.error(
      '[ContainerConfig] CRITICAL ERROR during SystemDataRegistry population:',
      {
        message: error.message,
        stack: error.stack,
        errorObj: error,
      }
    );
    throw new Error(`Failed to populate SystemDataRegistry: ${error.message}`, {
      cause: error,
    });
  }

  logger.info(
    '[ContainerConfig] Configuration and registry population complete.'
  );
}

// --- FILE END ---
