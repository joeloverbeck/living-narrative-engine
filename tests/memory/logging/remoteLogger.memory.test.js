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

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();

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

    // Setup successful fetch mock by default
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, processed: 5 }),
    });
  });

  afterEach(() => {
    if (remoteLogger) {
      remoteLogger.destroy();
    }
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('High Volume Memory Usage', () => {
    it('should maintain efficient memory usage during high volume logging', async () => {
      const iterations = 2000;

      remoteLogger = new RemoteLogger({
        config: { batchSize: 100, flushInterval: 1000 },
        dependencies: { consoleLogger: mockConsoleLogger },
      });

      // Warmup phase
      for (let i = 0; i < 100; i++) {
        remoteLogger.info('warmup');
      }

      // Get baseline memory
      const baselineMemory = process.memoryUsage().heapUsed;

      // Execute high volume logging operations
      for (let i = 0; i < iterations; i++) {
        remoteLogger.info('Memory test', i, { data: `test_${i}` });
      }

      // Allow some processing time
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get final memory usage
      const finalMemory = process.memoryUsage().heapUsed;

      const memoryIncrease = finalMemory - baselineMemory;
      const bytesPerOperation = memoryIncrease / iterations;

      // Should not consume excessive memory per operation (10KB threshold)
      expect(bytesPerOperation).toBeLessThan(10000);

      // Memory increase should be reasonable for the operation volume (50MB threshold)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Buffer Memory Management', () => {
    it('should efficiently manage buffer memory', async () => {
      const batchSize = 50;
      remoteLogger = new RemoteLogger({
        config: { batchSize, flushInterval: 10000 }, // Don't auto-flush
        dependencies: { consoleLogger: mockConsoleLogger },
      });

      // Get baseline memory
      const baselineMemory = process.memoryUsage().heapUsed;

      // Fill buffer multiple times to test memory management
      for (let batch = 0; batch < 10; batch++) {
        for (let i = 0; i < batchSize; i++) {
          remoteLogger.info(`Buffer test batch ${batch} item ${i}`);
        }
        // Allow buffer to flush
        await jest.runAllTimersAsync();
      }

      const stats = remoteLogger.getStats();
      
      // Buffer should be empty after flushes
      expect(stats.bufferSize).toBe(0);

      // Check final memory usage
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - baselineMemory;

      // Buffer memory should not accumulate excessively (20MB threshold)
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024);
    });
  });
});