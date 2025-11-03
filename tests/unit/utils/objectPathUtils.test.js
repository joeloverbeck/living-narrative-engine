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

  test('creates missing intermediate objects when encountering null', () => {
    const obj = { a: null };
    const result = setByPath(obj, 'a.b', 'value');

    expect(result).toBe(true);
    expect(obj).toEqual({ a: { b: 'value' } });
  });

  test('ignores empty path segments and assigns value', () => {
    const obj = {};
    const result = setByPath(obj, 'a..b', 42);

    expect(result).toBe(true);
    expect(obj).toEqual({ a: { b: 42 } });
  });

  test('returns false when provided an empty path', () => {
    const obj = { existing: true };

    const result = setByPath(obj, '', 'new');

    expect(result).toBe(false);
    expect(obj).toEqual({ existing: true });
  });

  test('returns false when root is not an object', () => {
    expect(setByPath(null, 'a.b', 1)).toBe(false);
    expect(setByPath(undefined, 'a.b', 1)).toBe(false);
    expect(setByPath(42, 'a.b', 1)).toBe(false);
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
