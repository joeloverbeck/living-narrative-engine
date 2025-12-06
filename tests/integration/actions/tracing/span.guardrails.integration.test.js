import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import Span from '../../../../src/actions/tracing/span.js';
import { StructuredTrace } from '../../../../src/actions/tracing/structuredTrace.js';

/** @typedef {{ current: number }} MutableClock */

describe('Span guardrails integration', () => {
  /** @type {MutableClock} */
  let clock;
  /** @type {jest.SpiedFunction<typeof performance.now>} */
  let performanceSpy;

  beforeEach(() => {
    clock = { current: 0 };
    performanceSpy = jest
      .spyOn(performance, 'now')
      .mockImplementation(() => clock.current);
  });

  afterEach(() => {
    performanceSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('enforces constructor validation for ids, operations, and parent ids', () => {
    expect(() => new Span('not-a-number', 'valid-operation')).toThrow(
      'Span id must be a number'
    );
    expect(() => new Span(1, '   ')).toThrow(
      'Span operation must be a non-empty string'
    );
    expect(() => new Span(2, 'valid-operation', 'parent')).toThrow(
      'Span parentId must be a number or null'
    );
  });

  it('prevents negative durations and double endings during structured tracing', () => {
    const trace = new StructuredTrace();

    clock.current = 125;
    const root = trace.startSpan('integration-root');

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    clock.current = 115;
    trace.endSpan(root);

    expect(root.duration).toBe(0);
    expect(root.status).toBe('success');
    expect(warnSpy).toHaveBeenCalledWith(
      'Span "integration-root" (1) has negative duration: -10ms. Setting to 0.'
    );

    expect(() => root.end()).toThrow('Span 1 has already been ended');
  });

  it('guards status and attribute mutations while integrating with trace context', () => {
    const trace = new StructuredTrace();

    clock.current = 10;
    const span = trace.startSpan('attribute-guarded');

    expect(() => span.setStatus('mystery')).toThrow(
      'Invalid span status: mystery'
    );
    span.setStatus('failure');
    expect(span.status).toBe('failure');

    expect(() => span.setAttribute(123, 'value')).toThrow(
      'Attribute key must be a string'
    );
    expect(() => span.setAttributes(null)).toThrow(
      'Attributes must be an object'
    );

    span.setAttribute('first', 'value');
    span.addAttributes({ second: 2 });

    expect(span.attributes).toEqual(
      expect.objectContaining({
        first: 'value',
        second: 2,
      })
    );
  });

  it('captures errors and records them through structured trace spans', () => {
    const trace = new StructuredTrace();

    clock.current = 50;
    const span = trace.startSpan('error-handling');

    expect(() => span.setError('boom')).toThrow(
      'setError requires an Error instance'
    );

    const primaryError = new Error('primary failure');
    span.setError(primaryError);

    expect(span.error).toBe(primaryError);
    expect(span.status).toBe('error');
    expect(span.attributes['error.message']).toBe('primary failure');
    expect(typeof span.attributes['error.stack']).toBe('string');

    const secondarySpan = new Span(99, 'secondary', span.id);
    const recordedError = new Error('secondary failure');
    secondarySpan.recordError(recordedError);

    expect(secondarySpan.error).toBe(recordedError);
    expect(secondarySpan.status).toBe('error');
    expect(secondarySpan.attributes['error.message']).toBe('secondary failure');
  });

  it('tracks rich events and rejects malformed ones', () => {
    const trace = new StructuredTrace();

    clock.current = 200;
    const span = trace.startSpan('eventful');

    expect(() => span.addEvent('   ')).toThrow(
      'Event name must be a non-empty string'
    );

    clock.current = 210;
    span.addEvent('checkpoint-start', { stage: 'begin' });

    clock.current = 240;
    span.addEvent('checkpoint-end', { stage: 'complete' });

    const events = span.attributes.events;

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      name: 'checkpoint-start',
      attributes: { stage: 'begin' },
    });
    expect(events[1]).toMatchObject({
      name: 'checkpoint-end',
      attributes: { stage: 'complete' },
    });
    expect(events[0].timestamp).toBe(210);
    expect(events[1].timestamp).toBe(240);
  });

  it('ensures child span relationships are validated across structured traces', () => {
    const trace = new StructuredTrace();

    clock.current = 5;
    const parent = trace.startSpan('parent');

    expect(() => parent.addChild({})).toThrow('Child must be a Span instance');

    const orphanChild = new Span(200, 'orphan', 999);
    expect(() => parent.addChild(orphanChild)).toThrow(
      'Child span 200 has parent 999, not 1'
    );

    clock.current = 15;
    const child = trace.startSpan('child', { info: 'linked' });
    trace.endSpan(child);
    trace.endSpan(parent);

    expect(parent.children.map((spanChild) => spanChild.operation)).toEqual([
      'child',
    ]);
  });

  it('serializes spans with hierarchical context and captured errors', () => {
    const trace = new StructuredTrace();

    clock.current = 300;
    const root = trace.startSpan('root-operation', { intent: 'serialize' });

    clock.current = 320;
    const child = trace.startSpan('child-operation');

    const childError = new Error('child explosion');
    child.setError(childError);
    trace.endSpan(child);

    const rootError = new Error('root failure');
    root.setError(rootError);
    trace.endSpan(root);

    const serialized = root.toJSON();

    expect(serialized).toMatchObject({
      id: root.id,
      operation: 'root-operation',
      parentId: null,
      status: 'error',
      attributes: expect.objectContaining({
        intent: 'serialize',
        'error.message': 'root failure',
      }),
      error: expect.objectContaining({ message: 'root failure' }),
    });

    expect(serialized.children).toHaveLength(1);
    expect(serialized.children[0]).toMatchObject({
      id: child.id,
      operation: 'child-operation',
      status: 'error',
      error: expect.objectContaining({ message: 'child explosion' }),
    });
    expect(serialized.children[0].children).toEqual([]);
  });
});
