/**
 * @file Unit tests for thematic-direction-main.js
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

// Mock CharacterBuilderBootstrap
const mockBootstrap = jest.fn();
const mockCharacterBuilderBootstrap = jest.fn().mockImplementation(() => ({
  bootstrap: mockBootstrap,
}));

jest.mock('../../src/characterBuilder/CharacterBuilderBootstrap.js', () => ({
  CharacterBuilderBootstrap: mockCharacterBuilderBootstrap,
}));

// Mock ThematicDirectionController
const mockThematicDirectionController = jest.fn();
jest.mock(
  '../../src/thematicDirection/controllers/thematicDirectionController.js',
  () => ({
    ThematicDirectionController: mockThematicDirectionController,
  })
);

// Mock tokens
const mockTokens = {
  ThematicDirectionController: Symbol('ThematicDirectionController'),
  ILogger: Symbol('ILogger'),
  CharacterBuilderService: Symbol('CharacterBuilderService'),
  ISafeEventDispatcher: Symbol('ISafeEventDispatcher'),
  ISchemaValidator: Symbol('ISchemaValidator'),
  SchemaLoader: Symbol('SchemaLoader'),
  LLMAdapter: Symbol('LLMAdapter'),
  LlmConfigLoader: Symbol('LlmConfigLoader'),
};

jest.mock('../../src/dependencyInjection/tokens.js', () => ({
  tokens: mockTokens,
}));

// Mock Registrar
const mockSingletonFactory = jest.fn();
const mockRegistrar = jest.fn().mockImplementation(() => ({
  singletonFactory: mockSingletonFactory,
}));

jest.mock('../../src/utils/registrarHelpers.js', () => ({
  Registrar: mockRegistrar,
}));

describe('thematic-direction-main', () => {
  let originalDocument;
  let mockController;
  let mockContainer;
  let mockLogger;
  let mockCharacterBuilderService;
  let mockEventBus;
  let mockSchemaValidator;
  let mockSchemaLoader;
  let mockLlmAdapter;
  let mockLlmConfigLoader;
  let ThematicDirectionApp;

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
    mockController = {
      initialize: jest.fn().mockResolvedValue(undefined),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(undefined),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    mockSchemaValidator = {
      addSchema: jest.fn().mockResolvedValue(undefined),
      validateAgainstSchema: jest.fn(),
    };

    mockSchemaLoader = {
      loadAndCompileAllSchemas: jest.fn().mockResolvedValue(undefined),
    };

    mockLlmAdapter = {
      init: jest.fn().mockResolvedValue(undefined),
    };

    mockLlmConfigLoader = {
      loadConfig: jest.fn(),
    };

    mockContainer = {
      resolve: jest.fn().mockImplementation((token) => {
        if (token === mockTokens.ILogger) return mockLogger;
        if (token === mockTokens.CharacterBuilderService)
          return mockCharacterBuilderService;
        if (token === mockTokens.ISafeEventDispatcher) return mockEventBus;
        if (token === mockTokens.ISchemaValidator) return mockSchemaValidator;
        if (token === mockTokens.SchemaLoader) return mockSchemaLoader;
        if (token === mockTokens.LLMAdapter) return mockLlmAdapter;
        if (token === mockTokens.LlmConfigLoader) return mockLlmConfigLoader;
        return null;
      }),
    };

    // Setup bootstrap mock to return successful result
    mockBootstrap.mockResolvedValue({
      controller: mockController,
      container: mockContainer,
      bootstrapTime: 125.5,
    });

    // Setup ThematicDirectionController constructor
    mockThematicDirectionController.mockImplementation(() => mockController);
  });

  afterEach(() => {
    // Restore original document
    global.document = originalDocument;
    jest.resetModules();
  });

  describe('ThematicDirectionApp', () => {
    beforeEach(async () => {
      // Import the module dynamically to ensure fresh mocks
      const module = await import('../../src/thematic-direction-main.js');
      ThematicDirectionApp = module.ThematicDirectionApp;
    });

    describe('constructor', () => {
      it('should create a new instance', () => {
        const app = new ThematicDirectionApp();
        expect(app).toBeInstanceOf(ThematicDirectionApp);
      });
    });

    describe('initialize', () => {
      it('should successfully initialize all components', async () => {
        const app = new ThematicDirectionApp();

        // Mock console.log to verify success message
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

        await app.initialize();

        // Verify CharacterBuilderBootstrap was created
        expect(mockCharacterBuilderBootstrap).toHaveBeenCalled();

        // Verify bootstrap was called with correct config
        expect(mockBootstrap).toHaveBeenCalledWith(
          expect.objectContaining({
            pageName: 'Thematic Direction Generator',
            controllerClass: mockThematicDirectionController,
            includeModLoading: true,
            customSchemas: ['/data/schemas/llm-configs.schema.json'],
            hooks: expect.objectContaining({
              preContainer: expect.any(Function),
            }),
            errorDisplay: expect.objectContaining({
              elementId: 'error-display',
              displayDuration: 5000,
              dismissible: true,
            }),
          })
        );

        // Verify success message was logged
        expect(consoleLogSpy).toHaveBeenCalledWith(
          'Thematic Direction Generator initialized successfully in 125.50ms'
        );

        consoleLogSpy.mockRestore();
      });

      it('should handle bootstrap errors gracefully', async () => {
        const testError = new Error('Bootstrap failed');
        mockBootstrap.mockRejectedValue(testError);

        const app = new ThematicDirectionApp();

        // Mock console.error to verify error logging
        const consoleErrorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation();

        // Should not throw but log error
        await expect(app.initialize()).resolves.not.toThrow();

        // Verify error was logged
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to initialize thematic direction generator:',
          testError
        );

        consoleErrorSpy.mockRestore();
      });

      it('should configure bootstrap with correct hooks', async () => {
        const app = new ThematicDirectionApp();

        await app.initialize();

        // Get the preContainer hook function
        const bootstrapCall = mockBootstrap.mock.calls[0];
        const config = bootstrapCall[0];
        const preContainerHook = config.hooks.preContainer;

        expect(preContainerHook).toBeInstanceOf(Function);

        // Test the preContainer hook
        await preContainerHook(mockContainer);

        // Verify registrar was created and used
        expect(mockRegistrar).toHaveBeenCalledWith(mockContainer);
        expect(mockSingletonFactory).toHaveBeenCalledWith(
          mockTokens.ThematicDirectionController,
          expect.any(Function)
        );

        // Verify schema loader was called
        expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalled();

        // Verify LLM adapter was initialized
        expect(mockLlmAdapter.init).toHaveBeenCalledWith({
          llmConfigLoader: mockLlmConfigLoader,
        });
      });

      it('should handle preContainer hook errors', async () => {
        const testError = new Error('Schema loading failed');
        mockSchemaLoader.loadAndCompileAllSchemas.mockRejectedValue(testError);

        // Make bootstrap reject due to preContainer hook error
        mockBootstrap.mockRejectedValue(testError);

        const app = new ThematicDirectionApp();

        // Mock console.error
        const consoleErrorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation();

        await expect(app.initialize()).resolves.not.toThrow();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to initialize thematic direction generator:',
          testError
        );

        consoleErrorSpy.mockRestore();
      });

      it('should properly register controller factory with dependencies', async () => {
        const app = new ThematicDirectionApp();

        await app.initialize();

        // Verify that the preContainer hook was called by accessing the config
        const bootstrapCall = mockBootstrap.mock.calls[0];
        const config = bootstrapCall[0];
        const preContainerHook = config.hooks.preContainer;

        // Call the preContainer hook directly to test registration
        await preContainerHook(mockContainer);

        // Get the factory function that was registered
        const factoryCall = mockSingletonFactory.mock.calls.find(
          (call) => call[0] === mockTokens.ThematicDirectionController
        );
        expect(factoryCall).toBeDefined();

        const factoryFunction = factoryCall[1];

        // Call the factory function to verify it creates controller correctly
        factoryFunction(mockContainer);

        expect(mockThematicDirectionController).toHaveBeenCalledWith({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });
      });

      it('should handle LLM adapter initialization failure gracefully', async () => {
        const testError = new Error('LLM init failed');
        mockLlmAdapter.init.mockRejectedValue(testError);

        // Make bootstrap reject due to LLM adapter error
        mockBootstrap.mockRejectedValue(testError);

        const app = new ThematicDirectionApp();

        // Mock console.error
        const consoleErrorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation();

        await expect(app.initialize()).resolves.not.toThrow();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to initialize thematic direction generator:',
          testError
        );

        consoleErrorSpy.mockRestore();
      });

      it('should handle missing services gracefully', async () => {
        // Make container return null for some services
        mockContainer.resolve.mockImplementation((token) => {
          if (token === mockTokens.SchemaLoader) return null;
          if (token === mockTokens.LLMAdapter) return null;
          if (token === mockTokens.ILogger) return mockLogger;
          if (token === mockTokens.CharacterBuilderService)
            return mockCharacterBuilderService;
          if (token === mockTokens.ISafeEventDispatcher) return mockEventBus;
          if (token === mockTokens.ISchemaValidator) return mockSchemaValidator;
          return null;
        });

        const app = new ThematicDirectionApp();

        // Should not throw even with missing optional services
        await expect(app.initialize()).resolves.not.toThrow();

        // Verify that missing services were handled gracefully
        expect(mockBootstrap).toHaveBeenCalled();
      });

      it('should handle missing schema loader in preContainer hook', async () => {
        // Make container return null for schema loader
        mockContainer.resolve.mockImplementation((token) => {
          if (token === mockTokens.SchemaLoader) return null;
          if (token === mockTokens.LLMAdapter) return mockLlmAdapter;
          if (token === mockTokens.ILogger) return mockLogger;
          if (token === mockTokens.CharacterBuilderService)
            return mockCharacterBuilderService;
          if (token === mockTokens.ISafeEventDispatcher) return mockEventBus;
          if (token === mockTokens.ISchemaValidator) return mockSchemaValidator;
          if (token === mockTokens.LlmConfigLoader) return mockLlmConfigLoader;
          return null;
        });

        const app = new ThematicDirectionApp();

        // Should complete successfully
        await app.initialize();

        // Get the preContainer hook and test it
        const bootstrapCall = mockBootstrap.mock.calls[0];
        const config = bootstrapCall[0];
        const preContainerHook = config.hooks.preContainer;

        // Should not throw when schema loader is null
        await expect(preContainerHook(mockContainer)).resolves.not.toThrow();
      });

      it('should handle missing LLM adapter in preContainer hook', async () => {
        // Make container return null for LLM adapter
        mockContainer.resolve.mockImplementation((token) => {
          if (token === mockTokens.SchemaLoader) return mockSchemaLoader;
          if (token === mockTokens.LLMAdapter) return null;
          if (token === mockTokens.ILogger) return mockLogger;
          if (token === mockTokens.CharacterBuilderService)
            return mockCharacterBuilderService;
          if (token === mockTokens.ISafeEventDispatcher) return mockEventBus;
          if (token === mockTokens.ISchemaValidator) return mockSchemaValidator;
          if (token === mockTokens.LlmConfigLoader) return mockLlmConfigLoader;
          return null;
        });

        const app = new ThematicDirectionApp();

        // Should complete successfully
        await app.initialize();

        // Get the preContainer hook and test it
        const bootstrapCall = mockBootstrap.mock.calls[0];
        const config = bootstrapCall[0];
        const preContainerHook = config.hooks.preContainer;

        // Should not throw when LLM adapter is null
        await expect(preContainerHook(mockContainer)).resolves.not.toThrow();
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
        await import('../../src/thematic-direction-main.js');
      });

      // Allow async initialization to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify app was initialized
      expect(mockCharacterBuilderBootstrap).toHaveBeenCalled();
      expect(mockBootstrap).toHaveBeenCalled();
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
        await import('../../src/thematic-direction-main.js');
      });

      // Verify event listener was added
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'DOMContentLoaded',
        expect.any(Function)
      );

      // App should not be initialized yet
      expect(mockCharacterBuilderBootstrap).not.toHaveBeenCalled();

      // Get the DOMContentLoaded handler
      const domContentLoadedHandler = addEventListenerSpy.mock.calls.find(
        (call) => call[0] === 'DOMContentLoaded'
      )[1];

      // Trigger DOMContentLoaded
      domContentLoadedHandler();

      // Allow async initialization to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Now app should be initialized
      expect(mockCharacterBuilderBootstrap).toHaveBeenCalled();
      expect(mockBootstrap).toHaveBeenCalled();

      addEventListenerSpy.mockRestore();
    });

    it('should show error in console when initialization fails', async () => {
      // Set document ready state to complete
      Object.defineProperty(document, 'readyState', {
        configurable: true,
        get: jest.fn(() => 'complete'),
      });

      const testError = new Error('Critical startup error');
      mockBootstrap.mockRejectedValue(testError);

      // Mock console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Reset mocks before module import
      jest.clearAllMocks();

      // Import module in isolation
      await jest.isolateModulesAsync(async () => {
        await import('../../src/thematic-direction-main.js');
      });

      // Allow async initialization to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to initialize thematic direction generator:',
        testError
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Export verification', () => {
    it('should export ThematicDirectionApp class', async () => {
      let module;

      // Reset mocks and set document to loading to prevent auto-initialization
      jest.clearAllMocks();
      Object.defineProperty(document, 'readyState', {
        configurable: true,
        get: jest.fn(() => 'loading'),
      });

      await jest.isolateModulesAsync(async () => {
        module = await import('../../src/thematic-direction-main.js');
      });

      expect(module.ThematicDirectionApp).toBeDefined();
      expect(typeof module.ThematicDirectionApp).toBe('function');
    });
  });
});
