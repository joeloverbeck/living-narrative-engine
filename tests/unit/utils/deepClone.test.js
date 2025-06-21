import { deepClone } from '../../../src/utils/cloneUtils.js';
import { describe, it, expect } from '@jest/globals';

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
});
