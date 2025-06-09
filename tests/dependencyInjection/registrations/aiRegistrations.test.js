/* eslint-env node */
/**
 * @file Test suite to cover AI registrations.
 * @see tests/dependencyInjection/registrations/aiRegistrations.test.js
 */

// --- Test Framework & Mocker Imports ---
import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { mock, mockDeep } from 'jest-mock-extended';

// --- DI & System Under Test (SUT) Imports ---
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { registerAI } from '../../../src/dependencyInjection/registrations/aiRegistrations.js';

// --- Concrete Class Imports for `instanceof` checks ---
import { RetryHttpClient } from '../../../src/llms/retryHttpClient.js';
import { ConfigurableLLMAdapter } from '../../../src/turns/adapters/configurableLLMAdapter.js';
import { PromptStaticContentService } from '../../../src/prompting/promptStaticContentService.js';
import { PerceptionLogFormatter } from '../../../src/formatting/perceptionLogFormatter.js';
import { GameStateValidationServiceForPrompting } from '../../../src/validation/gameStateValidationServiceForPrompting.js';
import { HttpConfigurationProvider } from '../../../src/configuration/httpConfigurationProvider.js';
import { LLMConfigService } from '../../../src/llms/llmConfigService.js';
import { PlaceholderResolver } from '../../../src/utils/placeholderResolver.js';
import { StandardElementAssembler } from '../../../src/prompting/assembling/standardElementAssembler.js';
import { PerceptionLogAssembler } from '../../../src/prompting/assembling/perceptionLogAssembler.js';
import ThoughtsSectionAssembler from '../../../src/prompting/assembling/thoughtsSectionAssembler.js';
import NotesSectionAssembler from '../../../src/prompting/assembling/notesSectionAssembler.js';
import GoalsSectionAssembler from '../../../src/prompting/assembling/goalsSectionAssembler.js';
import { PromptBuilder } from '../../../src/prompting/promptBuilder.js';
import { EntitySummaryProvider } from '../../../src/data/providers/entitySummaryProvider.js';
import { ActorDataExtractor } from '../../../src/turns/services/actorDataExtractor.js';
import { ActorStateProvider } from '../../../src/data/providers/actorStateProvider.js';
import { PerceptionLogProvider } from '../../../src/data/providers/perceptionLogProvider.js';
import { AvailableActionsProvider } from '../../../src/data/providers/availableActionsProvider.js';
import { LocationSummaryProvider } from '../../../src/data/providers/locationSummaryProvider.js';
import { AIGameStateProvider } from '../../../src/turns/services/AIGameStateProvider.js';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';
import { LLMResponseProcessor } from '../../../src/turns/services/LLMResponseProcessor.js';
import { AIFallbackActionFactory } from '../../../src/turns/services/AIFallbackActionFactory.js';
import { AIPromptPipeline } from '../../../src/prompting/AIPromptPipeline.js';
import AITurnHandler from '../../../src/turns/handlers/aiTurnHandler.js';

// --- Mocking globals ---
// Mock `globalThis.process` for environment variable access and path resolution
global.process = {
  env: {
    PROXY_URL: 'http://test-proxy.com',
  },
  cwd: jest.fn(() => '/mock/project/root'),
};

