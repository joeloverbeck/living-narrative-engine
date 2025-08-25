/**
 * @file Memory usage tests for RemoteLogger
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

// Mock UUID to have predictable session IDs
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-session-id-123'),
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock sendBeacon
const mockSendBeacon = jest.fn();
Object.defineProperty(global.navigator, 'sendBeacon', {
  writable: true,
  value: mockSendBeacon,
});

// Mock XMLHttpRequest for sync requests
const mockXMLHttpRequest = jest.fn();
global.XMLHttpRequest = mockXMLHttpRequest;

// Mock performance
global.performance = {
  now: jest.fn(() => 1000),
  memory: {
    usedJSHeapSize: 1024000,
  },
};

// Mock window and document for browser APIs
global.window = {
  location: {
    href: 'http://localhost:8080/test',
  },
  addEventListener: jest.fn(),
};

global.document = {
  addEventListener: jest.fn(),
  visibilityState: 'visible',
};

global.navigator = {
  ...global.navigator,
  userAgent: 'Mozilla/5.0 (Test Browser)',
  sendBeacon: mockSendBeacon,
};

describe('RemoteLogger - Memory Usage Tests', () => {
  let remoteLogger;
  let mockConsoleLogger;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    // Use real timers for memory tests to allow actual async operations
    jest.useRealTimers();

    mockConsoleLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      groupCollapsed: jest.fn(),
      groupEnd: jest.fn(),
      table: jest.fn(),
      setLogLevel: jest.fn(),
    };

    // Setup successful fetch mock by default with faster response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, processed: 5 }),
    });

    // Force GC and wait for stabilization before each test
    if (global.memoryTestUtils) {
      await global.memoryTestUtils.forceGCAndWait();
    }
  });

  afterEach(async () => {
    if (remoteLogger) {
      await remoteLogger.destroy();
    }
    jest.clearAllTimers();

    // Force GC after cleanup to prepare for next test
    if (global.memoryTestUtils) {
      await global.memoryTestUtils.forceGCAndWait();
    }
  });

  describe('High Volume Memory Usage', () => {
    it('should maintain efficient memory usage during high volume logging', async () => {
      const iterations = 2000;

      remoteLogger = new RemoteLogger({
        config: {
          batchSize: 100,
          flushInterval: 500, // Shorter interval for faster test
          requestTimeout: 1000, // Shorter timeout for test env
          categoryCacheSize: 50, // Small cache for memory test
          metadataLevel: 'minimal', // Reduce metadata collection for memory test
        },
        dependencies: { consoleLogger: mockConsoleLogger },
      });

      // Warmup phase with proper async handling
      for (let i = 0; i < 100; i++) {
        remoteLogger.info('warmup');
      }
      // Wait for warmup to complete and flush
      await remoteLogger.flush();

      // Force GC and get stable baseline memory
      const baselineMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      // Execute high volume logging operations in batches
      const batchSize = 200;
      for (let batch = 0; batch < iterations / batchSize; batch++) {
        for (let i = 0; i < batchSize; i++) {
          const index = batch * batchSize + i;
          remoteLogger.info('Memory test', index, { data: `test_${index}` });
        }

        // Allow buffer to flush periodically during test
        if (batch % 2 === 0) {
          await remoteLogger.flush();
        }
      }

      // Ensure all operations complete
      await remoteLogger.flush();

      // Wait for any pending async operations
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Force GC and get stable final memory
      const finalMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      const memoryIncrease = finalMemory - baselineMemory;
      const bytesPerOperation = memoryIncrease / iterations;

      // Log memory stats for debugging
      console.log(
        `Memory baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(`Memory final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(
        `Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(`Bytes per operation: ${bytesPerOperation.toFixed(2)}`);

      // Adjust thresholds based on environment
      // With optimizations, memory usage should be significantly lower
      const memoryThreshold = global.memoryTestUtils
        ? global.memoryTestUtils.getMemoryThreshold(30) // Reduced from 50MB to 30MB
        : 30 * 1024 * 1024;

      // Bytes per operation threshold accounts for cache and metadata
      // With hash-based cache and metadata cleanup, this should be much lower
      const bytesPerOpThreshold = global.memoryTestUtils?.isCI()
        ? 8000 // Reduced from 15000
        : 5000; // Reduced from 12000

      // Should not consume excessive memory per operation
      expect(bytesPerOperation).toBeLessThan(bytesPerOpThreshold);

      // Memory increase should be reasonable for the operation volume
      expect(memoryIncrease).toBeLessThan(memoryThreshold);
    }, 30000); // Increase timeout to 30 seconds
  });

  describe('Buffer Memory Management', () => {
    it('should efficiently manage buffer memory', async () => {
      const batchSize = 50;
      remoteLogger = new RemoteLogger({
        config: {
          batchSize,
          flushInterval: 5000, // Long interval to test manual flushing
          requestTimeout: 1000, // Shorter timeout for test env
          categoryCacheSize: 50, // Small cache for memory test
          metadataLevel: 'minimal', // Reduce metadata collection for memory test
        },
        dependencies: { consoleLogger: mockConsoleLogger },
      });

      // Get stable baseline memory
      const baselineMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      // Fill buffer multiple times to test memory management
      for (let batch = 0; batch < 10; batch++) {
        for (let i = 0; i < batchSize; i++) {
          remoteLogger.info(`Buffer test batch ${batch} item ${i}`);
        }
        // Manually flush buffer and verify completion
        await remoteLogger.flush();

        // Verify buffer is flushed after each batch
        const stats = remoteLogger.getStats();
        expect(stats.bufferSize).toBe(0);
      }

      // Force GC and wait for stabilization
      if (global.memoryTestUtils) {
        await global.memoryTestUtils.forceGCAndWait();
      }

      // Check final memory usage
      const finalMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      const memoryIncrease = finalMemory - baselineMemory;

      // Log memory stats for debugging
      console.log(
        `Buffer test - Memory baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(
        `Buffer test - Memory final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(
        `Buffer test - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
      );

      // Adjust threshold based on environment
      const memoryThreshold = global.memoryTestUtils
        ? global.memoryTestUtils.getMemoryThreshold(20) // 20MB base, adjusted for CI
        : 20 * 1024 * 1024;

      // Buffer memory should not accumulate excessively
      expect(memoryIncrease).toBeLessThan(memoryThreshold);
    }, 20000); // Increase timeout to 20 seconds
  });
});
