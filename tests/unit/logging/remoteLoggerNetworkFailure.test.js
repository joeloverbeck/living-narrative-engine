/**
 * @file Tests for RemoteLogger network failure scenarios
 * @description Reproduces and tests fixes for "Failed to fetch" connectivity issues
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
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

// Mock XMLHttpRequest for sync requests
const mockXMLHttpRequest = jest.fn();
global.XMLHttpRequest = mockXMLHttpRequest;

// Create mock functions for addEventListener
const mockWindowAddEventListener = jest.fn();
const mockDocumentAddEventListener = jest.fn();

// Mock sendBeacon
const mockSendBeacon = jest.fn();

// Mock performance with proper function that returns consistent value
const mockPerformanceNow = jest.fn(() => 1000);

// Store original values
const originalWindow = global.window;
const originalDocument = global.document;
const originalNavigator = global.navigator;
const originalPerformance = global.performance;

/**
 *
 */
function setupGlobalMocks() {
  // Override window with our mock
  global.window = {
    location: {
      href: 'http://localhost:8080/test',
      origin: 'http://localhost:8080',
      hostname: 'localhost',
      protocol: 'http:',
      port: '8080',
    },
    addEventListener: mockWindowAddEventListener,
  };

  // Override document with our mock
  global.document = {
    addEventListener: mockDocumentAddEventListener,
    visibilityState: 'visible',
  };

  // Override performance with our mock
  global.performance = {
    now: mockPerformanceNow,
    memory: {
      usedJSHeapSize: 1024000,
    },
  };

  // Override navigator with our mock
  global.navigator = {
    userAgent: 'Mozilla/5.0 (Test Browser)',
    sendBeacon: mockSendBeacon,
  };
}

/**
 *
 */
function restoreGlobalMocks() {
  global.window = originalWindow;
  global.document = originalDocument;
  global.navigator = originalNavigator;
  global.performance = originalPerformance;
}

