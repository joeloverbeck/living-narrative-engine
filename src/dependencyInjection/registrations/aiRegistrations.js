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
/** @typedef {import('../../llms/llmConfigService.js').LLMConfigService} LLMConfigService_Concrete */
/** @typedef {import('../../utils/placeholderResolverUtils.js').PlaceholderResolver} PlaceholderResolver_Concrete */
/** @typedef {import('../../prompting/assembling/standardElementAssembler.js').StandardElementAssembler} StandardElementAssembler_Concrete */
/** @typedef {import('../../prompting/assembling/perceptionLogAssembler.js').PerceptionLogAssembler} PerceptionLogAssembler_Concrete */
/** @typedef {import('../../prompting/assembling/thoughtsSectionAssembler.js').default} ThoughtsSectionAssembler_Concrete */
/** @typedef {import('../../prompting/assembling/notesSectionAssembler.js').default} NotesSectionAssembler_Concrete */
/** @typedef {import('../../turns/handlers/actorTurnHandler.js').default} ActorTurnHandler_Concrete */
/** @typedef {import('../../llms/LLMStrategyFactory.js').LLMStrategyFactory} LLMStrategyFactory_Concrete */

// --- DI & Helper Imports ---
import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';

// --- LLM Adapter Imports ---
import { ConfigurableLLMAdapter } from '../../turns/adapters/configurableLLMAdapter.js';
import { EnvironmentContext } from '../../llms/environmentContext.js';
import { ClientApiKeyProvider } from '../../llms/clientApiKeyProvider.js';
import { RetryHttpClient } from '../../llms/retryHttpClient.js';
import { LLMStrategyFactory } from '../../llms/LLMStrategyFactory.js';

// --- AI Turn Handler Import ---
import ActorTurnHandler from '../../turns/handlers/actorTurnHandler.js';

// --- Prompting & AI Service Imports ---
import { PromptStaticContentService } from '../../prompting/promptStaticContentService.js';
import { PerceptionLogFormatter } from '../../formatting/perceptionLogFormatter.js';
import { GameStateValidationServiceForPrompting } from '../../validation/gameStateValidationServiceForPrompting.js';
import { HttpConfigurationProvider } from '../../configuration/httpConfigurationProvider.js';
import { LLMConfigService } from '../../llms/llmConfigService.js';
import { PlaceholderResolver } from '../../utils/placeholderResolverUtils.js';
import { StandardElementAssembler } from '../../prompting/assembling/standardElementAssembler.js';
import {
  PERCEPTION_LOG_WRAPPER_KEY,
  PerceptionLogAssembler,
} from '../../prompting/assembling/perceptionLogAssembler.js';
import ThoughtsSectionAssembler, {
  THOUGHTS_WRAPPER_KEY,
} from '../../prompting/assembling/thoughtsSectionAssembler.js';
import NotesSectionAssembler, {
  NOTES_WRAPPER_KEY,
} from '../../prompting/assembling/notesSectionAssembler.js';
import GoalsSectionAssembler, {
  GOALS_WRAPPER_KEY,
} from '../../prompting/assembling/goalsSectionAssembler.js';
import { PromptBuilder } from '../../prompting/promptBuilder.js';
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
import {
  INDEXED_CHOICES_KEY,
  IndexedChoicesAssembler,
} from '../../prompting/assembling/indexedChoicesAssembler.js';
import { AssemblerRegistry } from '../../prompting/assemblerRegistry.js';
import * as ConditionEvaluator from '../../prompting/elementConditionEvaluator.js';
import { LLMChooser } from '../../turns/adapters/llmChooser.js';
import { ActionIndexerAdapter } from '../../turns/adapters/actionIndexerAdapter.js';
import { LLMDecisionProvider } from '../../turns/providers/llmDecisionProvider.js';
import { GoapDecisionProvider } from '../../turns/providers/goapDecisionProvider.js';
import { registerActorAwareStrategy } from './registerActorAwareStrategy.js';

/**
 * Registers AI, LLM, and Prompting services.
 *
 * @param {AppContainer} container - The DI container.
 */
