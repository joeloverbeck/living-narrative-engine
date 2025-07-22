/**
 * @file Test suite for CharacterBuilderApp initialization
 * @description Ensures CharacterBuilderApp initializes properly with all required services
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterBuilderApp } from '../../../src/character-builder-main.js';

// Mock dependencies
jest.mock('../../../src/logging/consoleLogger.js');
jest.mock('../../../src/events/eventBus.js');
jest.mock('../../../src/events/validatedEventDispatcher.js');
jest.mock('../../../src/events/safeEventDispatcher.js');
jest.mock('../../../src/data/gameDataRepository.js');
jest.mock('../../../src/validation/ajvSchemaValidator.js');
jest.mock('../../../src/llms/llmJsonService.js');
jest.mock('../../../src/llms/LLMStrategyFactory.js');
jest.mock('../../../src/llms/services/llmConfigurationManager.js');
jest.mock('../../../src/llms/services/llmConfigLoader.js');
jest.mock('../../../src/data/textDataFetcher.js');
jest.mock('../../../src/llms/retryHttpClient.js');
jest.mock('../../../src/characterBuilder/storage/characterDatabase.js');
jest.mock('../../../src/characterBuilder/services/characterStorageService.js');
jest.mock(
  '../../../src/characterBuilder/services/thematicDirectionGenerator.js'
);
jest.mock('../../../src/characterBuilder/services/characterBuilderService.js');
jest.mock(
  '../../../src/characterBuilder/controllers/characterBuilderController.js'
);

describe('CharacterBuilderApp - Initialization', () => {
  let app;
  let mockFetch;
  let originalFetch;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock fetch for schema loading
    originalFetch = global.fetch;
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Setup fetch to return valid schemas
    mockFetch.mockImplementation((url) => {
      const schemaData = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {},
      };

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(schemaData),
      });
    });

    // Mock document body for error display
    document.body.innerHTML = '<div></div>';

    // Setup mock implementations
    const ConsoleLogger =
      require('../../../src/logging/consoleLogger.js').default;
    ConsoleLogger.mockImplementation(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));

    const EventBus = require('../../../src/events/eventBus.js').default;
    EventBus.mockImplementation(() => ({
      dispatch: jest.fn().mockResolvedValue(true),
      subscribe: jest.fn().mockReturnValue(() => {}),
      unsubscribe: jest.fn(),
    }));

    const ValidatedEventDispatcher =
      require('../../../src/events/validatedEventDispatcher.js').default;
    ValidatedEventDispatcher.mockImplementation(() => ({
      dispatch: jest.fn().mockResolvedValue(true),
      subscribe: jest.fn().mockReturnValue(() => {}),
      unsubscribe: jest.fn(),
    }));

    const {
      SafeEventDispatcher,
    } = require('../../../src/events/safeEventDispatcher.js');
    SafeEventDispatcher.mockImplementation(() => ({
      dispatch: jest.fn().mockResolvedValue(true),
      subscribe: jest.fn().mockReturnValue(() => {}),
      unsubscribe: jest.fn(),
    }));

    const GameDataRepository =
      require('../../../src/data/gameDataRepository.js').default;
    GameDataRepository.mockImplementation(() => ({}));

    const AjvSchemaValidator =
      require('../../../src/validation/ajvSchemaValidator.js').default;
    AjvSchemaValidator.mockImplementation(() => ({
      addSchema: jest.fn().mockResolvedValue(true),
    }));

    const { LlmJsonService } = require('../../../src/llms/llmJsonService.js');
    LlmJsonService.mockImplementation(() => ({}));

    const {
      LLMStrategyFactory,
    } = require('../../../src/llms/LLMStrategyFactory.js');
    LLMStrategyFactory.mockImplementation(() => ({}));

    const {
      LLMConfigurationManager,
    } = require('../../../src/llms/services/llmConfigurationManager.js');
    LLMConfigurationManager.mockImplementation(() => ({
      init: jest.fn().mockResolvedValue(true),
    }));

    const {
      LlmConfigLoader,
    } = require('../../../src/llms/services/llmConfigLoader.js');
    LlmConfigLoader.mockImplementation(() => ({}));

    const TextDataFetcher =
      require('../../../src/data/textDataFetcher.js').default;
    TextDataFetcher.mockImplementation(() => ({}));

    const { RetryHttpClient } = require('../../../src/llms/retryHttpClient.js');
    RetryHttpClient.mockImplementation(() => ({}));

    const {
      CharacterDatabase,
    } = require('../../../src/characterBuilder/storage/characterDatabase.js');
    CharacterDatabase.mockImplementation(() => ({}));

    const {
      CharacterStorageService,
    } = require('../../../src/characterBuilder/services/characterStorageService.js');
    CharacterStorageService.mockImplementation(() => ({}));

    const {
      ThematicDirectionGenerator,
    } = require('../../../src/characterBuilder/services/thematicDirectionGenerator.js');
    ThematicDirectionGenerator.mockImplementation(() => ({}));

    const {
      CharacterBuilderService,
    } = require('../../../src/characterBuilder/services/characterBuilderService.js');
    CharacterBuilderService.mockImplementation(() => ({}));

    const {
      CharacterBuilderController,
    } = require('../../../src/characterBuilder/controllers/characterBuilderController.js');
    CharacterBuilderController.mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(true),
    }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with logger', () => {
      app = new CharacterBuilderApp();
      expect(app).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should successfully initialize all services', async () => {
      app = new CharacterBuilderApp();
      await app.initialize();

      // Verify all services were created
      const EventBus = require('../../../src/events/eventBus.js').default;
      const ValidatedEventDispatcher =
        require('../../../src/events/validatedEventDispatcher.js').default;
      const {
        SafeEventDispatcher,
      } = require('../../../src/events/safeEventDispatcher.js');
      const GameDataRepository =
        require('../../../src/data/gameDataRepository.js').default;
      const {
        CharacterBuilderController,
      } = require('../../../src/characterBuilder/controllers/characterBuilderController.js');

      expect(EventBus).toHaveBeenCalled();
      expect(ValidatedEventDispatcher).toHaveBeenCalled();
      expect(SafeEventDispatcher).toHaveBeenCalled();
      expect(GameDataRepository).toHaveBeenCalled();
      expect(CharacterBuilderController).toHaveBeenCalled();
    });

    it('should properly create event system chain', async () => {
      app = new CharacterBuilderApp();
      await app.initialize();

      const EventBus = require('../../../src/events/eventBus.js').default;
      const ValidatedEventDispatcher =
        require('../../../src/events/validatedEventDispatcher.js').default;
      const {
        SafeEventDispatcher,
      } = require('../../../src/events/safeEventDispatcher.js');

      // Verify proper initialization order
      expect(EventBus).toHaveBeenCalledBefore(ValidatedEventDispatcher);
      expect(ValidatedEventDispatcher).toHaveBeenCalledBefore(
        SafeEventDispatcher
      );

      // Verify SafeEventDispatcher was called with validatedEventDispatcher
      expect(SafeEventDispatcher).toHaveBeenCalledWith(
        expect.objectContaining({
          validatedEventDispatcher: expect.any(Object),
          logger: expect.any(Object),
        })
      );
    });

    it('should load schemas before creating services', async () => {
      app = new CharacterBuilderApp();
      await app.initialize();

      // Verify schemas were loaded
      expect(mockFetch).toHaveBeenCalledWith(
        'data/schemas/character-concept.schema.json'
      );
      expect(mockFetch).toHaveBeenCalledWith(
        'data/schemas/thematic-direction.schema.json'
      );
    });

    it('should handle schema loading failure', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 404,
        })
      );

      app = new CharacterBuilderApp();
      await expect(app.initialize()).rejects.toThrow('Schema loading failed');
    });

    it('should not initialize twice', async () => {
      app = new CharacterBuilderApp();
      await app.initialize();

      const EventBus = require('../../../src/events/eventBus.js').default;
      const callCount = EventBus.mock.calls.length;

      await app.initialize();

      // EventBus should not be called again
      expect(EventBus).toHaveBeenCalledTimes(callCount);
    });

    it('should display error UI on initialization failure', async () => {
      const {
        CharacterBuilderController,
      } = require('../../../src/characterBuilder/controllers/characterBuilderController.js');
      CharacterBuilderController.mockImplementation(() => ({
        initialize: jest
          .fn()
          .mockRejectedValue(new Error('Controller init failed')),
      }));

      app = new CharacterBuilderApp();
      await expect(app.initialize()).rejects.toThrow('Controller init failed');

      // Verify error UI was displayed
      expect(document.body.innerHTML).toContain(
        'Character Builder Failed to Start'
      );
      expect(document.body.innerHTML).toContain('Controller init failed');
    });

    it('should initialize with mock LLM services', async () => {
      app = new CharacterBuilderApp();
      await app.initialize();

      // Character builder uses mock LLM services, not real ones
      const {
        ThematicDirectionGenerator,
      } = require('../../../src/characterBuilder/services/thematicDirectionGenerator.js');

      // Verify ThematicDirectionGenerator was created with mock services
      expect(ThematicDirectionGenerator).toHaveBeenCalledWith(
        expect.objectContaining({
          logger: expect.any(Object),
          llmJsonService: expect.any(Object),
          llmStrategyFactory: expect.any(Object),
          llmConfigManager: expect.any(Object),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should log initialization errors', async () => {
      const ConsoleLogger =
        require('../../../src/logging/consoleLogger.js').default;
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      ConsoleLogger.mockImplementation(() => mockLogger);

      // Force an error
      const EventBus = require('../../../src/events/eventBus.js').default;
      EventBus.mockImplementation(() => {
        throw new Error('EventBus creation failed');
      });

      app = new CharacterBuilderApp();
      await expect(app.initialize()).rejects.toThrow(
        'EventBus creation failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'CharacterBuilderApp: Failed to initialize',
        expect.any(Error)
      );
    });
  });
});