describe('registerAI', () => {
  /** @type {AppContainer} */
  let container;

  // --- Mock Dependencies ---
  const mockLogger = mock();
  const mockSafeEventDispatcher = mockDeep();
  const mockValidatedEventDispatcher = mockDeep();
  const mockSchemaValidator = mockDeep();
  const mockTurnStateFactory = mockDeep();
  const mockWorldContext = mockDeep();
  const mockTurnEndPort = mockDeep();
  const mockCommandProcessor = mockDeep();
  const mockCommandOutcomeInterpreter = mockDeep();
  const mockCommandInputPort = mockDeep();
  const mockEntityManager = mockDeep();
  const mockActionDiscoveryService = mockDeep();
  const mockAIPlayerStrategyFactory = mockDeep();
  const mockTurnContextFactory = mockDeep();
  const mockConfiguration = mockDeep(); // For LLMConfigService

  beforeEach(() => {
    container = new AppContainer();

    mockSchemaValidator.has.mockReturnValue(true);

    // *** FINAL FIX IS HERE ***
    // The AITurnHandler constructor requires its turnStateFactory to return a valid initial state.
    // We must configure the mock to return a mock state object to prevent an "invalid initial state" error.
    const mockInitialState = mock();
    mockTurnStateFactory.createInitialState.mockReturnValue(mockInitialState);

    // Register all necessary mock dependencies that `registerAI` will resolve
    container.register(tokens.ILogger, () => mockLogger);
    container.register(
      tokens.ISafeEventDispatcher,
      () => mockSafeEventDispatcher
    );
    container.register(
      tokens.IValidatedEventDispatcher,
      () => mockValidatedEventDispatcher
    );
    container.register(tokens.ISchemaValidator, () => mockSchemaValidator);
    container.register(tokens.ITurnStateFactory, () => mockTurnStateFactory);
    container.register(tokens.IWorldContext, () => mockWorldContext);
    container.register(tokens.ITurnEndPort, () => mockTurnEndPort);
    container.register(tokens.ICommandProcessor, () => mockCommandProcessor);
    container.register(
      tokens.ICommandOutcomeInterpreter,
      () => mockCommandOutcomeInterpreter
    );
    container.register(tokens.ICommandInputPort, () => mockCommandInputPort);
    container.register(tokens.IEntityManager, () => mockEntityManager);
    container.register(
      tokens.IActionDiscoveryService,
      () => mockActionDiscoveryService
    );
    container.register(
      tokens.IAIPlayerStrategyFactory,
      () => mockAIPlayerStrategyFactory
    );
    container.register(
      tokens.ITurnContextFactory,
      () => mockTurnContextFactory
    );
    container.register(tokens.IConfiguration, () => mockConfiguration);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should log start and end messages', () => {
    registerAI(container);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'AI Systems Registration: Starting...'
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'AI Systems Registration: All registrations complete.'
    );
  });

  describe('LLM Infrastructure & Adapter', () => {
    test('should register IHttpClient using ISafeEventDispatcher if available', () => {
      registerAI(container);
      expect(() => container.resolve(tokens.IHttpClient)).not.toThrow();
      const client = container.resolve(tokens.IHttpClient);
      expect(client).toBeInstanceOf(RetryHttpClient);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `AI Systems Registration: Registered ${tokens.IHttpClient}.`
      );
    });

    test('should register IHttpClient using IValidatedEventDispatcher as fallback', () => {
      const fallbackContainer = new AppContainer();
      fallbackContainer.register(tokens.ILogger, () => mockLogger);
      fallbackContainer.register(
        tokens.IValidatedEventDispatcher,
        () => mockValidatedEventDispatcher
      );
      expect(fallbackContainer.isRegistered(tokens.ISafeEventDispatcher)).toBe(
        false
      );
      expect(
        fallbackContainer.isRegistered(tokens.IValidatedEventDispatcher)
      ).toBe(true);
      registerAI(fallbackContainer);
      expect(() => fallbackContainer.resolve(tokens.IHttpClient)).not.toThrow();
      const client = fallbackContainer.resolve(tokens.IHttpClient);
      expect(client).toBeInstanceOf(RetryHttpClient);
    });

    test('should register LLMAdapter as a singleton factory', () => {
      registerAI(container);
      expect(() => container.resolve(tokens.LLMAdapter)).not.toThrow();
      const adapter1 = container.resolve(tokens.LLMAdapter);
      const adapter2 = container.resolve(tokens.LLMAdapter);
      expect(adapter1).toBeInstanceOf(ConfigurableLLMAdapter);
      expect(adapter1).toBe(adapter2);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `AI Systems Registration: Registered ${tokens.LLMAdapter} factory.`
      );
    });
  });

  describe('Prompting Engine Services', () => {
    const promptingTokens = [
      {
        token: tokens.IPromptStaticContentService,
        Class: PromptStaticContentService,
      },
      {
        token: tokens.IPerceptionLogFormatter,
        Class: PerceptionLogFormatter,
      },
      {
        token: tokens.IGameStateValidationServiceForPrompting,
        Class: GameStateValidationServiceForPrompting,
      },
      {
        token: tokens.IConfigurationProvider,
        Class: HttpConfigurationProvider,
      },
      { token: tokens.LLMConfigService, Class: LLMConfigService },
      { token: tokens.PlaceholderResolver, Class: PlaceholderResolver },
      {
        token: tokens.StandardElementAssembler,
        Class: StandardElementAssembler,
      },
      {
        token: tokens.PerceptionLogAssembler,
        Class: PerceptionLogAssembler,
      },
      {
        token: tokens.ThoughtsSectionAssembler,
        Class: ThoughtsSectionAssembler,
      },
      { token: tokens.NotesSectionAssembler, Class: NotesSectionAssembler },
      { token: tokens.GoalsSectionAssembler, Class: GoalsSectionAssembler },
      { token: tokens.IPromptBuilder, Class: PromptBuilder },
    ];

    test.each(promptingTokens)(
      'should register $token correctly',
      ({ token, Class }) => {
        registerAI(container);
        expect(() => container.resolve(token)).not.toThrow();
        const instance = container.resolve(token);
        expect(instance).toBeInstanceOf(Class);
        expect(container.resolve(token)).toBe(instance);
      }
    );

    test('should log after registering all prompting services', () => {
      registerAI(container);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `AI Systems Registration: Registered Prompting Engine services, including ${tokens.IPromptBuilder}.`
      );
    });
  });

  describe('AI Game State Provider Services', () => {
    const gameStateProviderTokens = [
      { token: tokens.IEntitySummaryProvider, Class: EntitySummaryProvider },
      { token: tokens.IActorDataExtractor, Class: ActorDataExtractor },
      { token: tokens.IActorStateProvider, Class: ActorStateProvider },
      { token: tokens.IPerceptionLogProvider, Class: PerceptionLogProvider },
      {
        token: tokens.IAvailableActionsProvider,
        Class: AvailableActionsProvider,
      },
      {
        token: tokens.ILocationSummaryProvider,
        Class: LocationSummaryProvider,
      },
      { token: tokens.IAIGameStateProvider, Class: AIGameStateProvider },
    ];

    test.each(gameStateProviderTokens)(
      'should register $token correctly',
      ({ token, Class }) => {
        registerAI(container);
        expect(() => container.resolve(token)).not.toThrow();
        const instance = container.resolve(token);
        expect(instance).toBeInstanceOf(Class);
        expect(container.resolve(token)).toBe(instance);
      }
    );

    test('should log after registering AI game state providers', () => {
      registerAI(container);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `AI Systems Registration: Registered AI Game State providers, including ${tokens.IAIGameStateProvider}.`
      );
    });
  });

  describe('AI Turn Pipeline Services', () => {
    const pipelineTokens = [
      {
        token: tokens.IAIPromptContentProvider,
        Class: AIPromptContentProvider,
      },
      { token: tokens.ILLMResponseProcessor, Class: LLMResponseProcessor },
      {
        token: tokens.IAIFallbackActionFactory,
        Class: AIFallbackActionFactory,
      },
      { token: tokens.IAIPromptPipeline, Class: AIPromptPipeline },
    ];

    test.each(pipelineTokens)(
      'should register $token correctly',
      ({ token, Class }) => {
        registerAI(container);
        expect(() => container.resolve(token)).not.toThrow();
        const instance = container.resolve(token);
        expect(instance).toBeInstanceOf(Class);
        expect(container.resolve(token)).toBe(instance);
      }
    );

    test('should log after registering AI turn pipeline services', () => {
      registerAI(container);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `AI Systems Registration: Registered AI Turn Pipeline services, including ${tokens.IAIPromptPipeline}.`
      );
    });
  });

  describe('AI Turn Handler', () => {
    test('should register AITurnHandler correctly', () => {
      registerAI(container);

      // it resolves without throwing…
      expect(() => container.resolve(tokens.AITurnHandler)).not.toThrow();

      // …and each resolve gives you a brand‐new AITurnHandler
      const handler1 = container.resolve(tokens.AITurnHandler);
      expect(handler1).toBeInstanceOf(AITurnHandler);

      const handler2 = container.resolve(tokens.AITurnHandler);
      expect(handler2).toBeInstanceOf(AITurnHandler);

      // because it’s transient, they *must not* be the same object
      expect(handler2).not.toBe(handler1);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `AI Systems Registration: Registered ${tokens.AITurnHandler}.`
      );
    });
  });
});
