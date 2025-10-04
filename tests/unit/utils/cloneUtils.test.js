import { deepClone, freezeMap } from '../../../src/utils/cloneUtils.js';
import { describe, it, expect, jest } from '@jest/globals';

describe('deepClone', () => {
  it('creates an independent copy of nested objects', () => {
    const obj = { a: { b: { c: 1 } } };
    const clone = deepClone(obj);
    expect(clone).toEqual(obj);
    expect(clone).not.toBe(obj);
    clone.a.b.c = 2;
    expect(obj.a.b.c).toBe(1);
  });

  it('clones arrays within objects', () => {
    const obj = { list: [1, { v: 2 }] };
    const clone = deepClone(obj);
    expect(clone).toEqual(obj);
    expect(clone.list).not.toBe(obj.list);
    clone.list[1].v = 99;
    expect(obj.list[1].v).toBe(2);
  });

  it('uses structuredClone when available', () => {
    const original = global.structuredClone;
    const spy = jest.fn((v) => ({ ...v }));
    global.structuredClone = spy;

    const obj = { x: 1 };
    const clone = deepClone(obj);

    expect(spy).toHaveBeenCalledWith(obj);
    expect(clone).toEqual(obj);
    expect(clone).not.toBe(obj);

    global.structuredClone = original;
  });

  it('falls back to JSON methods when structuredClone is absent', () => {
    const original = global.structuredClone;

    global.structuredClone = undefined;

    const obj = { a: { b: 3 } };
    const clone = deepClone(obj);

    expect(clone).toEqual(obj);
    expect(clone).not.toBe(obj);

    global.structuredClone = original;
  });

  it('drops function properties when JSON fallback is used', () => {
    const original = global.structuredClone;
    global.structuredClone = undefined;

    const obj = { a: 1, fn: () => 2 };
    const clone = deepClone(obj);

    expect(clone).toEqual({ a: 1 });

    global.structuredClone = original;
  });

  it('throws on circular structures', () => {
    const obj = {};
    obj.self = obj;
    expect(() => deepClone(obj)).toThrow();
  });
});

describe('freezeMap', () => {
  it('returns a readonly map that preserves all map properties', () => {
    const map = new Map([
      ['key1', { value: 'data1' }],
      ['key2', { value: 'data2' }],
    ]);
    const frozen = freezeMap(map);

    // Should access size without error
    expect(frozen.size).toBe(2);

    // Should access has() without error
    expect(frozen.has('key1')).toBe(true);
    expect(frozen.has('key3')).toBe(false);

    // Should access get() without error
    expect(frozen.get('key1')).toEqual({ value: 'data1' });
    expect(frozen.get('key2')).toEqual({ value: 'data2' });
  });

  it('allows iteration over keys, values, and entries', () => {
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    const frozen = freezeMap(map);

    // Test keys()
    const keys = Array.from(frozen.keys());
    expect(keys).toEqual(['a', 'b']);

    // Test values()
    const values = Array.from(frozen.values());
    expect(values).toEqual([1, 2]);

    // Test entries()
    const entries = Array.from(frozen.entries());
    expect(entries).toEqual([
      ['a', 1],
      ['b', 2],
    ]);

    // Test forEach
    const collected = [];
    frozen.forEach((value, key) => collected.push([key, value]));
    expect(collected).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });

  it('prevents modification via set()', () => {
    const map = new Map([['key', 'value']]);
    const frozen = freezeMap(map);

    expect(() => frozen.set('newKey', 'newValue')).toThrow(
      'Cannot modify frozen map'
    );
  });

  it('prevents modification via delete()', () => {
    const map = new Map([['key', 'value']]);
    const frozen = freezeMap(map);

    expect(() => frozen.delete('key')).toThrow('Cannot modify frozen map');
  });

  it('prevents modification via clear()', () => {
    const map = new Map([['key', 'value']]);
    const frozen = freezeMap(map);

    expect(() => frozen.clear()).toThrow('Cannot modify frozen map');
  });

  it('deeply freezes values stored in the map', () => {
    const map = new Map([['key', { nested: { value: 1 } }]]);
    const frozen = freezeMap(map);

    const value = frozen.get('key');
    expect(() => {
      value.nested.value = 2;
    }).toThrow();
    expect(() => {
      value.newProp = 'test';
    }).toThrow();
  });

  it('works with for...of iteration', () => {
    const map = new Map([
      ['x', 10],
      ['y', 20],
    ]);
    const frozen = freezeMap(map);

    const entries = [];
    for (const [key, value] of frozen) {
      entries.push([key, value]);
    }

    expect(entries).toEqual([
      ['x', 10],
      ['y', 20],
    ]);
  });

  it('preserves Map.prototype methods', () => {
    const map = new Map([['test', 'value']]);
    const frozen = freezeMap(map);

    // Verify it's still a Map
    expect(frozen instanceof Map).toBe(true);

    // Verify toString works
    expect(frozen.toString()).toBe('[object Map]');
  });
});
