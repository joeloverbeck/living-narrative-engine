import { describe, it, expect } from '@jest/globals';
import { ActionExecutionTrace } from '../../../../../src/actions/tracing/actionExecutionTrace.js';

describe('Timing Performance', () => {
  describe('Performance Requirements Validation', () => {
    it('should meet minimal overhead requirements', () => {
      const iterations = 100;
      const timingOverheads = [];
      const noTimingOverheads = [];

      // Measure timing-enabled overhead
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        const trace = new ActionExecutionTrace({
          actionId: `core:perf_test_${i}`,
          actorId: 'player-1',
          turnAction: { actionDefinitionId: `core:perf_test_${i}` },
          enableTiming: true,
        });

        trace.captureDispatchStart();
        trace.captureEventPayload({ test: 'data' });
        trace.captureDispatchResult({ success: true });

        const end = performance.now();
        timingOverheads.push(end - start);
      }

      // Measure timing-disabled overhead
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        const trace = new ActionExecutionTrace({
          actionId: `core:no_timing_perf_test_${i}`,
          actorId: 'player-1',
          turnAction: { actionDefinitionId: `core:no_timing_perf_test_${i}` },
          enableTiming: false,
        });

        trace.captureDispatchStart();
        trace.captureEventPayload({ test: 'data' });
        trace.captureDispatchResult({ success: true });

        const end = performance.now();
        noTimingOverheads.push(end - start);
      }

      const avgTimingOverhead =
        timingOverheads.reduce((a, b) => a + b, 0) / iterations;
      const avgNoTimingOverhead =
        noTimingOverheads.reduce((a, b) => a + b, 0) / iterations;
      const timingAddedOverhead = avgTimingOverhead - avgNoTimingOverhead;

      // Timing overhead should be minimal (<0.1ms as per requirement)
      expect(timingAddedOverhead).toBeLessThan(0.1);

      console.log(
        `Average timing overhead: ${timingAddedOverhead.toFixed(4)}ms`
      );
      console.log(`With timing: ${avgTimingOverhead.toFixed(4)}ms`);
      console.log(`Without timing: ${avgNoTimingOverhead.toFixed(4)}ms`);
    });
  });
});
