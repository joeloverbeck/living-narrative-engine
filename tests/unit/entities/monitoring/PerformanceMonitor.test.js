/**
 * @file PerformanceMonitor.test.js - Unit tests for PerformanceMonitor
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import PerformanceMonitor from '../../../../src/entities/monitoring/PerformanceMonitor.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('PerformanceMonitor', () => {
  let monitor;
  let logger;
  let originalPerformanceNow;
  let originalMemoryUsage;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = createMockLogger();

    // Mock performance.now()
    originalPerformanceNow = global.performance.now;
    let mockTime = 0;
    global.performance.now = jest.fn(() => mockTime++);

    // Mock process.memoryUsage()
    originalMemoryUsage = global.process?.memoryUsage;
    if (!global.process) {
      global.process = {};
    }
    global.process.memoryUsage = jest.fn(() => ({
      heapUsed: 500 * 1024 * 1024, // 500MB
      heapTotal: 1024 * 1024 * 1024, // 1GB
    }));
  });

  afterEach(() => {
    global.performance.now = originalPerformanceNow;
    if (originalMemoryUsage) {
      global.process.memoryUsage = originalMemoryUsage;
    } else if (global.process) {
      delete global.process.memoryUsage;
    }
  });

  describe('constructor', () => {
    it('should create monitor with default settings', () => {
      monitor = new PerformanceMonitor({ logger });

      expect(monitor).toBeDefined();
      expect(logger.debug).toHaveBeenCalledWith(
        'PerformanceMonitor initialized',
        {
          enabled: true,
          slowOperationThreshold: 100,
          maxHistorySize: 1000,
        }
      );
    });

    it('should create monitor with custom settings', () => {
      monitor = new PerformanceMonitor({
        logger,
        enabled: false,
        slowOperationThreshold: 200,
        maxHistorySize: 500,
      });

      expect(monitor).toBeDefined();
      expect(logger.debug).toHaveBeenCalledWith(
        'PerformanceMonitor initialized',
        {
          enabled: false,
          slowOperationThreshold: 200,
          maxHistorySize: 500,
        }
      );
    });

    it('should validate logger dependency', () => {
      expect(() => new PerformanceMonitor({})).toThrow();
    });
  });

  describe('startTimer', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({ logger });
    });

    it('should start a timer and return timer ID', () => {
      const timerId = monitor.startTimer('test-operation');

      expect(timerId).toBeDefined();
      expect(typeof timerId).toBe('string');
      expect(timerId).toContain('test-operation');
    });

    it('should start a timer with context', () => {
      const timerId = monitor.startTimer('test-operation', 'user-123');

      expect(timerId).toBeDefined();
      expect(timerId).toContain('test-operation');
    });

    it('should return null when monitoring is disabled', () => {
      monitor = new PerformanceMonitor({ logger, enabled: false });
      const timerId = monitor.startTimer('test-operation');

      expect(timerId).toBeNull();
    });

    it('should handle concurrent timers', () => {
      const timer1 = monitor.startTimer('operation1');
      const timer2 = monitor.startTimer('operation2');

      expect(timer1).not.toBe(timer2);
      expect(timer1).toContain('operation1');
      expect(timer2).toContain('operation2');
    });
  });

  describe('stopTimer', () => {
    let timerId;

    beforeEach(() => {
      monitor = new PerformanceMonitor({ logger, slowOperationThreshold: 50 });
      timerId = monitor.startTimer('test-operation', 'context-123');
    });

    it('should stop timer and return duration', () => {
      // Advance mock time
      global.performance.now.mockReturnValueOnce(100);

      const duration = monitor.stopTimer(timerId);

      expect(duration).toBe(100);
    });

    it('should return null when monitoring is disabled', () => {
      monitor = new PerformanceMonitor({ logger, enabled: false });
      const duration = monitor.stopTimer('fake-timer');

      expect(duration).toBeNull();
    });

    it('should return null for invalid timer ID', () => {
      const duration = monitor.stopTimer('invalid-timer-id');

      expect(duration).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'Timer not found: invalid-timer-id'
      );
    });

    it('should return null when timer ID is null', () => {
      const duration = monitor.stopTimer(null);

      expect(duration).toBeNull();
    });

    it('should log warning for slow operations', () => {
      // Make operation take longer than threshold
      global.performance.now.mockReturnValueOnce(100);

      monitor.stopTimer(timerId);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Slow operation detected'),
        expect.objectContaining({
          operation: 'test-operation',
          duration: 100,
          context: 'context-123',
          threshold: 50,
        })
      );
    });

    it('should not log warning for fast operations', () => {
      // Make operation faster than threshold
      global.performance.now.mockReturnValueOnce(30);

      monitor.stopTimer(timerId);

      expect(logger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Slow operation detected'),
        expect.any(Object)
      );
    });
  });

  describe('timeOperation', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({ logger });
    });

    it('should time an async operation successfully', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      global.performance.now
        .mockReturnValueOnce(0) // startTimer
        .mockReturnValueOnce(50); // stopTimer

      const result = await monitor.timeOperation('async-op', mockFn, 'context');

      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalled();
    });

    it('should handle async operation errors', async () => {
      const error = new Error('Async error');
      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(monitor.timeOperation('async-op', mockFn)).rejects.toThrow(
        'Async error'
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Operation async-op failed:',
        error
      );
    });

    it('should bypass timing when disabled', async () => {
      monitor = new PerformanceMonitor({ logger, enabled: false });
      const mockFn = jest.fn().mockResolvedValue('result');

      const result = await monitor.timeOperation('async-op', mockFn);

      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalled();
      expect(global.performance.now).not.toHaveBeenCalled();
    });
  });

  describe('timeSync', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({ logger });
    });

    it('should time a sync operation successfully', () => {
      const mockFn = jest.fn().mockReturnValue('sync-result');
      global.performance.now
        .mockReturnValueOnce(0) // startTimer
        .mockReturnValueOnce(25); // stopTimer

      const result = monitor.timeSync('sync-op', mockFn, 'context');

      expect(result).toBe('sync-result');
      expect(mockFn).toHaveBeenCalled();
    });

    it('should handle sync operation errors', () => {
      const error = new Error('Sync error');
      const mockFn = jest.fn().mockImplementation(() => {
        throw error;
      });

      expect(() => monitor.timeSync('sync-op', mockFn)).toThrow('Sync error');

      expect(logger.error).toHaveBeenCalledWith(
        'Sync operation sync-op failed:',
        error
      );
    });

    it('should bypass timing when disabled', () => {
      monitor = new PerformanceMonitor({ logger, enabled: false });
      const mockFn = jest.fn().mockReturnValue('result');

      const result = monitor.timeSync('sync-op', mockFn);

      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalled();
      expect(global.performance.now).not.toHaveBeenCalled();
    });
  });

  describe('getMetrics', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({ logger });
    });

    it('should return empty metrics when disabled', () => {
      monitor = new PerformanceMonitor({ logger, enabled: false });
      const metrics = monitor.getMetrics();

      expect(metrics).toEqual({
        totalOperations: 0,
        slowOperations: 0,
        averageOperationTime: 0,
        maxOperationTime: 0,
        minOperationTime: 0,
        operationCounts: {},
        slowOperationsByType: {},
        memoryUsageWarnings: 0,
        activeTimers: 0,
      });
    });

    it('should return correct metrics after operations', () => {
      // Perform some operations
      global.performance.now.mockReturnValueOnce(0);
      const timer1 = monitor.startTimer('op1');
      global.performance.now.mockReturnValueOnce(30);
      monitor.stopTimer(timer1);

      global.performance.now.mockReturnValueOnce(40);
      const timer2 = monitor.startTimer('op2');
      global.performance.now.mockReturnValueOnce(160); // Slow operation
      monitor.stopTimer(timer2);

      global.performance.now.mockReturnValueOnce(200);
      const timer3 = monitor.startTimer('op1');
      global.performance.now.mockReturnValueOnce(210);
      monitor.stopTimer(timer3);

      const metrics = monitor.getMetrics();

      expect(metrics.totalOperations).toBe(3);
      expect(metrics.slowOperations).toBe(1);
      expect(metrics.averageOperationTime).toBeCloseTo(53.33, 1);
      expect(metrics.maxOperationTime).toBe(120);
      expect(metrics.minOperationTime).toBe(10);
      expect(metrics.operationCounts).toEqual({ op1: 2, op2: 1 });
      expect(metrics.slowOperationsByType).toEqual({ op2: 1 });
      expect(metrics.activeTimers).toBe(0);
    });

    it('should track active timers', () => {
      monitor.startTimer('op1');
      monitor.startTimer('op2');
      const timer3 = monitor.startTimer('op3');
      monitor.stopTimer(timer3);

      const metrics = monitor.getMetrics();
      expect(metrics.activeTimers).toBe(2);
    });
  });

  describe('getRecentOperations', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({ logger });
    });

    it('should return empty array when disabled', () => {
      monitor = new PerformanceMonitor({ logger, enabled: false });
      const operations = monitor.getRecentOperations();

      expect(operations).toEqual([]);
    });

    it('should return recent operations sorted by timestamp', () => {
      // Create operations with sequential timestamps
      const mockDate = jest.spyOn(Date, 'now');

      for (let i = 0; i < 3; i++) {
        global.performance.now.mockReturnValueOnce(i * 10);
        const timer = monitor.startTimer(`op${i}`);
        global.performance.now.mockReturnValueOnce((i + 1) * 10);
        // Mock Date.now for when stopTimer calls recordOperation
        mockDate.mockReturnValueOnce(1000 + i * 1000);
        monitor.stopTimer(timer);
      }

      const operations = monitor.getRecentOperations();

      // All 3 operations should be in history, sorted by timestamp descending
      expect(operations).toHaveLength(3);
      expect(operations[0].operation).toBe('op2');
      expect(operations[0].timestamp).toBe(3000);
      expect(operations[1].operation).toBe('op1');
      expect(operations[1].timestamp).toBe(2000);
      expect(operations[2].operation).toBe('op0');
      expect(operations[2].timestamp).toBe(1000);

      // Test limit parameter
      const limitedOps = monitor.getRecentOperations(2);
      expect(limitedOps).toHaveLength(2);
      expect(limitedOps[0].operation).toBe('op2');
      expect(limitedOps[1].operation).toBe('op1');
    });

    it('should respect limit parameter', () => {
      // Create 5 operations
      for (let i = 0; i < 5; i++) {
        const timer = monitor.startTimer(`op${i}`);
        monitor.stopTimer(timer);
      }

      const operations = monitor.getRecentOperations(3);
      expect(operations).toHaveLength(3);
    });
  });

  describe('getOperationsByType', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({ logger });
    });

    it('should return empty array when disabled', () => {
      monitor = new PerformanceMonitor({ logger, enabled: false });
      const operations = monitor.getOperationsByType('op1');

      expect(operations).toEqual([]);
    });

    it('should return operations of specific type', () => {
      // Create mixed operations
      ['op1', 'op2', 'op1', 'op3', 'op1'].forEach((op) => {
        const timer = monitor.startTimer(op);
        monitor.stopTimer(timer);
      });

      const operations = monitor.getOperationsByType('op1');

      expect(operations).toHaveLength(3);
      expect(operations.every((op) => op.operation === 'op1')).toBe(true);
    });

    it('should respect limit and sort by timestamp', () => {
      // Create operations with incrementing timestamps
      const mockDate = jest.spyOn(Date, 'now');

      // Create 5 operations
      for (let i = 0; i < 5; i++) {
        global.performance.now.mockReturnValueOnce(i * 10);
        const timer = monitor.startTimer('target-op');
        global.performance.now.mockReturnValueOnce((i + 1) * 10);
        mockDate.mockReturnValueOnce(1000 + i * 1000);
        monitor.stopTimer(timer);
      }

      const operations = monitor.getOperationsByType('target-op', 3);

      expect(operations).toHaveLength(3);
      // Filter gets all 5, slice(-3) takes last 3, then sorts desc
      expect(operations[0].timestamp).toBe(5000);
      expect(operations[1].timestamp).toBe(4000);
      expect(operations[2].timestamp).toBe(3000);
    });
  });

  describe('getSlowOperations', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({ logger, slowOperationThreshold: 50 });
    });

    it('should return empty array when disabled', () => {
      monitor = new PerformanceMonitor({ logger, enabled: false });
      const operations = monitor.getSlowOperations();

      expect(operations).toEqual([]);
    });

    it('should return only slow operations sorted by duration', () => {
      // Create operations with varying durations
      const operations = [
        { name: 'fast1', duration: 20 },
        { name: 'slow1', duration: 100 },
        { name: 'fast2', duration: 30 },
        { name: 'slow2', duration: 200 },
        { name: 'slow3', duration: 150 },
      ];

      operations.forEach(({ name, duration }, index) => {
        global.performance.now.mockReturnValueOnce(index * 1000);
        const timer = monitor.startTimer(name);
        global.performance.now.mockReturnValueOnce(index * 1000 + duration);
        monitor.stopTimer(timer);
      });

      const slowOps = monitor.getSlowOperations();

      expect(slowOps).toHaveLength(3);
      expect(slowOps[0].duration).toBe(200); // slow2
      expect(slowOps[1].duration).toBe(150); // slow3
      expect(slowOps[2].duration).toBe(100); // slow1
    });

    it('should respect limit parameter', () => {
      // Create 5 slow operations
      for (let i = 0; i < 5; i++) {
        global.performance.now.mockReturnValueOnce(0);
        const timer = monitor.startTimer(`slow-op-${i}`);
        global.performance.now.mockReturnValueOnce(100 + i * 10);
        monitor.stopTimer(timer);
      }

      const slowOps = monitor.getSlowOperations(3);
      expect(slowOps).toHaveLength(3);
    });
  });

  describe('checkMemoryUsage', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({ logger });
    });

    it('should do nothing when disabled', () => {
      monitor = new PerformanceMonitor({ logger, enabled: false });
      monitor.checkMemoryUsage();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should log warning when memory usage is high', () => {
      // Set high memory usage (900MB out of 1GB = 90%)
      global.process.memoryUsage.mockReturnValue({
        heapUsed: 900 * 1024 * 1024,
        heapTotal: 1024 * 1024 * 1024,
      });

      monitor.checkMemoryUsage();

      expect(logger.warn).toHaveBeenCalledWith(
        'High memory usage detected',
        expect.objectContaining({
          heapUsed: '900MB',
          heapTotal: '1024MB',
          usagePercentage: '88%',
          threshold: '80%',
        })
      );
    });

    it('should not log warning when memory usage is normal', () => {
      // Set normal memory usage (500MB out of 1GB = 50%)
      global.process.memoryUsage.mockReturnValue({
        heapUsed: 500 * 1024 * 1024,
        heapTotal: 1024 * 1024 * 1024,
      });

      monitor.checkMemoryUsage();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should increment memory usage warnings counter', () => {
      global.process.memoryUsage.mockReturnValue({
        heapUsed: 900 * 1024 * 1024,
        heapTotal: 1024 * 1024 * 1024,
      });

      monitor.checkMemoryUsage();
      monitor.checkMemoryUsage();

      const metrics = monitor.getMetrics();
      expect(metrics.memoryUsageWarnings).toBe(2);
    });
  });

  describe('reset', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({ logger });
    });

    it('should reset all metrics', () => {
      // Create some operations and memory warnings
      const timer1 = monitor.startTimer('op1');
      monitor.stopTimer(timer1);

      global.process.memoryUsage.mockReturnValue({
        heapUsed: 900 * 1024 * 1024,
        heapTotal: 1024 * 1024 * 1024,
      });
      monitor.checkMemoryUsage();

      // Reset
      monitor.reset();

      const metrics = monitor.getMetrics();
      expect(metrics).toEqual({
        totalOperations: 0,
        slowOperations: 0,
        averageOperationTime: 0,
        maxOperationTime: 0,
        minOperationTime: 0,
        operationCounts: {},
        slowOperationsByType: {},
        memoryUsageWarnings: 0,
        activeTimers: 0,
      });

      expect(logger.info).toHaveBeenCalledWith('Performance metrics reset');
    });

    it('should clear active timers', () => {
      monitor.startTimer('op1');
      monitor.startTimer('op2');

      monitor.reset();

      const metrics = monitor.getMetrics();
      expect(metrics.activeTimers).toBe(0);
    });
  });

  describe('setEnabled', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({ logger });
    });

    it('should enable monitoring', () => {
      monitor = new PerformanceMonitor({ logger, enabled: false });
      monitor.setEnabled(true);

      expect(logger.info).toHaveBeenCalledWith(
        'Performance monitoring enabled'
      );

      // Verify monitoring works
      const timer = monitor.startTimer('test');
      expect(timer).not.toBeNull();
    });

    it('should disable monitoring', () => {
      monitor.setEnabled(false);

      expect(logger.info).toHaveBeenCalledWith(
        'Performance monitoring disabled'
      );

      // Verify monitoring is disabled
      const timer = monitor.startTimer('test');
      expect(timer).toBeNull();
    });
  });

  describe('setSlowOperationThreshold', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({ logger });
    });

    it('should update slow operation threshold', () => {
      monitor.setSlowOperationThreshold(200);

      expect(logger.info).toHaveBeenCalledWith(
        'Slow operation threshold set to 200ms'
      );

      // Verify new threshold is used
      global.performance.now.mockReturnValueOnce(0);
      const timer = monitor.startTimer('test');
      global.performance.now.mockReturnValueOnce(150);
      monitor.stopTimer(timer);

      // 150ms should not be considered slow with 200ms threshold
      expect(logger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Slow operation detected'),
        expect.any(Object)
      );
    });
  });

  describe('getPerformanceReport', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({ logger, slowOperationThreshold: 50 });
    });

    it('should return disabled message when monitoring is off', () => {
      monitor = new PerformanceMonitor({ logger, enabled: false });
      const report = monitor.getPerformanceReport();

      expect(report).toBe('Performance monitoring is disabled');
    });

    it('should return comprehensive performance report', () => {
      // Create various operations
      const operations = [
        { name: 'fast-op', duration: 20, count: 3 },
        { name: 'slow-op', duration: 100, count: 2 },
        { name: 'normal-op', duration: 40, count: 5 },
      ];

      operations.forEach(({ name, duration, count }) => {
        for (let i = 0; i < count; i++) {
          global.performance.now.mockReturnValueOnce(i * 1000);
          const timer = monitor.startTimer(name);
          global.performance.now.mockReturnValueOnce(i * 1000 + duration);
          monitor.stopTimer(timer);
        }
      });

      // Add memory warning
      global.process.memoryUsage.mockReturnValue({
        heapUsed: 900 * 1024 * 1024,
        heapTotal: 1024 * 1024 * 1024,
      });
      monitor.checkMemoryUsage();

      const report = monitor.getPerformanceReport();

      expect(report).toContain('Performance Monitor Report');
      expect(report).toContain('Total Operations: 10');
      expect(report).toContain('Slow Operations: 2');
      expect(report).toContain('Memory Warnings: 1');
      expect(report).toContain('Top Operations:');
      expect(report).toContain('normal-op: 5');
      expect(report).toContain('fast-op: 3');
      expect(report).toContain('slow-op: 2');
      expect(report).toContain('Slow Operations by Type:');
      expect(report).toContain('Recent Slow Operations:');
    });

    it('should handle empty metrics gracefully', () => {
      const report = monitor.getPerformanceReport();

      expect(report).toContain('Total Operations: 0');
      expect(report).toContain('Average Time: 0.00ms');
      expect(report).not.toContain('undefined');
      expect(report).not.toContain('NaN');
    });
  });

  describe('operation history management', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({ logger, maxHistorySize: 3 });
    });

    it('should maintain history within max size limit', () => {
      // Mock Date.now for timestamps
      const mockDate = jest.spyOn(Date, 'now');

      // Create more operations than max history size
      for (let i = 0; i < 5; i++) {
        global.performance.now.mockReturnValueOnce(i * 10);
        const timer = monitor.startTimer(`op${i}`);
        global.performance.now.mockReturnValueOnce((i + 1) * 10);
        mockDate.mockReturnValueOnce(1000 + i * 1000);
        monitor.stopTimer(timer);
      }

      const recentOps = monitor.getRecentOperations();
      expect(recentOps).toHaveLength(3); // Should only keep last 3
      // History contains op2, op3, op4 after trimming
      // Sorted by timestamp descending: op4 (5000), op3 (4000), op2 (3000)
      expect(recentOps[0].operation).toBe('op4');
      expect(recentOps[0].timestamp).toBe(5000);
      expect(recentOps[1].operation).toBe('op3');
      expect(recentOps[1].timestamp).toBe(4000);
      expect(recentOps[2].operation).toBe('op2');
      expect(recentOps[2].timestamp).toBe(3000);
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({ logger });
    });

    it('should handle operations with same name', () => {
      const timer1 = monitor.startTimer('duplicate');
      const timer2 = monitor.startTimer('duplicate');

      monitor.stopTimer(timer1);
      monitor.stopTimer(timer2);

      const metrics = monitor.getMetrics();
      expect(metrics.operationCounts.duplicate).toBe(2);
    });

    it('should handle empty operation name', () => {
      const timer = monitor.startTimer('');
      expect(timer).toBeDefined();

      monitor.stopTimer(timer);
      const metrics = monitor.getMetrics();
      expect(metrics.operationCounts['']).toBe(1);
    });

    it('should handle very long operation names', () => {
      const longName = 'a'.repeat(1000);
      const timer = monitor.startTimer(longName);

      monitor.stopTimer(timer);
      const metrics = monitor.getMetrics();
      expect(metrics.operationCounts[longName]).toBe(1);
    });

    it('should handle browser environment without process', () => {
      // Save current process
      const savedProcess = global.process;

      // Simulate browser environment
      delete global.process;

      monitor = new PerformanceMonitor({ logger });

      // Should not throw when checking memory
      expect(() => monitor.checkMemoryUsage()).not.toThrow();

      // Restore process
      global.process = savedProcess;
    });

    it('should handle large number of operations without stack overflow', () => {
      // Create monitor
      monitor = new PerformanceMonitor({
        logger,
        enabled: true,
        maxHistorySize: 20000, // Allow large history
      });

      // Record 10,000 operations to test large array handling
      for (let i = 0; i < 10000; i++) {
        const timerId = monitor.startTimer('testOperation');
        monitor.stopTimer(timerId);
      }

      // This should not throw a RangeError (Maximum call stack size exceeded)
      expect(() => {
        const metrics = monitor.getMetrics();
        expect(metrics.totalOperations).toBe(10000);
        expect(metrics.averageOperationTime).toBeGreaterThanOrEqual(0);
        expect(metrics.maxOperationTime).toBeGreaterThanOrEqual(0);
        expect(metrics.minOperationTime).toBeGreaterThanOrEqual(0);
      }).not.toThrow();
    });
  });
});