export function registerAI(container) {
  const r = new Registrar(container);
  /** @type {ILogger} */
  const logger = container.resolve(tokens.ILogger);
  logger.debug('AI Systems Registration: Starting...');

  // --- LLM INFRASTRUCTURE & ADAPTER ---

  r.singletonFactory(tokens.IHttpClient, (c) => {
    let dispatcher = null;
    if (c.isRegistered(tokens.ISafeEventDispatcher)) {
      dispatcher = c.resolve(tokens.ISafeEventDispatcher);
    } else if (c.isRegistered(tokens.IValidatedEventDispatcher)) {
      dispatcher = c.resolve(tokens.IValidatedEventDispatcher);
    }
    return new RetryHttpClient({
      logger: c.resolve(tokens.ILogger),
      dispatcher: dispatcher,
    });
  });
  logger.debug(`AI Systems Registration: Registered ${tokens.IHttpClient}.`);

  r.singletonFactory(tokens.LLMAdapter, (c) => {
    logger.debug('AI Systems Registration: Starting LLM Adapter setup...');
    const environmentContext = new EnvironmentContext({
      logger,
      executionEnvironment: 'client',
      projectRootPath: null,
      proxyServerUrl: globalThis.process?.env?.PROXY_URL || undefined,
    });
    const apiKeyProvider = new ClientApiKeyProvider({
      logger,
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    });
    const httpClient = c.resolve(tokens.IHttpClient);
    const llmStrategyFactory = new LLMStrategyFactory({ httpClient, logger });

    const adapterInstance = new ConfigurableLLMAdapter({
      logger: c.resolve(tokens.ILogger),
      environmentContext,
      apiKeyProvider,
      llmStrategyFactory,
    });
    logger.debug(
      `AI Systems Registration: ConfigurableLLMAdapter instance (token: ${tokens.LLMAdapter}) created. Explicit initialization required.`
    );
    return adapterInstance;
  });
  logger.debug(
    `AI Systems Registration: Registered ${tokens.LLMAdapter} factory.`
  );

  // --- PROMPTING ENGINE SERVICES ---

  r.tagged(INITIALIZABLE).singletonFactory(
    tokens.IPromptStaticContentService,
    (c) =>
      new PromptStaticContentService({
        logger: c.resolve(tokens.ILogger),
        promptTextLoader: c.resolve(tokens.PromptTextLoader),
      })
  );
  r.singletonFactory(
    tokens.IPerceptionLogFormatter,
    (c) => new PerceptionLogFormatter({ logger: c.resolve(tokens.ILogger) })
  );
  r.singletonFactory(
    tokens.IGameStateValidationServiceForPrompting,
    (c) =>
      new GameStateValidationServiceForPrompting({
        logger: c.resolve(tokens.ILogger),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      })
  );
  r.singletonFactory(
    tokens.IConfigurationProvider,
    (c) =>
      new HttpConfigurationProvider({
        logger: c.resolve(tokens.ILogger),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      })
  );

  r.singletonFactory(tokens.LLMConfigService, (c) => {
    return new LLMConfigService({
      logger: c.resolve(tokens.ILogger),
      configurationProvider: c.resolve(tokens.IConfigurationProvider),
      configSourceIdentifier: './config/llm-configs.json',
    });
  });

  r.singletonFactory(
    tokens.PlaceholderResolver,
    (c) => new PlaceholderResolver(c.resolve(tokens.ILogger))
  );
  r.singletonFactory(
    tokens.StandardElementAssembler,
    (c) =>
      new StandardElementAssembler({
        logger: c.resolve(tokens.ILogger),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      })
  );
  r.singletonFactory(
    tokens.PerceptionLogAssembler,
    (c) => new PerceptionLogAssembler({ logger: c.resolve(tokens.ILogger) })
  );
  r.singletonFactory(
    tokens.ThoughtsSectionAssembler,
    (c) => new ThoughtsSectionAssembler({ logger: c.resolve(tokens.ILogger) })
  );
  r.singletonFactory(
    tokens.NotesSectionAssembler,
    (c) => new NotesSectionAssembler({ logger: c.resolve(tokens.ILogger) })
  );
  r.singletonFactory(
    tokens.GoalsSectionAssembler,
    (c) => new GoalsSectionAssembler({ logger: c.resolve(tokens.ILogger) })
  );

  r.singletonFactory(
    tokens.IndexedChoicesAssembler,
    (c) => new IndexedChoicesAssembler({ logger: c.resolve(tokens.ILogger) })
  );
  logger.debug(
    `AI Systems Registration: Registered ${tokens.IndexedChoicesAssembler}.`
  );

  r.singletonFactory(tokens.AssemblerRegistry, (c) => {
    const registry = new AssemblerRegistry();
    const standardAssembler = c.resolve(tokens.StandardElementAssembler);

    // List of keys that all use the StandardElementAssembler
    const standardElementKeys = [
      'task_definition',
      'character_persona',
      'portrayal_guidelines',
      'content_policy',
      'world_context',
      'available_actions_info',
      'user_input',
      'final_instructions',
      'assistant_response_prefix',
    ];

    // Register the single standard assembler instance for all applicable keys
    standardElementKeys.forEach((key) =>
      registry.register(key, standardAssembler)
    );
    logger.debug(
      `AssemblerRegistry: Registered StandardElementAssembler for ${standardElementKeys.length} keys.`
    );

    // Register all specialized assemblers
    registry.register(
      PERCEPTION_LOG_WRAPPER_KEY,
      c.resolve(tokens.PerceptionLogAssembler)
    );
    registry.register(
      THOUGHTS_WRAPPER_KEY,
      c.resolve(tokens.ThoughtsSectionAssembler)
    );
    registry.register(
      NOTES_WRAPPER_KEY,
      c.resolve(tokens.NotesSectionAssembler)
    );
    registry.register(
      GOALS_WRAPPER_KEY,
      c.resolve(tokens.GoalsSectionAssembler)
    );
    registry.register(
      INDEXED_CHOICES_KEY,
      c.resolve(tokens.IndexedChoicesAssembler)
    );
    logger.debug('AssemblerRegistry: Registered all specialized assemblers.');

    return registry;
  });

  r.singletonFactory(tokens.IPromptBuilder, (c) => {
    return new PromptBuilder({
      logger: c.resolve(tokens.ILogger),
      llmConfigService: c.resolve(tokens.LLMConfigService),
      placeholderResolver: c.resolve(tokens.PlaceholderResolver),
      assemblerRegistry: c.resolve(tokens.AssemblerRegistry),
      conditionEvaluator: ConditionEvaluator,
    });
  });
  logger.debug(
    `AI Systems Registration: Registered Prompting Engine services, including ${tokens.IPromptBuilder}.`
  );

  // --- AI GAME STATE PROVIDER SERVICES ---

  r.single(tokens.IEntitySummaryProvider, EntitySummaryProvider);
  r.single(tokens.IActorDataExtractor, ActorDataExtractor);
  r.single(tokens.IActorStateProvider, ActorStateProvider);
  r.single(tokens.IPerceptionLogProvider, PerceptionLogProvider);
  r.singletonFactory(
    tokens.IAvailableActionsProvider,
    (c) =>
      new AvailableActionsProvider({
        actionDiscoveryService: c.resolve(tokens.IActionDiscoveryService),
        actionIndexingService: c.resolve(tokens.IActionIndexer),
        entityManager: c.resolve(tokens.IEntityManager),
      })
  );
  r.singletonFactory(tokens.ILocationSummaryProvider, (c) => {
    return new LocationSummaryProvider({
      entityManager: c.resolve(tokens.IEntityManager),
      summaryProvider: c.resolve(tokens.IEntitySummaryProvider),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    });
  });

  r.singletonFactory(tokens.IAIGameStateProvider, (c) => {
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

  // --- AI TURN PIPELINE SERVICES ---

  r.singletonFactory(tokens.IAIPromptContentProvider, (c) => {
    return new AIPromptContentProvider({
      logger: c.resolve(tokens.ILogger),
      promptStaticContentService: c.resolve(tokens.IPromptStaticContentService),
      perceptionLogFormatter: c.resolve(tokens.IPerceptionLogFormatter),
      gameStateValidationService: c.resolve(
        tokens.IGameStateValidationServiceForPrompting
      ),
    });
  });
  r.singletonFactory(
    tokens.ILLMResponseProcessor,
    (c) =>
      new LLMResponseProcessor({
        schemaValidator: c.resolve(tokens.ISchemaValidator),
        logger: c.resolve(tokens.ILogger), // <-- INJECT LOGGER HERE
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      })
  );
  r.singletonFactory(
    tokens.IAIFallbackActionFactory,
    (c) => new AIFallbackActionFactory({ logger: c.resolve(tokens.ILogger) })
  );

  // ─── Indexer (shared singleton) ──────────────────────────────
  r.singletonFactory(
    tokens.IActionIndexer,
    (c) => new ActionIndexerAdapter(c.resolve(tokens.ActionIndexingService))
  );

  r.singletonFactory(tokens.IAIPromptPipeline, (c) => {
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

  // 2) LLM chooser
  r.singletonFactory(
    tokens.ILLMChooser,
    (c) =>
      new LLMChooser({
        promptPipeline: c.resolve(tokens.IAIPromptPipeline),
        llmAdapter: c.resolve(tokens.LLMAdapter),
        responseProcessor: c.resolve(tokens.ILLMResponseProcessor),
        logger: c.resolve(tokens.ILogger),
      })
  );

  r.singletonFactory(
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

  r.singletonFactory(
    tokens.IGoapDecisionProvider,
    (c) =>
      new GoapDecisionProvider({
        logger: c.resolve(tokens.ILogger),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      })
  );
  logger.debug(
    `AI Systems Registration: Registered ${tokens.IGoapDecisionProvider}.`
  );

  registerActorAwareStrategy(container);

  // --- AI TURN HANDLER (MODIFIED) ---

  r.tagged(SHUTDOWNABLE).transientFactory(
    tokens.ActorTurnHandler,
    (c) =>
      new ActorTurnHandler({
        logger: c.resolve(tokens.ILogger),
        turnStateFactory: c.resolve(tokens.ITurnStateFactory),
        turnEndPort: c.resolve(tokens.ITurnEndPort),
        strategyFactory: c.resolve(tokens.TurnStrategyFactory),
        turnContextBuilder: c.resolve(tokens.TurnContextBuilder), // <-- Added
      })
  );
  logger.debug(
    `AI Systems Registration: Registered refactored ${tokens.ActorTurnHandler}.`
  );

  logger.debug('AI Systems Registration: All registrations complete.');
}
