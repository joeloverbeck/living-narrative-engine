// src/dependencyInjection/containerConfig.js

// --- Import DI tokens & helpers ---
import { tokens } from './tokens.js';
import { Registrar } from '../utils/registrarHelpers.js';

// --- Import Logger ---
import ConsoleLogger, { LogLevel } from '../logging/consoleLogger.js';

// --- Import Logger Config Utility ---
import { loadAndApplyLoggerConfig } from '../configuration/utils/loggerConfigUtils.js';

// --- Import Logger Interface for Type Hinting ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
// --- Import necessary types for registry population ---
/** @typedef {import('../data/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../context/worldContext.js').default} WorldContext */

// --- Import base container configuration ---
import { configureBaseContainer } from './baseContainerConfig.js';

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

  logger.debug(
    '[ContainerConfig] Starting synchronous bundle registration while logger dependencyInjection continues loading in background (if not already done).'
  );

  // --- Configure container with base configuration ---
  // The base configuration handles registration order and dependencies
  configureBaseContainer(container, {
    includeGameSystems: true,
    includeUI: true,
    uiElements: {
      outputDiv,
      inputElement,
      titleElement,
      document: doc
    },
    logger: logger
  });

  logger.debug('[ContainerConfig] All core bundles registered.');

  // --- Load logger configuration asynchronously ---
  // This is intentionally fire-and-forget during container setup.
  loadAndApplyLoggerConfig(container, logger, tokens, 'ContainerConfig');

  logger.debug(
    '[ContainerConfig] Configuration and registry population complete.'
  );
}

