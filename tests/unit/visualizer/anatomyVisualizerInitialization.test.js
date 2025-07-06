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

// Mock functions
const mockConfigure = jest.fn();
const mockResolve = jest.fn();
const mockUIInitialize = jest.fn();

const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
};
const modsLoaderMock = {
  loadMods: jest.fn(async () => ({ finalModOrder: ['a', 'b'] })),
};
const registryMock = {};
const entityManagerMock = {};
const anatomyServiceMock = {};
const anatomyFormattingServiceMock = { initialize: jest.fn(async () => {}) };
const systemInitializerMock = { initializeAll: jest.fn(async () => {}) };
const dispatcherMock = {};

jest.mock('../../../src/dependencyInjection/minimalContainerConfig.js', () => ({
  __esModule: true,
  configureMinimalContainer: (...args) => mockConfigure(...args),
}));

jest.mock('../../../src/dependencyInjection/tokens.js', () => ({
  __esModule: true,
  tokens: {
    ILogger: 'ILogger',
    ModsLoader: 'ModsLoader',
    IDataRegistry: 'IDataRegistry',
    IEntityManager: 'IEntityManager',
    AnatomyDescriptionService: 'AnatomyDescriptionService',
    AnatomyFormattingService: 'AnatomyFormattingService',
    SystemInitializer: 'SystemInitializer',
    ISafeEventDispatcher: 'ISafeEventDispatcher',
  },
}));

jest.mock('../../../src/dependencyInjection/appContainer.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    resolve: mockResolve,
  })),
}));

jest.mock('../../../src/domUI/AnatomyVisualizerUI.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    initialize: mockUIInitialize,
  })),
}));

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  document.body.innerHTML = '<button id="back-button"></button>';
  Object.defineProperty(document, 'readyState', {
    value: 'complete',
    writable: true,
  });
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ mods: ['test-mod'] }),
  }));
  global.alert = jest.fn();

  mockResolve.mockImplementation((token) => {
    switch (token) {
      case 'ILogger':
        return loggerMock;
      case 'ModsLoader':
        return modsLoaderMock;
      case 'IDataRegistry':
        return registryMock;
      case 'IEntityManager':
        return entityManagerMock;
      case 'AnatomyDescriptionService':
        return anatomyServiceMock;
      case 'AnatomyFormattingService':
        return anatomyFormattingServiceMock;
      case 'SystemInitializer':
        return systemInitializerMock;
      case 'ISafeEventDispatcher':
        return dispatcherMock;
      default:
        return undefined;
    }
  });
});

afterEach(() => {
  delete global.fetch;
  delete global.alert;
});

describe('Anatomy Visualizer Initialization', () => {
  describe('initialization sequence', () => {
    it('should initialize AnatomyFormattingService after loading mods', async () => {
      await jest.isolateModulesAsync(async () => {
        await import('../../../src/anatomy-visualizer.js');
      });
      await Promise.resolve();

      // Verify the initialization sequence
      expect(modsLoaderMock.loadMods).toHaveBeenCalledWith('default', [
        'test-mod',
      ]);
      expect(anatomyFormattingServiceMock.initialize).toHaveBeenCalled();
      expect(systemInitializerMock.initializeAll).toHaveBeenCalled();

      // Verify AnatomyFormattingService was initialized after mods were loaded
      const modsLoadCall = modsLoaderMock.loadMods.mock.invocationCallOrder[0];
      const formatServiceCall =
        anatomyFormattingServiceMock.initialize.mock.invocationCallOrder[0];
      const systemInitCall =
        systemInitializerMock.initializeAll.mock.invocationCallOrder[0];

      expect(formatServiceCall).toBeGreaterThan(modsLoadCall);
      expect(systemInitCall).toBeGreaterThan(formatServiceCall);
    });

    it('should log initialization steps', async () => {
      await jest.isolateModulesAsync(async () => {
        await import('../../../src/anatomy-visualizer.js');
      });
      // Wait longer for all async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify key logging steps were called
      expect(loggerMock.info).toHaveBeenCalledWith(
        'Anatomy Visualizer: Starting initialization...'
      );
      expect(loggerMock.info).toHaveBeenCalledWith(
        'Anatomy Visualizer: Loading mods...'
      );
      expect(loggerMock.info).toHaveBeenCalledWith(
        'Anatomy Visualizer: Initializing AnatomyFormattingService...'
      );
      expect(loggerMock.info).toHaveBeenCalledWith(
        'Anatomy Visualizer: Initializing system services...'
      );
      expect(loggerMock.info).toHaveBeenCalledWith(
        'Anatomy Visualizer: Initializing UI...'
      );
      expect(loggerMock.info).toHaveBeenCalledWith(
        'Anatomy Visualizer: Initialization complete'
      );
    });

    it('should resolve AnatomyFormattingService from container', async () => {
      await jest.isolateModulesAsync(async () => {
        await import('../../../src/anatomy-visualizer.js');
      });
      await Promise.resolve();

      // Verify AnatomyFormattingService was resolved from container
      expect(mockResolve).toHaveBeenCalledWith('AnatomyFormattingService');
    });

    it('should handle AnatomyFormattingService initialization failure', async () => {
      // Make AnatomyFormattingService initialization fail
      const initError = new Error(
        'AnatomyFormattingService initialization failed'
      );
      anatomyFormattingServiceMock.initialize.mockRejectedValue(initError);

      // Mock console.error to check error handling
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      await jest.isolateModulesAsync(async () => {
        await import('../../../src/anatomy-visualizer.js');
      });
      await Promise.resolve();

      // Verify error was handled
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to initialize anatomy visualizer:',
        initError
      );
      expect(global.alert).toHaveBeenCalledWith(
        'Failed to initialize anatomy visualizer: AnatomyFormattingService initialization failed'
      );

      consoleError.mockRestore();
    });

    it('should not call systemInitializer if AnatomyFormattingService fails', async () => {
      // Make AnatomyFormattingService initialization fail
      anatomyFormattingServiceMock.initialize.mockRejectedValue(
        new Error('AnatomyFormattingService initialization failed')
      );

      // Mock console.error
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      await jest.isolateModulesAsync(async () => {
        await import('../../../src/anatomy-visualizer.js');
      });
      await Promise.resolve();

      // Verify systemInitializer was not called
      expect(systemInitializerMock.initializeAll).not.toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });
});
