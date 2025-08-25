/**
 * @file Memory usage tests for HybridLogger
 * @see src/logging/hybridLogger.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import HybridLogger from '../../../src/logging/hybridLogger.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import RemoteLogger from '../../../src/logging/remoteLogger.js';
import LogCategoryDetector from '../../../src/logging/logCategoryDetector.js';

// Mock fetch globally for RemoteLogger
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock sendBeacon for RemoteLogger
const mockSendBeacon = jest.fn();

// Store original values
const originalWindow = global.window;
const originalDocument = global.document;
const originalNavigator = global.navigator;

describe('HybridLogger Memory Usage', () => {
  let consoleLogger;
  let remoteLogger;
  let categoryDetector;
  let hybridLogger;
  let originalConsoleLog;
  let originalConsoleWarn;
  let originalConsoleError;
  let originalConsoleDebug;

  beforeEach(async () => {
    // Force GC before each test if available
    if (global.memoryTestUtils) {
      await global.memoryTestUtils.forceGCAndWait();
    }

    // Set up browser environment mocks for RemoteLogger
    global.window = {
      addEventListener: jest.fn(),
    };
    global.document = {
      addEventListener: jest.fn(),
      visibilityState: 'visible',
    };
    global.navigator = {
      sendBeacon: mockSendBeacon,
    };

    // Mock console methods to prevent output during tests
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    originalConsoleError = console.error;
    originalConsoleDebug = console.debug;

    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    console.debug = jest.fn();
    console.groupCollapsed = jest.fn();
    console.groupEnd = jest.fn();
    console.table = jest.fn();

    // Create real instances with memory-optimized configuration
    consoleLogger = new ConsoleLogger('DEBUG');
    remoteLogger = new RemoteLogger({
      config: {
        endpoint: 'http://test-server/api/debug-log',
        batchSize: 100,
        flushInterval: 500,
        requestTimeout: 1000,
        categoryCacheSize: 50,
        metadataLevel: 'minimal',
      },
      dependencies: {
        consoleLogger: consoleLogger,
      },
    });
    categoryDetector = new LogCategoryDetector();

    // Mock successful fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, processed: 1 }),
    });

    // Create HybridLogger with real dependencies
    hybridLogger = new HybridLogger(
      {
        consoleLogger,
        remoteLogger,
        categoryDetector,
      },
      {
        console: { categories: null, levels: null, enabled: true },
        remote: { categories: null, levels: null, enabled: true },
      }
    );

    // Clear mocks after creation to ignore initialization messages
    jest.clearAllMocks();
  });

  afterEach(async () => {
    jest.clearAllMocks();

    // Restore original console methods
    console.info = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    console.debug = originalConsoleDebug;

    // Restore global mocks
    global.window = originalWindow;
    global.document = originalDocument;
    global.navigator = originalNavigator;

    // Force GC after cleanup to prepare for next test
    if (global.memoryTestUtils) {
      await global.memoryTestUtils.forceGCAndWait();
    }
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory during high-volume logging', async () => {
      const messageCount = 5000;

      // Warmup phase to stabilize memory
      for (let i = 0; i < 100; i++) {
        hybridLogger.info(`Warmup message ${i}`);
      }

      // Force GC and get stable baseline memory
      const baselineMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      // Log memory baseline for debugging
      console.log(
        `Memory baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)}MB`
      );

      // Generate many messages in batches
      const batchSize = 500;
      for (let batch = 0; batch < messageCount / batchSize; batch++) {
        for (let i = 0; i < batchSize; i++) {
          const index = batch * batchSize + i;
          hybridLogger.info(`Memory test message ${index}`);
        }

        // Allow periodic flushing to prevent unbounded growth
        if (batch % 2 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      // Wait for any pending operations
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Force GC and get stable final memory
      const finalMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      const memoryIncrease = finalMemory - baselineMemory;
      const bytesPerOperation = memoryIncrease / messageCount;

      // Log memory stats for debugging
      console.log(`Memory final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(
        `Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(`Bytes per operation: ${bytesPerOperation.toFixed(2)}`);

      // Get environment-appropriate threshold
      const memoryThreshold = global.memoryTestUtils
        ? global.memoryTestUtils.getMemoryThreshold(30) // 30MB base, adjusted for CI
        : 30 * 1024 * 1024;

      // Memory should not increase significantly
      expect(memoryIncrease).toBeLessThan(memoryThreshold);

      // Should maintain efficient memory usage per operation
      const bytesPerOpThreshold = global.memoryTestUtils?.isCI() ? 8000 : 6000;
      expect(bytesPerOperation).toBeLessThan(bytesPerOpThreshold);
    }, 30000); // 30 second timeout for memory test

    it('should efficiently manage memory with mixed log levels', async () => {
      const iterationsPerLevel = 1000;

      // Warmup phase to stabilize memory and allow V8 optimizations
      for (let i = 0; i < 50; i++) {
        hybridLogger.debug(`Warmup debug ${i}`);
        hybridLogger.info(`Warmup info ${i}`);
        hybridLogger.warn(`Warmup warn ${i}`);
        hybridLogger.error(`Warmup error ${i}`);
      }

      // Wait for warmup operations to complete and flush
      await hybridLogger.waitForPendingFlushes();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get stable baseline memory after warmup
      const baselineMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      // Generate logs with different levels
      for (let i = 0; i < iterationsPerLevel; i++) {
        hybridLogger.debug(`Debug message ${i}`);
        hybridLogger.info(`Info message ${i}`);
        hybridLogger.warn(`Warning message ${i}`);
        hybridLogger.error(`Error message ${i}`);

        // Periodic yielding to prevent blocking
        if (i % 100 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      // Wait for all flush operations to complete
      await hybridLogger.waitForPendingFlushes();
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Force GC and get stable final memory
      const finalMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      const memoryIncrease = finalMemory - baselineMemory;
      const totalOperations = iterationsPerLevel * 4; // 4 log levels
      const bytesPerOperation = memoryIncrease / totalOperations;

      // Log memory stats
      console.log(
        `Mixed levels - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(
        `Mixed levels - Bytes per operation: ${bytesPerOperation.toFixed(2)}`
      );

      // Get environment-appropriate threshold
      // Note: Mixed log levels with 4000 operations (1000 per level) requires more memory
      // due to buffering and metadata overhead even with minimal settings
      const memoryThreshold = global.memoryTestUtils
        ? global.memoryTestUtils.getMemoryThreshold(45) // 45MB base for mixed levels
        : 45 * 1024 * 1024;

      // Memory should remain bounded
      expect(memoryIncrease).toBeLessThan(memoryThreshold);

      // Should maintain efficiency across different log levels
      // Note: With metadata, buffering, and category detection, expect ~11KB per operation
      const bytesPerOpThreshold = global.memoryTestUtils?.isCI()
        ? 15000
        : 12000;
      expect(bytesPerOperation).toBeLessThan(bytesPerOpThreshold);
    }, 30000);

    it('should handle category detection without memory leaks', async () => {
      const messageCount = 2000;
      const uniqueMessages = 100; // Test cache efficiency with repeated messages

      // Create array of test messages
      const testMessages = [];
      for (let i = 0; i < uniqueMessages; i++) {
        testMessages.push(
          `Test message ${i} with GameEngine and EntityManager context`
        );
      }

      // Get stable baseline memory
      const baselineMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      // Log messages with category detection
      for (let i = 0; i < messageCount; i++) {
        const message = testMessages[i % uniqueMessages];
        hybridLogger.info(message);

        // Periodic yielding
        if (i % 200 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      // Wait for operations to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Force GC and get stable final memory
      const finalMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      const memoryIncrease = finalMemory - baselineMemory;

      // Log memory stats
      console.log(
        `Category detection - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
      );

      // Get environment-appropriate threshold
      const memoryThreshold = global.memoryTestUtils
        ? global.memoryTestUtils.getMemoryThreshold(25) // 25MB for category detection
        : 25 * 1024 * 1024;

      // Memory should remain bounded with category detection cache
      expect(memoryIncrease).toBeLessThan(memoryThreshold);
    }, 30000);
  });
});
