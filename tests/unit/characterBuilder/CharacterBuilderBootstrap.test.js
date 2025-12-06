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
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

// Mock dependencies
jest.mock('../../../src/dependencyInjection/appContainer.js');
jest.mock('../../../src/dependencyInjection/minimalContainerConfig.js');
jest.mock('../../../src/utils/loggerUtils.js', () => ({
  ensureValidLogger: jest.fn(),
}));

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
  let mockLLMAdapter;
  let mockLlmConfigLoader;
  let mockLLMConfigurationManager;
  let mockCharacterStorageService;

  // Helper function to get all standard services
  const getAllServices = (overrides = {}) => ({
    [tokens.ILogger]: mockLogger,
    [tokens.ISchemaValidator]: mockSchemaValidator,
    [tokens.IDataRegistry]: mockDataRegistry,
    [tokens.ISafeEventDispatcher]: mockEventBus,
    [tokens.CharacterBuilderService]: mockCharacterBuilderService,
    [tokens.LLMAdapter]: mockLLMAdapter,
    [tokens.LlmConfigLoader]: mockLlmConfigLoader,
    [tokens.ILLMConfigurationManager]: mockLLMConfigurationManager,
    [tokens.CharacterStorageService]: mockCharacterStorageService,
    ...overrides,
  });

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

    // Mock LLM services
    mockLLMAdapter = {
      init: jest.fn().mockResolvedValue(),
    };

    mockLlmConfigLoader = {
      loadConfig: jest.fn().mockResolvedValue({}),
    };

    mockLLMConfigurationManager = {
      init: jest.fn().mockResolvedValue(),
      isInitialized: false,
    };

    // Mock Character Storage Service
    mockCharacterStorageService = {
      initialize: jest.fn().mockResolvedValue(),
    };

    // Mock container
    mockContainer = {
      resolve: jest.fn((token) => {
        const services = getAllServices();
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
    const { ensureValidLogger } = require('../../../src/utils/loggerUtils.js');
    ensureValidLogger.mockReturnValue(mockLogger);
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
        // Return true for all payload schemas except the critical system error event
        // which is always registered early
        return (
          schemaId.includes('#payload') &&
          !schemaId.includes('core:system_error_occurred')
        );
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await bootstrap.bootstrap(config);

      // The critical system error event is registered early (twice if called multiple times)
      // but other payload schemas should not be registered if already loaded
      const addSchemaCalls = mockSchemaValidator.addSchema.mock.calls;
      const payloadSchemaCalls = addSchemaCalls.filter(
        (call) => call[1] && call[1].includes('#payload')
      );
      // Expect only the critical system error event payload schema to be registered
      const criticalEventCalls = payloadSchemaCalls.filter((call) =>
        call[1].includes('core:system_error_occurred')
      );
      expect(criticalEventCalls.length).toBeGreaterThan(0);

      // No other payload schemas should be registered
      const otherPayloadCalls = payloadSchemaCalls.filter(
        (call) => !call[1].includes('core:system_error_occurred')
      );
      expect(otherPayloadCalls).toHaveLength(0);
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

    it('logs when critical system event services are not ready yet', async () => {
      let firstDataRegistryCall = true;
      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.IDataRegistry && firstDataRegistryCall) {
          firstDataRegistryCall = false;
          return {}; // Missing setEventDefinition
        }
        const services = getAllServices();
        return services[token];
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await bootstrap.bootstrap(config);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[CharacterBuilderBootstrap] Services not ready for event registration, will register later'
      );
    });

    it('logs when critical system event service resolution throws initially', async () => {
      let firstDataRegistryCall = true;
      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.IDataRegistry && firstDataRegistryCall) {
          firstDataRegistryCall = false;
          throw new Error('resolve pending');
        }
        const services = getAllServices();
        return services[token];
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await bootstrap.bootstrap(config);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[CharacterBuilderBootstrap] Services not ready for event registration: resolve pending'
      );
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
        const services = getAllServices();
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
          [tokens.LLMAdapter]: mockLLMAdapter,
          [tokens.LlmConfigLoader]: mockLlmConfigLoader,
          [tokens.ILLMConfigurationManager]: mockLLMConfigurationManager,
          [tokens.CharacterStorageService]: mockCharacterStorageService,
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
        const services = getAllServices();
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
        const services = getAllServices();
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

    it('warns when LlmConfigLoader is unavailable during LLM initialization', async () => {
      mockLlmConfigLoader = null;

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await bootstrap.bootstrap(config);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[CharacterBuilderBootstrap] LlmConfigLoader not available, skipping LLM initialization'
      );
    });

    it('logs debug when LLM adapter is unavailable', async () => {
      const services = getAllServices({ [tokens.LLMAdapter]: undefined });
      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.LLMAdapter) {
          return undefined;
        }
        return services[token];
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await bootstrap.bootstrap(config);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[CharacterBuilderBootstrap] LLM adapter not available or already initialized'
      );
    });

    it('logs an error when LLM services fail to initialize', async () => {
      let firstLLMAdapterCall = true;
      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.LLMAdapter && firstLLMAdapterCall) {
          firstLLMAdapterCall = false;
          throw new Error('adapter failure');
        }
        const services = getAllServices();
        return services[token];
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await bootstrap.bootstrap(config);

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[CharacterBuilderBootstrap] Failed to initialize LLM services: adapter failure',
        expect.any(Error)
      );
    });

    it('propagates CharacterStorageService initialization failures', async () => {
      const storageError = new Error('storage init failed');
      mockCharacterStorageService.initialize.mockRejectedValueOnce(
        storageError
      );

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await expect(bootstrap.bootstrap(config)).rejects.toThrow(
        'storage init failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[CharacterBuilderBootstrap] Failed to initialize CharacterStorageService: storage init failed',
        storageError
      );
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

    it('registers constructor-based custom services with empty dependencies metadata', async () => {
      class CustomService {}

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        services: {
          customService: CustomService,
        },
      };

      await bootstrap.bootstrap(config);

      expect(mockContainer.register).toHaveBeenCalledWith(
        'customService',
        CustomService,
        { dependencies: [] }
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

    it('resolves core motivations services using specialized tokens when provided as constructors', async () => {
      class CoreMotivationsDisplayEnhancer {}
      class CoreMotivationsGenerator {}

      const enhancerInstance = { enhance: jest.fn() };
      const generatorInstance = { generate: jest.fn() };

      const baseServices = getAllServices({
        [tokens.CoreMotivationsDisplayEnhancer]: enhancerInstance,
        [tokens.CoreMotivationsGenerator]: generatorInstance,
      });

      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.CoreMotivationsDisplayEnhancer) {
          return enhancerInstance;
        }
        if (token === tokens.CoreMotivationsGenerator) {
          return generatorInstance;
        }
        if (token === 'displayEnhancer') {
          return enhancerInstance;
        }
        if (token === 'coreMotivationsGenerator') {
          return generatorInstance;
        }
        return baseServices[token];
      });

      class CustomController {
        constructor(deps) {
          this.deps = deps;
          this.initialize = jest.fn().mockResolvedValue();
        }
      }

      const config = {
        pageName: 'test-page',
        controllerClass: CustomController,
        services: {
          displayEnhancer: CoreMotivationsDisplayEnhancer,
          coreMotivationsGenerator: CoreMotivationsGenerator,
        },
      };

      const result = await bootstrap.bootstrap(config);

      expect(result.controller.deps.displayEnhancer).toBe(enhancerInstance);
      expect(result.controller.deps.coreMotivationsGenerator).toBe(
        generatorInstance
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.CoreMotivationsDisplayEnhancer
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.CoreMotivationsGenerator
      );
    });

    it('instantiates TraitsDisplayEnhancer when it is not registered in the container', async () => {
      class TraitsDisplayEnhancer {
        constructor({ logger }) {
          this.logger = logger;
        }
      }

      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.TraitsDisplayEnhancer) {
          throw new Error('not registered');
        }
        const services = getAllServices();
        return services[token];
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        services: {
          traitsDisplayEnhancer: TraitsDisplayEnhancer,
        },
      };

      await bootstrap.bootstrap(config);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Service 'traitsDisplayEnhancer' (TraitsDisplayEnhancer) not found in container. Attempting to instantiate..."
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully instantiated TraitsDisplayEnhancer with logger dependency.'
      );
    });

    it('warns when an unknown custom service cannot be resolved from the container', async () => {
      class MysteryService {}

      mockContainer.resolve.mockImplementation((token) => {
        if (token === 'mysteryService') {
          throw new Error('missing service');
        }
        const services = getAllServices();
        return services[token];
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        services: {
          mysteryService: MysteryService,
        },
      };

      await bootstrap.bootstrap(config);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Unknown service 'MysteryService'. Consider registering it in the DI container."
      );
    });

    it('logs an error when instantiating a fallback display enhancer fails', async () => {
      class TraitsDisplayEnhancer {
        constructor() {
          throw new Error('boom');
        }
      }

      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.TraitsDisplayEnhancer) {
          throw new Error('not registered');
        }
        const services = getAllServices();
        return services[token];
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        services: {
          traitsDisplayEnhancer: TraitsDisplayEnhancer,
        },
      };

      await bootstrap.bootstrap(config);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to instantiate TraitsDisplayEnhancer: boom'
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
        SYSTEM_ERROR_OCCURRED_ID,
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
        const services = getAllServices();
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
        SYSTEM_ERROR_OCCURRED_ID,
        expect.any(Function)
      );
    });

    it('should log bootstrap completion with performance metrics', async () => {
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await bootstrap.bootstrap(config);

      // Should log bootstrap completion info message
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Page 'test-page' bootstrapped in"),
        expect.objectContaining({ metrics: expect.any(Object) })
      );
    });

    it('should log container setup completion', async () => {
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await bootstrap.bootstrap(config);

      // Should log container setup debug message
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Container setup completed in')
      );
    });

    it('should log schema loading completion', async () => {
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        customSchemas: ['/data/schemas/custom.json'],
      };

      await bootstrap.bootstrap(config);

      // Should log schema loading info and debug messages
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Loading 4 schemas')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Schema loading completed in')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Loaded schema:')
      );
    });

    it('should log schema already loaded when schema exists', async () => {
      // Mock some schemas as already loaded
      mockSchemaValidator.isSchemaLoaded.mockImplementation((schemaId) => {
        return schemaId.includes('character-concept');
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await bootstrap.bootstrap(config);

      // Should log debug message for already loaded schema
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Schema already loaded:')
      );
    });

    it('should log event registration completion', async () => {
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await bootstrap.bootstrap(config);

      // Should log event registration debug messages
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Event registration completed in')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Registered event:')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Registered payload schema:')
      );
    });

    it('should handle includeModLoading with base event skipping', async () => {
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        includeModLoading: true,
      };

      await bootstrap.bootstrap(config);

      // Should log debug message about skipping base events
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Skipping base event registration - events will be loaded from mods'
        )
      );
    });

    it('should log controller initialization completion', async () => {
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await bootstrap.bootstrap(config);

      // Should log controller initialization debug message
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Controller initialization completed in')
      );
    });

    it('should log error display configuration', async () => {
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await bootstrap.bootstrap(config);

      // Should log error display configuration
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Error display configured with element: error-display'
        )
      );
    });
  });

  describe('schema loading error paths', () => {
    it('should log warning when schema fetch fails', async () => {
      global.fetch.mockImplementation(async (url) => {
        if (url.includes('custom.json')) {
          return { ok: false, status: 404 };
        }
        return { ok: true, json: async () => ({ $schema: 'test-schema' }) };
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        customSchemas: ['/data/schemas/custom.json'],
      };

      await bootstrap.bootstrap(config);

      // Should log warning for failed schema fetch
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to load schema /data/schemas/custom.json: Failed to load schema: 404'
        )
      );
    });

    it('should handle schema fetch failure without logger (lines 259-275)', async () => {
      const localBootstrap = new CharacterBuilderBootstrap();

      global.fetch.mockImplementation(async (url) => {
        if (url.includes('custom.json')) {
          return { ok: false, status: 404 };
        }
        return { ok: true, json: async () => ({ $schema: 'test-schema' }) };
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        customSchemas: ['/data/schemas/custom.json'],
      };

      // Mock ensureValidLogger to return null
      const {
        ensureValidLogger,
      } = require('../../../src/utils/loggerUtils.js');
      ensureValidLogger.mockReturnValue(null);

      mockContainer.resolve.mockImplementation((token) => {
        const services = getAllServices({
          [tokens.ILogger]: null,
        });
        return services[token];
      });

      const result = await localBootstrap.bootstrap(config);

      // Should complete successfully without schema failure logging
      expect(result.controller).toBeInstanceOf(MockController);
    });

    it('should handle schema JSON parsing error without logger', async () => {
      const localBootstrap = new CharacterBuilderBootstrap();

      global.fetch.mockImplementation(async (url) => {
        if (url.includes('custom.json')) {
          return {
            ok: true,
            json: async () => {
              throw new Error('Invalid JSON');
            },
          };
        }
        return { ok: true, json: async () => ({ $schema: 'test-schema' }) };
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        customSchemas: ['/data/schemas/custom.json'],
      };

      // Mock ensureValidLogger to return null
      const {
        ensureValidLogger,
      } = require('../../../src/utils/loggerUtils.js');
      ensureValidLogger.mockReturnValue(null);

      mockContainer.resolve.mockImplementation((token) => {
        const services = getAllServices({
          [tokens.ILogger]: null,
        });
        return services[token];
      });

      const result = await localBootstrap.bootstrap(config);

      // Should complete successfully without JSON error logging
      expect(result.controller).toBeInstanceOf(MockController);
    });

    it('should handle schema validator error without logger', async () => {
      const localBootstrap = new CharacterBuilderBootstrap();

      // Mock schema validator to fail on specific schema
      mockSchemaValidator.addSchema.mockImplementation(async (schema, id) => {
        if (id.includes('custom')) {
          throw new Error('Schema validation failed');
        }
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        customSchemas: ['/data/schemas/custom.json'],
      };

      // Mock ensureValidLogger to return null
      const {
        ensureValidLogger,
      } = require('../../../src/utils/loggerUtils.js');
      ensureValidLogger.mockReturnValue(null);

      mockContainer.resolve.mockImplementation((token) => {
        const services = getAllServices({
          [tokens.ILogger]: null,
        });
        return services[token];
      });

      const result = await localBootstrap.bootstrap(config);

      // Should complete successfully without schema validation error logging
      expect(result.controller).toBeInstanceOf(MockController);
    });

    it('should handle schema loading debug messages without logger', async () => {
      const localBootstrap = new CharacterBuilderBootstrap();

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        customSchemas: ['/data/schemas/custom.json'],
      };

      // Mock ensureValidLogger to return null
      const {
        ensureValidLogger,
      } = require('../../../src/utils/loggerUtils.js');
      ensureValidLogger.mockReturnValue(null);

      mockContainer.resolve.mockImplementation((token) => {
        const services = getAllServices({
          [tokens.ILogger]: null,
        });
        return services[token];
      });

      const result = await localBootstrap.bootstrap(config);

      // Should complete successfully without debug logging for loaded schemas
      expect(result.controller).toBeInstanceOf(MockController);
    });

    it('should log warning when schema JSON parsing fails', async () => {
      global.fetch.mockImplementation(async (url) => {
        if (url.includes('custom.json')) {
          return {
            ok: true,
            json: async () => {
              throw new Error('Invalid JSON');
            },
          };
        }
        return { ok: true, json: async () => ({ $schema: 'test-schema' }) };
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        customSchemas: ['/data/schemas/custom.json'],
      };

      await bootstrap.bootstrap(config);

      // Should log warning for JSON parsing error
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to load schema /data/schemas/custom.json: Invalid JSON'
        )
      );
    });

    it('should log warning when schema validator addSchema fails', async () => {
      mockSchemaValidator.addSchema.mockImplementation(async (schema, id) => {
        if (id.includes('custom')) {
          throw new Error('Schema validation failed');
        }
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        customSchemas: ['/data/schemas/custom.json'],
      };

      await bootstrap.bootstrap(config);

      // Should log warning for schema validator error
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to load schema /data/schemas/custom.json: Schema validation failed'
        )
      );
    });

    it('should skip payload schema when already loaded and log debug message', async () => {
      mockSchemaValidator.isSchemaLoaded.mockImplementation((schemaId) => {
        return schemaId.includes('#payload');
      });

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

      // Should log debug message about skipping payload schema registration
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Skipping payload schema registration for test:custom_event#payload - already loaded from mods'
        )
      );
    });

    it('should log warning when event registration fails', async () => {
      mockDataRegistry.setEventDefinition.mockImplementation((id) => {
        if (id === 'core:character_concept_created') {
          throw new Error('Event registration failed');
        }
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        includeModLoading: false, // This ensures base events are registered
      };

      await bootstrap.bootstrap(config);

      // Should log warning for failed event registration
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to register event core:character_concept_created: Event registration failed'
        )
      );
    });

    it('should handle event registration debug logging without logger (lines 443-470)', async () => {
      const localBootstrap = new CharacterBuilderBootstrap();

      const customEvent = {
        id: 'test:custom_event',
        description: 'Test event',
        payloadSchema: { type: 'object' },
      };

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        eventDefinitions: [customEvent],
        includeModLoading: false, // This ensures base events are registered
      };

      // Mock ensureValidLogger to return null
      const {
        ensureValidLogger,
      } = require('../../../src/utils/loggerUtils.js');
      ensureValidLogger.mockReturnValue(null);

      mockContainer.resolve.mockImplementation((token) => {
        const services = getAllServices({
          [tokens.ILogger]: null,
        });
        return services[token];
      });

      const result = await localBootstrap.bootstrap(config);

      // Should complete successfully without event registration debug logging
      expect(result.controller).toBeInstanceOf(MockController);
      // Should still register the events
      expect(mockDataRegistry.setEventDefinition).toHaveBeenCalledWith(
        'test:custom_event',
        customEvent
      );
    });

    it('should handle event registration error without logger', async () => {
      const localBootstrap = new CharacterBuilderBootstrap();

      // Mock event registration to fail
      mockDataRegistry.setEventDefinition.mockImplementation((id) => {
        if (id === 'core:character_concept_created') {
          throw new Error('Event registration failed');
        }
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        includeModLoading: false, // This ensures base events are registered
      };

      // Mock ensureValidLogger to return null
      const {
        ensureValidLogger,
      } = require('../../../src/utils/loggerUtils.js');
      ensureValidLogger.mockReturnValue(null);

      mockContainer.resolve.mockImplementation((token) => {
        const services = getAllServices({
          [tokens.ILogger]: null,
        });
        return services[token];
      });

      const result = await localBootstrap.bootstrap(config);

      // Should complete successfully without event registration error logging
      expect(result.controller).toBeInstanceOf(MockController);
    });

    it('should handle payload schema registration skipping without logger', async () => {
      const localBootstrap = new CharacterBuilderBootstrap();

      // Mock payload schemas as already loaded
      mockSchemaValidator.isSchemaLoaded.mockImplementation((schemaId) => {
        return schemaId.includes('#payload');
      });

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

      // Mock ensureValidLogger to return null
      const {
        ensureValidLogger,
      } = require('../../../src/utils/loggerUtils.js');
      ensureValidLogger.mockReturnValue(null);

      mockContainer.resolve.mockImplementation((token) => {
        const services = getAllServices({
          [tokens.ILogger]: null,
        });
        return services[token];
      });

      const result = await localBootstrap.bootstrap(config);

      // Should complete successfully without payload schema skip debug logging
      expect(result.controller).toBeInstanceOf(MockController);
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
        const services = getAllServices();
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

      // Create new bootstrap instance to avoid logger state
      const localBootstrap = new CharacterBuilderBootstrap();

      // Make container creation throw before logger is resolved
      AppContainer.mockImplementation(() => {
        throw new Error('Container creation failed');
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await expect(localBootstrap.bootstrap(config)).rejects.toThrow(
        'Container creation failed'
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Fatal error during initialization of 'test-page': Container creation failed"
        ),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('ModsLoader success path', () => {
    it('should log ModsLoader loading messages when mods loaded successfully', async () => {
      const mockModsLoader = {
        loadMods: jest.fn().mockResolvedValue(),
      };

      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.ModsLoader) return mockModsLoader;
        const services = getAllServices();
        return services[token];
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        includeModLoading: true,
      };

      await bootstrap.bootstrap(config);

      // Should log mod loading start and completion messages
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[CharacterBuilderBootstrap] Loading core mod...'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[CharacterBuilderBootstrap] Core mod loaded successfully'
      );
      expect(mockModsLoader.loadMods).toHaveBeenCalledWith('default', ['core']);
    });

    it('should handle mod loading without logger (lines 489-508)', async () => {
      const localBootstrap = new CharacterBuilderBootstrap();

      const mockModsLoader = {
        loadMods: jest.fn().mockResolvedValue(),
      };

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        includeModLoading: true,
      };

      // Mock ensureValidLogger to return null
      const {
        ensureValidLogger,
      } = require('../../../src/utils/loggerUtils.js');
      ensureValidLogger.mockReturnValue(null);

      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.ModsLoader) return mockModsLoader;
        const services = getAllServices({
          [tokens.ILogger]: null,
        });
        return services[token];
      });

      const result = await localBootstrap.bootstrap(config);

      // Should complete successfully without mod loading logging
      expect(result.controller).toBeInstanceOf(MockController);
      expect(mockModsLoader.loadMods).toHaveBeenCalledWith('default', ['core']);
    });

    it('should handle missing ModsLoader without logger', async () => {
      const localBootstrap = new CharacterBuilderBootstrap();

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        includeModLoading: true,
      };

      // Mock ensureValidLogger to return null
      const {
        ensureValidLogger,
      } = require('../../../src/utils/loggerUtils.js');
      ensureValidLogger.mockReturnValue(null);

      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.ModsLoader) return null;
        const services = getAllServices({
          [tokens.ILogger]: null,
        });
        return services[token];
      });

      const result = await localBootstrap.bootstrap(config);

      // Should complete successfully without ModsLoader warning logging
      expect(result.controller).toBeInstanceOf(MockController);
    });

    it('should handle mod loading errors without logger', async () => {
      const localBootstrap = new CharacterBuilderBootstrap();

      const mockModsLoader = {
        loadMods: jest.fn().mockRejectedValue(new Error('Failed to load mods')),
      };

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        includeModLoading: true,
      };

      // Mock ensureValidLogger to return null
      const {
        ensureValidLogger,
      } = require('../../../src/utils/loggerUtils.js');
      ensureValidLogger.mockReturnValue(null);

      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.ModsLoader) return mockModsLoader;
        const services = getAllServices({
          [tokens.ILogger]: null,
        });
        return services[token];
      });

      const result = await localBootstrap.bootstrap(config);

      // Should complete successfully without mod loading error logging
      expect(result.controller).toBeInstanceOf(MockController);
      expect(mockModsLoader.loadMods).toHaveBeenCalledWith('default', ['core']);
    });
  });

  describe('custom service registration logging', () => {
    it('should log successful custom service registration', async () => {
      const customService = { doSomething: jest.fn() };
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        services: {
          customService,
        },
      };

      await bootstrap.bootstrap(config);

      // Should log successful service registration
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[CharacterBuilderBootstrap] Registered custom service: customService'
      );
      expect(mockContainer.register).toHaveBeenCalledWith(
        'customService',
        customService
      );
    });

    it('should log failed custom service registration', async () => {
      mockContainer.register.mockImplementation((token) => {
        if (token === 'failingService') {
          throw new Error('Registration failed');
        }
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        services: {
          failingService: { method: jest.fn() },
        },
      };

      await bootstrap.bootstrap(config);

      // Should log service registration failure
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[CharacterBuilderBootstrap] Failed to register service failingService: Registration failed'
      );
    });

    it('should handle successful service registration without logger (lines 533-539)', async () => {
      const localBootstrap = new CharacterBuilderBootstrap();

      const customService = { doSomething: jest.fn() };
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        services: {
          customService,
        },
      };

      // Mock ensureValidLogger to return null
      const {
        ensureValidLogger,
      } = require('../../../src/utils/loggerUtils.js');
      ensureValidLogger.mockReturnValue(null);

      mockContainer.resolve.mockImplementation((token) => {
        const services = getAllServices({
          [tokens.ILogger]: null,
        });
        return services[token];
      });

      const result = await localBootstrap.bootstrap(config);

      // Should complete successfully without service registration debug logging
      expect(result.controller).toBeInstanceOf(MockController);
      expect(mockContainer.register).toHaveBeenCalledWith(
        'customService',
        customService
      );
    });

    it('should handle failed service registration without logger', async () => {
      const localBootstrap = new CharacterBuilderBootstrap();

      // Mock service registration to fail
      mockContainer.register.mockImplementation((token) => {
        if (token === 'failingService') {
          throw new Error('Registration failed');
        }
      });

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        services: {
          failingService: { method: jest.fn() },
        },
      };

      // Mock ensureValidLogger to return null
      const {
        ensureValidLogger,
      } = require('../../../src/utils/loggerUtils.js');
      ensureValidLogger.mockReturnValue(null);

      mockContainer.resolve.mockImplementation((token) => {
        const services = getAllServices({
          [tokens.ILogger]: null,
        });
        return services[token];
      });

      const result = await localBootstrap.bootstrap(config);

      // Should complete successfully without service registration error logging
      expect(result.controller).toBeInstanceOf(MockController);
    });
  });

  describe('utility methods', () => {
    it('should get schema ID from file path correctly', async () => {
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        customSchemas: ['/data/schemas/test-custom.schema.json'],
      };

      await bootstrap.bootstrap(config);

      // Should generate correct schema ID from path
      expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(
        expect.any(Object),
        'schema://living-narrative-engine/test-custom.schema.json'
      );
    });
  });

  describe('logger availability scenarios', () => {
    it('should handle logger null during bootstrap success logging (line 116)', async () => {
      // Create new bootstrap instance to avoid logger state
      const localBootstrap = new CharacterBuilderBootstrap();

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      // Mock ensureValidLogger to return null during bootstrap completion
      const {
        ensureValidLogger,
      } = require('../../../src/utils/loggerUtils.js');
      ensureValidLogger.mockReturnValue(null);

      // Mock container to return null logger
      mockContainer.resolve.mockImplementation((token) => {
        const services = getAllServices({
          [tokens.ILogger]: null,
        });
        return services[token];
      });

      const result = await localBootstrap.bootstrap(config);

      // Should complete successfully without logging
      expect(result).toMatchObject({
        controller: expect.any(MockController),
        container: mockContainer,
        bootstrapTime: expect.any(Number),
      });
    });

    it('should handle logger null during container setup completion (line 200)', async () => {
      const localBootstrap = new CharacterBuilderBootstrap();

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      // Mock ensureValidLogger to return null initially
      const {
        ensureValidLogger,
      } = require('../../../src/utils/loggerUtils.js');
      ensureValidLogger.mockReturnValue(null);

      mockContainer.resolve.mockImplementation((token) => {
        const services = getAllServices({
          [tokens.ILogger]: null,
        });
        return services[token];
      });

      const result = await localBootstrap.bootstrap(config);

      // Should complete successfully without container setup logging
      expect(result).toMatchObject({
        controller: expect.any(MockController),
        container: mockContainer,
        bootstrapTime: expect.any(Number),
      });
    });

    it('should handle logger null during schema loading info (line 233)', async () => {
      const localBootstrap = new CharacterBuilderBootstrap();

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        customSchemas: ['/data/schemas/custom.json'],
      };

      // Mock ensureValidLogger to return null
      const {
        ensureValidLogger,
      } = require('../../../src/utils/loggerUtils.js');
      ensureValidLogger.mockReturnValue(null);

      mockContainer.resolve.mockImplementation((token) => {
        const services = getAllServices({
          [tokens.ILogger]: null,
        });
        return services[token];
      });

      const result = await localBootstrap.bootstrap(config);

      // Should complete successfully without schema loading info logging
      expect(result.controller).toBeInstanceOf(MockController);
    });

    it('should handle logger null during "already loaded" schema check (line 246)', async () => {
      const localBootstrap = new CharacterBuilderBootstrap();

      // Mock some schemas as already loaded
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        customSchemas: ['/data/schemas/custom.json'],
      };

      // Mock ensureValidLogger to return null
      const {
        ensureValidLogger,
      } = require('../../../src/utils/loggerUtils.js');
      ensureValidLogger.mockReturnValue(null);

      mockContainer.resolve.mockImplementation((token) => {
        const services = getAllServices({
          [tokens.ILogger]: null,
        });
        return services[token];
      });

      const result = await localBootstrap.bootstrap(config);

      // Should complete successfully without "already loaded" logging
      expect(result.controller).toBeInstanceOf(MockController);
    });
  });

  describe('branch coverage edge cases', () => {
    it('should handle bootstrap without logger available initially', async () => {
      // Create a new bootstrap instance that won't have logger initially
      const localBootstrap = new CharacterBuilderBootstrap();

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      // Logger will be resolved during setup, but initially null
      mockContainer.resolve.mockImplementation((token) => {
        const services = getAllServices({
          [tokens.ILogger]: null, // Start with null
        });
        const service = services[token];
        // Return logger from ensureValidLogger mock, or service otherwise
        return token === tokens.ILogger ? mockLogger : service;
      });

      const result = await localBootstrap.bootstrap(config);

      // Should complete successfully even with initial null logger
      expect(result).toMatchObject({
        controller: expect.any(MockController),
        container: mockContainer,
        bootstrapTime: expect.any(Number),
      });
    });

    it('should handle config with includeModLoading false explicitly', async () => {
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        includeModLoading: false, // Explicitly false
        eventDefinitions: [],
      };

      await bootstrap.bootstrap(config);

      // Should not attempt to load mods
      expect(mockContainer.resolve).not.toHaveBeenCalledWith(tokens.ModsLoader);
    });

    it('should handle config with all optional properties undefined', async () => {
      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        includeModLoading: undefined,
        eventDefinitions: undefined,
        customSchemas: undefined,
        services: undefined,
        hooks: undefined,
        errorDisplay: undefined,
      };

      await bootstrap.bootstrap(config);

      // Should complete successfully with undefined optional properties
      expect(mockContainer.resolve).toHaveBeenCalled();
    });

    it('should handle error display without dismissible button', async () => {
      const errorElement = {
        appendChild: jest.fn(),
      };
      document.getElementById.mockReturnValue(errorElement);

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        errorDisplay: {
          dismissible: false,
        },
      };

      await bootstrap.bootstrap(config);

      // Simulate error event
      const errorHandler = mockEventBus.subscribe.mock.calls[0][1];
      const mockErrorDiv = {
        querySelector: jest.fn().mockReturnValue(null), // No dismiss button
        remove: jest.fn(),
      };
      document.createElement.mockReturnValue(mockErrorDiv);

      errorHandler({ payload: { error: 'Test error' } });

      // Should not look for dismiss button when not dismissible
      expect(mockErrorDiv.querySelector).not.toHaveBeenCalledWith(
        '.cb-error-dismiss'
      );
    });

    it('should handle string error instead of Error object', async () => {
      const errorElement = {
        appendChild: jest.fn(),
      };
      document.getElementById.mockReturnValue(errorElement);

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      await bootstrap.bootstrap(config);

      // Simulate error event with string error
      const errorHandler = mockEventBus.subscribe.mock.calls[0][1];
      const mockErrorDiv = {
        querySelector: jest.fn().mockReturnValue({
          addEventListener: jest.fn(),
        }),
        remove: jest.fn(),
      };
      document.createElement.mockReturnValue(mockErrorDiv);

      errorHandler({ payload: { error: 'String error message' } });

      // Should handle string error correctly
      expect(errorElement.appendChild).toHaveBeenCalledWith(mockErrorDiv);
    });

    it('should handle controller initialization completion without logger (line 612)', async () => {
      const localBootstrap = new CharacterBuilderBootstrap();

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
      };

      // Mock ensureValidLogger to return null
      const {
        ensureValidLogger,
      } = require('../../../src/utils/loggerUtils.js');
      ensureValidLogger.mockReturnValue(null);

      mockContainer.resolve.mockImplementation((token) => {
        const services = getAllServices({
          [tokens.ILogger]: null,
        });
        return services[token];
      });

      const result = await localBootstrap.bootstrap(config);

      // Should complete successfully without controller initialization logging
      expect(result.controller).toBeInstanceOf(MockController);
      expect(result.controller.initialize).toHaveBeenCalled();
    });

    it('should handle error display configuration without logger (lines 652-668)', async () => {
      const localBootstrap = new CharacterBuilderBootstrap();

      const errorElement = {
        appendChild: jest.fn(),
      };
      document.getElementById.mockReturnValue(errorElement);

      const config = {
        pageName: 'test-page',
        controllerClass: MockController,
        errorDisplay: {
          elementId: 'custom-error-display',
        },
      };

      // Mock ensureValidLogger to return null
      const {
        ensureValidLogger,
      } = require('../../../src/utils/loggerUtils.js');
      ensureValidLogger.mockReturnValue(null);

      mockContainer.resolve.mockImplementation((token) => {
        const services = getAllServices({
          [tokens.ILogger]: null,
        });
        return services[token];
      });

      const result = await localBootstrap.bootstrap(config);

      // Should complete successfully without error display configuration logging
      expect(result.controller).toBeInstanceOf(MockController);
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.any(Function)
      );
    });
  });
});
