/**
 * @file Comprehensive error handling tests for ActionExecutionTrace
 * Tests multiple error capture scenarios and concurrency safety
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionExecutionTrace } from '../../../../src/actions/tracing/actionExecutionTrace.js';

describe('ActionExecutionTrace - Enhanced Error Handling', () => {
  let trace;
  
  const baseTraceOptions = {
    actionId: 'test-action',
    actorId: 'test-actor',
    turnAction: {
      actionDefinitionId: 'test-action',
      commandString: 'test command',
      parameters: {},
    },
  };

  beforeEach(() => {
    trace = new ActionExecutionTrace(baseTraceOptions);
  });

  describe('Single Error Capture (Backward Compatibility)', () => {
    it('should capture single error successfully', () => {
      trace.captureDispatchStart();
      const error = new Error('Test error');
      
      trace.captureError(error);
      
      expect(trace.hasError).toBe(true);
      expect(trace.getError()).toBeDefined();
      expect(trace.getError().message).toBe('Test error');
    });

    it('should ignore duplicate error capture by default', () => {
      trace.captureDispatchStart();
      const error1 = new Error('First error');
      const error2 = new Error('Second error');
      
      trace.captureError(error1);
      trace.captureError(error2); // Should be ignored
      
      expect(trace.getError().message).toBe('First error');
      expect(trace.hasMultipleErrors()).toBe(false);
    });

    it('should handle concurrent error capture attempts gracefully', async () => {
      trace.captureDispatchStart();
      
      const error1 = new Error('Concurrent error 1');
      const error2 = new Error('Concurrent error 2');
      
      // Simulate concurrent access
      const promises = [
        Promise.resolve().then(() => trace.captureError(error1)),
        Promise.resolve().then(() => trace.captureError(error2)),
      ];
      
      await Promise.all(promises);
      
      expect(trace.hasError).toBe(true);
      expect(trace.getError()).toBeDefined();
      // Only one error should be captured due to concurrency protection
    });
  });

  describe('Multiple Error Capture Support', () => {
    it('should support multiple error captures when explicitly allowed', () => {
      trace.captureDispatchStart();
      const error1 = new Error('First error');
      const error2 = new Error('Second error');
      
      trace.captureError(error1);
      trace.captureError(error2, {}, true); // Allow multiple
      
      expect(trace.hasError).toBe(true);
      expect(trace.hasMultipleErrors()).toBe(true);
      expect(trace.getError().message).toBe('Second error');
      expect(trace.getErrorHistory()).toHaveLength(1);
      expect(trace.getErrorHistory()[0].message).toBe('First error');
    });

    it('should update existing error with updateError method', () => {
      trace.captureDispatchStart();
      const error1 = new Error('Initial error');
      const error2 = new Error('Updated error');
      
      trace.captureError(error1);
      trace.updateError(error2, { retryCount: 1 });
      
      expect(trace.getError().message).toBe('Updated error');
      expect(trace.hasMultipleErrors()).toBe(true);
      expect(trace.getErrorHistory()).toHaveLength(1);
    });

    it('should add errors to history without replacing current error', () => {
      trace.captureDispatchStart();
      const error1 = new Error('Main error');
      const error2 = new Error('Historical error');
      
      trace.captureError(error1);
      trace.addErrorToHistory(error2, { phase: 'retry' });
      
      expect(trace.getError().message).toBe('Main error');
      expect(trace.getErrorHistory()).toHaveLength(1);
      expect(trace.getErrorHistory()[0].message).toBe('Historical error');
      expect(trace.getErrorHistory()[0].context.phase).toBe('retry');
    });
  });

  describe('Error Context and Classification', () => {
    it('should preserve error context across multiple captures', () => {
      trace.captureDispatchStart();
      
      trace.setErrorContext({ 
        retryCount: 2,
        phase: 'execution'
      });
      
      const error1 = new Error('Context error');
      trace.captureError(error1, { additionalContext: 'test' });
      
      const errorDetails = trace.getError();
      expect(errorDetails.context.retryCount).toBe(2);
      expect(errorDetails.context.phase).toBe('execution');
    });

    it('should maintain error history with full context', () => {
      trace.captureDispatchStart();
      
      const error1 = new Error('First error');
      const error2 = new Error('Second error');
      
      trace.captureError(error1, { phase: 'dispatch' });
      trace.captureError(error2, { phase: 'retry' }, true);
      
      const history = trace.getErrorHistory();
      expect(history).toHaveLength(1);
      expect(history[0].message).toBe('First error');
      expect(history[0]).toHaveProperty('timestamp');
      expect(history[0]).toHaveProperty('capturedAt');
    });
  });

  describe('JSON Export with Error History', () => {
    it('should include error history in JSON export', () => {
      trace.captureDispatchStart();
      
      const error1 = new Error('Export error 1');
      const error2 = new Error('Export error 2');
      
      trace.captureError(error1);
      trace.captureError(error2, {}, true);
      
      const json = trace.toJSON();
      
      expect(json.hasError).toBe(true);
      expect(json.hasMultipleErrors).toBe(true);
      expect(json.errorHistory).toHaveLength(1);
      expect(json.error.message).toBe('Export error 2');
      expect(json.errorHistory[0].message).toBe('Export error 1');
    });

    it('should handle export for traces without errors', () => {
      trace.captureDispatchStart();
      trace.captureDispatchResult({ success: true });
      
      const json = trace.toJSON();
      
      expect(json.hasError).toBe(false);
      expect(json.hasMultipleErrors).toBe(false);
      expect(json.errorHistory).toHaveLength(0);
      expect(json.error).toBeNull();
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should support retry scenarios with error progression', () => {
      trace.captureDispatchStart();
      
      // Initial failure
      const networkError = new Error('Network timeout');
      trace.captureError(networkError, { 
        phase: 'network_call',
        retryCount: 0 
      });
      
      // Retry failure
      const retryError = new Error('Retry failed');
      trace.updateError(retryError, {
        phase: 'retry',
        retryCount: 1
      });
      
      // Note: In this scenario, we've already captured errors
      // The trace is complete after error capture, so no result capture is needed
      
      expect(trace.getError().message).toBe('Retry failed');
      expect(trace.getErrorHistory()).toHaveLength(1);
      expect(trace.getErrorHistory()[0].message).toBe('Network timeout');
      expect(trace.isComplete).toBe(true);
    });

    it('should maintain error recoverability information', () => {
      trace.captureDispatchStart();
      
      const recoverableError = new Error('Recoverable error');
      trace.captureError(recoverableError, { 
        isRetryable: true,
        phase: 'validation' 
      });
      
      // Default recovery potential should allow recovery
      expect(trace.isErrorRecoverable()).toBe(true);
    });
  });

  describe('Concurrency and Thread Safety', () => {
    it('should handle rapid sequential error captures', () => {
      trace.captureDispatchStart();
      
      const errors = Array.from({ length: 10 }, (_, i) => 
        new Error(`Rapid error ${i}`)
      );
      
      // Rapidly capture errors
      errors.forEach(error => trace.captureError(error));
      
      // Only first error should be captured due to protection
      expect(trace.hasError).toBe(true);
      expect(trace.getError().message).toBe('Rapid error 0');
      expect(trace.hasMultipleErrors()).toBe(false);
    });

    it('should maintain state consistency under concurrent access', async () => {
      trace.captureDispatchStart();
      
      const concurrentErrors = Array.from({ length: 5 }, (_, i) => 
        new Error(`Concurrent error ${i}`)
      );
      
      // Simulate concurrent error captures
      const promises = concurrentErrors.map((error) => 
        new Promise(resolve => {
          setTimeout(() => {
            trace.captureError(error);
            resolve();
          }, Math.random() * 10);
        })
      );
      
      await Promise.all(promises);
      
      expect(trace.hasError).toBe(true);
      expect(trace.getError()).toBeDefined();
      // State should remain consistent
      expect(trace.isComplete).toBe(true);
    });
  });
});