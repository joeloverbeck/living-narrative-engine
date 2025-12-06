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
 * @param {boolean} [options.includeValidationServices] - Whether to include validation services (for CLI tools)
 */
export async function configureMinimalContainer(container, options = {}) {
  const { includeCharacterBuilder = false, includeValidationServices = false } =
    options;
  const registrar = new Registrar(container);

  // --- Bootstrap logger with LoggerStrategy ---
  // The LoggerStrategy will handle mode detection and logger selection
  // In test mode, we need to ensure ConsoleLogger is used for test visibility
  /* global process */
  const loggerMode =
    process.env.NODE_ENV === 'test' && !process.env.DEBUG_LOG_MODE
      ? 'console' // Force console mode in tests for visibility
      : undefined; // Let LoggerStrategy auto-detect in other environments

  const appLogger = new LoggerStrategy({
    mode: loggerMode,
    config: {}, // Empty config object
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

  // --- Register validation services if requested (for CLI tools) ---
  if (includeValidationServices) {
    logger.debug(
      '[MinimalContainerConfig] Registering validation services for CLI environment...'
    );
    await registerValidationServices(container, logger);
  }

  // --- Load logger configuration asynchronously ---
  // Skip config loading in test environments to avoid HTTP requests
  if (process.env.NODE_ENV !== 'test') {
    await loadAndApplyLoggerConfig(
      container,
      logger,
      tokens,
      'MinimalContainerConfig'
    );
  } else {
    logger.debug(
      '[MinimalContainerConfig] Skipping logger config loading in test environment.'
    );
  }

  logger.debug('[MinimalContainerConfig] Minimal configuration complete.');
}

/**
 * Registers validation services needed by CLI tools
 *
 * @param {AppContainer} container
 * @param {ILogger} logger
 */
async function registerValidationServices(container, logger) {
  const registrar = new Registrar(container);

  try {
    // Dynamic imports for CLI validation services (Node.js-only)
    const validationBasePath = '../../cli/validation/';

    // Import ModReferenceExtractor
    const modReferenceExtractorModule = await import(
      validationBasePath + 'modReferenceExtractor.js'
    );
    const ModReferenceExtractor = modReferenceExtractorModule.default;

    // Import ModCrossReferenceValidator
    const modCrossReferenceValidatorModule = await import(
      validationBasePath + 'modCrossReferenceValidator.js'
    );
    const ModCrossReferenceValidator = modCrossReferenceValidatorModule.default;

    // Import ModValidationOrchestrator
    const modValidationOrchestratorModule = await import(
      validationBasePath + 'modValidationOrchestrator.js'
    );
    const ModValidationOrchestrator = modValidationOrchestratorModule.default;

    // Import ViolationReporter (still in src/validation as it doesn't use Node.js core modules)
    const violationReporterModule = await import(
      '../validation/violationReporter.js'
    );
    const ViolationReporter = violationReporterModule.default;

    // Import ModDependencyValidator
    const modDependencyValidatorModule = await import(
      '../modding/modDependencyValidator.js'
    );
    const ModDependencyValidator = modDependencyValidatorModule.default;

    // Register ModReferenceExtractor
    registrar.singletonFactory(
      tokens.IModReferenceExtractor,
      (c) =>
        new ModReferenceExtractor({
          logger: c.resolve(tokens.ILogger),
          ajvValidator: c.resolve(tokens.ISchemaValidator),
        })
    );

    // Register ModCrossReferenceValidator
    registrar.singletonFactory(
      tokens.IModCrossReferenceValidator,
      (c) =>
        new ModCrossReferenceValidator({
          logger: c.resolve(tokens.ILogger),
          modDependencyValidator: ModDependencyValidator,
          referenceExtractor: c.resolve(tokens.IModReferenceExtractor),
        })
    );

    // Register ModValidationOrchestrator
    registrar.singletonFactory(
      tokens.IModValidationOrchestrator,
      (c) =>
        new ModValidationOrchestrator({
          logger: c.resolve(tokens.ILogger),
          modDependencyValidator: ModDependencyValidator,
          modCrossReferenceValidator: c.resolve(
            tokens.IModCrossReferenceValidator
          ),
          modLoadOrderResolver: c.resolve(tokens.ModLoadOrderResolver),
          modManifestLoader: c.resolve(tokens.ModManifestLoader),
          pathResolver: c.resolve(tokens.IPathResolver),
          configuration: c.resolve(tokens.IConfiguration),
        })
    );

    // Register ViolationReporter
    registrar.singletonFactory(
      tokens.IViolationReporter,
      (c) =>
        new ViolationReporter({
          logger: c.resolve(tokens.ILogger),
        })
    );

    logger.debug(
      '[MinimalContainerConfig] Validation services registered successfully'
    );
  } catch (error) {
    logger.error(
      '[MinimalContainerConfig] Failed to register validation services:',
      error
    );
    throw error;
  }
}
