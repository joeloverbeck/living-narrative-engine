// src/tests/utils/objectUtils.test.js

import { getObjectPropertyByPath } from '../../src/utils/objectUtils.js';
import { describe, expect, it } from '@jest/globals';

describe('getObjectPropertyByPath', () => {
  const testObj = {
    a: 1,
    b: {
      c: 'hello',
      d: {
        e: true,
        f: null,
      },
      g: [10, 20, { h: 'world' }],
      '': 'empty key property', // Property with an empty string key
    },
    i: undefined,
    j: null,
    k: ['x', 'y', 'z'],
    'complex.key': 'value with dot',
  };

  // --- Basic Access ---
  it('should access a property in a simple object', () => {
    expect(getObjectPropertyByPath(testObj, 'a')).toBe(1);
  });

  it('should access a nested property (2 levels)', () => {
    expect(getObjectPropertyByPath(testObj, 'b.c')).toBe('hello');
  });

  it('should access a deeply nested property (3+ levels)', () => {
    expect(getObjectPropertyByPath(testObj, 'b.d.e')).toBe(true);
  });

  it('should return null if the final property value is null', () => {
    expect(getObjectPropertyByPath(testObj, 'b.d.f')).toBeNull();
    expect(getObjectPropertyByPath(testObj, 'j')).toBeNull();
  });

  it('should return undefined if the final property value is undefined', () => {
    expect(getObjectPropertyByPath(testObj, 'i')).toBeUndefined();
  });

  // --- Non-Existent Paths ---
  it('should return undefined for a non-existent property at the top level', () => {
    expect(getObjectPropertyByPath(testObj, 'z')).toBeUndefined();
  });

  it('should return undefined for a non-existent property at level 2', () => {
    expect(getObjectPropertyByPath(testObj, 'b.x')).toBeUndefined();
  });

  it('should return undefined for a non-existent property at level 3', () => {
    expect(getObjectPropertyByPath(testObj, 'b.d.z')).toBeUndefined();
  });

  // --- Intermediate Non-Objects/Null/Undefined ---
  it('should return undefined when trying to access a property on a null intermediate', () => {
    expect(getObjectPropertyByPath(testObj, 'j.k')).toBeUndefined(); // testObj.j is null
  });

  it('should return undefined when trying to access a property on an undefined intermediate', () => {
    expect(getObjectPropertyByPath(testObj, 'i.k')).toBeUndefined(); // testObj.i is undefined
  });

  it('should return undefined when trying to access a property on a number intermediate', () => {
    expect(getObjectPropertyByPath(testObj, 'a.b')).toBeUndefined(); // testObj.a is 1
  });

  it('should return undefined when trying to access a property on a string intermediate', () => {
    expect(getObjectPropertyByPath(testObj, 'b.c.d')).toBeUndefined(); // testObj.b.c is 'hello'
  });

  it('should return undefined when trying to access a property on a boolean intermediate', () => {
    expect(getObjectPropertyByPath(testObj, 'b.d.e.f')).toBeUndefined(); // testObj.b.d.e is true
  });

  it('should return undefined if an intermediate property exists but its value is undefined', () => {
    const objWithUndefined = { level1: { level2: undefined } };
    expect(
      getObjectPropertyByPath(objWithUndefined, 'level1.level2.level3')
    ).toBeUndefined();
  });

  // --- Invalid Inputs ---
  it('should return undefined if the input object is null', () => {
    expect(getObjectPropertyByPath(null, 'a.b')).toBeUndefined();
  });

  it('should return undefined if the input object is undefined', () => {
    expect(getObjectPropertyByPath(undefined, 'a.b')).toBeUndefined();
  });

  it('should return undefined if the property path is null', () => {
    expect(getObjectPropertyByPath(testObj, null)).toBeUndefined();
  });

  it('should return undefined if the property path is undefined', () => {
    expect(getObjectPropertyByPath(testObj, undefined)).toBeUndefined();
  });

  it('should return undefined if the property path is an empty string', () => {
    expect(getObjectPropertyByPath(testObj, '')).toBeUndefined();
  });

  it('should return undefined if the property path is not a string', () => {
    expect(getObjectPropertyByPath(testObj, 123)).toBeUndefined();
    expect(getObjectPropertyByPath(testObj, {})).toBeUndefined();
    expect(getObjectPropertyByPath(testObj, [])).toBeUndefined();
  });

  // --- Edge Cases: Path Format ---
  it('should return undefined for paths with double dots (empty segments)', () => {
    expect(getObjectPropertyByPath(testObj, 'b..c')).toBeUndefined();
  });

  it('should return undefined for paths with leading dots', () => {
    expect(getObjectPropertyByPath(testObj, '.a')).toBeUndefined();
  });

  it('should return undefined for paths with trailing dots', () => {
    expect(getObjectPropertyByPath(testObj, 'a.')).toBeUndefined();
  });

  it('should handle property keys that contain dots if accessed directly (not nested)', () => {
    // Note: getObjectPropertyByPath splits by '.', so it CANNOT access 'complex.key' directly via path 'complex.key'
    // Let's verify this expected behavior on the main test object:
    expect(getObjectPropertyByPath(testObj, 'complex.key')).toBeUndefined();

    // Now test an object where the key *is* 'complex.key'.
    // The function will *still* split the path 'complex.key' into ['complex', 'key']
    // and fail to find 'complex' as the first part.
    const objWithDotKey = { 'complex.key': 'value' };
    // Therefore, the expected result for this path *is* undefined based on the function's design.
    expect(
      getObjectPropertyByPath(objWithDotKey, 'complex.key')
    ).toBeUndefined();
    // If you needed to access 'complex.key', you would need a different mechanism (like passing the path as an array ['complex.key'])
    // or modify the function to support escaping dots.
  });

  it('should handle property keys that are empty strings (but not empty path segments)', () => {
    // Path "b." would fail due to trailing dot (empty segment)
    expect(getObjectPropertyByPath(testObj, 'b.')).toBeUndefined();
    // Path "b.." would fail due to empty segment
    expect(getObjectPropertyByPath(testObj, 'b..')).toBeUndefined();
    // Accessing the property named "" directly works if the object structure allows it
    const objWithEmptyKey = { '': 'value' };
    expect(getObjectPropertyByPath(objWithEmptyKey, '')).toBeUndefined(); // Empty path itself is invalid
    // However, the implementation currently rejects paths with empty segments ("a..b")
    // Accessing `testObj.b['']` works directly, but not via path "b." or "b.."
    // Let's test direct access via a path if the key was valid segment e.g. "b.emptyKeyProp" if obj was { b: { emptyKeyProp: 'value' } }
    const objWithNamedEmptyKey = { b: { emptyKeyProp: testObj.b[''] } };
    expect(
      getObjectPropertyByPath(objWithNamedEmptyKey, 'b.emptyKeyProp')
    ).toBe('empty key property');
  });

  // --- Array Access ---
  it('should access array elements by numeric index', () => {
    expect(getObjectPropertyByPath(testObj, 'b.g.0')).toBe(10);
    expect(getObjectPropertyByPath(testObj, 'b.g.1')).toBe(20);
    expect(getObjectPropertyByPath(testObj, 'k.2')).toBe('z');
  });

  it('should access properties of objects within arrays', () => {
    expect(getObjectPropertyByPath(testObj, 'b.g.2.h')).toBe('world');
  });

  it('should return undefined for out-of-bounds array indices', () => {
    expect(getObjectPropertyByPath(testObj, 'b.g.5')).toBeUndefined();
    expect(getObjectPropertyByPath(testObj, 'k.3')).toBeUndefined();
  });

  it('should return undefined when trying to access a property on an array element that is not an object', () => {
    expect(getObjectPropertyByPath(testObj, 'b.g.0.x')).toBeUndefined(); // b.g[0] is 10
  });

  it('should access array properties like .length', () => {
    expect(getObjectPropertyByPath(testObj, 'k.length')).toBe(3);
    expect(getObjectPropertyByPath(testObj, 'b.g.length')).toBe(3);
  });

  it('should return undefined when accessing length on non-array', () => {
    expect(getObjectPropertyByPath(testObj, 'a.length')).toBeUndefined(); // a is 1
    expect(getObjectPropertyByPath(testObj, 'b.c.length')).toBeUndefined(); // b.c is 'hello'
  });

  it('should not access properties from the prototype chain', () => {
    const obj = {};
    // 'toString' exists on Object.prototype; should return undefined
    expect(getObjectPropertyByPath(obj, 'toString')).toBeUndefined();
    // Nested case: first part exists, second part is prototype property
    const nested = { inner: {} };
    expect(
      getObjectPropertyByPath(nested, 'inner.hasOwnProperty')
    ).toBeUndefined();
  });
});
