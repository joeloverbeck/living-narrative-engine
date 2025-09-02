/**
 * @file Unit tests to reproduce runtime errors in containerConfig.js
 * These tests specifically target the NODE_ENV access that causes browser compatibility issues
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies first
const mockLoggerStrategy = jest.fn();
const mockConsoleLogger = jest.fn();

jest.mock('../../../src/logging/loggerStrategy.js', () => ({
  default: mockLoggerStrategy,
}));

jest.mock('../../../src/logging/consoleLogger.js', () => ({
  default: mockConsoleLogger,
}));

// Mock all the registration functions
jest.mock('../../../src/dependencyInjection/registrations/coreRegistrations.js', () => ({
  registerCoreServices: jest.fn(),
}));

jest.mock('../../../src/dependencyInjection/registrations/entityRegistrations.js', () => ({
  registerEntityServices: jest.fn(),
}));

jest.mock('../../../src/dependencyInjection/registrations/loaderRegistrations.js', () => ({
  registerLoaderServices: jest.fn(),
}));

// Now import the module under test
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';

describe('containerConfig - Runtime Error Reproduction', () => {
  let originalProcess;
  let mockContainer;
  let mockLogger;

  beforeEach(() => {
    // Save original process object
    originalProcess = globalThis.process;
    
    // Setup mocks
    mockContainer = {
      register: jest.fn(),
      get: jest.fn(),
    };
    
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Setup LoggerStrategy mock to return our mock logger
    mockLoggerStrategy.mockImplementation(() => mockLogger);
    mockConsoleLogger.mockImplementation(() => mockLogger);
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

      // Should not throw ReferenceError when accessing process.env.NODE_ENV
      await expect(configureContainer(mockContainer)).resolves.not.toThrow();
      
      // Should have created LoggerStrategy with development mode (fallback)
      expect(mockLoggerStrategy).toHaveBeenCalledWith({
        mode: 'development', // Should fallback to development when process is undefined
        debugConfig: null,
      });
    });

    it('should handle process object without env property', async () => {
      globalThis.process = { version: 'v16.0.0' }; // Process exists but no env

      await expect(configureContainer(mockContainer)).resolves.not.toThrow();
      
      // Should fallback to development mode when process.env is undefined
      expect(mockLoggerStrategy).toHaveBeenCalledWith({
        mode: 'development',
        debugConfig: null,
      });
    });

    it('should correctly detect test environment when NODE_ENV is test', async () => {
      globalThis.process = {
        env: {
          NODE_ENV: 'test',
        },
      };

      await configureContainer(mockContainer);
      
      // Should use test mode when NODE_ENV is test
      expect(mockLoggerStrategy).toHaveBeenCalledWith({
        mode: 'test',
        debugConfig: null,
      });
    });

    it('should use development mode for any non-test NODE_ENV value', async () => {
      globalThis.process = {
        env: {
          NODE_ENV: 'production',
        },
      };

      await configureContainer(mockContainer);
      
      // Should use development mode for production (per the original logic)
      expect(mockLoggerStrategy).toHaveBeenCalledWith({
        mode: 'development',
        debugConfig: null,
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
        
        // Should not throw regardless of process object state
        await expect(configureContainer(mockContainer)).resolves.not.toThrow();
        
        jest.clearAllMocks();
      }
    });

    it('should handle debug config loading failure gracefully', async () => {
      // Simulate the warning scenario from error_logs.txt:7
      globalThis.process = {
        env: {
          NODE_ENV: 'development',
        },
      };

      // The loadDebugLogConfig should fail but container config should continue
      await configureContainer(mockContainer);
      
      // Container configuration should complete successfully despite debug config failure
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[ContainerConfig] Container configuration completed successfully.'
      );
    });
  });
});