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
/** @typedef {import('../data/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../context/worldContext.js').default} WorldContext */

// --- Import registration bundle functions ---
import { registerLoaders } from './registrations/loadersRegistrations.js';
import { registerInfrastructure } from './registrations/infrastructureRegistrations.js';
import { registerPersistence } from './registrations/persistenceRegistrations.js';
import { registerWorldAndEntity } from './registrations/worldAndEntityRegistrations.js';
import { registerCommandAndAction } from './registrations/commandAndActionRegistrations.js';
import { registerInterpreters } from './registrations/interpreterRegistrations.js';
import { registerAI } from './registrations/aiRegistrations.js';
import { registerTurnLifecycle } from './registrations/turnLifecycleRegistrations.js';
import { registerEventBusAdapters } from './registrations/eventBusAdapterRegistrations.js';
import { registerUI } from './registrations/uiRegistrations.js';
import { registerInitializers } from './registrations/initializerRegistrations.js';
import { registerRuntime } from './registrations/runtimeRegistrations.js';
import { registerOrchestration } from './registrations/orchestrationRegistrations.js';

/** @typedef {import('./appContainer.js').default} AppContainer */
/** @typedef {import('../bootstrapper/UIBootstrapper.js').EssentialUIElements} EssentialUIElements */

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
  const initialLogLevel = LogLevel.INFO;
  const appLogger = new ConsoleLogger(initialLogLevel);
  registrar.instance(tokens.ILogger, appLogger);

  const logger = /** @type {ConsoleLogger} */ (
    container.resolve(tokens.ILogger)
  );
  logger.debug(
    `[ContainerConfig] Initial logger registered with level: ${initialLogLevel}. Attempting to load remote logger configuration...`
  );

  // --- Asynchronously load logger configuration and update level ---
  (async () => {
    try {
      const loggerConfigLoader = new LoggerConfigLoader({
        logger: logger,
        safeEventDispatcher: container.resolve(tokens.ISafeEventDispatcher),
      });
      logger.debug(
        '[ContainerConfig] Starting asynchronous load of logger configuration...'
      );
      const loggerConfigResult = await loggerConfigLoader.loadConfig();

      if (
        loggerConfigResult &&
        !loggerConfigResult.error &&
        loggerConfigResult.logLevel !== undefined
      ) {
        if (typeof loggerConfigResult.logLevel === 'string') {
          logger.debug(
            `[ContainerConfig] Logger configuration loaded successfully. Requested level: '${loggerConfigResult.logLevel}'. Applying...`
          );
          logger.setLogLevel(loggerConfigResult.logLevel);
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
        logger.debug(
          '[ContainerConfig] Logger configuration file loaded but no specific logLevel found or file was empty. Retaining current log level.'
        );
      }
    } catch (error) {
      logger.error(
        '[ContainerConfig] CRITICAL ERROR during asynchronous logger configuration loading:',
        {
          message: error.message,
          stack: error.stack,
          errorObj: error,
        }
      );
    }
  })();

  logger.debug(
    '[ContainerConfig] Starting synchronous bundle registration while logger dependencyInjection continues loading in background (if not already done).'
  );

  // --- Registration Order ---
  // The order is critical to ensure dependencies are available when needed.
  // 1. Foundational loaders and infrastructure.
  // 2. Core domain services, broken into logical areas.
  // 3. High-level systems (AI, turns) that depend on the core services.
  // 4. UI and application orchestration services at the top.

  registerLoaders(container);
  registerInfrastructure(container);
  registerPersistence(container);
  registerWorldAndEntity(container);
  registerCommandAndAction(container);
  registerInterpreters(container);
  registerAI(container);
  registerTurnLifecycle(container);
  registerEventBusAdapters(container);
  registerUI(container, {
    outputDiv,
    inputElement,
    titleElement,
    document: doc,
  });
  registerInitializers(container);
  registerRuntime(container);
  registerOrchestration(container);

  logger.debug('[ContainerConfig] All core bundles registered.');

  logger.debug(
    '[ContainerConfig] Configuration and registry population complete.'
  );
}
