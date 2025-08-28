/**
 * @file Integration tests for remote logger batch size issues
 * @description Tests that reproduce the HTTP 400/413 errors from error_logs.txt
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import RemoteLogger from '../../../src/logging/remoteLogger.js';

describe('RemoteLogger - Batch Size Issues Integration', () => {
  let mockServer;
  let remoteLogger;
  let mockEventBus;
  let mockFallbackLogger;
  let requests;

  beforeEach(() => {
    requests = [];
    mockEventBus = {
      dispatch: jest.fn(),
    };
    mockFallbackLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      setLogLevel: jest.fn(),
    };

    // Mock fetch to simulate server responses
    global.fetch = jest.fn((url, options) => {
      const request = {
        url,
        method: options.method,
        body: JSON.parse(options.body),
        headers: options.headers,
      };
      requests.push(request);

      const logCount = request.body.logs?.length || 0;

      // Simulate server behavior based on batch size
      if (logCount > 1000) {
        // HTTP 400 - validation error for > 1000 entries
        return Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: () =>
            Promise.resolve({
              error: 'logs array cannot contain more than 1000 entries',
            }),
        });
      } else if (JSON.stringify(request.body).length > 1024 * 1024) {
        // HTTP 413 - payload too large (> 1MB)
        return Promise.resolve({
          ok: false,
          status: 413,
          statusText: 'Payload Too Large',
          json: () =>
            Promise.resolve({
              error: 'Request entity too large',
            }),
        });
      } else {
        // Success
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              processed: logCount,
              timestamp: new Date().toISOString(),
            }),
        });
      }
    });
  });

  afterEach(async () => {
    if (remoteLogger) {
      await remoteLogger.destroy();
    }
    jest.restoreAllMocks();
    delete global.fetch;
  });

  describe('Issue Reproduction - HTTP 400 Errors', () => {
    it('should reproduce HTTP 400 error when batch exceeds 1000 entries', async () => {
      remoteLogger = new RemoteLogger(
        {
          endpoint: 'http://localhost:3001/api/debug-log',
          batchSize: 1500, // Intentionally large to trigger issue
          flushInterval: 100,
        },
        {
          eventBus: mockEventBus,
          fallbackLogger: mockFallbackLogger,
        }
      );

      // Generate logs that exceed server limit
      for (let i = 0; i < 1100; i++) {
        remoteLogger.debug(`Test log message ${i}`);
      }

      // Force flush and wait for completion
      await remoteLogger.flush();
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should have attempted one request
      expect(requests).toHaveLength(1);
      expect(requests[0].body.logs).toHaveLength(1100);

      // Should have logged fallback error
      expect(mockFallbackLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send batch to server'),
        expect.objectContaining({
          error: expect.stringContaining('400'),
          logCount: 1100,
        })
      );
    });

    it('should reproduce buffer accumulation from failed requests', async () => {
      remoteLogger = new RemoteLogger(
        {
          endpoint: 'http://localhost:3001/api/debug-log',
          batchSize: 100,
          flushInterval: 50,
          retryAttempts: 2,
        },
        {
          eventBus: mockEventBus,
          fallbackLogger: mockFallbackLogger,
        }
      );

      // Mock fetch to always return 400 to simulate server rejection
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: () => Promise.resolve({ error: 'Server error' }),
        })
      );

      // Generate multiple batches of logs
      for (let batch = 0; batch < 15; batch++) {
        for (let i = 0; i < 100; i++) {
          remoteLogger.debug(`Batch ${batch} log ${i}`);
        }
        // Small delay to allow processing
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Wait for flushes and retries
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should have made multiple requests due to retries
      expect(requests.length).toBeGreaterThan(1);

      // Should have logged multiple failures
      expect(mockFallbackLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send batch'),
        expect.any(Object)
      );
    });
  });

  describe('Issue Reproduction - HTTP 413 Errors', () => {
    it('should reproduce HTTP 413 error with large payload', async () => {
      remoteLogger = new RemoteLogger(
        {
          endpoint: 'http://localhost:3001/api/debug-log',
          batchSize: 5000, // Very large batch
          flushInterval: 100,
        },
        {
          eventBus: mockEventBus,
          fallbackLogger: mockFallbackLogger,
        }
      );

      // Generate logs with large messages to exceed 1MB payload
      const largeMessage = 'x'.repeat(1000); // 1KB message
      for (let i = 0; i < 2000; i++) {
        remoteLogger.debug(`${largeMessage} - message ${i}`);
      }

      // Force flush
      await remoteLogger.flush();
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should have attempted request with large payload
      expect(requests).toHaveLength(1);
      const requestBody = JSON.stringify(requests[0].body);
      expect(requestBody.length).toBeGreaterThan(1024 * 1024); // > 1MB

      // Should have logged 413 error
      expect(mockFallbackLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send batch to server'),
        expect.objectContaining({
          error: expect.stringContaining('413'),
        })
      );
    });
  });

  describe('Buffer Management Issues', () => {
    it('should demonstrate buffer growth when flushes fail', async () => {
      remoteLogger = new RemoteLogger(
        {
          endpoint: 'http://localhost:3001/api/debug-log',
          batchSize: 100,
          flushInterval: 50,
          retryAttempts: 1, // Minimal retries
        },
        {
          eventBus: mockEventBus,
          fallbackLogger: mockFallbackLogger,
        }
      );

      // Mock server to fail consistently
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
      );

      // Continuously add logs
      const addLogs = () => {
        for (let i = 0; i < 50; i++) {
          remoteLogger.debug(`Continuous log ${Date.now()}-${i}`);
        }
      };

      // Add logs every 25ms for 300ms
      const logInterval = setInterval(addLogs, 25);
      setTimeout(() => clearInterval(logInterval), 300);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Buffer should have grown significantly due to failed flushes
      const stats = remoteLogger.getStats();
      expect(stats.buffer.size).toBeGreaterThan(100);

      // Should have made multiple failed requests
      expect(requests.length).toBeGreaterThan(1);
    });
  });
});
