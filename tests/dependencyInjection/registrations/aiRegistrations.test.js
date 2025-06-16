/* eslint-env jest */
/**
 * @file Tests for AI-related service registrations.
 * @see tests/dependencyInjection/registrations/aiRegistrations.test.js
 */

// --- Test Subject ---
import { registerAI } from '../../../src/dependencyInjection/registrations/aiRegistrations.js';

// --- Dependencies for Mocking & Testing ---
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { LLM_TURN_ACTION_RESPONSE_SCHEMA_ID } from '../../../src/turns/schemas/llmOutputSchemas.js';

// --- Concrete Classes for `instanceof` checks ---
import { RetryHttpClient } from '../../../src/llms/retryHttpClient.js';
import { ConfigurableLLMAdapter } from '../../../src/turns/adapters/configurableLLMAdapter.js';
import { PromptStaticContentService } from '../../../src/prompting/promptStaticContentService.js';
import { PerceptionLogFormatter } from '../../../src/formatting/perceptionLogFormatter.js';
import { GameStateValidationServiceForPrompting } from '../../../src/validation/gameStateValidationServiceForPrompting.js';
import { HttpConfigurationProvider } from '../../../src/configuration/httpConfigurationProvider.js';
import { LLMConfigService } from '../../../src/llms/llmConfigService.js';
import { PlaceholderResolver } from '../../../src/utils/placeholderResolverUtils.js';
import { StandardElementAssembler } from '../../../src/prompting/assembling/standardElementAssembler.js';
import { PerceptionLogAssembler } from '../../../src/prompting/assembling/perceptionLogAssembler.js';
import ThoughtsSectionAssembler from '../../../src/prompting/assembling/thoughtsSectionAssembler.js';
import NotesSectionAssembler from '../../../src/prompting/assembling/notesSectionAssembler.js';
import GoalsSectionAssembler from '../../../src/prompting/assembling/goalsSectionAssembler.js';
import { IndexedChoicesAssembler } from '../../../src/prompting/assembling/indexedChoicesAssembler.js';
import { AssemblerRegistry } from '../../../src/prompting/assemblerRegistry.js';
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

// --- Mocks ---
// A plain logger object to be spied on.
const plainLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

const mockSchemaValidator = {
  validate: jest.fn(),
  isSchemaLoaded: jest.fn(),
  loadSchema: jest.fn(),
};

// --- Test Suite ---
describe('registerAI', () => {
  let container;

  // Spies to track method calls on the plainLogger
  let loggerSpies;

  beforeEach(() => {
    container = new AppContainer();

    // Reset all mocks and spies before each test
    jest.restoreAllMocks();

    // Create spies on our plain logger object
    loggerSpies = {
      debug: jest.spyOn(plainLogger, 'debug'),
      info: jest.spyOn(plainLogger, 'info'),
      warn: jest.spyOn(plainLogger, 'warn'),
      error: jest.spyOn(plainLogger, 'error'),
    };

    mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

    // Register mocks for external dependencies assumed to be present
    container.register(tokens.ILogger, plainLogger); // Use the plain object
    container.register(tokens.ISchemaValidator, mockSchemaValidator);
    container.register(tokens.ISafeEventDispatcher, { dispatch: jest.fn() });
    container.register(tokens.IValidatedEventDispatcher, {
      dispatch: jest.fn(),
    });
    container.register(tokens.IActionDiscoveryService, {});
    container.register(tokens.IEntityManager, {});
    // FIX: The ActionIndexerAdapter constructor requires a service with an `indexActions` method.
    container.register(tokens.ActionIndexingService, {
      indexActions: jest.fn(),
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
    container.register(tokens.AIStrategyFactory, {});
    container.register(tokens.ITurnContextFactory, {});
    container.register(tokens.PromptTextLoader, { loadPromptText: jest.fn() });
  });

  it('should log start and end messages', () => {
    registerAI(container);
    expect(loggerSpies.debug).toHaveBeenCalledWith(
      'AI Systems Registration: Starting...'
    );
    expect(loggerSpies.debug).toHaveBeenCalledWith(
      'AI Systems Registration: All registrations complete.'
    );
  });

  describe('LLM Infrastructure & Adapter', () => {
    it('should register IHttpClient using ISafeEventDispatcher if available', () => {
      registerAI(container);
      expect(() => container.resolve(tokens.IHttpClient)).not.toThrow();
      const instance = container.resolve(tokens.IHttpClient);
      expect(instance).toBeInstanceOf(RetryHttpClient);
    });

    it('should register IHttpClient using IValidatedEventDispatcher as fallback', () => {
      const fallbackContainer = new AppContainer();
      fallbackContainer.register(tokens.ILogger, plainLogger);
      fallbackContainer.register(tokens.IValidatedEventDispatcher, {
        dispatch: jest.fn(),
      });
      // FIX: The fallback container also needs the ActionIndexingService mock
      // with the `indexActions` method.
      fallbackContainer.register(tokens.ActionIndexingService, {
        indexActions: jest.fn(),
      });

      registerAI(fallbackContainer);

      expect(() => fallbackContainer.resolve(tokens.IHttpClient)).not.toThrow();
      const instance = fallbackContainer.resolve(tokens.IHttpClient);
      expect(instance).toBeInstanceOf(RetryHttpClient);
    });

    it('should register LLMAdapter as a singleton factory', () => {
      registerAI(container);
      expect(() => container.resolve(tokens.LLMAdapter)).not.toThrow();
      const instance1 = container.resolve(tokens.LLMAdapter);
      const instance2 = container.resolve(tokens.LLMAdapter);
      expect(instance1).toBeInstanceOf(ConfigurableLLMAdapter);
      expect(instance1).toBe(instance2);
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
        expect(() => container.resolve(token)).not.toThrow();
        const instance = container.resolve(token);
        expect(instance).toBeInstanceOf(Class);
        expect(container.resolve(token)).toBe(instance);
      }
    );

    it('should log after registering all prompting services', () => {
      registerAI(container);
      // Fix: Use stringContaining to make the test more robust against formatting issues.
      expect(loggerSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining('Registered Prompting Engine services')
      );
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
        expect(() => container.resolve(token)).not.toThrow();
        expect(container.resolve(token)).toBeInstanceOf(Class);
      }
    );

    it('should log after registering AI game state providers', () => {
      registerAI(container);
      // Fix: Use stringContaining to make the test more robust against formatting issues.
      expect(loggerSpies.debug).toHaveBeenCalledWith(
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
        expect(() => container.resolve(token)).not.toThrow();
        const instance = container.resolve(token);
        expect(instance).toBeInstanceOf(Class);
        expect(container.resolve(token)).toBe(instance);
      }
    );

    it('should log after registering AI turn pipeline services', () => {
      registerAI(container);
      // Fix: Use stringContaining to make the test more robust against formatting issues.
      expect(loggerSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining('Registered AI Turn Pipeline services')
      );
    });
  });
});
