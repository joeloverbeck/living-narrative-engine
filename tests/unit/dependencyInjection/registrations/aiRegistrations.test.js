import { jest, describe, it, expect, beforeEach } from '@jest/globals';

/**
 *
 * @param name
 */
function mockCreateClass(name) {
  return jest.fn().mockImplementation(function MockedClass(args) {
    this.__mockName = name;
    this.args = args;
  });
}

jest.mock('../../../../src/llms/retryHttpClient.js', () => ({
  __esModule: true,
  RetryHttpClient: mockCreateClass('RetryHttpClient'),
}));

jest.mock('../../../../src/turns/adapters/configurableLLMAdapter.js', () => ({
  __esModule: true,
  ConfigurableLLMAdapter: mockCreateClass('ConfigurableLLMAdapter'),
}));

jest.mock('../../../../src/llms/environmentContext.js', () => ({
  __esModule: true,
  EnvironmentContext: mockCreateClass('EnvironmentContext'),
}));

jest.mock('../../../../src/llms/clientApiKeyProvider.js', () => ({
  __esModule: true,
  ClientApiKeyProvider: mockCreateClass('ClientApiKeyProvider'),
}));

jest.mock('../../../../src/llms/LLMStrategyFactory.js', () => ({
  __esModule: true,
  LLMStrategyFactory: mockCreateClass('LLMStrategyFactory'),
}));

jest.mock('../../../../src/llms/strategies/strategyRegistry.js', () => ({
  __esModule: true,
  default: { strategy: 'registry' },
}));

jest.mock('../../../../src/llms/services/llmConfigurationManager.js', () => ({
  __esModule: true,
  LLMConfigurationManager: mockCreateClass('LLMConfigurationManager'),
}));

jest.mock('../../../../src/llms/services/llmRequestExecutor.js', () => ({
  __esModule: true,
  LLMRequestExecutor: mockCreateClass('LLMRequestExecutor'),
}));

jest.mock('../../../../src/llms/services/llmErrorMapper.js', () => ({
  __esModule: true,
  LLMErrorMapper: mockCreateClass('LLMErrorMapper'),
}));

jest.mock('../../../../src/llms/services/tokenEstimator.js', () => ({
  __esModule: true,
  TokenEstimator: mockCreateClass('TokenEstimator'),
}));

jest.mock('../../../../src/prompting/promptStaticContentService.js', () => ({
  __esModule: true,
  PromptStaticContentService: mockCreateClass('PromptStaticContentService'),
}));

jest.mock('../../../../src/formatting/perceptionLogFormatter.js', () => ({
  __esModule: true,
  PerceptionLogFormatter: mockCreateClass('PerceptionLogFormatter'),
}));

jest.mock('../../../../src/validation/gameStateValidationServiceForPrompting.js', () => ({
  __esModule: true,
  GameStateValidationServiceForPrompting: mockCreateClass(
    'GameStateValidationServiceForPrompting'
  ),
}));

jest.mock('../../../../src/configuration/httpConfigurationProvider.js', () => ({
  __esModule: true,
  HttpConfigurationProvider: mockCreateClass('HttpConfigurationProvider'),
}));

jest.mock('../../../../src/llms/services/llmConfigLoader.js', () => ({
  __esModule: true,
  LlmConfigLoader: mockCreateClass('LlmConfigLoader'),
}));

jest.mock('../../../../src/llms/llmJsonService.js', () => {
  const ctor = jest.fn().mockImplementation(function MockLlmJsonService() {
    this.generateContent = jest.fn();
  });
  return { __esModule: true, LlmJsonService: ctor };
});

jest.mock('../../../../src/prompting/promptBuilder.js', () => ({
  __esModule: true,
  PromptBuilder: mockCreateClass('PromptBuilder'),
}));

jest.mock('../../../../src/prompting/promptTemplateService.js', () => ({
  __esModule: true,
  PromptTemplateService: mockCreateClass('PromptTemplateService'),
}));

jest.mock('../../../../src/prompting/promptDataFormatter.js', () => ({
  __esModule: true,
  PromptDataFormatter: mockCreateClass('PromptDataFormatter'),
}));

jest.mock('../../../../src/prompting/xmlElementBuilder.js', () => ({
  __esModule: true,
  default: mockCreateClass('XmlElementBuilder'),
}));

jest.mock('../../../../src/prompting/characterDataXmlBuilder.js', () => ({
  __esModule: true,
  default: mockCreateClass('CharacterDataXmlBuilder'),
}));

