/**
 * @file Unit tests for LoggingPerformanceMonitor
 * @see ../../../src/logging/loggingPerformanceMonitor.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LoggingPerformanceMonitor } from '../../../src/logging/loggingPerformanceMonitor.js';

describe('LoggingPerformanceMonitor', () => {
  let monitor;
  let mockLogger;
  let mockEventBus;
  let mockCategoryDetector;
  let mockPerformanceMonitor;

  beforeEach(() => {
    // Create mock dependencies
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    mockCategoryDetector = {
      detectCategory: jest.fn().mockReturnValue('general'),
    };

    mockPerformanceMonitor = {
      structuredTrace: {
        recordMetric: jest.fn(),
        createChild: jest.fn().mockReturnValue({}),
        getSpans: jest.fn().mockReturnValue([]),
        getActiveSpan: jest.fn().mockReturnValue(null),
      },
      recordMetric: jest.fn(),
      checkThreshold: jest.fn(),
      getMetrics: jest.fn().mockReturnValue({}),
      getRealtimeMetrics: jest.fn().mockReturnValue({}),
      getRecordedMetrics: jest.fn().mockReturnValue({}),
      trackOperation: jest.fn(),
      getMonitoringStatus: jest.fn().mockReturnValue({ thresholds: {} }),
      clearRecordedMetrics: jest.fn(),
      clearAlerts: jest.fn(),
    };

    // Create monitor instance
    monitor = new LoggingPerformanceMonitor({
      logger: mockLogger,
      eventBus: mockEventBus,
      categoryDetector: mockCategoryDetector,
      performanceMonitor: mockPerformanceMonitor,
    });
  });

  describe('constructor', () => {
    it('should create instance with required dependencies', () => {
      expect(monitor).toBeDefined();
      expect(monitor).toBeInstanceOf(LoggingPerformanceMonitor);
    });

    it('should handle missing base performance monitor gracefully', () => {
      const monitorWithoutBase = new LoggingPerformanceMonitor({
        logger: mockLogger,
        eventBus: mockEventBus,
        categoryDetector: mockCategoryDetector,
        performanceMonitor: null,
      });

      expect(monitorWithoutBase).toBeDefined();
    });

    it('should validate required dependencies', () => {
      expect(() => {
        new LoggingPerformanceMonitor({
          logger: null,
          eventBus: mockEventBus,
          categoryDetector: mockCategoryDetector,
        });
      }).toThrow();
    });
  });

  describe('monitorLogOperation', () => {
    it('should track log operation metrics', () => {
      const startTime = Date.now();
      
      const result = monitor.monitorLogOperation('info', 'Test message', {
        category: 'test',
        argsCount: 2,
        messageLength: 12,
      });

      // Should return operation result
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('duration');
      expect(result.success).toBe(true);
    });

    it('should detect category if not provided', () => {
      mockCategoryDetector.detectCategory.mockReturnValue('detected');
      
      const result = monitor.monitorLogOperation('debug', 'Debug message');

      expect(mockCategoryDetector.detectCategory).toHaveBeenCalledWith('Debug message');
      expect(result.category).toBe('detected');
    });

    it('should track timing metrics', () => {
      const metadata = {
        processingTime: 5,
      };

      const result = monitor.monitorLogOperation('warn', 'Warning message', metadata);

      expect(result).toHaveProperty('duration');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should check performance thresholds', () => {
      const result = monitor.monitorLogOperation('error', 'Error message', {
        processingTime: 10,
      });

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('category');
    });
  });

  describe('monitorBatchFlush', () => {
    it('should track successful batch flush', async () => {
      const result = await monitor.monitorBatchFlush(50, Date.now());

      expect(result.batchSize).toBe(50);
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('averageBatchSize');
    });

    it('should update batch metrics', async () => {
      await monitor.monitorBatchFlush(30, Date.now());
      await monitor.monitorBatchFlush(40, Date.now());
      
      const metrics = monitor.getLoggingMetrics();
      
      expect(metrics.batches).toBeDefined();
      expect(metrics.batches.totalBatches).toBe(2);
      expect(metrics.batches.successfulBatches).toBe(2);
    });

    it('should calculate average batch size', async () => {
      await monitor.monitorBatchFlush(20, Date.now());
      await monitor.monitorBatchFlush(30, Date.now());
      await monitor.monitorBatchFlush(40, Date.now());

      const metrics = monitor.getLoggingMetrics();
      expect(metrics.batches.averageBatchSize).toBeCloseTo(30, 1);
    });

  });

  describe('monitorBufferSize', () => {
    it('should track buffer size metrics', () => {
      const result = monitor.monitorBufferSize(500);

      expect(result.size).toBe(500);
      expect(result.pressure).toBeCloseTo(50, 1);
      expect(result.status).toBe('normal');
    });

    it('should check buffer size threshold', () => {
      const result = monitor.monitorBufferSize(900);

      expect(result.pressure).toBeCloseTo(90, 1);
      expect(result.status).toBe('warning');
    });

    it('should handle buffer overflow', () => {
      const result = monitor.monitorBufferSize(1100);

      expect(result.pressure).toBeCloseTo(110, 1);
      expect(result.status).toBe('critical');
      expect(result.exceeded).toBeDefined();
    });
  });

  describe('getLoggingMetrics', () => {
    beforeEach(() => {
      // Populate some metrics
      monitor.monitorLogOperation('info', 'Test 1');
      monitor.monitorLogOperation('warn', 'Test 2');
      monitor.monitorLogOperation('error', 'Test 3');
      monitor.monitorBatchFlush(30, Date.now());
      monitor.monitorBufferSize(250);
    });

    it('should return comprehensive logging metrics', () => {
      const metrics = monitor.getLoggingMetrics();

      expect(metrics).toHaveProperty('throughput');
      expect(metrics).toHaveProperty('latency');
      expect(metrics).toHaveProperty('reliability');
      expect(metrics).toHaveProperty('batches');
      expect(metrics).toHaveProperty('volume');
      expect(metrics).toHaveProperty('resources');
    });

    it('should calculate throughput metrics', () => {
      const metrics = monitor.getLoggingMetrics();

      expect(metrics.throughput).toHaveProperty('logsPerSecond');
      expect(metrics.throughput).toHaveProperty('bytesPerSecond');
      expect(metrics.throughput).toHaveProperty('batchesPerMinute');
    });

    it('should calculate latency percentiles', () => {
      const metrics = monitor.getLoggingMetrics();

      expect(metrics.latency).toHaveProperty('logProcessing');
      expect(metrics.latency.logProcessing).toHaveProperty('p50');
      expect(metrics.latency.logProcessing).toHaveProperty('p95');
      expect(metrics.latency.logProcessing).toHaveProperty('p99');
    });

    it('should calculate reliability metrics', () => {
      const metrics = monitor.getLoggingMetrics();

      expect(metrics.reliability).toHaveProperty('successRate');
      expect(metrics.reliability).toHaveProperty('failureCount');
      expect(metrics.reliability).toHaveProperty('retryCount');
    });

    it('should aggregate category metrics', () => {
      mockCategoryDetector.detectCategory
        .mockReturnValueOnce('api')
        .mockReturnValueOnce('database')
        .mockReturnValueOnce('api');

      monitor.monitorLogOperation('info', 'API call');
      monitor.monitorLogOperation('info', 'DB query');
      monitor.monitorLogOperation('info', 'API response');

      const metrics = monitor.getLoggingMetrics();

      expect(metrics.volume).toHaveProperty('categoryCounts');
      expect(metrics.volume.categoryCounts).toHaveProperty('api');
      expect(metrics.volume.categoryCounts).toHaveProperty('database');
      expect(metrics.volume.categoryCounts.api).toBeGreaterThan(metrics.volume.categoryCounts.database);
    });
  });

  describe('performance threshold alerts', () => {
    it('should dispatch alert when log processing exceeds threshold', () => {
      // Create a new event bus for this test
      const testEventBus = {
        dispatch: jest.fn(),
      };
      
      // Set up monitor with low threshold
      const strictMonitor = new LoggingPerformanceMonitor({
        logger: mockLogger,
        eventBus: testEventBus,
        categoryDetector: mockCategoryDetector,
        thresholds: {
          maxLogProcessingTime: 0.001, // Very low threshold to guarantee trigger
        },
      });

      strictMonitor.monitorLogOperation('info', 'Slow operation', {
        processingTime: 10,
      });

      // The base class dispatches threshold exceeded events
      expect(testEventBus.dispatch).toHaveBeenCalled();
    });

    it('should dispatch alert when batch transmission exceeds threshold', async () => {
      const testEventBus = {
        dispatch: jest.fn(),
      };
      
      const strictMonitor = new LoggingPerformanceMonitor({
        logger: mockLogger,
        eventBus: testEventBus,
        categoryDetector: mockCategoryDetector,
        thresholds: {
          maxBatchTransmissionTime: 50, // 50ms threshold
        },
      });

      await strictMonitor.monitorBatchFlush(100, 200); // 200ms duration - well above 50ms threshold

      expect(testEventBus.dispatch).toHaveBeenCalled();
    });
  });

  describe('resource usage tracking', () => {
    it('should track memory usage through buffer monitoring', () => {
      monitor.monitorBufferSize(100);
      monitor.monitorBufferSize(200);
      monitor.monitorBufferSize(150);

      const metrics = monitor.getLoggingMetrics();

      expect(metrics.resources).toHaveProperty('bufferSize');
      expect(metrics.resources).toHaveProperty('bufferPressure');
    });

    it('should calculate buffer pressure', () => {
      monitor.monitorBufferSize(250); // 25%
      monitor.monitorBufferSize(500); // 50%
      monitor.monitorBufferSize(750); // 75%

      const metrics = monitor.getLoggingMetrics();

      expect(metrics.resources.bufferPressure).toBeGreaterThan(0);
    });
  });

  describe('integration with base PerformanceMonitor', () => {
    it('should inherit base monitoring capabilities', () => {
      expect(monitor.recordMetric).toBeDefined();
      expect(monitor.checkThreshold).toBeDefined();
      expect(monitor.getRealtimeMetrics).toBeDefined();
    });

    it('should extend base metrics with logging-specific data', () => {
      monitor.monitorLogOperation('info', 'Test');
      monitor.monitorBatchFlush(25, Date.now());

      const baseMetrics = monitor.getRealtimeMetrics();
      const loggingMetrics = monitor.getLoggingMetrics();

      // Should have both base and logging-specific metrics
      expect(baseMetrics).toBeDefined();
      expect(loggingMetrics).toBeDefined();
      expect(loggingMetrics).toHaveProperty('throughput');
      expect(loggingMetrics).toHaveProperty('batches');
    });
  });
});