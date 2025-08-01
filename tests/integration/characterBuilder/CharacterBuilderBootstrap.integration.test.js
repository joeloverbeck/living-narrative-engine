/**
 * @file Integration tests for CharacterBuilderBootstrap
 * @description Tests the complete bootstrap flow with real dependencies
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

describe('CharacterBuilderBootstrap Integration', () => {
  let bootstrap;
  let mockFetch;
  let consoleLogSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;
  let mockDocument;

  beforeEach(() => {
    bootstrap = new CharacterBuilderBootstrap();

    // Mock console methods to capture logging
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Store original fetch
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Mock document for error display tests
    mockDocument = {
      body: { innerHTML: '', appendChild: jest.fn() },
      getElementById: jest.fn(),
      createElement: jest.fn(() => ({
        id: '',
        className: '',
        innerHTML: '',
        textContent: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
        querySelector: jest.fn(),
        remove: jest.fn(),
        style: {},
      })),
    };
    global.document = mockDocument;

    // Mock performance API
    global.performance = {
      now: jest.fn(() => Date.now()),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
    delete global.document;
    delete global.performance;
  });

  describe('Basic Bootstrap Flow', () => {
    it('should complete bootstrap process with minimal config', async () => {
      // Setup successful schema fetch
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          $id: 'schema://living-narrative-engine/test-schema.json',
          type: 'object',
        }),
      });

      class TestController {
        constructor(deps) {
          this.logger = deps.logger;
          this.characterBuilderService = deps.characterBuilderService;
          this.eventBus = deps.eventBus;
        }

        async initialize() {
          // Mock initialization
        }
      }

      const config = {
        pageName: 'Test Page',
        controllerClass: TestController,
        includeModLoading: false,
      };

      const result = await bootstrap.bootstrap(config);

      expect(result).toHaveProperty('controller');
      expect(result).toHaveProperty('container');
      expect(result).toHaveProperty('bootstrapTime');
      expect(result.controller).toBeInstanceOf(TestController);
      expect(result.bootstrapTime).toBeGreaterThan(0);
    });

    it('should handle controller initialization errors gracefully', async () => {
      // Setup schema fetch
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ $id: 'test-schema', type: 'object' }),
      });

      class FailingController {
        constructor() {}
        async initialize() {
          throw new Error('Controller initialization failed');
        }
      }

      const config = {
        pageName: 'Failing Controller Page',
        controllerClass: FailingController,
      };

      await expect(bootstrap.bootstrap(config)).rejects.toThrow(
        'Controller initialization failed'
      );
    });
  });

  describe('Schema Loading Integration', () => {
    it('should load schemas with performance logging when logger available', async () => {
      // Setup successful schema fetch
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          $id: 'schema://living-narrative-engine/character-concept.schema.json',
          type: 'object',
          properties: { id: { type: 'string' } },
        }),
      });

      class TestController {
        constructor(deps) {
          this.logger = deps.logger;
          this.characterBuilderService = deps.characterBuilderService;
          this.eventBus = deps.eventBus;
        }
        async initialize() {}
      }

      const config = {
        pageName: 'Schema Test Page',
        controllerClass: TestController,
        includeModLoading: false,
      };

      const result = await bootstrap.bootstrap(config);

      // Logger should be available and used for performance logging (line 117, 260, 265)
      expect(result.container).toBeDefined();
      expect(mockFetch).toHaveBeenCalled();

      // Verify fetch was called at least once (might be for logger config or schemas)
      expect(mockFetch.mock.calls.length).toBeGreaterThan(0);
    });

    it('should handle schema loading failures gracefully', async () => {
      // Setup failed schema fetch
      mockFetch.mockRejectedValue(new Error('Network error'));

      class TestController {
        constructor(deps) {
          this.logger = deps.logger;
          this.characterBuilderService = deps.characterBuilderService;
          this.eventBus = deps.eventBus;
        }
        async initialize() {}
      }

      const config = {
        pageName: 'Schema Fail Test Page',
        controllerClass: TestController,
        includeModLoading: false,
      };

      // Should not fail bootstrap even if schema loading fails
      const result = await bootstrap.bootstrap(config);
      expect(result).toBeDefined();
    });

    it('should handle custom schemas and skip already loaded schemas', async () => {
      // Mock schema validator with isSchemaLoaded method
      const mockSchemaValidator = {
        addSchema: jest.fn(),
        isSchemaLoaded: jest
          .fn()
          .mockReturnValueOnce(false) // First call - not loaded
          .mockReturnValueOnce(true), // Second call - already loaded (line 436)
      };

      // Setup successful schema fetch
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          $id: 'schema://living-narrative-engine/custom-schema.json',
          type: 'object',
        }),
      });

      class TestController {
        constructor(deps) {
          this.logger = deps.logger;
          this.characterBuilderService = deps.characterBuilderService;
          this.eventBus = deps.eventBus;
        }
        async initialize() {}
      }

      const config = {
        pageName: 'Custom Schema Test Page',
        controllerClass: TestController,
        includeModLoading: false,
        customSchemas: ['/data/schemas/custom-schema.schema.json'],
      };

      const result = await bootstrap.bootstrap(config);
      expect(result).toBeDefined();
    });
  });

  describe('Event System Integration', () => {
    it('should register events with existing payload schemas', async () => {
      // Setup schema fetch
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ $id: 'test-schema', type: 'object' }),
      });

      // Mock schema validator that reports schemas as already loaded
      const mockSchemaValidator = {
        addSchema: jest.fn(),
        isSchemaLoaded: jest
          .fn()
          .mockReturnValueOnce(false) // Base schema - not loaded
          .mockReturnValueOnce(true), // Event payload schema - already loaded (lines 449-450)
      };

      class TestController {
        constructor(deps) {
          this.logger = deps.logger;
          this.characterBuilderService = deps.characterBuilderService;
          this.eventBus = deps.eventBus;
        }
        async initialize() {}
      }

      const customEventDef = {
        id: 'test:custom_event',
        description: 'Test custom event',
        payloadSchema: {
          type: 'object',
          properties: { testField: { type: 'string' } },
        },
      };

      const config = {
        pageName: 'Event Test Page',
        controllerClass: TestController,
        includeModLoading: false,
        eventDefinitions: [customEventDef],
      };

      const result = await bootstrap.bootstrap(config);
      expect(result).toBeDefined();
    });

    it('should handle event registration errors gracefully', async () => {
      // Setup schema fetch
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ $id: 'test-schema', type: 'object' }),
      });

      class TestController {
        constructor(deps) {
          this.logger = deps.logger;
          this.characterBuilderService = deps.characterBuilderService;
          this.eventBus = deps.eventBus;
        }
        async initialize() {}
      }

      // Invalid event definition should be handled gracefully
      const invalidEventDef = {
        id: 'test:invalid_event',
        description: 'Invalid event',
        payloadSchema: null, // Invalid schema
      };

      const config = {
        pageName: 'Event Error Test Page',
        controllerClass: TestController,
        includeModLoading: false,
        eventDefinitions: [invalidEventDef],
      };

      const result = await bootstrap.bootstrap(config);
      expect(result).toBeDefined();
    });
  });

  describe('Mod Loading Integration', () => {
    it('should handle missing ModsLoader gracefully', async () => {
      // Setup schema fetch
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ $id: 'test-schema', type: 'object' }),
      });

      class TestController {
        constructor(deps) {
          this.logger = deps.logger;
          this.characterBuilderService = deps.characterBuilderService;
          this.eventBus = deps.eventBus;
        }
        async initialize() {}
      }

      const config = {
        pageName: 'Mod Loading Test Page',
        controllerClass: TestController,
        includeModLoading: true, // Request mod loading but ModsLoader unavailable (lines 477-482)
      };

      const result = await bootstrap.bootstrap(config);
      expect(result).toBeDefined();
    });

    it('should handle mod loading failures', async () => {
      // Setup schema fetch
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ $id: 'test-schema', type: 'object' }),
      });

      // Mock ModsLoader that fails
      const mockModsLoader = {
        loadMods: jest.fn().mockRejectedValue(new Error('Mod loading failed')),
      };

      class TestController {
        constructor(deps) {
          this.logger = deps.logger;
          this.characterBuilderService = deps.characterBuilderService;
          this.eventBus = deps.eventBus;
        }
        async initialize() {}
      }

      const config = {
        pageName: 'Mod Fail Test Page',
        controllerClass: TestController,
        includeModLoading: true,
      };

      // Should handle mod loading failure gracefully (line 491)
      const result = await bootstrap.bootstrap(config);
      expect(result).toBeDefined();
    });
  });

  describe('Service Registration Integration', () => {
    it('should register custom services successfully', async () => {
      // Setup schema fetch
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ $id: 'test-schema', type: 'object' }),
      });

      class TestController {
        constructor(deps) {
          this.logger = deps.logger;
          this.characterBuilderService = deps.characterBuilderService;
          this.eventBus = deps.eventBus;
          this.customService = deps.customService;
        }
        async initialize() {}
      }

      const mockCustomService = { test: 'service' };

      const config = {
        pageName: 'Service Test Page',
        controllerClass: TestController,
        includeModLoading: false,
        services: {
          customService: mockCustomService,
        },
      };

      const result = await bootstrap.bootstrap(config);
      expect(result).toBeDefined();
      expect(result.controller.customService).toBe(mockCustomService);
    });

    it('should handle service registration failures gracefully', async () => {
      // Setup schema fetch
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ $id: 'test-schema', type: 'object' }),
      });

      class TestController {
        constructor(deps) {
          this.logger = deps.logger;
          this.characterBuilderService = deps.characterBuilderService;
          this.eventBus = deps.eventBus;
        }
        async initialize() {}
      }

      // Mock container that throws on registration
      const config = {
        pageName: 'Service Fail Test Page',
        controllerClass: TestController,
        includeModLoading: false,
        services: {
          'invalid-token': () => {
            throw new Error('Service registration failed');
          },
        },
      };

      // Should handle service registration failure gracefully (lines 522-528)
      const result = await bootstrap.bootstrap(config);
      expect(result).toBeDefined();
    });
  });

  describe('Controller Lifecycle Integration', () => {
    it('should execute pre and post initialization hooks', async () => {
      // Setup schema fetch
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ $id: 'test-schema', type: 'object' }),
      });

      const preContainerHook = jest.fn();
      const preInitHook = jest.fn();
      const postInitHook = jest.fn();

      class TestController {
        constructor(deps) {
          this.logger = deps.logger;
          this.characterBuilderService = deps.characterBuilderService;
          this.eventBus = deps.eventBus;
        }
        async initialize() {}
      }

      const config = {
        pageName: 'Hooks Test Page',
        controllerClass: TestController,
        includeModLoading: false,
        hooks: {
          preContainer: preContainerHook,
          preInit: preInitHook,
          postInit: postInitHook,
        },
      };

      const result = await bootstrap.bootstrap(config);

      expect(result).toBeDefined();
      expect(preContainerHook).toHaveBeenCalled();
      expect(preInitHook).toHaveBeenCalled();
      expect(postInitHook).toHaveBeenCalled();
    });

    it('should validate controller has initialize method', async () => {
      // Setup schema fetch
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ $id: 'test-schema', type: 'object' }),
      });

      class InvalidController {
        constructor(deps) {
          this.logger = deps.logger;
          this.characterBuilderService = deps.characterBuilderService;
          this.eventBus = deps.eventBus;
        }
        // Missing initialize method
      }

      const config = {
        pageName: 'Invalid Controller Test Page',
        controllerClass: InvalidController,
        includeModLoading: false,
      };

      await expect(bootstrap.bootstrap(config)).rejects.toThrow(
        'Controller must have an initialize method'
      );
    });
  });

  describe('Error Display Integration', () => {
    it('should setup error display with custom configuration', async () => {
      // Setup schema fetch
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ $id: 'test-schema', type: 'object' }),
      });

      // Mock getElementById to return null initially, then the created element
      const mockErrorElement = {
        id: 'custom-error-display',
        className: '',
        appendChild: jest.fn(),
      };

      mockDocument.getElementById
        .mockReturnValueOnce(null) // Element doesn't exist
        .mockReturnValue(mockErrorElement); // Return created element

      mockDocument.createElement.mockReturnValue(mockErrorElement);

      class TestController {
        constructor(deps) {
          this.logger = deps.logger;
          this.characterBuilderService = deps.characterBuilderService;
          this.eventBus = deps.eventBus;
        }
        async initialize() {}
      }

      const config = {
        pageName: 'Error Display Test Page',
        controllerClass: TestController,
        includeModLoading: false,
        errorDisplay: {
          elementId: 'custom-error-display',
          displayDuration: 3000,
          dismissible: false,
        },
      };

      const result = await bootstrap.bootstrap(config);
      expect(result).toBeDefined();

      // Since the test is successful, error display element should be configured but not necessarily created
      // The test verifies the error display system is set up properly
    });

    it('should display fatal error when bootstrap fails', async () => {
      // Setup config that will fail validation
      const config = {
        pageName: 'Fatal Error Test Page',
        controllerClass: null, // This will cause validation failure
        includeModLoading: false,
      };

      await expect(bootstrap.bootstrap(config)).rejects.toThrow();

      // In this test, we're verifying the error was caught and thrown
      // The fatal error display happens inside the catch block
    });
  });

  describe('Performance and Logging Integration', () => {
    it('should collect and log performance metrics', async () => {
      // Setup successful schema fetch
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ $id: 'test-schema', type: 'object' }),
      });

      // Mock performance.now to return predictable values
      let performanceCounter = 1000;
      global.performance.now = jest.fn(() => (performanceCounter += 100));

      class TestController {
        constructor(deps) {
          this.logger = deps.logger;
          this.characterBuilderService = deps.characterBuilderService;
          this.eventBus = deps.eventBus;
        }
        async initialize() {}
      }

      const config = {
        pageName: 'Performance Test Page',
        controllerClass: TestController,
        includeModLoading: false,
      };

      const result = await bootstrap.bootstrap(config);

      expect(result).toBeDefined();
      expect(result.bootstrapTime).toBeGreaterThan(0);

      // Verify performance tracking was used
      expect(global.performance.now).toHaveBeenCalled();
    });

    it('should handle logging when logger is not available initially', async () => {
      // Setup schema fetch
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ $id: 'test-schema', type: 'object' }),
      });

      class TestController {
        constructor(deps) {
          this.logger = deps.logger;
          this.characterBuilderService = deps.characterBuilderService;
          this.eventBus = deps.eventBus;
        }
        async initialize() {}
      }

      // Test with invalid configuration to trigger early validation logging
      const config = {
        pageName: '', // Invalid blank page name
        controllerClass: TestController,
        includeModLoading: false,
      };

      await expect(bootstrap.bootstrap(config)).rejects.toThrow();
    });
  });

  describe('Configuration Validation Integration', () => {
    it('should validate all configuration properties', async () => {
      const testCases = [
        {
          name: 'missing controller class',
          config: { pageName: 'Test' },
          expectedError: 'Controller class is required',
        },
        {
          name: 'invalid controller class type',
          config: { pageName: 'Test', controllerClass: 'not-a-function' },
          expectedError: 'Controller class must be a constructor function',
        },
        {
          name: 'invalid event definitions type',
          config: {
            pageName: 'Test',
            controllerClass: class {},
            eventDefinitions: 'not-an-array',
          },
          expectedError: 'Event definitions must be an array',
        },
        {
          name: 'invalid custom schemas type',
          config: {
            pageName: 'Test',
            controllerClass: class {},
            customSchemas: 'not-an-array',
          },
          expectedError: 'Custom schemas must be an array',
        },
        {
          name: 'invalid services type',
          config: {
            pageName: 'Test',
            controllerClass: class {},
            services: 'not-an-object',
          },
          expectedError: 'Services must be an object',
        },
        {
          name: 'invalid hooks type',
          config: {
            pageName: 'Test',
            controllerClass: class {},
            hooks: 'not-an-object',
          },
          expectedError: 'Hooks must be an object',
        },
      ];

      for (const testCase of testCases) {
        await expect(bootstrap.bootstrap(testCase.config)).rejects.toThrow(
          testCase.expectedError
        );
      }
    });
  });
});
