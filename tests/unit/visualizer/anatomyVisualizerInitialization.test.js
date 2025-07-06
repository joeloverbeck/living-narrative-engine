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

// Mock tokens
jest.mock('../../../src/dependencyInjection/tokens.js', () => ({
  __esModule: true,
  tokens: {
    AnatomyDescriptionService: 'AnatomyDescriptionService',
  },
}));

const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
};

const containerMock = {
  resolve: jest.fn((token) => {
    if (token === 'AnatomyDescriptionService') {
      return {};
    }
  }),
};

const servicesMock = {
  logger: loggerMock,
  registry: {},
  entityManager: {},
  eventDispatcher: {},
};

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  document.body.innerHTML = '<button id="back-button"></button>';
  Object.defineProperty(document, 'readyState', {
    value: 'complete',
    writable: true,
  });
  global.alert = jest.fn();

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
