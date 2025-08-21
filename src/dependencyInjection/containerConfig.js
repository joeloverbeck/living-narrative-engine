// src/dependencyInjection/containerConfig.js

// --- Import DI tokens & helpers ---
import { tokens } from './tokens.js';
import { Registrar } from '../utils/registrarHelpers.js';

// --- Import Logger ---
import ConsoleLogger, { LogLevel } from '../logging/consoleLogger.js';
import LoggerStrategy from '../logging/loggerStrategy.js';

// --- Import Logger Config Utility ---
import { loadAndApplyLoggerConfig } from '../configuration/utils/loggerConfigUtils.js';

// --- Import Trace Config Utility ---
import { loadAndApplyTraceConfig } from '../configuration/utils/traceConfigUtils.js';

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
export async function configureContainer(container, uiElements) {
  const registrar = new Registrar(container);
  const { outputDiv, inputElement, titleElement, document: doc } = uiElements;

  // --- Bootstrap logger with LoggerStrategy ---
  // The LoggerStrategy will handle mode detection and logger selection
  const appLogger = new LoggerStrategy({
    dependencies: {
      consoleLogger: new ConsoleLogger(LogLevel.INFO),
    },
  });
  registrar.instance(tokens.ILogger, appLogger);

  const logger = /** @type {LoggerStrategy} */ (
    container.resolve(tokens.ILogger)
  );
  logger.debug(
    `[ContainerConfig] Initial logger registered with mode: ${logger.getMode()}. Attempting to load remote logger configuration...`
  );

  logger.debug(
    '[ContainerConfig] Starting synchronous bundle registration while logger dependencyInjection continues loading in background (if not already done).'
  );

  // --- Configure container with base configuration ---
  // The base configuration handles registration order and dependencies
  configureBaseContainer(container, {
    includeGameSystems: true,
    includeUI: true,
    includeCharacterBuilder: true,
    uiElements: {
      outputDiv,
      inputElement,
      titleElement,
      document: doc,
    },
    logger: logger,
  });

  logger.debug('[ContainerConfig] All core bundles registered.');

  // --- Load logger configuration asynchronously ---
  await loadAndApplyLoggerConfig(container, logger, tokens, 'ContainerConfig');

  // --- Load trace configuration asynchronously ---
  await loadAndApplyTraceConfig(container, logger, tokens, 'ContainerConfig');

  logger.debug(
    '[ContainerConfig] Configuration and registry population complete.'
  );
}
