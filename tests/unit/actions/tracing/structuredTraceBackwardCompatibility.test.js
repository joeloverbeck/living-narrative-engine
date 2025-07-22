/**
 * @file Backward compatibility tests for StructuredTrace
 * @see src/actions/tracing/structuredTrace.js
 * @see src/actions/tracing/traceContext.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import StructuredTrace from '../../../../src/actions/tracing/structuredTrace.js';
import {
  TraceContext,
  TRACE_INFO,
  TRACE_SUCCESS,
  TRACE_FAILURE,
  TRACE_STEP,
  TRACE_ERROR,
  TRACE_DATA,
} from '../../../../src/actions/tracing/traceContext.js';

describe('StructuredTrace - Backward Compatibility', () => {
  let structuredTrace;
  let regularTrace;

  beforeEach(() => {
    structuredTrace = new StructuredTrace();
    regularTrace = new TraceContext();
  });

  describe('API compatibility', () => {
    it('should have all TraceContext methods', () => {
      // Check that all methods exist
      expect(typeof structuredTrace.addLog).toBe('function');
      expect(typeof structuredTrace.info).toBe('function');
      expect(typeof structuredTrace.success).toBe('function');
      expect(typeof structuredTrace.failure).toBe('function');
      expect(typeof structuredTrace.step).toBe('function');
      expect(typeof structuredTrace.error).toBe('function');
      expect(typeof structuredTrace.data).toBe('function');

      // Check logs property exists
      expect(structuredTrace.logs).toBeDefined();
      expect(Array.isArray(structuredTrace.logs)).toBe(true);
    });
  });

  describe('behavioral compatibility', () => {
    it('should produce identical logs to TraceContext for addLog', () => {
      const testCases = [
        [TRACE_INFO, 'info message', 'source1'],
        [TRACE_ERROR, 'error message', 'source2', { error: 'details' }],
        [TRACE_SUCCESS, 'success message', 'source3', null],
        [TRACE_FAILURE, 'failure message', 'source4', undefined],
        [TRACE_STEP, 'step message', 'source5', { step: 1 }],
        [TRACE_DATA, 'data message', 'source6', { data: [1, 2, 3] }],
      ];

      testCases.forEach(([type, message, source, data]) => {
        // Clear logs
        structuredTrace = new StructuredTrace();
        regularTrace = new TraceContext();

        // Add logs to both
        if (data === undefined) {
          structuredTrace.addLog(type, message, source);
          regularTrace.addLog(type, message, source);
        } else {
          structuredTrace.addLog(type, message, source, data);
          regularTrace.addLog(type, message, source, data);
        }

        // Compare logs
        expect(structuredTrace.logs).toHaveLength(regularTrace.logs.length);
        const sLog = structuredTrace.logs[0];
        const rLog = regularTrace.logs[0];

        expect(sLog.type).toBe(rLog.type);
        expect(sLog.message).toBe(rLog.message);
        expect(sLog.source).toBe(rLog.source);
        expect(sLog.data).toEqual(rLog.data);
        expect(typeof sLog.timestamp).toBe('number');
      });
    });

    it('should produce identical logs for convenience methods', () => {
      const methods = ['info', 'success', 'failure', 'step', 'error', 'data'];

      methods.forEach((method) => {
        structuredTrace = new StructuredTrace();
        regularTrace = new TraceContext();

        // Test without data
        structuredTrace[method]('message1', 'source1');
        regularTrace[method]('message1', 'source1');

        expect(structuredTrace.logs[0].type).toBe(regularTrace.logs[0].type);
        expect(structuredTrace.logs[0].message).toBe(
          regularTrace.logs[0].message
        );

        // Test with data
        structuredTrace[method]('message2', 'source2', { key: 'value' });
        regularTrace[method]('message2', 'source2', { key: 'value' });

        expect(structuredTrace.logs[1].data).toEqual(regularTrace.logs[1].data);
      });
    });

    it('should maintain log ordering', () => {
      const operations = [
        () => structuredTrace.info('1', 'src'),
        () => structuredTrace.error('2', 'src', { error: 'e' }),
        () => structuredTrace.success('3', 'src'),
        () => structuredTrace.step('4', 'src'),
        () => structuredTrace.failure('5', 'src'),
        () => structuredTrace.data('6', 'src', { d: 1 }),
      ];

      operations.forEach((op) => op());

      expect(structuredTrace.logs.map((l) => l.message)).toEqual([
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
      ]);
    });
  });

  describe('drop-in replacement scenarios', () => {
    it('should work with existing code that checks logs array', () => {
      // Simulate existing code pattern
      /**
       *
       * @param trace
       */
      function existingFunction(trace) {
        trace.info('Starting process', 'Function');

        // Common pattern: checking logs
        if (trace.logs.length > 0) {
          trace.success('Process completed', 'Function');
        }

        return trace.logs.filter((l) => l.type === 'success').length;
      }

      const structuredResult = existingFunction(structuredTrace);
      const regularResult = existingFunction(regularTrace);

      expect(structuredResult).toBe(regularResult);
      expect(structuredTrace.logs).toHaveLength(2);
    });

    it('should work with code that iterates over logs', () => {
      /**
       *
       * @param trace
       */
      function processTrace(trace) {
        trace.info('Start', 'Processor');
        trace.error('Error occurred', 'Processor', { code: 500 });
        trace.success('Recovered', 'Processor');

        // Common pattern: iterating and filtering logs
        const errors = [];
        for (const log of trace.logs) {
          if (log.type === 'error') {
            errors.push(log);
          }
        }

        return errors;
      }

      const structuredErrors = processTrace(structuredTrace);
      const regularErrors = processTrace(regularTrace);

      expect(structuredErrors).toHaveLength(1);
      expect(structuredErrors[0].data).toEqual({ code: 500 });
      expect(structuredErrors).toEqual(regularErrors);
    });

    it('should work with null/undefined data parameters', () => {
      // Test various ways data might be passed
      structuredTrace.info('msg1', 'src1'); // No data param
      structuredTrace.info('msg2', 'src2', undefined); // Explicit undefined
      structuredTrace.info('msg3', 'src3', null); // Explicit null
      structuredTrace.info('msg4', 'src4', {}); // Empty object

      regularTrace.info('msg1', 'src1');
      regularTrace.info('msg2', 'src2', undefined);
      regularTrace.info('msg3', 'src3', null);
      regularTrace.info('msg4', 'src4', {});

      // Both should handle these identically
      expect(structuredTrace.logs[0].data).toBe(regularTrace.logs[0].data);
      expect(structuredTrace.logs[1].data).toBe(regularTrace.logs[1].data);
      expect(structuredTrace.logs[2].data).toBe(regularTrace.logs[2].data);
      expect(structuredTrace.logs[3].data).toEqual(regularTrace.logs[3].data);
    });
  });

  describe('mixed usage with spans', () => {
    it('should allow using TraceContext API alongside spans', () => {
      structuredTrace.info('Before span', 'Test');

      structuredTrace.withSpan('Operation', () => {
        structuredTrace.step('Inside span', 'Test');
        structuredTrace.success('Span operation success', 'Test');
      });

      structuredTrace.info('After span', 'Test');

      // Should have all the logs
      expect(structuredTrace.logs).toHaveLength(4);
      expect(structuredTrace.logs.map((l) => l.message)).toEqual([
        'Before span',
        'Inside span',
        'Span operation success',
        'After span',
      ]);

      // Should also have the span
      expect(structuredTrace.getSpans()).toHaveLength(1);
    });

    it('should work when only using TraceContext API (no spans)', () => {
      // Use StructuredTrace purely as TraceContext without any span features
      structuredTrace.info('Start', 'NoSpans');
      structuredTrace.step('Step 1', 'NoSpans');
      structuredTrace.step('Step 2', 'NoSpans');
      structuredTrace.success('Complete', 'NoSpans');

      expect(structuredTrace.logs).toHaveLength(4);
      expect(structuredTrace.getSpans()).toHaveLength(0);
      expect(structuredTrace.getHierarchicalView()).toBeNull();
      expect(structuredTrace.getPerformanceSummary().operationCount).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid successive calls', () => {
      for (let i = 0; i < 100; i++) {
        structuredTrace.info(`Message ${i}`, 'RapidTest');
      }

      expect(structuredTrace.logs).toHaveLength(100);
      expect(structuredTrace.logs[50].message).toBe('Message 50');
    });

    it('should handle very large data objects', () => {
      const largeData = {
        array: new Array(1000).fill('data'),
        nested: {
          deep: {
            value: 'found',
          },
        },
      };

      structuredTrace.data('Large data', 'Test', largeData);
      expect(structuredTrace.logs[0].data).toEqual(largeData);
    });

    it('should handle method references correctly', () => {
      // Test that methods work when called directly on the object
      // Note: Destructuring loses 'this' context in JavaScript - this is expected behavior
      const logInfo = (trace) => trace.info('Info message', 'Test');
      const logError = (trace) => trace.error('Error message', 'Test');
      const logSuccess = (trace) => trace.success('Success message', 'Test');

      logInfo(structuredTrace);
      logError(structuredTrace);
      logSuccess(structuredTrace);

      expect(structuredTrace.logs).toHaveLength(3);
    });
  });

  describe('wrapped TraceContext behavior', () => {
    it('should preserve existing logs when wrapping TraceContext', () => {
      const existingTrace = new TraceContext();
      existingTrace.info('Existing 1', 'Original');
      existingTrace.error('Existing 2', 'Original', { error: true });

      const wrapped = new StructuredTrace(existingTrace);

      // Should see existing logs
      expect(wrapped.logs).toHaveLength(2);
      expect(wrapped.logs[0].message).toBe('Existing 1');

      // Should be able to add more
      wrapped.success('New log', 'Wrapped');
      expect(wrapped.logs).toHaveLength(3);

      // Original should also be updated (same reference)
      expect(existingTrace.logs).toHaveLength(3);
    });
  });
});
