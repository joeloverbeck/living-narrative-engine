import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PerformanceMonitor from '../../../src/entities/monitoring/PerformanceMonitor.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('PerformanceMonitor', () => {
  let monitor;
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = createMockLogger();
  });

  describe('constructor', () => {
    it('should create monitor with default settings', () => {
      monitor = new PerformanceMonitor({ logger });

      expect(monitor).toBeDefined();
      expect(logger.debug).toHaveBeenCalledWith(
        'PerformanceMonitor initialized',
        expect.any(Object)
      );
    });

    it('should create monitor with custom settings', () => {
      monitor = new PerformanceMonitor({
        logger,
        slowOperationThreshold: 200,
        maxHistorySize: 500,
      });

      expect(monitor).toBeDefined();
      expect(logger.debug).toHaveBeenCalledWith(
        'PerformanceMonitor initialized',
        {
          enabled: true,
          slowOperationThreshold: 200,
          maxHistorySize: 500,
        }
      );
    });

    it('should create monitor in disabled state', () => {
      monitor = new PerformanceMonitor({ logger, enabled: false });

      expect(monitor).toBeDefined();
      expect(logger.debug).toHaveBeenCalledWith(
        'PerformanceMonitor initialized',
        expect.objectContaining({ enabled: false })
      );
    });
  });

  describe('startTimer', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({ logger });
    });

    it('should start a timer and return timer ID', () => {
      const timerId = monitor.startTimer('test-op', 'test-context');

      expect(timerId).toBeDefined();
      expect(typeof timerId).toBe('string');
    });

    it('should return null when monitoring is disabled', () => {
      monitor.setEnabled(false);
      const timerId = monitor.startTimer('test-op');

      expect(timerId).toBeNull();
    });

    it('should handle concurrent operations', () => {
      const timer1 = monitor.startTimer('op1');
      const timer2 = monitor.startTimer('op2');

      expect(timer1).not.toBe(timer2);
      expect(timer1).toBeDefined();
      expect(timer2).toBeDefined();
    });

    it('should accept context', () => {
      const context = 'user123:create';
      const timerId = monitor.startTimer('test-op', context);

      expect(timerId).toBeDefined();
    });
  });

  describe('stopTimer', () => {
    let timerId;

    beforeEach(() => {
      monitor = new PerformanceMonitor({
        logger,
        slowOperationThreshold: 100,
      });
      timerId = monitor.startTimer('test-op');
    });

    it('should stop a timer successfully', () => {
      const duration = monitor.stopTimer(timerId);

      expect(duration).toBeDefined();
      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should warn for slow operations', (done) => {
      // Simulate slow operation
      setTimeout(() => {
        monitor.stopTimer(timerId);
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Slow operation detected'),
          expect.any(Object)
        );
        done();
      }, 150);
    });

    it('should handle non-existent timer ID', () => {
      const result = monitor.stopTimer('invalid-timer-id');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Timer not found')
      );
    });

    it('should return null when monitoring is disabled', () => {
      monitor.setEnabled(false);
      const result = monitor.stopTimer(timerId);

      expect(result).toBeNull();
    });

    it('should update operation statistics', () => {
      monitor.stopTimer(timerId);
      const metrics = monitor.getMetrics();

      expect(metrics.totalOperations).toBeGreaterThan(0);
    });

    it('should update operation statistics after stopping timer', () => {
      const operationId = monitor.startTimer('test-op');
      monitor.stopTimer(operationId);
      const metrics = monitor.getMetrics();

      expect(metrics.totalOperations).toBe(1);
    });
  });

  describe('timeSync', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({
        logger,
        slowOperationThreshold: 100,
      });
    });

    it('should time a synchronous operation', () => {
      const result = monitor.timeSync(
        'test-op',
        () => {
          return 'test-result';
        },
        'test-context'
      );

      expect(result).toBe('test-result');
      const metrics = monitor.getMetrics();
      expect(metrics.totalOperations).toBe(1);
    });

    it('should track slow operations', (done) => {
      monitor.timeSync('slow-op', () => {
        // Simulate slow operation
        const start = Date.now();
        while (Date.now() - start < 150) {
          // Busy wait
        }
        return 'slow-result';
      });

      setTimeout(() => {
        const metrics = monitor.getMetrics();
        expect(metrics.slowOperations).toBe(1);
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Slow operation detected'),
          expect.any(Object)
        );
        done();
      }, 200);
    });

    it('should handle operation errors', () => {
      expect(() => {
        monitor.timeSync('failed-op', () => {
          throw new Error('Test error');
        });
      }).toThrow('Test error');

      const metrics = monitor.getMetrics();
      expect(metrics.totalOperations).toBe(1);
    });

    it('should not time when monitoring is disabled', () => {
      monitor.setEnabled(false);
      const result = monitor.timeSync('test-op', () => 'disabled-result');

      expect(result).toBe('disabled-result');
      const metrics = monitor.getMetrics();
      expect(metrics.totalOperations).toBe(0);
    });

    it('should calculate average duration correctly', () => {
      monitor.timeSync('op1', () => {
        const start = Date.now();
        while (Date.now() - start < 10) {}
      });
      monitor.timeSync('op2', () => {
        const start = Date.now();
        while (Date.now() - start < 20) {}
      });
      monitor.timeSync('op3', () => {
        const start = Date.now();
        while (Date.now() - start < 30) {}
      });

      const metrics = monitor.getMetrics();
      expect(metrics.averageOperationTime).toBeGreaterThan(0);
    });
  });

  describe('getMetrics', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({ logger });
    });

    it('should return initial metrics', () => {
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

    it('should track operation counts by name', () => {
      monitor.timeSync('op1', () => {});
      monitor.timeSync('op1', () => {});
      monitor.timeSync('op2', () => {});

      const metrics = monitor.getMetrics();
      expect(metrics.operationCounts).toEqual({
        op1: 2,
        op2: 1,
      });
    });

    it('should track min and max durations', () => {
      // Use timeSync to record operations with different durations
      monitor.timeSync('op1', () => {
        const start = Date.now();
        while (Date.now() - start < 5) {}
      });
      monitor.timeSync('op2', () => {
        const start = Date.now();
        while (Date.now() - start < 10) {}
      });
      monitor.timeSync('op3', () => {
        const start = Date.now();
        while (Date.now() - start < 2) {}
      });

      const metrics = monitor.getMetrics();
      expect(metrics.minOperationTime).toBeGreaterThan(0);
      expect(metrics.maxOperationTime).toBeGreaterThan(
        metrics.minOperationTime
      );
    });

    it('should track active timers', () => {
      const timer1 = monitor.startTimer('op1');
      const timer2 = monitor.startTimer('op2');

      const metrics = monitor.getMetrics();
      expect(metrics.activeTimers).toBe(2);

      monitor.stopTimer(timer1);
      monitor.stopTimer(timer2);
    });
  });

  describe('getOperationsByType', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({ logger });
    });

    it('should return operations by type', () => {
      monitor.timeSync('test-op', () => {});
      monitor.timeSync('test-op', () => {});
      monitor.timeSync('other-op', () => {});

      const operations = monitor.getOperationsByType('test-op');

      expect(operations).toHaveLength(2);
      expect(operations[0]).toHaveProperty('operation', 'test-op');
      expect(operations[0]).toHaveProperty('duration');
      expect(operations[0]).toHaveProperty('timestamp');
    });

    it('should return empty array for unknown operation', () => {
      const operations = monitor.getOperationsByType('unknown-op');

      expect(operations).toEqual([]);
    });
  });

  describe('checkMemoryUsage', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({
        logger,
        memoryWarningThreshold: 0.8,
      });
    });

    it('should check memory usage', () => {
      // checkMemoryUsage doesn't return a value, it just logs warnings
      monitor.checkMemoryUsage();

      // If no warning logged, memory is OK
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should warn when memory usage is high', () => {
      // Mock process.memoryUsage to simulate high memory
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 900 * 1024 * 1024, // 900MB
        heapTotal: 1000 * 1024 * 1024, // 1GB
        external: 0,
        rss: 1000 * 1024 * 1024,
      });

      monitor.checkMemoryUsage();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('High memory usage detected'),
        expect.any(Object)
      );

      // Restore original
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('reset', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({ logger });
    });

    it('should reset all statistics', () => {
      // Add some operations
      monitor.timeSync('op1', () => {});
      monitor.timeSync('op2', () => {});

      // Reset
      monitor.reset();

      // Check metrics are cleared
      const metrics = monitor.getMetrics();
      expect(metrics.totalOperations).toBe(0);
      expect(metrics.operationCounts).toEqual({});
      expect(metrics.averageOperationTime).toBe(0);
    });

    it('should clear active timers', () => {
      const timerId = monitor.startTimer('test-op');
      monitor.reset();

      // Trying to stop the timer should return null with warning
      const result = monitor.stopTimer(timerId);
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('setEnabled', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({ logger });
    });

    it('should enable monitoring', () => {
      monitor.setEnabled(false);
      monitor.setEnabled(true);

      const metrics = monitor.getMetrics();
      expect(metrics.totalOperations).toBeDefined();
    });

    it('should disable monitoring', () => {
      monitor.setEnabled(false);

      const metrics = monitor.getMetrics();
      expect(metrics.totalOperations).toBe(0);

      // Operations should not be recorded
      monitor.timeSync('test-op', () => {});
      const newMetrics = monitor.getMetrics();
      expect(newMetrics.totalOperations).toBe(0);
    });
  });

  describe('getRecentOperations', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({
        logger,
        maxOperationsHistory: 3,
      });
    });

    it('should return recent operations', () => {
      monitor.timeSync('op1', () => {});
      monitor.timeSync('op2', () => {});
      monitor.timeSync('op3', () => {});

      const recent = monitor.getRecentOperations();

      expect(recent).toHaveLength(3);
      expect(recent[0]).toHaveProperty('operation');
      expect(recent[0]).toHaveProperty('duration');
      expect(recent[0]).toHaveProperty('timestamp');
    });

    it('should limit history to maxHistorySize', () => {
      monitor.timeSync('op1', () => {});
      monitor.timeSync('op2', () => {});
      monitor.timeSync('op3', () => {});
      monitor.timeSync('op4', () => {}); // This might push out op1 if max is 3

      const recent = monitor.getRecentOperations(3);

      expect(recent.length).toBeLessThanOrEqual(3);
    });

    it('should include operation context', () => {
      monitor.timeSync('test-op', () => {}, 'test-context');

      const recent = monitor.getRecentOperations();

      expect(recent[0]).toHaveProperty('operation', 'test-op');
      expect(recent[0]).toHaveProperty('context', 'test-context');
    });
  });
});