jest.mock('../../../../src/prompting/modActionMetadataProvider.js', () => ({
  __esModule: true,
  ModActionMetadataProvider: mockCreateClass('ModActionMetadataProvider'),
}));

jest.mock('../../../../src/data/providers/entitySummaryProvider.js', () => ({
  __esModule: true,
  EntitySummaryProvider: mockCreateClass('EntitySummaryProvider'),
}));

jest.mock('../../../../src/turns/services/actorDataExtractor.js', () => ({
  __esModule: true,
  ActorDataExtractor: mockCreateClass('ActorDataExtractor'),
}));

jest.mock('../../../../src/data/providers/actorStateProvider.js', () => ({
  __esModule: true,
  ActorStateProvider: mockCreateClass('ActorStateProvider'),
}));

jest.mock('../../../../src/data/providers/perceptionLogProvider.js', () => ({
  __esModule: true,
  PerceptionLogProvider: mockCreateClass('PerceptionLogProvider'),
}));

jest.mock('../../../../src/data/providers/availableActionsProvider.js', () => ({
  __esModule: true,
  AvailableActionsProvider: mockCreateClass('AvailableActionsProvider'),
}));

jest.mock('../../../../src/data/providers/locationSummaryProvider.js', () => ({
  __esModule: true,
  LocationSummaryProvider: mockCreateClass('LocationSummaryProvider'),
}));

jest.mock('../../../../src/turns/services/AIGameStateProvider.js', () => ({
  __esModule: true,
  AIGameStateProvider: mockCreateClass('AIGameStateProvider'),
}));

jest.mock('../../../../src/prompting/AIPromptContentProvider.js', () => ({
  __esModule: true,
  AIPromptContentProvider: mockCreateClass('AIPromptContentProvider'),
}));

jest.mock('../../../../src/turns/services/LLMResponseProcessor.js', () => ({
  __esModule: true,
  LLMResponseProcessor: mockCreateClass('LLMResponseProcessor'),
}));

jest.mock('../../../../src/turns/services/AIFallbackActionFactory.js', () => ({
  __esModule: true,
  AIFallbackActionFactory: mockCreateClass('AIFallbackActionFactory'),
}));

jest.mock('../../../../src/prompting/AIPromptPipeline.js', () => ({
  __esModule: true,
  AIPromptPipeline: mockCreateClass('AIPromptPipeline'),
}));

jest.mock('../../../../src/turns/adapters/llmChooser.js', () => ({
  __esModule: true,
  LLMChooser: mockCreateClass('LLMChooser'),
}));

jest.mock('../../../../src/turns/adapters/actionIndexerAdapter.js', () => ({
  __esModule: true,
  ActionIndexerAdapter: mockCreateClass('ActionIndexerAdapter'),
}));

jest.mock('../../../../src/turns/providers/llmDecisionProvider.js', () => ({
  __esModule: true,
  LLMDecisionProvider: mockCreateClass('LLMDecisionProvider'),
}));

jest.mock('../../../../src/turns/providers/goapDecisionProvider.js', () => ({
  __esModule: true,
  GoapDecisionProvider: mockCreateClass('GoapDecisionProvider'),
}));

jest.mock('../../../../src/turns/handlers/actorTurnHandler.js', () => ({
  __esModule: true,
  default: mockCreateClass('ActorTurnHandler'),
}));

jest.mock('../../../../src/dependencyInjection/registrations/registerActorAwareStrategy.js', () => ({
  __esModule: true,
  registerActorAwareStrategy: jest.fn(),
}));

