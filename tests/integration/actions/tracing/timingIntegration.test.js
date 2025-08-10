import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionExecutionTrace } from '../../../../src/actions/tracing/actionExecutionTrace.js';
import { ActionExecutionTraceFactory } from '../../../../src/actions/tracing/actionExecutionTraceFactory.js';
import { ActionPerformanceAnalyzer } from '../../../../src/actions/tracing/timing/actionPerformanceAnalyzer.js';

describe('Timing Integration', () => {
  let factory;

  beforeEach(() => {
    factory = new ActionExecutionTraceFactory({
      logger: { debug: jest.fn(), error: jest.fn() }
    });
  });

  describe('ActionExecutionTrace Timing Integration', () => {
    it('should capture complete timing data with timing enabled', async () => {
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

    it('should work without timing data when timing disabled', () => {
      const trace = new ActionExecutionTrace({
        actionId: 'core:no_timing_test',
        actorId: 'player-1',
        turnAction: { actionDefinitionId: 'core:no_timing_test' },
        enableTiming: false,
      });

      trace.captureDispatchStart();
      trace.captureEventPayload({ test: 'data' });
      trace.captureDispatchResult({ success: true });

      expect(trace.isComplete).toBe(true);
      expect(trace.duration).toBeGreaterThan(0); // Basic timing still works

      // Timing-specific methods should return null or default responses
      const timingSummary = trace.getTimingSummary();
      expect(timingSummary).toBeNull();

      const performanceReport = trace.getPerformanceReport();
      expect(performanceReport).toBe('Timing not enabled for this trace');

      // JSON export should not include timing data
      const jsonData = trace.toJSON();
      expect(jsonData.timing).toBeUndefined();
    });

    it('should handle error scenarios with timing', () => {
      const trace = new ActionExecutionTrace({
        actionId: 'core:error_test',
        actorId: 'player-1',
        turnAction: { actionDefinitionId: 'core:error_test' },
        enableTiming: true,
      });

      trace.captureDispatchStart();
      trace.captureEventPayload({ test: 'data' });
      
      const testError = new Error('Test execution error');
      trace.captureError(testError);

      expect(trace.hasError).toBe(true);
      expect(trace.isComplete).toBe(true);

      const timingSummary = trace.getTimingSummary();
      expect(timingSummary).toBeTruthy();
      expect(timingSummary.isComplete).toBe(true);

      const jsonData = trace.toJSON();
      expect(jsonData.timing).toBeTruthy();
      expect(jsonData.error).toBeTruthy();
    });
  });

  describe('ActionExecutionTraceFactory Integration', () => {
    it('should create traces with timing enabled by default', () => {
      const trace = factory.createTrace({
        actionId: 'core:factory_test',
        actorId: 'player-1',
        turnAction: { actionDefinitionId: 'core:factory_test' }
      });

      trace.captureDispatchStart();
      trace.captureDispatchResult({ success: true });

      const timingSummary = trace.getTimingSummary();
      expect(timingSummary).toBeTruthy();
    });

    it('should create traces with timing disabled when specified', () => {
      const trace = factory.createTrace({
        actionId: 'core:factory_no_timing_test',
        actorId: 'player-1',
        turnAction: { actionDefinitionId: 'core:factory_no_timing_test' },
        enableTiming: false
      });

      trace.captureDispatchStart();
      trace.captureDispatchResult({ success: true });

      const timingSummary = trace.getTimingSummary();
      expect(timingSummary).toBeNull();
    });

    it('should support createFromTurnAction with timing options', () => {
      const turnAction = {
        actionDefinitionId: 'core:turn_action_test',
        commandString: 'test command',
        parameters: { param: 'value' }
      };

      const traceWithTiming = factory.createFromTurnAction(turnAction, 'player-1', true);
      const traceWithoutTiming = factory.createFromTurnAction(turnAction, 'player-1', false);

      traceWithTiming.captureDispatchStart();
      traceWithTiming.captureDispatchResult({ success: true });

      traceWithoutTiming.captureDispatchStart();
      traceWithoutTiming.captureDispatchResult({ success: true });

      expect(traceWithTiming.getTimingSummary()).toBeTruthy();
      expect(traceWithoutTiming.getTimingSummary()).toBeNull();
    });
  });

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
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with existing ActionExecutionTrace usage', () => {
      // Test that existing code patterns still work
      const trace = new ActionExecutionTrace({
        actionId: 'core:legacy_test',
        actorId: 'player-1',
        turnAction: {
          actionDefinitionId: 'core:legacy_test',
          commandString: 'legacy command'
        }
        // No enableTiming parameter - should default to true
      });

      // All existing methods should work
      expect(trace.actionId).toBe('core:legacy_test');
      expect(trace.actorId).toBe('player-1');
      expect(trace.isComplete).toBe(false);
      expect(trace.hasError).toBe(false);

      trace.captureDispatchStart();
      trace.captureEventPayload({ data: 'test' });
      trace.captureDispatchResult({ success: true });

      expect(trace.isComplete).toBe(true);
      expect(trace.duration).toBeGreaterThan(0);
      
      const phases = trace.getExecutionPhases();
      expect(phases.length).toBeGreaterThan(0);

      const summary = trace.toSummary();
      expect(summary).toContain('core:legacy_test');

      const jsonData = trace.toJSON();
      expect(jsonData.metadata.actionId).toBe('core:legacy_test');

      // New timing methods should also work (timing enabled by default)
      const timingSummary = trace.getTimingSummary();
      expect(timingSummary).toBeTruthy();
    });

    it('should maintain factory backward compatibility', () => {
      // Test existing factory usage patterns
      const trace1 = factory.createTrace({
        actionId: 'core:factory_legacy_1',
        actorId: 'player-1',
        turnAction: { actionDefinitionId: 'core:factory_legacy_1' }
      });

      const turnAction = {
        actionDefinitionId: 'core:factory_legacy_2',
        commandString: 'test'
      };
      const trace2 = factory.createFromTurnAction(turnAction, 'player-1');

      // Both should have timing enabled by default
      trace1.captureDispatchStart();
      trace1.captureDispatchResult({ success: true });

      trace2.captureDispatchStart();
      trace2.captureDispatchResult({ success: true });

      expect(trace1.getTimingSummary()).toBeTruthy();
      expect(trace2.getTimingSummary()).toBeTruthy();
    });
  });

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

      const avgTimingOverhead = timingOverheads.reduce((a, b) => a + b, 0) / iterations;
      const avgNoTimingOverhead = noTimingOverheads.reduce((a, b) => a + b, 0) / iterations;
      const timingAddedOverhead = avgTimingOverhead - avgNoTimingOverhead;

      // Timing overhead should be minimal (<0.1ms as per requirement)
      expect(timingAddedOverhead).toBeLessThan(0.1);
      
      console.log(`Average timing overhead: ${timingAddedOverhead.toFixed(4)}ms`);
      console.log(`With timing: ${avgTimingOverhead.toFixed(4)}ms`);
      console.log(`Without timing: ${avgNoTimingOverhead.toFixed(4)}ms`);
    });
  });
});