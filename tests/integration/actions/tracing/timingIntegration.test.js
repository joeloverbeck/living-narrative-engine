import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionExecutionTrace } from '../../../../src/actions/tracing/actionExecutionTrace.js';
import { ActionExecutionTraceFactory } from '../../../../src/actions/tracing/actionExecutionTraceFactory.js';

describe('Timing Integration', () => {
  let factory;

  beforeEach(() => {
    factory = new ActionExecutionTraceFactory({
      logger: { debug: jest.fn(), error: jest.fn() },
    });
  });

  describe('ActionExecutionTrace Timing Integration', () => {
    it('should capture timing data with timing enabled', () => {
      const trace = new ActionExecutionTrace({
        actionId: 'core:timing_test',
        actorId: 'player-1',
        turnAction: { actionDefinitionId: 'core:timing_test' },
        enableTiming: true,
      });

      trace.captureDispatchStart();
      trace.captureEventPayload({ test: 'data' });
      trace.captureDispatchResult({ success: true });

      // Verify basic timing functionality
      expect(trace.isComplete).toBe(true);
      expect(trace.duration).toBeGreaterThan(0);

      // Verify timing summary exists
      const timingSummary = trace.getTimingSummary();
      expect(timingSummary).toBeTruthy();
      expect(timingSummary.isComplete).toBe(true);

      // Verify performance report
      const performanceReport = trace.getPerformanceReport();
      expect(performanceReport).toContain('EXECUTION TIMING REPORT');

      // Verify JSON export includes timing
      const jsonData = trace.toJSON();
      expect(jsonData.timing).toBeTruthy();
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
        turnAction: { actionDefinitionId: 'core:factory_test' },
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
        enableTiming: false,
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
        parameters: { param: 'value' },
      };

      const traceWithTiming = factory.createFromTurnAction(
        turnAction,
        'player-1',
        true
      );
      const traceWithoutTiming = factory.createFromTurnAction(
        turnAction,
        'player-1',
        false
      );

      traceWithTiming.captureDispatchStart();
      traceWithTiming.captureDispatchResult({ success: true });

      traceWithoutTiming.captureDispatchStart();
      traceWithoutTiming.captureDispatchResult({ success: true });

      expect(traceWithTiming.getTimingSummary()).toBeTruthy();
      expect(traceWithoutTiming.getTimingSummary()).toBeNull();
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
          commandString: 'legacy command',
        },
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
        turnAction: { actionDefinitionId: 'core:factory_legacy_1' },
      });

      const turnAction = {
        actionDefinitionId: 'core:factory_legacy_2',
        commandString: 'test',
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
});