const { RetryHttpClient: RetryHttpClientMock } = jest.requireMock(
  '../../../../src/llms/retryHttpClient.js'
);
const { ConfigurableLLMAdapter: ConfigurableLLMAdapterMock } = jest.requireMock(
  '../../../../src/turns/adapters/configurableLLMAdapter.js'
);
const { EnvironmentContext: EnvironmentContextMock } = jest.requireMock(
  '../../../../src/llms/environmentContext.js'
);
const { ClientApiKeyProvider: ClientApiKeyProviderMock } = jest.requireMock(
  '../../../../src/llms/clientApiKeyProvider.js'
);
const { LLMStrategyFactory: LLMStrategyFactoryMock } = jest.requireMock(
  '../../../../src/llms/LLMStrategyFactory.js'
);
const { LLMConfigurationManager: LLMConfigurationManagerMock } = jest.requireMock(
  '../../../../src/llms/services/llmConfigurationManager.js'
);
const { LLMRequestExecutor: LLMRequestExecutorMock } = jest.requireMock(
  '../../../../src/llms/services/llmRequestExecutor.js'
);
const { LLMErrorMapper: LLMErrorMapperMock } = jest.requireMock(
  '../../../../src/llms/services/llmErrorMapper.js'
);
const { TokenEstimator: TokenEstimatorMock } = jest.requireMock(
  '../../../../src/llms/services/tokenEstimator.js'
);
const { PromptStaticContentService: PromptStaticContentServiceMock } = jest.requireMock(
  '../../../../src/prompting/promptStaticContentService.js'
);
const { PerceptionLogFormatter: PerceptionLogFormatterMock } = jest.requireMock(
  '../../../../src/formatting/perceptionLogFormatter.js'
);
const {
  GameStateValidationServiceForPrompting: GameStateValidationServiceForPromptingMock,
} = jest.requireMock(
  '../../../../src/validation/gameStateValidationServiceForPrompting.js'
);
const { HttpConfigurationProvider: HttpConfigurationProviderMock } = jest.requireMock(
  '../../../../src/configuration/httpConfigurationProvider.js'
);
const { LlmConfigLoader: LlmConfigLoaderMock } = jest.requireMock(
  '../../../../src/llms/services/llmConfigLoader.js'
);
const { LlmJsonService: LlmJsonServiceMock } = jest.requireMock(
  '../../../../src/llms/llmJsonService.js'
);
const { PromptBuilder: PromptBuilderMock } = jest.requireMock(
  '../../../../src/prompting/promptBuilder.js'
);
const { PromptTemplateService: PromptTemplateServiceMock } = jest.requireMock(
  '../../../../src/prompting/promptTemplateService.js'
);
const { PromptDataFormatter: PromptDataFormatterMock } = jest.requireMock(
  '../../../../src/prompting/promptDataFormatter.js'
);
const XmlElementBuilderMock = jest.requireMock(
  '../../../../src/prompting/xmlElementBuilder.js'
).default;
const CharacterDataXmlBuilderMock = jest.requireMock(
  '../../../../src/prompting/characterDataXmlBuilder.js'
).default;
const { ModActionMetadataProvider: ModActionMetadataProviderMock } = jest.requireMock(
  '../../../../src/prompting/modActionMetadataProvider.js'
);
const { ActorDataExtractor: ActorDataExtractorMock } = jest.requireMock(
  '../../../../src/turns/services/actorDataExtractor.js'
);
const { AvailableActionsProvider: AvailableActionsProviderMock } = jest.requireMock(
  '../../../../src/data/providers/availableActionsProvider.js'
);
const { LocationSummaryProvider: LocationSummaryProviderMock } = jest.requireMock(
  '../../../../src/data/providers/locationSummaryProvider.js'
);
const { AIGameStateProvider: AIGameStateProviderMock } = jest.requireMock(
  '../../../../src/turns/services/AIGameStateProvider.js'
);
const { AIPromptContentProvider: AIPromptContentProviderMock } = jest.requireMock(
  '../../../../src/prompting/AIPromptContentProvider.js'
);
const { LLMResponseProcessor: LLMResponseProcessorMock } = jest.requireMock(
  '../../../../src/turns/services/LLMResponseProcessor.js'
);
const { AIFallbackActionFactory: AIFallbackActionFactoryMock } = jest.requireMock(
  '../../../../src/turns/services/AIFallbackActionFactory.js'
);
const { AIPromptPipeline: AIPromptPipelineMock } = jest.requireMock(
  '../../../../src/prompting/AIPromptPipeline.js'
);
const { LLMChooser: LLMChooserMock } = jest.requireMock(
  '../../../../src/turns/adapters/llmChooser.js'
);
const { ActionIndexerAdapter: ActionIndexerAdapterMock } = jest.requireMock(
  '../../../../src/turns/adapters/actionIndexerAdapter.js'
);
const { LLMDecisionProvider: LLMDecisionProviderMock } = jest.requireMock(
  '../../../../src/turns/providers/llmDecisionProvider.js'
);
const { GoapDecisionProvider: GoapDecisionProviderMock } = jest.requireMock(
  '../../../../src/turns/providers/goapDecisionProvider.js'
);
const ActorTurnHandlerMock = jest.requireMock(
  '../../../../src/turns/handlers/actorTurnHandler.js'
).default;

const { registerActorAwareStrategy } = jest.requireMock(
  '../../../../src/dependencyInjection/registrations/registerActorAwareStrategy.js'
);

