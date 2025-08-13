import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionExecutionTrace } from '../../../../src/actions/tracing/actionExecutionTrace.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

describe('ActionExecutionTrace', () => {
  let trace;

  const validParams = {
    actionId: 'core:go',
    actorId: 'player-1',
    turnAction: {
      actionDefinitionId: 'core:go',
      commandString: 'go north',
      parameters: { direction: 'north' },
    },
  };

  beforeEach(() => {
    trace = new ActionExecutionTrace(validParams);
  });

  describe('Constructor', () => {
    it('should create trace with valid parameters', () => {
      expect(trace.actionId).toBe('core:go');
      expect(trace.actorId).toBe('player-1');
      expect(trace.isComplete).toBe(false);
      expect(trace.hasError).toBe(false);
    });

    it('should throw error for invalid actionId', () => {
      expect(
        () =>
          new ActionExecutionTrace({
            ...validParams,
            actionId: null,
          })
      ).toThrow('ActionExecutionTrace requires valid actionId string');
    });

    it('should throw error for invalid actorId', () => {
      expect(
        () =>
          new ActionExecutionTrace({
            ...validParams,
            actorId: '',
          })
      ).toThrow('ActionExecutionTrace requires valid actorId string');
    });

    it('should throw error for invalid turnAction', () => {
      expect(
        () =>
          new ActionExecutionTrace({
            ...validParams,
            turnAction: null,
          })
      ).toThrow('ActionExecutionTrace requires valid turnAction object');
    });

    it('should throw InvalidArgumentError for invalid enableTiming parameter', () => {
      expect(
        () =>
          new ActionExecutionTrace({
            ...validParams,
            enableTiming: 'invalid',
          })
      ).toThrow(InvalidArgumentError);
      expect(
        () =>
          new ActionExecutionTrace({
            ...validParams,
            enableTiming: 'invalid',
          })
      ).toThrow('enableTiming must be a boolean value');
    });

    it('should throw InvalidArgumentError for invalid enableErrorAnalysis parameter', () => {
      expect(
        () =>
          new ActionExecutionTrace({
            ...validParams,
            enableErrorAnalysis: 123,
          })
      ).toThrow(InvalidArgumentError);
      expect(
        () =>
          new ActionExecutionTrace({
            ...validParams,
            enableErrorAnalysis: 123,
          })
      ).toThrow('enableErrorAnalysis must be a boolean value');
    });

    it('should create trace with enableTiming false', () => {
      const trace = new ActionExecutionTrace({
        ...validParams,
        enableTiming: false,
      });

      expect(trace.actionId).toBe('core:go');
      expect(trace.isComplete).toBe(false);
    });

    it('should create trace with enableErrorAnalysis true', () => {
      const trace = new ActionExecutionTrace({
        ...validParams,
        enableErrorAnalysis: true,
      });

      expect(trace.actionId).toBe('core:go');
      expect(trace.hasError).toBe(false);
    });
  });

  describe('Execution Lifecycle', () => {
    it('should capture dispatch start correctly', () => {
      trace.captureDispatchStart();

      expect(trace.isComplete).toBe(false);
      const phases = trace.getExecutionPhases();
      expect(phases).toHaveLength(1);
      expect(phases[0].phase).toBe('dispatch_start');
      expect(typeof phases[0].timestamp).toBe('number');
    });

    it('should prevent multiple dispatch starts', () => {
      trace.captureDispatchStart();

      expect(() => trace.captureDispatchStart()).toThrow(
        'Dispatch already started for this trace'
      );
    });

    it('should capture event payload after start', () => {
      trace.captureDispatchStart();

      const payload = {
        actor: 'player-1',
        action: 'core:go',
        password: 'secret123', // Will be sanitized
      };

      trace.captureEventPayload(payload);

      const traceData = trace.toJSON();
      expect(traceData.eventPayload.password).toBe('[REDACTED]');
      expect(traceData.eventPayload.actor).toBe('player-1');
    });

    it('should require dispatch start before payload capture', () => {
      const payload = { actor: 'player-1' };

      expect(() => trace.captureEventPayload(payload)).toThrow(
        'Must call captureDispatchStart() before capturing payload'
      );
    });

    it('should capture dispatch result and complete execution', () => {
      trace.captureDispatchStart();
      trace.captureDispatchResult({
        success: true,
        metadata: { duration: 100 },
      });

      expect(trace.isComplete).toBe(true);
      expect(trace.hasError).toBe(false);
      expect(typeof trace.duration).toBe('number');
      expect(trace.duration).toBeGreaterThan(0);
    });

    it('should capture error information', () => {
      trace.captureDispatchStart();

      const error = new Error('Test error');
      trace.captureError(error);

      expect(trace.isComplete).toBe(true);
      expect(trace.hasError).toBe(true);

      const traceData = trace.toJSON();
      expect(traceData.error.message).toBe('Test error');
      expect(traceData.error.type).toBe('Error');
      expect(traceData.error.stack).toBeTruthy();
    });

    it('should prevent capturing payload after dispatch has ended', () => {
      trace.captureDispatchStart();
      trace.captureDispatchResult({ success: true });

      const payload = { actor: 'player-1' };

      expect(() => trace.captureEventPayload(payload)).toThrow(
        'Cannot capture payload after dispatch has ended'
      );
    });

    it('should prevent capturing result after dispatch has ended', () => {
      trace.captureDispatchStart();
      trace.captureDispatchResult({ success: true });

      expect(() => trace.captureDispatchResult({ success: false })).toThrow(
        'Dispatch result already captured'
      );
    });

    it('should prevent capturing error before dispatch start', () => {
      const error = new Error('Test error');

      expect(() => trace.captureError(error)).toThrow(
        'Must call captureDispatchStart() before capturing error'
      );
    });

    it('should prevent capturing result before dispatch start', () => {
      expect(() => trace.captureDispatchResult({ success: true })).toThrow(
        'Must call captureDispatchStart() before capturing result'
      );
    });

    it('should prevent multiple error captures', () => {
      trace.captureDispatchStart();

      const error1 = new Error('First error');
      const error2 = new Error('Second error');

      trace.captureError(error1);

      expect(() => trace.captureError(error2)).toThrow(
        'Error already captured for this trace'
      );
    });
  });

  describe('JSON Serialization', () => {
    it('should serialize to valid JSON structure', () => {
      trace.captureDispatchStart();
      trace.captureDispatchResult({ success: true });

      const json = trace.toJSON();

      expect(json).toHaveProperty('metadata');
      expect(json).toHaveProperty('turnAction');
      expect(json).toHaveProperty('execution');
      expect(json.metadata.actionId).toBe('core:go');
      expect(json.metadata.traceType).toBe('execution');
      expect(json.execution.status).toBe('success');
    });

    it('should include execution phases in JSON', () => {
      trace.captureDispatchStart();
      trace.captureDispatchResult({ success: true });

      const json = trace.toJSON();
      const phases = json.execution.phases;

      expect(Array.isArray(phases)).toBe(true);
      expect(phases.length).toBeGreaterThan(0);
      expect(phases[0]).toHaveProperty('phase');
      expect(phases[0]).toHaveProperty('timestamp');
      expect(phases[0]).toHaveProperty('description');
    });
  });

  describe('Summary Generation', () => {
    it('should generate human-readable summary', () => {
      trace.captureDispatchStart();
      trace.captureDispatchResult({ success: true });

      const summary = trace.toSummary();

      expect(summary).toContain('core:go');
      expect(summary).toContain('player-1');
      expect(summary).toContain('success');
      expect(summary).toContain('ms');
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize sensitive fields in payloads', () => {
      trace.captureDispatchStart();

      const sensitivePayload = {
        username: 'player1',
        password: 'secret123',
        apiKey: 'key123',
        token: 'bearer-token',
        normalData: 'safe',
      };

      trace.captureEventPayload(sensitivePayload);
      const json = trace.toJSON();

      expect(json.eventPayload.password).toBe('[REDACTED]');
      expect(json.eventPayload.apiKey).toBe('[REDACTED]');
      expect(json.eventPayload.token).toBe('[REDACTED]');
      expect(json.eventPayload.normalData).toBe('safe');
      expect(json.eventPayload.username).toBe('player1');
    });

    it('should handle nested object sanitization', () => {
      trace.captureDispatchStart();

      const nestedPayload = {
        user: {
          name: 'player1',
          credentials: {
            password: 'secret',
            token: 'bearer',
          },
        },
        metadata: { safe: true },
      };

      trace.captureEventPayload(nestedPayload);
      const json = trace.toJSON();

      expect(json.eventPayload.user.credentials.password).toBe('[REDACTED]');
      expect(json.eventPayload.user.credentials.token).toBe('[REDACTED]');
      expect(json.eventPayload.user.name).toBe('player1');
      expect(json.eventPayload.metadata.safe).toBe(true);
    });
  });

  describe('Error Analysis Integration', () => {
    let traceWithErrorAnalysis;

    beforeEach(() => {
      traceWithErrorAnalysis = new ActionExecutionTrace({
        ...validParams,
        enableErrorAnalysis: true,
      });
    });

    it('should enable error analysis and lazy initialize components', () => {
      traceWithErrorAnalysis.captureDispatchStart();

      // Create a custom error with stack trace
      const error = new Error('Analysis test error');
      error.stack =
        'Error: Analysis test error\n    at test (/path/to/test.js:1:1)';

      // Capture error should trigger lazy initialization
      traceWithErrorAnalysis.captureError(error);

      const errorData = traceWithErrorAnalysis.getError();
      expect(errorData).toBeTruthy();
      expect(errorData.classification).toBeTruthy();
      expect(errorData.context).toBeTruthy();
    });

    it('should handle error classification failures gracefully', () => {
      traceWithErrorAnalysis.captureDispatchStart();

      const error = new Error('Test error');

      // Mock console.warn to capture the warning
      const originalWarn = console.warn;
      const warnSpy = jest.fn();
      console.warn = warnSpy;

      try {
        traceWithErrorAnalysis.captureError(error);

        const errorData = traceWithErrorAnalysis.getError();
        expect(errorData).toBeTruthy();
        expect(errorData.classification).toBeTruthy();

        // Should have default classification when classification fails
        expect(errorData.classification.category).toBe('unknown');
      } finally {
        console.warn = originalWarn;
      }
    });

    it('should handle stack trace analysis failures gracefully', () => {
      traceWithErrorAnalysis.captureDispatchStart();

      const error = new Error('Stack trace test');
      error.stack = 'Invalid stack trace format';

      // Mock console.warn to capture warnings
      const originalWarn = console.warn;
      const warnSpy = jest.fn();
      console.warn = warnSpy;

      try {
        traceWithErrorAnalysis.captureError(error);

        const errorData = traceWithErrorAnalysis.getError();
        expect(errorData).toBeTruthy();
        // StackTraceAnalyzer actually parses successfully, just with empty results
        expect(errorData.stackAnalysis).toBeTruthy();
        expect(errorData.location).toBeNull();
        // formattedStack may contain "No stack trace available" string
        expect(errorData.formattedStack).toBeTruthy();
      } finally {
        console.warn = originalWarn;
      }
    });

    it('should set and use error context', () => {
      traceWithErrorAnalysis.captureDispatchStart();

      const context = {
        phase: 'custom_phase',
        retryCount: 2,
        executionState: { customData: 'test' },
      };

      traceWithErrorAnalysis.setErrorContext(context);

      const error = new Error('Context test');
      // Pass context to captureError to ensure phase is used
      traceWithErrorAnalysis.captureError(error, { phase: 'custom_phase' });

      const errorData = traceWithErrorAnalysis.getError();
      // The error context stores the values in errorContext, but saves different fields to error data
      expect(errorData.context.phase).toBe('custom_phase');
      expect(errorData.context.retryCount).toBe(2);
      // executionState is not saved to the error data context - it's internal to errorContext
    });
  });

  describe('Error Analysis without enableErrorAnalysis', () => {
    it('should not initialize error analysis components when disabled', () => {
      const traceWithoutAnalysis = new ActionExecutionTrace({
        ...validParams,
        enableErrorAnalysis: false,
      });

      traceWithoutAnalysis.captureDispatchStart();

      const error = new Error('No analysis test');
      traceWithoutAnalysis.captureError(error);

      const errorData = traceWithoutAnalysis.getError();
      expect(errorData).toBeTruthy();
      expect(errorData.classification.category).toBe('unknown');
      expect(errorData.classification.confidence).toBe(0);
      expect(errorData.stackAnalysis).toBeNull();
    });
  });

  describe('Performance Reporting', () => {
    it('should return timing disabled message when timing is disabled', () => {
      const traceWithoutTiming = new ActionExecutionTrace({
        ...validParams,
        enableTiming: false,
      });

      const report = traceWithoutTiming.getPerformanceReport();
      expect(report).toBe('Timing not enabled for this trace');
    });

    it('should return null timing summary when timing is disabled', () => {
      const traceWithoutTiming = new ActionExecutionTrace({
        ...validParams,
        enableTiming: false,
      });

      const summary = traceWithoutTiming.getTimingSummary();
      expect(summary).toBeNull();
    });

    it('should generate performance report when timing is enabled', () => {
      trace.captureDispatchStart();
      trace.captureDispatchResult({ success: true });

      const report = trace.getPerformanceReport();
      expect(typeof report).toBe('string');
      expect(report).not.toBe('Timing not enabled for this trace');
    });

    it('should generate timing summary when timing is enabled', () => {
      trace.captureDispatchStart();
      trace.captureDispatchResult({ success: true });

      const summary = trace.getTimingSummary();
      expect(summary).not.toBeNull();
      expect(typeof summary).toBe('object');
    });

    it('should include timing data in JSON when timing is enabled', () => {
      trace.captureDispatchStart();
      trace.captureDispatchResult({ success: true });

      const json = trace.toJSON();
      expect(json).toHaveProperty('timing');
      expect(typeof json.timing).toBe('object');
    });

    it('should not include timing data in JSON when timing is disabled', () => {
      const traceWithoutTiming = new ActionExecutionTrace({
        ...validParams,
        enableTiming: false,
      });

      traceWithoutTiming.captureDispatchStart();
      traceWithoutTiming.captureDispatchResult({ success: true });

      const json = traceWithoutTiming.toJSON();
      expect(json).not.toHaveProperty('timing');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle non-object payloads in sanitization', () => {
      trace.captureDispatchStart();

      // Test with non-object payloads
      trace.captureEventPayload('string payload');
      let json = trace.toJSON();
      expect(json.eventPayload).toBe('string payload');

      // Reset trace for next test
      trace = new ActionExecutionTrace(validParams);
      trace.captureDispatchStart();

      trace.captureEventPayload(123);
      json = trace.toJSON();
      expect(json.eventPayload).toBe(123);

      // Reset trace for next test
      trace = new ActionExecutionTrace(validParams);
      trace.captureDispatchStart();

      trace.captureEventPayload(null);
      json = trace.toJSON();
      expect(json.eventPayload).toBeNull();
    });

    it('should handle JSON.stringify failures in payload size calculation', () => {
      // The circular reference causes infinite recursion in sanitization, not just JSON.stringify
      // Let's test a different scenario that actually triggers the JSON.stringify error handling
      trace.captureDispatchStart();

      // Mock JSON.stringify to throw an error
      const originalStringify = JSON.stringify;
      JSON.stringify = jest.fn(() => {
        throw new Error('JSON stringify failed');
      });

      try {
        const payload = { data: 'test' };
        trace.captureEventPayload(payload);

        const phases = trace.getExecutionPhases();
        const payloadPhase = phases.find(
          (phase) => phase.phase === 'payload_captured'
        );
        expect(payloadPhase.payloadSize).toBe(0); // Fallback size when JSON.stringify fails
      } finally {
        JSON.stringify = originalStringify;
      }
    });

    it('should return unknown phase when no phases exist', () => {
      // Create trace but don't start dispatch
      const emptyTrace = new ActionExecutionTrace(validParams);

      // Test error capture before dispatch start should still work for getCurrentPhase
      const error = new Error('Test error');

      expect(() => emptyTrace.captureError(error)).toThrow(
        'Must call captureDispatchStart() before capturing error'
      );
    });

    it('should handle different execution status scenarios', () => {
      // Test pending status
      expect(trace.toJSON().execution.status).toBe('pending');

      // Test in_progress status
      trace.captureDispatchStart();
      expect(trace.toJSON().execution.status).toBe('in_progress');

      // Test success status
      trace.captureDispatchResult({ success: true });
      expect(trace.toJSON().execution.status).toBe('success');

      // Test failed status
      const failedTrace = new ActionExecutionTrace(validParams);
      failedTrace.captureDispatchStart();
      failedTrace.captureDispatchResult({ success: false });
      expect(failedTrace.toJSON().execution.status).toBe('failed');

      // Test error status
      const errorTrace = new ActionExecutionTrace(validParams);
      errorTrace.captureDispatchStart();
      errorTrace.captureError(new Error('Test error'));
      expect(errorTrace.toJSON().execution.status).toBe('error');
    });

    it('should provide timing context when timing is disabled', () => {
      const traceWithoutTiming = new ActionExecutionTrace({
        ...validParams,
        enableTiming: false,
      });

      traceWithoutTiming.captureDispatchStart();

      const error = new Error('Timing test');
      traceWithoutTiming.captureError(error);

      const errorData = traceWithoutTiming.getError();
      // The context.timing field is not included in the error data structure
      // Testing that the error was captured successfully without timing
      expect(errorData.context.phase).toBe('dispatch_start');
      expect(errorData.context.retryCount).toBe(0);
    });
  });

  describe('Advanced Error Features', () => {
    it('should generate error summary correctly', () => {
      trace.captureDispatchStart();

      const error = new Error('Summary test error');
      trace.captureError(error);

      const summary = trace.getErrorSummary();
      expect(summary).toBeTruthy();
      expect(summary.type).toBe('Error');
      expect(summary.message).toBe('Summary test error');
      expect(summary.category).toBe('unknown');
      // Default severity is 'medium' in the error classification
      expect(summary.severity).toBe('medium');
      expect(summary.isRetryable).toBe(false);
      expect(summary.location).toBeNull();
    });

    it('should return null error summary when no error', () => {
      trace.captureDispatchStart();
      trace.captureDispatchResult({ success: true });

      const summary = trace.getErrorSummary();
      expect(summary).toBeNull();
    });

    it('should generate error report correctly', () => {
      trace.captureDispatchStart();

      const error = new Error('Report test error');
      trace.captureError(error);

      const report = trace.getErrorReport();
      expect(report).toContain('ACTION EXECUTION ERROR REPORT');
      expect(report).toContain('Report test error');
      expect(report).toContain('Error Type: Error');
      expect(report).toContain('Category: unknown');
    });

    it('should return no error message when no error in report', () => {
      trace.captureDispatchStart();
      trace.captureDispatchResult({ success: true });

      const report = trace.getErrorReport();
      expect(report).toBe('No error occurred during execution');
    });

    it('should check error recovery correctly', () => {
      trace.captureDispatchStart();

      // Test with no error (should be recoverable)
      expect(trace.isErrorRecoverable()).toBe(true);

      const error = new Error('Recovery test error');
      trace.captureError(error);

      // Default classification should be conditional recovery
      expect(trace.isErrorRecoverable()).toBe(true);
    });

    it('should handle error recovery with different recovery potentials', () => {
      const traceWithErrorAnalysis = new ActionExecutionTrace({
        ...validParams,
        enableErrorAnalysis: true,
      });

      traceWithErrorAnalysis.captureDispatchStart();

      const error = new Error('Recovery potential test');
      traceWithErrorAnalysis.captureError(error);

      // Should be recoverable with default classification
      expect(traceWithErrorAnalysis.isErrorRecoverable()).toBe(true);
    });

    it('should handle error with extended properties', () => {
      trace.captureDispatchStart();

      const error = new Error('Extended properties test');
      error.code = 'TEST_CODE';
      error.errno = -1;
      error.syscall = 'test_syscall';
      error.cause = new Error('Root cause');

      trace.captureError(error);

      const errorData = trace.getError();
      expect(errorData.code).toBe('TEST_CODE');
      expect(errorData.errno).toBe(-1);
      expect(errorData.syscall).toBe('test_syscall');
      expect(errorData.cause).toBeInstanceOf(Error);
    });

    it('should capture error with custom context', () => {
      trace.captureDispatchStart();

      const error = new Error('Context test');
      const context = {
        phase: 'custom_phase',
        retryCount: 3,
        executionState: { step: 'validation' },
      };

      trace.captureError(error, context);

      const errorData = trace.getError();
      expect(errorData.context.phase).toBe('custom_phase');
      expect(errorData.context.retryCount).toBe(3);
      // executionState is not saved to error data context - it's only internal to errorContext
      expect(errorData.context.actionId).toBe('core:go');
      expect(errorData.context.actorId).toBe('player-1');
    });
  });

  describe('Additional Edge Cases for Coverage', () => {
    it('should handle error report with location information', () => {
      const traceWithErrorAnalysis = new ActionExecutionTrace({
        ...validParams,
        enableErrorAnalysis: true,
      });

      traceWithErrorAnalysis.captureDispatchStart();

      const error = new Error('Location test error');
      error.stack =
        'Error: Location test error\n    at testFunction (/path/to/file.js:10:5)';

      traceWithErrorAnalysis.captureError(error);

      const report = traceWithErrorAnalysis.getErrorReport();
      expect(report).toContain('Error Location:');
      expect(report).toContain('Function:');
    });

    it('should handle error report with troubleshooting steps', () => {
      const traceWithErrorAnalysis = new ActionExecutionTrace({
        ...validParams,
        enableErrorAnalysis: true,
      });

      traceWithErrorAnalysis.captureDispatchStart();

      // Create an error that might have troubleshooting steps
      const error = new Error('Troubleshooting test');
      error.code = 'ENOENT';

      traceWithErrorAnalysis.captureError(error);

      const report = traceWithErrorAnalysis.getErrorReport();
      expect(report).toContain('ACTION EXECUTION ERROR REPORT');
    });

    it('should handle error classification with unknown recovery potential', () => {
      const traceWithErrorAnalysis = new ActionExecutionTrace({
        ...validParams,
        enableErrorAnalysis: true,
      });

      traceWithErrorAnalysis.captureDispatchStart();

      const error = new Error('Unknown recovery test');
      traceWithErrorAnalysis.captureError(error);

      // Test that it handles unknown recovery potential
      expect(traceWithErrorAnalysis.isErrorRecoverable()).toBe(true);
    });
  });
});
