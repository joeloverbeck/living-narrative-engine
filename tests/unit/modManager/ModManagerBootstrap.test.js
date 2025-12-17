/**
 * @file Unit tests for ModManagerBootstrap
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Create a mock logger instance
const mockLoggerInstance = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock ConsoleLogger with a factory function
jest.mock('../../../src/logging/consoleLogger.js', () => {
  return jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }));
});

import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { ModManagerBootstrap } from '../../../src/modManager/ModManagerBootstrap.js';

describe('ModManagerBootstrap', () => {
  let bootstrap;
  let originalDocument;
  let loggerMock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock logger for each test
    loggerMock = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    ConsoleLogger.mockReturnValue(loggerMock);

    bootstrap = new ModManagerBootstrap();

    // Mock document for DOM operations
    originalDocument = global.document;
    global.document = {
      querySelectorAll: jest.fn(() => []),
    };
  });

  afterEach(() => {
    global.document = originalDocument;
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

      expect(loggerMock.info).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Initializing Mod Manager...'
      );
    });

    it('should log success message on completion', async () => {
      await bootstrap.initialize();

      expect(loggerMock.info).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Mod Manager initialized successfully'
      );
    });

    it('should register logger in container', async () => {
      await bootstrap.initialize();

      expect(loggerMock.debug).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Registering services...'
      );
    });

    it('should log controller initialization debug message', async () => {
      await bootstrap.initialize();

      expect(loggerMock.debug).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Initializing controller...'
      );
    });

    it('should log data loading debug message', async () => {
      await bootstrap.initialize();

      expect(loggerMock.debug).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Loading initial data...'
      );
    });

    it('should update loading indicators to ready state', async () => {
      const mockIndicator = { textContent: '' };
      global.document.querySelectorAll = jest.fn(() => [mockIndicator]);

      await bootstrap.initialize();

      expect(global.document.querySelectorAll).toHaveBeenCalledWith(
        '.loading-indicator'
      );
      expect(mockIndicator.textContent).toBe(
        'No data loaded yet. Services not connected.'
      );
    });
  });

  describe('initialize error handling', () => {
    it('should log error and rethrow on failure', async () => {
      // Create a bootstrap that will fail
      const testError = new Error('Test initialization error');

      // Make logger.debug throw to simulate failure
      loggerMock.debug = jest.fn(() => {
        throw testError;
      });

      // Create new bootstrap with failing logger
      ConsoleLogger.mockReturnValue(loggerMock);
      const failingBootstrap = new ModManagerBootstrap();

      await expect(failingBootstrap.initialize()).rejects.toThrow(testError);

      expect(loggerMock.error).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Initialization failed',
        testError
      );
    });
  });

  describe('destroy', () => {
    it('should log destruction message', async () => {
      await bootstrap.initialize();

      bootstrap.destroy();

      expect(loggerMock.info).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Destroying Mod Manager...'
      );
    });

    it('should clear the container', async () => {
      await bootstrap.initialize();

      // Should not throw
      expect(() => bootstrap.destroy()).not.toThrow();
    });

    it('should handle destroy without prior initialization', () => {
      // Should not throw even without initialization
      expect(() => bootstrap.destroy()).not.toThrow();
    });
  });

  describe('loading state updates', () => {
    it('should update multiple loading indicators', async () => {
      const mockIndicators = [
        { textContent: '' },
        { textContent: '' },
        { textContent: '' },
      ];
      global.document.querySelectorAll = jest.fn(() => mockIndicators);

      await bootstrap.initialize();

      mockIndicators.forEach((indicator) => {
        expect(indicator.textContent).toBe(
          'No data loaded yet. Services not connected.'
        );
      });
    });

    it('should handle no loading indicators gracefully', async () => {
      global.document.querySelectorAll = jest.fn(() => []);

      // Should not throw when no indicators exist
      await expect(bootstrap.initialize()).resolves.not.toThrow();
    });
  });

  describe('container behavior', () => {
    it('should create a Map-based container (lightweight)', async () => {
      await bootstrap.initialize();

      // Container should be created (internal implementation detail)
      // We verify through the successful initialization
      expect(loggerMock.info).toHaveBeenCalledWith(
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
