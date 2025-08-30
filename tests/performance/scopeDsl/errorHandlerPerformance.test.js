/**
 * @file Performance tests for ScopeDslErrorHandler
 * @description Tests the performance characteristics of error handling operations
 *
 * Performance Targets (CI Environment):
 * - Error handling: <1ms per error (basic)
 * - Error handling with complex context: <2ms per error
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
import { performance } from 'perf_hooks';
import { createUltraLightContainer } from '../../common/testing/ultraLightContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

// Set reasonable timeout for performance tests
jest.setTimeout(30000);

describe('ScopeDslErrorHandler Performance', () => {
  let errorHandler;
  let mockLogger;
  let container;

  // Performance tracking
  const performanceMetrics = {
    errorHandlingTimes: [],
    bufferClearingTimes: [],
  };

  beforeAll(() => {
    // Create ultra-light container for maximum performance
    container = createUltraLightContainer();
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
        } catch (e) {
          // Expected error
        }
      }

      const duration = performance.now() - start;
      const avgTimePerError = duration / iterations;

      // Log performance metrics
      performanceMetrics.errorHandlingTimes.push(avgTimePerError);

      // Performance assertion: <1ms per error (adjusted for CI environment)
      expect(duration).toBeLessThan(1000); // <1ms per error for 1000 iterations
      expect(avgTimePerError).toBeLessThan(1.0);

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
        } catch (e) {
          // Expected error
        }
      }

      const duration = performance.now() - start;
      const avgTimePerError = duration / iterations;

      // Even with complex context, should maintain performance
      expect(avgTimePerError).toBeLessThan(2.0); // Allow more time for complex context in CI
      expect(duration).toBeLessThan(1000); // <2ms per error for 500 iterations
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
          } catch (e) {
            // Expected error
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
        } catch (e) {
          // Expected error
        }
      }

      const duration = performance.now() - start;

      // Verify buffer size is maintained
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer.length).toBeLessThanOrEqual(maxBufferSize);

      // Performance should not degrade with buffer management
      const avgTimePerError = duration / totalErrors;
      expect(avgTimePerError).toBeLessThan(1.0); // Still efficient even with buffer management (CI tolerance)
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
              } catch (e) {
                // Expected error
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

        // Should handle concurrent operations efficiently
        expect(avgTimePerError).toBeLessThan(0.5);
        expect(duration).toBeLessThan(500); // <500ms for all concurrent operations

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
          } catch (e) {
            // Expected error
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

      // Average time per error should not vary significantly
      const variance = maxAvgTime - minAvgTime;
      expect(variance).toBeLessThan(0.5); // <0.5ms variance in average time (CI tolerance)

      // All sizes should maintain good performance
      for (const timing of timings) {
        expect(timing.avgTime).toBeLessThan(1.5); // <1.5ms per error at any scale (CI tolerance)
      }
    });
  });
});
