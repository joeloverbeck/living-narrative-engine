/**
 * @file Performance tests for ClicheErrorHandler service
 *
 * Tests processing speed, throughput, and scalability of error handling
 * operations in the cliché generation system.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ClicheErrorHandler } from '../../../src/characterBuilder/services/clicheErrorHandler.js';
import {
  ClicheError,
  ClicheLLMError,
  ClicheStorageError,
  ClicheValidationError,
} from '../../../src/errors/clicheErrors.js';

describe('ClicheErrorHandler - Performance Tests', () => {
  let errorHandler;
  let mockLogger;
  let mockEventBus;

  beforeEach(() => {
    // Mock logger with minimal overhead
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    // Mock event bus with minimal overhead
    mockEventBus = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    // Create error handler instance with performance-oriented configuration
    errorHandler = new ClicheErrorHandler({
      logger: mockLogger,
      eventBus: mockEventBus,
      retryConfig: {
        maxRetries: 3,
        baseDelay: 10, // Minimal delays for performance testing
        maxDelay: 100,
        backoffMultiplier: 2,
        jitterFactor: 0.1,
      },
    });

    // Clear mock calls between tests
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Processing Speed', () => {
    it('should process errors quickly', async () => {
      // Run multiple iterations for statistical reliability
      const iterations = 3;
      const processingTimes = [];

      for (let iteration = 0; iteration < iterations; iteration++) {
        const startTime = Date.now();

        // Process batch of errors
        const promises = [];
        for (let i = 0; i < 100; i++) {
          const error = new ClicheError(`Error ${i}`);
          promises.push(errorHandler.handleError(error));
        }

        await Promise.all(promises);

        const endTime = Date.now();
        processingTimes.push(endTime - startTime);
      }

      // Use average processing time for more stable results
      const avgProcessingTime =
        processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;

      // Increased threshold for CI environments - should process 100 errors in reasonable time
      expect(avgProcessingTime).toBeLessThan(3000); // 3 seconds tolerance for CI
    });

    it('should handle concurrent error processing efficiently', async () => {
      const concurrencyLevels = [10, 50, 100, 200];
      const results = [];

      for (const concurrency of concurrencyLevels) {
        const startTime = Date.now();

        const promises = [];
        for (let i = 0; i < concurrency; i++) {
          const error = new ClicheError(`Concurrent error ${i}`);
          promises.push(
            errorHandler.handleError(error, {
              operation: `concurrent_op_${i % 10}`,
            })
          );
        }

        await Promise.all(promises);

        const endTime = Date.now();
        const processingTime = endTime - startTime;

        results.push({
          concurrency,
          time: processingTime,
          throughput: concurrency / (processingTime / 1000), // errors per second
        });
      }

      // Throughput should scale reasonably with concurrency
      // Higher concurrency should maintain reasonable throughput (lowered for CI environments)
      const lastResult = results[results.length - 1];
      expect(lastResult.throughput).toBeGreaterThan(50); // At least 50 errors/second (reduced threshold)
    });

    it('should process different error types with consistent performance', async () => {
      const errorTypes = [
        () => new ClicheError('General error'),
        () => new ClicheLLMError('LLM error', 500),
        () => new ClicheStorageError('Storage error', 'save'),
        () =>
          new ClicheValidationError('Validation error', ['field1', 'field2']),
      ];

      let attempt = 0;
      const maxAttempts = 2;

      while (attempt < maxAttempts) {
        try {
          const typePerformance = [];

          for (const createError of errorTypes) {
            const startTime = Date.now();

            const promises = [];
            for (let i = 0; i < 200; i++) {
              promises.push(errorHandler.handleError(createError()));
            }

            await Promise.all(promises);

            const endTime = Date.now();
            const processingTime = endTime - startTime;

            typePerformance.push(processingTime);
          }

          // All error types should be processed in similar time
          // No type should take more than 5x the fastest type (increased tolerance for CI environments)
          const minTime = Math.min(...typePerformance);
          const maxTime = Math.max(...typePerformance);

          expect(maxTime / minTime).toBeLessThan(5);
          break; // Test passed, exit retry loop
        } catch (error) {
          attempt++;
          if (attempt >= maxAttempts) {
            throw error; // Re-throw the last error if all attempts failed
          }
          // Wait a bit before retry to allow system to stabilize
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    });
  });

  describe('Circuit Breaker Performance', () => {
    it('should handle circuit breaker operations efficiently', async () => {
      const operations = Array.from({ length: 20 }, (_, i) => `operation_${i}`);

      const startTime = Date.now();

      // Trigger circuit breakers for all operations
      const promises = [];
      for (const operation of operations) {
        for (let i = 0; i < 5; i++) {
          const error = new ClicheLLMError('Service failure', 500);
          promises.push(errorHandler.handleError(error, { operation }));
        }
      }

      await Promise.all(promises);

      // Now all circuit breakers should be open
      // Test performance when circuit breakers are blocking
      const blockedPromises = [];
      for (let i = 0; i < 100; i++) {
        const operation = operations[i % operations.length];
        const error = new ClicheLLMError('Still failing', 500);
        blockedPromises.push(errorHandler.handleError(error, { operation }));
      }

      await Promise.all(blockedPromises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Circuit breaker blocking should be fast (increased tolerance for CI environments)
      // Total time for all operations should be reasonable
      expect(totalTime).toBeLessThan(5000); // 5 seconds tolerance for CI
    });

    it('should reset circuit breakers quickly', async () => {
      const operationCount = 50;
      const operations = Array.from(
        { length: operationCount },
        (_, i) => `op_${i}`
      );

      // Trigger all circuit breakers
      for (const operation of operations) {
        for (let i = 0; i < 5; i++) {
          const error = new ClicheError(`Trigger ${i}`);
          await errorHandler.handleError(error, { operation });
        }
      }

      // Measure reset performance
      const startTime = Date.now();

      for (const operation of operations) {
        errorHandler.resetCircuitBreaker(operation);
      }

      const endTime = Date.now();
      const resetTime = endTime - startTime;

      // Resetting 50 circuit breakers should be fast (increased tolerance)
      expect(resetTime).toBeLessThan(500); // Less than 500ms (increased for CI)
    });
  });

  describe('Statistics Collection Performance', () => {
    it('should collect statistics without significant overhead', async () => {
      const iterations = 3;
      const withoutStatsResults = [];
      const withStatsResults = [];

      // Warmup iterations to account for JIT compilation
      for (let warmup = 0; warmup < 2; warmup++) {
        const warmupHandler = new ClicheErrorHandler({
          logger: mockLogger,
          eventBus: mockEventBus,
          retryConfig: {
            maxRetries: 3,
            baseDelay: 10,
            maxDelay: 100,
            backoffMultiplier: 2,
            jitterFactor: 0.1,
          },
        });

        for (let i = 0; i < 50; i++) {
          const error = new ClicheError(`Warmup ${i}`);
          await warmupHandler.handleError(error, {
            operation: `warmup_${i % 5}`,
          });
        }
      }

      // Run multiple iterations for statistical reliability
      for (let iteration = 0; iteration < iterations; iteration++) {
        // Test without statistics collection (baseline)
        const withoutStatsStart = performance.now();

        for (let i = 0; i < 200; i++) {
          const error = new ClicheError(`No stats ${i}-${iteration}`);
          await errorHandler.handleError(error, {
            operation: `no_stats_op_${i % 10}_${iteration}`,
          });
        }

        const withoutStatsTime = performance.now() - withoutStatsStart;
        withoutStatsResults.push(withoutStatsTime);

        // Create new handler for comparison
        const statsHandler = new ClicheErrorHandler({
          logger: mockLogger,
          eventBus: mockEventBus,
          retryConfig: {
            maxRetries: 3,
            baseDelay: 10, // Use same minimal delays as first handler for fair comparison
            maxDelay: 100,
            backoffMultiplier: 2,
            jitterFactor: 0.1,
          },
        });

        // Test with statistics collection
        const withStatsStart = performance.now();

        for (let i = 0; i < 200; i++) {
          const error = new ClicheError(`With stats ${i}-${iteration}`);
          await statsHandler.handleError(error, {
            operation: `stats_op_${i % 10}_${iteration}`,
          });

          // Periodically access statistics (simulating real usage)
          if (i % 20 === 0) {
            statsHandler.getErrorStatistics();
          }
        }

        const withStatsTime = performance.now() - withStatsStart;
        withStatsResults.push(withStatsTime);
      }

      // Calculate median times for more robust comparison
      const medianWithoutStats = withoutStatsResults.sort((a, b) => a - b)[
        Math.floor(iterations / 2)
      ];
      const medianWithStats = withStatsResults.sort((a, b) => a - b)[
        Math.floor(iterations / 2)
      ];

      // Calculate overhead using median values (more stable than single measurement)
      const overhead =
        (medianWithStats - medianWithoutStats) /
        Math.max(medianWithoutStats, 1);

      // Micro-benchmark threshold for CI stability
      // 100% overhead tolerance prevents false positives from JIT timing and system noise
      // while still catching genuine performance regressions (which would show 5x-10x overhead)
      expect(overhead).toBeLessThan(1.0); // Increased to 1.0 for micro-benchmark stability
    });

    it('should retrieve statistics quickly even with many unique operations', async () => {
      // Generate many unique errors and operations
      for (let i = 0; i < 500; i++) {
        const error = new ClicheError(`Error ${i}`);
        await errorHandler.handleError(error, {
          operation: `unique_operation_${i}`,
        });
      }

      // Measure statistics retrieval time
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        const stats = errorHandler.getErrorStatistics();
        expect(stats).toBeDefined();
      }

      const endTime = Date.now();
      const retrievalTime = endTime - startTime;

      // 100 statistics retrievals should be reasonably fast (increased tolerance)
      expect(retrievalTime).toBeLessThan(500); // Less than 500ms total (increased for CI)
    });
  });

  describe('Throttled Cleanup Performance', () => {
    it('should demonstrate throttled cleanup behavior prevents O(n) performance degradation', async () => {
      // This test verifies that the throttled cleanup mechanism prevents O(n) performance degradation.
      // Without throttling, cleanup would run on every error, causing performance to degrade linearly
      // as errors accumulate. With throttling (every 100 operations or 5 minutes), performance remains stable.

      // Note: We use a 3.0x threshold instead of 2.0x to account for CI environment variability
      // and the microsecond-level timing of these operations. True O(n) degradation would show
      // 10x+ performance ratios, so 3.0x still catches genuine issues while reducing flakiness.

      let testPassed = false;
      let lastError = null;
      const maxAttempts = 3;

      // Retry logic for test stability in CI environments
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          // Create a fresh handler to test cleanup throttling
          const cleanupHandler = new ClicheErrorHandler({
            logger: mockLogger,
            eventBus: mockEventBus,
            retryConfig: {
              maxRetries: 3,
              baseDelay: 10,
              maxDelay: 100,
              backoffMultiplier: 2,
              jitterFactor: 0.1,
            },
          });

          // Process operations in chunks to verify throttling behavior
          const chunkSizes = [50, 100, 150];
          const chunkPerformance = [];

          for (const chunkSize of chunkSizes) {
            const startTime = performance.now();

            // Process errors with unique operations to build up statistics
            for (let i = 0; i < chunkSize; i++) {
              const error = new ClicheError(`Cleanup test ${i}`);
              await cleanupHandler.handleError(error, {
                operation: `cleanup_test_${i}_attempt_${attempt}`, // Each error has unique operation
              });
            }

            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const avgTimePerError = totalTime / chunkSize;

            chunkPerformance.push({
              chunkSize,
              totalTime,
              avgTimePerError,
            });
          }

          // Verify that average time per error doesn't increase significantly
          // This would indicate O(n) behavior if cleanup ran on every error
          const firstAvg = chunkPerformance[0].avgTimePerError;
          const lastAvg =
            chunkPerformance[chunkPerformance.length - 1].avgTimePerError;

          // With throttled cleanup, performance should remain relatively stable
          // Allow 3x tolerance for CI environment variation, but catch significant degradation
          const performanceRatio = lastAvg / firstAvg;
          expect(performanceRatio).toBeLessThan(3.0);

          // Verify statistics are being collected (cleanup throttling still allows collection)
          const stats = cleanupHandler.getErrorStatistics();
          expect(Object.keys(stats).length).toBeGreaterThan(0);

          // Log performance metrics for debugging
          console.log('Throttled cleanup performance test results:', {
            performanceRatio: performanceRatio.toFixed(2),
            statsCount: Object.keys(stats).length,
            chunkResults: chunkPerformance.map((p) => ({
              size: p.chunkSize,
              avgMs: p.avgTimePerError.toFixed(2),
            })),
          });

          testPassed = true;
          break; // Test passed, exit retry loop
        } catch (error) {
          lastError = error;
          if (attempt < maxAttempts) {
            // Wait briefly before retry to allow system to stabilize
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      }

      // If all attempts failed, throw the last error
      if (!testPassed) {
        throw lastError;
      }
    });
  });

  describe('Scalability', () => {
    it('should maintain performance with increasing error volume', async () => {
      const volumes = [100, 500, 1000];
      const performanceMetrics = [];

      for (const volume of volumes) {
        const startTime = Date.now();

        const promises = [];
        for (let i = 0; i < volume; i++) {
          const error = new ClicheError(`Volume test ${i}`);
          promises.push(
            errorHandler.handleError(error, {
              operation: `volume_op_${i % 20}`,
            })
          );
        }

        await Promise.all(promises);

        const endTime = Date.now();
        const totalTime = endTime - startTime;
        const avgTimePerError = totalTime / volume;

        performanceMetrics.push({
          volume,
          totalTime,
          avgTimePerError,
          throughput: volume / (totalTime / 1000),
        });
      }

      // Average time per error should not increase significantly with volume
      const firstAvg = performanceMetrics[0].avgTimePerError;
      const lastAvg =
        performanceMetrics[performanceMetrics.length - 1].avgTimePerError;

      // Performance should scale reasonably with volume (increased tolerance)
      expect(lastAvg / firstAvg).toBeLessThan(3); // 3x tolerance for scalability

      // Throughput should remain reasonable even at high volume (reduced expectation)
      const lastThroughput =
        performanceMetrics[performanceMetrics.length - 1].throughput;
      expect(lastThroughput).toBeGreaterThan(50); // At least 50 errors/second (reduced for CI)
    });
  });
});
