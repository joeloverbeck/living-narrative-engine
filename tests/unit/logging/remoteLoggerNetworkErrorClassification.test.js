/**
 * @file Tests for RemoteLogger network error classification improvements
 * @description Verifies that "Failed to fetch" errors are properly classified as non-retriable
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import RemoteLogger from '../../../src/logging/remoteLogger.js';

// Mock UUID to have predictable session IDs
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-session-id-123'),
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock globals for browser environment
global.window = {
  location: {
    href: 'http://localhost:8080/test',
    origin: 'http://localhost:8080',
  },
  addEventListener: jest.fn(),
};

global.document = {
  addEventListener: jest.fn(),
  visibilityState: 'visible',
};

global.performance = {
  now: jest.fn(() => 1000),
  memory: { usedJSHeapSize: 1024000 },
};

global.navigator = {
  userAgent: 'Mozilla/5.0 (Test Browser)',
  sendBeacon: jest.fn(),
};

describe('RemoteLogger - Network Error Classification', () => {
  let mockFallbackLogger;
  let createdLoggers = [];

  beforeEach(() => {
    // Create fresh mock logger for each test
    mockFallbackLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Reset created loggers array
    createdLoggers = [];

    // Clear all mocks including global fetch
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  afterEach(async () => {
    // Clean up any created loggers to prevent resource leaks
    for (const logger of createdLoggers) {
      try {
        await logger.destroy();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    createdLoggers = [];
  });

  describe('Failed to fetch error handling', () => {
    it('should classify "Failed to fetch" as non-retriable and fail fast', async () => {
      // Configure fetch to simulate "Failed to fetch" error
      mockFetch.mockRejectedValue(new Error('Failed to fetch'));

      const remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://localhost:3001/api/logs',
          batchSize: 1, // Force immediate flush
          flushInterval: 10, // Very short interval
          retryAttempts: 3, // This should be ignored for non-retriable errors
          initialConnectionDelay: 0, // No delay for testing
          skipServerReadinessValidation: true, // Skip health checks for testing
          circuitBreakerThreshold: 999, // Very high threshold to prevent circuit breaking during test
          retryBaseDelay: 10, // Very short delay for testing
          retryMaxDelay: 100, // Very short max delay for testing
          maxBufferSize: 100, // Small buffer for testing
          maxServerBatchSize: 50, // Small server batch for testing
        },
        dependencies: {
          consoleLogger: mockFallbackLogger,
        },
      });

      // Track logger for cleanup
      createdLoggers.push(remoteLogger);

      // Log message to trigger a batch (use info instead of error to avoid immediate flush)
      remoteLogger.info('Test info message');

      // Force flush to trigger the network call immediately
      await remoteLogger.flush();

      // Should only attempt to send once (no retries for non-retriable errors)
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify the failure was logged with clear error message
      expect(mockFallbackLogger.warn).toHaveBeenCalledWith(
        '[RemoteLogger] Failed to send batch to server, falling back to console',
        expect.objectContaining({
          error: 'Failed to fetch',
          logCount: 1,
        })
      );
    });

    it('should handle NetworkError correctly', async () => {
      // Configure fetch to simulate NetworkError
      mockFetch.mockRejectedValue(
        new Error('NetworkError when attempting to fetch resource')
      );

      const remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://localhost:3001/api/logs',
          batchSize: 1,
          flushInterval: 50,
          retryAttempts: 2,
          initialConnectionDelay: 0, // No delay for testing
          skipServerReadinessValidation: true, // Skip health checks for testing
          circuitBreakerThreshold: 999, // Very high threshold to prevent circuit breaking during test
          retryBaseDelay: 10, // Very short delay for testing
          retryMaxDelay: 100, // Very short max delay for testing
        },
        dependencies: {
          consoleLogger: mockFallbackLogger,
        },
      });

      // Track logger for cleanup
      createdLoggers.push(remoteLogger);

      remoteLogger.info('Test message for NetworkError');

      // Force flush to trigger the network call immediately
      await remoteLogger.flush();

      // Should not retry NetworkError (non-retriable)
      expect(mockFetch).toHaveBeenCalledTimes(1);

      expect(mockFallbackLogger.warn).toHaveBeenCalledWith(
        '[RemoteLogger] Failed to send batch to server, falling back to console',
        expect.objectContaining({
          error: 'NetworkError when attempting to fetch resource',
        })
      );
    });

    it('should still retry server errors (5xx)', async () => {
      let callCount = 0;

      // Configure fetch to return server error that should be retried
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('HTTP 500: Internal Server Error'));
        }
        // Third call succeeds
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, processed: 1 }),
        });
      });

      const remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://localhost:3001/api/logs',
          batchSize: 1,
          flushInterval: 50,
          retryAttempts: 3,
          initialConnectionDelay: 0, // No delay for testing
          skipServerReadinessValidation: true, // Skip health checks for testing
          circuitBreakerThreshold: 999, // Very high threshold to prevent circuit breaking during test
          retryBaseDelay: 10, // Very short delay for testing
          retryMaxDelay: 100, // Very short max delay for testing
        },
        dependencies: {
          consoleLogger: mockFallbackLogger,
        },
      });

      // Track logger for cleanup
      createdLoggers.push(remoteLogger);

      remoteLogger.debug('Test message for server error');

      // Force flush to trigger the network call immediately
      await remoteLogger.flush();

      // Should retry server errors (3 attempts total: retryAttempts: 3 = 3 total attempts)
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Should not log to fallback since it eventually succeeded
      expect(mockFallbackLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Error classification behavior', () => {
    it('should properly differentiate retriable vs non-retriable errors', async () => {
      const testCases = [
        // Non-retriable network errors (handled by #isNonRetriableError)
        { error: 'Failed to fetch', shouldRetry: false, category: 'network' },
        { error: 'NetworkError', shouldRetry: false, category: 'network' },
        { error: 'ERR_NETWORK', shouldRetry: false, category: 'network' },
        { error: 'ENOTFOUND', shouldRetry: false, category: 'network' },
        { error: 'certificate', shouldRetry: false, category: 'network' },
        { error: 'HTTP 401: Unauthorized', shouldRetry: false, category: 'network' },
        { error: 'HTTP 403: Forbidden', shouldRetry: false, category: 'network' },
        // Retriable server errors
        { error: 'HTTP 500: Internal Server Error', shouldRetry: true, category: 'server' },
        { error: 'HTTP 502: Bad Gateway', shouldRetry: true, category: 'server' },
        { error: 'Request timeout', shouldRetry: true, category: 'server' },
        { error: 'ETIMEDOUT', shouldRetry: true, category: 'server' },
        // Non-retriable client errors (handled by #isClientError)
        { error: 'HTTP 413: Payload Too Large', shouldRetry: false, category: 'client' },
        { error: 'HTTP 400: Bad Request', shouldRetry: false, category: 'client' },
        { error: '400', shouldRetry: false, category: 'client' },
      ];

      for (const testCase of testCases) {
        // Clear mocks and create fresh logger for each test case
        jest.clearAllMocks();

        mockFetch.mockRejectedValue(new Error(testCase.error));

        const remoteLogger = new RemoteLogger({
          config: {
            endpoint: 'http://localhost:3001/api/logs',
            batchSize: 1,
            flushInterval: 30, // Shorter interval for faster testing
            retryAttempts: 2, // Use 2 retries to clearly show difference
            initialConnectionDelay: 0, // No delay for testing
            skipServerReadinessValidation: true, // Skip health checks for testing
            circuitBreakerThreshold: 999, // Very high threshold to prevent circuit breaking during test
            retryBaseDelay: 5, // Very short delay for testing
            retryMaxDelay: 50, // Very short max delay for testing
          },
          dependencies: {
            consoleLogger: mockFallbackLogger,
          },
        });

        // Track logger for cleanup
        createdLoggers.push(remoteLogger);

        // Log a message to trigger batch processing
        remoteLogger.info(`Test message for ${testCase.error}`);

        // Force flush to trigger the network call immediately
        await remoteLogger.flush();

        if (testCase.shouldRetry) {
          // Should attempt multiple times for retriable errors (retryAttempts: 2 = 2 total attempts)
          expect(mockFetch).toHaveBeenCalledTimes(2);
        } else {
          // Should only attempt once for non-retriable errors
          expect(mockFetch).toHaveBeenCalledTimes(1);
        }

        // All errors should be logged to fallback
        expect(mockFallbackLogger.warn).toHaveBeenCalledWith(
          '[RemoteLogger] Failed to send batch to server, falling back to console',
          expect.objectContaining({
            error: testCase.error,
          })
        );
      }
    });
  });
});
