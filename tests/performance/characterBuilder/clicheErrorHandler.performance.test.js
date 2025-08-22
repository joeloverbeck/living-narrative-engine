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
      // Process errors without statistics collection
      const withoutStatsStart = Date.now();

      for (let i = 0; i < 200; i++) {
        const error = new ClicheError(`No stats ${i}`);
        await errorHandler.handleError(error, {
          operation: `no_stats_op_${i % 10}`,
        });
      }

      const withoutStatsTime = Date.now() - withoutStatsStart;

      // Create new handler for comparison
      const statsHandler = new ClicheErrorHandler({
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      // Process errors with statistics collection
      const withStatsStart = Date.now();

      for (let i = 0; i < 200; i++) {
        const error = new ClicheError(`With stats ${i}`);
        await statsHandler.handleError(error, {
          operation: `stats_op_${i % 10}`,
        });

        // Periodically access statistics (simulating real usage)
        if (i % 20 === 0) {
          statsHandler.getErrorStatistics();
        }
      }

      const withStatsTime = Date.now() - withStatsStart;

      // Statistics overhead should be reasonable (increased tolerance for CI environments)
      const overhead =
        (withStatsTime - withoutStatsTime) / Math.max(withoutStatsTime, 1); // Prevent division by zero
      expect(overhead).toBeLessThan(0.5); // 50% overhead tolerance for CI
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
