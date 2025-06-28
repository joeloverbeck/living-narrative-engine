import { describe, it, expect } from '@jest/globals';
import {
  TraceContext,
  TRACE_INFO,
  TRACE_SUCCESS,
  TRACE_FAILURE,
  TRACE_STEP,
  TRACE_ERROR,
  TRACE_DATA,
} from '../../../src/actions/tracing/traceContext.js';

describe('TraceContext branch coverage', () => {
  it('addLog excludes data when null is provided', () => {
    const trace = new TraceContext();
    trace.addLog(TRACE_INFO, 'msg', 'src', null);
    expect(trace.logs[0]).not.toHaveProperty('data');
  });

  it('helper methods include data payload when provided', () => {
    const trace = new TraceContext();
    const payload = { a: 1 };
    trace.info('i', 'src', payload);
    trace.success('s', 'src', payload);
    trace.failure('f', 'src', payload);
    trace.step('st', 'src', payload);
    trace.error('e', 'src', payload);
    trace.data('d', 'src', payload);

    const types = [
      TRACE_INFO,
      TRACE_SUCCESS,
      TRACE_FAILURE,
      TRACE_STEP,
      TRACE_ERROR,
      TRACE_DATA,
    ];
    trace.logs.forEach((log, idx) => {
      expect(log).toMatchObject({ type: types[idx], data: payload });
    });
  });
});
