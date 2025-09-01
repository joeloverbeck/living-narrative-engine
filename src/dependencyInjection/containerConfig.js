// src/dependencyInjection/containerConfig.js

// --- Import DI tokens & helpers ---
import { tokens } from './tokens.js';
import { Registrar } from '../utils/registrarHelpers.js';

// --- Import Logger ---
import ConsoleLogger, { LogLevel } from '../logging/consoleLogger.js';
import LoggerStrategy from '../logging/loggerStrategy.js';

// --- Import Logger Config Utility ---
import {
  loadAndApplyLoggerConfig,
  loadDebugLogConfig,
} from '../configuration/utils/loggerConfigUtils.js';

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
  try {
    // eslint-disable-next-line no-console
    console.debug('[ContainerConfig] Starting container configuration...');

    const registrar = new Registrar(container);
    const { outputDiv, inputElement, titleElement, document: doc } = uiElements;

    // Log initial state - container should be empty at this point
    // eslint-disable-next-line no-console
    console.debug(
      '[ContainerConfig] Container is empty:',
      !container.isRegistered || typeof container.isRegistered !== 'function'
    );

    // --- Load debug configuration before creating LoggerStrategy ---
    // This allows LoggerStrategy to use the configuration in its constructor
    let debugConfig = null;
    try {
      // Create a temporary console logger for loading config
      const tempLogger = new ConsoleLogger(LogLevel.INFO);
      debugConfig = await loadDebugLogConfig(tempLogger, null);
      if (debugConfig) {
        tempLogger.debug(
          '[ContainerConfig] Debug configuration loaded before LoggerStrategy creation.'
        );
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(
        '[ContainerConfig] Failed to load debug configuration:',
        error
      );
    }

    // --- Bootstrap logger with LoggerStrategy ---
    // The LoggerStrategy will handle mode detection and logger selection
    const appLogger = new LoggerStrategy({
      mode: 'development', // Force development mode to ensure HybridLogger with CriticalLogNotifier support
      config: debugConfig || {}, // Pass the loaded debug config or empty object
      dependencies: {
        consoleLogger: new ConsoleLogger(LogLevel.INFO),
      },
    });
    registrar.instance(tokens.ILogger, appLogger);

    // Verify logger registration
    // eslint-disable-next-line no-console
    console.debug(
      '[ContainerConfig] Logger registered:',
      container.isRegistered(tokens.ILogger)
    );

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
    // eslint-disable-next-line no-console
    console.debug('[ContainerConfig] Starting base container configuration...');

    try {
      await configureBaseContainer(container, {
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

      // eslint-disable-next-line no-console
      console.debug(
        '[ContainerConfig] Base container configuration completed.'
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        '[ContainerConfig] Base container configuration failed:',
        error
      );
      throw error;
    }

    // Verify key services are registered
    const keyServices = [
      tokens.IEntityManager,
      tokens.IDataRegistry,
      tokens.ISchemaValidator,
    ];
    keyServices.forEach((service) => {
      const isRegistered = container.isRegistered(service);
      // eslint-disable-next-line no-console
      console.debug(
        `[ContainerConfig] Service ${String(service)} registered:`,
        isRegistered
      );
      if (!isRegistered) {
        throw new Error(
          `[ContainerConfig] Critical service ${String(service)} was not registered`
        );
      }
    });

    logger.debug('[ContainerConfig] All core bundles registered.');

    // --- Load logger configuration asynchronously ---
    await loadAndApplyLoggerConfig(
      container,
      logger,
      tokens,
      'ContainerConfig'
    );

    // --- Load trace configuration asynchronously ---
    await loadAndApplyTraceConfig(container, logger, tokens, 'ContainerConfig');

    logger.debug(
      '[ContainerConfig] Configuration and registry population complete.'
    );

    // Final validation
    // eslint-disable-next-line no-console
    console.debug(
      '[ContainerConfig] Container configuration completed successfully.'
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[ContainerConfig] Container configuration failed:', error);
    throw error;
  }
}
