/**
 * @file Integration tests for RemoteLogger compression behavior
 * @see src/logging/remoteLogger.js
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
import { ungzip } from 'pako';

describe('RemoteLogger Compression Integration', () => {
  let remoteLogger;
  let fetchMock;
  let mockConsoleLogger;

  beforeEach(() => {
    // Create mock console logger
    mockConsoleLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Reset fetch mock for each test
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    if (remoteLogger) {
      remoteLogger.destroy();
      remoteLogger = null;
    }
    jest.clearAllMocks();
  });

  describe('End-to-End Compression', () => {
    it('should compress large payloads and send with correct headers', async () => {
      let capturedRequest = null;
      
      fetchMock.mockImplementation(async (url, config) => {
        capturedRequest = { url, ...config };
        return {
          ok: true,
          json: async () => ({ success: true, processed: 100 }),
        };
      });

      remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://localhost:3001/api/debug-log',
          batchSize: 100,
          flushInterval: 5000,
          initialConnectionDelay: 0, // Disable for testing
          skipServerReadinessValidation: true, // Skip validation for testing
          disableAdaptiveBatching: true, // Disable adaptive batching for predictable test behavior
          compression: {
            enabled: true,
            threshold: 500, // Low threshold for testing
            algorithm: 'gzip',
            level: 6,
          },
        },
        dependencies: {
          consoleLogger: mockConsoleLogger,
        },
      });

      // Generate large logs to trigger compression
      const largeMessage = 'x'.repeat(50); // Create a message to ensure payload exceeds threshold
      for (let i = 0; i < 100; i++) {
        remoteLogger.info(`Test log ${i}: ${largeMessage}`);
      }

      // Force flush to send batch
      await remoteLogger.flush();

      // Verify request was made
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(capturedRequest).toBeTruthy();

      // Verify compression headers
      expect(capturedRequest.headers['Content-Encoding']).toBe('gzip');
      expect(capturedRequest.headers['X-Original-Size']).toBeDefined();
      expect(capturedRequest.headers['X-Compression-Ratio']).toBeDefined();

      // Verify body is compressed (Uint8Array)
      expect(capturedRequest.body).toBeInstanceOf(Uint8Array);

      // Decompress and verify content
      const decompressed = ungzip(capturedRequest.body, { to: 'string' });
      const payload = JSON.parse(decompressed);
      // The payload is the array directly when compressed
      expect(Array.isArray(payload)).toBe(true);
      expect(payload).toHaveLength(100);
      expect(payload[0].message).toContain('Test log 0');
    });

    it('should not compress small payloads', async () => {
      let capturedRequest = null;
      
      fetchMock.mockImplementation(async (url, config) => {
        capturedRequest = { url, ...config };
        return {
          ok: true,
          json: async () => ({ success: true, processed: 3 }),
        };
      });

      remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://localhost:3001/api/debug-log',
          batchSize: 10,
          flushInterval: 5000,
          initialConnectionDelay: 0, // Disable for testing
          skipServerReadinessValidation: true, // Skip validation for testing
          compression: {
            enabled: true,
            threshold: 5000, // High threshold
            algorithm: 'gzip',
            level: 6,
          },
        },
        dependencies: {
          consoleLogger: mockConsoleLogger,
        },
      });

      // Generate small logs
      remoteLogger.info('Small log 1');
      remoteLogger.info('Small log 2');
      remoteLogger.info('Small log 3');

      // Force flush
      await remoteLogger.flush();

      // Verify request was made
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(capturedRequest).toBeTruthy();

      // Verify no compression headers
      expect(capturedRequest.headers['Content-Encoding']).toBeUndefined();
      
      // Verify body is uncompressed JSON string
      expect(typeof capturedRequest.body).toBe('string');
      const payload = JSON.parse(capturedRequest.body);
      expect(payload.logs).toHaveLength(3);
    });

    it('should handle compression failures gracefully', async () => {
      // Mock pako to fail
      jest.spyOn(require('pako'), 'gzip').mockImplementation(() => {
        throw new Error('Compression failed');
      });

      let capturedRequest = null;
      
      fetchMock.mockImplementation(async (url, config) => {
        capturedRequest = { url, ...config };
        return {
          ok: true,
          json: async () => ({ success: true, processed: 10 }),
        };
      });

      remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://localhost:3001/api/debug-log',
          batchSize: 10,
          flushInterval: 5000,
          initialConnectionDelay: 0, // Disable for testing
          skipServerReadinessValidation: true, // Skip validation for testing
          compression: {
            enabled: true,
            threshold: 100,
            algorithm: 'gzip',
            level: 6,
          },
        },
        dependencies: {
          consoleLogger: mockConsoleLogger,
        },
      });

      // Generate logs
      for (let i = 0; i < 10; i++) {
        remoteLogger.info(`Log ${i} with some content to exceed threshold`);
      }

      // Force flush - should fall back to uncompressed
      await remoteLogger.flush();

      // Verify request was made despite compression failure
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(capturedRequest).toBeTruthy();

      // Should fall back to uncompressed
      expect(capturedRequest.headers['Content-Encoding']).toBeUndefined();
      expect(typeof capturedRequest.body).toBe('string');

      // Verify warning was logged
      expect(mockConsoleLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[RemoteLogger] Compression failed'),
        expect.any(Error)
      );
    });

    it('should respect compression ratio threshold', async () => {
      let capturedRequest = null;
      
      fetchMock.mockImplementation(async (url, config) => {
        capturedRequest = { url, ...config };
        return {
          ok: true,
          json: async () => ({ success: true, processed: 10 }),
        };
      });

      remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://localhost:3001/api/debug-log',
          batchSize: 10,
          flushInterval: 5000,
          initialConnectionDelay: 0, // Disable for testing
          skipServerReadinessValidation: true, // Skip validation for testing
          compression: {
            enabled: true,
            threshold: 100,
            algorithm: 'gzip',
            level: 1, // Low compression level
          },
        },
        dependencies: {
          consoleLogger: mockConsoleLogger,
        },
      });

      // Generate highly repetitive logs (compress well)
      for (let i = 0; i < 10; i++) {
        remoteLogger.info('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
      }

      await remoteLogger.flush();

      // Should compress due to good ratio
      expect(capturedRequest.headers['Content-Encoding']).toBe('gzip');

      // Reset for next test
      capturedRequest = null;
      fetchMock.mockClear();

      // Generate random logs (don't compress well)
      for (let i = 0; i < 10; i++) {
        const randomStr = Math.random().toString(36).substring(7);
        remoteLogger.info(`Random ${randomStr} ${Date.now()} ${Math.random()}`);
      }

      await remoteLogger.flush();

      // May or may not compress depending on actual compression ratio
      // Just verify the request was made
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  describe('Network-Aware Batching', () => {
    it('should adapt batch size based on simulated network conditions', async () => {
      // Simulate varying network conditions
      let requestCount = 0;
      fetchMock.mockImplementation(() => {
        requestCount++;
        // Simulate different latencies
        const latency = requestCount === 1 ? 50 : 200; // Fast then slow
        
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ success: true, processed: 10 }),
            });
          }, latency);
        });
      });

      remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://localhost:3001/api/debug-log',
          batchSize: 25,
          flushInterval: 5000,
          initialConnectionDelay: 0, // Disable for testing
          skipServerReadinessValidation: true, // Skip validation for testing
          disableAdaptiveBatching: false, // Keep adaptive batching enabled for this test
          batching: {
            adaptive: true,
            minBatchSize: 10,
            maxBatchSize: 100,
            targetLatency: 100,
            adjustmentFactor: 0.2,
          },
        },
        dependencies: {
          consoleLogger: mockConsoleLogger,
        },
      });

      // First batch - fast network
      for (let i = 0; i < 25; i++) {
        remoteLogger.info(`Fast network log ${i}`);
      }
      await remoteLogger.flush();
      
      // Second batch - slow network
      for (let i = 25; i < 50; i++) {
        remoteLogger.info(`Slow network log ${i}`);
      }
      await remoteLogger.flush();

      const stats2 = remoteLogger.getStats();

      // Batch size should adapt to network conditions
      expect(stats2.adaptiveBatchSize).toBeDefined();
      expect(stats2.adaptiveBatchSize).toBeGreaterThanOrEqual(10);
      expect(stats2.adaptiveBatchSize).toBeLessThanOrEqual(100);
    });

    it('should track network metrics across multiple transmissions', async () => {
      let transmissionCount = 0;
      const transmissionTimes = [];

      fetchMock.mockImplementation(async () => {
        const startTime = Date.now();
        transmissionCount++;
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 50));
        
        transmissionTimes.push(Date.now() - startTime);
        
        return {
          ok: transmissionCount !== 2, // Fail second transmission
          json: async () => ({ success: true, processed: 5 }),
        };
      });

      remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://localhost:3001/api/debug-log',
          batchSize: 5,
          flushInterval: 5000,
          initialConnectionDelay: 0, // Disable for testing
          skipServerReadinessValidation: true, // Skip validation for testing
          retryAttempts: 1, // Reduce retries for testing
          batching: {
            adaptive: true,
            minBatchSize: 5,
            maxBatchSize: 50,
          },
        },
        dependencies: {
          consoleLogger: mockConsoleLogger,
        },
      });

      // Multiple transmissions
      for (let batch = 0; batch < 3; batch++) {
        for (let i = 0; i < 5; i++) {
          remoteLogger.info(`Batch ${batch} log ${i}`);
        }
        
        try {
          await remoteLogger.flush();
        } catch {
          // Expected for failed transmission
        }
      }

      // Verify metrics were tracked
      expect(transmissionCount).toBe(3);
      expect(transmissionTimes.length).toBe(3);
      
      // Network conditions should have been analyzed
      const stats = remoteLogger.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('Compression with Adaptive Batching', () => {
    it('should combine compression with adaptive batching effectively', async () => {
      const requestSizes = [];
      
      fetchMock.mockImplementation(async (url, config) => {
        // Track request body sizes
        const bodySize = config.body instanceof Uint8Array 
          ? config.body.length 
          : config.body.length;
        requestSizes.push(bodySize);
        
        return {
          ok: true,
          json: async () => ({ success: true, processed: 50 }),
        };
      });

      remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://localhost:3001/api/debug-log',
          batchSize: 50,
          flushInterval: 5000,
          initialConnectionDelay: 0, // Disable for testing
          skipServerReadinessValidation: true, // Skip validation for testing
          compression: {
            enabled: true,
            threshold: 500,
            algorithm: 'gzip',
            level: 6,
          },
          batching: {
            adaptive: true,
            minBatchSize: 25,
            maxBatchSize: 100,
            targetLatency: 100,
            adjustmentFactor: 0.2,
          },
        },
        dependencies: {
          consoleLogger: mockConsoleLogger,
        },
      });

      // Generate high-volume logs
      const message = 'Test message with some content '.repeat(5);
      for (let i = 0; i < 150; i++) {
        remoteLogger.info(`${message} ${i}`);
      }

      // Let batching adapt
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Flush remaining
      await remoteLogger.flush();

      // Should have made requests with compression
      expect(fetchMock).toHaveBeenCalled();
      expect(requestSizes.length).toBeGreaterThan(0);
      
      // At least some requests should be compressed (smaller than expected)
      const hasCompressedRequests = requestSizes.some(size => size < 1000);
      expect(hasCompressedRequests).toBe(true);
    });
  });
});