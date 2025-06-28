import flattenIntoSet from '../../src/scopeDsl/core/flattenIntoSet.js';

describe('flattenIntoSet', () => {
  it('should return empty Set for empty iterable', () => {
    const result = flattenIntoSet([]);
    expect(result).toEqual(new Set());
  });

  it('should return Set with single value for non-array value', () => {
    const result = flattenIntoSet(['value1']);
    expect(result).toEqual(new Set(['value1']));
  });

  it('should flatten single-level array', () => {
    const result = flattenIntoSet([['a', 'b', 'c']]);
    expect(result).toEqual(new Set(['a', 'b', 'c']));
  });

  it('should flatten mixed values and arrays', () => {
    const result = flattenIntoSet(['value1', ['a', 'b'], 'value2', ['c', 'd']]);
    expect(result).toEqual(new Set(['value1', 'a', 'b', 'value2', 'c', 'd']));
  });

  it('should recursively flatten nested arrays', () => {
    const result = flattenIntoSet([['a', ['b', ['c', 'd']], 'e']]);
    expect(result).toEqual(new Set(['a', 'b', 'c', 'd', 'e']));
  });

  it('should handle various data types', () => {
    const obj = { key: 'value' };
    const result = flattenIntoSet([
      1,
      'string',
      true,
      null,
      undefined,
      obj,
      [2, 'nested'],
    ]);
    expect(result).toEqual(
      new Set([1, 'string', true, null, undefined, obj, 2, 'nested'])
    );
  });

  it('should deduplicate values', () => {
    const result = flattenIntoSet(['a', ['a', 'b'], ['b', 'c'], 'c']);
    expect(result).toEqual(new Set(['a', 'b', 'c']));
  });

  it('should work with Set as input', () => {
    const inputSet = new Set(['a', ['b', 'c'], 'd']);
    const result = flattenIntoSet(inputSet);
    expect(result).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('should handle deeply nested arrays', () => {
    const deeplyNested = [[[[[['deep']]]], 'shallow']];
    const result = flattenIntoSet(deeplyNested);
    expect(result).toEqual(new Set(['deep', 'shallow']));
  });

  it('should handle empty arrays within arrays', () => {
    const result = flattenIntoSet(['a', [], ['b', []], [[[]]], 'c']);
    expect(result).toEqual(new Set(['a', 'b', 'c']));
  });

  it('should preserve object references', () => {
    const obj1 = { id: 1 };
    const obj2 = { id: 2 };
    const result = flattenIntoSet([obj1, [obj2, obj1]]);
    expect(result.size).toBe(2);
    expect(result.has(obj1)).toBe(true);
    expect(result.has(obj2)).toBe(true);
  });

  it('should handle arrays containing Sets', () => {
    const innerSet = new Set(['x', 'y']);
    const result = flattenIntoSet(['a', [innerSet, 'b']]);
    expect(result).toEqual(new Set(['a', innerSet, 'b']));
  });
});
