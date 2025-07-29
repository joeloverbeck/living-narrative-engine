/**
 * @file Unit tests for ThematicDirectionApp registration and initialization
 * @description Tests for the main thematic direction application class
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ThematicDirectionApp } from '../../../src/thematic-direction-main.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { Registrar } from '../../../src/utils/registrarHelpers.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

// Mock dependencies
jest.mock('../../../src/dependencyInjection/baseContainerConfig.js');
jest.mock('../../../src/utils/registrarHelpers.js');
jest.mock(
  '../../../src/thematicDirection/controllers/thematicDirectionController.js'
);

describe('ThematicDirectionApp', () => {
  let app;
  let mockContainer;
  let mockRegistrar;
  let mockController;
  let mockSchemaLoader;
  let mockSchemaValidator;
  let mockLlmAdapter;
  let mockConfigureBaseContainer;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock container
    mockContainer = {
      register: jest.fn(),
      resolve: jest.fn(),
    };

    // Mock registrar
    mockRegistrar = {
      singletonFactory: jest.fn(),
    };

    // Mock the Registrar constructor
    const { Registrar } = require('../../../src/utils/registrarHelpers.js');
    Registrar.mockImplementation(() => mockRegistrar);

    // Mock controller
    mockController = {
      initialize: jest.fn().mockResolvedValue(undefined),
    };

    // Mock schema loader
    mockSchemaLoader = {
      loadAndCompileAllSchemas: jest.fn().mockResolvedValue(undefined),
    };

    // Mock schema validator
    mockSchemaValidator = {
      addSchema: jest.fn().mockResolvedValue(undefined),
      isSchemaLoaded: jest.fn().mockReturnValue(false),
    };

    // Mock LLM adapter
    mockLlmAdapter = {
      init: jest.fn().mockResolvedValue(undefined),
    };

    // Mock data registry
    const mockDataRegistry = {
      setEventDefinition: jest.fn(),
    };

    // Setup container resolve calls
    mockContainer.resolve.mockImplementation((token) => {
      switch (token) {
        case tokens.SchemaLoader:
          return mockSchemaLoader;
        case tokens.ISchemaValidator:
          return mockSchemaValidator;
        case tokens.LLMAdapter:
          return mockLlmAdapter;
        case tokens.LlmConfigLoader:
          return {};
        case tokens.ThematicDirectionController:
          return mockController;
        case tokens.IDataRegistry:
          return mockDataRegistry;
        default:
          return {};
      }
    });

    // Mock configureBaseContainer
    mockConfigureBaseContainer =
      require('../../../src/dependencyInjection/baseContainerConfig.js').configureBaseContainer;
    mockConfigureBaseContainer.mockResolvedValue(undefined);

    // Mock AppContainer
    jest
      .spyOn(AppContainer.prototype, 'register')
      .mockImplementation(mockContainer.register);
    jest
      .spyOn(AppContainer.prototype, 'resolve')
      .mockImplementation(mockContainer.resolve);

    // Mock fetch for schema loading
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'thematic-direction' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'schema://living-narrative-engine/character-concept.schema.json',
          }),
      });

    app = new ThematicDirectionApp();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
  });

  describe('constructor', () => {
    it('should create instance with logger', () => {
      expect(app).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should successfully initialize with proper DI registration', async () => {
      await app.initialize();

      // Verify container configuration
      expect(mockContainer.register).toHaveBeenCalledWith(
        tokens.ILogger,
        expect.any(Object)
      );
      expect(mockConfigureBaseContainer).toHaveBeenCalledWith(
        expect.any(AppContainer),
        expect.objectContaining({
          includeGameSystems: true,
          includeCharacterBuilder: true,
          logger: expect.any(Object),
        })
      );
    });

    it('should create Registrar instance correctly', async () => {
      await app.initialize();

      // Verify Registrar was created with container
      expect(Registrar).toHaveBeenCalledWith(expect.any(AppContainer));
    });

    it('should register ThematicDirectionController using registrar', async () => {
      await app.initialize();

      // Verify controller registration
      expect(mockRegistrar.singletonFactory).toHaveBeenCalledWith(
        tokens.ThematicDirectionController,
        expect.any(Function)
      );
    });

    it('should verify controller factory function works correctly', async () => {
      await app.initialize();

      // Get the factory function that was registered
      const factoryCall = mockRegistrar.singletonFactory.mock.calls.find(
        (call) => call[0] === tokens.ThematicDirectionController
      );
      expect(factoryCall).toBeDefined();

      const factoryFunction = factoryCall[1];
      expect(typeof factoryFunction).toBe('function');

      // Mock a container for the factory function
      const mockFactoryContainer = {
        resolve: jest.fn().mockImplementation((token) => {
          switch (token) {
            case tokens.ILogger:
              return {
                debug: jest.fn(),
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
              };
            case tokens.CharacterBuilderService:
              return {
                initialize: jest.fn(),
                createCharacterConcept: jest.fn(),
                generateThematicDirections: jest.fn(),
                getAllCharacterConcepts: jest.fn(),
                getCharacterConcept: jest.fn(),
              };
            case tokens.ISafeEventDispatcher:
              return { dispatch: jest.fn() };
            case tokens.ISchemaValidator:
              return { validateAgainstSchema: jest.fn() };
            default:
              return {};
          }
        }),
      };

      // Test that the factory function can create a controller
      const result = factoryFunction(mockFactoryContainer);
      expect(result).toBeDefined();
    });

    it('should load schemas correctly', async () => {
      await app.initialize();

      expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalled();
      expect(mockSchemaValidator.addSchema).toHaveBeenCalledTimes(3);
      expect(fetch).toHaveBeenCalledWith(
        'data/schemas/character-concept.schema.json'
      );
    });

    it('should initialize LLM adapter', async () => {
      await app.initialize();

      expect(mockLlmAdapter.init).toHaveBeenCalledWith({
        llmConfigLoader: expect.any(Object),
      });
    });

    it('should initialize controller', async () => {
      await app.initialize();

      expect(mockController.initialize).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      const error = new Error('Initialization failed');
      mockConfigureBaseContainer.mockRejectedValue(error);

      await expect(app.initialize()).rejects.toThrow('Initialization failed');
    });

    it('should handle schema loading errors', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error('Schema load failed'));

      await expect(app.initialize()).rejects.toThrow('Schema loading failed');
    });

    it('should prevent double initialization', async () => {
      await app.initialize();

      // Second call should return early
      await app.initialize();

      // configureBaseContainer should only be called once
      expect(mockConfigureBaseContainer).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should handle initialization failure', async () => {
      const error = new Error('Test error');
      mockConfigureBaseContainer.mockRejectedValue(error);

      // The app should throw the error
      await expect(app.initialize()).rejects.toThrow('Test error');
    });
  });
});
