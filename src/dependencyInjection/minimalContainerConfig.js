// src/dependencyInjection/minimalContainerConfig.js

// --- Import DI tokens & helpers ---
import { tokens } from './tokens.js';
import { Registrar } from '../utils/registrarHelpers.js';

// --- Import Logger ---
import ConsoleLogger, { LogLevel } from '../logging/consoleLogger.js';

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
  loadAndApplyLoggerConfig(container, logger, tokens, 'MinimalContainerConfig');

  logger.debug('[MinimalContainerConfig] Minimal configuration complete.');
}
