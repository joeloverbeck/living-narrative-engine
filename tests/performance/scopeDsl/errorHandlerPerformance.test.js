/**
 * @file Performance tests for ScopeDslErrorHandler
 * @description Tests the performance characteristics of error handling operations
 *
 * IMPORTANT: ScopeDslErrorHandler.handleError() ALWAYS throws a ScopeDslError.
 * These tests measure the complete error processing pipeline including:
 * - Error info creation and categorization
 * - Context sanitization
 * - Buffer management
 * - Environment-appropriate logging
 * - Exception creation and throwing
 *
 * Performance Targets (CI Environment):
 * - Complete error processing: <1ms per error (basic context)
 * - Complex context processing: <2ms per error (deep objects, large arrays)
 * - Buffer clearing: minimal overhead even with repeated operations
 * - Buffer management: efficient memory usage with bounded buffer size
 * - Scaling: Linear performance characteristics with consistent time per operation
 *
 * Note: Thresholds are adjusted for CI environments where performance can vary
 * due to resource contention and lack of JIT optimization warmup.
 */

import { jest } from '@jest/globals';
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
} from '@jest/globals';
import ScopeDslErrorHandler from '../../../src/scopeDsl/core/scopeDslErrorHandler.js';
import { ScopeDslError } from '../../../src/scopeDsl/errors/scopeDslError.js';
import { performance } from 'perf_hooks';
import { createUltraLightContainer } from '../../common/testing/ultraLightContainer.js';

// Set reasonable timeout for performance tests
jest.setTimeout(30000);

