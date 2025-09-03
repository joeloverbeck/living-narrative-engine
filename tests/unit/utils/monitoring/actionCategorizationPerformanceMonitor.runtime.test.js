/**
 * @file Unit tests for ActionCategorizationPerformanceMonitor browser compatibility
 * Tests that the monitor handles browser environments gracefully without throwing errors
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
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
    it('should handle browser environment gracefully without throwing', () => {
      // Simulate browser environment where process is not defined
      delete globalThis.process;

      // Creating the monitor should work with fallback values
      const monitor = new ActionCategorizationPerformanceMonitor({ logger: mockLogger });
      expect(monitor).toBeInstanceOf(ActionCategorizationPerformanceMonitor);
      
      // Should be able to get metrics with zero/default values
      const metrics = monitor.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.memory.currentHeapUsed).toBe(0);
    });

    it('should handle partial process object without memoryUsage', () => {
      // Simulate partial polyfill where process exists but memoryUsage doesn't
      globalThis.process = { version: 'v16.0.0' };

      // Should not throw - uses fallback values
      const monitor = new ActionCategorizationPerformanceMonitor({ logger: mockLogger });
      expect(monitor).toBeInstanceOf(ActionCategorizationPerformanceMonitor);
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
        versions: { node: '16.0.0' },
      };

      const monitor = new ActionCategorizationPerformanceMonitor({ logger: mockLogger });
      expect(monitor).toBeInstanceOf(ActionCategorizationPerformanceMonitor);
      
      // Verify memory values are being used
      const metrics = monitor.getMetrics();
      expect(metrics.memory.currentHeapUsed).toBeGreaterThan(0);
    });
  });

  describe('Memory Monitoring Method Operations', () => {
    it('should handle monitorOperation in browser environment', () => {
      // Setup process mock for constructor to work
      globalThis.process = {
        memoryUsage: jest.fn(() => ({ heapUsed: 1024 * 1024 })),
        versions: { node: '16.0.0' },
      };

      const monitor = new ActionCategorizationPerformanceMonitor(mockLogger, { enabled: true });
      
      // Now remove process to simulate browser runtime
      delete globalThis.process;

      // Should work with fallback values, not throw
      const result = monitor.monitorOperation('testOperation', () => {
        return 'result';
      });
      expect(result).toBe('result');
    });

    it('should handle async operations in browser environment', async () => {
      // Setup process mock for constructor
      globalThis.process = {
        memoryUsage: jest.fn(() => ({ heapUsed: 1024 * 1024 })),
        versions: { node: '16.0.0' },
      };

      const monitor = new ActionCategorizationPerformanceMonitor(mockLogger, { enabled: true });
      
      // Remove process to simulate browser runtime
      delete globalThis.process;

      // Should work with fallback values
      const result = await monitor.monitorAsyncOperation('testAsyncOp', async () => {
        return 'async-result';
      });
      expect(result).toBe('async-result');
    });

    it('should generate report successfully in browser environment', () => {
      // Setup process mock for constructor
      globalThis.process = {
        memoryUsage: jest.fn(() => ({ heapUsed: 1024 * 1024 })),
        versions: { node: '16.0.0' },
      };

      const monitor = new ActionCategorizationPerformanceMonitor({ logger: mockLogger });
      
      // Remove process to simulate browser runtime
      delete globalThis.process;

      // Should generate report with fallback values
      const report = monitor.generateReport();
      expect(report).toContain('Action Categorization Performance Report');
      expect(report).toContain('Memory:');
    });

    it('should reset metrics successfully in browser environment', () => {
      // Setup process mock for constructor
      globalThis.process = {
        memoryUsage: jest.fn(() => ({ heapUsed: 1024 * 1024 })),
        versions: { node: '16.0.0' },
      };

      const monitor = new ActionCategorizationPerformanceMonitor({ logger: mockLogger });
      
      // Remove process to simulate browser runtime
      delete globalThis.process;

      // Should reset metrics with fallback values
      monitor.resetMetrics();
      expect(mockLogger.info).toHaveBeenCalledWith('ActionCategorizationPerformanceMonitor: Metrics reset');
      
      const metrics = monitor.getMetrics();
      expect(metrics.memory.currentHeapUsed).toBe(0);
    });
  });

  describe('Memory Usage Return Values', () => {
    it('should handle different memoryUsage return structures', () => {
      // Test with minimal memory usage object
      globalThis.process = {
        memoryUsage: jest.fn(() => ({
          heapUsed: 1000000,
        })),
        versions: { node: '16.0.0' },
      };

      const monitor = new ActionCategorizationPerformanceMonitor({ logger: mockLogger });
      expect(monitor).toBeInstanceOf(ActionCategorizationPerformanceMonitor);
    });

    it('should handle memoryUsage returning numbers as strings', () => {
      globalThis.process = {
        memoryUsage: jest.fn(() => ({
          heapUsed: '1000000', // String instead of number
        })),
        versions: { node: '16.0.0' },
      };

      const monitor = new ActionCategorizationPerformanceMonitor({ logger: mockLogger });
      expect(monitor).toBeInstanceOf(ActionCategorizationPerformanceMonitor);
    });
  });
});