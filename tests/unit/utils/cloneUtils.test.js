import { deepClone } from '../../../src/utils/cloneUtils.js';
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