describe('RemoteLogger - Network Failure Scenarios', () => {
  let mockFallbackLogger;

  beforeEach(() => {
    setupGlobalMocks();

    // Create a mock fallback logger to capture fallback behavior
    mockFallbackLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    restoreGlobalMocks();
  });

  describe('Reproducing "Failed to fetch" error scenarios', () => {
    it('should reproduce "Failed to fetch" error when proxy server is unavailable', async () => {
      // Configure fetch to simulate network failure (like proxy server down)
      mockFetch.mockRejectedValue(new Error('Failed to fetch'));

      const remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://localhost:3001/api/logs',
          batchSize: 10,
          flushInterval: 100,
          initialConnectionDelay: 0,
          skipServerReadinessValidation: true,
        },
        dependencies: {
          consoleLogger: mockFallbackLogger,
        },
      });

      // Log some messages to trigger a batch
      for (let i = 0; i < 10; i++) {
        remoteLogger.info(`Test message ${i}`, { data: `test${i}` });
      }

      // Wait for batch to be processed
      await remoteLogger.waitForPendingFlushes();

      // Verify that fetch was called (attempting to send)
      expect(mockFetch).toHaveBeenCalled();

      // Verify that the fallback logger received the error
      expect(mockFallbackLogger.warn).toHaveBeenCalledWith(
        '[RemoteLogger] Failed to send batch to server, falling back to console',
        expect.objectContaining({
          error: 'Failed to fetch',
          logCount: 10,
          circuitBreakerState: 'closed',
        })
      );
    });

    it('should handle network timeout scenarios gracefully', async () => {
      // Configure fetch to simulate timeout
      mockFetch.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 100)
          )
      );

      const remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://localhost:3001/api/logs',
          batchSize: 5,
          flushInterval: 50,
          initialConnectionDelay: 0,
          skipServerReadinessValidation: true,
          retryAttempts: 1,
          retryBaseDelay: 100,
        },
        dependencies: {
          consoleLogger: mockFallbackLogger,
        },
      });

      // Log messages to trigger sending
      remoteLogger.error('Critical error', { severity: 'high' });
      remoteLogger.warn('Warning message');
      remoteLogger.info('Info message');
      remoteLogger.debug('Debug message');
      remoteLogger.info('Final message');

      // Wait for batch to be processed
      await remoteLogger.waitForPendingFlushes();

      // Verify fallback logger was used
      expect(mockFallbackLogger.warn).toHaveBeenCalledWith(
        '[RemoteLogger] Failed to send batch to server, falling back to console',
        expect.objectContaining({
          error: 'Request timeout',
          logCount: 5,
        })
      );
    });

    it('should handle CORS errors when proxy server has incorrect configuration', async () => {
      // Configure fetch to simulate CORS error
      mockFetch.mockRejectedValue(new TypeError('CORS error'));

      const remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://localhost:3001/api/logs',
          batchSize: 3,
          flushInterval: 50,
          initialConnectionDelay: 0,
          skipServerReadinessValidation: true,
          retryAttempts: 1,
          retryBaseDelay: 100,
        },
        dependencies: {
          consoleLogger: mockFallbackLogger,
        },
      });

      // Log messages
      remoteLogger.error('CORS test error');
      remoteLogger.warn('CORS test warning');
      remoteLogger.info('CORS test info');

      // Wait for batch processing
      await remoteLogger.waitForPendingFlushes();

      // Verify CORS error is handled gracefully
      expect(mockFallbackLogger.warn).toHaveBeenCalledWith(
        '[RemoteLogger] Failed to send batch to server, falling back to console',
        expect.objectContaining({
          error: 'CORS error',
          logCount: 3,
        })
      );
    });

    it('should demonstrate circuit breaker behavior after repeated failures', async () => {
      // Configure fetch to always fail
      mockFetch.mockRejectedValue(new Error('Failed to fetch'));

      const remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://localhost:3001/api/logs',
          batchSize: 2,
          flushInterval: 50,
          retryAttempts: 1,
          initialConnectionDelay: 0,
          skipServerReadinessValidation: true,
        },
        dependencies: {
          consoleLogger: mockFallbackLogger,
        },
      });

      // Send multiple batches to trigger circuit breaker
      for (let batch = 0; batch < 5; batch++) {
        remoteLogger.error(`Batch ${batch} - Error 1`);
        remoteLogger.error(`Batch ${batch} - Error 2`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Verify multiple failures were logged to fallback (one per batch plus retries)
      expect(mockFallbackLogger.warn.mock.calls.length).toBeGreaterThanOrEqual(
        5
      );

      // Verify the first few calls show 'closed' circuit breaker state
      const firstCall = mockFallbackLogger.warn.mock.calls[0];
      expect(firstCall[1]).toEqual(
        expect.objectContaining({
          circuitBreakerState: 'closed',
        })
      );
    });
  });

  describe('Network recovery scenarios', () => {
    it('should resume sending when network connectivity is restored', async () => {
      let shouldFail = true;

      // Configure fetch to fail initially, then succeed
      mockFetch.mockImplementation(() => {
        if (shouldFail) {
          return Promise.reject(new Error('Failed to fetch'));
        }
        return Promise.resolve(
          new Response('{"success": true}', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      const remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://localhost:3001/api/logs',
          batchSize: 2,
          flushInterval: 50,
          initialConnectionDelay: 0,
          skipServerReadinessValidation: true,
        },
        dependencies: {
          consoleLogger: mockFallbackLogger,
        },
      });

      // Send first batch (should fail)
      remoteLogger.error('First error');
      remoteLogger.warn('First warning');
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify first batch failed
      expect(mockFallbackLogger.warn).toHaveBeenCalledWith(
        '[RemoteLogger] Failed to send batch to server, falling back to console',
        expect.objectContaining({
          error: 'Failed to fetch',
        })
      );

      // "Restore" network connectivity
      shouldFail = false;
      jest.clearAllMocks();

      // Send second batch (should succeed)
      remoteLogger.info('Recovery test info');
      remoteLogger.debug('Recovery test debug');
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify second batch succeeded (no fallback warnings)
      expect(mockFallbackLogger.warn).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/logs',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  describe('Fallback behavior verification', () => {
    it('should properly configure fallback logger and use it for local logging', async () => {
      // Configure fetch to fail
      mockFetch.mockRejectedValue(new Error('Failed to fetch'));

      const remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://localhost:3001/api/logs',
          batchSize: 1,
          flushInterval: 50,
          initialConnectionDelay: 0,
          skipServerReadinessValidation: true,
        },
        dependencies: {
          consoleLogger: mockFallbackLogger,
        },
      });

      // Send a single log entry that will fail to send remotely
      remoteLogger.error('Test error message', {
        component: 'TestComponent',
        details: { userId: 123, action: 'test' },
      });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify the original log was sent to fallback logger (with REMOTE_FALLBACK prefix)
      expect(mockFallbackLogger.error).toHaveBeenCalledWith(
        '[REMOTE_FALLBACK] Test error message',
        [
          expect.objectContaining({
            component: 'TestComponent',
            details: { userId: 123, action: 'test' },
          }),
        ]
      );

      // Verify the failure was also logged
      expect(mockFallbackLogger.warn).toHaveBeenCalledWith(
        '[RemoteLogger] Failed to send batch to server, falling back to console',
        expect.objectContaining({
          error: 'Failed to fetch',
          logCount: 1,
        })
      );
    });
  });
});
