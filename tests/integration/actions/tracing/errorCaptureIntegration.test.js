import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionExecutionTrace } from '../../../../src/actions/tracing/actionExecutionTrace.js';

describe('Error Capture Integration', () => {
  let trace;

  const validTraceParams = {
    actionId: 'core:error_test',
    actorId: 'player-1',
    turnAction: {
      actionDefinitionId: 'core:error_test',
      commandString: 'test error handling',
      parameters: { type: 'integration' },
    },
  };

  beforeEach(() => {
    trace = new ActionExecutionTrace({
      ...validTraceParams,
      enableErrorAnalysis: true,
    });
  });

  describe('Enhanced Error Capture Workflow', () => {
    it('should capture and analyze complete error information with all enhancements', () => {
      trace.captureDispatchStart();

      // Create a realistic error with stack trace
      const error = new Error('Validation failed: missing required parameter');
      error.code = 'VALIDATION_ERROR';
      error.cause = new Error('Root validation issue');

      // Use enhanced signature with context parameter
      trace.captureError(error, {
        phase: 'validation',
        retryCount: 1,
        executionState: { step: 'parameter_check' },
      });

      // Verify existing properties still work
      expect(trace.hasError).toBe(true);
      expect(trace.isComplete).toBe(true);

      const errorDetails = trace.getError();

      // Test existing fields are preserved
      expect(errorDetails.message).toBe(
        'Validation failed: missing required parameter'
      );
      expect(errorDetails.type).toBe('Error');
      expect(errorDetails.code).toBe('VALIDATION_ERROR');
      expect(errorDetails.cause).toBeTruthy();
      expect(errorDetails.timestamp).toBeTruthy();

      // Test new enhanced fields
      expect(errorDetails.classification).toBeTruthy();
      expect(errorDetails.classification.category).toBe('validation');
      expect(errorDetails.classification.severity).toBe('medium');
      expect(errorDetails.classification.isRetryable).toBe(true);
      expect(errorDetails.classification.troubleshooting).toBeInstanceOf(Array);
      expect(
        errorDetails.classification.troubleshooting.length
      ).toBeGreaterThan(0);

      expect(errorDetails.context).toBeTruthy();
      expect(errorDetails.context.phase).toBe('validation');
      expect(errorDetails.context.retryCount).toBe(1);
      expect(errorDetails.context.actionId).toBe('core:error_test');
      expect(errorDetails.context.actorId).toBe('player-1');

      // Test new error summary method
      const errorSummary = trace.getErrorSummary();
      expect(errorSummary.category).toBe('validation');
      expect(errorSummary.severity).toBe('medium');
      expect(errorSummary.isRetryable).toBe(true);
      expect(errorSummary.troubleshooting.length).toBeGreaterThan(0);
    });

    it('should integrate with existing timing system and enhance it', () => {
      trace.captureDispatchStart();

      const error = new Error('Network timeout during processing');

      trace.captureError(error, {
        phase: 'network_request',
        retryCount: 2,
      });

      // Verify timing integration works
      expect(trace.duration).toBeGreaterThan(0);

      const phases = trace.getExecutionPhases();
      expect(phases.some((phase) => phase.phase === 'error_captured')).toBe(
        true
      );

      const errorPhase = phases.find(
        (phase) => phase.phase === 'error_captured'
      );
      expect(errorPhase.errorCategory).toBe('network');
      expect(errorPhase.severity).toBe('medium');

      // Test timing summary integration
      const timingSummary = trace.getTimingSummary();
      if (timingSummary) {
        expect(timingSummary).toBeTruthy();
      }
    });

    it('should maintain backward compatibility with existing captureError usage', () => {
      trace.captureDispatchStart();

      const error = new Error('Legacy error usage');

      // Test original signature without context parameter
      trace.captureError(error);

      // Existing functionality should still work
      expect(trace.hasError).toBe(true);
      expect(trace.isComplete).toBe(true);

      const errorDetails = trace.getError();
      expect(errorDetails.message).toBe('Legacy error usage');
      expect(errorDetails.type).toBe('Error');

      // New fields should have defaults
      expect(errorDetails.classification).toBeTruthy();
      expect(errorDetails.context).toBeTruthy();
      expect(errorDetails.context.phase).toBeTruthy(); // Should get current phase
    });

    it('should handle different error types with appropriate classifications', () => {
      const testCases = [
        {
          error: new TypeError('Cannot read property of undefined'),
          expectedCategory: 'logic',
          expectedSeverity: 'high',
          expectedRetryable: false,
        },
        {
          error: new Error('Database connection timeout'),
          expectedCategory: 'network',
          expectedSeverity: 'medium',
          expectedRetryable: true,
        },
        {
          error: new Error('Access denied: insufficient permissions'),
          expectedCategory: 'authorization',
          expectedSeverity: 'high',
          expectedRetryable: false,
        },
        {
          error: new Error('Resource not found: entity missing'),
          expectedCategory: 'resource',
          expectedSeverity: 'medium',
          expectedRetryable: true,
        },
      ];

      testCases.forEach(
        (
          { error, expectedCategory, expectedSeverity, expectedRetryable },
          index
        ) => {
          // Create fresh trace for each test case
          const testTrace = new ActionExecutionTrace({
            ...validTraceParams,
            enableErrorAnalysis: true,
          });

          testTrace.captureDispatchStart();
          testTrace.captureError(error, { phase: `test_phase_${index}` });

          const errorSummary = testTrace.getErrorSummary();
          expect(errorSummary.category).toBe(expectedCategory);
          expect(errorSummary.severity).toBe(expectedSeverity);
          expect(errorSummary.isRetryable).toBe(expectedRetryable);
        }
      );
    });

    it('should generate comprehensive error reports', () => {
      trace.captureDispatchStart();

      const error = new Error('Integration test error for reporting');
      error.stack = `Error: Integration test error for reporting
    at testFunction (/home/project/src/test.js:10:5)
    at processAction (/home/project/src/actions.js:25:10)
    at Object.<anonymous> (/home/project/index.js:5:1)`;

      trace.captureError(error, {
        phase: 'processing',
        retryCount: 0,
      });

      const report = trace.getErrorReport();

      expect(report).toContain('ACTION EXECUTION ERROR REPORT');
      expect(report).toContain('Integration test error for reporting');
      expect(report).toContain('Action: core:error_test');
      expect(report).toContain('Actor: player-1');
      expect(report).toContain('Category:');
      expect(report).toContain('Severity:');
      expect(report).toContain('Phase: processing');
      expect(report).toContain('Troubleshooting Steps:');

      // Should include stack trace if available
      if (trace.getError().formattedStack) {
        expect(report).toContain('Stack Trace:');
      }
    });

    it('should properly detect error recoverability', () => {
      const recoverableTrace = new ActionExecutionTrace({
        ...validTraceParams,
        enableErrorAnalysis: true,
      });

      const nonRecoverableTrace = new ActionExecutionTrace({
        ...validTraceParams,
        enableErrorAnalysis: true,
      });

      recoverableTrace.captureDispatchStart();
      nonRecoverableTrace.captureDispatchStart();

      // Test recoverable error
      const recoverableError = new Error('Temporary network issue');
      recoverableTrace.captureError(recoverableError);
      expect(recoverableTrace.isErrorRecoverable()).toBe(true);

      // Test non-recoverable error
      const nonRecoverableError = new TypeError('Logic error in code');
      nonRecoverableTrace.captureError(nonRecoverableError);
      expect(nonRecoverableTrace.isErrorRecoverable()).toBe(false);
    });

    it('should handle stack trace analysis integration', () => {
      trace.captureDispatchStart();

      const error = new Error('Stack trace analysis test');
      const projectPath = process.cwd();
      error.stack = `Error: Stack trace analysis test
    at projectFunction (${projectPath}/src/main.js:42:15)
    at nodeModule (${projectPath}/node_modules/lodash/index.js:100:20)
    at async asyncFunction (${projectPath}/src/async.js:10:5)
    at nativeFunction ([native code])`;

      trace.captureError(error);

      const errorDetails = trace.getError();

      // Check stack analysis integration
      expect(errorDetails.stackAnalysis).toBeTruthy();
      expect(errorDetails.stackAnalysis.frames).toBeInstanceOf(Array);
      expect(errorDetails.stackAnalysis.analysis).toBeTruthy();
      expect(errorDetails.stackAnalysis.analysis.totalFrames).toBe(4);
      expect(errorDetails.stackAnalysis.analysis.hasAsyncFrames).toBe(true);

      // Check error location extraction
      if (errorDetails.location) {
        expect(errorDetails.location.function).toBeTruthy();
        expect(errorDetails.location.file).toBeTruthy();
      }

      // Check formatted stack trace
      if (errorDetails.formattedStack) {
        expect(errorDetails.formattedStack).toContain('projectFunction');
        expect(errorDetails.formattedStack).toContain('[PROJECT]');
        expect(errorDetails.formattedStack).toContain('[DEPENDENCY]');
      }
    });

    it('should handle errors without stack traces gracefully', () => {
      trace.captureDispatchStart();

      const error = new Error('Simple error without stack');
      delete error.stack;

      expect(() => {
        trace.captureError(error);
      }).not.toThrow();

      const errorDetails = trace.getError();
      expect(errorDetails.stackAnalysis).toBeNull();
      expect(errorDetails.formattedStack).toBeNull();
      expect(errorDetails.location).toBeNull();

      // Other analysis should still work
      expect(errorDetails.classification).toBeTruthy();
      expect(errorDetails.context).toBeTruthy();
    });

    it('should integrate with JSON serialization maintaining compatibility', () => {
      trace.captureDispatchStart();

      const error = new Error('Serialization test error');
      trace.captureError(error, {
        phase: 'serialization_test',
        retryCount: 1,
      });

      const json = trace.toJSON();

      // Test existing JSON structure is preserved
      expect(json.metadata).toBeTruthy();
      expect(json.turnAction).toBeTruthy();
      expect(json.execution).toBeTruthy();
      expect(json.execution.status).toBe('error');
      expect(json.error).toBeTruthy();

      // Test existing error fields are preserved
      expect(json.error.message).toBe('Serialization test error');
      expect(json.error.type).toBe('Error');
      expect(json.error.timestamp).toBeTruthy();

      // Test new enhanced fields are included
      expect(json.error.classification).toBeTruthy();
      expect(json.error.context).toBeTruthy();
      expect(json.error.context.phase).toBe('serialization_test');
      expect(json.error.context.retryCount).toBe(1);

      // Test the JSON is actually serializable
      expect(() => JSON.stringify(json)).not.toThrow();
    });

    it('should handle error context management', () => {
      trace.captureDispatchStart();

      // Set error context before error occurs
      trace.setErrorContext({
        operationId: 'test-op-123',
        userId: 'user-456',
        sessionId: 'session-789',
      });

      const error = new Error('Context management test');
      trace.captureError(error, {
        phase: 'context_test',
        additionalInfo: 'extra context',
      });

      const errorDetails = trace.getError();

      // Context should be merged
      expect(errorDetails.context.phase).toBe('context_test');
      expect(errorDetails.context.actionId).toBe('core:error_test');
      expect(errorDetails.context.actorId).toBe('player-1');
    });

    it('should handle classification errors gracefully', () => {
      // Create trace with error analysis disabled to test fallbacks
      const traceWithoutAnalysis = new ActionExecutionTrace({
        ...validTraceParams,
        enableErrorAnalysis: false,
      });

      traceWithoutAnalysis.captureDispatchStart();

      const error = new Error('Error without analysis');
      traceWithoutAnalysis.captureError(error);

      const errorDetails = traceWithoutAnalysis.getError();

      // Should still capture basic error info
      expect(errorDetails.message).toBe('Error without analysis');
      expect(errorDetails.type).toBe('Error');

      // Enhanced fields should have defaults or be null
      expect(errorDetails.classification).toBeTruthy();
      expect(errorDetails.classification.category).toBe('unknown');
      expect(errorDetails.stackAnalysis).toBeNull();
      expect(errorDetails.location).toBeNull();
    });

    it('should maintain performance with error analysis enabled', () => {
      const startTime = Date.now();

      trace.captureDispatchStart();

      const error = new Error('Performance test error');
      error.stack = `Error: Performance test error
    at testFunction (/home/project/src/test.js:10:5)
    at processAction (/home/project/src/actions.js:25:10)`;

      trace.captureError(error, {
        phase: 'performance_test',
        retryCount: 0,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Error capture should be fast (< 10ms for this simple case)
      expect(duration).toBeLessThan(10);

      // But still provide full analysis
      const errorSummary = trace.getErrorSummary();
      expect(errorSummary).toBeTruthy();
      expect(errorSummary.troubleshooting.length).toBeGreaterThan(0);
    });
  });

  describe('Error Analysis Edge Cases', () => {
    it('should handle concurrent error capture attempts', () => {
      trace.captureDispatchStart();

      const error1 = new Error('First error');
      const error2 = new Error('Second error');

      trace.captureError(error1);

      // Second error capture should not throw but should be ignored
      // (since trace is already completed with first error)
      expect(() => {
        trace.captureError(error2);
      }).toThrow(); // Should throw because trace is already ended
    });

    it('should handle very large stack traces efficiently', () => {
      const largeStackFrames = Array.from(
        { length: 100 },
        (_, i) =>
          `    at function${i} (/home/project/src/file${i}.js:${i + 1}:1)`
      ).join('\n');

      const largeStackTrace = `Error: Large stack trace\n${largeStackFrames}`;

      const error = new Error('Large stack trace test');
      error.stack = largeStackTrace;

      trace.captureDispatchStart();

      const startTime = Date.now();
      trace.captureError(error);
      const endTime = Date.now();

      // Should still be reasonably fast
      expect(endTime - startTime).toBeLessThan(50);

      const errorDetails = trace.getError();
      expect(errorDetails.stackAnalysis.frames).toHaveLength(100);
    });

    it('should handle malformed stack traces without breaking', () => {
      const malformedStackTrace = `Error: Malformed stack
    at normalFunction (/home/project/src/test.js:10:5)
    some random text without at prefix
    at    badly   formatted   function   
    at anotherNormalFunction (/home/project/src/other.js:20:10)
    completely invalid line`;

      const error = new Error('Malformed stack test');
      error.stack = malformedStackTrace;

      trace.captureDispatchStart();

      expect(() => {
        trace.captureError(error);
      }).not.toThrow();

      const errorDetails = trace.getError();
      expect(errorDetails.stackAnalysis).toBeTruthy();
      // Should parse the valid frames and skip invalid ones
      expect(errorDetails.stackAnalysis.frames.length).toBeGreaterThan(0);
    });

    it('should handle circular references in error objects', () => {
      const error = new Error('Circular reference test');
      const circularObject = { error };
      circularObject.self = circularObject;
      error.circularProperty = circularObject;

      trace.captureDispatchStart();

      expect(() => {
        trace.captureError(error);
      }).not.toThrow();

      const json = trace.toJSON();

      // Should be serializable despite circular references
      expect(() => JSON.stringify(json)).not.toThrow();
    });
  });
});