import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { INITIALIZABLE, SHUTDOWNABLE } from '../../../../src/dependencyInjection/tags.js';
import { Registrar } from '../../../../src/utils/registrarHelpers.js';
import {
  registerAI,
  registerAITurnHandler,
  registerAITurnPipeline,
  registerAIGameStateProviders,
  registerLlmInfrastructure,
  registerMinimalAIForCharacterBuilder,
  registerPromptingEngine,
} from '../../../../src/dependencyInjection/registrations/aiRegistrations.js';

const createMockContainer = () => ({
  register: jest.fn(),
  resolve: jest.fn(),
  isRegistered: jest.fn(),
});

const createFactoryContext = (map) => ({
  resolve: jest.fn((token) => {
    if (!(token in map)) {
      throw new Error(`Missing dependency for token: ${token}`);
    }
    return map[token];
  }),
  isRegistered: jest.fn((token) => token in map),
});

describe('aiRegistrations', () => {
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = { debug: jest.fn() };
  });

  describe('registerLlmInfrastructure', () => {
    it('registers HTTP client with optional dispatchers and builds configurable adapter', () => {
      const container = createMockContainer();
      const registrar = new Registrar(container);

      registerLlmInfrastructure(registrar, logger);

      const httpCall = container.register.mock.calls.find(
        ([token]) => token === tokens.IHttpClient
      );
      expect(httpCall).toBeDefined();
      const httpFactory = httpCall[1];
      const safeDispatcher = { name: 'safe' };
      const httpContextWithSafe = createFactoryContext({
        [tokens.ILogger]: logger,
        [tokens.ISafeEventDispatcher]: safeDispatcher,
      });
      const httpClientInstance = httpFactory(httpContextWithSafe);
      expect(RetryHttpClientMock).toHaveBeenCalledWith({
        logger,
        dispatcher: safeDispatcher,
      });
      expect(httpClientInstance).toBe(RetryHttpClientMock.mock.instances[0]);

      const validatedDispatcher = { name: 'validated' };
      const httpContextValidated = createFactoryContext({
        [tokens.ILogger]: logger,
        [tokens.IValidatedEventDispatcher]: validatedDispatcher,
      });
      httpFactory(httpContextValidated);
      expect(RetryHttpClientMock).toHaveBeenLastCalledWith({
        logger,
        dispatcher: validatedDispatcher,
      });

      const configLoaderCall = container.register.mock.calls.find(
        ([token]) => token === tokens.LlmConfigLoader
      );
      const configLoaderFactory = configLoaderCall[1];
      const configLoaderContext = createFactoryContext({
        [tokens.ILogger]: logger,
        [tokens.ISchemaValidator]: { validator: true },
        [tokens.IConfiguration]: { configuration: true },
        [tokens.ISafeEventDispatcher]: { dispatcher: true },
        [tokens.IDataFetcher]: { fetcher: true },
      });
      configLoaderFactory(configLoaderContext);
      expect(LlmConfigLoaderMock).toHaveBeenCalledWith({
        logger,
        schemaValidator: { validator: true },
        configuration: { configuration: true },
        safeEventDispatcher: { dispatcher: true },
        dataFetcher: { fetcher: true },
      });

      const managerCall = container.register.mock.calls.find(
        ([token]) => token === tokens.ILLMConfigurationManager
      );
      const managerFactory = managerCall[1];
      managerFactory(createFactoryContext({ [tokens.ILogger]: logger }));
      expect(LLMConfigurationManagerMock).toHaveBeenCalledWith({ logger });

      const executorCall = container.register.mock.calls.find(
        ([token]) => token === tokens.ILLMRequestExecutor
      );
      executorCall[1](createFactoryContext({ [tokens.ILogger]: logger }));
      expect(LLMRequestExecutorMock).toHaveBeenCalledWith({ logger });

      const errorMapperCall = container.register.mock.calls.find(
        ([token]) => token === tokens.ILLMErrorMapper
      );
      errorMapperCall[1](createFactoryContext({ [tokens.ILogger]: logger }));
      expect(LLMErrorMapperMock).toHaveBeenCalledWith({ logger });

      const tokenEstimatorCall = container.register.mock.calls.find(
        ([token]) => token === tokens.ITokenEstimator
      );
      tokenEstimatorCall[1](createFactoryContext({ [tokens.ILogger]: logger }));
      expect(TokenEstimatorMock).toHaveBeenCalledWith({ logger });

      const adapterCall = container.register.mock.calls.find(
        ([token]) => token === tokens.LLMAdapter
      );
      const adapterFactory = adapterCall[1];

      const dependencies = {
        [tokens.ProxyUrl]: 'http://proxy',
        [tokens.ISafeEventDispatcher]: safeDispatcher,
        [tokens.ILogger]: logger,
        [tokens.IHttpClient]: { http: true },
        [tokens.ILLMConfigurationManager]: { manager: true },
        [tokens.ILLMRequestExecutor]: { executor: true },
        [tokens.ILLMErrorMapper]: { mapper: true },
        [tokens.ITokenEstimator]: { estimator: true },
      };
      const adapterContext = createFactoryContext(dependencies);
      const adapterInstance = adapterFactory(adapterContext);

      expect(EnvironmentContextMock).toHaveBeenCalledWith({
        logger,
        executionEnvironment: 'client',
        projectRootPath: null,
        proxyServerUrl: 'http://proxy',
      });
      expect(ClientApiKeyProviderMock).toHaveBeenCalledWith({
        logger,
        safeEventDispatcher: safeDispatcher,
      });
      expect(LLMStrategyFactoryMock).toHaveBeenCalledWith({
        httpClient: dependencies[tokens.IHttpClient],
        logger,
        strategyMap: { strategy: 'registry' },
      });
      expect(ConfigurableLLMAdapterMock).toHaveBeenCalledWith({
        logger,
        environmentContext: EnvironmentContextMock.mock.instances[0],
        apiKeyProvider: ClientApiKeyProviderMock.mock.instances[0],
        llmStrategyFactory: LLMStrategyFactoryMock.mock.instances[0],
        configurationManager: dependencies[tokens.ILLMConfigurationManager],
        requestExecutor: dependencies[tokens.ILLMRequestExecutor],
        errorMapper: dependencies[tokens.ILLMErrorMapper],
        tokenEstimator: dependencies[tokens.ITokenEstimator],
      });
      expect(adapterInstance).toBe(
        ConfigurableLLMAdapterMock.mock.instances[
          ConfigurableLLMAdapterMock.mock.instances.length - 1
        ]
      );
    });
  });

  describe('registerPromptingEngine', () => {
    it('registers prompting services with correct tags and factories', () => {
      const container = createMockContainer();
      const registrar = new Registrar(container);

      registerPromptingEngine(registrar, logger);

      const staticServiceCall = container.register.mock.calls.find(
        ([token]) => token === tokens.IPromptStaticContentService
      );
      expect(staticServiceCall[2]).toMatchObject({
        lifecycle: 'singletonFactory',
        tags: INITIALIZABLE,
      });
      const staticFactory = staticServiceCall[1];
      staticFactory(
        createFactoryContext({
          [tokens.ILogger]: logger,
          [tokens.PromptTextLoader]: { loader: true },
        })
      );
      expect(PromptStaticContentServiceMock).toHaveBeenCalledWith({
        logger,
        promptTextLoader: { loader: true },
      });

      const formatterCall = container.register.mock.calls.find(
        ([token]) => token === tokens.IPerceptionLogFormatter
      );
      formatterCall[1](createFactoryContext({ [tokens.ILogger]: logger }));
      expect(PerceptionLogFormatterMock).toHaveBeenCalledWith({ logger });

      const validationCall = container.register.mock.calls.find(
        ([token]) => token === tokens.IGameStateValidationServiceForPrompting
      );
      validationCall[1](
        createFactoryContext({
          [tokens.ILogger]: logger,
          [tokens.ISafeEventDispatcher]: { dispatcher: true },
        })
      );
      expect(
        GameStateValidationServiceForPromptingMock
      ).toHaveBeenCalledWith({
        logger,
        safeEventDispatcher: { dispatcher: true },
      });

      const configurationCall = container.register.mock.calls.find(
        ([token]) => token === tokens.IConfigurationProvider
      );
      configurationCall[1](
        createFactoryContext({
          [tokens.ILogger]: logger,
          [tokens.ISafeEventDispatcher]: { dispatcher: true },
        })
      );
      expect(HttpConfigurationProviderMock).toHaveBeenCalledWith({
        logger,
        safeEventDispatcher: { dispatcher: true },
      });

      const templateCall = container.register.mock.calls.find(
        ([token]) => token === tokens.PromptTemplateService
      );
      templateCall[1](createFactoryContext({ [tokens.ILogger]: logger }));
      expect(PromptTemplateServiceMock).toHaveBeenCalledWith({ logger });

      const formatterDataCall = container.register.mock.calls.find(
        ([token]) => token === tokens.PromptDataFormatter
      );
      formatterDataCall[1](createFactoryContext({ [tokens.ILogger]: logger }));
      expect(PromptDataFormatterMock).toHaveBeenCalledWith({ logger });

      // XmlElementBuilder registration (stateless utility)
      const xmlElementBuilderCall = container.register.mock.calls.find(
        ([token]) => token === tokens.XmlElementBuilder
      );
      expect(xmlElementBuilderCall).toBeDefined();
      const xmlElementInstance = xmlElementBuilderCall[1]();
      expect(XmlElementBuilderMock).toHaveBeenCalled();
      expect(xmlElementInstance).toBe(XmlElementBuilderMock.mock.instances[0]);

      // CharacterDataXmlBuilder registration (with dependencies)
      const characterDataXmlBuilderCall = container.register.mock.calls.find(
        ([token]) => token === tokens.CharacterDataXmlBuilder
      );
      expect(characterDataXmlBuilderCall).toBeDefined();
      const xmlBuilderDependency = { xmlBuilder: true };
      characterDataXmlBuilderCall[1](
        createFactoryContext({
          [tokens.ILogger]: logger,
          [tokens.XmlElementBuilder]: xmlBuilderDependency,
        })
      );
      expect(CharacterDataXmlBuilderMock).toHaveBeenCalledWith({
        logger,
        xmlElementBuilder: xmlBuilderDependency,
      });

      const builderCall = container.register.mock.calls.find(
        ([token]) => token === tokens.IPromptBuilder
      );
      builderCall[1](
        createFactoryContext({
          [tokens.ILogger]: logger,
          [tokens.ILLMConfigurationManager]: { manager: true },
          [tokens.PromptTemplateService]: { template: true },
          [tokens.PromptDataFormatter]: { formatter: true },
        })
      );
      expect(PromptBuilderMock).toHaveBeenCalledWith({
        logger,
        llmConfigService: { manager: true },
        templateService: { template: true },
        dataFormatter: { formatter: true },
      });
    });
  });

  describe('registerAIGameStateProviders', () => {
    it('registers AI state providers and executes factories', () => {
      const container = createMockContainer();
      const registrar = new Registrar(container);

      registerAIGameStateProviders(registrar, logger);

      const actorDataCall = container.register.mock.calls.find(
        ([token]) => token === tokens.IActorDataExtractor
      );
      actorDataCall[1](
        createFactoryContext({
          [tokens.AnatomyDescriptionService]: { anatomy: true },
          [tokens.IEntityManager]: { entityManager: true },
        })
      );
      expect(ActorDataExtractorMock).toHaveBeenCalledWith({
        anatomyDescriptionService: { anatomy: true },
        entityFinder: { entityManager: true },
      });

      const availableActionsCall = container.register.mock.calls.find(
        ([token]) => token === tokens.IAvailableActionsProvider
      );
      availableActionsCall[1](
        createFactoryContext({
          [tokens.IActionDiscoveryService]: { discovery: true },
          [tokens.IActionIndexer]: { indexer: true },
          [tokens.IEntityManager]: { entityManager: true },
          [tokens.IEventBus]: { eventBus: true },
          [tokens.ILogger]: logger,
          [tokens.ServiceSetup]: { setup: true },
        })
      );
      expect(AvailableActionsProviderMock).toHaveBeenCalledWith({
        actionDiscoveryService: { discovery: true },
        actionIndexingService: { indexer: true },
        entityManager: { entityManager: true },
        eventBus: { eventBus: true },
        logger,
        serviceSetup: { setup: true },
      });

      const locationCall = container.register.mock.calls.find(
        ([token]) => token === tokens.ILocationSummaryProvider
      );
      locationCall[1](
        createFactoryContext({
          [tokens.IEntityManager]: { entityManager: true },
          [tokens.IEntitySummaryProvider]: { summary: true },
          [tokens.ISafeEventDispatcher]: { dispatcher: true },
        })
      );
      expect(LocationSummaryProviderMock).toHaveBeenCalledWith({
        entityManager: { entityManager: true },
        summaryProvider: { summary: true },
        safeEventDispatcher: { dispatcher: true },
      });

      const aiGameStateCall = container.register.mock.calls.find(
        ([token]) => token === tokens.IAIGameStateProvider
      );
      aiGameStateCall[1](
        createFactoryContext({
          [tokens.IActorStateProvider]: { actorState: true },
          [tokens.IActorDataExtractor]: { actorData: true },
          [tokens.ILocationSummaryProvider]: { location: true },
          [tokens.IPerceptionLogProvider]: { perception: true },
          [tokens.ISafeEventDispatcher]: { dispatcher: true },
        })
      );
      expect(AIGameStateProviderMock).toHaveBeenCalledWith({
        actorStateProvider: { actorState: true },
        actorDataExtractor: { actorData: true },
        locationSummaryProvider: { location: true },
        perceptionLogProvider: { perception: true },
        safeEventDispatcher: { dispatcher: true },
      });
    });
  });

  describe('registerAITurnPipeline', () => {
    it('registers pipeline services including GOAP decision provider', async () => {
      const container = createMockContainer();
      const registrar = new Registrar(container);

      registerAITurnPipeline(registrar, logger);

      // IModActionMetadataProvider registration
      const metadataProviderCall = container.register.mock.calls.find(
        ([token]) => token === tokens.IModActionMetadataProvider
      );
      expect(metadataProviderCall).toBeDefined();
      metadataProviderCall[1](
        createFactoryContext({
          [tokens.IDataRegistry]: { registry: true },
          [tokens.ILogger]: logger,
        })
      );
      expect(ModActionMetadataProviderMock).toHaveBeenCalledWith({
        dataRegistry: { registry: true },
        logger,
      });

      const contentCall = container.register.mock.calls.find(
        ([token]) => token === tokens.IAIPromptContentProvider
      );
      contentCall[1](
        createFactoryContext({
          [tokens.ILogger]: logger,
          [tokens.IPromptStaticContentService]: { static: true },
          [tokens.IPerceptionLogFormatter]: { formatter: true },
          [tokens.IGameStateValidationServiceForPrompting]: { validation: true },
          [tokens.IActionCategorizationService]: { categorization: true },
          [tokens.CharacterDataXmlBuilder]: { xmlBuilder: true },
          [tokens.IModActionMetadataProvider]: { metadataProvider: true },
        })
      );
      expect(AIPromptContentProviderMock).toHaveBeenCalledWith({
        logger,
        promptStaticContentService: { static: true },
        perceptionLogFormatter: { formatter: true },
        gameStateValidationService: { validation: true },
        actionCategorizationService: { categorization: true },
        characterDataXmlBuilder: { xmlBuilder: true },
        modActionMetadataProvider: { metadataProvider: true },
      });

      const llmJsonCall = container.register.mock.calls.find(
        ([token]) => token === tokens.LlmJsonService
      );
      llmJsonCall[1]();
      expect(LlmJsonServiceMock).toHaveBeenCalled();

      const responseCall = container.register.mock.calls.find(
        ([token]) => token === tokens.ILLMResponseProcessor
      );
      responseCall[1](
        createFactoryContext({
          [tokens.ISchemaValidator]: { validator: true },
          [tokens.ILogger]: logger,
          [tokens.ISafeEventDispatcher]: { dispatcher: true },
          [tokens.LlmJsonService]: { json: true },
        })
      );
      expect(LLMResponseProcessorMock).toHaveBeenCalledWith({
        schemaValidator: { validator: true },
        logger,
        safeEventDispatcher: { dispatcher: true },
        llmJsonService: { json: true },
      });

      const fallbackCall = container.register.mock.calls.find(
        ([token]) => token === tokens.IAIFallbackActionFactory
      );
      fallbackCall[1](createFactoryContext({ [tokens.ILogger]: logger }));
      expect(AIFallbackActionFactoryMock).toHaveBeenCalledWith({ logger });

      const pipelineCall = container.register.mock.calls.find(
        ([token]) => token === tokens.IAIPromptPipeline
      );
      pipelineCall[1](
        createFactoryContext({
          [tokens.LLMAdapter]: { adapter: true },
          [tokens.IAIGameStateProvider]: { state: true },
          [tokens.IAIPromptContentProvider]: { content: true },
          [tokens.IPromptBuilder]: { builder: true },
          [tokens.ILogger]: logger,
        })
      );
      expect(AIPromptPipelineMock).toHaveBeenCalledWith({
        llmAdapter: { adapter: true },
        gameStateProvider: { state: true },
        promptContentProvider: { content: true },
        promptBuilder: { builder: true },
        logger,
      });

      const chooserCall = container.register.mock.calls.find(
        ([token]) => token === tokens.ILLMChooser
      );
      chooserCall[1](
        createFactoryContext({
          [tokens.IAIPromptPipeline]: { pipeline: true },
          [tokens.LLMAdapter]: { adapter: true },
          [tokens.ILLMResponseProcessor]: { processor: true },
          [tokens.ILogger]: logger,
        })
      );
      expect(LLMChooserMock).toHaveBeenCalledWith({
        promptPipeline: { pipeline: true },
        llmAdapter: { adapter: true },
        responseProcessor: { processor: true },
        logger,
      });

      const decisionCall = container.register.mock.calls.find(
        ([token]) => token === tokens.ILLMDecisionProvider
      );
      decisionCall[1](
        createFactoryContext({
          [tokens.ILLMChooser]: { chooser: true },
          [tokens.ILogger]: logger,
          [tokens.ISafeEventDispatcher]: { dispatcher: true },
        })
      );
      expect(LLMDecisionProviderMock).toHaveBeenCalledWith({
        llmChooser: { chooser: true },
        logger,
        safeEventDispatcher: { dispatcher: true },
      });

      const goapCall = container.register.mock.calls.find(
        ([token]) => token === tokens.IGoapDecisionProvider
      );
      await goapCall[1](
        createFactoryContext({
          [tokens.IGoapController]: { controller: true },
          [tokens.ILogger]: logger,
          [tokens.ISafeEventDispatcher]: { dispatcher: true },
        })
      );
      expect(GoapDecisionProviderMock).toHaveBeenCalledWith({
        goapController: { controller: true },
        logger,
        safeEventDispatcher: { dispatcher: true },
      });

      const indexerCall = container.register.mock.calls.find(
        ([token]) => token === tokens.IActionIndexer
      );
      indexerCall[1](
        createFactoryContext({
          [tokens.ActionIndexingService]: { indexing: true },
        })
      );
      expect(ActionIndexerAdapterMock).toHaveBeenCalledWith({ indexing: true });
    });
  });

  describe('registerAITurnHandler', () => {
    it('registers the actor turn handler with shutdown tag', () => {
      const container = createMockContainer();
      const registrar = new Registrar(container);

      registerAITurnHandler(registrar, logger);

      const handlerCall = container.register.mock.calls.find(
        ([token]) => token === tokens.ActorTurnHandler
      );
      expect(handlerCall[2]).toMatchObject({
        lifecycle: 'transient',
        tags: SHUTDOWNABLE,
      });
      const handlerContext = createFactoryContext({
        [tokens.ILogger]: logger,
        [tokens.ITurnStateFactory]: { turnState: true },
        [tokens.ITurnEndPort]: { turnEnd: true },
        [tokens.TurnStrategyFactory]: { strategy: true },
        [tokens.TurnContextBuilder]: { context: true },
      });
      handlerCall[1](handlerContext);
      expect(ActorTurnHandlerMock).toHaveBeenCalledWith({
        logger,
        turnStateFactory: { turnState: true },
        turnEndPort: { turnEnd: true },
        strategyFactory: { strategy: true },
        turnContextBuilder: { context: true },
        container: handlerContext,
      });
    });
  });

  describe('registerAI', () => {
    it('registers full AI stack using the provided container', () => {
      const container = createMockContainer();
      container.resolve.mockImplementation((token) => {
        if (token === tokens.ILogger) {
          return logger;
        }
        throw new Error('Unexpected token resolution');
      });

      registerAI(container);

      expect(container.register).toHaveBeenCalled();
      expect(registerActorAwareStrategy).toHaveBeenCalledWith(container);
      expect(logger.debug).toHaveBeenCalledWith('AI Systems Registration: All registrations complete.');
    });
  });

  describe('registerMinimalAIForCharacterBuilder', () => {
    it('registers minimal services and augments LlmJsonService for tests', async () => {
      const container = createMockContainer();

      registerMinimalAIForCharacterBuilder(container, logger);

      const minimalCall = container.register.mock.calls.find(
        ([token]) => token === tokens.LlmJsonService
      );
      const minimalFactory = minimalCall[1];
      const serviceInstance = minimalFactory();
      expect(serviceInstance).toBeInstanceOf(LlmJsonServiceMock);
      await expect(serviceInstance.generateContent()).resolves.toEqual({
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
    });

    it('returns the vanilla LlmJsonService when not in test mode', () => {
      const container = createMockContainer();
      const originalEnv = process.env.NODE_ENV;

      try {
        process.env.NODE_ENV = 'development';

        registerMinimalAIForCharacterBuilder(container, logger);

        const minimalCall = container.register.mock.calls.find(
          ([token]) => token === tokens.LlmJsonService
        );
        const minimalFactory = minimalCall[1];
        const serviceInstance = minimalFactory();

        expect(serviceInstance.generateContent).toBe(
          LlmJsonServiceMock.mock.instances[0].generateContent
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
