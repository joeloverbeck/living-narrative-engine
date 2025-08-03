/**
 * @file Unit tests for CharacterBuilderBootstrap
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
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

// Mock dependencies
jest.mock('../../../src/dependencyInjection/appContainer.js');
jest.mock('../../../src/dependencyInjection/minimalContainerConfig.js');
jest.mock('../../../src/utils/loggerUtils.js');

// Mock fetch for schema loading
global.fetch = jest.fn();

describe('CharacterBuilderBootstrap', () => {
  let bootstrap;
  let mockContainer;
  let mockLogger;
  let mockSchemaValidator;
  let mockDataRegistry;
  let mockEventBus;
  let mockCharacterBuilderService;
  let mockController;

  // Mock controller class
  class MockController {
    constructor(deps) {
      // Store dependencies as private fields
      this.logger = deps.logger;
      this.characterBuilderService = deps.characterBuilderService;
      this.eventBus = deps.eventBus;
      this.sessionManager = deps.sessionManager;
      this.schemaValidator = deps.schemaValidator;

      mockController = this;
      this.initialize = jest.fn().mockResolvedValue();
    }
  }

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create bootstrap instance
    bootstrap = new CharacterBuilderBootstrap();

    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock schema validator
    mockSchemaValidator = {
      loadSchemas: jest.fn().mockResolvedValue(),
      addSchema: jest.fn().mockResolvedValue(),
      isSchemaLoaded: jest.fn().mockReturnValue(false),
    };

    // Mock data registry
    mockDataRegistry = {
      setEventDefinition: jest.fn(),
    };

    // Mock event bus
    mockEventBus = {
      subscribe: jest.fn(),
      dispatch: jest.fn(),
    };

    // Mock character builder service
    mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(),
    };

    // Mock container
    mockContainer = {
      resolve: jest.fn((token) => {
        const services = {
          [tokens.ILogger]: mockLogger,
          [tokens.ISchemaValidator]: mockSchemaValidator,
          [tokens.IDataRegistry]: mockDataRegistry,
          [tokens.ISafeEventDispatcher]: mockEventBus,
          [tokens.CharacterBuilderService]: mockCharacterBuilderService,
        };
        return services[token];
      }),
      register: jest.fn(),
    };

    // Mock container constructor
    AppContainer.mockImplementation(() => mockContainer);

    // Mock document methods
    document.getElementById = jest.fn();
    document.createElement = jest.fn(() => ({
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      addEventListener: jest.fn(),
    }));
    document.body.appendChild = jest.fn();

    // Mock fetch responses
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ $schema: 'test-schema' }),
    });

    // Mock performance.now()
    let time = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => (time += 100));

    // Mock ensureValidLogger to return our test logger
    jest.doMock('../../../src/utils/loggerUtils.js', () => ({
      ensureValidLogger: () => mockLogger,
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('bootstrap', () => {
    it('should bootstrap with minimal configuration', async () => {
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      const result = await bootstrap.bootstrap(config);

      expect(result).toMatchObject({
        controller: expect.any(MockController),
        container: mockContainer,
        bootstrapTime: expect.any(Number),
      });

      expect(result.controller.initialize).toHaveBeenCalled();
      expect(result.bootstrapTime).toBeGreaterThan(0);
    });

    it('should handle configuration validation errors', async () => {
      await expect(bootstrap.bootstrap({})).rejects.toThrow('Invalid pageName');

      await expect(bootstrap.bootstrap({ pageName: 'test' })).rejects.toThrow(
        'Controller class is required'
      );

      await expect(
        bootstrap.bootstrap({
          pageName: 'test',
          controllerClass: 'not-a-function',
        })
      ).rejects.toThrow('Controller class must be a constructor function');
    });

    it('should load custom schemas', async () => {
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        customSchemas: [
          '/data/schemas/custom1.json',
          '/data/schemas/custom2.json',
        ],
      };

      await bootstrap.bootstrap(config);

      // Should attempt to load schemas
      expect(global.fetch).toHaveBeenCalled();
      expect(mockSchemaValidator.addSchema).toHaveBeenCalled();
    });

    it('should register custom event definitions', async () => {
      const customEvent = {
        id: 'test:custom_event',
        description: 'Test event',
        payloadSchema: { type: 'object' },
      };

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        eventDefinitions: [customEvent],
      };

      await bootstrap.bootstrap(config);

      // Should register base events + custom event
      expect(mockDataRegistry.setEventDefinition).toHaveBeenCalledWith(
        'test:custom_event',
        customEvent
      );
    });

    it('should skip payload schema registration when already loaded from mods', async () => {
      mockSchemaValidator.isSchemaLoaded.mockImplementation((schemaId) => {
        return schemaId.includes('#payload');
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await bootstrap.bootstrap(config);

      // Should not call addSchema for payload schemas that are already loaded
      const addSchemaCalls = mockSchemaValidator.addSchema.mock.calls;
      const payloadSchemaCalls = addSchemaCalls.filter(
        (call) => call[1] && call[1].includes('#payload')
      );
      expect(payloadSchemaCalls).toHaveLength(0);
    });

    it('should successfully register events when payload schemas not pre-loaded', async () => {
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await bootstrap.bootstrap(config);

      // Should register payload schemas and events successfully
      expect(mockSchemaValidator.addSchema).toHaveBeenCalled();
      expect(mockDataRegistry.setEventDefinition).toHaveBeenCalled();

      // Verify payload schemas were registered
      const addSchemaCalls = mockSchemaValidator.addSchema.mock.calls;
      const payloadSchemaCalls = addSchemaCalls.filter(
        (call) => call[1] && call[1].includes('#payload')
      );
      expect(payloadSchemaCalls.length).toBeGreaterThan(0);
    });

    it('should handle event registration errors gracefully', async () => {
      mockSchemaValidator.addSchema.mockRejectedValueOnce(
        new Error('Schema registration failed')
      );

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      // Should not throw despite schema registration error
      await expect(bootstrap.bootstrap(config)).resolves.toBeTruthy();

      // Should still complete bootstrap successfully
      expect(mockDataRegistry.setEventDefinition).toHaveBeenCalled();
    });

    it('should execute lifecycle hooks', async () => {
      const hooks = {
        preContainer: jest.fn().mockResolvedValue(),
        preInit: jest.fn().mockResolvedValue(),
        postInit: jest.fn().mockResolvedValue(),
      };

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        hooks,
      };

      await bootstrap.bootstrap(config);

      expect(hooks.preContainer).toHaveBeenCalledWith(mockContainer);
      expect(hooks.preInit).toHaveBeenCalledWith(mockController);
      expect(hooks.postInit).toHaveBeenCalledWith(mockController);
    });

    it('should load mods when includeModLoading is true', async () => {
      const mockModsLoader = {
        loadMods: jest.fn().mockResolvedValue(),
      };

      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.ModsLoader) return mockModsLoader;
        const services = {
          [tokens.ILogger]: mockLogger,
          [tokens.ISchemaValidator]: mockSchemaValidator,
          [tokens.IDataRegistry]: mockDataRegistry,
          [tokens.ISafeEventDispatcher]: mockEventBus,
          [tokens.CharacterBuilderService]: mockCharacterBuilderService,
        };
        return services[token];
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        includeModLoading: true,
      };

      await bootstrap.bootstrap(config);

      expect(mockModsLoader.loadMods).toHaveBeenCalledWith('default', ['core']);
    });

    it('should handle missing ModsLoader gracefully', async () => {
      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.ModsLoader) return null;
        const services = {
          [tokens.ILogger]: mockLogger,
          [tokens.ISchemaValidator]: mockSchemaValidator,
          [tokens.IDataRegistry]: mockDataRegistry,
          [tokens.ISafeEventDispatcher]: mockEventBus,
          [tokens.CharacterBuilderService]: mockCharacterBuilderService,
        };
        return services[token];
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        includeModLoading: true,
      };

      // Should not throw when ModsLoader is not available
      await expect(bootstrap.bootstrap(config)).resolves.toBeTruthy();

      // Verify it completed successfully despite missing ModsLoader
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ModsLoader);
    });

    it('should handle mod loading errors gracefully', async () => {
      const mockModsLoader = {
        loadMods: jest.fn().mockRejectedValue(new Error('Failed to load mods')),
      };

      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.ModsLoader) return mockModsLoader;
        const services = {
          [tokens.ILogger]: mockLogger,
          [tokens.ISchemaValidator]: mockSchemaValidator,
          [tokens.IDataRegistry]: mockDataRegistry,
          [tokens.ISafeEventDispatcher]: mockEventBus,
          [tokens.CharacterBuilderService]: mockCharacterBuilderService,
        };
        return services[token];
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        includeModLoading: true,
      };

      // Should not throw despite mod loading failure
      await expect(bootstrap.bootstrap(config)).resolves.toBeTruthy();

      // Verify it attempted to load mods
      expect(mockModsLoader.loadMods).toHaveBeenCalledWith('default', ['core']);
    });

    it('should successfully load mods when ModsLoader is available', async () => {
      const mockModsLoader = {
        loadMods: jest.fn().mockResolvedValue(),
      };

      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.ModsLoader) return mockModsLoader;
        const services = {
          [tokens.ILogger]: mockLogger,
          [tokens.ISchemaValidator]: mockSchemaValidator,
          [tokens.IDataRegistry]: mockDataRegistry,
          [tokens.ISafeEventDispatcher]: mockEventBus,
          [tokens.CharacterBuilderService]: mockCharacterBuilderService,
        };
        return services[token];
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        includeModLoading: true,
      };

      await bootstrap.bootstrap(config);

      expect(mockModsLoader.loadMods).toHaveBeenCalledWith('default', ['core']);
    });

    it('should register custom services', async () => {
      const customService = { doSomething: jest.fn() };
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        services: {
          customService,
        },
      };

      await bootstrap.bootstrap(config);

      expect(mockContainer.register).toHaveBeenCalledWith(
        'customService',
        customService
      );
    });

    it('should register multiple custom services successfully', async () => {
      const customService1 = { method: jest.fn() };
      const customService2 = { otherMethod: jest.fn() };

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        services: {
          customService1,
          customService2,
        },
      };

      await bootstrap.bootstrap(config);

      expect(mockContainer.register).toHaveBeenCalledWith(
        'customService1',
        customService1
      );
      expect(mockContainer.register).toHaveBeenCalledWith(
        'customService2',
        customService2
      );
    });

    it('should handle service registration failures gracefully', async () => {
      mockContainer.register.mockImplementation((token) => {
        if (token === 'failingService') {
          throw new Error('Service registration failed');
        }
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        services: {
          failingService: { method: jest.fn() },
          workingService: { method: jest.fn() },
        },
      };

      // Should not throw despite service registration failure
      await expect(bootstrap.bootstrap(config)).resolves.toBeTruthy();

      // Should have attempted to register both services
      expect(mockContainer.register).toHaveBeenCalledWith(
        'failingService',
        expect.any(Object)
      );
      expect(mockContainer.register).toHaveBeenCalledWith(
        'workingService',
        expect.any(Object)
      );
    });

    it('should skip service registration when no services provided', async () => {
      const registerSpy = jest.spyOn(mockContainer, 'register');
      registerSpy.mockClear(); // Clear any previous calls

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        services: undefined, // Explicitly no services
      };

      await bootstrap.bootstrap(config);

      // Should not call register for custom services section
      // (Only calls would be from container setup, not from custom services)
      const customServiceCalls = registerSpy.mock.calls.filter(
        (call) =>
          typeof call[0] === 'string' &&
          !call[0].toString().startsWith('Symbol')
      );
      expect(customServiceCalls).toHaveLength(0);
    });

    it('should setup error display', async () => {
      const errorElement = {
        id: 'error-display',
        className: '',
        appendChild: jest.fn(),
      };
      document.getElementById.mockReturnValue(errorElement);

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        errorDisplay: {
          elementId: 'error-display',
          displayDuration: 3000,
          dismissible: false,
        },
      };

      await bootstrap.bootstrap(config);

      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'SYSTEM_ERROR_OCCURRED',
        expect.any(Function)
      );
    });

    it('should handle controller without initialize method', async () => {
      class BadController {
        constructor() {}
      }

      const config = {
        pageName: 'test-page',
        controllerClass: BadController,
      };

      await expect(bootstrap.bootstrap(config)).rejects.toThrow(
        'Controller must have an initialize method'
      );
    });

    it('should handle schema loading failures gracefully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      // Should not throw
      await expect(bootstrap.bootstrap(config)).resolves.toBeTruthy();
    });

    it('should handle missing services gracefully', async () => {
      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.CharacterBuilderService) return null;
        const services = {
          [tokens.ILogger]: mockLogger,
          [tokens.ISchemaValidator]: mockSchemaValidator,
          [tokens.IDataRegistry]: mockDataRegistry,
          [tokens.ISafeEventDispatcher]: mockEventBus,
        };
        return services[token];
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await expect(bootstrap.bootstrap(config)).rejects.toThrow(
        'CharacterBuilderService not found in container'
      );
    });

    it('should display fatal error on bootstrap failure', async () => {
      document.body.innerHTML = '';

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      // Force an error
      mockContainer.resolve.mockImplementation(() => {
        throw new Error('Container error');
      });

      await expect(bootstrap.bootstrap(config)).rejects.toThrow(
        'Container error'
      );

      // Should display error UI
      expect(document.body.innerHTML).toContain('Failed to Start');
    });

    it('should skip already loaded schemas', async () => {
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await bootstrap.bootstrap(config);

      // Should not fetch schemas that are already loaded
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should load custom schemas successfully', async () => {
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        customSchemas: ['/data/schemas/custom.json'],
      };

      await bootstrap.bootstrap(config);

      // Should successfully load schemas
      expect(global.fetch).toHaveBeenCalledWith(
        '/data/schemas/character-concept.schema.json'
      );
      expect(global.fetch).toHaveBeenCalledWith(
        '/data/schemas/thematic-direction.schema.json'
      );
      expect(global.fetch).toHaveBeenCalledWith('/data/schemas/custom.json');
      expect(mockSchemaValidator.addSchema).toHaveBeenCalled();
    });

    it('should handle mixed schema loading states', async () => {
      // Mock different schemas having different loaded states
      mockSchemaValidator.isSchemaLoaded.mockImplementation((schemaId) => {
        return (
          schemaId ===
          'schema://living-narrative-engine/character-concept.schema.json'
        );
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        customSchemas: ['/data/schemas/custom.json'],
      };

      await bootstrap.bootstrap(config);

      // Should fetch schemas that aren't already loaded
      expect(global.fetch).toHaveBeenCalledWith(
        '/data/schemas/thematic-direction.schema.json'
      );
      expect(global.fetch).toHaveBeenCalledWith('/data/schemas/custom.json');
      // Should not fetch the already loaded schema
      expect(global.fetch).not.toHaveBeenCalledWith(
        '/data/schemas/character-concept.schema.json'
      );
    });

    it('should create error display element if not found', async () => {
      document.getElementById.mockReturnValue(null);
      const mockElement = {
        id: '',
        className: '',
        appendChild: jest.fn(),
      };
      document.createElement.mockReturnValue(mockElement);

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await bootstrap.bootstrap(config);

      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(mockElement.id).toBe('error-display');
      expect(mockElement.className).toBe('cb-error-display');
      expect(document.body.appendChild).toHaveBeenCalledWith(mockElement);
    });

    it('should handle error display with dismissible errors', async () => {
      const errorElement = {
        appendChild: jest.fn(),
      };
      document.getElementById.mockReturnValue(errorElement);

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        errorDisplay: {
          dismissible: true,
          displayDuration: 2000,
        },
      };

      await bootstrap.bootstrap(config);

      // Simulate error event
      const errorHandler = mockEventBus.subscribe.mock.calls[0][1];
      const mockErrorDiv = {
        querySelector: jest.fn().mockReturnValue({
          addEventListener: jest.fn(),
        }),
        remove: jest.fn(),
      };
      document.createElement.mockReturnValue(mockErrorDiv);

      errorHandler({ payload: { error: 'Test error' } });

      expect(errorElement.appendChild).toHaveBeenCalled();
      expect(mockErrorDiv.querySelector).toHaveBeenCalledWith(
        '.cb-error-dismiss'
      );
    });

    it('should handle array validation for eventDefinitions', async () => {
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        eventDefinitions: 'not-an-array',
      };

      await expect(bootstrap.bootstrap(config)).rejects.toThrow(
        'Event definitions must be an array'
      );
    });

    it('should handle array validation for customSchemas', async () => {
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        customSchemas: 'not-an-array',
      };

      await expect(bootstrap.bootstrap(config)).rejects.toThrow(
        'Custom schemas must be an array'
      );
    });

    it('should handle object validation for services', async () => {
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        services: 'not-an-object',
      };

      await expect(bootstrap.bootstrap(config)).rejects.toThrow(
        'Services must be an object'
      );
    });

    it('should handle object validation for hooks', async () => {
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        hooks: 'not-an-object',
      };

      await expect(bootstrap.bootstrap(config)).rejects.toThrow(
        'Hooks must be an object'
      );
    });

    it('should return performance metrics during successful bootstrap', async () => {
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      const result = await bootstrap.bootstrap(config);

      // Should return valid performance metrics
      expect(result.bootstrapTime).toBeGreaterThan(0);
      expect(result.controller).toBeInstanceOf(MockController);
      expect(result.container).toBe(mockContainer);
    });

    it('should initialize controller successfully', async () => {
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      const result = await bootstrap.bootstrap(config);

      // Should have called controller.initialize
      expect(result.controller.initialize).toHaveBeenCalled();
    });

    it('should setup error display with custom configuration', async () => {
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        errorDisplay: {
          elementId: 'custom-error-display',
        },
      };

      await bootstrap.bootstrap(config);

      // Should subscribe to error events
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'SYSTEM_ERROR_OCCURRED',
        expect.any(Function)
      );
    });
  });

  describe('error handling', () => {
    it('should escape HTML in error messages', async () => {
      document.body.innerHTML = '';

      const config = {
        pageName: '<script>alert("XSS")</script>',
        controllerClass: MockController,
      };

      mockContainer.resolve.mockImplementation(() => {
        throw new Error('<img src=x onerror=alert("XSS")>');
      });

      await expect(bootstrap.bootstrap(config)).rejects.toThrow();

      // HTML should be escaped
      expect(document.body.innerHTML).not.toContain('<script>');
      expect(document.body.innerHTML).not.toContain('<img src=x');
    });

    it('should handle missing event bus gracefully', async () => {
      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.ISafeEventDispatcher) return null;
        const services = {
          [tokens.ILogger]: mockLogger,
          [tokens.ISchemaValidator]: mockSchemaValidator,
          [tokens.IDataRegistry]: mockDataRegistry,
          [tokens.CharacterBuilderService]: mockCharacterBuilderService,
        };
        return services[token];
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await expect(bootstrap.bootstrap(config)).rejects.toThrow(
        'SafeEventDispatcher not found in container'
      );
    });

    it('should log errors without logger if not available', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Make logger resolution fail
      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.ILogger) return null;
        throw new Error('Test error');
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await expect(bootstrap.bootstrap(config)).rejects.toThrow('Test error');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Fatal error'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
