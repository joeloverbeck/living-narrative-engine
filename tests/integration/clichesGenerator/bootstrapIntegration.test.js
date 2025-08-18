/**
 * @file Integration tests for Clichés Generator Bootstrap
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CharacterBuilderBootstrap } from '../../../src/characterBuilder/CharacterBuilderBootstrap.js';
import { ClichesGeneratorController } from '../../../src/clichesGenerator/controllers/ClichesGeneratorController.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

// Mock ClichesGeneratorController to prevent IndexedDB access
jest.mock(
  '../../../src/clichesGenerator/controllers/ClichesGeneratorController.js',
  () => {
    return {
      ClichesGeneratorController: jest.fn().mockImplementation((deps) => {
        return {
          initialize: jest.fn().mockResolvedValue(true),
          cleanup: jest.fn().mockResolvedValue(true),
          _loadInitialData: jest.fn().mockResolvedValue(true),
          dependencies: deps,
        };
      }),
    };
  }
);

describe('Clichés Generator Bootstrap Integration', () => {
  let bootstrap;
  let result;
  let mockEventBus;
  let mockSchemaValidator;
  let mockElements;

  beforeEach(() => {
    bootstrap = new CharacterBuilderBootstrap();

    // Set up mock event bus
    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      listenerCount: jest.fn().mockReturnValue(0),
    };

    // Set up mock schema validator
    mockSchemaValidator = {
      addSchema: jest.fn().mockResolvedValue(true),
      isSchemaLoaded: jest.fn().mockReturnValue(false),
      validateSchema: jest.fn().mockReturnValue({ valid: true }),
    };

    // Mock fetch for schema loading and logger config
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes('.schema.json')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              $schema: 'http://json-schema.org/draft-07/schema#',
              id: 'test-schema',
              type: 'object',
            }),
        });
      }
      // Mock logger config fetch
      if (url.includes('logger-config.json')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              logLevel: 'INFO',
            }),
        });
      }
      // Mock LLM config fetch
      if (url.includes('llm-configs.json')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              providers: [],
              configurations: [],
            }),
        });
      }
      return Promise.reject(new Error('Not found'));
    });

    // Mock document for error display setup and controller element caching

    // Create persistent mock elements that will pass HTMLElement validation
    mockElements = {};
    const requiredIds = [
      'direction-selector',
      'generate-btn',
      'selected-direction-display',
      'original-concept-display',
      'cliches-container',
      'status-messages',
      'direction-content',
      'direction-meta',
      'concept-content',
      'loading-overlay',
      'cliches-form',
      'back-to-menu-btn',
    ];

    // Pre-create all required elements using real DOM creation in jsdom
    requiredIds.forEach((id) => {
      const element = document.createElement('div');
      element.id = id;

      // Add element to body so it passes the contains() check
      document.body.appendChild(element);

      mockElements[id] = element;
    });

    // Instead of replacing global.document, just mock the getElementById method on the existing document
    jest.spyOn(document, 'getElementById').mockImplementation((id) => {
      return mockElements[id] || null;
    });

    // Also mock querySelector for consistency
    jest.spyOn(document, 'querySelector').mockImplementation((selector) => {
      // Handle ID selectors by converting to getElementById call
      if (selector.startsWith('#')) {
        const id = selector.slice(1);
        return mockElements[id] || null;
      }
      // Return mock element for other selectors
      return document.createElement('div');
    });

    // Mock window
    global.window = {};
  });

  afterEach(async () => {
    // Clean up
    if (result?.controller?.cleanup) {
      await result.controller.cleanup();
    }

    jest.clearAllMocks();
    jest.restoreAllMocks();
    delete global.fetch;
    delete global.window;
  });

  it('should initialize with correct services', async () => {
    // Act
    result = await bootstrap.bootstrap({
      pageName: 'cliches-generator',
      controllerClass: ClichesGeneratorController,
    });

    // Assert
    expect(result).toHaveProperty('controller');
    expect(result).toHaveProperty('container');
    expect(result).toHaveProperty('bootstrapTime');
    // Since we're mocking ClichesGeneratorController, just verify it exists
    expect(result.controller).toBeDefined();
    expect(typeof result.controller.initialize).toBe('function');
    expect(result.container).toBeInstanceOf(AppContainer);
  });

  it('should resolve ClicheGenerator from container', async () => {
    // Act
    result = await bootstrap.bootstrap({
      pageName: 'cliches-generator',
      controllerClass: ClichesGeneratorController,
    });

    // Assert
    const clicheGenerator = result.container.resolve(tokens.ClicheGenerator);
    expect(clicheGenerator).toBeDefined();
    expect(clicheGenerator).toHaveProperty('generateCliches');
  });

  it('should create controller with all dependencies', async () => {
    // Arrange
    const mockControllerClass = jest.fn().mockImplementation((deps) => {
      return {
        initialize: jest.fn().mockResolvedValue(true),
        cleanup: jest.fn().mockResolvedValue(true),
        dependencies: deps,
      };
    });

    // Act
    result = await bootstrap.bootstrap({
      pageName: 'cliches-generator',
      controllerClass: mockControllerClass,
    });

    // Assert
    expect(mockControllerClass).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: expect.any(Object),
        characterBuilderService: expect.any(Object),
        eventBus: expect.any(Object),
        schemaValidator: expect.any(Object),
      })
    );

    const deps = result.controller.dependencies;
    expect(deps.logger).toBeDefined();
    expect(deps.characterBuilderService).toBeDefined();
    expect(deps.eventBus).toBeDefined();
    expect(deps.schemaValidator).toBeDefined();
  });

  it('should handle database initialization', async () => {
    // Act
    result = await bootstrap.bootstrap({
      pageName: 'cliches-generator',
      controllerClass: ClichesGeneratorController,
    });

    // Assert
    const database = result.container.resolve(tokens.CharacterDatabase);
    expect(database).toBeDefined();
  });

  it('should set up event handling correctly', async () => {
    // Arrange
    const eventDefinitions = [
      {
        id: 'test:event',
        description: 'Test event',
        payloadSchema: {
          type: 'object',
          properties: {
            data: { type: 'string' },
          },
        },
      },
    ];

    // Act
    result = await bootstrap.bootstrap({
      pageName: 'cliches-generator',
      controllerClass: ClichesGeneratorController,
      eventDefinitions,
    });

    // Assert
    const dataRegistry = result.container.resolve(tokens.IDataRegistry);
    expect(dataRegistry).toBeDefined();
    expect(dataRegistry.setEventDefinition).toBeDefined();
  });

  it('should load custom schemas', async () => {
    // Arrange
    const customSchemas = ['/data/schemas/cliche.schema.json'];

    // Act
    result = await bootstrap.bootstrap({
      pageName: 'cliches-generator',
      controllerClass: ClichesGeneratorController,
      customSchemas,
    });

    // Assert
    expect(global.fetch).toHaveBeenCalledWith(
      '/data/schemas/cliche.schema.json'
    );
  });

  it('should execute lifecycle hooks', async () => {
    // Arrange
    const preInitHook = jest.fn();
    const postInitHook = jest.fn();

    const hooks = {
      preInit: preInitHook,
      postInit: postInitHook,
    };

    // Act
    result = await bootstrap.bootstrap({
      pageName: 'cliches-generator',
      controllerClass: ClichesGeneratorController,
      hooks,
    });

    // Assert
    expect(preInitHook).toHaveBeenCalledWith(result.controller);
    expect(postInitHook).toHaveBeenCalledWith(result.controller);
  });

  it('should measure performance metrics', async () => {
    // Act
    result = await bootstrap.bootstrap({
      pageName: 'cliches-generator',
      controllerClass: ClichesGeneratorController,
    });

    // Assert
    expect(result.bootstrapTime).toBeGreaterThan(0);
    expect(typeof result.bootstrapTime).toBe('number');
  });

  it('should handle bootstrap errors gracefully', async () => {
    // Arrange
    const errorController = jest.fn().mockImplementation(() => {
      throw new Error('Controller creation failed');
    });

    // Act & Assert
    await expect(
      bootstrap.bootstrap({
        pageName: 'cliches-generator',
        controllerClass: errorController,
      })
    ).rejects.toThrow('Controller creation failed');
  });

  it('should register cliché-specific event definitions', async () => {
    // Arrange
    const eventDefinitions = [
      {
        id: 'core:cliche_generation_started',
        description: 'Fired when cliché generation begins',
        payloadSchema: {
          type: 'object',
          required: ['directionId', 'conceptId'],
          properties: {
            directionId: { type: 'string' },
            conceptId: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      },
      {
        id: 'core:cliche_generation_completed',
        description: 'Fired when cliché generation completes',
        payloadSchema: {
          type: 'object',
          required: ['directionId', 'clicheId'],
          properties: {
            directionId: { type: 'string' },
            clicheId: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      },
    ];

    // Act
    result = await bootstrap.bootstrap({
      pageName: 'cliches-generator',
      controllerClass: ClichesGeneratorController,
      eventDefinitions,
    });

    // Assert
    const dataRegistry = result.container.resolve(tokens.IDataRegistry);
    expect(dataRegistry.setEventDefinition).toBeDefined();
  });

  it('should integrate CharacterBuilderService with ClicheGenerator', async () => {
    // Act
    result = await bootstrap.bootstrap({
      pageName: 'cliches-generator',
      controllerClass: ClichesGeneratorController,
    });

    // Assert
    const characterBuilderService = result.container.resolve(
      tokens.CharacterBuilderService
    );
    expect(characterBuilderService).toBeDefined();
    expect(characterBuilderService.generateClichesForDirection).toBeDefined();
    expect(characterBuilderService.getClichesByDirectionId).toBeDefined();
    expect(characterBuilderService.storeCliches).toBeDefined();
  });

  it('should set up error display configuration', async () => {
    // Arrange
    const errorDisplay = {
      elementId: 'custom-error-display',
      displayDuration: 3000,
      dismissible: false,
    };

    // Act
    result = await bootstrap.bootstrap({
      pageName: 'cliches-generator',
      controllerClass: ClichesGeneratorController,
      errorDisplay,
    });

    // Assert
    // Error display setup is internal to Bootstrap, but we can verify
    // that the bootstrap completes successfully with custom config
    expect(result).toBeDefined();
  });

  it('should handle controller initialization failure', async () => {
    // Arrange
    const failingController = jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockRejectedValue(new Error('Init failed')),
    }));

    // Act & Assert
    await expect(
      bootstrap.bootstrap({
        pageName: 'cliches-generator',
        controllerClass: failingController,
      })
    ).rejects.toThrow('Controller initialization failed: Init failed');
  });

  it('should support concurrent service resolution', async () => {
    // Act
    result = await bootstrap.bootstrap({
      pageName: 'cliches-generator',
      controllerClass: ClichesGeneratorController,
    });

    // Assert - Resolve multiple services concurrently
    const [service1, service2, service3] = await Promise.all([
      Promise.resolve(result.container.resolve(tokens.CharacterBuilderService)),
      Promise.resolve(result.container.resolve(tokens.ClicheGenerator)),
      Promise.resolve(result.container.resolve(tokens.CharacterDatabase)),
    ]);

    expect(service1).toBeDefined();
    expect(service2).toBeDefined();
    expect(service3).toBeDefined();
  });
});
