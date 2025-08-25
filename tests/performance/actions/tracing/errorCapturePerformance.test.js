/**
 * @file Performance tests for error capture functionality in ActionExecutionTrace
 * @description Validates performance requirements for error capture and analysis
 * @see src/actions/tracing/actionExecutionTrace.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionExecutionTrace } from '../../../../src/actions/tracing/actionExecutionTrace.js';

describe('Error Capture - Performance Tests', () => {
  const validTraceParams = {
    actionId: 'core:error_test',
    actorId: 'player-1',
    turnAction: {
      actionDefinitionId: 'core:error_test',
      commandString: 'test error handling',
      parameters: { type: 'performance' },
    },
  };

  describe('Error Analysis Performance', () => {
    it('should maintain performance with error analysis enabled (<10ms)', () => {
      // Warm up - let JIT optimization kick in
      for (let i = 0; i < 100; i++) {
        const warmupTrace = new ActionExecutionTrace({
          ...validTraceParams,
          enableErrorAnalysis: true,
        });
        warmupTrace.captureDispatchStart();
        const warmupError = new Error('Warmup error');
        warmupError.stack = `Error: Warmup error
    at testFunction (/home/project/src/test.js:10:5)
    at processAction (/home/project/src/actions.js:25:10)`;
        warmupTrace.captureError(warmupError);
      }

      // Measure performance
      const trace = new ActionExecutionTrace({
        ...validTraceParams,
        enableErrorAnalysis: true,
      });

      const startTime = performance.now();

      trace.captureDispatchStart();

      const error = new Error('Performance test error');
      error.stack = `Error: Performance test error
    at testFunction (/home/project/src/test.js:10:5)
    at processAction (/home/project/src/actions.js:25:10)`;

      trace.captureError(error, {
        phase: 'performance_test',
        retryCount: 0,
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Error capture should be fast (< 10ms for this simple case)
      expect(duration).toBeLessThan(10);

      // But still provide full analysis
      const errorSummary = trace.getErrorSummary();
      expect(errorSummary).toBeTruthy();
      expect(errorSummary.troubleshooting.length).toBeGreaterThan(0);

      // Log performance metrics for monitoring
      console.log(
        `Error analysis performance: ${duration.toFixed(2)}ms (with full analysis enabled)`
      );
    });

    it('should handle very large stack traces efficiently (<50ms for 100 frames)', () => {
      // Warm up - let JIT optimization kick in
      for (let i = 0; i < 50; i++) {
        const warmupTrace = new ActionExecutionTrace({
          ...validTraceParams,
          enableErrorAnalysis: true,
        });
        const warmupError = new Error('Warmup');
        warmupError.stack = `Error: Warmup\n    at function1 (/file.js:1:1)\n    at function2 (/file.js:2:2)`;
        warmupTrace.captureDispatchStart();
        warmupTrace.captureError(warmupError);
      }

      // Create large stack trace
      const largeStackFrames = Array.from(
        { length: 100 },
        (_, i) =>
          `    at function${i} (/home/project/src/file${i}.js:${i + 1}:1)`
      ).join('\n');

      const largeStackTrace = `Error: Large stack trace\n${largeStackFrames}`;

      const error = new Error('Large stack trace test');
      error.stack = largeStackTrace;

      const trace = new ActionExecutionTrace({
        ...validTraceParams,
        enableErrorAnalysis: true,
      });

      trace.captureDispatchStart();

      // Measure performance
      const iterations = 10;
      const measurements = [];

      for (let i = 0; i < iterations; i++) {
        // Create fresh trace for each measurement
        const testTrace = new ActionExecutionTrace({
          ...validTraceParams,
          enableErrorAnalysis: true,
        });
        testTrace.captureDispatchStart();

        const startTime = performance.now();
        testTrace.captureError(error);
        const endTime = performance.now();

        measurements.push(endTime - startTime);

        const errorDetails = testTrace.getError();
        expect(errorDetails.stackAnalysis.frames).toHaveLength(100);
      }

      // Calculate statistics
      const avgDuration =
        measurements.reduce((sum, val) => sum + val, 0) / iterations;
      const maxDuration = Math.max(...measurements);
      const p95Duration = measurements.sort((a, b) => a - b)[
        Math.floor(iterations * 0.95)
      ];

      // Should still be reasonably fast even with 100 stack frames
      expect(avgDuration).toBeLessThan(50);
      expect(p95Duration).toBeLessThan(75);

      // Log performance metrics for monitoring
      console.log(
        `Large stack trace performance (100 frames):\n` +
          `  Average: ${avgDuration.toFixed(2)}ms\n` +
          `  P95: ${p95Duration.toFixed(2)}ms\n` +
          `  Max: ${maxDuration.toFixed(2)}ms`
      );
    });
  });

  describe('Error Capture Throughput', () => {
    it('should handle high-frequency error capture efficiently', () => {
      // Warm up
      for (let i = 0; i < 100; i++) {
        const trace = new ActionExecutionTrace({
          ...validTraceParams,
          enableErrorAnalysis: true,
        });
        trace.captureDispatchStart();
        trace.captureError(new Error(`Warmup ${i}`));
      }

      // Measure throughput
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const trace = new ActionExecutionTrace({
          actionId: `core:test_${i}`,
          actorId: `actor-${i}`,
          turnAction: {
            actionDefinitionId: `core:test_${i}`,
            commandString: `test ${i}`,
            parameters: { index: i },
          },
          enableErrorAnalysis: true,
        });

        trace.captureDispatchStart();

        const error = new Error(`Test error ${i}`);
        error.code = `ERROR_${i % 10}`;
        error.stack = `Error: Test error ${i}
    at testFunction (/home/project/src/test.js:${i}:5)
    at processAction (/home/project/src/actions.js:25:10)`;

        trace.captureError(error, {
          phase: `phase_${i % 5}`,
          retryCount: i % 3,
        });

        // Verify we get valid output
        const errorSummary = trace.getErrorSummary();
        expect(errorSummary).toBeTruthy();
      }

      const duration = performance.now() - startTime;
      const throughput = iterations / (duration / 1000); // errors per second

      // Should handle at least 1000 errors per second
      expect(throughput).toBeGreaterThan(1000);

      // Log performance metrics
      console.log(
        `Error capture throughput:\n` +
          `  Total: ${iterations} errors in ${duration.toFixed(2)}ms\n` +
          `  Throughput: ${throughput.toFixed(0)} errors/second\n` +
          `  Average: ${(duration / iterations).toFixed(3)}ms/error`
      );
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory when capturing many errors', () => {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // Create and discard many traces with errors
      for (let batch = 0; batch < 10; batch++) {
        const traces = [];

        for (let i = 0; i < 100; i++) {
          const trace = new ActionExecutionTrace({
            ...validTraceParams,
            enableErrorAnalysis: true,
          });

          trace.captureDispatchStart();

          const error = new Error(`Memory test error ${batch}-${i}`);
          error.stack = `Error: Memory test error
    at testFunction (/home/project/src/test.js:10:5)
    at processAction (/home/project/src/actions.js:25:10)
    at deepFunction (/home/project/src/deep.js:100:20)`;

          trace.captureError(error, {
            phase: 'memory_test',
            retryCount: i,
            largeContext: new Array(100).fill(`context-${i}`),
          });

          traces.push(trace);
        }

        // Clear references
        traces.length = 0;
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be reasonable (< 50MB for 1000 traces)
      const maxMemoryGrowth = 50 * 1024 * 1024; // 50MB
      expect(memoryGrowth).toBeLessThan(maxMemoryGrowth);

      // Log memory metrics
      console.log(
        `Memory efficiency:\n` +
          `  Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB\n` +
          `  Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB\n` +
          `  Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`
      );
    });
  });
});