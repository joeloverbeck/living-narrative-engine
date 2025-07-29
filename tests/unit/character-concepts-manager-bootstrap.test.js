/**
 * @file Unit tests for Character Concepts Manager bootstrap functionality
 * Tests the bootstrap process including service resolution and error handling
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('Character Concepts Manager Bootstrap', () => {
  let mockCommonBootstrapper;
  let mockContainer;
  let mockLogger;
  let mockCharacterBuilderService;
  let mockEventBus;
  let mockController;
  let initializeApp;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    // Mock services
    mockCharacterBuilderService = {
      getConcepts: jest.fn(() => Promise.resolve([])),
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
    };

    // Mock container
    mockContainer = {
      resolve: jest.fn((token) => {
        switch (token) {
          case 'CharacterBuilderService':
            return mockCharacterBuilderService;
          case 'ISafeEventDispatcher':
            return mockEventBus;
          case 'ModsLoader':
            return {
              loadMods: jest.fn(() => Promise.resolve()),
            };
          default:
            return null;
        }
      }),
    };

    // Mock CommonBootstrapper
    mockCommonBootstrapper = {
      bootstrap: jest.fn(() =>
        Promise.resolve({
          container: mockContainer,
          services: {
            logger: mockLogger,
            modsLoader: {
              loadMods: jest.fn(() => Promise.resolve()),
            },
          },
        })
      ),
    };

    // Mock CharacterConceptsManagerController
    mockController = {
      initialize: jest.fn(() => Promise.resolve()),
    };

    // Mock DOM
    global.document = {
      readyState: 'complete',
      getElementById: jest.fn(() => null),
      addEventListener: jest.fn(),
      createElement: jest.fn(() => ({
        textContent: '',
        innerHTML: '',
        style: { display: '' },
      })),
      body: {
        prepend: jest.fn(),
      },
    };

    global.window = {
      addEventListener: jest.fn(),
      location: {
        reload: jest.fn(),
        href: '',
      },
    };

    // Mock setTimeout to return a timeout ID but not execute immediately
    global.setTimeout = jest.fn((fn, delay) => {
      // Return a mock timeout ID
      return 123;
    });
    global.clearTimeout = jest.fn();

    // Mock module dependencies
    jest.doMock('../../src/bootstrapper/CommonBootstrapper.js', () => ({
      CommonBootstrapper: jest.fn(() => mockCommonBootstrapper),
    }));

    jest.doMock(
      '../../src/domUI/characterConceptsManagerController.js',
      () => ({
        CharacterConceptsManagerController: jest.fn(() => mockController),
      })
    );

    jest.doMock('../../src/dependencyInjection/tokens.js', () => ({
      tokens: {
        CharacterBuilderService: 'CharacterBuilderService',
        ISafeEventDispatcher: 'ISafeEventDispatcher',
        ModsLoader: 'ModsLoader',
      },
    }));

    jest.doMock('../../src/utils/loggerUtils.js', () => ({
      ensureValidLogger: jest.fn((logger) => logger || mockLogger),
    }));
  });

  afterEach(() => {
    delete global.document;
    delete global.window;
    delete global.setTimeout;
    delete global.clearTimeout;
  });

  it('should successfully bootstrap and initialize with proper service resolution', async () => {
    // Import the module after setting up mocks
    const module = await import('../../src/character-concepts-manager-main.js');
    initializeApp = module.initializeApp;

    await expect(initializeApp()).resolves.not.toThrow();

    // Verify bootstrap was called with correct options
    expect(mockCommonBootstrapper.bootstrap).toHaveBeenCalledWith({
      containerConfigType: 'minimal',
      skipModLoading: true,
      includeAnatomyFormatting: false,
      includeCharacterBuilder: true,
      postInitHook: null,
    });

    // Verify services were resolved correctly
    expect(mockContainer.resolve).toHaveBeenCalledWith(
      'CharacterBuilderService'
    );
    expect(mockContainer.resolve).toHaveBeenCalledWith('ISafeEventDispatcher');

    // Verify controller was initialized
    expect(mockController.initialize).toHaveBeenCalled();

    // Verify logger was used
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Initializing CharacterConceptsManager...'
    );
  });

  it('should handle bootstrap failure by throwing error with proper context', async () => {
    const bootstrapError = new Error('Bootstrap configuration failed');
    mockCommonBootstrapper.bootstrap.mockRejectedValue(bootstrapError);

    const module = await import('../../src/character-concepts-manager-main.js');
    initializeApp = module.initializeApp;

    await expect(initializeApp()).rejects.toThrow(
      'Bootstrap configuration failed'
    );

    // Verify bootstrap was attempted
    expect(mockCommonBootstrapper.bootstrap).toHaveBeenCalled();

    // Verify controller was not initialized
    expect(mockController.initialize).not.toHaveBeenCalled();
  });

  it('should handle missing CharacterBuilderService gracefully', async () => {
    mockContainer.resolve.mockImplementation((token) => {
      if (token === 'CharacterBuilderService') return null;
      if (token === 'ISafeEventDispatcher') return mockEventBus;
      if (token === 'ModsLoader') return { loadMods: jest.fn() };
      return null;
    });

    const module = await import('../../src/character-concepts-manager-main.js');
    initializeApp = module.initializeApp;

    await expect(initializeApp()).rejects.toThrow(
      'CharacterBuilderService not found in container'
    );

    expect(mockContainer.resolve).toHaveBeenCalledWith(
      'CharacterBuilderService'
    );
  });

  it('should handle missing SafeEventDispatcher gracefully', async () => {
    mockContainer.resolve.mockImplementation((token) => {
      if (token === 'CharacterBuilderService')
        return mockCharacterBuilderService;
      if (token === 'ISafeEventDispatcher') return null;
      if (token === 'ModsLoader') return { loadMods: jest.fn() };
      return null;
    });

    const module = await import('../../src/character-concepts-manager-main.js');
    initializeApp = module.initializeApp;

    await expect(initializeApp()).rejects.toThrow(
      'SafeEventDispatcher not found in container'
    );

    expect(mockContainer.resolve).toHaveBeenCalledWith('ISafeEventDispatcher');
  });

  it('should handle controller initialization failure', async () => {
    const controllerError = new Error('Controller initialization failed');
    mockController.initialize.mockRejectedValue(controllerError);

    const module = await import('../../src/character-concepts-manager-main.js');
    initializeApp = module.initializeApp;

    await expect(initializeApp()).rejects.toThrow(
      'Controller initialization failed'
    );

    // Verify services were resolved
    expect(mockContainer.resolve).toHaveBeenCalledWith(
      'CharacterBuilderService'
    );
    expect(mockContainer.resolve).toHaveBeenCalledWith('ISafeEventDispatcher');

    // Verify controller initialization was attempted
    expect(mockController.initialize).toHaveBeenCalled();
  });

  it('should handle mod loading failure gracefully', async () => {
    const modLoader = {
      loadMods: jest.fn(() => Promise.reject(new Error('Mod loading failed'))),
    };

    mockContainer.resolve.mockImplementation((token) => {
      if (token === 'CharacterBuilderService')
        return mockCharacterBuilderService;
      if (token === 'ISafeEventDispatcher') return mockEventBus;
      if (token === 'ModsLoader') return modLoader;
      return null;
    });

    const module = await import('../../src/character-concepts-manager-main.js');
    initializeApp = module.initializeApp;

    // Should not throw because mod loading failure is handled gracefully
    await expect(initializeApp()).resolves.not.toThrow();

    // Verify mod loading was attempted
    expect(modLoader.loadMods).toHaveBeenCalledWith('default', ['core']);

    // Verify warning was logged
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Failed to load core mod, continuing without event validation',
      expect.any(Error)
    );
  });

  it('should set up global error handlers', async () => {
    const addEventListenerSpy = jest.spyOn(global.window, 'addEventListener');

    const module = await import('../../src/character-concepts-manager-main.js');
    initializeApp = module.initializeApp;

    await initializeApp();

    // Verify global error handlers were set up
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'online',
      expect.any(Function)
    );
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'offline',
      expect.any(Function)
    );

    addEventListenerSpy.mockRestore();
  });

  it('should store controller reference for debugging', async () => {
    const module = await import('../../src/character-concepts-manager-main.js');
    initializeApp = module.initializeApp;

    await initializeApp();

    // Verify controller was stored on window for debugging
    expect(global.window.__characterConceptsManagerController).toBe(
      mockController
    );
  });

  it('should clear timeout on successful initialization', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    const module = await import('../../src/character-concepts-manager-main.js');
    initializeApp = module.initializeApp;

    await initializeApp();

    // Verify timeout was cleared
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });
});
