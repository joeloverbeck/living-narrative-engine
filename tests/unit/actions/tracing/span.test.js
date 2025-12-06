import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { Span } from '../../../../src/actions/tracing/span.js';

describe('Span', () => {
  let now;

  beforeEach(() => {
    now = 1000;
    jest.spyOn(performance, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const advanceTime = (value) => {
    now = value;
  };

  it('constructs with defaults and exposes defensive copies', () => {
    const span = new Span(1, 'operation');

    expect(span.id).toBe(1);
    expect(span.operation).toBe('operation');
    expect(span.parentId).toBeNull();
    expect(span.startTime).toBe(1000);
    expect(span.endTime).toBeNull();
    expect(span.duration).toBeNull();
    expect(span.status).toBe('active');
    expect(span.error).toBeNull();

    const attrs = span.attributes;
    attrs.mutated = true;
    expect(span.attributes).toEqual({});

    const children = span.children;
    children.push('not-span');
    expect(span.children).toEqual([]);
  });

  it('validates constructor arguments', () => {
    expect(() => new Span('not-number', 'op')).toThrow(
      'Span id must be a number'
    );
    expect(() => new Span(1, '')).toThrow(
      'Span operation must be a non-empty string'
    );
    expect(() => new Span(1, 'valid', 'nope')).toThrow(
      'Span parentId must be a number or null'
    );
  });

  it('updates timing information when ended and prevents double end', () => {
    const span = new Span(2, 'timed');

    advanceTime(1500);
    span.end();

    expect(span.endTime).toBe(1500);
    expect(span.duration).toBe(500);
    expect(span.status).toBe('success');

    expect(() => span.end()).toThrow('Span 2 has already been ended');
  });

  it('retains explicit status on end and handles negative durations with warning', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const span = new Span(3, 'negative');

    span.setStatus('failure');
    advanceTime(900);
    span.end();

    expect(span.status).toBe('failure');
    expect(span.duration).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      'Span "negative" (3) has negative duration: -100ms. Setting to 0.'
    );

    warnSpy.mockRestore();
  });

  it('enforces valid status transitions', () => {
    const span = new Span(4, 'status');

    span.setStatus('success');
    expect(span.status).toBe('success');

    span.setStatus('error');
    expect(span.status).toBe('error');

    expect(() => span.setStatus('invalid')).toThrow(
      'Invalid span status: invalid'
    );
  });

  it('manages attributes through setAttribute, setAttributes and addAttributes', () => {
    const span = new Span(5, 'attributes');

    span.setAttribute('first', 1);
    expect(span.attributes).toEqual({ first: 1 });
    expect(() => span.setAttribute(123, 'nope')).toThrow(
      'Attribute key must be a string'
    );

    span.setAttributes({ second: 2 });
    expect(span.attributes).toEqual({ first: 1, second: 2 });
    expect(() => span.setAttributes(null)).toThrow(
      'Attributes must be an object'
    );

    span.addAttributes({ third: 3 });
    expect(span.attributes).toEqual({ first: 1, second: 2, third: 3 });
  });

  it('records errors and requires Error instances', () => {
    const span = new Span(6, 'error');

    const originalError = new Error('boom');
    originalError.stack = 'stack-trace';
    span.setError(originalError);

    expect(span.error).toBe(originalError);
    expect(span.status).toBe('error');
    expect(span.attributes['error.message']).toBe('boom');
    expect(span.attributes['error.stack']).toBe('stack-trace');

    const replacementError = new Error('again');
    span.recordError(replacementError);
    expect(span.error).toBe(replacementError);
    expect(span.attributes['error.message']).toBe('again');

    expect(() => span.setError('nope')).toThrow(
      'setError requires an Error instance'
    );
  });

  it('adds events with timestamps and validates names', () => {
    const span = new Span(7, 'events');

    advanceTime(1200);
    span.addEvent('first', { foo: 'bar' });

    advanceTime(1250);
    span.addEvent('second');

    advanceTime(1300);
    span.addEvent('third', null);

    const events = span.attributes.events;
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      name: 'first',
      attributes: { foo: 'bar' },
    });
    expect(events[0].timestamp).toBe(1200);
    expect(events[1]).toMatchObject({ name: 'second', attributes: {} });
    expect(events[1].timestamp).toBe(1250);
    expect(events[2]).toMatchObject({ name: 'third', attributes: {} });
    expect(events[2].timestamp).toBe(1300);

    expect(() => span.addEvent('', {})).toThrow(
      'Event name must be a non-empty string'
    );
  });

  it('manages child spans with validation', () => {
    const parent = new Span(8, 'parent');
    const child = new Span(9, 'child', 8);

    parent.addChild(child);

    expect(parent.children).toHaveLength(1);
    expect(parent.children[0].id).toBe(9);

    const copy = parent.children;
    copy.pop();
    expect(parent.children).toHaveLength(1);

    expect(() => parent.addChild({})).toThrow('Child must be a Span instance');
    expect(() => parent.addChild(new Span(10, 'wrong-parent', 42))).toThrow(
      'Child span 10 has parent 42, not 8'
    );
  });

  it('serializes to JSON with children and error information', () => {
    const parent = new Span(11, 'parent');
    const child = new Span(12, 'child', 11);

    parent.addChild(child);
    parent.setAttribute('key', 'value');
    parent.setError(new Error('problem'));

    advanceTime(1400);
    parent.end();

    const json = parent.toJSON();
    expect(json).toMatchObject({
      id: 11,
      operation: 'parent',
      parentId: null,
      status: 'error',
      attributes: expect.objectContaining({
        key: 'value',
        'error.message': 'problem',
      }),
    });
    expect(json.children).toHaveLength(1);
    expect(json.children[0].id).toBe(12);
    expect(json.error).toMatchObject({ message: 'problem' });
  });

  it('serializes to JSON with null error when no error recorded', () => {
    const span = new Span(13, 'no-error');
    const json = span.toJSON();
    expect(json.error).toBeNull();
  });
});
