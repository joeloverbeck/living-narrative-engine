import { describe, it, expect } from '@jest/globals';
import {
  TraceContext,
  TRACE_INFO,
  TRACE_ERROR,
  TRACE_SUCCESS,
  TRACE_FAILURE,
  TRACE_STEP,
  TRACE_DATA,
} from '../../../src/actions/tracing/traceContext.js';

describe('TraceContext', () => {
  it('initializes with empty logs', () => {
    const trace = new TraceContext();
    expect(trace.logs).toEqual([]);
  });

  it('adds a log entry without data', () => {
    const trace = new TraceContext();
    const before = Date.now();
    trace.addLog(TRACE_INFO, 'hello', 'tester');
    expect(trace.logs).toHaveLength(1);
    const entry = trace.logs[0];
    expect(entry.type).toBe(TRACE_INFO);
    expect(entry.message).toBe('hello');
    expect(entry.source).toBe('tester');
    expect(entry.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry).not.toHaveProperty('data');
  });

  it('adds a log entry with data when provided', () => {
    const trace = new TraceContext();
    const data = { foo: 'bar' };
    trace.addLog(TRACE_ERROR, 'oops', 'tester', data);
    expect(trace.logs).toHaveLength(1);
    expect(trace.logs[0]).toMatchObject({
      type: TRACE_ERROR,
      message: 'oops',
      source: 'tester',
      data,
    });
  });

  it('preserves log order when multiple entries are added', () => {
    const trace = new TraceContext();
    trace.addLog(TRACE_INFO, 'first', 'src1');
    trace.addLog(TRACE_SUCCESS, 'second', 'src2', { value: 42 });
    expect(trace.logs.map((l) => l.message)).toEqual(['first', 'second']);
  });

  it('exposes helper methods for each log type', () => {
    const trace = new TraceContext();
    trace.info('i', 'src');
    trace.success('s', 'src');
    trace.failure('f', 'src');
    trace.step('p', 'src');
    trace.error('e', 'src');
    trace.data('d', 'src');

    expect(trace.logs.map((l) => l.type)).toEqual([
      TRACE_INFO,
      TRACE_SUCCESS,
      TRACE_FAILURE,
      TRACE_STEP,
      TRACE_ERROR,
      TRACE_DATA,
    ]);
  });
});
