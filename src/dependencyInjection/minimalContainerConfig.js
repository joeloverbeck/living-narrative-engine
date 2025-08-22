// src/dependencyInjection/minimalContainerConfig.js

// --- Import DI tokens & helpers ---
import { tokens } from './tokens.js';
import { Registrar } from '../utils/registrarHelpers.js';

// --- Import Logger ---
import ConsoleLogger, { LogLevel } from '../logging/consoleLogger.js';
import LoggerStrategy from '../logging/loggerStrategy.js';

// --- Import Logger Config Utility ---
import { loadAndApplyLoggerConfig } from '../configuration/utils/loggerConfigUtils.js';

// --- Import Logger Interface for Type Hinting ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

// --- Import base container configuration ---
import { configureBaseContainer } from './baseContainerConfig.js';

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
 * @param {object} [options] - Configuration options
 * @param {boolean} [options.includeCharacterBuilder] - Whether to include character builder services
 */
export async function configureMinimalContainer(container, options = {}) {
  const { includeCharacterBuilder = false } = options;
  const registrar = new Registrar(container);

  // --- Bootstrap logger with LoggerStrategy ---
  // The LoggerStrategy will handle mode detection and logger selection
  // In test mode, we need to ensure ConsoleLogger is used for test visibility
  const loggerMode =
    process.env.NODE_ENV === 'test' && !process.env.DEBUG_LOG_MODE
      ? 'console' // Force console mode in tests for visibility
      : undefined; // Let LoggerStrategy auto-detect in other environments

  const appLogger = new LoggerStrategy({
    mode: loggerMode,
    dependencies: {
      consoleLogger: new ConsoleLogger(LogLevel.INFO),
    },
  });
  registrar.instance(tokens.ILogger, appLogger);

  const logger = /** @type {LoggerStrategy} */ (
    container.resolve(tokens.ILogger)
  );
  logger.debug(
    `[MinimalContainerConfig] Initial logger registered with mode: ${logger.getMode()}.`
  );

  // --- Configure container with base configuration ---
  // Minimal configuration excludes UI but includes anatomy systems for testing
  await configureBaseContainer(container, {
    includeGameSystems: false,
    includeUI: false,
    includeAnatomySystems: true,
    includeCharacterBuilder: includeCharacterBuilder,
    logger: logger,
  });

  logger.debug('[MinimalContainerConfig] All core bundles registered.');

  // --- Load logger configuration asynchronously ---
  await loadAndApplyLoggerConfig(
    container,
    logger,
    tokens,
    'MinimalContainerConfig'
  );

  logger.debug('[MinimalContainerConfig] Minimal configuration complete.');
}
