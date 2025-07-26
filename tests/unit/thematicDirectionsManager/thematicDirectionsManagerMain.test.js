/**
 * @file Unit tests for thematicDirectionsManagerMain.js
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

// Mock ConsoleLogger
const mockConsoleLogger = jest.fn().mockImplementation(() => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../../src/logging/consoleLogger.js', () => ({
  __esModule: true,
  default: mockConsoleLogger,
}));

// Mock AppContainer
const mockRegister = jest.fn();
const mockResolve = jest.fn();
const mockAppContainer = jest.fn().mockImplementation(() => ({
  register: mockRegister,
  resolve: mockResolve,
}));

jest.mock('../../../src/dependencyInjection/appContainer.js', () => ({
  __esModule: true,
  default: mockAppContainer,
}));

// Mock configureBaseContainer
const mockConfigureBaseContainer = jest.fn();
jest.mock('../../../src/dependencyInjection/baseContainerConfig.js', () => ({
  configureBaseContainer: mockConfigureBaseContainer,
}));

// Mock tokens
const mockTokens = {
  ILogger: Symbol('ILogger'),
  SchemaLoader: Symbol('SchemaLoader'),
  IDataRegistry: Symbol('IDataRegistry'),
  ISchemaValidator: Symbol('ISchemaValidator'),
  LLMAdapter: Symbol('LLMAdapter'),
  LlmConfigLoader: Symbol('LlmConfigLoader'),
  ThematicDirectionsManagerController: Symbol(
    'ThematicDirectionsManagerController'
  ),
  CharacterBuilderService: Symbol('CharacterBuilderService'),
  ISafeEventDispatcher: Symbol('ISafeEventDispatcher'),
};

jest.mock('../../../src/dependencyInjection/tokens.js', () => ({
  tokens: mockTokens,
}));

// Mock Registrar
const mockSingletonFactory = jest.fn();
const mockRegistrar = jest.fn().mockImplementation(() => ({
  singletonFactory: mockSingletonFactory,
}));

jest.mock('../../../src/utils/registrarHelpers.js', () => ({
  Registrar: mockRegistrar,
}));

// Mock ThematicDirectionsManagerController
const mockControllerInitialize = jest.fn();
const mockController = {
  initialize: mockControllerInitialize,
};
const mockThematicDirectionsManagerController = jest
  .fn()
  .mockImplementation(() => mockController);

jest.mock(
  '../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js',
  () => ({
    ThematicDirectionsManagerController:
      mockThematicDirectionsManagerController,
  })
);

describe('thematicDirectionsManagerMain', () => {
  let originalDocument;
  let mockSchemaLoader;
  let mockDataRegistry;
  let mockSchemaValidator;
  let mockLlmAdapter;
  let mockLlmConfigLoader;
  let mockCharacterBuilderService;
  let mockEventBus;
  let ThematicDirectionsManagerApp;
  let mockLogger;

  beforeEach(() => {
    // Clear module cache to ensure fresh imports
    jest.resetModules();
    // Save original document
    originalDocument = global.document;

    // Create mock DOM
    document.body.innerHTML = '<div id="app"></div>';

    // Mock document ready state
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: jest.fn(() => 'complete'),
    });

    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock services
    mockSchemaLoader = {
      loadAndCompileAllSchemas: jest.fn().mockResolvedValue(undefined),
    };

    mockDataRegistry = {
      setEventDefinition: jest.fn(),
    };

    mockSchemaValidator = {
      addSchema: jest.fn().mockResolvedValue(undefined),
      validateAgainstSchema: jest.fn(),
    };

    mockLlmAdapter = {
      init: jest.fn().mockResolvedValue(undefined),
    };

    mockLlmConfigLoader = {
      loadConfig: jest.fn(),
    };

    mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      getAllThematicDirectionsWithConcepts: jest.fn().mockResolvedValue([]),
      getOrphanedThematicDirections: jest.fn().mockResolvedValue([]),
      updateThematicDirection: jest.fn().mockResolvedValue(undefined),
      deleteThematicDirection: jest.fn().mockResolvedValue(undefined),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Setup resolve mock to return appropriate services
    mockResolve.mockImplementation((token) => {
      if (token === mockTokens.SchemaLoader) return mockSchemaLoader;
      if (token === mockTokens.IDataRegistry) return mockDataRegistry;
      if (token === mockTokens.ISchemaValidator) return mockSchemaValidator;
      if (token === mockTokens.LLMAdapter) return mockLlmAdapter;
      if (token === mockTokens.LlmConfigLoader) return mockLlmConfigLoader;
      if (token === mockTokens.ThematicDirectionsManagerController)
        return mockController;
      if (token === mockTokens.CharacterBuilderService)
        return mockCharacterBuilderService;
      if (token === mockTokens.ISafeEventDispatcher) return mockEventBus;
      if (token === mockTokens.ILogger) return mockLogger;
      return null;
    });

    // Setup mock console logger to return mock logger
    mockConsoleLogger.mockReturnValue(mockLogger);

    // Setup configureBaseContainer to resolve successfully
    mockConfigureBaseContainer.mockResolvedValue(undefined);

    // Reset controller mocks
    mockControllerInitialize.mockClear();
    mockControllerInitialize.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore original document
    global.document = originalDocument;
    jest.resetModules();
  });

  describe('ThematicDirectionsManagerApp', () => {
    beforeEach(async () => {
      // Import the module dynamically to ensure fresh mocks
      const module = await import(
        '../../../src/thematicDirectionsManager/thematicDirectionsManagerMain.js'
      );
      ThematicDirectionsManagerApp = module.ThematicDirectionsManagerApp;
    });

    describe('constructor', () => {
      it('should initialize with a console logger', () => {
        const app = new ThematicDirectionsManagerApp();

        expect(mockConsoleLogger).toHaveBeenCalledWith('debug');
      });
    });

    describe('initialize', () => {
      it('should successfully initialize all components', async () => {
        const app = new ThematicDirectionsManagerApp();

        await app.initialize();

        // Verify container setup
        expect(mockAppContainer).toHaveBeenCalled();
        expect(mockRegister).toHaveBeenCalledWith(
          mockTokens.ILogger,
          mockLogger
        );
        expect(mockConfigureBaseContainer).toHaveBeenCalledWith(
          expect.any(Object),
          {
            includeGameSystems: true,
            includeCharacterBuilder: true,
            logger: mockLogger,
          }
        );

        // Verify schema loading
        expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalled();

        // Verify event registration - 3 events should be registered
        // Check that the thematic events were registered
        expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(
          expect.any(Object),
          'thematic:direction_updated#payload'
        );
        expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(
          expect.any(Object),
          'thematic:direction_deleted#payload'
        );
        expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(
          expect.any(Object),
          'thematic:orphans_cleaned#payload'
        );

        expect(mockDataRegistry.setEventDefinition).toHaveBeenCalledWith(
          'thematic:direction_updated',
          expect.any(Object)
        );
        expect(mockDataRegistry.setEventDefinition).toHaveBeenCalledWith(
          'thematic:direction_deleted',
          expect.any(Object)
        );
        expect(mockDataRegistry.setEventDefinition).toHaveBeenCalledWith(
          'thematic:orphans_cleaned',
          expect.any(Object)
        );

        // Verify controller registration
        expect(mockRegistrar).toHaveBeenCalled();
        expect(mockSingletonFactory).toHaveBeenCalledWith(
          mockTokens.ThematicDirectionsManagerController,
          expect.any(Function)
        );

        // Verify LLM adapter initialization
        expect(mockLlmAdapter.init).toHaveBeenCalledWith({
          llmConfigLoader: mockLlmConfigLoader,
        });

        // Verify controller initialization
        expect(mockControllerInitialize).toHaveBeenCalled();

        // Verify success logging
        expect(mockLogger.info).toHaveBeenCalledWith(
          'ThematicDirectionsManagerApp: Successfully initialized'
        );
      });

      it('should warn and return early if already initialized', async () => {
        const app = new ThematicDirectionsManagerApp();

        // First initialization
        await app.initialize();
        jest.clearAllMocks();

        // Second initialization attempt
        await app.initialize();

        // Should only log warning, not reinitialize
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'ThematicDirectionsManagerApp: Already initialized'
        );
        expect(mockAppContainer).not.toHaveBeenCalled();
        expect(mockConfigureBaseContainer).not.toHaveBeenCalled();
      });

      it('should handle initialization errors and show error UI', async () => {
        const testError = new Error('Schema loading failed');
        mockSchemaLoader.loadAndCompileAllSchemas.mockRejectedValue(testError);

        const app = new ThematicDirectionsManagerApp();

        await expect(app.initialize()).rejects.toThrow('Schema loading failed');

        // Verify error logging
        expect(mockLogger.error).toHaveBeenCalledWith(
          'ThematicDirectionsManagerApp: Failed to initialize',
          testError
        );

        // Verify error UI is shown
        expect(document.body.innerHTML).toContain(
          'Thematic Directions Manager Failed to Start'
        );
        expect(document.body.innerHTML).toContain('Schema loading failed');
      });

      it('should register all required events with correct schemas', async () => {
        const app = new ThematicDirectionsManagerApp();

        await app.initialize();

        // Verify DIRECTION_UPDATED event
        expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'object',
            required: ['directionId', 'field', 'oldValue', 'newValue'],
            properties: expect.objectContaining({
              directionId: expect.any(Object),
              field: expect.any(Object),
              oldValue: expect.any(Object),
              newValue: expect.any(Object),
            }),
          }),
          'thematic:direction_updated#payload'
        );

        expect(mockDataRegistry.setEventDefinition).toHaveBeenCalledWith(
          'thematic:direction_updated',
          expect.objectContaining({
            id: 'thematic:direction_updated',
            description: 'Fired when a thematic direction is updated.',
          })
        );

        // Verify DIRECTION_DELETED event
        expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'object',
            required: ['directionId'],
            properties: expect.objectContaining({
              directionId: expect.any(Object),
            }),
          }),
          'thematic:direction_deleted#payload'
        );

        expect(mockDataRegistry.setEventDefinition).toHaveBeenCalledWith(
          'thematic:direction_deleted',
          expect.objectContaining({
            id: 'thematic:direction_deleted',
            description: 'Fired when a thematic direction is deleted.',
          })
        );

        // Verify ORPHANS_CLEANED event
        expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'object',
            required: ['deletedCount'],
            properties: expect.objectContaining({
              deletedCount: expect.any(Object),
            }),
          }),
          'thematic:orphans_cleaned#payload'
        );

        expect(mockDataRegistry.setEventDefinition).toHaveBeenCalledWith(
          'thematic:orphans_cleaned',
          expect.objectContaining({
            id: 'thematic:orphans_cleaned',
            description: 'Fired when orphaned directions are cleaned up.',
          })
        );
      });

      it('should properly register the controller with dependencies', async () => {
        const app = new ThematicDirectionsManagerApp();

        await app.initialize();

        // Get the factory function that was registered
        const factoryCall = mockSingletonFactory.mock.calls.find(
          (call) => call[0] === mockTokens.ThematicDirectionsManagerController
        );
        expect(factoryCall).toBeDefined();

        const factoryFunction = factoryCall[1];

        // Call the factory function to verify it creates controller correctly
        const createdController = factoryFunction({ resolve: mockResolve });

        expect(mockThematicDirectionsManagerController).toHaveBeenCalledWith({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });
      });

      it('should handle controller initialization failure', async () => {
        const testError = new Error('Controller init failed');
        mockControllerInitialize.mockRejectedValue(testError);

        const app = new ThematicDirectionsManagerApp();

        await expect(app.initialize()).rejects.toThrow(
          'Controller init failed'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'ThematicDirectionsManagerApp: Failed to initialize',
          testError
        );
      });

      it('should handle LLM adapter initialization failure', async () => {
        const testError = new Error('LLM adapter init failed');
        mockLlmAdapter.init.mockRejectedValue(testError);

        const app = new ThematicDirectionsManagerApp();

        await expect(app.initialize()).rejects.toThrow(
          'LLM adapter init failed'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'ThematicDirectionsManagerApp: Failed to initialize',
          testError
        );
      });
    });

    describe('error display', () => {
      it('should show detailed error UI with retry and back buttons', async () => {
        const testError = new Error('Database connection failed');
        mockSchemaLoader.loadAndCompileAllSchemas.mockRejectedValue(testError);

        const app = new ThematicDirectionsManagerApp();

        try {
          await app.initialize();
        } catch (e) {
          // Expected error
        }

        const html = document.body.innerHTML;

        // Verify error UI structure
        expect(html).toContain('Thematic Directions Manager Failed to Start');
        expect(html).toContain('Database connection failed');
        expect(html).toContain('Technical Details');
        expect(html).toContain('Retry');
        expect(html).toContain('Back to Main Menu');

        // Verify button attributes
        expect(html).toContain('onclick="window.location.reload()"');
        expect(html).toContain('href="index.html"');
      });
    });
  });

  describe('Module initialization', () => {
    it('should initialize when DOM is already loaded', async () => {
      // Set document ready state to complete
      Object.defineProperty(document, 'readyState', {
        configurable: true,
        get: jest.fn(() => 'complete'),
      });

      // Reset mocks before module import
      jest.clearAllMocks();

      // Import module in isolation
      await jest.isolateModulesAsync(async () => {
        await import(
          '../../../src/thematicDirectionsManager/thematicDirectionsManagerMain.js'
        );
      });

      // Allow async initialization to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify app was initialized
      expect(mockAppContainer).toHaveBeenCalled();
      expect(mockControllerInitialize).toHaveBeenCalled();
    });

    it('should wait for DOMContentLoaded when document is loading', async () => {
      // Set document ready state to loading
      Object.defineProperty(document, 'readyState', {
        configurable: true,
        get: jest.fn(() => 'loading'),
      });

      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

      // Reset mocks before module import
      jest.clearAllMocks();

      // Import module in isolation
      await jest.isolateModulesAsync(async () => {
        await import(
          '../../../src/thematicDirectionsManager/thematicDirectionsManagerMain.js'
        );
      });

      // Verify event listener was added
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'DOMContentLoaded',
        expect.any(Function)
      );

      // App should not be initialized yet
      expect(mockAppContainer).not.toHaveBeenCalled();

      // Get the DOMContentLoaded handler
      const domContentLoadedHandler = addEventListenerSpy.mock.calls.find(
        (call) => call[0] === 'DOMContentLoaded'
      )[1];

      // Trigger DOMContentLoaded
      domContentLoadedHandler();

      // Allow async initialization to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Now app should be initialized
      expect(mockAppContainer).toHaveBeenCalled();
      expect(mockControllerInitialize).toHaveBeenCalled();

      addEventListenerSpy.mockRestore();
    });

    it('should show error in document body when initialization fails', async () => {
      // Set document ready state to complete
      Object.defineProperty(document, 'readyState', {
        configurable: true,
        get: jest.fn(() => 'complete'),
      });

      const testError = new Error('Critical startup error');
      mockConfigureBaseContainer.mockRejectedValue(testError);

      // Reset mocks before module import
      jest.clearAllMocks();

      // Import module in isolation
      await jest.isolateModulesAsync(async () => {
        await import(
          '../../../src/thematicDirectionsManager/thematicDirectionsManagerMain.js'
        );
      });

      // Allow async initialization to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify error is displayed in body
      const html = document.body.innerHTML;
      expect(html).toContain(
        'Failed to initialize thematic directions manager'
      );
      expect(html).toContain('Critical startup error');
    });
  });

  describe('Export verification', () => {
    it('should export ThematicDirectionsManagerApp class', async () => {
      let module;

      // Reset mocks and set document to loading to prevent auto-initialization
      jest.clearAllMocks();
      Object.defineProperty(document, 'readyState', {
        configurable: true,
        get: jest.fn(() => 'loading'),
      });

      await jest.isolateModulesAsync(async () => {
        module = await import(
          '../../../src/thematicDirectionsManager/thematicDirectionsManagerMain.js'
        );
      });

      expect(module.ThematicDirectionsManagerApp).toBeDefined();
      expect(typeof module.ThematicDirectionsManagerApp).toBe('function');
    });
  });
});
