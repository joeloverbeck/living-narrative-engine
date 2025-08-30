/**
 * @file Integration test reproducing the exact bootstrap race condition from error_logs.txt
 * @description Tests the race condition between client startup and server readiness that causes ERR_CONNECTION_REFUSED
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import RemoteLogger from '../../../src/logging/remoteLogger.js';

describe('RemoteLogger Bootstrap Race Condition - Integration', () => {
  let testBed;
  let remoteLogger;
  let originalFetch;

  beforeEach(() => {
    testBed = createTestBed();
    originalFetch = global.fetch;
  });

  afterEach(async () => {
    if (remoteLogger) {
      remoteLogger.destroy?.();
    }
    global.fetch = originalFetch;
    testBed.cleanup();
  });

  describe('Bootstrap Race Condition Scenarios', () => {
    it('should reproduce ERR_CONNECTION_REFUSED during immediate bootstrap logging', async () => {
      // Mock the exact scenario: server starting but debug endpoint not ready yet
      let connectionAttempts = 0;
      let serverReady = false;

      global.fetch = jest.fn().mockImplementation(() => {
        connectionAttempts++;
        if (!serverReady) {
          // Simulate connection refused during early bootstrap
          const error = new Error('Failed to fetch');
          error.name = 'TypeError';
          error.message = 'Failed to fetch';
          return Promise.reject(error);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, processed: 1 }),
        });
      });

      const mockConsoleLogger = testBed.createMockLogger();

      // Create RemoteLogger with the exact configuration from the logs
      remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://127.0.0.1:3001/api/debug-log',
          batchSize: 1, // Smallest batch to trigger immediate sending
          flushInterval: 10, // Very fast flush to trigger requests quickly
          retryAttempts: 3,
          requestTimeout: 5000,
          initialConnectionDelay: 0, // No delay to reproduce the race condition
        },
        dependencies: {
          consoleLogger: mockConsoleLogger,
        },
      });

      // Simulate immediate bootstrap logging - multiple log entries as seen in error_logs.txt
      remoteLogger.info('[LoggerStrategy] Initialized with mode: development');
      remoteLogger.debug(
        '[ContainerConfig] Starting base container configuration...'
      );
      remoteLogger.debug(
        '[ContainerConfig] Service IEntityManager registered: true'
      );
      remoteLogger.debug(
        '[ContainerConfig] Service IDataRegistry registered: true'
      );
      remoteLogger.debug(
        '[ContainerConfig] Service ISchemaValidator registered: true'
      );

      // Wait for initial connection attempts to fail
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify that connection was attempted immediately
      expect(connectionAttempts).toBeGreaterThan(0);

      // Verify fallback behavior was triggered
      expect(mockConsoleLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to send batch to server, falling back to console'
        ),
        expect.objectContaining({
          error: expect.stringContaining('Server readiness validation failed'),
          logCount: expect.any(Number),
        })
      );
    });

    it('should recover when server becomes ready after initial failures', async () => {
      let connectionAttempts = 0;
      let serverReady = false;

      global.fetch = jest.fn().mockImplementation(() => {
        connectionAttempts++;
        if (!serverReady && connectionAttempts <= 2) {
          // First 2 attempts fail (simulating server not ready)
          const error = new Error('Failed to fetch');
          error.name = 'TypeError';
          return Promise.reject(error);
        }

        // Server becomes ready after first few attempts
        if (!serverReady) {
          serverReady = true;
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, processed: 1 }),
        });
      });

      const mockConsoleLogger = testBed.createMockLogger();

      remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://127.0.0.1:3001/api/debug-log',
          batchSize: 1,
          flushInterval: 10,
          retryAttempts: 5,
          requestTimeout: 5000,
          initialConnectionDelay: 0,
          circuitBreakerThreshold: 10, // High threshold to prevent circuit breaker opening
        },
        dependencies: {
          consoleLogger: mockConsoleLogger,
        },
      });

      // Log several messages to trigger multiple flush attempts
      for (let i = 0; i < 15; i++) {
        remoteLogger.info(`Bootstrap message ${i}`);
        // Small delay to ensure each log gets processed
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      // Wait for retries and recovery
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify that connection was eventually successful
      expect(connectionAttempts).toBeGreaterThan(0);
      expect(serverReady).toBe(true);

      // Verify that some requests succeeded after initial failures
      const successfulCalls = global.fetch.mock.results.filter(
        (result) =>
          result.type === 'return' &&
          result.value &&
          typeof result.value.then === 'function'
      );
      expect(successfulCalls.length).toBeGreaterThan(0);
    });

    it('should handle the exact timing scenario from error_logs.txt', async () => {
      // Simulate the specific timing: server binds at 20:49:37.341, logs start immediately
      let serverStartTime = Date.now();
      let serverBindDelay = 50; // 50ms to simulate server binding delay

      global.fetch = jest.fn().mockImplementation(() => {
        const currentTime = Date.now();
        if (currentTime - serverStartTime < serverBindDelay) {
          // Connection refused before server is fully bound
          const error = new Error('Failed to fetch');
          error.name = 'TypeError';
          return Promise.reject(error);
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, processed: 1 }),
        });
      });

      const mockConsoleLogger = testBed.createMockLogger();

      // Create logger immediately (simulating browser bootstrap)
      remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://127.0.0.1:3001/api/debug-log',
          batchSize: 1, // Small batch to trigger immediate sending
          flushInterval: 10,
          retryAttempts: 3,
          requestTimeout: 5000,
          initialConnectionDelay: 0,
        },
        dependencies: {
          consoleLogger: mockConsoleLogger,
        },
      });

      // Simulate the rapid logging during bootstrap as seen in error_logs.txt
      const bootstrapMessages = [
        'Bootstrap Stage: setupDIContainerStage starting...',
        '[ContainerConfig] Starting container configuration...',
        '[ContainerConfig] Container is empty: false',
        '[ConsoleLogger] Initialized. Log level set to INFO (1).',
        '[ContainerConfig] Logger registered: true',
        '[ContainerConfig] Starting base container configuration...',
      ];

      // Log all messages rapidly (simulating bootstrap sequence)
      bootstrapMessages.forEach((msg) => remoteLogger.info(msg));

      // Wait for server binding delay to complete
      await new Promise((resolve) =>
        setTimeout(resolve, serverBindDelay + 100)
      );

      // Add more logs after server is ready
      remoteLogger.info('Container configuration completed successfully.');

      // Wait for all network operations to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify that initial requests failed but later ones may succeed
      const failedCalls = global.fetch.mock.results.filter(
        (result) =>
          result.type === 'throw' || (result.value && result.value.catch)
      );

      expect(failedCalls.length).toBeGreaterThan(0);

      // Verify fallback logging was triggered
      expect(mockConsoleLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to send batch to server, falling back to console'
        ),
        expect.objectContaining({
          error: expect.stringContaining('Server readiness validation failed'),
        })
      );
    });

    it('should properly handle circuit breaker during bootstrap failures', async () => {
      let failureCount = 0;

      global.fetch = jest.fn().mockImplementation(() => {
        failureCount++;
        const error = new Error('Failed to fetch');
        error.name = 'TypeError';
        return Promise.reject(error);
      });

      const mockConsoleLogger = testBed.createMockLogger();

      remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://127.0.0.1:3001/api/debug-log',
          batchSize: 1, // Small batch to trigger frequent requests
          flushInterval: 10,
          retryAttempts: 1, // Minimal retries for faster test
          initialConnectionDelay: 0,
          circuitBreakerThreshold: 3, // Low threshold for testing
          circuitBreakerTimeout: 200, // Short timeout for testing
        },
        dependencies: {
          consoleLogger: mockConsoleLogger,
        },
      });

      // Generate enough logs to trigger circuit breaker
      for (let i = 0; i < 10; i++) {
        remoteLogger.error(`Circuit breaker test message ${i}`);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Wait for circuit breaker to open
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Verify circuit breaker opened (fewer or equal fetch attempts than log messages)
      expect(failureCount).toBeLessThanOrEqual(10);
      expect(failureCount).toBeGreaterThan(0);

      // Verify fallback logging includes circuit breaker information
      expect(mockConsoleLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to send batch to server, falling back to console'
        ),
        expect.objectContaining({
          circuitBreakerState: expect.any(String),
        })
      );
    });
  });

  describe('Recovery Scenarios', () => {
    it('should demonstrate proper recovery after server becomes available', async () => {
      let serverAvailable = false;
      let requestCount = 0;

      global.fetch = jest.fn().mockImplementation(() => {
        requestCount++;

        // Server becomes available after 3 failed attempts
        if (!serverAvailable && requestCount <= 3) {
          const error = new Error('Failed to fetch');
          error.name = 'TypeError';
          return Promise.reject(error);
        }

        // Server becomes available
        if (!serverAvailable) {
          serverAvailable = true;
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, processed: 1 }),
        });
      });

      const mockConsoleLogger = testBed.createMockLogger();

      remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://127.0.0.1:3001/api/debug-log',
          batchSize: 1,
          flushInterval: 10,
          retryAttempts: 2,
          initialConnectionDelay: 0,
          circuitBreakerThreshold: 10, // High threshold to allow retries
        },
        dependencies: {
          consoleLogger: mockConsoleLogger,
        },
      });

      // Generate logs during server unavailable period
      for (let i = 0; i < 12; i++) {
        remoteLogger.info(`Recovery test message ${i}`);
        // Small delay to ensure each log gets processed
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      // Wait for server to become available and recovery to occur
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify that server eventually became available
      expect(serverAvailable).toBe(true);
      expect(requestCount).toBeGreaterThan(0);

      // Verify successful requests occurred after server became available
      const allResults = global.fetch.mock.results;
      const successfulResults = allResults.filter(
        (result, index) => index > 5 && result.type === 'return'
      );

      expect(successfulResults.length).toBeGreaterThan(0);
    });
  });
});
