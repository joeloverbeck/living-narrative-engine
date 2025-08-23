import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionExecutionTrace } from '../../../../src/actions/tracing/actionExecutionTrace.js';
import { ActionPerformanceAnalyzer } from '../../../../src/actions/tracing/timing/actionPerformanceAnalyzer.js';

describe('Timing Performance Integration', () => {
  describe('Performance Analysis Integration', () => {
    it('should analyze performance across multiple traces', () => {
      const analyzer = new ActionPerformanceAnalyzer();
      const traces = [];

      // Create multiple traces with different performance characteristics
      for (let i = 0; i < 10; i++) {
        const trace = new ActionExecutionTrace({
          actionId: `core:test_${i}`,
          actorId: 'player-1',
          turnAction: { actionDefinitionId: `core:test_${i}` },
          enableTiming: true,
        });

        trace.captureDispatchStart();

        // Simulate variable execution times
        const iterations = 1000 + i * 500; // Variable workload
        let sum = 0;
        for (let j = 0; j < iterations; j++) {
          sum += j;
        }

        trace.captureDispatchResult({ success: true });

        traces.push(trace);
        analyzer.addTrace(trace);
      }

      // Analyze performance
      const stats = analyzer.getStats();
      expect(stats.totalTraces).toBe(10);
      expect(stats.averageDuration).toBeGreaterThan(0);
      expect(stats.minDuration).toBeLessThan(stats.maxDuration);

      // Check percentiles
      const percentiles = stats.percentiles;
      expect(percentiles.p50).toBeLessThanOrEqual(percentiles.p90);
      expect(percentiles.p90).toBeLessThanOrEqual(percentiles.p95);
      expect(percentiles.p95).toBeLessThanOrEqual(percentiles.p99);

      // Generate report
      const report = analyzer.generateReport();
      expect(report).toContain('ACTION EXECUTION PERFORMANCE REPORT');
      expect(report).toContain('Total Traces: 10');
      expect(report).toContain('Average Duration:');
      expect(report).toContain('Percentiles:');
    });

    it('should handle mixed timing-enabled and timing-disabled traces', () => {
      const analyzer = new ActionPerformanceAnalyzer();

      // Create traces with timing enabled
      for (let i = 0; i < 5; i++) {
        const trace = new ActionExecutionTrace({
          actionId: `core:with_timing_${i}`,
          actorId: 'player-1',
          turnAction: { actionDefinitionId: `core:with_timing_${i}` },
          enableTiming: true,
        });

        trace.captureDispatchStart();
        trace.captureDispatchResult({ success: true });
        analyzer.addTrace(trace);
      }

      // Create traces with timing disabled
      for (let i = 0; i < 5; i++) {
        const trace = new ActionExecutionTrace({
          actionId: `core:without_timing_${i}`,
          actorId: 'player-1',
          turnAction: { actionDefinitionId: `core:without_timing_${i}` },
          enableTiming: false,
        });

        trace.captureDispatchStart();
        trace.captureDispatchResult({ success: true });
        analyzer.addTrace(trace);
      }

      const stats = analyzer.getStats();
      // Only timing-enabled traces should be analyzed
      expect(stats.totalTraces).toBe(5);
    });

    it('should capture complete timing data with realistic delays', async () => {
      const trace = new ActionExecutionTrace({
        actionId: 'core:timing_test',
        actorId: 'player-1',
        turnAction: { actionDefinitionId: 'core:timing_test' },
        enableTiming: true,
      });

      // Simulate execution with realistic delays
      trace.captureDispatchStart();

      await new Promise((resolve) => setTimeout(resolve, 10));
      trace.captureEventPayload({ test: 'data' });

      await new Promise((resolve) => setTimeout(resolve, 20));
      trace.captureDispatchResult({ success: true });

      // Verify basic timing data
      expect(trace.duration).toBeGreaterThanOrEqual(30);
      expect(trace.isComplete).toBe(true);

      // Verify timing summary
      const timingSummary = trace.getTimingSummary();
      expect(timingSummary).toBeTruthy();
      expect(timingSummary.totalDuration).toBeGreaterThanOrEqual(30);
      expect(timingSummary.phases.length).toBeGreaterThan(0);
      expect(timingSummary.isComplete).toBe(true);

      // Verify performance report
      const performanceReport = trace.getPerformanceReport();
      expect(performanceReport).toContain('EXECUTION TIMING REPORT');
      expect(performanceReport).toContain('Total Duration:');

      // Verify JSON export includes timing
      const jsonData = trace.toJSON();
      expect(jsonData.timing).toBeTruthy();
      expect(jsonData.timing.summary.totalDuration).toBeGreaterThanOrEqual(30);
      expect(jsonData.timing.phases).toBeTruthy();
      expect(jsonData.timing.markers).toBeTruthy();
      expect(jsonData.timing.precision).toBeTruthy();
    });
  });
});