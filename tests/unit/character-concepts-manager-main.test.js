/**
 * @file Comprehensive unit tests for character-concepts-manager-main.js
 * Tests all functionality including initialization, event handlers, and error handling
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

// Create mock bootstrap
const mockBootstrap = jest.fn();

// Create mock controller
const mockController = {
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  refreshData: jest.fn(),
  handleOnline: jest.fn(),
  handleOffline: jest.fn(),
  refreshOnVisible: false,
};

// Mock CharacterBuilderBootstrap
jest.mock('../../src/characterBuilder/CharacterBuilderBootstrap.js', () => {
  return {
    CharacterBuilderBootstrap: jest.fn().mockImplementation(() => ({
      bootstrap: mockBootstrap,
    })),
  };
});

// Mock CharacterConceptsManagerController
jest.mock('../../src/domUI/characterConceptsManagerController.js', () => {
  return {
    CharacterConceptsManagerController: jest
      .fn()
      .mockImplementation(() => mockController),
  };
});

describe('Character Concepts Manager Main', () => {
  let originalWindow;
  let originalDocument;
  let originalConsole;
  let eventHandlers;
  let module;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    jest.resetModules();

    // Store originals
    originalWindow = global.window;
    originalDocument = global.document;
    originalConsole = {
      log: console.log,
      error: console.error,
    };

    // Track event handlers
    eventHandlers = {
      document: {},
      window: {},
    };

    // Mock document.hidden with a settable property
    let documentHidden = false;
    Object.defineProperty(document, 'hidden', {
      get: () => documentHidden,
      set: (value) => {
        documentHidden = value;
      },
      configurable: true,
    });

    // Spy on addEventListener methods to capture handlers
    jest
      .spyOn(document, 'addEventListener')
      .mockImplementation((event, handler) => {
        eventHandlers.document[event] = handler;
      });
    jest.spyOn(document, 'removeEventListener').mockImplementation(() => {});

    jest
      .spyOn(window, 'addEventListener')
      .mockImplementation((event, handler) => {
        eventHandlers.window[event] = handler;
      });
    jest.spyOn(window, 'removeEventListener').mockImplementation(() => {});

    // Mock console
    console.log = jest.fn();
    console.error = jest.fn();

    // Reset mock controller
    mockController.logger.info.mockClear();
    mockController.logger.warn.mockClear();
    mockController.logger.error.mockClear();
    mockController.refreshData.mockClear();
    mockController.handleOnline?.mockClear();
    mockController.handleOffline?.mockClear();
    mockController.refreshOnVisible = false;

    // Ensure optional methods exist as mocks
    if (!mockController.handleOnline) {
      mockController.handleOnline = jest.fn();
    }
    if (!mockController.handleOffline) {
      mockController.handleOffline = jest.fn();
    }

    // Import module fresh
    module = await import('../../src/character-concepts-manager-main.js');
  });

  afterEach(() => {
    // Restore spies
    jest.restoreAllMocks();

    // Restore document.hidden to original state
    delete document.hidden;

    // Restore console
    console.log = originalConsole.log;
    console.error = originalConsole.error;

    // Clear window property
    delete window.__characterConceptsManagerController;
  });

  describe('Module Exports', () => {
    it('should export initializeApp function and PAGE_NAME constant', () => {
      expect(typeof module.initializeApp).toBe('function');
      expect(module.PAGE_NAME).toBe('Character Concepts Manager');
    });
  });

  describe('Successful Initialization', () => {
    it('should initialize successfully with bootstrap time', async () => {
      const bootstrapTime = 123.45;

      // Setup successful bootstrap
      mockBootstrap.mockImplementation(async (config) => {
        // Validate config structure
        expect(config.pageName).toBe('Character Concepts Manager');
        expect(config.includeModLoading).toBe(true);
        expect(config.errorDisplay).toEqual({
          elementId: 'error-display',
          displayDuration: 5000,
          dismissible: true,
        });

        // Execute postInit hook if present
        if (config.hooks && config.hooks.postInit) {
          await config.hooks.postInit(mockController);
        }

        return { bootstrapTime };
      });

      await module.initializeApp();

      // Verify success log
      expect(console.log).toHaveBeenCalledWith(
        `Character Concepts Manager initialized successfully in ${bootstrapTime.toFixed(2)}ms`
      );

      // Verify controller was stored globally
      expect(window.__characterConceptsManagerController).toBe(mockController);

      // Verify event listeners were registered
      expect(document.addEventListener).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      );
      expect(window.addEventListener).toHaveBeenCalledWith(
        'online',
        expect.any(Function)
      );
      expect(window.addEventListener).toHaveBeenCalledWith(
        'offline',
        expect.any(Function)
      );
      expect(window.addEventListener).toHaveBeenCalledWith(
        'error',
        expect.any(Function)
      );
      expect(window.addEventListener).toHaveBeenCalledWith(
        'unhandledrejection',
        expect.any(Function)
      );
    });

    it('should handle undefined bootstrap time', async () => {
      mockBootstrap.mockResolvedValue({ bootstrapTime: undefined });

      await module.initializeApp();

      expect(console.log).toHaveBeenCalledWith(
        'Character Concepts Manager initialized successfully in unknownms'
      );
    });

    it('should handle missing bootstrap time property', async () => {
      mockBootstrap.mockResolvedValue({});

      await module.initializeApp();

      expect(console.log).toHaveBeenCalledWith(
        'Character Concepts Manager initialized successfully in unknownms'
      );
    });
  });

  describe('Error Handling During Initialization', () => {
    it('should handle bootstrap failure gracefully', async () => {
      const error = new Error('Bootstrap failed');
      mockBootstrap.mockRejectedValue(error);

      await module.initializeApp();

      expect(console.error).toHaveBeenCalledWith(
        'Failed to initialize Character Concepts Manager:',
        error
      );
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should handle error in postInit hook', async () => {
      const error = new Error('postInit failed');
      mockBootstrap.mockImplementation(async (config) => {
        if (config.hooks && config.hooks.postInit) {
          // This will throw when calling postInit
          throw error;
        }
      });

      await module.initializeApp();

      expect(console.error).toHaveBeenCalledWith(
        'Failed to initialize Character Concepts Manager:',
        error
      );
    });
  });

  describe('Page Visibility Event Handling', () => {
    beforeEach(async () => {
      // Setup successful bootstrap with postInit
      mockBootstrap.mockImplementation(async (config) => {
        if (config.hooks && config.hooks.postInit) {
          await config.hooks.postInit(mockController);
        }
        return { bootstrapTime: 100 };
      });

      await module.initializeApp();
    });

    it('should handle page becoming hidden', () => {
      // Page becomes hidden
      document.hidden = true;

      // Trigger visibility change event
      const handler = eventHandlers.document.visibilitychange;
      expect(handler).toBeDefined();
      handler();

      expect(mockController.logger.info).toHaveBeenCalledWith('Page hidden');
    });

    it('should handle page becoming visible without refresh', () => {
      // First hide the page
      document.hidden = true;
      eventHandlers.document.visibilitychange();

      // Clear previous calls
      mockController.logger.info.mockClear();

      // Now make it visible without refresh
      document.hidden = false;
      mockController.refreshOnVisible = false;
      eventHandlers.document.visibilitychange();

      expect(mockController.logger.info).toHaveBeenCalledWith('Page visible');
      expect(mockController.refreshData).not.toHaveBeenCalled();
    });

    it('should refresh data when page becomes visible with refreshOnVisible true', () => {
      // First hide the page
      document.hidden = true;
      eventHandlers.document.visibilitychange();

      // Clear previous calls
      mockController.logger.info.mockClear();

      // Now make it visible with refresh enabled
      document.hidden = false;
      mockController.refreshOnVisible = true;
      eventHandlers.document.visibilitychange();

      expect(mockController.logger.info).toHaveBeenCalledWith('Page visible');
      expect(mockController.refreshData).toHaveBeenCalled();
    });
  });

  describe('Network Status Event Handling', () => {
    beforeEach(async () => {
      // Setup successful bootstrap with postInit
      mockBootstrap.mockImplementation(async (config) => {
        if (config.hooks && config.hooks.postInit) {
          await config.hooks.postInit(mockController);
        }
        return { bootstrapTime: 100 };
      });

      await module.initializeApp();
    });

    it('should handle online event', () => {
      const handler = eventHandlers.window.online;
      expect(handler).toBeDefined();
      handler();

      expect(mockController.logger.info).toHaveBeenCalledWith(
        'Connection restored'
      );
      expect(mockController.handleOnline).toHaveBeenCalled();
    });

    it('should handle offline event', () => {
      const handler = eventHandlers.window.offline;
      expect(handler).toBeDefined();
      handler();

      expect(mockController.logger.warn).toHaveBeenCalledWith(
        'Connection lost'
      );
      expect(mockController.handleOffline).toHaveBeenCalled();
    });

    it('should handle missing controller methods gracefully', () => {
      // Remove optional methods
      delete mockController.handleOnline;
      delete mockController.handleOffline;

      // Should not throw
      expect(() => eventHandlers.window.online()).not.toThrow();
      expect(() => eventHandlers.window.offline()).not.toThrow();

      expect(mockController.logger.info).toHaveBeenCalledWith(
        'Connection restored'
      );
      expect(mockController.logger.warn).toHaveBeenCalledWith(
        'Connection lost'
      );
    });
  });

  describe('Global Error Event Handling', () => {
    beforeEach(async () => {
      // Setup successful bootstrap with postInit
      mockBootstrap.mockImplementation(async (config) => {
        if (config.hooks && config.hooks.postInit) {
          await config.hooks.postInit(mockController);
        }
        return { bootstrapTime: 100 };
      });

      await module.initializeApp();
    });

    it('should handle window error events', () => {
      const errorEvent = {
        message: 'Test error',
        filename: 'test.js',
        lineno: 42,
        colno: 10,
        error: new Error('Test error'),
        preventDefault: jest.fn(),
      };

      const handler = eventHandlers.window.error;
      expect(handler).toBeDefined();
      handler(errorEvent);

      expect(mockController.logger.error).toHaveBeenCalledWith(
        'Unhandled error',
        {
          message: errorEvent.message,
          filename: errorEvent.filename,
          lineno: errorEvent.lineno,
          colno: errorEvent.colno,
          error: errorEvent.error,
        }
      );

      expect(errorEvent.preventDefault).toHaveBeenCalled();
    });

    it('should handle unhandled promise rejections', () => {
      // Create a properly handled promise to avoid real unhandled rejection
      const handledPromise = Promise.reject('test').catch(() => {});

      const rejectionEvent = {
        reason: 'Promise rejected',
        promise: handledPromise,
        preventDefault: jest.fn(),
      };

      const handler = eventHandlers.window.unhandledrejection;
      expect(handler).toBeDefined();
      handler(rejectionEvent);

      expect(mockController.logger.error).toHaveBeenCalledWith(
        'Unhandled promise rejection',
        {
          reason: rejectionEvent.reason,
          promise: rejectionEvent.promise,
        }
      );

      expect(rejectionEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle controller without optional methods', async () => {
      // Create a minimal controller
      const minimalController = {
        logger: mockController.logger,
        // No refreshData, handleOnline, handleOffline, or refreshOnVisible
      };

      // Mock controller to return minimal version
      jest.resetModules();
      jest.doMock(
        '../../src/domUI/characterConceptsManagerController.js',
        () => ({
          CharacterConceptsManagerController: jest.fn(() => minimalController),
        })
      );

      const freshModule = await import(
        '../../src/character-concepts-manager-main.js'
      );

      mockBootstrap.mockImplementation(async (config) => {
        if (config.hooks && config.hooks.postInit) {
          await config.hooks.postInit(minimalController);
        }
        return { bootstrapTime: 100 };
      });

      await freshModule.initializeApp();

      // Should complete without errors
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('initialized successfully')
      );
    });

    it('should handle postInit without a controller', async () => {
      mockBootstrap.mockImplementation(async (config) => {
        if (config.hooks && config.hooks.postInit) {
          // Call postInit with undefined
          await config.hooks.postInit(undefined);
        }
        return { bootstrapTime: 100 };
      });

      // Should not throw
      await expect(module.initializeApp()).resolves.not.toThrow();
    });

    it('should gracefully exit postInit when browser APIs are unavailable', async () => {
      const sandboxEnv = {};

      await module.postInit(mockController, sandboxEnv);

      // Should exit immediately without touching the real browser globals
      expect(sandboxEnv.window).toBeUndefined();
      expect(global.window.__characterConceptsManagerController).toBeUndefined();
    });

    it('setupPageVisibilityHandling should short-circuit when document is undefined', () => {
      const env = { window: { addEventListener: jest.fn() } };

      module.setupPageVisibilityHandling(
        mockController,
        mockController.logger,
        env
      );

      expect(env.window.addEventListener).not.toHaveBeenCalled();
    });

    it('setupGlobalErrorHandling should short-circuit when window is undefined', () => {
      const mockLogger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };

      expect(() => module.setupGlobalErrorHandling(mockLogger, {})).not.toThrow();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});
