import { describe, it, expect } from '@jest/globals';
import { safeStringify } from '../../../src/utils/safeStringify.js';

describe('safeStringify', () => {
  it('stringifies objects without cycles', () => {
    const obj = { a: 1, b: { c: 2 } };
    const result = safeStringify(obj);
    expect(result).toBe(JSON.stringify(obj));
  });

  it('replaces circular references with "[Circular]"', () => {
    const obj = { a: 1 };
    obj.self = obj;
    const result = safeStringify(obj);
    expect(result).toBe('{"a":1,"self":"[Circular]"}');
  });

  it('treats repeated references as circular', () => {
    const shared = { v: 1 };
    const obj = { first: shared, second: shared };
    const result = safeStringify(obj);
    expect(result).toBe('{"first":{"v":1},"second":"[Circular]"}');
  });

  it('handles arrays with cycles', () => {
    const arr = [1];
    arr.push(arr);
    const result = safeStringify(arr);
    expect(result).toBe('[1,"[Circular]"]');
  });

  it('stringifies primitive values normally', () => {
    expect(safeStringify(42)).toBe('42');
  });
});
