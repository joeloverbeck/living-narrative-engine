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

/**
 * Registers character builder storage services.
 *
 * @param {Registrar} registrar - The service registrar.
 * @param {ILogger} logger - Logger instance for debug output.
 * @returns {void}
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

  registerCharacterBuilderStorage(registrar, logger);
  registerCharacterBuilderServices(registrar, logger);

  logger.debug('Character Builder Registration: All registrations complete.');
}
