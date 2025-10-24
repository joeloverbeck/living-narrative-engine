/**
 * @file Unit tests for cliches-generator-main.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

// Mock the modules before importing
jest.mock('../../src/characterBuilder/CharacterBuilderBootstrap.js');
jest.mock(
  '../../src/clichesGenerator/controllers/ClichesGeneratorController.js'
);

describe('Clichés Generator Entry Point', () => {
  let mockBootstrap;
  let mockController;
  let originalConsoleLog;
  let originalConsoleError;
  let CharacterBuilderBootstrap;
  let ClichesGeneratorController;
  let initializeApp;
  let windowAddEventListenerSpy;
  let documentAddEventListenerSpy;
  let getElementByIdSpy;
  let setReadyState;
  let restoreReadyState;
  let originalNodeEnv;

  beforeEach(async () => {
    // Clear module cache
    jest.resetModules();

    // Store original console methods
    originalConsoleLog = console.log;
    originalConsoleError = console.error;

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Prepare DOM spies using the real jsdom document and window
    document.body.innerHTML = '';
    window.__clichesController = undefined;

    getElementByIdSpy = jest.spyOn(document, 'getElementById');
    documentAddEventListenerSpy = jest.spyOn(document, 'addEventListener');
    windowAddEventListenerSpy = jest.spyOn(window, 'addEventListener');

    // Control the document ready state so the module doesn't auto-initialize on import
    let readyState = 'loading';
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: () => readyState,
    });

    setReadyState = (state) => {
      readyState = state;
    };

    restoreReadyState = () => {
      delete document.readyState;
    };

    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    // Mock controller
    mockController = {
      cleanup: jest.fn().mockResolvedValue(undefined),
    };

    // Mock bootstrap
    mockBootstrap = {
      bootstrap: jest.fn().mockResolvedValue({
        controller: mockController,
        container: {},
        bootstrapTime: 123.45,
      }),
    };

    // Import mocked modules
    CharacterBuilderBootstrap = (
      await import('../../src/characterBuilder/CharacterBuilderBootstrap.js')
    ).CharacterBuilderBootstrap;
    ClichesGeneratorController = (
      await import(
        '../../src/clichesGenerator/controllers/ClichesGeneratorController.js'
      )
    ).ClichesGeneratorController;

    // Mock implementations
    CharacterBuilderBootstrap.mockImplementation(() => mockBootstrap);
    ClichesGeneratorController.mockImplementation(() => mockController);

    // Import the module under test after setting up all mocks
    const module = await import('../../src/cliches-generator-main.js');
    initializeApp = module.initializeApp;
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    process.env.NODE_ENV = originalNodeEnv;

    // Restore DOM state
    windowAddEventListenerSpy.mockRestore();
    documentAddEventListenerSpy.mockRestore();
    getElementByIdSpy.mockRestore();
    restoreReadyState();
    document.body.innerHTML = '';
    window.__clichesController = undefined;

    // Clear all mocks
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('should register DOMContentLoaded listener when the document is still loading', () => {
    expect(documentAddEventListenerSpy).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );
    expect(mockBootstrap.bootstrap).not.toHaveBeenCalled();
  });

  it('should bootstrap with correct configuration', async () => {
    // Act
    const result = await initializeApp();

    // Assert
    expect(mockBootstrap.bootstrap).toHaveBeenCalledWith({
      pageName: 'cliches-generator',
      controllerClass: ClichesGeneratorController,
      includeModLoading: true,
      customSchemas: ['/data/schemas/cliche.schema.json'],
      // Note: Event definitions are no longer passed here - they're loaded from mod files
      hooks: expect.objectContaining({
        postInit: expect.any(Function),
      }),
    });

    expect(result).toEqual({
      controller: mockController,
      container: {},
      bootstrapTime: 123.45,
    });
  });

  it('should include mod loading configuration for core event definitions', async () => {
    // Act
    await initializeApp();

    // Assert - Verify that includeModLoading is set to true
    expect(mockBootstrap.bootstrap).toHaveBeenCalledWith(
      expect.objectContaining({
        includeModLoading: true,
      })
    );
  });

  it('should log initialization messages', async () => {
    // Act
    await initializeApp();

    // Assert
    expect(console.log).toHaveBeenCalledWith(
      'Initializing Clichés Generator...'
    );
    expect(console.log).toHaveBeenCalledWith(
      'Clichés Generator initialized in 123.45ms'
    );
  });

  it('should set up cleanup on page unload', async () => {
    // Spy on window.addEventListener after module import
    // Act
    await initializeApp();

    // Assert
    expect(windowAddEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );

    // Test the cleanup function
    const cleanupHandler = windowAddEventListenerSpy.mock.calls[0][1];
    await cleanupHandler();
    expect(mockController.cleanup).toHaveBeenCalled();
  });

  it('should expose debug objects in development mode', async () => {
    // Arrange
    process.env.NODE_ENV = 'development';

    // Act
    const result = await initializeApp();

    // Get the postInit hook and execute it
    const postInitHook =
      mockBootstrap.bootstrap.mock.calls[0][0].hooks.postInit;
    postInitHook(mockController);

    // Assert
    expect(window.__clichesController).toBe(mockController);
    expect(console.log).toHaveBeenCalledWith(
      'Debug: Controller exposed on window object'
    );
  });

  it('should not expose debug objects in production mode', async () => {
    // Arrange
    process.env.NODE_ENV = 'production';
    window.__clichesController = undefined;

    // Act
    const result = await initializeApp();

    // Get the postInit hook and execute it
    const postInitHook =
      mockBootstrap.bootstrap.mock.calls[0][0].hooks.postInit;
    postInitHook(mockController);

    // Assert
    expect(window.__clichesController).toBeUndefined();
    expect(console.log).not.toHaveBeenCalledWith(
      'Debug: Controller exposed on window object'
    );
  });

  it('should render a friendly error message when initialization fails', async () => {
    // Arrange
    const bootstrapError = new Error('Bootstrap failed');
    mockBootstrap.bootstrap.mockRejectedValue(bootstrapError);
    const errorContainer = document.createElement('div');
    errorContainer.id = 'cliches-generator-container';
    document.body.appendChild(errorContainer);

    // Act & Assert
    await expect(initializeApp()).rejects.toThrow('Bootstrap failed');

    expect(console.error).toHaveBeenCalledWith(
      'Failed to initialize Clichés Generator:',
      bootstrapError
    );
    expect(getElementByIdSpy).toHaveBeenCalledWith(
      'cliches-generator-container'
    );
    expect(errorContainer.innerHTML).toContain(
      'Unable to Load Clichés Generator'
    );
    expect(errorContainer.innerHTML).toContain('Bootstrap failed');
  });

  it('should handle cleanup errors gracefully', async () => {
    // Arrange
    const cleanupError = new Error('Cleanup failed');
    mockController.cleanup.mockRejectedValue(cleanupError);
    // Act
    await initializeApp();

    // Get and execute the cleanup handler
    const cleanupHandler = windowAddEventListenerSpy.mock.calls[0][1];

    // Act & Assert - The production code doesn't catch cleanup errors, so they will be thrown
    await expect(cleanupHandler()).rejects.toThrow('Cleanup failed');
  });

  it('should handle missing controller during cleanup', async () => {
    // Arrange
    mockBootstrap.bootstrap.mockResolvedValue({
      controller: null,
      container: {},
      bootstrapTime: 123.45,
    });

    // Act
    await initializeApp();

    // Get and execute the cleanup handler
    const cleanupHandler = windowAddEventListenerSpy.mock.calls[0][1];

    // Act & Assert - Should not throw
    await expect(cleanupHandler()).resolves.toBeUndefined();
    expect(mockController.cleanup).not.toHaveBeenCalled();
  });

  it('should not provide event definitions directly (they are loaded from mods)', async () => {
    // Act
    await initializeApp();

    // Assert - Event definitions should not be passed since they're loaded from mod files
    const callArgs = mockBootstrap.bootstrap.mock.calls[0][0];
    expect(callArgs.eventDefinitions).toBeUndefined();

    // Verify that includeModLoading is true, which will cause events to be loaded from mods
    expect(callArgs.includeModLoading).toBe(true);
  });

  it('should initialize immediately when the document is already ready', async () => {
    // Arrange - reset modules and change ready state before importing again
    jest.resetModules();
    mockBootstrap.bootstrap.mockClear();
    documentAddEventListenerSpy.mockClear();
    windowAddEventListenerSpy.mockClear();
    getElementByIdSpy.mockClear();
    setReadyState('complete');

    CharacterBuilderBootstrap = (
      await import('../../src/characterBuilder/CharacterBuilderBootstrap.js')
    ).CharacterBuilderBootstrap;
    ClichesGeneratorController = (
      await import(
        '../../src/clichesGenerator/controllers/ClichesGeneratorController.js'
      )
    ).ClichesGeneratorController;

    CharacterBuilderBootstrap.mockImplementation(() => mockBootstrap);
    ClichesGeneratorController.mockImplementation(() => mockController);

    // Act - importing triggers initializeApp immediately
    await import('../../src/cliches-generator-main.js');

    // Assert - initialization ran right away
    expect(mockBootstrap.bootstrap).toHaveBeenCalledTimes(1);
    expect(documentAddEventListenerSpy).not.toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );
    await Promise.resolve();
    expect(windowAddEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );

    // Reset ready state for subsequent tests
    setReadyState('loading');
  });
});
