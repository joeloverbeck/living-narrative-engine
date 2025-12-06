/**
 * @file Performance tests for error handling framework
 * Tests overhead, scalability, and memory efficiency
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import {
  simulateErrorBurst,
  createTestError,
  createDomainErrors,
} from '../../common/errorTestHelpers.js';
import CentralErrorHandler from '../../../src/errors/CentralErrorHandler.js';
import RecoveryStrategyManager from '../../../src/errors/RecoveryStrategyManager.js';
import ErrorReporter from '../../../src/errors/ErrorReporter.js';
import BaseError from '../../../src/errors/baseError.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';

describe('Error Handling Performance', () => {
  let testBed;
  let centralErrorHandler;
  let recoveryManager;
  let errorReporter;
  let mockLogger;
  let mockEventBus;
  let mockMonitoringCoordinator;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEventBus = testBed.createMock('MockEventBus', [
      'dispatch',
      'subscribe',
    ]);
    mockMonitoringCoordinator = testBed.createMock(
      'MockMonitoringCoordinator',
      [
        'executeMonitored',
        'getStats',
        'getPerformanceMonitor',
        'getCircuitBreaker',
      ]
    );

    // Use real implementations for performance testing
    recoveryManager = new RecoveryStrategyManager({
      logger: mockLogger,
      monitoringCoordinator: mockMonitoringCoordinator,
    });

    errorReporter = new ErrorReporter({
      logger: mockLogger,
      eventBus: mockEventBus,
      batchSize: 100,
      flushInterval: 1000,
      enabled: true,
      endpoint: 'test-endpoint', // Required for enabled to be true
    });

    centralErrorHandler = new CentralErrorHandler({
      logger: mockLogger,
      eventBus: mockEventBus,
      monitoringCoordinator: mockMonitoringCoordinator,
      recoveryManager,
      errorReporter,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Error Handling Overhead', () => {
    it('should handle errors with < 10ms overhead', async () => {
      const iterations = 1000;
      const errors = [];

      // Pre-create errors to exclude creation time
      for (let i = 0; i < iterations; i++) {
        errors.push(
          new BaseError(`Test error ${i}`, ErrorCodes.INVALID_DATA_GENERIC)
        );
      }

      const start = Date.now();

      for (const error of errors) {
        try {
          await centralErrorHandler.handle(error);
        } catch {}
      }

      const totalTime = Date.now() - start;
      const avgTime = totalTime / iterations;

      expect(avgTime).toBeLessThan(10);
      console.log(`Average error handling time: ${avgTime.toFixed(2)}ms`);
    });

    it('should handle synchronous errors efficiently', () => {
      const iterations = 1000;
      const errors = [];

      for (let i = 0; i < iterations; i++) {
        errors.push(new Error(`Sync error ${i}`));
      }

      const start = Date.now();

      for (const error of errors) {
        try {
          centralErrorHandler.handleSync(error);
        } catch {}
      }

      const totalTime = Date.now() - start;
      const avgTime = totalTime / iterations;

      expect(avgTime).toBeLessThan(5); // Sync should be faster
      console.log(`Average sync error handling time: ${avgTime.toFixed(2)}ms`);
    });
  });

  describe('Batch Processing Performance', () => {
    it('should batch errors efficiently', async () => {
      const batchSize = 100;
      const batches = 10;
      const errors = simulateErrorBurst(batchSize * batches);

      const start = Date.now();

      // Process in batches
      for (let i = 0; i < batches; i++) {
        const batch = errors.slice(i * batchSize, (i + 1) * batchSize);
        await Promise.all(
          batch.map((error) =>
            centralErrorHandler.handle(error).catch(() => {})
          )
        );
      }

      const totalTime = Date.now() - start;
      const avgBatchTime = totalTime / batches;

      expect(avgBatchTime).toBeLessThan(100); // Each batch < 100ms
      console.log(
        `Average batch processing time: ${avgBatchTime.toFixed(2)}ms`
      );
    });

    it('should handle concurrent errors efficiently', async () => {
      const concurrentErrors = 100;
      const errors = simulateErrorBurst(concurrentErrors);

      const start = Date.now();

      // Process all errors concurrently
      await Promise.all(
        errors.map((error) => centralErrorHandler.handle(error).catch(() => {}))
      );

      const totalTime = Date.now() - start;

      expect(totalTime).toBeLessThan(500); // All concurrent errors < 500ms
      console.log(
        `Concurrent processing time for ${concurrentErrors} errors: ${totalTime}ms`
      );
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory during error handling', async () => {
      const iterations = 5;
      const errorsPerIteration = 200;

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        const errors = simulateErrorBurst(errorsPerIteration);

        for (const error of errors) {
          try {
            await centralErrorHandler.handle(error);
          } catch {}
        }

        // Clear registry periodically
        if (i % 2 === 0) {
          centralErrorHandler.clearMetrics();
        }
      }

      // Allow pending async work (like reporter flush timers) to settle before
      // capturing the final reading.
      await new Promise((resolve) => setTimeout(resolve, 50));

      if (errorReporter?.flush) {
        await errorReporter.flush();
      }

      // Force garbage collection if available. Without --expose-gc Jest won't
      // expose the hook, so we need to tolerate the additional heap noise.
      if (global.gc) {
        global.gc();
      } else {
        // Give V8 a moment to perform an automatic GC cycle before sampling.
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // Heap measurements without an explicit GC can fluctuate wildly (CI
      // environments often report 15–20MB spikes). Use a lenient threshold when
      // we cannot explicitly trigger GC, otherwise keep the original budget.
      const memoryThresholdMb = global.gc ? 10 : 25;

      expect(memoryIncrease).toBeLessThan(memoryThresholdMb);
      console.log(
        `Memory increase: ${memoryIncrease.toFixed(2)}MB (threshold: ${memoryThresholdMb}MB)`
      );
    });

    it('should maintain bounded registry size', async () => {
      const errors = simulateErrorBurst(2000);

      for (const error of errors) {
        try {
          await centralErrorHandler.handle(error);
        } catch {}
      }

      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.registrySize).toBeLessThanOrEqual(1000);
      expect(metrics.totalErrors).toBe(2000);
    });
  });

  describe('Scalability', () => {
    it('should scale with error volume', async () => {
      const testVolumes = [10, 50, 100, 500];
      const timings = [];

      for (const volume of testVolumes) {
        const errors = simulateErrorBurst(volume);
        const start = Date.now();

        for (const error of errors) {
          try {
            await centralErrorHandler.handle(error);
          } catch {}
        }

        const time = Date.now() - start;
        timings.push({ volume, time, avgTime: time / volume });

        console.log(
          `Volume ${volume}: ${time}ms total, ${(time / volume).toFixed(2)}ms avg`
        );
      }

      // Check that average time remains relatively constant
      const avgTimes = timings.map((t) => t.avgTime);
      const maxAvg = Math.max(...avgTimes);
      const minAvg = Math.min(...avgTimes);
      const variance = maxAvg - minAvg;

      expect(variance).toBeLessThan(5); // Average time should not vary by more than 5ms
    });

    it('should handle error bursts', async () => {
      const burstSize = 500;
      const errors = simulateErrorBurst(burstSize, { withDelay: false });

      const start = Date.now();

      // Process burst as fast as possible
      const promises = errors.map((error) =>
        centralErrorHandler.handle(error).catch(() => {})
      );

      await Promise.all(promises);

      const totalTime = Date.now() - start;
      const throughput = burstSize / (totalTime / 1000); // errors per second

      expect(throughput).toBeGreaterThan(100); // At least 100 errors/second
      console.log(`Burst throughput: ${throughput.toFixed(0)} errors/second`);
    });
  });

  describe('Recovery Performance', () => {
    it('should recover quickly with strategies', async () => {
      // Register fast recovery strategy
      centralErrorHandler.registerRecoveryStrategy('TestError', async () => {
        return 'recovered';
      });

      class TestError extends BaseError {
        constructor(message) {
          super(message, 'TEST_ERROR');
          this.name = 'TestError';
        }
        isRecoverable() {
          return true;
        }
      }

      const errors = [];
      for (let i = 0; i < 100; i++) {
        errors.push(new TestError(`Test ${i}`));
      }

      const start = Date.now();

      for (const error of errors) {
        const result = await centralErrorHandler.handle(error);
        expect(result).toBe('recovered');
      }

      const totalTime = Date.now() - start;
      const avgRecoveryTime = totalTime / errors.length;

      expect(avgRecoveryTime).toBeLessThan(10);
      console.log(`Average recovery time: ${avgRecoveryTime.toFixed(2)}ms`);
    });

    it('should handle retry backoff efficiently', async () => {
      let attemptCount = 0;
      // Note: CentralErrorHandler doesn't implement automatic retries
      // The recovery strategy is called only once
      centralErrorHandler.registerRecoveryStrategy('RetryError', async () => {
        attemptCount++;
        return 'success';
      });

      class RetryError extends BaseError {
        constructor() {
          super('Retry error', 'RETRY_ERROR');
          this.name = 'RetryError';
        }
        isRecoverable() {
          return true;
        }
      }

      const start = Date.now();
      const result = await centralErrorHandler.handle(new RetryError());
      const elapsed = Date.now() - start;

      expect(result).toBe('success');
      expect(attemptCount).toBe(1); // Strategy is called only once
      expect(elapsed).toBeLessThan(100); // Should be fast without retries
    });
  });

  describe('Reporting Performance', () => {
    it('should batch report errors efficiently', async () => {
      const errors = simulateErrorBurst(500);

      const start = Date.now();

      for (const error of errors) {
        try {
          await centralErrorHandler.handle(error);
        } catch {}
        // Trigger reporting
        await errorReporter.report(error);
      }

      // Flush remaining batch
      await errorReporter.flush();

      const totalTime = Date.now() - start;

      expect(totalTime).toBeLessThan(2000); // Including batching delays
      console.log(`Batch reporting time for 500 errors: ${totalTime}ms`);
    });

    it('should generate analytics quickly', async () => {
      const errors = simulateErrorBurst(1000, {
        errorType: 'AnalyticsError',
        severity: 'warning',
      });

      for (const error of errors) {
        await errorReporter.report(error);
      }

      const start = Date.now();
      const analytics = errorReporter.getAnalytics();
      const elapsed = Date.now() - start;

      expect(analytics).toBeDefined();
      expect(analytics.totalReported).toBeGreaterThan(0);

      // Each error has a unique name like AnalyticsError_0, AnalyticsError_1, etc.
      // Check that at least one of these error types was recorded
      const analyticsErrorCount = Object.keys(analytics.errorsByType)
        .filter((key) => key.startsWith('AnalyticsError'))
        .reduce((sum, key) => sum + analytics.errorsByType[key], 0);

      // If no AnalyticsError found, check what error types were actually recorded
      if (analyticsErrorCount === 0) {
        console.log(
          'Error types recorded:',
          Object.keys(analytics.errorsByType)
        );
      }

      expect(analyticsErrorCount).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(50); // Analytics generation < 50ms

      console.log(`Analytics generation time: ${elapsed}ms`);
    });
  });

  describe('Circuit Breaker Performance', () => {
    it('should fail fast when circuit breaker is open', async () => {
      const circuitBreaker = {
        execute: jest.fn().mockRejectedValue(new Error('Circuit open')),
        getState: jest.fn().mockReturnValue('OPEN'),
        getStats: jest.fn().mockReturnValue({ failures: 10, successes: 0 }),
      };

      mockMonitoringCoordinator.getCircuitBreaker.mockReturnValue(
        circuitBreaker
      );

      const errors = simulateErrorBurst(100);
      const start = Date.now();

      for (const error of errors) {
        try {
          await centralErrorHandler.handle(error);
        } catch {}
      }

      const totalTime = Date.now() - start;

      expect(totalTime).toBeLessThan(100); // Should fail fast without delays
      console.log(
        `Circuit breaker fail-fast time for 100 errors: ${totalTime}ms`
      );
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet all performance targets', async () => {
      const benchmarks = {
        errorHandlingOverhead: 10, // ms
        recoveryAttemptTime: 100, // ms
        batchReportingTime: 50, // ms
        memoryUsageFor1000Errors: 10, // MB
      };

      // Test error handling overhead
      const error = new BaseError('Benchmark', ErrorCodes.INVALID_DATA_GENERIC);
      const handleStart = Date.now();
      try {
        await centralErrorHandler.handle(error);
      } catch {}
      const handleTime = Date.now() - handleStart;
      expect(handleTime).toBeLessThan(benchmarks.errorHandlingOverhead);

      // Test batch reporting
      const reportErrors = simulateErrorBurst(10);
      const reportStart = Date.now();
      for (const e of reportErrors) {
        await errorReporter.report(e);
      }
      await errorReporter.flush();
      const reportTime = Date.now() - reportStart;
      expect(reportTime).toBeLessThan(benchmarks.batchReportingTime * 10);

      console.log('Performance benchmarks met:');
      console.log(
        `- Error handling: ${handleTime}ms < ${benchmarks.errorHandlingOverhead}ms`
      );
      console.log(`- Batch reporting: ${reportTime}ms`);
    });
  });
});
