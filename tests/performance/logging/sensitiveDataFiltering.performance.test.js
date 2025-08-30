/**
 * @file Performance tests for sensitive data filtering in logging system
 * @see src/logging/remoteLogger.js
 * @see src/logging/hybridLogger.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import RemoteLogger from '../../../src/logging/remoteLogger.js';
import { createPerformanceTestBed } from '../../common/performanceTestBed.js';

// Mock fetch globally for RemoteLogger
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Sensitive Data Filtering Performance', () => {
  let testBed;
  let mockConsoleLogger;
  let mockEventBus;

  beforeEach(() => {
    testBed = createPerformanceTestBed();

    mockConsoleLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      groupCollapsed: jest.fn(),
      groupEnd: jest.fn(),
      table: jest.fn(),
      setLogLevel: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    // Mock successful fetch response for all RemoteLogger instances
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, processed: 1 }),
    });
  });

  afterEach(() => {
    testBed.cleanup();
    jest.clearAllMocks();
  });

  describe('RemoteLogger Filtering Performance', () => {
    it('should not significantly impact logging performance', () => {
      const logger = new RemoteLogger({
        config: {
          filtering: { enabled: true },
          batchSize: 100,
        },
        dependencies: {
          consoleLogger: mockConsoleLogger,
          eventBus: mockEventBus,
        },
      });

      // Mock the flush to prevent network calls
      logger._flush = jest.fn();

      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        logger.info(`Log entry ${i} with password: secret${i}`);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should complete in under 1 second

      logger.destroy?.();
    });

    it('should handle large objects efficiently', () => {
      const largeObject = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`field${i}`] = `value${i}`;
      }
      largeObject.password = 'secret123'; // Add sensitive data

      const logger = new RemoteLogger({
        config: {
          filtering: { enabled: true },
        },
        dependencies: {
          consoleLogger: mockConsoleLogger,
          eventBus: mockEventBus,
        },
      });

      // Mock the flush to prevent network calls
      logger._flush = jest.fn();

      const startTime = performance.now();
      logger.info('Large object test', largeObject);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be fast

      logger.destroy?.();
    });
  });
});
