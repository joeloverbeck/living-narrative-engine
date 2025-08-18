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
  let mockGetElementById;
  let mockAddEventListener;
  let CharacterBuilderBootstrap;
  let ClichesGeneratorController;
  let initializeApp;

  beforeEach(async () => {
    // Clear module cache
    jest.resetModules();

    // Store original console methods
    originalConsoleLog = console.log;
    originalConsoleError = console.error;

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

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

    // Mock DOM methods
    mockGetElementById = jest.fn();
    mockAddEventListener = jest.fn();

    global.document = {
      getElementById: mockGetElementById,
      readyState: 'loading', // Prevent immediate execution during import
      addEventListener: mockAddEventListener,
    };

    global.window = {
      addEventListener: jest.fn(),
      __clichesController: undefined,
    };

    global.process = {
      env: {
        NODE_ENV: 'test',
      },
    };

    // Import the module under test after setting up mocks
    const module = await import('../../src/cliches-generator-main.js');
    initializeApp = module.initializeApp;
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Clear all mocks
    jest.clearAllMocks();
    jest.resetModules();
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
    const addEventListenerSpy = jest.spyOn(global.window, 'addEventListener');

    // Act
    await initializeApp();

    // Assert
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );

    // Test the cleanup function
    const cleanupHandler = addEventListenerSpy.mock.calls[0][1];
    await cleanupHandler();
    expect(mockController.cleanup).toHaveBeenCalled();
  });

  it('should expose debug objects in development mode', async () => {
    // Arrange
    global.process.env.NODE_ENV = 'development';

    // Act
    const result = await initializeApp();

    // Get the postInit hook and execute it
    const postInitHook =
      mockBootstrap.bootstrap.mock.calls[0][0].hooks.postInit;
    postInitHook(mockController);

    // Assert
    expect(global.window.__clichesController).toBe(mockController);
    expect(console.log).toHaveBeenCalledWith(
      'Debug: Controller exposed on window object'
    );
  });

  it('should not expose debug objects in production mode', async () => {
    // Arrange
    global.process.env.NODE_ENV = 'production';
    global.window.__clichesController = undefined;

    // Act
    const result = await initializeApp();

    // Get the postInit hook and execute it
    const postInitHook =
      mockBootstrap.bootstrap.mock.calls[0][0].hooks.postInit;
    postInitHook(mockController);

    // Assert
    expect(global.window.__clichesController).toBeUndefined();
    expect(console.log).not.toHaveBeenCalledWith(
      'Debug: Controller exposed on window object'
    );
  });

  it('should handle initialization errors gracefully', async () => {
    // Arrange
    const testError = new Error('Bootstrap failed');
    mockBootstrap.bootstrap.mockRejectedValue(testError);

    const mockContainer = { innerHTML: '' };
    mockGetElementById.mockReturnValue(mockContainer);

    // Spy on the global document.getElementById
    const getElementByIdSpy = jest
      .spyOn(global.document, 'getElementById')
      .mockReturnValue(mockContainer);

    // Act & Assert
    await expect(initializeApp()).rejects.toThrow('Bootstrap failed');

    expect(console.error).toHaveBeenCalledWith(
      'Failed to initialize Clichés Generator:',
      testError
    );

    expect(getElementByIdSpy).toHaveBeenCalledWith(
      'cliches-generator-container'
    );
    expect(mockContainer.innerHTML).toContain(
      'Unable to Load Clichés Generator'
    );
    expect(mockContainer.innerHTML).toContain('Bootstrap failed');
    expect(mockContainer.innerHTML).toContain('Reload Page');

    // Restore the spy
    getElementByIdSpy.mockRestore();
  });

  it('should handle missing error container gracefully', async () => {
    // Arrange
    const testError = new Error('Bootstrap failed');
    mockBootstrap.bootstrap.mockRejectedValue(testError);

    // Spy on the global document.getElementById and return null
    const getElementByIdSpy = jest
      .spyOn(global.document, 'getElementById')
      .mockReturnValue(null);

    // Act & Assert
    await expect(initializeApp()).rejects.toThrow('Bootstrap failed');

    expect(console.error).toHaveBeenCalledWith(
      'Failed to initialize Clichés Generator:',
      testError
    );

    // Should not throw when container is not found
    expect(getElementByIdSpy).toHaveBeenCalledWith(
      'cliches-generator-container'
    );

    // Restore the spy
    getElementByIdSpy.mockRestore();
  });

  it('should handle cleanup errors gracefully', async () => {
    // Arrange
    const cleanupError = new Error('Cleanup failed');
    mockController.cleanup.mockRejectedValue(cleanupError);
    const addEventListenerSpy = jest.spyOn(global.window, 'addEventListener');

    // Act
    await initializeApp();

    // Get and execute the cleanup handler
    const cleanupHandler = addEventListenerSpy.mock.calls[0][1];

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
    const addEventListenerSpy = jest.spyOn(global.window, 'addEventListener');

    // Act
    await initializeApp();

    // Get and execute the cleanup handler
    const cleanupHandler = addEventListenerSpy.mock.calls[0][1];

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
});
