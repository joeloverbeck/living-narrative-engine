import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { ActionCategorizationPerformanceMonitor } from '../../../../src/utils/monitoring/actionCategorizationPerformanceMonitor.js';

describe('ActionCategorizationPerformanceMonitor', () => {
  let monitor;
  let mockLogger;
  let originalPerformanceNow;
  let originalMemoryUsage;
  let performanceNowMock;
  let memoryUsageMock;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Mock performance.now()
    originalPerformanceNow = global.performance.now;
    performanceNowMock = jest.fn();
    global.performance.now = performanceNowMock;

    // Mock process.memoryUsage()
    originalMemoryUsage = process.memoryUsage;
    memoryUsageMock = jest.fn();
    process.memoryUsage = memoryUsageMock;

    // Set default memory usage
    memoryUsageMock.mockReturnValue({
      heapUsed: 50 * 1024 * 1024, // 50MB
      rss: 100 * 1024 * 1024,
      heapTotal: 80 * 1024 * 1024,
      external: 10 * 1024 * 1024,
      arrayBuffers: 5 * 1024 * 1024,
    });
  });

  afterEach(() => {
    global.performance.now = originalPerformanceNow;
    process.memoryUsage = originalMemoryUsage;
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration when no config provided', () => {
      monitor = new ActionCategorizationPerformanceMonitor({
        logger: mockLogger,
      });

      // Test by checking behavior when monitoring is disabled (default)
      performanceNowMock.mockReturnValue(100);
      const result = monitor.monitorOperation('test', () => 'result');

      expect(result).toBe('result');
      expect(performanceNowMock).not.toHaveBeenCalled(); // Not called when disabled
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        enabled: true,
        slowOperationThreshold: 20,
        memoryCheckInterval: 50,
        reportInterval: 500,
      };

      monitor = new ActionCategorizationPerformanceMonitor({
        logger: mockLogger,
        config: customConfig,
      });

      // Test custom threshold by triggering slow operation warning
      performanceNowMock.mockReturnValueOnce(100).mockReturnValueOnce(121); // 21ms > 20ms threshold

      monitor.monitorOperation('test', () => 'result');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ActionCategorizationPerformanceMonitor: Slow operation detected',
        expect.objectContaining({
          operation: 'test',
          duration: '21.00ms',
          threshold: '20ms',
        })
      );
    });

    it('should merge custom config with defaults', () => {
      const partialConfig = {
        enabled: true,
        slowOperationThreshold: 5,
      };

      monitor = new ActionCategorizationPerformanceMonitor({
        logger: mockLogger,
        config: partialConfig,
      });

      // Should have custom slowOperationThreshold but default other values
      performanceNowMock.mockReturnValueOnce(100).mockReturnValueOnce(106); // 6ms > 5ms threshold

      monitor.monitorOperation('test', () => 'result');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ActionCategorizationPerformanceMonitor: Slow operation detected',
        expect.objectContaining({
          threshold: '5ms',
        })
      );
    });
  });

  describe('monitorOperation', () => {
    beforeEach(() => {
      monitor = new ActionCategorizationPerformanceMonitor({
        logger: mockLogger,
        config: { enabled: true, slowOperationThreshold: 10 },
      });
    });

    it('should execute operation and return result when monitoring disabled', () => {
      monitor = new ActionCategorizationPerformanceMonitor({
        logger: mockLogger,
        config: { enabled: false },
      });

      const operation = jest.fn().mockReturnValue('test-result');
      const result = monitor.monitorOperation('testOp', operation);

      expect(result).toBe('test-result');
      expect(operation).toHaveBeenCalled();
      expect(performanceNowMock).not.toHaveBeenCalled();
    });

    it('should monitor successful operation execution', () => {
      performanceNowMock.mockReturnValueOnce(100).mockReturnValueOnce(105); // 5ms duration

      const operation = jest.fn().mockReturnValue('success');
      const result = monitor.monitorOperation('testOp', operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
      expect(performanceNowMock).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).not.toHaveBeenCalled(); // 5ms < 10ms threshold
    });

    it('should detect and warn about slow operations', () => {
      performanceNowMock.mockReturnValueOnce(100).mockReturnValueOnce(115); // 15ms > 10ms threshold

      monitor.monitorOperation('slowOp', () => 'result');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ActionCategorizationPerformanceMonitor: Slow operation detected',
        expect.objectContaining({
          operation: 'slowOp',
          duration: '15.00ms',
          threshold: '10ms',
        })
      );
    });

    it('should catch and rethrow errors while recording them', () => {
      performanceNowMock.mockReturnValueOnce(100);

      const error = new Error('Test error');
      const operation = jest.fn().mockImplementation(() => {
        throw error;
      });

      expect(() => monitor.monitorOperation('errorOp', operation)).toThrow(
        'Test error'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ActionCategorizationPerformanceMonitor: Operation error',
        expect.objectContaining({
          operation: 'errorOp',
          error: 'Test error',
          totalErrors: 1,
        })
      );
    });

    it('should track metrics for multiple operations', () => {
      performanceNowMock
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(105) // op1: 5ms
        .mockReturnValueOnce(200)
        .mockReturnValueOnce(208) // op2: 8ms
        .mockReturnValueOnce(300)
        .mockReturnValueOnce(312); // op3: 12ms (slow)

      monitor.monitorOperation('testOp', () => 1);
      monitor.monitorOperation('testOp', () => 2);
      monitor.monitorOperation('testOp', () => 3);

      const metrics = monitor.getMetrics();

      expect(metrics.operations.testOp).toEqual({
        count: 3,
        averageTime: (5 + 8 + 12) / 3,
        slowCount: 1,
        slowPercentage: (1 / 3) * 100,
      });
    });

    it('should detect high memory usage increases', () => {
      memoryUsageMock
        .mockReturnValueOnce({ heapUsed: 50 * 1024 * 1024 }) // Start: 50MB
        .mockReturnValueOnce({ heapUsed: 52 * 1024 * 1024 }); // End: 52MB (2MB increase)

      performanceNowMock.mockReturnValueOnce(100).mockReturnValueOnce(105);

      monitor.monitorOperation('memoryOp', () => 'result');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ActionCategorizationPerformanceMonitor: High memory usage in operation',
        expect.objectContaining({
          memoryIncrease: '2048KB',
          currentHeapUsed: '52MB',
        })
      );
    });

    it('should handle operations with unknown names', () => {
      performanceNowMock.mockReturnValueOnce(100).mockReturnValueOnce(105);

      monitor.monitorOperation('newOperation', () => 'result');

      const metrics = monitor.getMetrics();
      expect(metrics.operations.newOperation).toBeDefined();
      expect(metrics.operations.newOperation.count).toBe(1);
    });

    it('should trigger periodic reporting', () => {
      monitor = new ActionCategorizationPerformanceMonitor({
        logger: mockLogger,
        config: { enabled: true, reportInterval: 2 },
      });

      performanceNowMock
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(105)
        .mockReturnValueOnce(200)
        .mockReturnValueOnce(208);

      monitor.monitorOperation('testOp', () => 1);
      expect(mockLogger.info).not.toHaveBeenCalled();

      monitor.monitorOperation('testOp', () => 2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ActionCategorizationPerformanceMonitor: Operation metrics',
        expect.objectContaining({
          operation: 'testOp',
          totalOperations: 2,
          averageTime: '6.50ms',
        })
      );
    });
  });

  describe('monitorAsyncOperation', () => {
    beforeEach(() => {
      monitor = new ActionCategorizationPerformanceMonitor({
        logger: mockLogger,
        config: { enabled: true, slowOperationThreshold: 10 },
      });
    });

    it('should execute async operation when monitoring disabled', async () => {
      monitor = new ActionCategorizationPerformanceMonitor({
        logger: mockLogger,
        config: { enabled: false },
      });

      const operation = jest.fn().mockResolvedValue('async-result');
      const result = await monitor.monitorAsyncOperation('asyncOp', operation);

      expect(result).toBe('async-result');
      expect(operation).toHaveBeenCalled();
      expect(performanceNowMock).not.toHaveBeenCalled();
    });

    it('should monitor successful async operation', async () => {
      performanceNowMock.mockReturnValueOnce(100).mockReturnValueOnce(107);

      const operation = jest.fn().mockResolvedValue('async-success');
      const result = await monitor.monitorAsyncOperation('asyncOp', operation);

      expect(result).toBe('async-success');
      expect(operation).toHaveBeenCalled();
      expect(performanceNowMock).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should detect slow async operations', async () => {
      performanceNowMock.mockReturnValueOnce(100).mockReturnValueOnce(125); // 25ms > 10ms

      await monitor.monitorAsyncOperation('slowAsyncOp', async () => 'result');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ActionCategorizationPerformanceMonitor: Slow async operation detected',
        expect.objectContaining({
          operation: 'slowAsyncOp',
          duration: '25.00ms',
          threshold: '10ms',
        })
      );
    });

    it('should catch and rethrow async errors', async () => {
      performanceNowMock.mockReturnValueOnce(100);

      const error = new Error('Async error');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        monitor.monitorAsyncOperation('errorAsyncOp', operation)
      ).rejects.toThrow('Async error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ActionCategorizationPerformanceMonitor: Operation error',
        expect.objectContaining({
          operation: 'errorAsyncOp',
          error: 'Async error',
        })
      );
    });

    it('should track metrics for async operations', async () => {
      performanceNowMock
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(105)
        .mockReturnValueOnce(200)
        .mockReturnValueOnce(215); // 15ms (slow)

      await monitor.monitorAsyncOperation('asyncTest', async () => 1);
      await monitor.monitorAsyncOperation('asyncTest', async () => 2);

      const metrics = monitor.getMetrics();

      expect(metrics.operations.asyncTest).toEqual({
        count: 2,
        averageTime: (5 + 15) / 2,
        slowCount: 1,
        slowPercentage: 50,
      });
    });
  });

  describe('getMetrics', () => {
    beforeEach(() => {
      monitor = new ActionCategorizationPerformanceMonitor({
        logger: mockLogger,
        config: { enabled: true },
      });
    });

    it('should return empty metrics when no operations performed', () => {
      const metrics = monitor.getMetrics();

      expect(metrics.operations).toEqual({});
      expect(metrics.memory).toBeDefined();
      expect(metrics.memory.currentHeapUsed).toBe(50 * 1024 * 1024);
      expect(metrics.errors.count).toBe(0);
      expect(metrics.errors.lastError).toBeNull();
    });

    it('should return accumulated metrics', () => {
      performanceNowMock
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(110)
        .mockReturnValueOnce(200)
        .mockReturnValueOnce(220);

      monitor.monitorOperation('op1', () => 1);
      monitor.monitorOperation('op2', () => 2);

      const metrics = monitor.getMetrics();

      expect(metrics.operations.op1).toBeDefined();
      expect(metrics.operations.op1.count).toBe(1);
      expect(metrics.operations.op1.averageTime).toBe(10);

      expect(metrics.operations.op2).toBeDefined();
      expect(metrics.operations.op2.count).toBe(1);
      expect(metrics.operations.op2.averageTime).toBe(20);
    });

    it('should include error information in metrics', () => {
      performanceNowMock.mockReturnValueOnce(100);

      try {
        monitor.monitorOperation('errorOp', () => {
          throw new Error('Test error');
        });
      } catch {
        // Expected error
      }

      const metrics = monitor.getMetrics();

      expect(metrics.errors.count).toBe(1);
      expect(metrics.errors.lastError).toEqual({
        operation: 'errorOp',
        message: 'Test error',
        timestamp: expect.any(String),
      });
    });

    it('should calculate memory metrics correctly', () => {
      memoryUsageMock
        .mockReturnValueOnce({ heapUsed: 50 * 1024 * 1024 }) // Initial
        .mockReturnValueOnce({ heapUsed: 60 * 1024 * 1024 }) // Peak during operation
        .mockReturnValueOnce({ heapUsed: 55 * 1024 * 1024 }); // Current

      performanceNowMock.mockReturnValueOnce(100).mockReturnValueOnce(105);
      monitor.monitorOperation('op', () => null);

      memoryUsageMock.mockReturnValueOnce({ heapUsed: 55 * 1024 * 1024 });
      const metrics = monitor.getMetrics();

      expect(metrics.memory.currentHeapUsed).toBe(55 * 1024 * 1024);
      expect(metrics.memory.peakHeapUsed).toBe(60 * 1024 * 1024);
      expect(metrics.memory.memoryIncrease).toBe(5 * 1024 * 1024);
    });
  });

  describe('resetMetrics', () => {
    beforeEach(() => {
      monitor = new ActionCategorizationPerformanceMonitor({
        logger: mockLogger,
        config: { enabled: true },
      });
    });

    it('should reset all metrics to initial state', () => {
      // Perform some operations first
      performanceNowMock
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(110)
        .mockReturnValueOnce(200)
        .mockReturnValueOnce(220);

      monitor.monitorOperation('op1', () => 1);
      monitor.monitorOperation('op2', () => 2);

      // Record an error
      try {
        monitor.monitorOperation('errorOp', () => {
          throw new Error('Test');
        });
      } catch {
        // Expected
      }

      // Reset metrics
      monitor.resetMetrics();

      const metrics = monitor.getMetrics();

      // Check operations are reset but with initial structure
      expect(metrics.operations).toEqual({});
      expect(metrics.errors.count).toBe(0);
      expect(metrics.errors.lastError).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ActionCategorizationPerformanceMonitor: Metrics reset'
      );
    });

    it('should reset memory metrics to current values', () => {
      memoryUsageMock.mockReturnValue({ heapUsed: 70 * 1024 * 1024 });

      monitor.resetMetrics();

      const metrics = monitor.getMetrics();
      expect(metrics.memory.currentHeapUsed).toBe(70 * 1024 * 1024);
      expect(metrics.memory.peakHeapUsed).toBe(70 * 1024 * 1024);
      expect(metrics.memory.memoryIncrease).toBe(0);
    });
  });

  describe('generateReport', () => {
    beforeEach(() => {
      monitor = new ActionCategorizationPerformanceMonitor({
        logger: mockLogger,
        config: { enabled: true, slowOperationThreshold: 10 },
      });
    });

    it('should generate report with no operations', () => {
      const report = monitor.generateReport();

      expect(report).toContain(
        '=== Action Categorization Performance Report ==='
      );
      expect(report).toContain('Operations:');
      expect(report).toContain('Memory:');
      expect(report).toContain('Errors:');
      expect(report).toContain('Total Errors: 0');
    });

    it('should generate report with operations data', () => {
      performanceNowMock
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(108) // 8ms
        .mockReturnValueOnce(200)
        .mockReturnValueOnce(212) // 12ms (slow)
        .mockReturnValueOnce(300)
        .mockReturnValueOnce(305); // 5ms

      monitor.monitorOperation('testOp', () => 1);
      monitor.monitorOperation('testOp', () => 2);
      monitor.monitorOperation('anotherOp', () => 3);

      const report = monitor.generateReport();

      expect(report).toContain('testOp:');
      expect(report).toContain('Count: 2');
      expect(report).toContain('Average Time: 10.00ms');
      expect(report).toContain('Slow Operations: 1 (50.0%)');

      expect(report).toContain('anotherOp:');
      expect(report).toContain('Count: 1');
      expect(report).toContain('Average Time: 5.00ms');
      expect(report).toContain('Slow Operations: 0 (0.0%)');
    });

    it('should include memory information in report', () => {
      // Simulate memory increase from initial state
      // The monitor was created with 50MB initial memory in beforeEach

      // Perform an operation that increases memory
      performanceNowMock.mockReturnValueOnce(100).mockReturnValueOnce(105);

      // Mock memory usage calls during monitorOperation:
      // 1st call: startMemory (beginning of operation)
      // 2nd call: currentMemory (in checkMemoryUsage after operation)
      memoryUsageMock
        .mockReturnValueOnce({ heapUsed: 50 * 1024 * 1024 }) // startMemory
        .mockReturnValueOnce({ heapUsed: 75 * 1024 * 1024 }); // currentMemory (peak)

      monitor.monitorOperation('memOp', () => 'result');

      // Mock for getMetrics in generateReport:
      // getMetrics calls process.memoryUsage() twice on lines 272 and 275
      memoryUsageMock
        .mockReturnValueOnce({ heapUsed: 75 * 1024 * 1024 }) // line 272: currentHeapUsed
        .mockReturnValueOnce({ heapUsed: 75 * 1024 * 1024 }); // line 275: for memoryIncrease calculation

      const report = monitor.generateReport();

      expect(report).toContain('Memory:');
      expect(report).toContain('Current Heap: 75MB');
      expect(report).toContain('Peak Heap: 75MB');
      // Memory increase from initial 50MB to current 75MB = 25MB = 25600KB
      expect(report).toContain('Memory Increase: 25600KB');
    });

    it('should include error information in report', () => {
      performanceNowMock.mockReturnValueOnce(100);

      try {
        monitor.monitorOperation('failOp', () => {
          throw new Error('Operation failed');
        });
      } catch {
        // Expected
      }

      const report = monitor.generateReport();

      expect(report).toContain('Errors:');
      expect(report).toContain('Total Errors: 1');
      expect(report).toContain('Last Error: failOp - Operation failed');
    });

    it('should format report correctly with all sections', () => {
      // Setup some operations
      performanceNowMock
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(115)
        .mockReturnValueOnce(200)
        .mockReturnValueOnce(205);

      monitor.monitorOperation('op1', () => 1);
      monitor.monitorOperation('op2', () => 2);

      // Setup an error
      try {
        monitor.monitorOperation('errorOp', () => {
          throw new Error('Test error');
        });
      } catch {
        // Expected
      }

      const report = monitor.generateReport();
      const lines = report.split('\n');

      // Check structure
      expect(lines[0]).toBe('=== Action Categorization Performance Report ===');
      expect(lines[1]).toBe('');
      expect(lines[2]).toBe('Operations:');

      // Should have proper sections
      expect(report).toContain('Memory:');
      expect(report).toContain('Errors:');

      // Check specific content
      expect(report).toContain('op1:');
      expect(report).toContain('op2:');
      expect(report).toContain('Total Errors: 1');
    });
  });

  describe('memory check intervals', () => {
    it('should trigger memory reporting at configured intervals', () => {
      monitor = new ActionCategorizationPerformanceMonitor({
        logger: mockLogger,
        config: {
          enabled: true,
          memoryCheckInterval: 3,
        },
      });

      performanceNowMock.mockReturnValue(100);

      // Perform operations
      for (let i = 0; i < 3; i++) {
        performanceNowMock
          .mockReturnValueOnce(100 + i * 10)
          .mockReturnValueOnce(105 + i * 10);
        monitor.monitorOperation(`op${i}`, () => i);
      }

      // Should trigger memory report on 3rd operation (multiple of 3)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ActionCategorizationPerformanceMonitor: Memory metrics',
        expect.objectContaining({
          currentHeapUsed: expect.any(String),
          peakHeapUsed: expect.any(String),
          memoryIncrease: expect.any(String),
          memoryIncreasePercentage: expect.any(String),
        })
      );
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      monitor = new ActionCategorizationPerformanceMonitor({
        logger: mockLogger,
        config: { enabled: true },
      });
    });

    it('should handle operations that return undefined', () => {
      performanceNowMock.mockReturnValueOnce(100).mockReturnValueOnce(105);

      const result = monitor.monitorOperation('voidOp', () => undefined);
      expect(result).toBeUndefined();
    });

    it('should handle operations that return null', () => {
      performanceNowMock.mockReturnValueOnce(100).mockReturnValueOnce(105);

      const result = monitor.monitorOperation('nullOp', () => null);
      expect(result).toBeNull();
    });

    it('should handle very long operation names', () => {
      const longName = 'a'.repeat(100);
      performanceNowMock.mockReturnValueOnce(100).mockReturnValueOnce(105);

      monitor.monitorOperation(longName, () => 'result');

      const metrics = monitor.getMetrics();
      expect(metrics.operations[longName]).toBeDefined();
    });

    it('should handle zero duration operations', () => {
      performanceNowMock.mockReturnValueOnce(100).mockReturnValueOnce(100); // 0ms

      monitor.monitorOperation('instantOp', () => 'instant');

      const metrics = monitor.getMetrics();
      expect(metrics.operations.instantOp.averageTime).toBe(0);
    });

    it('should track multiple errors correctly', () => {
      performanceNowMock.mockReturnValue(100);

      // First error
      try {
        monitor.monitorOperation('error1', () => {
          throw new Error('First error');
        });
      } catch {
        // Expected
      }

      // Second error
      try {
        monitor.monitorOperation('error2', () => {
          throw new Error('Second error');
        });
      } catch {
        // Expected
      }

      const metrics = monitor.getMetrics();
      expect(metrics.errors.count).toBe(2);
      expect(metrics.errors.lastError.message).toBe('Second error');
      expect(metrics.errors.lastError.operation).toBe('error2');
    });

    it('should handle memory metrics when heap decreases', () => {
      memoryUsageMock
        .mockReturnValueOnce({ heapUsed: 60 * 1024 * 1024 }) // Start higher
        .mockReturnValueOnce({ heapUsed: 50 * 1024 * 1024 }); // End lower (GC ran)

      performanceNowMock.mockReturnValueOnce(100).mockReturnValueOnce(105);

      monitor.monitorOperation('gcOp', () => 'result');

      // Should not warn about memory increase
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('High memory usage'),
        expect.anything()
      );
    });
  });

  describe('configuration edge cases', () => {
    it('should handle missing logger methods gracefully', () => {
      const incompleteLogger = { info: jest.fn() }; // Missing warn, error, debug

      expect(() => {
        new ActionCategorizationPerformanceMonitor({
          logger: incompleteLogger,
        });
      }).not.toThrow();
    });

    it('should handle null config values', () => {
      monitor = new ActionCategorizationPerformanceMonitor({
        logger: mockLogger,
        config: {
          enabled: null,
          slowOperationThreshold: null,
        },
      });

      // Should use defaults (enabled: false by default)
      const result = monitor.monitorOperation('test', () => 'result');
      expect(result).toBe('result');
      expect(performanceNowMock).not.toHaveBeenCalled();
    });

    it('should handle negative threshold values', () => {
      monitor = new ActionCategorizationPerformanceMonitor({
        logger: mockLogger,
        config: {
          enabled: true,
          slowOperationThreshold: -1, // Negative threshold
        },
      });

      performanceNowMock.mockReturnValueOnce(100).mockReturnValueOnce(101); // 1ms

      monitor.monitorOperation('test', () => 'result');

      // Any positive duration should trigger warning with negative threshold
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ActionCategorizationPerformanceMonitor: Slow operation detected',
        expect.anything()
      );
    });
  });
});
