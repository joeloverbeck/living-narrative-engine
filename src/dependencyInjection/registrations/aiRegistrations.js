/* eslint-env node */
/**
 * @file Registers all AI-related services, including the LLM adapter, prompting pipeline, and the ActorTurnHandler.
 * @see src/dependencyInjection/registrations/aiRegistrations.js
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */
/** @typedef {import('../../llms/interfaces/IApiKeyProvider.js').IApiKeyProvider} IApiKeyProvider */
/** @typedef {import('../../llms/interfaces/IHttpClient.js').IHttpClient} IHttpClient */
/** @typedef {import('../../turns/interfaces/ITurnStateFactory.js').ITurnStateFactory} ITurnStateFactory */
/** @typedef {import('../../interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../../turns/ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
/** @typedef {import('../../commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager_Interface} IEntityManager_Interface */
/** @typedef {import('../../interfaces/IActionDiscoveryService.js').IActionDiscoveryService} IActionDiscoveryService_Interface */
/** @typedef {import('../../prompting/promptBuilder.js').PromptBuilder} IPromptBuilder */
/** @typedef {import('../../turns/interfaces/IAIFallbackActionFactory.js').IAIFallbackActionFactory} IAIFallbackActionFactory */
/** @typedef {import('../../turns/interfaces/IAIPlayerStrategyFactory.js').IAIPlayerStrategyFactory} IAIPlayerStrategyFactory */
/** @typedef {import('../../turns/interfaces/ITurnContextFactory.js').ITurnContextFactory} ITurnContextFactory */
/** @typedef {import('../../turns/interfaces/IAIGameStateProvider.js').IAIGameStateProvider} IAIGameStateProvider */
/** @typedef {import('../../prompting/AIPromptContentProvider.js').AIPromptContentProvider} IAIPromptContentProvider */
/** @typedef {import('../../turns/interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor */
/** @typedef {import('../../prompting/interfaces/IAIPromptPipeline.js').IAIPromptPipeline} IAIPromptPipeline_Interface */
/** @typedef {import('../../interfaces/IPromptStaticContentService.js').IPromptStaticContentService} IPromptStaticContentService */
/** @typedef {import('../../interfaces/IPerceptionLogFormatter.js').IPerceptionLogFormatter} IPerceptionLogFormatter */
/** @typedef {import('../../interfaces/IGameStateValidationServiceForPrompting.js').IGameStateValidationServiceForPrompting} IGameStateValidationServiceForPrompting */
/** @typedef {import('../../interfaces/IConfigurationProvider.js').IConfigurationProvider} IConfigurationProvider */
/** @typedef {import('../../prompting/promptTemplateService.js').PromptTemplateService} PromptTemplateService */
/** @typedef {import('../../prompting/promptDataFormatter.js').PromptDataFormatter} PromptDataFormatter */
/** @typedef {import('../../turns/handlers/actorTurnHandler.js').default} ActorTurnHandler_Concrete */
/** @typedef {import('../../llms/LLMStrategyFactory.js').LLMStrategyFactory} LLMStrategyFactory_Concrete */
/** @typedef {import('../../llms/interfaces/ILLMConfigurationManager.js').ILLMConfigurationManager} ILLMConfigurationManager */
/** @typedef {import('../../llms/interfaces/ILLMRequestExecutor.js').ILLMRequestExecutor} ILLMRequestExecutor */
/** @typedef {import('../../llms/interfaces/ILLMErrorMapper.js').ILLMErrorMapper} ILLMErrorMapper */
/** @typedef {import('../../llms/interfaces/ITokenEstimator.js').ITokenEstimator} ITokenEstimator */

// --- DI & Helper Imports ---
import { tokens } from '../tokens.js';
import { Registrar, resolveOptional } from '../../utils/registrarHelpers.js';

// --- LLM Adapter Imports ---
import { ConfigurableLLMAdapter } from '../../turns/adapters/configurableLLMAdapter.js';
import { EnvironmentContext } from '../../llms/environmentContext.js';
import { ClientApiKeyProvider } from '../../llms/clientApiKeyProvider.js';
import { RetryHttpClient } from '../../llms/retryHttpClient.js';
import { LLMStrategyFactory } from '../../llms/LLMStrategyFactory.js';
import strategyRegistry from '../../llms/strategies/strategyRegistry.js';
import { LLMConfigurationManager } from '../../llms/services/llmConfigurationManager.js';
import { LLMRequestExecutor } from '../../llms/services/llmRequestExecutor.js';
import { LLMErrorMapper } from '../../llms/services/llmErrorMapper.js';
import { TokenEstimator } from '../../llms/services/tokenEstimator.js';

