/* eslint-env jest */
/**
 * @file Tests for AI-related service registrations.
 * @see tests/dependencyInjection/registrations/aiRegistrations.test.js
 */

// --- Test Subject ---
import { registerAI } from '../../../../src/dependencyInjection/registrations/aiRegistrations.js';

// --- Dependencies for Mocking & Testing ---
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { INITIALIZABLE } from '../../../../src/dependencyInjection/tags.js';
import { LLM_TURN_ACTION_RESPONSE_SCHEMA_ID } from '../../../../src/turns/schemas/llmOutputSchemas.js';

// --- Concrete Classes for `instanceof` checks ---
import { RetryHttpClient } from '../../../../src/llms/retryHttpClient.js';
import { ConfigurableLLMAdapter } from '../../../../src/turns/adapters/configurableLLMAdapter.js';
import { PromptStaticContentService } from '../../../../src/prompting/promptStaticContentService.js';
import { PerceptionLogFormatter } from '../../../../src/formatting/perceptionLogFormatter.js';
import { GameStateValidationServiceForPrompting } from '../../../../src/validation/gameStateValidationServiceForPrompting.js';
import { HttpConfigurationProvider } from '../../../../src/configuration/httpConfigurationProvider.js';
import { LLMConfigService } from '../../../../src/llms/llmConfigService.js';
import { PlaceholderResolver } from '../../../../src/utils/placeholderResolverUtils.js';
import { StandardElementAssembler } from '../../../../src/prompting/assembling/standardElementAssembler.js';
import { PerceptionLogAssembler } from '../../../../src/prompting/assembling/perceptionLogAssembler.js';
import ThoughtsSectionAssembler from '../../../../src/prompting/assembling/thoughtsSectionAssembler.js';
import NotesSectionAssembler from '../../../../src/prompting/assembling/notesSectionAssembler.js';
import GoalsSectionAssembler from '../../../../src/prompting/assembling/goalsSectionAssembler.js';
import { IndexedChoicesAssembler } from '../../../../src/prompting/assembling/indexedChoicesAssembler.js';
import { AssemblerRegistry } from '../../../../src/prompting/assemblerRegistry.js';
import { PromptBuilder } from '../../../../src/prompting/promptBuilder.js';
import { EntitySummaryProvider } from '../../../../src/data/providers/entitySummaryProvider.js';
import { ActorDataExtractor } from '../../../../src/turns/services/actorDataExtractor.js';
import { ActorStateProvider } from '../../../../src/data/providers/actorStateProvider.js';
import { PerceptionLogProvider } from '../../../../src/data/providers/perceptionLogProvider.js';
import { AvailableActionsProvider } from '../../../../src/data/providers/availableActionsProvider.js';
import { LocationSummaryProvider } from '../../../../src/data/providers/locationSummaryProvider.js';
import { AIGameStateProvider } from '../../../../src/turns/services/AIGameStateProvider.js';
import { AIPromptContentProvider } from '../../../../src/prompting/AIPromptContentProvider.js';
import { LLMResponseProcessor } from '../../../../src/turns/services/LLMResponseProcessor.js';
import { AIFallbackActionFactory } from '../../../../src/turns/services/AIFallbackActionFactory.js';
import { AIPromptPipeline } from '../../../../src/prompting/AIPromptPipeline.js';
import { createMockLogger } from '../../../common/mockFactories/index.js';
import { expectSingleton } from '../../../common/containerAssertions.js';

// --- Mocks ---
const logger = createMockLogger();

const mockSchemaValidator = {
  validate: jest.fn(),
  isSchemaLoaded: jest.fn(),
  loadSchema: jest.fn(),
};

