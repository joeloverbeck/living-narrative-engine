/**
 * @file Tests for RemoteLogger network error classification improvements
 * @description Verifies that "Failed to fetch" errors are properly classified as non-retriable
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
} from '@jest/globals';
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

  beforeEach(() => {
    mockFallbackLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Failed to fetch error handling', () => {
    it('should classify "Failed to fetch" as non-retriable and fail fast', async () => {
      // Configure fetch to simulate "Failed to fetch" error
      mockFetch.mockRejectedValue(new Error('Failed to fetch'));

      const remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://localhost:3001/api/logs',
          batchSize: 2,
          flushInterval: 50,
          retryAttempts: 3, // This should be ignored for non-retriable errors
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

      // Log message to trigger a batch (use info instead of error to avoid immediate flush)
      remoteLogger.info('Test info message');
      remoteLogger.warn('Test warning message');

      // Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should only attempt to send once (no retries for non-retriable errors)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Verify the failure was logged with clear error message
      expect(mockFallbackLogger.warn).toHaveBeenCalledWith(
        '[RemoteLogger] Failed to send batch to server, falling back to console',
        expect.objectContaining({
          error: 'Failed to fetch',
          logCount: 2,
        })
      );
    });

    it('should handle NetworkError correctly', async () => {
      // Configure fetch to simulate NetworkError
      mockFetch.mockRejectedValue(new Error('NetworkError when attempting to fetch resource'));

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

      remoteLogger.info('Test message for NetworkError');

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 150));

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
          json: () => Promise.resolve({ success: true, processed: 1 })
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

      remoteLogger.debug('Test message for server error');

      // Wait for retries to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should retry server errors (3 attempts total)
      expect(mockFetch).toHaveBeenCalledTimes(3);
      
      // Should not log to fallback since it eventually succeeded
      expect(mockFallbackLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Error classification behavior', () => {
    it('should properly differentiate retriable vs non-retriable errors', async () => {
      const testCases = [
        { error: 'Failed to fetch', shouldRetry: false },
        { error: 'NetworkError', shouldRetry: false },
        { error: 'ERR_NETWORK', shouldRetry: false },
        { error: 'HTTP 500: Internal Server Error', shouldRetry: true },
        { error: 'HTTP 502: Bad Gateway', shouldRetry: true },
        { error: 'Request timeout', shouldRetry: true },
        { error: 'HTTP 401: Unauthorized', shouldRetry: false },
        { error: 'HTTP 413: Payload Too Large', shouldRetry: false },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        
        mockFetch.mockRejectedValue(new Error(testCase.error));

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

        remoteLogger.info(`Test message for ${testCase.error}`);
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log(`[DEBUG] Test case "${testCase.error}" - shouldRetry: ${testCase.shouldRetry}, actualCalls: ${mockFetch.mock.calls.length}`);
        
        if (testCase.shouldRetry) {
          // Should attempt multiple times for retriable errors
          expect(mockFetch).toHaveBeenCalledTimes(2);
        } else {
          // Should only attempt once for non-retriable errors
          expect(mockFetch).toHaveBeenCalledTimes(1);
        }
        
        console.log(`[DEBUG] Test case "${testCase.error}" - shouldRetry: ${testCase.shouldRetry}, actualCalls: ${mockFetch.mock.calls.length}`);

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