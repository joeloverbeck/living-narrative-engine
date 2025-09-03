/**
 * @file Unit tests to reproduce runtime errors in containerConfig.js
 * These tests specifically target the NODE_ENV access that causes browser compatibility issues
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Setup all mocks before imports
jest.mock('../../../src/logging/loggerStrategy.js', () => jest.fn());

jest.mock('../../../src/logging/consoleLogger.js');

// Mock environment utilities
jest.mock('../../../src/utils/environmentUtils.js', () => ({
  isTestEnvironment: jest.fn(),
  getEnvironmentMode: jest.fn(),
}));

// Mock configuration utilities
jest.mock('../../../src/configuration/utils/loggerConfigUtils.js', () => ({
  loadAndApplyLoggerConfig: jest.fn(),
  loadDebugLogConfig: jest.fn(),
}));

jest.mock('../../../src/configuration/utils/traceConfigUtils.js', () => ({
  loadAndApplyTraceConfig: jest.fn(),
}));

// Mock base container configuration
jest.mock('../../../src/dependencyInjection/baseContainerConfig.js', () => ({
  configureBaseContainer: jest.fn(),
}));

// Mock Registrar
jest.mock('../../../src/utils/registrarHelpers.js', () => ({
  Registrar: jest.fn().mockImplementation((container) => ({
    instance: jest.fn((token, instance) => {
      container.register(token, instance);
    }),
  })),
}));

// Mock tokens
jest.mock('../../../src/dependencyInjection/tokens.js', () => ({
  tokens: {
    ILogger: 'ILogger',
    IEntityManager: 'IEntityManager',
    IDataRegistry: 'IDataRegistry', 
    ISchemaValidator: 'ISchemaValidator',
  },
}));

// Now import the modules we need after mocks are set up
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { isTestEnvironment, getEnvironmentMode } from '../../../src/utils/environmentUtils.js';
import { loadDebugLogConfig, loadAndApplyLoggerConfig } from '../../../src/configuration/utils/loggerConfigUtils.js';
import { loadAndApplyTraceConfig } from '../../../src/configuration/utils/traceConfigUtils.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';
import LoggerStrategy from '../../../src/logging/loggerStrategy.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';

describe('containerConfig - Runtime Error Reproduction', () => {
  let originalProcess;
  let mockContainer;
  let mockLogger;
  let mockUiElements;

  beforeEach(() => {
    // Save original process object
    originalProcess = globalThis.process;
    
    // Setup mocks
    mockContainer = {
      register: jest.fn(),
      resolve: jest.fn(),
      isRegistered: jest.fn().mockReturnValue(true),
    };
    
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      getMode: jest.fn().mockReturnValue('development'),
    };

    // Setup UI elements mock
    mockUiElements = {
      outputDiv: {},
      inputElement: {},
      titleElement: {},
      document: {},
    };

    // Setup LoggerStrategy mock to return our mock logger
    LoggerStrategy.mockImplementation(() => mockLogger);
    
    // Setup ConsoleLogger mock to return our mock logger
    ConsoleLogger.mockImplementation(() => mockLogger);
    
    // Setup container to resolve the logger
    mockContainer.resolve.mockReturnValue(mockLogger);
    
    // Setup config loading mocks
    loadDebugLogConfig.mockResolvedValue(null);
    loadAndApplyLoggerConfig.mockResolvedValue(undefined);
    loadAndApplyTraceConfig.mockResolvedValue(undefined);
    configureBaseContainer.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore original process object
    globalThis.process = originalProcess;
    jest.clearAllMocks();
  });

  describe('Browser Environment Process Access', () => {
    it('should handle missing process object when determining logger mode', async () => {
      // Simulate browser environment where process is not defined
      delete globalThis.process;
      
      // Setup environment utilities to return development mode for browser
      isTestEnvironment.mockReturnValue(false);
      getEnvironmentMode.mockReturnValue('development');

      // Should not throw ReferenceError when accessing process.env.NODE_ENV
      await expect(configureContainer(mockContainer, mockUiElements)).resolves.not.toThrow();
      
      // Should have created LoggerStrategy with development mode (fallback)
      expect(LoggerStrategy).toHaveBeenCalledWith({
        mode: 'development',
        config: expect.any(Object),
        dependencies: {
          consoleLogger: expect.any(Object),
        },
      });
    });

    it('should handle process object without env property', async () => {
      globalThis.process = { version: 'v16.0.0' }; // Process exists but no env
      
      // Setup environment utilities for non-test, development environment
      isTestEnvironment.mockReturnValue(false);
      getEnvironmentMode.mockReturnValue('development');

      await expect(configureContainer(mockContainer, mockUiElements)).resolves.not.toThrow();
      
      // Should fallback to development mode when process.env is undefined
      expect(LoggerStrategy).toHaveBeenCalledWith({
        mode: 'development',
        config: expect.any(Object),
        dependencies: {
          consoleLogger: expect.any(Object),
        },
      });
    });

    it('should correctly detect test environment when NODE_ENV is test', async () => {
      globalThis.process = {
        env: {
          NODE_ENV: 'test',
        },
      };
      
      // Setup environment utilities for test environment
      isTestEnvironment.mockReturnValue(true);
      getEnvironmentMode.mockReturnValue('test');

      await configureContainer(mockContainer, mockUiElements);
      
      // Should use test mode when NODE_ENV is test
      expect(LoggerStrategy).toHaveBeenCalledWith({
        mode: 'test',
        config: expect.any(Object),
        dependencies: {
          consoleLogger: expect.any(Object),
        },
      });
    });

    it('should use development mode for any non-test NODE_ENV value', async () => {
      globalThis.process = {
        env: {
          NODE_ENV: 'production',
        },
      };
      
      // Setup environment utilities for production (but not test)
      isTestEnvironment.mockReturnValue(false);
      getEnvironmentMode.mockReturnValue('development');

      await configureContainer(mockContainer, mockUiElements);
      
      // Should use development mode for production (per the original logic)
      expect(LoggerStrategy).toHaveBeenCalledWith({
        mode: 'development',
        config: expect.any(Object),
        dependencies: {
          consoleLogger: expect.any(Object),
        },
      });
    });
  });

  describe('Environment Variable Access Pattern Safety', () => {
    it('should safely access process.env with optional chaining', async () => {
      // Test various process object states
      const testCases = [
        undefined, // No process at all
        {}, // Empty process object  
        { env: {} }, // Process with empty env
        { env: null }, // Process with null env
        { env: { NODE_ENV: 'test' } }, // Normal case
      ];

      for (const processValue of testCases) {
        globalThis.process = processValue;
        
        // Setup environment utilities to handle various states
        if (processValue && processValue.env && processValue.env.NODE_ENV === 'test') {
          isTestEnvironment.mockReturnValue(true);
          getEnvironmentMode.mockReturnValue('test');
        } else {
          isTestEnvironment.mockReturnValue(false);
          getEnvironmentMode.mockReturnValue('development');
        }
        
        // Should not throw regardless of process object state
        await expect(configureContainer(mockContainer, mockUiElements)).resolves.not.toThrow();
        
        jest.clearAllMocks();
      }
    });

    it('should handle debug config loading failure gracefully', async () => {
      // Simulate the warning scenario
      globalThis.process = {
        env: {
          NODE_ENV: 'development',
        },
      };
      
      // Setup environment utilities
      isTestEnvironment.mockReturnValue(false);
      getEnvironmentMode.mockReturnValue('development');
      
      // Make debug config loading fail
      loadDebugLogConfig.mockRejectedValue(new Error('Failed to load config'));

      // The loadDebugLogConfig should fail but container config should continue
      await configureContainer(mockContainer, mockUiElements);
      
      // Container configuration should complete successfully despite debug config failure
      // Note: The actual code logs to console.debug, not logger.info
      expect(loadDebugLogConfig).toHaveBeenCalled();
      expect(configureBaseContainer).toHaveBeenCalled();
    });
  });
});