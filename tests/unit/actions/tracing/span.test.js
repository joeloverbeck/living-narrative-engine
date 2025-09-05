/**
 * @file Unit tests for the Span class
 * @see src/actions/tracing/span.js
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import Span from '../../../../src/actions/tracing/span.js';

describe('Span', () => {
  let mockPerformanceNow;
  let timeCounter;

  beforeEach(() => {
    // Mock performance.now() for deterministic timing tests
    timeCounter = 0;
    mockPerformanceNow = jest
      .spyOn(performance, 'now')
      .mockImplementation(() => {
        return timeCounter++;
      });
  });

  afterEach(() => {
    mockPerformanceNow.mockRestore();
  });

  describe('constructor', () => {
    it('should create a span with required properties', () => {
      const span = new Span(1, 'TestOperation');

      expect(span.id).toBe(1);
      expect(span.operation).toBe('TestOperation');
      expect(span.parentId).toBeNull();
      expect(span.startTime).toBe(0); // First call to performance.now()
      expect(span.endTime).toBeNull();
      expect(span.duration).toBeNull();
      expect(span.status).toBe('active');
      expect(span.attributes).toEqual({});
      expect(span.children).toEqual([]);
      expect(span.error).toBeNull();
    });

    it('should create a span with parent ID', () => {
      const span = new Span(2, 'ChildOperation', 1);
      expect(span.parentId).toBe(1);
    });

    it('should throw error for invalid id', () => {
      expect(() => new Span('invalid', 'Operation')).toThrow(
        'Span id must be a number'
      );
      expect(() => new Span(null, 'Operation')).toThrow(
        'Span id must be a number'
      );
    });

    it('should throw error for invalid operation', () => {
      expect(() => new Span(1, '')).toThrow(
        'Span operation must be a non-empty string'
      );
      expect(() => new Span(1, '   ')).toThrow(
        'Span operation must be a non-empty string'
      );
      expect(() => new Span(1, 123)).toThrow(
        'Span operation must be a non-empty string'
      );
    });

    it('should throw error for invalid parentId', () => {
      expect(() => new Span(1, 'Operation', 'invalid')).toThrow(
        'Span parentId must be a number or null'
      );
    });
  });

  describe('end()', () => {
    it('should calculate duration and set success status', () => {
      const span = new Span(1, 'TestOperation');
      expect(span.startTime).toBe(0);

      span.end();

      expect(span.endTime).toBe(1); // Second call to performance.now()
      expect(span.duration).toBe(1); // endTime - startTime
      expect(span.status).toBe('success');
    });

    it('should preserve non-active status when ending', () => {
      const span = new Span(1, 'TestOperation');
      span.setStatus('failure');
      span.end();

      expect(span.status).toBe('failure'); // Status unchanged
    });

    it('should throw error if span already ended', () => {
      const span = new Span(1, 'TestOperation');
      span.end();

      expect(() => span.end()).toThrow('Span 1 has already been ended');
    });
  });

  describe('setStatus()', () => {
    it('should set valid status values', () => {
      const span = new Span(1, 'TestOperation');

      span.setStatus('success');
      expect(span.status).toBe('success');

      span.setStatus('failure');
      expect(span.status).toBe('failure');

      span.setStatus('error');
      expect(span.status).toBe('error');

      span.setStatus('active');
      expect(span.status).toBe('active');
    });

    it('should throw error for invalid status', () => {
      const span = new Span(1, 'TestOperation');
      expect(() => span.setStatus('invalid')).toThrow(
        'Invalid span status: invalid'
      );
    });
  });

  describe('setAttribute()', () => {
    it('should set individual attributes', () => {
      const span = new Span(1, 'TestOperation');

      span.setAttribute('key1', 'value1');
      span.setAttribute('key2', 42);
      span.setAttribute('key3', { nested: true });

      const attrs = span.attributes;
      expect(attrs.key1).toBe('value1');
      expect(attrs.key2).toBe(42);
      expect(attrs.key3).toEqual({ nested: true });
    });

    it('should throw error for non-string key', () => {
      const span = new Span(1, 'TestOperation');
      expect(() => span.setAttribute(123, 'value')).toThrow(
        'Attribute key must be a string'
      );
    });
  });

  describe('setAttributes()', () => {
    it('should set multiple attributes at once', () => {
      const span = new Span(1, 'TestOperation');

      span.setAttributes({
        key1: 'value1',
        key2: 42,
        key3: { nested: true },
      });

      const attrs = span.attributes;
      expect(attrs.key1).toBe('value1');
      expect(attrs.key2).toBe(42);
      expect(attrs.key3).toEqual({ nested: true });
    });

    it('should merge with existing attributes', () => {
      const span = new Span(1, 'TestOperation');
      span.setAttribute('existing', 'value');

      span.setAttributes({
        key1: 'value1',
        existing: 'updated',
      });

      const attrs = span.attributes;
      expect(attrs.existing).toBe('updated');
      expect(attrs.key1).toBe('value1');
    });

    it('should throw error for non-object attributes', () => {
      const span = new Span(1, 'TestOperation');
      expect(() => span.setAttributes('invalid')).toThrow(
        'Attributes must be an object'
      );
      expect(() => span.setAttributes(null)).toThrow(
        'Attributes must be an object'
      );
    });
  });

  describe('setError()', () => {
    it('should capture error and set status', () => {
      const span = new Span(1, 'TestOperation');
      const error = new Error('Test error');

      span.setError(error);

      expect(span.error).toBe(error);
      expect(span.status).toBe('error');
      expect(span.attributes['error.message']).toBe('Test error');
      expect(span.attributes['error.stack']).toBeDefined();
    });

    it('should throw error for non-Error instance', () => {
      const span = new Span(1, 'TestOperation');
      expect(() => span.setError('not an error')).toThrow(
        'setError requires an Error instance'
      );
    });
  });

  describe('addChild()', () => {
    it('should add valid child span', () => {
      const parent = new Span(1, 'ParentOperation');
      const child = new Span(2, 'ChildOperation', 1);

      parent.addChild(child);

      const children = parent.children;
      expect(children).toHaveLength(1);
      expect(children[0]).toBe(child);
    });

    it('should add multiple children', () => {
      const parent = new Span(1, 'ParentOperation');
      const child1 = new Span(2, 'ChildOperation1', 1);
      const child2 = new Span(3, 'ChildOperation2', 1);

      parent.addChild(child1);
      parent.addChild(child2);

      const children = parent.children;
      expect(children).toHaveLength(2);
      expect(children[0]).toBe(child1);
      expect(children[1]).toBe(child2);
    });

    it('should throw error for non-Span child', () => {
      const parent = new Span(1, 'ParentOperation');
      expect(() => parent.addChild({ id: 2 })).toThrow(
        'Child must be a Span instance'
      );
    });

    it('should throw error for child with wrong parent', () => {
      const parent = new Span(1, 'ParentOperation');
      const child = new Span(2, 'ChildOperation', 99); // Wrong parent ID

      expect(() => parent.addChild(child)).toThrow(
        'Child span 2 has parent 99, not 1'
      );
    });
  });

  describe('getter immutability', () => {
    it('should return copy of attributes', () => {
      const span = new Span(1, 'TestOperation');
      span.setAttribute('key', 'value');

      const attrs1 = span.attributes;
      attrs1.key = 'modified';

      const attrs2 = span.attributes;
      expect(attrs2.key).toBe('value'); // Original unchanged
    });

    it('should return copy of children array', () => {
      const parent = new Span(1, 'ParentOperation');
      const child = new Span(2, 'ChildOperation', 1);
      parent.addChild(child);

      const children1 = parent.children;
      children1.push(new Span(3, 'Extra'));

      const children2 = parent.children;
      expect(children2).toHaveLength(1); // Original unchanged
    });
  });

  describe('toJSON()', () => {
    it('should serialize span to plain object', () => {
      const span = new Span(1, 'TestOperation');
      span.setAttribute('key', 'value');
      span.end();

      const json = span.toJSON();

      expect(json).toEqual({
        id: 1,
        operation: 'TestOperation',
        parentId: null,
        startTime: 0,
        endTime: 1,
        duration: 1,
        status: 'success',
        attributes: { key: 'value' },
        children: [],
        error: null,
      });
    });

    it('should serialize span with error', () => {
      const span = new Span(1, 'TestOperation');
      const error = new Error('Test error');
      span.setError(error);

      const json = span.toJSON();

      expect(json.error).toEqual({
        message: 'Test error',
        stack: error.stack,
      });
    });

    it('should recursively serialize children', () => {
      const parent = new Span(1, 'ParentOperation');
      const child1 = new Span(2, 'ChildOperation1', 1);
      const child2 = new Span(3, 'ChildOperation2', 1);
      const grandchild = new Span(4, 'GrandchildOperation', 2);

      parent.addChild(child1);
      parent.addChild(child2);
      child1.addChild(grandchild);

      const json = parent.toJSON();

      expect(json.children).toHaveLength(2);
      expect(json.children[0].operation).toBe('ChildOperation1');
      expect(json.children[0].children).toHaveLength(1);
      expect(json.children[0].children[0].operation).toBe(
        'GrandchildOperation'
      );
    });
  });

  describe('timing precision', () => {
    it('should handle sub-millisecond durations', () => {
      // Reset mock to use fractional values
      mockPerformanceNow.mockRestore();
      mockPerformanceNow = jest
        .spyOn(performance, 'now')
        .mockImplementationOnce(() => 1000.123)
        .mockImplementationOnce(() => 1000.456);

      const span = new Span(1, 'FastOperation');
      span.end();

      expect(span.startTime).toBe(1000.123);
      expect(span.endTime).toBe(1000.456);
      expect(span.duration).toBeCloseTo(0.333, 3);
    });

    it('should handle negative duration edge case', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Mock performance.now() to return decreasing values (simulating clock drift/precision issues)
      mockPerformanceNow.mockRestore();
      mockPerformanceNow = jest
        .spyOn(performance, 'now')
        .mockImplementationOnce(() => 1000.0)
        .mockImplementationOnce(() => 999.5); // Earlier time

      const span = new Span(1, 'TestOperation');
      span.end();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Span "TestOperation" (1) has negative duration: -0.5ms. Setting to 0.'
      );
      expect(span.duration).toBe(0);
      expect(span.status).toBe('success');

      consoleWarnSpy.mockRestore();
    });
  });

  describe('addAttributes()', () => {
    it('should work as alias for setAttributes', () => {
      const span = new Span(1, 'TestOperation');
      const attributes = {
        key1: 'value1',
        key2: 42,
        key3: { nested: true },
      };

      span.addAttributes(attributes);

      const attrs = span.attributes;
      expect(attrs.key1).toBe('value1');
      expect(attrs.key2).toBe(42);
      expect(attrs.key3).toEqual({ nested: true });
    });

    it('should throw error for invalid attributes like setAttributes', () => {
      const span = new Span(1, 'TestOperation');
      expect(() => span.addAttributes('invalid')).toThrow(
        'Attributes must be an object'
      );
      expect(() => span.addAttributes(null)).toThrow(
        'Attributes must be an object'
      );
    });
  });

  describe('recordError()', () => {
    it('should work as alias for setError', () => {
      const span = new Span(1, 'TestOperation');
      const error = new Error('Test error');

      span.recordError(error);

      expect(span.error).toBe(error);
      expect(span.status).toBe('error');
      expect(span.attributes['error.message']).toBe('Test error');
      expect(span.attributes['error.stack']).toBeDefined();
    });

    it('should throw error for non-Error instance like setError', () => {
      const span = new Span(1, 'TestOperation');
      expect(() => span.recordError('not an error')).toThrow(
        'setError requires an Error instance'
      );
    });
  });

  describe('addEvent()', () => {
    it('should add event with name and attributes', () => {
      const span = new Span(1, 'TestOperation');
      const eventAttributes = { key1: 'value1', key2: 42 };

      span.addEvent('test-event', eventAttributes);

      const events = span.attributes.events;
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe('test-event');
      expect(events[0].attributes).toEqual(eventAttributes);
      expect(events[0].timestamp).toBeGreaterThanOrEqual(0);
    });

    it('should add event with name only', () => {
      const span = new Span(1, 'TestOperation');

      span.addEvent('simple-event');

      const events = span.attributes.events;
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe('simple-event');
      expect(events[0].attributes).toEqual({});
      expect(events[0].timestamp).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple events', () => {
      const span = new Span(1, 'TestOperation');

      span.addEvent('event1', { type: 'start' });
      span.addEvent('event2', { type: 'middle' });
      span.addEvent('event3', { type: 'end' });

      const events = span.attributes.events;
      expect(events).toHaveLength(3);
      expect(events[0].name).toBe('event1');
      expect(events[1].name).toBe('event2');
      expect(events[2].name).toBe('event3');
      expect(events[0].attributes.type).toBe('start');
      expect(events[1].attributes.type).toBe('middle');
      expect(events[2].attributes.type).toBe('end');
    });

    it('should throw error for empty event name', () => {
      const span = new Span(1, 'TestOperation');
      expect(() => span.addEvent('')).toThrow(
        'Event name must be a non-empty string'
      );
      expect(() => span.addEvent('   ')).toThrow(
        'Event name must be a non-empty string'
      );
    });

    it('should throw error for non-string event name', () => {
      const span = new Span(1, 'TestOperation');
      expect(() => span.addEvent(123)).toThrow(
        'Event name must be a non-empty string'
      );
      expect(() => span.addEvent(null)).toThrow(
        'Event name must be a non-empty string'
      );
    });

    it('should handle null attributes parameter', () => {
      const span = new Span(1, 'TestOperation');

      span.addEvent('test-event', null);

      const events = span.attributes.events;
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe('test-event');
      expect(events[0].attributes).toEqual({});
    });
  });
});