describe('ScopeDslErrorHandler Performance', () => {
  let errorHandler;
  let mockLogger;

  // Performance tracking
  const performanceMetrics = {
    errorHandlingTimes: [],
    bufferClearingTimes: [],
  };

  beforeAll(() => {
    // Create ultra-light container for maximum performance
    createUltraLightContainer();
  });

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    errorHandler = new ScopeDslErrorHandler({ logger: mockLogger });
  });

  afterEach(() => {
    errorHandler.clearErrorBuffer();
    jest.clearAllMocks();
  });

  describe('Error Handling Performance', () => {
    it('should provide granular performance breakdown', () => {
      const iterations = 100;
      const measurements = {
        total: [],
        bufferSizes: [],
      };
      let allErrorsValid = true;

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        try {
          errorHandler.handleError(
            new Error(`Granular test error ${i}`),
            { depth: i % 5, iteration: i },
            'granularTestResolver'
          );
        } catch (e) {
          // Expected - measure total processing time
          const totalTime = performance.now() - start;
          measurements.total.push(totalTime);

          // Track buffer growth
          measurements.bufferSizes.push(errorHandler.getErrorBuffer().length);

          // Track if error is of expected type
          const isExpectedError =
            e instanceof ScopeDslError ||
            e.constructor.name === 'ScopeDslError';
          allErrorsValid = allErrorsValid && isExpectedError;
        }
      }

      // Verify all errors were of expected type
      expect(allErrorsValid).toBe(true);

      // Analyze measurements
      const avgTotal =
        measurements.total.reduce((a, b) => a + b, 0) /
        measurements.total.length;
      const maxTotal = Math.max(...measurements.total);
      const minTotal = Math.min(...measurements.total);

      // Performance assertions (relaxed for CI environment and first-run JIT effects)
      expect(avgTotal).toBeLessThan(2.0); // Average under 2ms (CI tolerance)
      expect(maxTotal).toBeLessThan(50.0); // Worst case under 50ms (CI tolerance, accounts for JIT warmup)

      // Buffer should grow to expected size
      expect(Math.max(...measurements.bufferSizes)).toBe(
        Math.min(iterations, 100)
      );

      // Verify performance consistency (variance shouldn't be excessive)
      const variance = maxTotal - minTotal;
      expect(variance).toBeLessThan(45.0); // Max 45ms variance (CI tolerance for JIT effects)
    });

    it('should handle errors efficiently', () => {
      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        try {
          errorHandler.handleError(
            new Error(`Performance test error ${i}`),
            { depth: 0 },
            'testResolver'
          );
        } catch {
          // Expected error - handleError always throws
        }
      }

      const duration = performance.now() - start;
      const avgTimePerError = duration / iterations;

      // Log performance metrics
      performanceMetrics.errorHandlingTimes.push(avgTimePerError);

      // Performance assertion: Complete error processing including exception throwing
      // Should complete 1000 operations in reasonable time for CI environment
      expect(duration).toBeLessThan(2000); // <2ms per error for 1000 iterations (CI tolerance)
      expect(avgTimePerError).toBeLessThan(2.0); // Account for full processing pipeline

      // Verify buffer management
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer.length).toBeLessThanOrEqual(100); // Default max buffer size
    });

    it('should handle errors with complex context efficiently', () => {
      const iterations = 500;
      const complexContext = {
        depth: 5,
        path: ['root', 'child1', 'child2', 'child3', 'child4', 'child5'],
        entityCount: 1000,
        metadata: {
          timestamp: Date.now(),
          source: 'performance-test',
          additionalData: Array(100).fill('test-data'),
        },
      };

      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        try {
          errorHandler.handleError(
            new Error(`Complex context error ${i}`),
            complexContext,
            'complexResolver',
            `SCOPE_${1000 + i}`
          );
        } catch {
          // Expected error - handleError always throws
        }
      }

      const duration = performance.now() - start;
      const avgTimePerError = duration / iterations;

      // Complex context processing should still be reasonable
      expect(avgTimePerError).toBeLessThan(3.0); // Allow more time for complex context processing in CI
      expect(duration).toBeLessThan(1500); // <3ms per error for 500 iterations with complex context
    });

    it('should clear error buffer efficiently', () => {
      const iterations = 100;
      const clearingTimes = [];

      for (let i = 0; i < iterations; i++) {
        // Add some errors to the buffer
        for (let j = 0; j < 10; j++) {
          try {
            errorHandler.handleError(
              new Error(`Test error ${j}`),
              { depth: 0 },
              'testResolver'
            );
          } catch {
            // Expected error - handleError always throws
          }
        }

        // Measure clearing time
        const clearStart = performance.now();
        errorHandler.clearErrorBuffer();
        const clearDuration = performance.now() - clearStart;

        clearingTimes.push(clearDuration);
      }

      const avgClearTime =
        clearingTimes.reduce((a, b) => a + b, 0) / clearingTimes.length;
      const maxClearTime = Math.max(...clearingTimes);

      // Buffer clearing should be very fast
      expect(avgClearTime).toBeLessThan(0.1); // <0.1ms average
      expect(maxClearTime).toBeLessThan(1); // <1ms worst case

      // Verify buffer is actually cleared
      expect(errorHandler.getErrorBuffer()).toHaveLength(0);
    });
  });

  describe('Buffer Management Performance', () => {
    it('should maintain buffer size limit efficiently', () => {
      const maxBufferSize = 100;
      const totalErrors = maxBufferSize + 50; // Generate more than max

      const start = performance.now();

      // Generate more than max buffer size errors
      for (let i = 0; i < totalErrors; i++) {
        try {
          errorHandler.handleError(
            new Error(`Buffer test error ${i}`),
            { depth: 0 },
            'testResolver'
          );
        } catch {
          // Expected error - handleError always throws
        }
      }

      const duration = performance.now() - start;

      // Verify buffer size is maintained
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer.length).toBeLessThanOrEqual(maxBufferSize);

      // Performance should not degrade significantly with buffer management
      const avgTimePerError = duration / totalErrors;
      expect(avgTimePerError).toBeLessThan(2.0); // Still efficient with buffer management (CI tolerance)
    });

    it('should handle concurrent error generation efficiently', () => {
      const concurrentOperations = 10;
      const errorsPerOperation = 100;
      const promises = [];

      const start = performance.now();

      // Simulate concurrent error generation
      for (let op = 0; op < concurrentOperations; op++) {
        const promise = new Promise((resolve) => {
          setTimeout(() => {
            for (let i = 0; i < errorsPerOperation; i++) {
              try {
                errorHandler.handleError(
                  new Error(`Concurrent error op${op}-${i}`),
                  { depth: op, concurrent: true },
                  'concurrentResolver'
                );
              } catch {
                // Expected error - handleError always throws
              }
            }
            resolve();
          }, 0);
        });
        promises.push(promise);
      }

      return Promise.all(promises).then(() => {
        const duration = performance.now() - start;
        const totalErrors = concurrentOperations * errorsPerOperation;
        const avgTimePerError = duration / totalErrors;

        // Should handle concurrent operations reasonably
        expect(avgTimePerError).toBeLessThan(1.0); // Allow for concurrent processing overhead
        expect(duration).toBeLessThan(1000); // <1s for all concurrent operations (CI tolerance)

        // Buffer should still be managed correctly
        const buffer = errorHandler.getErrorBuffer();
        expect(buffer.length).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Performance Scaling', () => {
    it('should scale linearly with error count', () => {
      const testSizes = [100, 500, 1000, 2000];
      const timings = [];

      for (const size of testSizes) {
        const start = performance.now();

        for (let i = 0; i < size; i++) {
          try {
            errorHandler.handleError(
              new Error(`Scaling test error ${i}`),
              { depth: 0 },
              'scalingResolver'
            );
          } catch {
            // Expected error - handleError always throws
          }
        }

        const duration = performance.now() - start;
        timings.push({ size, duration, avgTime: duration / size });

        // Clear buffer for next test
        errorHandler.clearErrorBuffer();
      }

      // Verify linear scaling (time per error should be consistent)
      const avgTimes = timings.map((t) => t.avgTime);
      const minAvgTime = Math.min(...avgTimes);
      const maxAvgTime = Math.max(...avgTimes);

      // Average time per error should not vary excessively
      const variance = maxAvgTime - minAvgTime;
      expect(variance).toBeLessThan(1.0); // <1ms variance in average time (CI tolerance)

      // All sizes should maintain reasonable performance
      for (const timing of timings) {
        expect(timing.avgTime).toBeLessThan(2.5); // <2.5ms per error at any scale (CI tolerance)
      }
    });
  });

  describe('Production vs Development Mode Performance', () => {
    it('should perform faster in production mode than development mode', () => {
      const iterations = 1000;

      // Create production mode handler
      const prodHandler = new ScopeDslErrorHandler({
        logger: mockLogger,
        config: { isDevelopment: false },
      });

      // Create development mode handler
      const devHandler = new ScopeDslErrorHandler({
        logger: mockLogger,
        config: { isDevelopment: true },
      });

      // Measure production mode performance
      const prodStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        try {
          prodHandler.handleError(
            new Error(`Production error ${i}`),
            { depth: 0 },
            'prodResolver'
          );
        } catch {
          // Expected error - handleError always throws
        }
      }
      const prodDuration = performance.now() - prodStart;
      const prodAvgTime = prodDuration / iterations;

      // Clear production buffer
      prodHandler.clearErrorBuffer();

      // Measure development mode performance
      const devStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        try {
          devHandler.handleError(
            new Error(`Development error ${i}`),
            { depth: 0 },
            'devResolver'
          );
        } catch {
          // Expected error - handleError always throws
        }
      }
      const devDuration = performance.now() - devStart;
      const devAvgTime = devDuration / iterations;

      // Clear development buffer
      devHandler.clearErrorBuffer();

      // Production should be faster than development (or at least comparable in test env)
      // In test environments, the difference may be minimal or even reversed due to JIT optimization
      // We allow a tolerance for CI variability
      expect(prodAvgTime).toBeLessThan(devAvgTime * 1.2); // Allow 20% tolerance for CI

      // Absolute performance targets (account for complete error processing pipeline)
      expect(prodAvgTime).toBeLessThan(1.5); // Production: <1.5ms complete processing
      expect(devAvgTime).toBeLessThan(3.0); // Development: <3ms with additional logging
    });

    it('should minimize logging overhead in production', () => {
      const iterations = 500;
      const complexContext = {
        depth: 5,
        entities: Array(100).fill({ id: 'entity', data: 'test' }),
        metadata: {
          timestamp: Date.now(),
          source: 'performance-test',
        },
      };

      // Production handler
      const prodHandler = new ScopeDslErrorHandler({
        logger: mockLogger,
        config: { isDevelopment: false },
      });

      // Development handler
      const devHandler = new ScopeDslErrorHandler({
        logger: mockLogger,
        config: { isDevelopment: true },
      });

      // Reset mock counts
      jest.clearAllMocks();

      // Test production mode logging
      for (let i = 0; i < iterations; i++) {
        try {
          prodHandler.handleError(
            new Error(`Production complex ${i}`),
            complexContext,
            'prodComplexResolver'
          );
        } catch {
          // Expected - handleError always throws
        }
      }

      const prodLogCount = mockLogger.error.mock.calls.length;

      // Reset mocks
      jest.clearAllMocks();

      // Test development mode logging
      for (let i = 0; i < iterations; i++) {
        try {
          devHandler.handleError(
            new Error(`Development complex ${i}`),
            complexContext,
            'devComplexResolver'
          );
        } catch {
          // Expected - handleError always throws
        }
      }

      const devLogCount = mockLogger.error.mock.calls.length;

      // Production should log less verbosely
      expect(prodLogCount).toBeLessThanOrEqual(devLogCount);
      expect(mockLogger.debug).not.toHaveBeenCalled(); // No debug logs in production
    });
  });

  describe('High Load Performance', () => {
    it('should handle high error rates efficiently', async () => {
      const errorsPerSecond = 1000;
      const testDuration = 3000; // 3 seconds
      const minSuccessRate = 0.9; // 90% success rate

      let errorCount = 0;
      let successCount = 0;
      const startTime = performance.now();

      // Generate errors at specified rate
      while (performance.now() - startTime < testDuration) {
        const batchStart = performance.now();
        const batchSize = Math.floor(errorsPerSecond / 100); // 10ms batches

        for (let i = 0; i < batchSize; i++) {
          errorCount++;
          try {
            errorHandler.handleError(
              new Error(`Load test error ${errorCount}`),
              { depth: 0 },
              'loadTestResolver'
            );
            // This will never be reached since handleError always throws
          } catch (e) {
            // Expected - handleError always throws ScopeDslError
            // Count every exception as a successful error handling operation
            if (
              e instanceof ScopeDslError ||
              e.constructor.name === 'ScopeDslError'
            ) {
              successCount++;
            }
          }
        }

        // Pace the batches (approximately 10ms intervals)
        const batchDuration = performance.now() - batchStart;
        if (batchDuration < 10) {
          await new Promise((resolve) =>
            setTimeout(resolve, 10 - batchDuration)
          );
        }
      }

      const actualDuration = performance.now() - startTime;
      const actualErrorRate = errorCount / (actualDuration / 1000);
      const successRate = successCount / errorCount;

      // Verify performance under load
      expect(successRate).toBeGreaterThan(minSuccessRate);
      expect(actualErrorRate).toBeGreaterThan(errorsPerSecond * 0.8); // Within 20% of target rate

      // Verify buffer didn't cause memory issues
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer.length).toBeLessThanOrEqual(100); // Buffer properly maintained
    });

    it('should maintain performance during sustained load', async () => {
      const windows = [];
      const windowCount = 6; // 3 seconds total
      const targetErrors = 500; // Fixed number of errors per window

      for (let w = 0; w < windowCount; w++) {
        const windowStart = performance.now();
        let windowErrors = 0;

        // Generate errors for this window with a target count instead of time-based
        for (let i = 0; i < targetErrors; i++) {
          try {
            errorHandler.handleError(
              new Error(`Window ${w} error ${i}`),
              { depth: w },
              'sustainedLoadResolver'
            );
            // This will never be reached since handleError always throws
          } catch (e) {
            // Expected - handleError always throws ScopeDslError
            // Count every exception as a successful error handling operation
            if (
              e instanceof ScopeDslError ||
              e.constructor.name === 'ScopeDslError'
            ) {
              windowErrors++;
            }
          }

          // Small delay to prevent CPU saturation and simulate sustained load
          if (i % 100 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 1));
          }
        }

        const windowDuration = performance.now() - windowStart;
        const windowRate = windowErrors / (windowDuration / 1000);

        windows.push({
          window: w,
          errors: windowErrors,
          duration: windowDuration,
          rate: windowRate,
        });

        // Clear buffer between windows
        errorHandler.clearErrorBuffer();
      }

      // Analyze performance stability
      const rates = windows.map((w) => w.rate);
      const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
      const minRate = Math.min(...rates);
      const maxRate = Math.max(...rates);

      // Performance should be stable across windows
      const rateVariance = avgRate > 0 ? (maxRate - minRate) / avgRate : 0;
      // Use environment-aware thresholds to account for CI variability
      const isCI =
        typeof process !== 'undefined' &&
        (process.env.CI === 'true' || process.env.NODE_ENV === 'test');
      const varianceThreshold = isCI ? 1.5 : 1.0; // More lenient for CI environments
      expect(rateVariance).toBeLessThan(varianceThreshold); // CI: <150% variance, Local: <100% variance

      // All windows should have processed errors
      expect(windows.length).toBe(windowCount);
      for (const window of windows) {
        expect(window.errors).toBe(targetErrors);
        expect(window.rate).toBeGreaterThan(50); // >50 errors/second minimum (very relaxed for CI)
      }
    });
  });
});
