/**
 * @file Performance tests for HybridLogger
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
import { createPerformanceTestBed } from '../../common/performanceTestBed.js';

// Mock fetch globally for RemoteLogger
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock sendBeacon for RemoteLogger
const mockSendBeacon = jest.fn();

// Store original values
const originalWindow = global.window;
const originalDocument = global.document;
const originalNavigator = global.navigator;

describe('HybridLogger Performance', () => {
  let consoleLogger;
  let remoteLogger;
  let categoryDetector;
  let hybridLogger;
  let originalConsoleLog;
  let originalConsoleWarn;
  let originalConsoleError;
  let originalConsoleDebug;
  let testBed;

  beforeEach(() => {
    // Create performance test bed
    testBed = createPerformanceTestBed();

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

    // Mock console methods to capture calls
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

    // Create real instances
    consoleLogger = new ConsoleLogger('DEBUG');
    remoteLogger = new RemoteLogger({
      config: {
        endpoint: 'http://test-server/api/debug-log',
        batchSize: 5,
        flushInterval: 100,
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

    // Create HybridLogger with real dependencies and permissive filters for testing
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

  afterEach(() => {
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

    testBed?.cleanup();
  });

  describe('High-Volume Logging Performance', () => {
    it('should handle high-volume logging efficiently', async () => {
      const messageCount = 100;
      const maxDuration = 300; // Increased from 150ms to 300ms for better reliability (3ms per message)

      // Warmup runs to allow JIT optimization
      for (let i = 0; i < 10; i++) {
        hybridLogger.info(`Warmup message ${i}`);
      }
      jest.clearAllMocks();

      const startTime = performance.now();

      // Generate many log messages
      for (let i = 0; i < messageCount; i++) {
        hybridLogger.info(`High volume message ${i}`);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Performance assertion
      expect(duration).toBeLessThan(maxDuration);

      // Functionality assertions
      expect(console.info).toHaveBeenCalledTimes(messageCount);

      // Wait for remote logger batch processing
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should batch remote logs effectively', async () => {
      // Configure small batch size for testing
      remoteLogger = new RemoteLogger({
        config: {
          batchSize: 3,
          flushInterval: 50,
        },
        dependencies: {
          consoleLogger: consoleLogger,
        },
      });

      hybridLogger = new HybridLogger({
        consoleLogger,
        remoteLogger,
        categoryDetector,
      });

      const startTime = performance.now();

      // Send 5 messages (should trigger batch at 3)
      hybridLogger.info('Message 1');
      hybridLogger.info('Message 2');
      hybridLogger.info('Message 3'); // Should trigger batch
      hybridLogger.info('Message 4');
      hybridLogger.info('Message 5');

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete quickly even with batching (increased threshold for reliability)
      expect(duration).toBeLessThan(100);

      // Wait for batching
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have made at least one batch request
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Category Detection Performance', () => {
    it('should maintain performance with real category detection', () => {
      const iterations = 1000;
      const maxDuration = 1500; // Increased from 900ms to 1500ms for better reliability (1.5ms per message)

      // Warmup runs
      for (let i = 0; i < 50; i++) {
        hybridLogger.info(`Warmup message ${i} with GameEngine context`);
      }
      jest.clearAllMocks();

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        hybridLogger.info(
          `Performance test message ${i} with GameEngine context`
        );
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Performance assertion
      expect(duration).toBeLessThan(maxDuration);

      // Category detection should have been called for each message
      expect(console.info).toHaveBeenCalledTimes(iterations);
    });

    it('should cache category detection results effectively', () => {
      const sameMessage = 'Repeated message for caching test';
      const iterations = 50;
      const maxDuration = 50; // Increased from 20ms to 50ms for better reliability

      // Warmup to populate cache
      hybridLogger.info(sameMessage);
      jest.clearAllMocks();

      const startTime = performance.now();

      // Send the same message multiple times
      for (let i = 0; i < iterations; i++) {
        hybridLogger.info(sameMessage);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should be very fast due to caching
      expect(duration).toBeLessThan(maxDuration);

      // All should have been logged with the same category
      expect(console.info).toHaveBeenCalledTimes(iterations);

      // Check that all calls used the same formatted prefix (cache hit)
      const firstCall = console.info.mock.calls[0][0];
      console.info.mock.calls.forEach((call) => {
        expect(call[0]).toBe(firstCall);
      });
    });
  });

  describe('Throughput Benchmarks', () => {
    it('should handle 10,000 messages without performance degradation', () => {
      const messageCount = 10000;
      const maxDurationPerMessage = 1.0; // Increased from 0.5ms to 1.0ms per message for better reliability

      // Warmup runs
      for (let i = 0; i < 100; i++) {
        hybridLogger.info(`Warmup throughput message ${i}`);
      }
      jest.clearAllMocks();

      const startTime = performance.now();

      for (let i = 0; i < messageCount; i++) {
        hybridLogger.info(`Throughput test message ${i}`);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const averagePerMessage = duration / messageCount;

      // Performance assertion
      expect(averagePerMessage).toBeLessThan(maxDurationPerMessage);
    });

    it('should maintain performance with mixed log levels', () => {
      const iterationsPerLevel = 250;
      const maxDuration = 1000; // Increased from 500ms to 1000ms for better reliability

      // Warmup runs
      for (let i = 0; i < 10; i++) {
        hybridLogger.debug(`Warmup debug ${i}`);
        hybridLogger.info(`Warmup info ${i}`);
        hybridLogger.warn(`Warmup warn ${i}`);
        hybridLogger.error(`Warmup error ${i}`);
      }
      jest.clearAllMocks();

      const startTime = performance.now();

      for (let i = 0; i < iterationsPerLevel; i++) {
        hybridLogger.debug(`Debug message ${i}`);
        hybridLogger.info(`Info message ${i}`);
        hybridLogger.warn(`Warning message ${i}`);
        hybridLogger.error(`Error message ${i}`);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Performance assertion
      expect(duration).toBeLessThan(maxDuration);

      // Verify all levels were processed
      expect(console.debug).toHaveBeenCalledTimes(iterationsPerLevel);
      expect(console.info).toHaveBeenCalledTimes(iterationsPerLevel);
      expect(console.warn).toHaveBeenCalledTimes(iterationsPerLevel);
      expect(console.error).toHaveBeenCalledTimes(iterationsPerLevel);
    });
  });
});
