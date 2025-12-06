/**
 * @file Unit tests for core-motivations-generator-main.js
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
  '../../src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js'
);
jest.mock(
  '../../src/coreMotivationsGenerator/services/CoreMotivationsDisplayEnhancer.js'
);
jest.mock('../../src/characterBuilder/services/CoreMotivationsGenerator.js');

describe('Core Motivations Generator Entry Point', () => {
  let mockBootstrap;
  let mockController;
  let originalConsoleLog;
  let originalConsoleError;
  let mockGetElementById;
  let mockAddEventListener;
  let CharacterBuilderBootstrap;
  let CoreMotivationsGeneratorController;
  let CoreMotivationsDisplayEnhancer;
  let CoreMotivationsGenerator;
  let initializeApp;
  let originalDocumentReadyStateDescriptor;
  let originalDocumentGetElementById;
  let originalDocumentAddEventListener;
  let originalWindowAddEventListener;

  const flushPromises = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

  const storeOriginalDomGlobals = () => {
    if (!originalDocumentReadyStateDescriptor) {
      originalDocumentReadyStateDescriptor = Object.getOwnPropertyDescriptor(
        document,
        'readyState'
      );
    }

    if (!originalDocumentGetElementById) {
      originalDocumentGetElementById = document.getElementById;
    }

    if (!originalDocumentAddEventListener) {
      originalDocumentAddEventListener = document.addEventListener;
    }

    if (!originalWindowAddEventListener) {
      originalWindowAddEventListener = window.addEventListener;
    }
  };

  const restoreDomGlobals = () => {
    if (originalDocumentReadyStateDescriptor) {
      Object.defineProperty(
        document,
        'readyState',
        originalDocumentReadyStateDescriptor
      );
    }

    if (originalDocumentGetElementById) {
      document.getElementById = originalDocumentGetElementById;
    }

    if (originalDocumentAddEventListener) {
      document.addEventListener = originalDocumentAddEventListener;
    }

    if (originalWindowAddEventListener) {
      window.addEventListener = originalWindowAddEventListener;
    }
  };

  const setupEnvironment = async ({ readyState = 'loading' } = {}) => {
    jest.resetModules();

    console.log = jest.fn();
    console.error = jest.fn();

    storeOriginalDomGlobals();
    restoreDomGlobals();

    mockController = {
      cleanup: jest.fn().mockResolvedValue(undefined),
    };

    mockBootstrap = {
      bootstrap: jest.fn().mockResolvedValue({
        controller: mockController,
        container: {},
        bootstrapTime: 123.45,
      }),
    };

    CharacterBuilderBootstrap = (
      await import('../../src/characterBuilder/CharacterBuilderBootstrap.js')
    ).CharacterBuilderBootstrap;
    CoreMotivationsGeneratorController = (
      await import(
        '../../src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js'
      )
    ).CoreMotivationsGeneratorController;
    CoreMotivationsDisplayEnhancer = (
      await import(
        '../../src/coreMotivationsGenerator/services/CoreMotivationsDisplayEnhancer.js'
      )
    ).CoreMotivationsDisplayEnhancer;
    CoreMotivationsGenerator = (
      await import(
        '../../src/characterBuilder/services/CoreMotivationsGenerator.js'
      )
    ).CoreMotivationsGenerator;

    CharacterBuilderBootstrap.mockImplementation(() => mockBootstrap);
    CoreMotivationsGeneratorController.mockImplementation(() => mockController);
    CoreMotivationsDisplayEnhancer.mockImplementation(() => ({}));
    CoreMotivationsGenerator.mockImplementation(() => ({}));

    mockGetElementById = jest.fn();
    mockAddEventListener = jest.fn();

    document.getElementById = mockGetElementById;
    document.addEventListener = mockAddEventListener;
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: () => readyState,
    });

    window.addEventListener = jest.fn();
    window.__coreMotivationsController = undefined;

    global.process = {
      env: {
        NODE_ENV: 'test',
      },
    };

    const module = await import('../../src/core-motivations-generator-main.js');
    initializeApp = module.initializeApp;
  };

  beforeEach(async () => {
    originalConsoleLog = console.log;
    originalConsoleError = console.error;

    await setupEnvironment({ readyState: 'loading' });
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    restoreDomGlobals();

    // Clear all mocks
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('should register DOMContentLoaded handler when document is still loading', () => {
    expect(mockAddEventListener).toHaveBeenCalledWith(
      'DOMContentLoaded',
      initializeApp
    );
  });

  it('should bootstrap with correct configuration', async () => {
    // Act
    const result = await initializeApp();

    // Assert
    expect(mockBootstrap.bootstrap).toHaveBeenCalledWith({
      pageName: 'core-motivations-generator',
      controllerClass: CoreMotivationsGeneratorController,
      includeModLoading: true,
      customSchemas: ['/data/schemas/core-motivation.schema.json'],
      services: {
        displayEnhancer: CoreMotivationsDisplayEnhancer,
        coreMotivationsGenerator: CoreMotivationsGenerator,
      },
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
        services: {
          displayEnhancer: CoreMotivationsDisplayEnhancer,
          coreMotivationsGenerator: CoreMotivationsGenerator,
        },
      })
    );
  });

  it('should log initialization messages', async () => {
    // Act
    await initializeApp();

    // Assert
    expect(console.log).toHaveBeenCalledWith(
      'Initializing Core Motivations Generator...'
    );
    expect(console.log).toHaveBeenCalledWith(
      'Core Motivations Generator initialized in 123.45ms'
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
    expect(global.window.__coreMotivationsController).toBe(mockController);
    expect(console.log).toHaveBeenCalledWith(
      'Debug: Controller exposed on window object'
    );
  });

  it('should not expose debug objects in production mode', async () => {
    // Arrange
    global.process.env.NODE_ENV = 'production';
    global.window.__coreMotivationsController = undefined;

    // Act
    const result = await initializeApp();

    // Get the postInit hook and execute it
    const postInitHook =
      mockBootstrap.bootstrap.mock.calls[0][0].hooks.postInit;
    postInitHook(mockController);

    // Assert
    expect(global.window.__coreMotivationsController).toBeUndefined();
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
      'Failed to initialize Core Motivations Generator:',
      testError
    );

    expect(getElementByIdSpy).toHaveBeenCalledWith(
      'core-motivations-container'
    );
    expect(mockContainer.innerHTML).toContain(
      'Unable to Load Core Motivations Generator'
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
      'Failed to initialize Core Motivations Generator:',
      testError
    );

    // Should not throw when container is not found
    expect(getElementByIdSpy).toHaveBeenCalledWith(
      'core-motivations-container'
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

  it('should use correct custom schema path', async () => {
    // Act
    await initializeApp();

    // Assert
    const callArgs = mockBootstrap.bootstrap.mock.calls[0][0];
    expect(callArgs.customSchemas).toEqual([
      '/data/schemas/core-motivation.schema.json',
    ]);
  });

  it('should use correct page name', async () => {
    // Act
    await initializeApp();

    // Assert
    const callArgs = mockBootstrap.bootstrap.mock.calls[0][0];
    expect(callArgs.pageName).toBe('core-motivations-generator');
  });

  it('should pass correct controller class', async () => {
    // Act
    await initializeApp();

    // Assert
    const callArgs = mockBootstrap.bootstrap.mock.calls[0][0];
    expect(callArgs.controllerClass).toBe(CoreMotivationsGeneratorController);
  });

  it('should handle missing bootstrap result without logging success message', async () => {
    mockBootstrap.bootstrap.mockResolvedValue(undefined);

    console.log.mockClear();

    const result = await initializeApp();

    expect(result).toBeUndefined();
    expect(console.log).toHaveBeenCalledWith(
      'Initializing Core Motivations Generator...'
    );
    expect(console.log).not.toHaveBeenCalledWith(
      'Core Motivations Generator initialized successfully'
    );
    expect(global.window.addEventListener).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );
  });

  it('should handle bootstrap result without bootstrapTime', async () => {
    // Arrange
    mockBootstrap.bootstrap.mockResolvedValue({
      controller: mockController,
      container: {},
      // No bootstrapTime property
    });

    // Clear previous console.log calls from other tests
    console.log.mockClear();

    // Act
    const result = await initializeApp();

    // Assert
    expect(result).toEqual({
      controller: mockController,
      container: {},
    });
    // Should log the generic success message instead of the timing message
    expect(console.log).toHaveBeenCalledWith(
      'Core Motivations Generator initialized successfully'
    );
    // Should not log the timing message
    expect(console.log).not.toHaveBeenCalledWith(
      expect.stringMatching(/initialized in \d+\.\d+ms/)
    );
  });

  it('should initialize immediately when the DOM is already loaded', async () => {
    await setupEnvironment({ readyState: 'complete' });

    await flushPromises();

    expect(mockAddEventListener).not.toHaveBeenCalled();
    expect(mockBootstrap.bootstrap).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(
      'Initializing Core Motivations Generator...'
    );
    expect(global.window.addEventListener).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );
  });
});
