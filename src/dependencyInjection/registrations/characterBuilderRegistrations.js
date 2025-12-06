/**
 * @file Character Builder dependency injection registrations
 * @description Registers character builder services with unified LLM infrastructure
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

// --- DI & Helper Imports ---
import { tokens } from '../tokens.js';
import { actionTracingTokens } from '../tokens/actionTracingTokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';

// --- Character Builder Service Imports ---
import { CharacterDatabase } from '../../characterBuilder/storage/characterDatabase.js';
import { CharacterStorageService } from '../../characterBuilder/services/characterStorageService.js';
import { ThematicDirectionGenerator } from '../../characterBuilder/services/thematicDirectionGenerator.js';
import { ClicheGenerator } from '../../characterBuilder/services/ClicheGenerator.js';
import { CoreMotivationsGenerator } from '../../characterBuilder/services/CoreMotivationsGenerator.js';
import { CoreMotivationsDisplayEnhancer } from '../../coreMotivationsGenerator/services/CoreMotivationsDisplayEnhancer.js';
import { TraitsGenerator } from '../../characterBuilder/services/TraitsGenerator.js';
import { TraitsDisplayEnhancer } from '../../characterBuilder/services/TraitsDisplayEnhancer.js';
import { SpeechPatternsGenerator } from '../../characterBuilder/services/SpeechPatternsGenerator.js';
import { SpeechPatternsDisplayEnhancer } from '../../characterBuilder/services/SpeechPatternsDisplayEnhancer.js';
import { SpeechPatternsResponseProcessor } from '../../characterBuilder/services/SpeechPatternsResponseProcessor.js';
import { TraitsRewriterGenerator } from '../../characterBuilder/services/TraitsRewriterGenerator.js';
import { TraitsRewriterResponseProcessor } from '../../characterBuilder/services/TraitsRewriterResponseProcessor.js';
import { TraitsRewriterDisplayEnhancer } from '../../characterBuilder/services/TraitsRewriterDisplayEnhancer.js';
import { CharacterBuilderService } from '../../characterBuilder/services/characterBuilderService.js';
import { DOMElementManager } from '../../characterBuilder/services/domElementManager.js';
import { EventListenerRegistry } from '../../characterBuilder/services/eventListenerRegistry.js';
import { ControllerLifecycleOrchestrator } from '../../characterBuilder/services/controllerLifecycleOrchestrator.js';
import { ErrorHandlingStrategy } from '../../characterBuilder/services/errorHandlingStrategy.js';
import { AsyncUtilitiesToolkit } from '../../characterBuilder/services/asyncUtilitiesToolkit.js';
import { PerformanceMonitor } from '../../characterBuilder/services/performanceMonitor.js';
import { ValidationService } from '../../characterBuilder/services/validationService.js';
import { MemoryManager } from '../../characterBuilder/services/memoryManager.js';

const CHARACTER_BUILDER_ERROR_CATEGORIES = Object.freeze({
  VALIDATION: 'validation',
  NETWORK: 'network',
  SYSTEM: 'system',
  USER: 'user',
  PERMISSION: 'permission',
  NOT_FOUND: 'not_found',
});

const CHARACTER_BUILDER_ERROR_SEVERITY = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
});

/**
 * Registers character builder storage services.
 *
 * @param {Registrar} registrar - The service registrar.
 * @param {ILogger} logger - Logger instance for debug output.
 * @returns {void}
 */
