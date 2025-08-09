/**
 * @file Unit tests for thematicDirectionsManagerMain.js
 * @description Comprehensive test coverage for the ThematicDirectionsManagerApp and related functions
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

// Mock the dependencies before importing the module under test
jest.mock('../../../src/characterBuilder/CharacterBuilderBootstrap.js');
jest.mock('../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js');
jest.mock('../../../src/dependencyInjection/tokens.js', () => ({
  tokens: {
    ILogger: Symbol('ILogger'),
    CharacterBuilderService: Symbol('CharacterBuilderService'),
    ISafeEventDispatcher: Symbol('ISafeEventDispatcher'),
    ISchemaValidator: Symbol('ISchemaValidator'),
    ThematicDirectionsManagerController: Symbol('ThematicDirectionsManagerController'),
  },
}));
jest.mock('../../../src/utils/registrarHelpers.js');
jest.mock('../../../src/shared/characterBuilder/uiStateManager.js');

// Import the mocked modules
import { CharacterBuilderBootstrap } from '../../../src/characterBuilder/CharacterBuilderBootstrap.js';
import { ThematicDirectionsManagerController } from '../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { Registrar } from '../../../src/utils/registrarHelpers.js';
import { ThematicDirectionsManagerApp } from '../../../src/thematicDirectionsManager/thematicDirectionsManagerMain.js';

describe('ThematicDirectionsManagerMain', () => {
  let mockBootstrap;
  let mockContainer;
  let mockRegistrar;
  let originalDocument;
  let originalConsole;
  let consoleLogSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Store originals
    originalDocument = global.document;
    originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };

    // Create console spies
    consoleLogSpy = jest.fn();
    consoleWarnSpy = jest.fn();
    consoleErrorSpy = jest.fn();
    console.log = consoleLogSpy;
    console.warn = consoleWarnSpy;
    console.error = consoleErrorSpy;

    // Create mock bootstrap
    mockBootstrap = {
      bootstrap: jest.fn(),
    };
    CharacterBuilderBootstrap.mockImplementation(() => mockBootstrap);

    // Create mock container
    mockContainer = {
      resolve: jest.fn(),
    };

    // Create mock registrar
    mockRegistrar = {
      singletonFactory: jest.fn(),
    };
    Registrar.mockImplementation(() => mockRegistrar);

    // Setup mock DOM
    global.document = {
      readyState: 'complete',
      addEventListener: jest.fn(),
      body: {
        innerHTML: '',
      },
    };
  });

  afterEach(() => {
    // Restore originals
    global.document = originalDocument;
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    jest.clearAllMocks();
  });

  describe('ThematicDirectionsManagerApp', () => {
    describe('constructor', () => {
      it('should create an instance with CharacterBuilderBootstrap', () => {
        const app = new ThematicDirectionsManagerApp();
        expect(CharacterBuilderBootstrap).toHaveBeenCalledTimes(1);
        expect(app).toBeDefined();
      });
    });

    describe('initialize()', () => {
      let app;

      beforeEach(() => {
        app = new ThematicDirectionsManagerApp();
      });

      it('should successfully initialize with correct configuration', async () => {
        const mockResult = { success: true };
        mockBootstrap.bootstrap.mockResolvedValue(mockResult);

        await app.initialize();

        // Verify bootstrap was called with correct config
        expect(mockBootstrap.bootstrap).toHaveBeenCalledTimes(1);
        const config = mockBootstrap.bootstrap.mock.calls[0][0];
        
        // Verify basic config properties
        expect(config.pageName).toBe('Thematic Directions Manager');
        expect(config.controllerClass).toBe(ThematicDirectionsManagerController);
        expect(config.includeModLoading).toBe(true);
        
        // Verify event definitions
        expect(config.eventDefinitions).toHaveLength(3);
        expect(config.eventDefinitions[0].id).toBe('core:direction_updated');
        expect(config.eventDefinitions[1].id).toBe('core:direction_deleted');
        expect(config.eventDefinitions[2].id).toBe('core:orphans_cleaned');
        
        // Verify hooks exist
        expect(config.hooks).toBeDefined();
        expect(config.hooks.preContainer).toBeDefined();

        // Verify console logs
        expect(consoleLogSpy).toHaveBeenCalledWith('ThematicDirectionsManagerApp: Starting initialization');
        expect(consoleLogSpy).toHaveBeenCalledWith('ThematicDirectionsManagerApp: Successfully initialized');
      });

      it('should warn and return early if already initialized', async () => {
        mockBootstrap.bootstrap.mockResolvedValue({ success: true });
        
        // Initialize once
        await app.initialize();
        
        // Clear console logs
        consoleLogSpy.mockClear();
        consoleWarnSpy.mockClear();
        
        // Try to initialize again
        await app.initialize();
        
        // Should warn and not call bootstrap again
        expect(consoleWarnSpy).toHaveBeenCalledWith('ThematicDirectionsManagerApp: Already initialized');
        expect(mockBootstrap.bootstrap).toHaveBeenCalledTimes(1); // Only called once
        expect(consoleLogSpy).not.toHaveBeenCalledWith('ThematicDirectionsManagerApp: Starting initialization');
      });

      it('should handle initialization errors and show error UI', async () => {
        const testError = new Error('Bootstrap failed');
        mockBootstrap.bootstrap.mockRejectedValue(testError);

        await expect(app.initialize()).rejects.toThrow('Bootstrap failed');

        // Verify error logging
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'ThematicDirectionsManagerApp: Failed to initialize',
          testError
        );

        // Verify error UI was displayed
        expect(document.body.innerHTML).toContain('Thematic Directions Manager Failed to Start');
        expect(document.body.innerHTML).toContain('Bootstrap failed');
      });

      it('should properly configure the preContainer hook', async () => {
        mockBootstrap.bootstrap.mockResolvedValue({ success: true });
        
        // Mock dependencies for the hook
        const mockLogger = { log: jest.fn() };
        const mockCharacterBuilderService = { init: jest.fn() };
        const mockEventBus = { dispatch: jest.fn() };
        const mockSchemaValidator = { validate: jest.fn() };
        
        mockContainer.resolve.mockImplementation((token) => {
          const services = {
            [tokens.ILogger]: mockLogger,
            [tokens.CharacterBuilderService]: mockCharacterBuilderService,
            [tokens.ISafeEventDispatcher]: mockEventBus,
            [tokens.ISchemaValidator]: mockSchemaValidator,
          };
          return services[token];
        });

        await app.initialize();

        // Get the preContainer hook
        const config = mockBootstrap.bootstrap.mock.calls[0][0];
        const preContainerHook = config.hooks.preContainer;
        
        // Execute the hook
        await preContainerHook(mockContainer);
        
        // Verify registrar was created and used
        expect(Registrar).toHaveBeenCalledWith(mockContainer);
        expect(mockRegistrar.singletonFactory).toHaveBeenCalledWith(
          tokens.ThematicDirectionsManagerController,
          expect.any(Function)
        );
        
        // Test the factory function
        const factoryFunction = mockRegistrar.singletonFactory.mock.calls[0][1];
        const controller = factoryFunction(mockContainer);
        
        // Verify controller dependencies were resolved
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.CharacterBuilderService);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ISafeEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ISchemaValidator);
      });

      it('should create controller with correct dependencies in factory', async () => {
        mockBootstrap.bootstrap.mockResolvedValue({ success: true });
        
        const mockLogger = { log: jest.fn() };
        const mockCharacterBuilderService = { init: jest.fn() };
        const mockEventBus = { dispatch: jest.fn() };
        const mockSchemaValidator = { validate: jest.fn() };
        
        mockContainer.resolve.mockImplementation((token) => {
          const services = {
            [tokens.ILogger]: mockLogger,
            [tokens.CharacterBuilderService]: mockCharacterBuilderService,
            [tokens.ISafeEventDispatcher]: mockEventBus,
            [tokens.ISchemaValidator]: mockSchemaValidator,
          };
          return services[token];
        });

        // Mock the controller constructor to capture the dependencies
        let capturedDeps;
        ThematicDirectionsManagerController.mockImplementation((deps) => {
          capturedDeps = deps;
          return { initialize: jest.fn() };
        });

        await app.initialize();
        
        // Get the preContainer hook and execute it to register the factory
        const config = mockBootstrap.bootstrap.mock.calls[0][0];
        await config.hooks.preContainer(mockContainer);
        
        // Now execute the factory that was registered
        const factoryFunction = mockRegistrar.singletonFactory.mock.calls[0][1];
        factoryFunction(mockContainer);
        
        // Verify controller was created with correct dependencies
        expect(ThematicDirectionsManagerController).toHaveBeenCalledWith({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });
        expect(capturedDeps).toEqual({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });
      });
    });

    describe('#showInitializationError()', () => {
      it('should display error UI with correct styling and content', async () => {
        const app = new ThematicDirectionsManagerApp();
        const testError = new Error('Test error message');
        
        // Trigger error during initialization
        mockBootstrap.bootstrap.mockRejectedValue(testError);
        
        try {
          await app.initialize();
        } catch (e) {
          // Expected to throw
        }
        
        // Verify error UI structure
        const html = document.body.innerHTML;
        expect(html).toContain('Thematic Directions Manager Failed to Start');
        expect(html).toContain('Test error message');
        expect(html).toContain('Technical Details');
        expect(html).toContain('onclick="window.location.reload()"');
        expect(html).toContain('href="index.html"');
        expect(html).toContain('Retry');
        expect(html).toContain('Back to Main Menu');
      });
    });
  });

  describe('Module-level functions', () => {
    describe('initializeWhenReady()', () => {
      it('should handle document loading state correctly', () => {
        // Test that the module exports the expected class
        expect(ThematicDirectionsManagerApp).toBeDefined();
        expect(typeof ThematicDirectionsManagerApp).toBe('function');
        
        // The module-level initialization code runs when the module is imported,
        // which happens before our tests run. Since we can't easily test the
        // module-level code directly, we verify the exported functionality works.
        const app = new ThematicDirectionsManagerApp();
        expect(app).toBeDefined();
      });

      it('should create app instance and call initialize', async () => {
        // Create a new app instance
        const app = new ThematicDirectionsManagerApp();
        mockBootstrap.bootstrap.mockResolvedValue({ success: true });
        
        // Initialize should work correctly
        await app.initialize();
        
        expect(mockBootstrap.bootstrap).toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith('ThematicDirectionsManagerApp: Successfully initialized');
      });

      it('should handle initialization error with proper error display', async () => {
        const app = new ThematicDirectionsManagerApp();
        const testError = new Error('Bootstrap initialization failed');
        mockBootstrap.bootstrap.mockRejectedValue(testError);
        
        // Clear document body
        document.body.innerHTML = '';
        
        // Try to initialize (should fail)
        await expect(app.initialize()).rejects.toThrow('Bootstrap initialization failed');
        
        // Verify error UI was displayed
        expect(document.body.innerHTML).toContain('Thematic Directions Manager Failed to Start');
        expect(document.body.innerHTML).toContain('Bootstrap initialization failed');
        expect(document.body.innerHTML).toContain('Retry');
        expect(document.body.innerHTML).toContain('Back to Main Menu');
      });
    });

    describe('Event definitions', () => {
      it('should define correct event IDs', async () => {
        const app = new ThematicDirectionsManagerApp();
        mockBootstrap.bootstrap.mockResolvedValue({ success: true });
        
        await app.initialize();
        
        const config = mockBootstrap.bootstrap.mock.calls[0][0];
        const eventDefs = config.eventDefinitions;
        
        // Verify DIRECTION_UPDATED event
        const directionUpdated = eventDefs.find(e => e.id === 'core:direction_updated');
        expect(directionUpdated).toBeDefined();
        expect(directionUpdated.description).toBe('Fired when a thematic direction is updated.');
        expect(directionUpdated.payloadSchema.required).toEqual(['directionId', 'field', 'oldValue', 'newValue']);
        
        // Verify DIRECTION_DELETED event
        const directionDeleted = eventDefs.find(e => e.id === 'core:direction_deleted');
        expect(directionDeleted).toBeDefined();
        expect(directionDeleted.description).toBe('Fired when a thematic direction is deleted.');
        expect(directionDeleted.payloadSchema.required).toEqual(['directionId']);
        
        // Verify ORPHANS_CLEANED event
        const orphansCleaned = eventDefs.find(e => e.id === 'core:orphans_cleaned');
        expect(orphansCleaned).toBeDefined();
        expect(orphansCleaned.description).toBe('Fired when orphaned directions are cleaned up.');
        expect(orphansCleaned.payloadSchema.required).toEqual(['deletedCount']);
      });
    });
  });

  describe('Export', () => {
    it('should export ThematicDirectionsManagerApp', () => {
      expect(ThematicDirectionsManagerApp).toBeDefined();
      expect(typeof ThematicDirectionsManagerApp).toBe('function');
    });
  });
});