/**
 * @file Unit tests for ModManagerBootstrap
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Create mock logger instance
const mockLoggerInstance = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock ConsoleLogger
jest.mock('../../../src/logging/consoleLogger.js', () => {
  return jest.fn(() => mockLoggerInstance);
});

// Mock all services
const mockModDiscoveryService = {
  discoverMods: jest.fn(),
  getModById: jest.fn(),
  clearCache: jest.fn(),
};

const mockModGraphService = {
  buildGraph: jest.fn(),
  setExplicitMods: jest.fn(),
  getLoadOrder: jest.fn(),
  getModStatus: jest.fn(),
};

const mockWorldDiscoveryService = {
  discoverWorlds: jest.fn(),
};

const mockConfigPersistenceService = {
  loadConfig: jest.fn(),
  saveConfig: jest.fn(),
  hasChanges: jest.fn(),
  cancelPendingSave: jest.fn(),
};

jest.mock('../../../src/modManager/services/ModDiscoveryService.js', () => {
  const mock = jest.fn(() => mockModDiscoveryService);
  return {
    __esModule: true,
    ModDiscoveryService: mock,
    default: mock,
  };
});

jest.mock('../../../src/modManager/services/ModGraphService.js', () => {
  const mock = jest.fn(() => mockModGraphService);
  return {
    __esModule: true,
    ModGraphService: mock,
    default: mock,
  };
});

jest.mock('../../../src/modManager/services/WorldDiscoveryService.js', () => {
  const mock = jest.fn(() => mockWorldDiscoveryService);
  return {
    __esModule: true,
    WorldDiscoveryService: mock,
    default: mock,
  };
});

jest.mock('../../../src/modManager/services/ConfigPersistenceService.js', () => {
  const mock = jest.fn(() => mockConfigPersistenceService);
  return {
    __esModule: true,
    ConfigPersistenceService: mock,
    default: mock,
  };
});

// Mock controller
const mockControllerInstance = {
  initialize: jest.fn(),
  subscribe: jest.fn(),
  getState: jest.fn(),
  destroy: jest.fn(),
};

jest.mock('../../../src/modManager/controllers/ModManagerController.js', () => {
  const mock = jest.fn(() => mockControllerInstance);
  return {
    __esModule: true,
    ModManagerController: mock,
    default: mock,
  };
});

import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { ModManagerBootstrap } from '../../../src/modManager/ModManagerBootstrap.js';
import ModDiscoveryService from '../../../src/modManager/services/ModDiscoveryService.js';
import ModGraphService from '../../../src/modManager/services/ModGraphService.js';
import WorldDiscoveryService from '../../../src/modManager/services/WorldDiscoveryService.js';
import ConfigPersistenceService from '../../../src/modManager/services/ConfigPersistenceService.js';
import ModManagerController from '../../../src/modManager/controllers/ModManagerController.js';

describe('ModManagerBootstrap', () => {
  let bootstrap;
  let mockIndicators;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock behavior
    mockControllerInstance.initialize.mockResolvedValue(undefined);
    mockControllerInstance.getState.mockReturnValue({
      availableMods: [{ id: 'core' }, { id: 'test_mod' }],
      activeMods: [],
      resolvedMods: ['core'],
      selectedWorld: 'core:core',
      availableWorlds: [],
      hasUnsavedChanges: false,
      isLoading: false,
      isSaving: false,
      error: null,
      searchQuery: '',
      filterCategory: 'all',
    });
    mockControllerInstance.subscribe.mockImplementation((callback) => {
      // Call callback with loaded state
      callback(mockControllerInstance.getState());
      return () => {};
    });

    // Mock document.querySelectorAll before creating bootstrap
    mockIndicators = [{ textContent: '' }, { textContent: '' }];
    jest.spyOn(document, 'querySelectorAll').mockReturnValue(mockIndicators);

    bootstrap = new ModManagerBootstrap();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create ConsoleLogger with INFO level', () => {
      expect(ConsoleLogger).toHaveBeenCalledWith('INFO');
    });

    it('should instantiate without errors', () => {
      expect(bootstrap).toBeInstanceOf(ModManagerBootstrap);
    });
  });

  describe('initialize', () => {
    it('should log initialization message', async () => {
      await bootstrap.initialize();

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Initializing Mod Manager...'
      );
    });

    it('should log success message on completion', async () => {
      await bootstrap.initialize();

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Mod Manager initialized successfully'
      );
    });

    it('should register all services', async () => {
      await bootstrap.initialize();

      expect(ModDiscoveryService).toHaveBeenCalledWith({
        logger: mockLoggerInstance,
      });
      expect(ModGraphService).toHaveBeenCalledWith({
        logger: mockLoggerInstance,
      });
      expect(WorldDiscoveryService).toHaveBeenCalledWith({
        logger: mockLoggerInstance,
        modDiscoveryService: mockModDiscoveryService,
      });
      expect(ConfigPersistenceService).toHaveBeenCalledWith({
        logger: mockLoggerInstance,
      });
    });

    it('should create controller with all dependencies', async () => {
      await bootstrap.initialize();

      expect(ModManagerController).toHaveBeenCalledWith({
        logger: mockLoggerInstance,
        modDiscoveryService: mockModDiscoveryService,
        modGraphService: mockModGraphService,
        worldDiscoveryService: mockWorldDiscoveryService,
        configPersistenceService: mockConfigPersistenceService,
      });
    });

    it('should call controller.initialize()', async () => {
      await bootstrap.initialize();

      expect(mockControllerInstance.initialize).toHaveBeenCalled();
    });

    it('should subscribe to controller state changes', async () => {
      await bootstrap.initialize();

      expect(mockControllerInstance.subscribe).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('should update loading indicators with mod count after successful load', async () => {
      await bootstrap.initialize();

      // Verify querySelectorAll was called
      expect(document.querySelectorAll).toHaveBeenCalledWith(
        '.loading-indicator'
      );

      // Should show "Loaded X mods" message
      mockIndicators.forEach((indicator) => {
        expect(indicator.textContent).toBe('Loaded 2 mods');
      });
    });

    it('should not show placeholder message after successful load', async () => {
      await bootstrap.initialize();

      mockIndicators.forEach((indicator) => {
        expect(indicator.textContent).not.toBe(
          'No data loaded yet. Services not connected.'
        );
      });
    });
  });

  describe('initialize error handling', () => {
    it('should log error and rethrow on controller initialization failure', async () => {
      const testError = new Error('Controller init failed');
      mockControllerInstance.initialize.mockRejectedValue(testError);

      await expect(bootstrap.initialize()).rejects.toThrow(testError);

      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Failed to load initial data',
        testError
      );
    });

    it('should update loading indicators to error state on failure', async () => {
      const testError = new Error('API connection failed');
      mockControllerInstance.initialize.mockRejectedValue(testError);

      try {
        await bootstrap.initialize();
      } catch {
        // Expected to throw
      }

      mockIndicators.forEach((indicator) => {
        expect(indicator.textContent).toBe('Failed to load data.');
      });
    });
  });

  describe('state change handling', () => {
    it('should show loading state when isLoading is true', async () => {
      mockControllerInstance.subscribe.mockImplementation((callback) => {
        callback({
          availableMods: [],
          isLoading: true,
          error: null,
        });
        return () => {};
      });

      await bootstrap.initialize();

      mockIndicators.forEach((indicator) => {
        expect(indicator.textContent).toBe('Loading mods...');
      });
    });

    it('should show error message from state when error exists', async () => {
      mockControllerInstance.subscribe.mockImplementation((callback) => {
        callback({
          availableMods: [],
          isLoading: false,
          error: 'API returned 500',
        });
        return () => {};
      });

      await bootstrap.initialize();

      mockIndicators.forEach((indicator) => {
        expect(indicator.textContent).toBe('API returned 500');
      });
    });
  });

  describe('destroy', () => {
    it('should log destruction message', async () => {
      await bootstrap.initialize();

      bootstrap.destroy();

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Destroying Mod Manager...'
      );
    });

    it('should call controller.destroy()', async () => {
      await bootstrap.initialize();

      bootstrap.destroy();

      expect(mockControllerInstance.destroy).toHaveBeenCalled();
    });

    it('should handle destroy without prior initialization', () => {
      expect(() => bootstrap.destroy()).not.toThrow();
    });
  });

  describe('loading state updates', () => {
    it('should update multiple loading indicators', async () => {
      const manyIndicators = [
        { textContent: '' },
        { textContent: '' },
        { textContent: '' },
      ];
      document.querySelectorAll.mockReturnValue(manyIndicators);

      await bootstrap.initialize();

      manyIndicators.forEach((indicator) => {
        expect(indicator.textContent).toBe('Loaded 2 mods');
      });
    });

    it('should handle no loading indicators gracefully', async () => {
      document.querySelectorAll.mockReturnValue([]);

      await expect(bootstrap.initialize()).resolves.not.toThrow();
    });
  });

  describe('container behavior', () => {
    it('should create a Map-based container (lightweight)', async () => {
      await bootstrap.initialize();

      // Container should be created and services registered
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Registering services...'
      );
      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Mod Manager initialized successfully'
      );
    });
  });
});

describe('ModManagerBootstrap default export', () => {
  it('should have named and default exports', async () => {
    const moduleImport = await import(
      '../../../src/modManager/ModManagerBootstrap.js'
    );

    expect(moduleImport.ModManagerBootstrap).toBeDefined();
    expect(moduleImport.default).toBeDefined();
    expect(moduleImport.ModManagerBootstrap).toBe(moduleImport.default);
  });
});
