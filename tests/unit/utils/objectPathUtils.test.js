import { describe, test, expect } from '@jest/globals';
import { setByPath } from '../../../src/utils/objectPathUtils.js';

describe('setByPath', () => {
  test('creates nested objects and sets value', () => {
    const obj = {};
    const result = setByPath(obj, 'a.b.c', 5);
    expect(result).toBe(true);
    expect(obj).toEqual({ a: { b: { c: 5 } } });
  });

  test('returns false when encountering non-object', () => {
    const obj = { a: { b: 1 } };
    const result = setByPath(obj, 'a.b.c', 9);
    expect(result).toBe(false);
    expect(obj).toEqual({ a: { b: 1 } });
  });

  test('throws on unsafe property names', () => {
    expect(() => setByPath({}, '__proto__.x', 1)).toThrow(
      'Unsafe property name'
    );
    expect(() => setByPath({}, 'constructor.y', 1)).toThrow(
      'Unsafe property name'
    );
  });
});
