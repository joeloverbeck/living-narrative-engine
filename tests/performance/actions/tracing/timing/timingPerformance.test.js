import { describe, it, expect } from '@jest/globals';
import { ActionExecutionTrace } from '../../../../../src/actions/tracing/actionExecutionTrace.js';

/**
 * Calculate median value from an array of numbers
 *
 * @param {number[]} values - Array of numeric values
 * @returns {number} Median value
 */
function calculateMedian(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Calculate percentile from an array of numbers
 *
 * @param {number[]} values - Array of numeric values
 * @param {number} percentile - Percentile to calculate (0-100)
 * @returns {number} Percentile value
 */
function calculatePercentile(values, percentile) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Execute a single trace operation for measurement
 *
 * @param {boolean} enableTiming - Whether to enable timing instrumentation
 * @param {number} iteration - Iteration number for unique IDs
 * @returns {number} Duration in milliseconds
 */
function executeTraceOperation(enableTiming, iteration) {
  const start = performance.now();

  const trace = new ActionExecutionTrace({
    actionId: `core:perf_test_${enableTiming ? 'timing' : 'notiming'}_${iteration}`,
    actorId: 'player-1',
    turnAction: {
      actionDefinitionId: `core:perf_test_${enableTiming ? 'timing' : 'notiming'}_${iteration}`,
    },
    enableTiming,
  });

  trace.captureDispatchStart();
  trace.captureEventPayload({ test: 'data' });
  trace.captureDispatchResult({ success: true });

  const end = performance.now();
  return end - start;
}

describe('Timing Performance', () => {
  describe('Performance Requirements Validation', () => {
    it('should meet minimal overhead requirements', () => {
      const warmupIterations = 10;
      const iterations = 1000;

      // Warm-up phase: Allow JIT compiler to optimize both code paths
      // This follows best practices from performanceTestingUtils.js
      for (let i = 0; i < warmupIterations; i++) {
        executeTraceOperation(true, i);
        executeTraceOperation(false, i);
      }

      // Measurement phase: Collect timing data
      const timingOverheads = [];
      const noTimingOverheads = [];

      for (let i = 0; i < iterations; i++) {
        // Interleave measurements to reduce systematic bias from JIT/GC effects
        timingOverheads.push(executeTraceOperation(true, i));
        noTimingOverheads.push(executeTraceOperation(false, i));
      }

      // Statistical analysis using median (more robust to outliers than mean)
      const medianTimingOverhead = calculateMedian(timingOverheads);
      const medianNoTimingOverhead = calculateMedian(noTimingOverheads);
      const timingAddedOverhead = medianTimingOverhead - medianNoTimingOverhead;

      // Calculate percentiles for variance analysis
      const p95TimingOverhead = calculatePercentile(timingOverheads, 95);
      const p95NoTimingOverhead = calculatePercentile(noTimingOverheads, 95);

      // Realistic threshold: 0.5ms for complex timing instrumentation
      // This accounts for:
      // - Multiple performance.now() calls
      // - Phase management operations
      // - Metadata creation and storage
      // - Array operations and object creation
      //
      // Reference: Other performance tests use 5-10ms tolerances
      // (see actionExecutionTracePerformance.test.js:82)
      expect(timingAddedOverhead).toBeLessThan(0.5);

      // Log statistical summary for analysis
      console.log('\n=== Timing Performance Statistics ===');
      console.log(
        `Median timing overhead: ${timingAddedOverhead.toFixed(4)}ms`
      );
      console.log(`With timing (median): ${medianTimingOverhead.toFixed(4)}ms`);
      console.log(
        `Without timing (median): ${medianNoTimingOverhead.toFixed(4)}ms`
      );
      console.log(
        `95th percentile (with timing): ${p95TimingOverhead.toFixed(4)}ms`
      );
      console.log(
        `95th percentile (without timing): ${p95NoTimingOverhead.toFixed(4)}ms`
      );
      console.log(
        `Sample size: ${iterations} iterations after ${warmupIterations} warm-up`
      );
      console.log('=====================================\n');
    });
  });
});
