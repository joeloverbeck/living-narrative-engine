import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { advancedArrayModify } from '../../../src/utils/arrayModifyUtils.js';

describe('advancedArrayModify', () => {
  let logger;

  beforeEach(() => {
    logger = { error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
  });

  it('push returns new array and result', () => {
    const arr = [1];
    const { nextArray, result } = advancedArrayModify('push', arr, 2, logger);
    expect(nextArray).toEqual([1, 2]);
    expect(result).toEqual([1, 2]);
    expect(arr).toEqual([1]);
    expect(nextArray).not.toBe(arr);
  });

  it('push_unique with object only adds when not present', () => {
    const obj = { a: 1 };
    const arr = [{ a: 1 }];
    const { nextArray, result, modified } = advancedArrayModify(
      'push_unique',
      arr,
      obj,
      logger
    );
    expect(nextArray).toBe(arr);
    expect(arr).toEqual([{ a: 1 }]);
    expect(result).toBe(arr);
    expect(modified).toBe(false);

    const { nextArray: newArr } = advancedArrayModify(
      'push_unique',
      arr,
      { a: 2 },
      logger
    );
    expect(newArr).toEqual([...arr, { a: 2 }]);
    expect(arr).toEqual([{ a: 1 }]);
  });

  it('push_unique treats objects with different key order as duplicates', () => {
    const arr = [{ a: 1, b: 2 }];
    const { nextArray, modified } = advancedArrayModify(
      'push_unique',
      arr,
      { b: 2, a: 1 },
      logger
    );

    expect(nextArray).toEqual([{ a: 1, b: 2 }]);
    expect(nextArray).toBe(arr);
    expect(modified).toBe(false);
  });

  it('pop returns popped item', () => {
    const arr = [1, 2];
    const { nextArray, result, modified } = advancedArrayModify(
      'pop',
      arr,
      null,
      logger
    );
    expect(nextArray).toEqual([1]);
    expect(result).toBe(2);
    expect(arr).toEqual([1, 2]);
    expect(nextArray).not.toBe(arr);
    expect(modified).toBe(true);
  });

  it('pop on empty array returns undefined result without modification', () => {
    const arr = [];
    const { nextArray, result, modified } = advancedArrayModify(
      'pop',
      arr,
      null,
      logger
    );
    expect(nextArray).toEqual([]);
    expect(nextArray).toBe(arr);
    expect(result).toBeUndefined();
    expect(modified).toBe(false);
  });

  it('remove_by_value removes object by deep match', () => {
    const target = { id: 1 };
    const arr = [{ id: 1 }, { id: 2 }];
    const { nextArray } = advancedArrayModify(
      'remove_by_value',
      arr,
      target,
      logger
    );
    expect(nextArray).toEqual([{ id: 2 }]);
    expect(arr).toEqual([{ id: 1 }, { id: 2 }]);
    expect(nextArray).not.toBe(arr);
  });

  it('remove_by_value removes primitive when present', () => {
    const arr = [1, 2, 3, 2];
    const { nextArray, modified, result } = advancedArrayModify(
      'remove_by_value',
      arr,
      2,
      logger
    );
    expect(nextArray).toEqual([1, 3, 2]);
    expect(result).toEqual([1, 3, 2]);
    expect(modified).toBe(true);
    expect(arr).toEqual([1, 2, 3, 2]);
    expect(nextArray).not.toBe(arr);
  });

  it('remove_by_value matches objects irrespective of key order', () => {
    const arr = [{ a: 1, b: 2, nested: { c: 3, d: 4 } }, { id: 2 }];
    const { nextArray, modified } = advancedArrayModify(
      'remove_by_value',
      arr,
      { b: 2, a: 1, nested: { d: 4, c: 3 } },
      logger
    );

    expect(nextArray).toEqual([{ id: 2 }]);
    expect(nextArray).not.toBe(arr);
    expect(modified).toBe(true);
  });

  it('remove_by_value returns new array when value not found', () => {
    const arr = [1, 2];
    const { nextArray, result, modified } = advancedArrayModify(
      'remove_by_value',
      arr,
      3,
      logger
    );
    expect(nextArray).toEqual([1, 2]);
    expect(nextArray).toBe(arr);
    expect(arr).toEqual([1, 2]);
    expect(result).toBe(arr);
    expect(modified).toBe(false);
  });

  it('push_unique with primitive handles duplicates and additions', () => {
    const arr = [1, 2];
    const { nextArray, modified } = advancedArrayModify(
      'push_unique',
      arr,
      2,
      logger
    );
    expect(nextArray).toEqual([1, 2]);
    expect(nextArray).toBe(arr);
    expect(modified).toBe(false);
    expect(arr).toEqual([1, 2]);

    const { nextArray: extended, modified: extendedModified } =
      advancedArrayModify('push_unique', arr, 3, logger);
    expect(extended).toEqual([1, 2, 3]);
    expect(extended).not.toBe(arr);
    expect(extendedModified).toBe(true);
  });

  it('logs error when provided value is not an array', () => {
    const notArray = 'oops';
    const result = advancedArrayModify('push', notArray, 1, logger);
    expect(result).toEqual({
      nextArray: notArray,
      result: undefined,
      modified: false,
    });
    expect(logger.error).toHaveBeenCalledWith(
      'advancedArrayModify: provided value is not an array'
    );
  });

  it('returns fallback result and logs error for unknown mode', () => {
    const arr = [1, 2];
    const { nextArray, result, modified } = advancedArrayModify(
      'invalid',
      arr,
      3,
      logger
    );
    expect(nextArray).toEqual([1, 2]);
    expect(nextArray).toBe(arr);
    expect(result).toBeUndefined();
    expect(modified).toBe(false);
    expect(logger.error).toHaveBeenCalledWith('Unknown mode: invalid');
  });
});
