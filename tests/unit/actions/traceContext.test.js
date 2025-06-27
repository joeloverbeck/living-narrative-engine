import { describe, it, expect } from '@jest/globals';
import { TraceContext } from '../../../src/actions/tracing/traceContext.js';

describe('TraceContext', () => {
  it('initializes with empty logs and null result', () => {
    const trace = new TraceContext();
    expect(trace.logs).toEqual([]);
    expect(trace.result).toBeNull();
  });

  it('adds a log entry without data', () => {
    const trace = new TraceContext();
    const before = Date.now();
    trace.addLog('info', 'hello', 'tester');
    expect(trace.logs).toHaveLength(1);
    const entry = trace.logs[0];
    expect(entry.type).toBe('info');
    expect(entry.message).toBe('hello');
    expect(entry.source).toBe('tester');
    expect(entry.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry).not.toHaveProperty('data');
  });

  it('adds a log entry with data when provided', () => {
    const trace = new TraceContext();
    const data = { foo: 'bar' };
    trace.addLog('error', 'oops', 'tester', data);
    expect(trace.logs).toHaveLength(1);
    expect(trace.logs[0]).toMatchObject({
      type: 'error',
      message: 'oops',
      source: 'tester',
      data,
    });
  });

  it('preserves log order when multiple entries are added', () => {
    const trace = new TraceContext();
    trace.addLog('info', 'first', 'src1');
    trace.addLog('success', 'second', 'src2', { value: 42 });
    expect(trace.logs.map((l) => l.message)).toEqual(['first', 'second']);
  });
});