// --- AI Turn Handler Import ---
import ActorTurnHandler from '../../turns/handlers/actorTurnHandler.js';

// --- Prompting & AI Service Imports ---
import { PromptStaticContentService } from '../../prompting/promptStaticContentService.js';
import { PerceptionLogFormatter } from '../../formatting/perceptionLogFormatter.js';
import { GameStateValidationServiceForPrompting } from '../../validation/gameStateValidationServiceForPrompting.js';
import { HttpConfigurationProvider } from '../../configuration/httpConfigurationProvider.js';
import { LlmConfigLoader } from '../../llms/services/llmConfigLoader.js';
import { LlmJsonService } from '../../llms/llmJsonService.js';
import { PromptBuilder } from '../../prompting/promptBuilder.js';
import { PromptTemplateService } from '../../prompting/promptTemplateService.js';
import { PromptDataFormatter } from '../../prompting/promptDataFormatter.js';
import { EntitySummaryProvider } from '../../data/providers/entitySummaryProvider.js';
import { ActorDataExtractor } from '../../turns/services/actorDataExtractor.js';
import { ActorStateProvider } from '../../data/providers/actorStateProvider.js';
import { PerceptionLogProvider } from '../../data/providers/perceptionLogProvider.js';
import { AvailableActionsProvider } from '../../data/providers/availableActionsProvider.js';
import { LocationSummaryProvider } from '../../data/providers/locationSummaryProvider.js';
import { AIGameStateProvider } from '../../turns/services/AIGameStateProvider.js';
import { AIPromptContentProvider } from '../../prompting/AIPromptContentProvider.js';
import { LLMResponseProcessor } from '../../turns/services/LLMResponseProcessor.js';
import { AIFallbackActionFactory } from '../../turns/services/AIFallbackActionFactory.js';
import { AIPromptPipeline } from '../../prompting/AIPromptPipeline.js';
import { SHUTDOWNABLE, INITIALIZABLE } from '../tags.js';
import { LLMChooser } from '../../turns/adapters/llmChooser.js';
import { ActionIndexerAdapter } from '../../turns/adapters/actionIndexerAdapter.js';
import { LLMDecisionProvider } from '../../turns/providers/llmDecisionProvider.js';
import { GoapDecisionProvider } from '../../turns/providers/goapDecisionProvider.js';
import { registerActorAwareStrategy } from './registerActorAwareStrategy.js';
import XmlElementBuilder from '../../prompting/xmlElementBuilder.js';
import CharacterDataXmlBuilder from '../../prompting/characterDataXmlBuilder.js';

/**
 * Registers LLM infrastructure and adapter services.
 *
 * @param {Registrar} registrar - The service registrar.
 * @param {ILogger} logger - Logger instance for debug output.
 * @returns {void}
 */
