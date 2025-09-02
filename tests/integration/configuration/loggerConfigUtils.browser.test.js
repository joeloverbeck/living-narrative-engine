/**
 * @file Integration tests for logger configuration in browser environment
 * These tests simulate the full logger configuration flow that fails in browser environment
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { loadAndApplyLoggerConfig } from '../../../src/configuration/utils/loggerConfigUtils.js';

// Mock the container and tokens for integration testing
const mockTokens = {
  ILogger: 'ILogger',
  ILoggerStrategy: 'ILoggerStrategy',
  ISafeEventDispatcher: 'ISafeEventDispatcher',
};

describe('Logger Configuration - Browser Environment Integration', () => {
  let originalProcess;
  let mockContainer;
  let mockLogger;
  let mockLoggerStrategy;

  beforeEach(() => {
    // Save original process object
    originalProcess = globalThis.process;
    
    // Setup mocks
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn(),
    };

    mockLoggerStrategy = {
      setLogLevel: jest.fn(),
      getLogger: jest.fn(() => mockLogger),
    };

    mockContainer = {
      get: jest.fn((token) => {
        if (token === mockTokens.ILogger) return mockLogger;
        if (token === mockTokens.ILoggerStrategy) return mockLoggerStrategy;
        return null;
      }),
      resolve: jest.fn((token) => {
        if (token === mockTokens.ISafeEventDispatcher) return { dispatch: jest.fn() };
        return null;
      }),
    };
  });

  afterEach(() => {
    // Restore original process object
    globalThis.process = originalProcess;
    jest.clearAllMocks();
  });

  describe('Logger Configuration Loading in Browser', () => {
    it('should handle logger configuration loading failure gracefully in browser', async () => {
      // Simulate browser environment where process is not defined
      delete globalThis.process;

      // This should not throw even though internal process access fails
      await expect(
        loadAndApplyLoggerConfig(
          mockContainer,
          mockLogger,
          mockTokens,
          'IntegrationTest'
        )
      ).resolves.not.toThrow();

      // Should have logged the critical error but continued execution
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('[IntegrationTest] CRITICAL ERROR during asynchronous logger configuration loading:'),
        expect.objectContaining({
          message: 'process is not defined',
          stack: expect.stringContaining('ReferenceError: process is not defined'),
          errorObj: expect.any(ReferenceError),
        })
      );
    });

    it('should work properly when process object exists', async () => {
      // Simulate Node.js environment
      globalThis.process = {
        env: {
          NODE_ENV: 'test',
        },
      };

      await loadAndApplyLoggerConfig(
        mockContainer,
        mockLogger,
        mockTokens,
        'IntegrationTest'
      );

      // Should complete without critical errors
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL ERROR')
      );
    });

    it('should handle partial process objects gracefully', async () => {
      // Simulate environment with process but no env
      globalThis.process = { version: 'browser-polyfill' };

      await loadAndApplyLoggerConfig(
        mockContainer,
        mockLogger,
        mockTokens,
        'IntegrationTest'
      );

      // Should handle this case without throwing
      // May log warnings but shouldn't have critical errors about process being undefined
      const criticalErrors = mockLogger.error.mock.calls.filter(call => 
        call[0] && call[0].includes('process is not defined')
      );
      expect(criticalErrors).toHaveLength(0);
    });
  });

  describe('Container Configuration Integration Flow', () => {
    it('should reproduce the exact error sequence from error_logs.txt', async () => {
      // Reproduce the sequence: containerConfig calls loadDebugLogConfig which fails
      delete globalThis.process;

      // This simulates the containerConfig.js:166 call to loadAndApplyLoggerConfig
      await loadAndApplyLoggerConfig(
        mockContainer,
        mockLogger,
        mockTokens,
        'ContainerConfig'
      );

      // Should match the error pattern from error_logs.txt:28
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[ContainerConfig] CRITICAL ERROR during asynchronous logger configuration loading:',
        expect.objectContaining({
          message: 'process is not defined',
          stack: expect.stringMatching(/ReferenceError: process is not defined/),
          errorObj: expect.any(ReferenceError),
        })
      );
    });

    it('should continue container configuration despite logger config failure', async () => {
      delete globalThis.process;

      // Even with logger config failure, the container should continue
      await loadAndApplyLoggerConfig(
        mockContainer,
        mockLogger,
        mockTokens,
        'ContainerConfig'
      );

      // The function should complete (not throw) allowing container config to continue
      // This matches the behavior in error_logs.txt where we see line 42: "Container configuration completed successfully"
      expect(true).toBe(true); // Test passes if we reach this point without throwing
    });
  });

  describe('Debug Configuration Loading Scenarios', () => {
    it('should handle SKIP_DEBUG_CONFIG in browser environment', async () => {
      // Simulate browser with window object instead of process
      delete globalThis.process;
      globalThis.window = {
        location: { search: '?skip_debug=true' }
      };

      await loadAndApplyLoggerConfig(
        mockContainer,
        mockLogger,
        mockTokens,
        'IntegrationTest'
      );

      // Should log error about process not being defined since it tries to access process.env first
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL ERROR'),
        expect.objectContaining({
          message: 'process is not defined'
        })
      );

      // Cleanup
      delete globalThis.window;
    });

    it('should handle different environment variable scenarios', async () => {
      const envScenarios = [
        { env: { SKIP_DEBUG_CONFIG: 'true' } },
        { env: { SKIP_DEBUG_CONFIG: 'false' } },
        { env: { NODE_ENV: 'test' } },
        { env: { NODE_ENV: 'production' } },
        { env: {} },
      ];

      for (const scenario of envScenarios) {
        globalThis.process = scenario;

        await loadAndApplyLoggerConfig(
          mockContainer,
          mockLogger,
          mockTokens,
          'IntegrationTest'
        );

        // Should not throw for any of these scenarios
        expect(true).toBe(true);

        jest.clearAllMocks();
      }
    });
  });
});