/**
 * @file anatomyVisualizerInitialization.test.js
 * @description Tests for anatomy visualizer initialization sequence, specifically AnatomyFormattingService
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

// Mock the CommonBootstrapper
const mockBootstrap = jest.fn();
const mockDisplayFatalStartupError = jest.fn();

jest.mock('../../../src/bootstrapper/CommonBootstrapper.js', () => ({
  CommonBootstrapper: jest.fn().mockImplementation(() => ({
    bootstrap: mockBootstrap,
    displayFatalStartupError: mockDisplayFatalStartupError,
  })),
}));

// Mock AnatomyVisualizerUI
const mockUIInitialize = jest.fn();
jest.mock('../../../src/domUI/AnatomyVisualizerUI.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    initialize: mockUIInitialize,
  })),
}));

// Mock registerVisualizerComponents
jest.mock(
  '../../../src/dependencyInjection/registrations/visualizerRegistrations.js',
  () => ({
    registerVisualizerComponents: jest.fn(),
  })
);

// Mock tokens
jest.mock('../../../src/dependencyInjection/tokens.js', () => ({
  __esModule: true,
  tokens: {
    AnatomyDescriptionService: 'AnatomyDescriptionService',
    VisualizerState: 'VisualizerState',
    AnatomyLoadingDetector: 'AnatomyLoadingDetector',
    VisualizerStateController: 'VisualizerStateController',
    VisualizationComposer: 'VisualizationComposer',
    ClothingManagementService: 'ClothingManagementService',
    ILogger: 'ILogger',
    IEntityManager: 'IEntityManager',
    IValidatedEventDispatcher: 'IValidatedEventDispatcher',
  },
}));

const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
};

const containerMock = {
  resolve: jest.fn(),
};

let AnatomyVisualizerUIMock;

const servicesMock = {
  logger: loggerMock,
  registry: {},
  entityManager: {},
  eventDispatcher: {},
};

const defaultLocationHref = window.location.href;

let containerDependencies;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  AnatomyVisualizerUIMock = jest.requireMock(
    '../../../src/domUI/AnatomyVisualizerUI.js'
  ).default;
  AnatomyVisualizerUIMock.mockClear();
  document.body.innerHTML = '<button id="back-button"></button>';
  Object.defineProperty(document, 'readyState', {
    value: 'complete',
    writable: true,
  });
  global.alert = jest.fn();

  containerDependencies = {
    AnatomyDescriptionService: {},
    VisualizerStateController: {},
    VisualizationComposer: {},
    ClothingManagementService: { register: jest.fn() },
    ILogger: loggerMock,
    IEntityManager: {},
    IValidatedEventDispatcher: {},
  };

  containerMock.resolve.mockImplementation((token) => {
    const value = containerDependencies[token];
    if (value instanceof Error) {
      throw value;
    }
    if (typeof value === 'undefined') {
      return {};
    }
    return value;
  });

  // Setup default mock behavior
  mockBootstrap.mockImplementation(async (options) => {
    // Call the postInitHook if provided
    if (options && options.postInitHook) {
      await options.postInitHook(servicesMock, containerMock);
    }
    return { container: containerMock, services: servicesMock };
  });
});

afterEach(() => {
  delete global.alert;
  window.history.replaceState(null, '', defaultLocationHref);
});

describe('Anatomy Visualizer Initialization', () => {
  describe('initialization sequence', () => {
    it('should initialize with anatomy formatting enabled', async () => {
      await jest.isolateModulesAsync(async () => {
        await import('../../../src/anatomy-visualizer.js');
      });
      await Promise.resolve();

      // Verify bootstrap was called with includeAnatomyFormatting
      expect(mockBootstrap).toHaveBeenCalledWith({
        containerConfigType: 'minimal',
        worldName: 'default',
        includeAnatomyFormatting: true,
        postInitHook: expect.any(Function),
      });

      // Verify UI was initialized
      expect(mockUIInitialize).toHaveBeenCalled();
    });

    it('should log initialization steps', async () => {
      await jest.isolateModulesAsync(async () => {
        await import('../../../src/anatomy-visualizer.js');
      });
      // Wait for all async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify key logging steps in the postInitHook
      expect(loggerMock.info).toHaveBeenCalledWith(
        'Anatomy Visualizer: Initializing UI...'
      );
      expect(loggerMock.info).toHaveBeenCalledWith(
        'Anatomy Visualizer: Initialization complete'
      );
    });

    it('should resolve AnatomyDescriptionService from container', async () => {
      await jest.isolateModulesAsync(async () => {
        await import('../../../src/anatomy-visualizer.js');
      });
      await Promise.resolve();

      // Verify AnatomyDescriptionService was resolved from container
      expect(containerMock.resolve).toHaveBeenCalledWith(
        'AnatomyDescriptionService'
      );
    });

    it('should attach back button handler that navigates to the landing page', async () => {
      const backButton = document.getElementById('back-button');
      const addListenerSpy = jest.spyOn(backButton, 'addEventListener');
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await jest.isolateModulesAsync(async () => {
        await import('../../../src/anatomy-visualizer.js');
      });
      await Promise.resolve();
      await Promise.resolve();

      expect(addListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );

      const handler = addListenerSpy.mock.calls[0][1];
      handler();

      expect(consoleErrorSpy).toHaveBeenCalled();

      addListenerSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should warn and proceed when clothing management service is unavailable', async () => {
      document.body.innerHTML = '';
      containerDependencies.ClothingManagementService = new Error(
        'Missing dependency'
      );

      await jest.isolateModulesAsync(async () => {
        await import('../../../src/anatomy-visualizer.js');
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.resolve();
      await Promise.resolve();

      expect(loggerMock.warn).toHaveBeenCalledWith(
        'ClothingManagementService not available - equipment panel will be disabled'
      );

      expect(AnatomyVisualizerUIMock).toHaveBeenCalled();
      const constructorArgs = AnatomyVisualizerUIMock.mock.calls[0][0];
      expect(constructorArgs.clothingManagementService).toBeNull();
      expect(mockUIInitialize).toHaveBeenCalled();
    });

    it('should defer initialization until DOMContentLoaded when document is loading', async () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
      document.readyState = 'loading';

      await jest.isolateModulesAsync(async () => {
        await import('../../../src/anatomy-visualizer.js');
      });

      expect(mockBootstrap).not.toHaveBeenCalled();
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'DOMContentLoaded',
        expect.any(Function)
      );

      document.dispatchEvent(new Event('DOMContentLoaded'));
      await Promise.resolve();
      await Promise.resolve();

      expect(mockBootstrap).toHaveBeenCalled();
      addEventListenerSpy.mockRestore();
    });

    it('should handle bootstrap failure', async () => {
      // Make bootstrap fail
      const initError = new Error('Bootstrap initialization failed');
      mockBootstrap.mockRejectedValue(initError);

      await jest.isolateModulesAsync(async () => {
        await import('../../../src/anatomy-visualizer.js');
      });
      await Promise.resolve();

      // Verify error was handled
      expect(mockDisplayFatalStartupError).toHaveBeenCalledWith(
        'Failed to initialize anatomy visualizer: Bootstrap initialization failed',
        initError
      );
    });

    it('should handle UI initialization failure', async () => {
      // Make UI initialization fail
      const uiError = new Error('UI initialization failed');
      mockUIInitialize.mockRejectedValue(uiError);

      // Mock console.error to check error handling
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      // Mock bootstrap to still succeed but the postInitHook will throw
      mockBootstrap.mockImplementation(async (options) => {
        if (options && options.postInitHook) {
          await options.postInitHook(servicesMock, containerMock);
        }
        return { container: containerMock, services: servicesMock };
      });

      await jest.isolateModulesAsync(async () => {
        await import('../../../src/anatomy-visualizer.js');
      });
      await Promise.resolve();

      // Verify error was handled
      expect(mockDisplayFatalStartupError).toHaveBeenCalledWith(
        'Failed to initialize anatomy visualizer: UI initialization failed',
        uiError
      );

      consoleError.mockRestore();
    });
  });
});
