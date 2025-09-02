/**
 * @file Unit tests to reproduce runtime errors in actionCategorizationPerformanceMonitor.js
 * These tests specifically target the process.memoryUsage() calls that fail in browser environment
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionCategorizationPerformanceMonitor } from '../../../../src/utils/monitoring/actionCategorizationPerformanceMonitor.js';

describe('ActionCategorizationPerformanceMonitor - Runtime Error Reproduction', () => {
  let originalProcess;
  let mockLogger;

  beforeEach(() => {
    // Save original process object
    originalProcess = globalThis.process;
    
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  afterEach(() => {
    // Restore original process object
    globalThis.process = originalProcess;
    jest.clearAllMocks();
  });

  describe('Browser Environment Memory Access', () => {
    it('should throw ReferenceError when process.memoryUsage() is called in browser', () => {
      // Simulate browser environment where process is not defined
      delete globalThis.process;

      // Creating the monitor should fail due to process.memoryUsage() in constructor
      expect(() => {
        new ActionCategorizationPerformanceMonitor(mockLogger);
      }).toThrow('process is not defined');
    });

    it('should throw when process exists but memoryUsage method is missing', () => {
      // Simulate partial polyfill where process exists but memoryUsage doesn't
      globalThis.process = { version: 'v16.0.0' };

      expect(() => {
        new ActionCategorizationPerformanceMonitor(mockLogger);
      }).toThrow(); // Should throw because process.memoryUsage is not a function
    });

    it('should work properly in Node.js environment with full process object', () => {
      // Simulate proper Node.js environment
      globalThis.process = {
        memoryUsage: jest.fn(() => ({
          heapUsed: 1024 * 1024, // 1MB
          heapTotal: 2 * 1024 * 1024, // 2MB
          external: 512 * 1024, // 512KB
          rss: 4 * 1024 * 1024, // 4MB
        })),
      };

      const monitor = new ActionCategorizationPerformanceMonitor(mockLogger);
      expect(monitor).toBeInstanceOf(ActionCategorizationPerformanceMonitor);
      expect(globalThis.process.memoryUsage).toHaveBeenCalled();
    });
  });

  describe('Memory Monitoring Method Failures', () => {
    it('should fail when measuring operation performance in browser', () => {
      // Setup process mock for constructor to work
      globalThis.process = {
        memoryUsage: jest.fn(() => ({ heapUsed: 1024 * 1024 })),
      };

      const monitor = new ActionCategorizationPerformanceMonitor(mockLogger);
      
      // Now remove process to simulate browser runtime
      delete globalThis.process;

      // Should throw when trying to measure performance
      expect(() => {
        monitor.measureOperationPerformance('testOperation', () => {
          return 'result';
        });
      }).toThrow('process is not defined');
    });

    it('should fail when starting category measurement in browser', () => {
      // Setup process mock for constructor
      globalThis.process = {
        memoryUsage: jest.fn(() => ({ heapUsed: 1024 * 1024 })),
      };

      const monitor = new ActionCategorizationPerformanceMonitor(mockLogger);
      
      // Remove process to simulate browser runtime
      delete globalThis.process;

      // Should throw when trying to start measurement
      expect(() => {
        monitor.startCategoryMeasurement('testCategory');
      }).toThrow('process is not defined');
    });

    it('should fail when ending category measurement in browser', () => {
      // Setup for constructor and start measurement
      globalThis.process = {
        memoryUsage: jest.fn(() => ({ heapUsed: 1024 * 1024 })),
      };

      const monitor = new ActionCategorizationPerformanceMonitor(mockLogger);
      monitor.startCategoryMeasurement('testCategory');
      
      // Remove process to simulate browser runtime
      delete globalThis.process;

      // Should throw when trying to end measurement
      expect(() => {
        monitor.endCategoryMeasurement('testCategory');
      }).toThrow('process is not defined');
    });

    it('should fail when generating performance report in browser', () => {
      // Setup process mock for constructor
      globalThis.process = {
        memoryUsage: jest.fn(() => ({ heapUsed: 1024 * 1024 })),
      };

      const monitor = new ActionCategorizationPerformanceMonitor(mockLogger);
      
      // Remove process to simulate browser runtime
      delete globalThis.process;

      // Should throw when trying to generate report
      expect(() => {
        monitor.generatePerformanceReport();
      }).toThrow('process is not defined');
    });

    it('should fail when resetting metrics in browser', () => {
      // Setup process mock for constructor
      globalThis.process = {
        memoryUsage: jest.fn(() => ({ heapUsed: 1024 * 1024 })),
      };

      const monitor = new ActionCategorizationPerformanceMonitor(mockLogger);
      
      // Remove process to simulate browser runtime
      delete globalThis.process;

      // Should throw when trying to reset metrics
      expect(() => {
        monitor.resetMetrics();
      }).toThrow('process is not defined');
    });
  });

  describe('Memory Usage Return Values', () => {
    it('should handle different memoryUsage return structures', () => {
      // Test with minimal memory usage object
      globalThis.process = {
        memoryUsage: jest.fn(() => ({
          heapUsed: 1000000,
        })),
      };

      const monitor = new ActionCategorizationPerformanceMonitor(mockLogger);
      expect(monitor).toBeInstanceOf(ActionCategorizationPerformanceMonitor);
    });

    it('should handle memoryUsage returning numbers as strings', () => {
      globalThis.process = {
        memoryUsage: jest.fn(() => ({
          heapUsed: '1000000', // String instead of number
        })),
      };

      const monitor = new ActionCategorizationPerformanceMonitor(mockLogger);
      expect(monitor).toBeInstanceOf(ActionCategorizationPerformanceMonitor);
    });
  });
});