export function registerLlmInfrastructure(registrar, logger) {
  registrar.singletonFactory(tokens.IHttpClient, (c) => {
    const dispatcher =
      resolveOptional(c, tokens.ISafeEventDispatcher) ??
      resolveOptional(c, tokens.IValidatedEventDispatcher);
    return new RetryHttpClient({
      logger: c.resolve(tokens.ILogger),
      dispatcher,
    });
  });
  logger.debug(`AI Systems Registration: Registered ${tokens.IHttpClient}.`);

  registrar.singletonFactory(
    tokens.LlmConfigLoader,
    (c) =>
      new LlmConfigLoader({
        logger: c.resolve(tokens.ILogger),
        schemaValidator: c.resolve(tokens.ISchemaValidator),
        configuration: c.resolve(tokens.IConfiguration),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        dataFetcher: c.resolve(tokens.IDataFetcher),
      })
  );
  logger.debug(
    `AI Systems Registration: Registered ${tokens.LlmConfigLoader}.`
  );

  // Register new modular services
  registrar.singletonFactory(tokens.ILLMConfigurationManager, (c) => {
    return new LLMConfigurationManager({
      logger: c.resolve(tokens.ILogger),
      // initialLlmId will be passed from ConfigurableLLMAdapter if needed
    });
  });
  logger.debug(
    `AI Systems Registration: Registered ${tokens.ILLMConfigurationManager}.`
  );

  registrar.singletonFactory(tokens.ILLMRequestExecutor, (c) => {
    return new LLMRequestExecutor({
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `AI Systems Registration: Registered ${tokens.ILLMRequestExecutor}.`
  );

  registrar.singletonFactory(tokens.ILLMErrorMapper, (c) => {
    return new LLMErrorMapper({
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `AI Systems Registration: Registered ${tokens.ILLMErrorMapper}.`
  );

  registrar.singletonFactory(tokens.ITokenEstimator, (c) => {
    return new TokenEstimator({
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `AI Systems Registration: Registered ${tokens.ITokenEstimator}.`
  );

  registrar.singletonFactory(tokens.LLMAdapter, (c) => {
    logger.debug('AI Systems Registration: Starting LLM Adapter setup...');
    const environmentContext = new EnvironmentContext({
      logger,
      executionEnvironment: 'client',
      projectRootPath: null,
      proxyServerUrl: c.resolve(tokens.ProxyUrl),
    });
    const apiKeyProvider = new ClientApiKeyProvider({
      logger,
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    });
    const httpClient = c.resolve(tokens.IHttpClient);
    const llmStrategyFactory = new LLMStrategyFactory({
      httpClient,
      logger,
      strategyMap: strategyRegistry,
    });

    const adapterInstance = new ConfigurableLLMAdapter({
      logger: c.resolve(tokens.ILogger),
      environmentContext,
      apiKeyProvider,
      llmStrategyFactory,
      configurationManager: c.resolve(tokens.ILLMConfigurationManager),
      requestExecutor: c.resolve(tokens.ILLMRequestExecutor),
      errorMapper: c.resolve(tokens.ILLMErrorMapper),
      tokenEstimator: c.resolve(tokens.ITokenEstimator),
    });
    logger.debug(
      `AI Systems Registration: ConfigurableLLMAdapter instance (token: ${tokens.LLMAdapter}) created. Explicit initialization required.`
    );
    return adapterInstance;
  });
  logger.debug(
    `AI Systems Registration: Registered ${tokens.LLMAdapter} factory.`
  );
}

/**
 * Registers prompting engine related services.
 *
 * @param {Registrar} registrar - The service registrar.
 * @param {ILogger} logger - Logger instance for debug output.
 * @returns {void}
 */
export function registerPromptingEngine(registrar, logger) {
  registrar.tagged(INITIALIZABLE).singletonFactory(
    tokens.IPromptStaticContentService,
    (c) =>
      new PromptStaticContentService({
        logger: c.resolve(tokens.ILogger),
        promptTextLoader: c.resolve(tokens.PromptTextLoader),
      })
  );
  registrar.singletonFactory(
    tokens.IPerceptionLogFormatter,
    (c) => new PerceptionLogFormatter({ logger: c.resolve(tokens.ILogger) })
  );
  registrar.singletonFactory(
    tokens.IGameStateValidationServiceForPrompting,
    (c) =>
      new GameStateValidationServiceForPrompting({
        logger: c.resolve(tokens.ILogger),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      })
  );
  registrar.singletonFactory(
    tokens.IConfigurationProvider,
    (c) =>
      new HttpConfigurationProvider({
        logger: c.resolve(tokens.ILogger),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      })
  );

  registrar.singletonFactory(
    tokens.PromptTemplateService,
    (c) => new PromptTemplateService({ logger: c.resolve(tokens.ILogger) })
  );
  registrar.singletonFactory(
    tokens.PromptDataFormatter,
    (c) => new PromptDataFormatter({ logger: c.resolve(tokens.ILogger) })
  );

  registrar.singletonFactory(
    tokens.XmlElementBuilder,
    () => new XmlElementBuilder()
  );

  registrar.singletonFactory(
    tokens.CharacterDataXmlBuilder,
    (c) =>
      new CharacterDataXmlBuilder({
        logger: c.resolve(tokens.ILogger),
        xmlElementBuilder: c.resolve(tokens.XmlElementBuilder),
      })
  );

  registrar.singletonFactory(tokens.IPromptBuilder, (c) => {
    return new PromptBuilder({
      logger: c.resolve(tokens.ILogger),
      llmConfigService: c.resolve(tokens.ILLMConfigurationManager),
      templateService: c.resolve(tokens.PromptTemplateService),
      dataFormatter: c.resolve(tokens.PromptDataFormatter),
    });
  });
  logger.debug(
    `AI Systems Registration: Registered Prompting Engine services, including ${tokens.IPromptBuilder}.`
  );
}

/**
 * Registers AI game state provider services.
 *
 * @param {Registrar} registrar - The service registrar.
 * @param {ILogger} logger - Logger instance for debug output.
 * @returns {void}
 */
export function registerAIGameStateProviders(registrar, logger) {
  registrar.single(tokens.IEntitySummaryProvider, EntitySummaryProvider);
  registrar.singletonFactory(tokens.IActorDataExtractor, (c) => {
    return new ActorDataExtractor({
      anatomyDescriptionService: c.resolve(tokens.AnatomyDescriptionService),
      entityFinder: c.resolve(tokens.IEntityManager),
    });
  });
  registrar.single(tokens.IActorStateProvider, ActorStateProvider);
  registrar.single(tokens.IPerceptionLogProvider, PerceptionLogProvider);
  registrar.singletonFactory(
    tokens.IAvailableActionsProvider,
    (c) =>
      new AvailableActionsProvider({
        actionDiscoveryService: c.resolve(tokens.IActionDiscoveryService),
        actionIndexingService: c.resolve(tokens.IActionIndexer),
        entityManager: c.resolve(tokens.IEntityManager),
        eventBus: c.resolve(tokens.IEventBus),
        logger: c.resolve(tokens.ILogger),
        serviceSetup: c.resolve(tokens.ServiceSetup),
      })
  );
  registrar.singletonFactory(tokens.ILocationSummaryProvider, (c) => {
    return new LocationSummaryProvider({
      entityManager: c.resolve(tokens.IEntityManager),
      summaryProvider: c.resolve(tokens.IEntitySummaryProvider),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    });
  });

  registrar.singletonFactory(tokens.IAIGameStateProvider, (c) => {
    return new AIGameStateProvider({
      actorStateProvider: c.resolve(tokens.IActorStateProvider),
      actorDataExtractor: c.resolve(tokens.IActorDataExtractor),
      locationSummaryProvider: c.resolve(tokens.ILocationSummaryProvider),
      perceptionLogProvider: c.resolve(tokens.IPerceptionLogProvider),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    });
  });
  logger.debug(
    `AI Systems Registration: Registered AI Game State providers, including ${tokens.IAIGameStateProvider}.`
  );
}

/**
 * Registers the AI turn pipeline and decision providers.
 *
 * @param {Registrar} registrar - The service registrar.
 * @param {ILogger} logger - Logger instance for debug output.
 * @returns {void}
 */
export function registerAITurnPipeline(registrar, logger) {
  registrar.singletonFactory(tokens.IAIPromptContentProvider, (c) => {
    return new AIPromptContentProvider({
      logger: c.resolve(tokens.ILogger),
      promptStaticContentService: c.resolve(tokens.IPromptStaticContentService),
      perceptionLogFormatter: c.resolve(tokens.IPerceptionLogFormatter),
      gameStateValidationService: c.resolve(
        tokens.IGameStateValidationServiceForPrompting
      ),
      actionCategorizationService: c.resolve(
        tokens.IActionCategorizationService
      ),
    });
  });
  registrar.singletonFactory(tokens.LlmJsonService, () => new LlmJsonService());
  registrar.singletonFactory(
    tokens.ILLMResponseProcessor,
    (c) =>
      new LLMResponseProcessor({
        schemaValidator: c.resolve(tokens.ISchemaValidator),
        logger: c.resolve(tokens.ILogger),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        llmJsonService: c.resolve(tokens.LlmJsonService),
      })
  );
  registrar.singletonFactory(
    tokens.IAIFallbackActionFactory,
    (c) => new AIFallbackActionFactory({ logger: c.resolve(tokens.ILogger) })
  );

  registrar.singletonFactory(
    tokens.IActionIndexer,
    (c) => new ActionIndexerAdapter(c.resolve(tokens.ActionIndexingService))
  );

  registrar.singletonFactory(tokens.IAIPromptPipeline, (c) => {
    return new AIPromptPipeline({
      llmAdapter: c.resolve(tokens.LLMAdapter),
      gameStateProvider: c.resolve(tokens.IAIGameStateProvider),
      promptContentProvider: c.resolve(tokens.IAIPromptContentProvider),
      promptBuilder: c.resolve(tokens.IPromptBuilder),
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `AI Systems Registration: Registered AI Turn Pipeline services, including ${tokens.IAIPromptPipeline}.`
  );

  registrar.singletonFactory(
    tokens.ILLMChooser,
    (c) =>
      new LLMChooser({
        promptPipeline: c.resolve(tokens.IAIPromptPipeline),
        llmAdapter: c.resolve(tokens.LLMAdapter),
        responseProcessor: c.resolve(tokens.ILLMResponseProcessor),
        logger: c.resolve(tokens.ILogger),
      })
  );

  registrar.singletonFactory(
    tokens.ILLMDecisionProvider,
    (c) =>
      new LLMDecisionProvider({
        llmChooser: c.resolve(tokens.ILLMChooser),
        logger: c.resolve(tokens.ILogger),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      })
  );
  logger.debug(
    `AI Systems Registration: Registered ${tokens.ILLMDecisionProvider}.`
  );

  registrar.singletonFactory(tokens.IGoapDecisionProvider, (c) => {
    return new GoapDecisionProvider({
      goapController: c.resolve(tokens.IGoapController),
      logger: c.resolve(tokens.ILogger),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    });
  });
  logger.debug(
    `AI Systems Registration: Registered ${tokens.IGoapDecisionProvider}.`
  );
}

/**
 * Registers the AI turn handler.
 *
 * @param {Registrar} registrar - The service registrar.
 * @param {ILogger} logger - Logger instance for debug output.
 * @returns {void}
 */
export function registerAITurnHandler(registrar, logger) {
  registrar.tagged(SHUTDOWNABLE).transientFactory(
    tokens.ActorTurnHandler,
    (c) =>
      new ActorTurnHandler({
        logger: c.resolve(tokens.ILogger),
        turnStateFactory: c.resolve(tokens.ITurnStateFactory),
        turnEndPort: c.resolve(tokens.ITurnEndPort),
        strategyFactory: c.resolve(tokens.TurnStrategyFactory),
        turnContextBuilder: c.resolve(tokens.TurnContextBuilder),
        container: c,
      })
  );
  logger.debug(
    `AI Systems Registration: Registered refactored ${tokens.ActorTurnHandler}.`
  );
}

/**
 * Registers AI, LLM, and Prompting services.
 *
 * @param {AppContainer} container - The DI container.
 */
export function registerAI(container) {
  const registrar = new Registrar(container);
  /** @type {ILogger} */
  const logger = container.resolve(tokens.ILogger);
  logger.debug('AI Systems Registration: Starting...');

  registerLlmInfrastructure(registrar, logger);
  registerPromptingEngine(registrar, logger);
  registerAIGameStateProviders(registrar, logger);
  registerAITurnPipeline(registrar, logger);
  registerActorAwareStrategy(container);
  registerAITurnHandler(registrar, logger);
  logger.debug('AI Systems Registration: All registrations complete.');
}

/**
 * Registers minimal AI services needed for character builder services.
 * This includes only the essential AI services without full game systems.
 *
 * @param {AppContainer} container - The DI container.
 * @param {ILogger} logger - Logger instance for debug output.
 */
export function registerMinimalAIForCharacterBuilder(container, logger) {
  const registrar = new Registrar(container);
  logger.debug('Minimal AI Registration: Starting for character builder...');

  // Register only the minimal LLM infrastructure needed for character builder
  registerLlmInfrastructure(registrar, logger);

  // Register LlmJsonService which is specifically needed by ThematicDirectionGenerator
  registrar.singletonFactory(tokens.LlmJsonService, () => {
    const service = new LlmJsonService();
    // Add a mock generateContent method for testing
    /* eslint-disable no-undef */
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
      /* eslint-enable no-undef */
      service.generateContent = async () => ({
        thematic_directions: [
          {
            title: 'Test Direction 1',
            description: 'Test description 1',
            themes: ['test1'],
            suggested_traits: ['trait1'],
            potential_conflicts: ['conflict1'],
            narrative_hooks: ['hook1'],
          },
          {
            title: 'Test Direction 2',
            description: 'Test description 2',
            themes: ['test2'],
            suggested_traits: ['trait2'],
            potential_conflicts: ['conflict2'],
            narrative_hooks: ['hook2'],
          },
          {
            title: 'Test Direction 3',
            description: 'Test description 3',
            themes: ['test3'],
            suggested_traits: ['trait3'],
            potential_conflicts: ['conflict3'],
            narrative_hooks: ['hook3'],
          },
        ],
      });
    }
    return service;
  });
  logger.debug(`Minimal AI Registration: Registered ${tokens.LlmJsonService}.`);

  logger.debug('Minimal AI Registration: Complete for character builder.');
}