// --- Test Suite ---
describe('registerAI', () => {
  let container;

  beforeEach(() => {
    container = new AppContainer();

    // Reset all mocks and spies before each test
    jest.restoreAllMocks();
    jest.clearAllMocks();

    mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

    // Register mocks for external dependencies assumed to be present
    container.register(tokens.ILogger, logger);
    container.register(tokens.ISchemaValidator, mockSchemaValidator);
    container.register(tokens.ISafeEventDispatcher, { dispatch: jest.fn() });
    container.register(tokens.IValidatedEventDispatcher, {
      dispatch: jest.fn(),
    });
    container.register(tokens.IActionDiscoveryService, {});
    container.register(tokens.IEntityManager, {});
    // The ActionIndexerAdapter constructor requires the real service shape.
    container.register(tokens.ActionIndexingService, {
      indexActions: jest.fn(),
      resolve: jest.fn(),
      beginTurn: jest.fn(),
    });

    // Final Fix: The initial state object must have a `startTurn` method to be considered valid.
    const mockInitialState = {
      startTurn: jest.fn(),
    };
    container.register(tokens.ITurnStateFactory, {
      createInitialState: jest.fn().mockReturnValue(mockInitialState),
    });

    container.register(tokens.ITurnEndPort, {});
    container.register(tokens.ICommandProcessor, {});
    container.register(tokens.ICommandOutcomeInterpreter, {});
    container.register(tokens.TurnStrategyFactory, {});
    container.register(tokens.ITurnContextFactory, {});
    container.register(tokens.PromptTextLoader, { loadPromptText: jest.fn() });
  });

  it('should log start and end messages', () => {
    registerAI(container);
    expect(logger.debug).toHaveBeenCalledWith(
      'AI Systems Registration: Starting...'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'AI Systems Registration: All registrations complete.'
    );
  });

  describe('LLM Infrastructure & Adapter', () => {
    it('should register IHttpClient using ISafeEventDispatcher if available', () => {
      registerAI(container);
      expectSingleton(container, tokens.IHttpClient, RetryHttpClient);
    });

    it('should register IHttpClient using IValidatedEventDispatcher as fallback', () => {
      const fallbackContainer = new AppContainer();
      fallbackContainer.register(tokens.ILogger, logger);
      fallbackContainer.register(tokens.IValidatedEventDispatcher, {
        dispatch: jest.fn(),
      });
      // Provide a minimal ActionIndexingService for the adapter.
      fallbackContainer.register(tokens.ActionIndexingService, {
        indexActions: jest.fn(),
        resolve: jest.fn(),
        beginTurn: jest.fn(),
      });

      registerAI(fallbackContainer);

      expectSingleton(fallbackContainer, tokens.IHttpClient, RetryHttpClient);
    });

    it('should register LLMAdapter as a singleton factory', () => {
      registerAI(container);
      expectSingleton(container, tokens.LLMAdapter, ConfigurableLLMAdapter);
    });
  });

  describe('Prompting Engine Services', () => {
    const singletonServices = [
      {
        token: tokens.IPromptStaticContentService,
        Class: PromptStaticContentService,
      },
      { token: tokens.IPerceptionLogFormatter, Class: PerceptionLogFormatter },
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
      { token: tokens.PerceptionLogAssembler, Class: PerceptionLogAssembler },
      {
        token: tokens.ThoughtsSectionAssembler,
        Class: ThoughtsSectionAssembler,
      },
      { token: tokens.NotesSectionAssembler, Class: NotesSectionAssembler },
      { token: tokens.GoalsSectionAssembler, Class: GoalsSectionAssembler },
      { token: tokens.IndexedChoicesAssembler, Class: IndexedChoicesAssembler },
      { token: tokens.AssemblerRegistry, Class: AssemblerRegistry },
      { token: tokens.IPromptBuilder, Class: PromptBuilder },
    ];

    test.each(singletonServices)(
      'should register $token correctly',
      ({ token, Class }) => {
        registerAI(container);
        expectSingleton(container, token, Class);
      }
    );

    it('should log after registering all prompting services', () => {
      registerAI(container);
      // Fix: Use stringContaining to make the test more robust against formatting issues.
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Registered Prompting Engine services')
      );
    });

    it('registers IPromptStaticContentService as INITIALIZABLE singletonFactory', () => {
      const registerSpy = jest.spyOn(container, 'register');
      registerAI(container);
      const registrationCall = registerSpy.mock.calls.find(
        (call) => call[0] === tokens.IPromptStaticContentService
      );
      expect(registrationCall).toBeDefined();
      const options = registrationCall[2] || {};
      expect(options.lifecycle).toBe('singletonFactory');
      expect(options.tags).toEqual(INITIALIZABLE);
      registerSpy.mockRestore();
    });
  });

  describe('AI Game State Provider Services', () => {
    const services = [
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

    test.each(services)(
      'should register $token correctly',
      ({ token, Class }) => {
        registerAI(container);
        expectSingleton(container, token, Class);
      }
    );

    it('should log after registering AI game state providers', () => {
      registerAI(container);
      // Fix: Use stringContaining to make the test more robust against formatting issues.
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Registered AI Game State providers')
      );
    });
  });

  describe('AI Turn Pipeline Services', () => {
    beforeEach(() => {
      mockSchemaValidator.isSchemaLoaded.mockImplementation(
        (id) => id === LLM_TURN_ACTION_RESPONSE_SCHEMA_ID
      );
    });

    const pipelineSingletonServices = [
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

    test.each(pipelineSingletonServices)(
      'should register $token correctly',
      ({ token, Class }) => {
        registerAI(container);
        expectSingleton(container, token, Class);
      }
    );

    it('should log after registering AI turn pipeline services', () => {
      registerAI(container);
      // Fix: Use stringContaining to make the test more robust against formatting issues.
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Registered AI Turn Pipeline services')
      );
    });
  });
});
