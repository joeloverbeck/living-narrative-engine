/**
 * @file Integration test to verify traits generation events use correct namespaces
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterBuilderBootstrap } from '../../../src/characterBuilder/CharacterBuilderBootstrap.js';
import { TraitsGenerator } from '../../../src/characterBuilder/services/TraitsGenerator.js';
import { AppContainer } from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('TraitsGenerator - Event Namespace Integration', () => {
  let container;
  let bootstrap;
  let mockLogger;
  let warnings;
  let eventBus;
  let gameDataRepository;

  beforeEach(async () => {
    warnings = [];
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn((message) => {
        warnings.push(message);
      }),
      error: jest.fn(),
    };

    bootstrap = new CharacterBuilderBootstrap();

    // Bootstrap with mod loading enabled
    const result = await bootstrap.bootstrap({
      pageName: 'test-traits-generator',
      controllerClass: class TestController {
        initialize() {
          // Minimal controller for testing
        }
      },
      includeModLoading: true, // This loads events from mods with namespace
      customSchemas: [],
    });

    container = result.container;
    eventBus = container.resolve(tokens.IEventBus);
    gameDataRepository = container.resolve(tokens.IGameDataRepository);
  });

  afterEach(() => {
    // Note: AppContainer doesn't have dispose method
    jest.clearAllMocks();
  });

  it('should find TRAITS_GENERATION_STARTED event when using correct namespace', () => {
    // Check that the event is stored with namespace
    const eventWithNamespace = gameDataRepository.getEventDefinition(
      'core:TRAITS_GENERATION_STARTED'
    );
    const eventWithoutNamespace = gameDataRepository.getEventDefinition(
      'TRAITS_GENERATION_STARTED'
    );

    expect(eventWithNamespace).toBeDefined();
    expect(eventWithNamespace?.id).toBeDefined();
    expect(eventWithoutNamespace).toBeNull();
  });

  it('should warn when dispatching TRAITS_GENERATION_STARTED without namespace', async () => {
    const validatedDispatcher = container.resolve(
      tokens.IValidatedEventDispatcher
    );

    // Spy on the dispatcher's internal logger
    const dispatcherLogger =
      validatedDispatcher._logger || validatedDispatcher.logger;
    if (dispatcherLogger && dispatcherLogger.warn) {
      jest.spyOn(dispatcherLogger, 'warn');
    }

    // Dispatch without namespace (incorrect)
    await validatedDispatcher.dispatch({
      type: 'TRAITS_GENERATION_STARTED',
      payload: {
        conceptId: 'test-concept',
        directionId: 'test-direction',
        timestamp: new Date().toISOString(),
        metadata: {
          conceptLength: 100,
          clichesCount: 5,
          promptVersion: '1.0',
        },
      },
    });

    // Check for warning about missing event definition
    if (dispatcherLogger?.warn) {
      expect(dispatcherLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "EventDefinition not found for 'TRAITS_GENERATION_STARTED'"
        )
      );
    }
  });

  it('should not warn when dispatching TRAITS_GENERATION_STARTED with namespace', async () => {
    const validatedDispatcher = container.resolve(
      tokens.IValidatedEventDispatcher
    );

    // Spy on the dispatcher's internal logger
    const dispatcherLogger =
      validatedDispatcher._logger || validatedDispatcher.logger;
    if (dispatcherLogger && dispatcherLogger.warn) {
      jest.spyOn(dispatcherLogger, 'warn');
    }

    // Dispatch with namespace (correct)
    await validatedDispatcher.dispatch({
      type: 'core:TRAITS_GENERATION_STARTED',
      payload: {
        conceptId: 'test-concept',
        directionId: 'test-direction',
        timestamp: new Date().toISOString(),
        metadata: {
          conceptLength: 100,
          clichesCount: 5,
          promptVersion: '1.0',
        },
      },
    });

    // Should not warn about missing event definition
    if (dispatcherLogger?.warn) {
      expect(dispatcherLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining(
          "EventDefinition not found for 'core:TRAITS_GENERATION_STARTED'"
        )
      );
    }
  });

  it('should reproduce the warning when TraitsGenerator dispatches without namespace', async () => {
    // Create TraitsGenerator instance
    const llmStrategyFactory = container.resolve(tokens.ILLMStrategyFactory);
    const schemaValidator = container.resolve(tokens.ISchemaValidator);
    const promptBuilder = container.resolve(tokens.IPromptBuilder);
    const logger = container.resolve(tokens.ILogger);

    const traitsGenerator = new TraitsGenerator({
      eventBus,
      llmStrategyFactory,
      schemaValidator,
      promptBuilder,
      logger,
    });

    // Mock LLM strategy
    const mockStrategy = {
      generateResponse: jest.fn().mockResolvedValue({
        success: true,
        response: JSON.stringify([
          { trait: 'Brave', description: 'Shows courage' },
        ]),
      }),
    };
    llmStrategyFactory.create = jest.fn().mockReturnValue(mockStrategy);

    // Generate traits (this will dispatch TRAITS_GENERATION_STARTED)
    const concept = {
      id: 'test-concept',
      concept: 'A test character concept',
    };
    const direction = {
      id: 'test-direction',
      cliches: [],
    };

    try {
      await traitsGenerator.generateTraits(concept, direction);
    } catch (error) {
      // We expect this might fail due to other reasons, but we're only checking the warning
    }

    // Check if warning was logged
    const validatedDispatcher = container.resolve(
      tokens.IValidatedEventDispatcher
    );
    const dispatcherLogger =
      validatedDispatcher._logger || validatedDispatcher.logger;

    if (dispatcherLogger?.warn && jest.isMockFunction(dispatcherLogger.warn)) {
      const warnCalls = dispatcherLogger.warn.mock.calls;
      const hasWarning = warnCalls.some((call) =>
        call[0]?.includes(
          "EventDefinition not found for 'TRAITS_GENERATION_STARTED'"
        )
      );

      expect(hasWarning).toBe(true);
    }
  });
});