function registerCharacterBuilderInfrastructure(registrar, logger) {
  registrar.singletonFactory(tokens.AsyncUtilitiesToolkit, (c) => {
    const asyncConfig = getAsyncToolkitConfig();
    return new AsyncUtilitiesToolkit({
      logger: c.resolve(tokens.ILogger),
      defaultWait: asyncConfig.defaultWait,
      instrumentation: { logTimerEvents: asyncConfig.logTimerEvents },
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.AsyncUtilitiesToolkit}.`
  );

  registrar.singletonFactory(tokens.DOMElementManager, (c) => {
    const documentRef =
      typeof document !== 'undefined' ? document : getDocumentFallback();
    const performanceRef =
      typeof performance !== 'undefined'
        ? performance
        : getPerformanceFallback();

    return new DOMElementManager({
      logger: c.resolve(tokens.ILogger),
      documentRef,
      performanceRef,
      contextName: 'CharacterBuilderDOMElementManager',
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.DOMElementManager}.`
  );

  registrar.singletonFactory(tokens.EventListenerRegistry, (c) => {
    return new EventListenerRegistry({
      logger: c.resolve(tokens.ILogger),
      asyncUtilities: c.resolve(tokens.AsyncUtilitiesToolkit),
      contextName: 'CharacterBuilderEventListenerRegistry',
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.EventListenerRegistry}.`
  );

  registrar.singletonFactory(tokens.ControllerLifecycleOrchestrator, (c) => {
    return new ControllerLifecycleOrchestrator({
      logger: c.resolve(tokens.ILogger),
      eventBus: c.resolve(tokens.ISafeEventDispatcher),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.ControllerLifecycleOrchestrator}.`
  );

  registrar.singletonFactory(tokens.ErrorHandlingStrategy, (c) => {
    return new ErrorHandlingStrategy({
      logger: c.resolve(tokens.ILogger),
      eventBus: c.resolve(tokens.ISafeEventDispatcher),
      controllerName: 'BaseCharacterBuilderController',
      errorCategories: CHARACTER_BUILDER_ERROR_CATEGORIES,
      errorSeverity: CHARACTER_BUILDER_ERROR_SEVERITY,
      recoveryHandlers: {},
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.ErrorHandlingStrategy}.`
  );

  registrar.singletonFactory(tokens.PerformanceMonitor, (c) => {
    return new PerformanceMonitor({
      logger: c.resolve(tokens.ILogger),
      eventBus: c.resolve(tokens.ISafeEventDispatcher),
      threshold: getPerformanceThreshold(),
      contextName: 'CharacterBuilderPerformanceMonitor',
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.PerformanceMonitor}.`
  );

  registrar.singletonFactory(tokens.ValidationService, (c) => {
    return new ValidationService({
      schemaValidator: c.resolve(tokens.ISchemaValidator),
      logger: c.resolve(tokens.ILogger),
      handleError: () => {},
      errorCategories: CHARACTER_BUILDER_ERROR_CATEGORIES,
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.ValidationService}.`
  );

  registrar.singletonFactory(tokens.MemoryManager, (c) => {
    return new MemoryManager({
      logger: c.resolve(tokens.ILogger),
      contextName: 'CharacterBuilderMemoryManager',
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.MemoryManager}.`
  );
}

/**
 *
 * @param registrar
 * @param logger
 */
function registerCharacterBuilderStorage(registrar, logger) {
  registrar.singletonFactory(tokens.CharacterDatabase, (c) => {
    return new CharacterDatabase({
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.CharacterDatabase}.`
  );

  registrar.singletonFactory(tokens.CharacterStorageService, (c) => {
    return new CharacterStorageService({
      logger: c.resolve(tokens.ILogger),
      database: c.resolve(tokens.CharacterDatabase),
      schemaValidator: c.resolve(tokens.ISchemaValidator),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.CharacterStorageService}.`
  );
}

/**
 * Registers character builder services using unified LLM infrastructure.
 *
 * @param {Registrar} registrar - The service registrar.
 * @param {ILogger} logger - Logger instance for debug output.
 * @returns {void}
 */
function registerCharacterBuilderServices(registrar, logger) {
  registrar.singletonFactory(tokens.ThematicDirectionGenerator, (c) => {
    return new ThematicDirectionGenerator({
      logger: c.resolve(tokens.ILogger),
      llmJsonService: c.resolve(tokens.LlmJsonService),
      llmStrategyFactory: c.resolve(tokens.LLMAdapter), // Use the ConfigurableLLMAdapter
      llmConfigManager: c.resolve(tokens.ILLMConfigurationManager),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.ThematicDirectionGenerator}.`
  );

  registrar.singletonFactory(tokens.ClicheGenerator, (c) => {
    return new ClicheGenerator({
      logger: c.resolve(tokens.ILogger),
      llmJsonService: c.resolve(tokens.LlmJsonService),
      llmStrategyFactory: c.resolve(tokens.LLMAdapter), // Use the ConfigurableLLMAdapter
      llmConfigManager: c.resolve(tokens.ILLMConfigurationManager),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.ClicheGenerator}.`
  );

  registrar.singletonFactory(tokens.CoreMotivationsGenerator, (c) => {
    return new CoreMotivationsGenerator({
      logger: c.resolve(tokens.ILogger),
      llmJsonService: c.resolve(tokens.LlmJsonService),
      llmStrategyFactory: c.resolve(tokens.LLMAdapter), // Use the ConfigurableLLMAdapter
      llmConfigManager: c.resolve(tokens.ILLMConfigurationManager),
      eventBus: c.resolve(tokens.ISafeEventDispatcher),
      tokenEstimator: c.resolve(tokens.ITokenEstimator),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.CoreMotivationsGenerator}.`
  );

  registrar.singletonFactory(tokens.CoreMotivationsDisplayEnhancer, (c) => {
    return new CoreMotivationsDisplayEnhancer({
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.CoreMotivationsDisplayEnhancer}.`
  );

  registrar.singletonFactory(tokens.TraitsGenerator, (c) => {
    return new TraitsGenerator({
      logger: c.resolve(tokens.ILogger),
      llmJsonService: c.resolve(tokens.LlmJsonService),
      llmStrategyFactory: c.resolve(tokens.LLMAdapter), // Use the ConfigurableLLMAdapter
      llmConfigManager: c.resolve(tokens.ILLMConfigurationManager),
      eventBus: c.resolve(tokens.ISafeEventDispatcher),
      tokenEstimator: c.resolve(tokens.ITokenEstimator),
      retryManager: c.resolve(actionTracingTokens.IRetryManager),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.TraitsGenerator}.`
  );

  registrar.singletonFactory(tokens.TraitsDisplayEnhancer, (c) => {
    return new TraitsDisplayEnhancer({
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.TraitsDisplayEnhancer}.`
  );

  // Speech Patterns Services
  registrar.singletonFactory(tokens.SpeechPatternsResponseProcessor, (c) => {
    return new SpeechPatternsResponseProcessor({
      logger: c.resolve(tokens.ILogger),
      llmJsonService: c.resolve(tokens.LlmJsonService),
      schemaValidator: c.resolve(tokens.ISchemaValidator),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.SpeechPatternsResponseProcessor}.`
  );

  registrar.singletonFactory(tokens.SpeechPatternsGenerator, (c) => {
    return new SpeechPatternsGenerator({
      logger: c.resolve(tokens.ILogger),
      llmJsonService: c.resolve(tokens.LlmJsonService),
      llmStrategyFactory: c.resolve(tokens.LLMAdapter), // Use the ConfigurableLLMAdapter
      llmConfigManager: c.resolve(tokens.ILLMConfigurationManager),
      eventBus: c.resolve(tokens.ISafeEventDispatcher),
      tokenEstimator: c.resolve(tokens.ITokenEstimator),
      schemaValidator: c.resolve(tokens.ISchemaValidator),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.SpeechPatternsGenerator}.`
  );

  registrar.singletonFactory(tokens.SpeechPatternsDisplayEnhancer, (c) => {
    return new SpeechPatternsDisplayEnhancer({
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.SpeechPatternsDisplayEnhancer}.`
  );

  // Traits Rewriter Services
  registrar.singletonFactory(tokens.TraitsRewriterGenerator, (c) => {
    return new TraitsRewriterGenerator({
      logger: c.resolve(tokens.ILogger),
      llmJsonService: c.resolve(tokens.LlmJsonService),
      llmStrategyFactory: c.resolve(tokens.LLMAdapter),
      llmConfigManager: c.resolve(tokens.ILLMConfigurationManager),
      eventBus: c.resolve(tokens.ISafeEventDispatcher),
      tokenEstimator: c.resolve(tokens.ITokenEstimator),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.TraitsRewriterGenerator}.`
  );

  registrar.singletonFactory(tokens.TraitsRewriterResponseProcessor, (c) => {
    return new TraitsRewriterResponseProcessor({
      logger: c.resolve(tokens.ILogger),
      llmJsonService: c.resolve(tokens.LlmJsonService),
      schemaValidator: c.resolve(tokens.ISchemaValidator),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.TraitsRewriterResponseProcessor}.`
  );

  registrar.singletonFactory(tokens.TraitsRewriterDisplayEnhancer, (c) => {
    return new TraitsRewriterDisplayEnhancer({
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.TraitsRewriterDisplayEnhancer}.`
  );

  registrar.singletonFactory(tokens.CharacterBuilderService, (c) => {
    return new CharacterBuilderService({
      logger: c.resolve(tokens.ILogger),
      storageService: c.resolve(tokens.CharacterStorageService),
      directionGenerator: c.resolve(tokens.ThematicDirectionGenerator),
      eventBus: c.resolve(tokens.ISafeEventDispatcher),
      database: c.resolve(tokens.CharacterDatabase),
      schemaValidator: c.resolve(tokens.ISchemaValidator),
      clicheGenerator: c.resolve(tokens.ClicheGenerator), // Replace null with actual service
      traitsGenerator: c.resolve(tokens.TraitsGenerator), // Traits generator service
      speechPatternsGenerator: c.resolve(tokens.SpeechPatternsGenerator), // Speech patterns generator service
    });
  });

  // Register the interface to resolve to the concrete implementation
  registrar.singletonFactory(tokens.ICharacterBuilderService, (c) => {
    return c.resolve(tokens.CharacterBuilderService);
  });

  logger.debug(
    `Character Builder Registration: Registered ${tokens.CharacterBuilderService} and ${tokens.ICharacterBuilderService}.`
  );
}

/**
 * Registers all character builder services with unified LLM infrastructure.
 *
 * @param {AppContainer} container - The DI container.
 */
export function registerCharacterBuilder(container) {
  const registrar = new Registrar(container);
  /** @type {ILogger} */
  const logger = container.resolve(tokens.ILogger);
  logger.debug('Character Builder Registration: Starting...');

  registerCharacterBuilderInfrastructure(registrar, logger);
  registerCharacterBuilderStorage(registrar, logger);
  registerCharacterBuilderServices(registrar, logger);

  logger.debug('Character Builder Registration: All registrations complete.');
}

/**
 *
 */
function getDocumentFallback() {
  return {
    body: { contains: () => false },
    getElementById: () => null,
    querySelector: () => null,
  };
}

/**
 *
 */
function getPerformanceFallback() {
  return { now: () => Date.now() };
}

/**
 *
 */
function getAsyncToolkitConfig() {
  const defaults = { defaultWait: 100, logTimerEvents: false };

  if (typeof process === 'undefined' || !process?.env) {
    return defaults;
  }

  const parsedWait = Number(process.env.CHARACTER_BUILDER_ASYNC_DEFAULT_WAIT);
  return {
    defaultWait: Number.isFinite(parsedWait)
      ? parsedWait
      : defaults.defaultWait,
    logTimerEvents: process.env.CHARACTER_BUILDER_LOG_TIMER_EVENTS === 'true',
  };
}

/**
 *
 */
function getPerformanceThreshold() {
  if (typeof process === 'undefined' || !process?.env) {
    return 200;
  }

  const threshold = Number(process.env.CHARACTER_BUILDER_PERF_THRESHOLD_MS);
  return Number.isFinite(threshold) && threshold >= 0 ? threshold : 200;
}
